import { describe, it, expect } from 'vitest';
import {
  calculateQuantile,
  computeResilienceMetrics,
} from '../../src/engine/resilience.ts';

describe('Resilience Metrics & Tail Risk Engine', () => {
  it('computes quantiles correctly with linear interpolation', () => {
    const values = [10, 20, 30, 40, 50]; // sorted
    expect(calculateQuantile(values, 0.0)).toBe(10);
    expect(calculateQuantile(values, 0.5)).toBe(30);
    expect(calculateQuantile(values, 1.0)).toBe(50);
    expect(calculateQuantile(values, 0.25)).toBe(20);
  });

  it('computes VaR95, CVaR95, P(loss), and profit retention ratio for simulated distributions', () => {
    // 100 simulated outcomes
    // 10 loss outcomes (-50, -40, ... -5), 90 positive outcomes (10 ... 100)
    const simulated: number[] = [];
    for (let i = 1; i <= 10; i++) simulated.push(-50 + i * 4); // all negative
    for (let i = 1; i <= 90; i++) simulated.push(10 + i); // all positive

    const baseline = 60;
    const metrics = computeResilienceMetrics(simulated, baseline);

    expect(metrics.iterations).toBe(100);
    expect(metrics.pLoss).toBeCloseTo(0.1, 2); // 10 out of 100 are < 0
    expect(metrics.var95).toBeLessThan(0); // 5th percentile is negative
    expect(metrics.cvar95).toBeLessThanOrEqual(metrics.var95); // CVaR is worse than or equal to VaR
    expect(metrics.profitRetentionRatio).toBeGreaterThan(0);
    expect(metrics.retentionRatioState).toBe('VALID');
  });

  it('handles edge case when baseline profit is zero or negative', () => {
    const simulated = [10, 20, 30, 40, 50];
    const metricsZero = computeResilienceMetrics(simulated, 0);

    expect(metricsZero.profitRetentionRatio).toBe(0);
    expect(metricsZero.retentionRatioState).toBe('BASELINE_ZERO_OR_NEGATIVE');

    const simulatedLoss = [-10, -20, -30];
    const metricsBothLoss = computeResilienceMetrics(simulatedLoss, -15);
    expect(metricsBothLoss.retentionRatioState).toBe('BOTH_NEGATIVE');
  });

  it('handles empty simulation input safely', () => {
    const emptyMetrics = computeResilienceMetrics([], 100);
    expect(emptyMetrics.iterations).toBe(0);
    expect(emptyMetrics.expectedProfit).toBe(0);
    expect(emptyMetrics.pLoss).toBe(0);
  });
});

