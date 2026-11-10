/**
 * Financial resilience metrics for Monte Carlo fee-shock simulation.
 */

export interface ResilienceMetrics {
  iterations: number;
  expectedProfit: number; // Mean of simulated profits
  medianProfit: number;
  minProfit: number;
  maxProfit: number;
  stdDevProfit: number;
  baselineProfit: number;
  pLoss: number; // Probability of loss: count(profit < 0) / iterations
  var95: number; // Value at Risk (5th percentile): threshold below which the worst 5% outcomes fall
  cvar95: number; // Conditional Value at Risk: expected profit given that outcome <= VaR95
  profitRetentionRatio: number; // expectedProfit / baselineProfit (handled safely if baseline <= 0)
  retentionRatioState: 'VALID' | 'BASELINE_ZERO_OR_NEGATIVE' | 'BOTH_NEGATIVE';
}

/**
 * Calculates quantile value using linear interpolation between closest ranks.
 * @param sortedValues Array of numbers sorted in ascending order
 * @param q Quantile between 0 and 1 (e.g., 0.05 for 5th percentile)
 */
export function calculateQuantile(sortedValues: number[], q: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  if (q <= 0) return sortedValues[0];
  if (q >= 1) return sortedValues[sortedValues.length - 1];

  const pos = (sortedValues.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;

  if (base + 1 < sortedValues.length) {
    return sortedValues[base] + rest * (sortedValues[base + 1] - sortedValues[base]);
  }
  return sortedValues[base];
}

/**
 * Computes all resilience metrics from an array of simulated profit results.
 */
export function computeResilienceMetrics(
  simulatedProfits: number[],
  baselineProfit: number
): ResilienceMetrics {
  const n = simulatedProfits.length;
  if (n === 0) {
    return {
      iterations: 0,
      expectedProfit: 0,
      medianProfit: 0,
      minProfit: 0,
      maxProfit: 0,
      stdDevProfit: 0,
      baselineProfit,
      pLoss: 0,
      var95: 0,
      cvar95: 0,
      profitRetentionRatio: 0,
      retentionRatioState: 'BASELINE_ZERO_OR_NEGATIVE',
    };
  }

  // Sort ascending for quantile and tail risk calculations
  const sorted = [...simulatedProfits].sort((a, b) => a - b);

  let sum = 0;
  let lossCount = 0;
  for (let i = 0; i < n; i++) {
    const val = sorted[i];
    sum += val;
    if (val < 0) {
      lossCount++;
    }
  }

  const expectedProfit = sum / n;
  const medianProfit = calculateQuantile(sorted, 0.5);
  const minProfit = sorted[0];
  const maxProfit = sorted[n - 1];

  // Variance & Standard Deviation
  let varianceSum = 0;
  for (let i = 0; i < n; i++) {
    const diff = sorted[i] - expectedProfit;
    varianceSum += diff * diff;
  }
  const stdDevProfit = Math.sqrt(varianceSum / n);

  // Probability of loss
  const pLoss = lossCount / n;

  // VaR95 = 5th percentile
  const var95 = calculateQuantile(sorted, 0.05);

  // CVaR95 = Expected profit of outcomes at or below VaR95
  let cvarSum = 0;
  let cvarCount = 0;
  for (let i = 0; i < n; i++) {
    if (sorted[i] <= var95) {
      cvarSum += sorted[i];
      cvarCount++;
    } else {
      break;
    }
  }
  const cvar95 = cvarCount > 0 ? cvarSum / cvarCount : var95;

  // Profit retention ratio = E[shocked profit] / baseline profit
  let profitRetentionRatio = 0;
  let retentionRatioState: ResilienceMetrics['retentionRatioState'] = 'VALID';

  if (baselineProfit <= 0) {
    profitRetentionRatio = 0;
    retentionRatioState =
      expectedProfit < 0 ? 'BOTH_NEGATIVE' : 'BASELINE_ZERO_OR_NEGATIVE';
  } else {
    profitRetentionRatio = expectedProfit / baselineProfit;
    retentionRatioState = 'VALID';
  }

  return {
    iterations: n,
    expectedProfit,
    medianProfit,
    minProfit,
    maxProfit,
    stdDevProfit,
    baselineProfit,
    pLoss,
    var95,
    cvar95,
    profitRetentionRatio,
    retentionRatioState,
  };
}

