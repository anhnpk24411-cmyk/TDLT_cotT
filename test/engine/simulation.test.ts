import { describe, it, expect } from 'vitest';
import { runSimulation, buildHistogram, SimulationConfig } from '../../src/engine/simulation.ts';
import { Product, OrderLine, FeeSchedule } from '../../src/engine/types.ts';

const mockProducts: Product[] = [
  { sku: 'SKU-01', name: 'Áo thun nam', category: 'Thời trang', cost_of_goods: 50000, price: 150000 },
  { sku: 'SKU-02', name: 'Váy nữ', category: 'Thời trang', cost_of_goods: 80000, price: 200000 },
];

const mockSchedules: FeeSchedule[] = [
  {
    id: 'FS-01',
    platform: 'Shopee',
    category: '*',
    effective_from: '2024-01-01',
    commission_rate: 0.05,
    payment_rate: 0.04,
    service_rate: 0.03,
    program_rates: [],
    is_active: true,
    origin: 'manual',
  },
];

const mockOrders: OrderLine[] = [
  {
    id: 'ORD-01',
    date: '2024-05-01',
    channel: 'Shopee',
    sku: 'SKU-01',
    quantity: 2,
    gross_revenue: 300000,
    discount: 0,
    returned: false,
    shipping_cost_seller: 0,
    ads_cost_allocated: 20000,
    other_cost: 5000,
  },
  {
    id: 'ORD-02',
    date: '2024-05-02',
    channel: 'Shopee',
    sku: 'SKU-02',
    quantity: 1,
    gross_revenue: 200000,
    discount: 10000,
    returned: false,
    shipping_cost_seller: 15000,
    ads_cost_allocated: 15000,
    other_cost: 5000,
  },
];

describe('Monte Carlo Fee-Shock Simulation Engine', () => {
  it('guarantees reproducibility: same seed and inputs produce identical results', () => {
    const config: SimulationConfig = {
      mode: 'stochastic',
      iterations: 500,
      seed: 42,
      lambda: 2.0,
      triangularMin: 0.01,
      triangularMode: 0.02,
      triangularMax: 0.04,
      uncertaintyReturnRate: true,
      uncertaintyAdCost: true,
    };

    const run1 = runSimulation(mockOrders, mockProducts, mockSchedules, config);
    const run2 = runSimulation(mockOrders, mockProducts, mockSchedules, config);

    expect(run1.baselineProfit).toBe(run2.baselineProfit);
    expect(run1.metrics.expectedProfit).toBe(run2.metrics.expectedProfit);
    expect(run1.metrics.var95).toBe(run2.metrics.var95);
    expect(run1.metrics.cvar95).toBe(run2.metrics.cvar95);
    expect(run1.metrics.pLoss).toBe(run2.metrics.pLoss);
    expect(run1.simulatedProfits).toEqual(run2.simulatedProfits);
  });

  it('runs preset modes (+1pp, +3pp, +5pp) and exhibits decreasing expected profit', () => {
    const baseConfig: Omit<SimulationConfig, 'presetCommissionDelta'> = {
      mode: 'preset',
      iterations: 100,
      seed: 12345,
      lambda: 1,
      triangularMin: 0.01,
      triangularMode: 0.02,
      triangularMax: 0.03,
    };

    const res1pp = runSimulation(mockOrders, mockProducts, mockSchedules, {
      ...baseConfig,
      presetCommissionDelta: 0.01,
    });

    const res3pp = runSimulation(mockOrders, mockProducts, mockSchedules, {
      ...baseConfig,
      presetCommissionDelta: 0.03,
    });

    const res5pp = runSimulation(mockOrders, mockProducts, mockSchedules, {
      ...baseConfig,
      presetCommissionDelta: 0.05,
    });

    expect(res1pp.metrics.expectedProfit).toBeGreaterThan(res3pp.metrics.expectedProfit);
    expect(res3pp.metrics.expectedProfit).toBeGreaterThan(res5pp.metrics.expectedProfit);
    expect(res1pp.baselineProfit).toBe(res5pp.baselineProfit);
  });

  it('reports progress updates during simulation runs', () => {
    const progressReports: number[] = [];
    const config: SimulationConfig = {
      mode: 'preset',
      presetCommissionDelta: 0.02,
      iterations: 1000,
      seed: 999,
      lambda: 1,
      triangularMin: 0.01,
      triangularMode: 0.02,
      triangularMax: 0.03,
    };

    runSimulation(mockOrders, mockProducts, mockSchedules, config, (prog) => {
      progressReports.push(prog);
    });

    expect(progressReports.length).toBeGreaterThan(0);
    expect(progressReports[progressReports.length - 1]).toBe(100);
  });

  it('builds histogram bins with valid distribution and summing to ~100%', () => {
    const values = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
    const bins = buildHistogram(values, 5);

    expect(bins.length).toBe(5);
    const totalCount = bins.reduce((sum, b) => sum + b.count, 0);
    expect(totalCount).toBe(values.length);

    const totalPercentage = bins.reduce((sum, b) => sum + b.percentage, 0);
    expect(Math.round(totalPercentage)).toBe(100);
  });

  it('handles empty orders gracefully with 0 baseline and zero metrics', () => {
    const config: SimulationConfig = {
      mode: 'preset',
      presetCommissionDelta: 0.01,
      iterations: 50,
      seed: 7,
      lambda: 1,
      triangularMin: 0.01,
      triangularMode: 0.02,
      triangularMax: 0.03,
    };

    const result = runSimulation([], mockProducts, mockSchedules, config);
    expect(result.baselineProfit).toBe(0);
    expect(result.metrics.expectedProfit).toBe(0);
    expect(result.metrics.pLoss).toBe(0);
  });
});

