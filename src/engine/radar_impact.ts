import { OrderLine, Product, FeeSchedule, TaxPolicyVersion, WithholdingRecord } from './types.ts';
import { aggregateShopProfit } from './profit.ts';
import { calculateTaxObligation } from './tax.ts';
import { calculateFeeTolerance, FeeToleranceResult } from './bisection.ts';

export interface RadarImpactResult {
  evaluationPeriodOrdersCount: number;
  oldNetProfitBeforeTax: number;
  newNetProfitBeforeTax: number;
  deltaProfitVnd: number; // newProfit - oldProfit
  deltaProfitPercent: number; // (delta / |oldProfit|) * 100
  oldMargin: number;
  newMargin: number;
  oldFeeTolerance: FeeToleranceResult;
  newFeeTolerance: FeeToleranceResult;
  taxImpact: {
    aggregateAnnualRevenue: number;
    threshold: number;
    oldTaxLiability: number;
    newTaxLiability: number;
    deltaTaxLiability: number;
    oldAfterTaxProfit: number;
    newAfterTaxProfit: number;
    deltaAfterTaxProfit: number;
    crossedThreshold: boolean;
    warningMessage?: string;
  };
}

/**
 * Evaluates monetary impact of an incoming policy or fee change over historical orders.
 */
export function evaluateRadarImpact(
  orders: OrderLine[],
  products: Product[] | Map<string, Product>,
  existingSchedules: FeeSchedule[],
  newSchedules: FeeSchedule[],
  existingTaxPolicy: TaxPolicyVersion,
  newTaxPolicy: TaxPolicyVersion,
  withholdings: WithholdingRecord[] = []
): RadarImpactResult {
  // Aggregate profit under existing schedules
  const oldSummary = aggregateShopProfit(orders, products, existingSchedules);
  // Aggregate profit under new schedules
  const newSummary = aggregateShopProfit(orders, products, newSchedules);

  const deltaProfitVnd = newSummary.netProfitBeforeTax - oldSummary.netProfitBeforeTax;
  const deltaProfitPercent =
    oldSummary.netProfitBeforeTax !== 0
      ? (deltaProfitVnd / Math.abs(oldSummary.netProfitBeforeTax)) * 100
      : 0;

  // Fee tolerance calculation before vs after
  const oldFeeTolerance = calculateFeeTolerance((commissionDelta) => {
    const bumpedSchedules = existingSchedules.map((s) => ({
      ...s,
      commission_rate: Math.min(1.0, s.commission_rate + commissionDelta),
    }));
    return aggregateShopProfit(orders, products, bumpedSchedules).netProfitBeforeTax;
  });

  const newFeeTolerance = calculateFeeTolerance((commissionDelta) => {
    const bumpedSchedules = newSchedules.map((s) => ({
      ...s,
      commission_rate: Math.min(1.0, s.commission_rate + commissionDelta),
    }));
    return aggregateShopProfit(orders, products, bumpedSchedules).netProfitBeforeTax;
  });

  // Tax calculations
  const oldTax = calculateTaxObligation(
    oldSummary.netRevenue,
    oldSummary.netProfitBeforeTax,
    existingTaxPolicy,
    withholdings
  );

  const newTax = calculateTaxObligation(
    newSummary.netRevenue,
    newSummary.netProfitBeforeTax,
    newTaxPolicy,
    withholdings
  );

  const deltaTaxLiability = newTax.totalTaxLiability - oldTax.totalTaxLiability;
  const deltaAfterTaxProfit = newTax.afterTaxProfit - oldTax.afterTaxProfit;
  const crossedThreshold = !oldTax.isAboveThreshold && newTax.isAboveThreshold;

  let warningMessage: string | undefined;
  if (crossedThreshold) {
    warningMessage =
      'CẢNH BÁO: Chính sách mới đã đẩy doanh thu lũy kế vượt ngưỡng thuế, phát sinh thêm nghĩa vụ thuế và chi phí tuân thủ!';
  } else if (newTax.closeToThresholdWarning) {
    warningMessage = 'Lưu ý: Doanh thu của bạn đang tiến rất gần ngưỡng thuế quy định.';
  }

  return {
    evaluationPeriodOrdersCount: orders.length,
    oldNetProfitBeforeTax: oldSummary.netProfitBeforeTax,
    newNetProfitBeforeTax: newSummary.netProfitBeforeTax,
    deltaProfitVnd,
    deltaProfitPercent,
    oldMargin: oldSummary.overallMargin,
    newMargin: newSummary.overallMargin,
    oldFeeTolerance,
    newFeeTolerance,
    taxImpact: {
      aggregateAnnualRevenue: oldSummary.netRevenue,
      threshold: newTaxPolicy.revenue_threshold,
      oldTaxLiability: oldTax.totalTaxLiability,
      newTaxLiability: newTax.totalTaxLiability,
      deltaTaxLiability,
      oldAfterTaxProfit: oldTax.afterTaxProfit,
      newAfterTaxProfit: newTax.afterTaxProfit,
      deltaAfterTaxProfit,
      crossedThreshold,
      warningMessage,
    },
  };
}

