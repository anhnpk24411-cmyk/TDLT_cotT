import { describe, it, expect } from 'vitest';
import { calculateFeeTolerance } from '../../src/engine/bisection.ts';

describe('Bisection Fee Tolerance Algorithm', () => {
  it('solves fee tolerance correctly for standard profitable shop', () => {
    // Suppose baseline profit is 100,000,000 VND on 1,000,000,000 VND revenue.
    // Each 1pp (0.01) increase in commission reduces profit by 10,000,000 VND.
    // Break-even is at +10pp (+0.10).
    const revenue = 1_000_000_000;
    const baseline = 100_000_000;
    const evaluateProfit = (delta: number) => baseline - delta * revenue;

    const result = calculateFeeTolerance(evaluateProfit);

    expect(result.state).toBe('SOLVED');
    expect(result.toleranceDecimal).toBeCloseTo(0.1, 3);
    expect(result.tolerancePercentagePoints).toBeCloseTo(10.0, 1);
    expect(result.iterations).toBeGreaterThan(0);
  });

  it('handles edge case: baseline profit is ALREADY_NEGATIVE', () => {
    const evaluateProfit = (delta: number) => -50_000_000 - delta * 1_000_000;

    const result = calculateFeeTolerance(evaluateProfit);

    expect(result.state).toBe('ALREADY_NEGATIVE');
    expect(result.toleranceDecimal).toBe(0);
    expect(result.tolerancePercentagePoints).toBe(0);
    expect(result.iterations).toBe(0);
  });

  it('handles edge case: NO_LIMIT_FOUND within search range', () => {
    // Immensely profitable shop that stays positive even if commission goes +100pp
    const evaluateProfit = (delta: number) => 500_000_000 - delta * 100_000_000;

    const result = calculateFeeTolerance(evaluateProfit, { maxSearchDelta: 1.0 });

    expect(result.state).toBe('NO_LIMIT_FOUND');
    expect(result.toleranceDecimal).toBe(1.0);
    expect(result.tolerancePercentagePoints).toBe(100);
  });

  it('respects custom delta tolerance', () => {
    const evaluateProfit = (delta: number) => 50_000 - delta * 1_000_000; // Break-even at 0.05
    const result = calculateFeeTolerance(evaluateProfit, {
      tolerance: 0.00001,
      profitThreshold: 1,
    });

    expect(result.state).toBe('SOLVED');
    expect(result.toleranceDecimal).toBeCloseTo(0.05, 4);
  });
});

