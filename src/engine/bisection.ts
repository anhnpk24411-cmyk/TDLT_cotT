/**
 * Bisection algorithm to calculate fee tolerance (break-even commission hike).
 */

export type FeeToleranceState =
  | 'SOLVED'
  | 'ALREADY_NEGATIVE'
  | 'NO_LIMIT_FOUND'
  | 'FAILED_TO_CONVERGE';

export interface FeeToleranceResult {
  state: FeeToleranceState;
  toleranceDecimal: number; // e.g. 0.045 for 4.5%
  tolerancePercentagePoints: number; // e.g. 4.5 pp
  baselineProfit: number;
  iterations: number;
  description: string;
}

/**
 * Calculates fee tolerance: the maximum commission increase (in decimal / pp)
 * before the shop's net profit reaches 0.
 *
 * @param evaluateProfit Function mapping commission delta (in decimal, e.g. 0.05) to net profit
 * @param options Configuration options for bisection
 */
export function calculateFeeTolerance(
  evaluateProfit: (commissionDelta: number) => number,
  options?: {
    maxSearchDelta?: number; // Default 1.0 (+100pp)
    tolerance?: number; // Accuracy in commission delta, default 0.0001 (0.01 pp)
    profitThreshold?: number; // Profit within this amount of 0 is considered converged (VND)
    maxIterations?: number; // Max bisection iterations
  }
): FeeToleranceResult {
  const maxSearchDelta = options?.maxSearchDelta ?? 1.0;
  const tolerance = options?.tolerance ?? 0.0001;
  const profitThreshold = options?.profitThreshold ?? 100; // 100 VND
  const maxIterations = options?.maxIterations ?? 100;

  const baselineProfit = evaluateProfit(0);

  // Case 1: Baseline profit is already negative
  if (baselineProfit < 0) {
    return {
      state: 'ALREADY_NEGATIVE',
      toleranceDecimal: 0,
      tolerancePercentagePoints: 0,
      baselineProfit,
      iterations: 0,
      description: 'Lợi nhuận cơ sở đã âm; không thể chịu thêm bất kỳ mức tăng phí nào.',
    };
  }

  // Case 2: Even at max commission delta, profit is still positive
  const maxDeltaProfit = evaluateProfit(maxSearchDelta);
  if (maxDeltaProfit >= 0) {
    return {
      state: 'NO_LIMIT_FOUND',
      toleranceDecimal: maxSearchDelta,
      tolerancePercentagePoints: maxSearchDelta * 100,
      baselineProfit,
      iterations: 1,
      description: `Shop vẫn có lãi ngay cả khi phí sàn tăng vượt quá +${(maxSearchDelta * 100).toFixed(0)} điểm phần trăm.`,
    };
  }

  // Case 3: Root exists in [0, maxSearchDelta].
  // Profit is strictly monotonically decreasing with respect to commission hike.
  let low = 0;
  let high = maxSearchDelta;
  let iter = 0;

  while (iter < maxIterations && high - low > tolerance) {
    iter++;
    const mid = (low + high) / 2;
    const profitAtMid = evaluateProfit(mid);

    if (Math.abs(profitAtMid) <= profitThreshold) {
      return {
        state: 'SOLVED',
        toleranceDecimal: mid,
        tolerancePercentagePoints: mid * 100,
        baselineProfit,
        iterations: iter,
        description: `Ngưỡng chịu đựng tăng phí: +${(mid * 100).toFixed(2)} pp.`,
      };
    }

    if (profitAtMid > 0) {
      // Still profitable, can absorb higher fee
      low = mid;
    } else {
      // Incurred loss, fee increase too high
      high = mid;
    }
  }

  const solution = (low + high) / 2;
  return {
    state: 'SOLVED',
    toleranceDecimal: solution,
    tolerancePercentagePoints: solution * 100,
    baselineProfit,
    iterations: iter,
    description: `Ngưỡng chịu đựng tăng phí: +${(solution * 100).toFixed(2)} pp.`,
  };
}

