import { OrderLine, Product, FeeSchedule } from './types.ts';
import { createMulberry32 } from './prng.ts';
import { randomPoisson, randomTriangular, randomUniform } from './distributions.ts';
import { aggregateShopProfit } from './profit.ts';
import { computeResilienceMetrics, ResilienceMetrics } from './resilience.ts';
import { calculateFeeTolerance, FeeToleranceResult } from './bisection.ts';

export interface SimulationConfig {
  mode: 'preset' | 'stochastic';
  presetCommissionDelta?: number; // e.g. 0.01 (+1pp), 0.03 (+3pp), 0.05 (+5pp)
  iterations: number; // default 10,000
  seed: number;
  // Stochastic parameters
  lambda: number; // Poisson arrival rate (events per year)
  triangularMin: number; // in decimal (e.g. 0.01)
  triangularMode: number; // in decimal (e.g. 0.02)
  triangularMax: number; // in decimal (e.g. 0.04)
  uncertaintyReturnRate?: boolean;
  returnMultiplierMin?: number; // default 0.9
  returnMultiplierMax?: number; // default 1.3
  uncertaintyAdCost?: boolean;
  adMultiplierMin?: number; // default 0.9
  adMultiplierMax?: number; // default 1.4
}

export interface HistogramBin {
  binStart: number;
  binEnd: number;
  binLabel: string;
  count: number;
  percentage: number;
}

export interface SimulationResult {
  config: SimulationConfig;
  baselineProfit: number;
  simulatedProfits: number[];
  metrics: ResilienceMetrics;
  feeTolerance: FeeToleranceResult;
  histogram: HistogramBin[];
  executionTimeMs: number;
}

/**
 * Builds a histogram with specified number of bins.
 */
export function buildHistogram(values: number[], numBins = 30): HistogramBin[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    return [
      {
        binStart: min,
        binEnd: max,
        binLabel: `${Math.round(min).toLocaleString('vi-VN')} đ`,
        count: values.length,
        percentage: 100,
      },
    ];
  }

  const binWidth = (max - min) / numBins;
  const bins: HistogramBin[] = Array.from({ length: numBins }, (_, i) => {
    const start = min + i * binWidth;
    const end = start + binWidth;
    return {
      binStart: start,
      binEnd: end,
      binLabel: `${Math.round(start).toLocaleString('vi-VN')}`,
      count: 0,
      percentage: 0,
    };
  });

  for (const v of values) {
    let index = Math.floor((v - min) / binWidth);
    if (index >= numBins) index = numBins - 1;
    if (index < 0) index = 0;
    bins[index].count++;
  }

  for (const b of bins) {
    b.percentage = Number(((b.count / values.length) * 100).toFixed(2));
  }

  return bins;
}

/**
 * Core Monte Carlo fee-shock simulation engine.
 * Pure function, fully deterministic given seed and inputs.
 */
export function runSimulation(
  orders: OrderLine[],
  products: Product[],
  feeSchedules: FeeSchedule[],
  config: SimulationConfig,
  onProgress?: (progress: number, currentRun: number) => void
): SimulationResult {
  const startTime = performance.now();
  const rng = createMulberry32(config.seed);
  const productMap = products instanceof Map ? products : new Map(products.map((p) => [p.sku, p]));

  // 1. Baseline profit
  const baselineSummary = aggregateShopProfit(orders, productMap, feeSchedules);
  const baselineProfit = baselineSummary.netProfitBeforeTax;

  // 2. Fee tolerance via bisection:
  // evaluateProfit(delta) increases commission rate by delta on all schedules
  const feeTolerance = calculateFeeTolerance((commissionDelta) => {
    const shockedSchedules = feeSchedules.map((s) => ({
      ...s,
      commission_rate: Math.min(1.0, s.commission_rate + commissionDelta),
    }));
    return aggregateShopProfit(orders, productMap, shockedSchedules).netProfitBeforeTax;
  });

  // 3. Monte Carlo iterations
  const simulatedProfits: number[] = new Array(config.iterations);
  const reportInterval = Math.max(100, Math.floor(config.iterations / 20));

  for (let i = 0; i < config.iterations; i++) {
    let iterationProfit = 0;

    if (config.mode === 'preset') {
      const delta = config.presetCommissionDelta ?? 0.01;
      const shockedSchedules = feeSchedules.map((s) => ({
        ...s,
        commission_rate: Math.min(1.0, s.commission_rate + delta),
      }));

      let modifiedOrders = orders;
      if (config.uncertaintyAdCost || config.uncertaintyReturnRate) {
        const adMult = config.uncertaintyAdCost
          ? randomUniform(rng, config.adMultiplierMin ?? 0.9, config.adMultiplierMax ?? 1.4)
          : 1.0;
        const retMult = config.uncertaintyReturnRate
          ? randomUniform(rng, config.returnMultiplierMin ?? 0.9, config.returnMultiplierMax ?? 1.3)
          : 1.0;

        modifiedOrders = orders.map((o) => ({
          ...o,
          ads_cost_allocated: o.ads_cost_allocated * adMult,
          shipping_cost_seller: o.returned ? o.shipping_cost_seller * retMult : o.shipping_cost_seller,
        }));
      }

      iterationProfit = aggregateShopProfit(modifiedOrders, productMap, shockedSchedules).netProfitBeforeTax;
    } else {
      // Stochastic mode
      // Number of hikes ~ Poisson(lambda)
      const hikesCount = randomPoisson(rng, config.lambda);
      let totalHike = 0;
      for (let h = 0; h < hikesCount; h++) {
        totalHike += randomTriangular(
          rng,
          config.triangularMin,
          config.triangularMode,
          config.triangularMax
        );
      }

      // Apply totalHike to commission rates
      const shockedSchedules = feeSchedules.map((s) => ({
        ...s,
        commission_rate: Math.min(1.0, s.commission_rate + totalHike),
      }));

      let modifiedOrders = orders;
      if (config.uncertaintyAdCost || config.uncertaintyReturnRate) {
        const adMult = config.uncertaintyAdCost
          ? randomUniform(rng, config.adMultiplierMin ?? 0.9, config.adMultiplierMax ?? 1.4)
          : 1.0;
        const retMult = config.uncertaintyReturnRate
          ? randomUniform(rng, config.returnMultiplierMin ?? 0.9, config.returnMultiplierMax ?? 1.3)
          : 1.0;

        modifiedOrders = orders.map((o) => ({
          ...o,
          ads_cost_allocated: o.ads_cost_allocated * adMult,
          shipping_cost_seller: o.returned ? o.shipping_cost_seller * retMult : o.shipping_cost_seller,
        }));
      }

      iterationProfit = aggregateShopProfit(modifiedOrders, productMap, shockedSchedules).netProfitBeforeTax;
    }

    simulatedProfits[i] = iterationProfit;

    if (onProgress && (i % reportInterval === 0 || i === config.iterations - 1)) {
      onProgress(Math.round(((i + 1) / config.iterations) * 100), i + 1);
    }
  }

  // 4. Compute metrics and histogram
  const metrics = computeResilienceMetrics(simulatedProfits, baselineProfit);
  const histogram = buildHistogram(simulatedProfits, 25);
  const executionTimeMs = Math.round(performance.now() - startTime);

  return {
    config,
    baselineProfit,
    simulatedProfits,
    metrics,
    feeTolerance,
    histogram,
    executionTimeMs,
  };
}
