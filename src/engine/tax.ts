import { TaxPolicyVersion, WithholdingRecord, Channel } from './types.ts';

export interface MultiChannelRevenue {
  channel: Channel;
  grossRevenue: number;
  netRevenue: number;
}

export interface TaxCalculationResult {
  taxYear: number;
  aggregateAnnualRevenue: number; // R = sum over all channels
  revenueThreshold: number;
  boundaryRule: '<=' | '<';
  isAboveThreshold: boolean;
  effectiveTaxRates: Array<{
    category: string;
    vatRate: number;
    pitRate: number;
    applicableRevenue: number;
    vatAmount: number;
    pitAmount: number;
    totalTaxAmount: number;
  }>;
  totalTaxLiability: number; // Sum of VAT + PIT
  totalWithheld: number; // Sum of platform withholdings
  settlementAmount: number; // liability - totalWithheld (negative = refund/offset)
  isRefund: boolean;
  complianceCost: number;
  afterTaxProfit: number; // netProfitBeforeTax - liability - (isAbove ? complianceCost : 0)
  distanceToThreshold: number; // revenueThreshold - aggregateAnnualRevenue
  ratioToThreshold: number; // aggregateAnnualRevenue / revenueThreshold
  closeToThresholdWarning: boolean; // within warning margin, e.g. >= 90%
  appliedPolicyVersionId: string;
}

/**
 * Computes aggregate annual revenue across all sales channels.
 * Rule: R is always the seller-level total, never evaluated per-platform.
 */
export function computeAggregateRevenue(
  channelRevenues: MultiChannelRevenue[]
): {
  aggregateGrossRevenue: number;
  aggregateNetRevenue: number;
  byChannel: Record<Channel, MultiChannelRevenue>;
} {
  let aggregateGrossRevenue = 0;
  let aggregateNetRevenue = 0;
  const byChannel: Record<Channel, MultiChannelRevenue> = {
    Shopee: { channel: 'Shopee', grossRevenue: 0, netRevenue: 0 },
    'TikTok Shop': { channel: 'TikTok Shop', grossRevenue: 0, netRevenue: 0 },
    Lazada: { channel: 'Lazada', grossRevenue: 0, netRevenue: 0 },
    Other: { channel: 'Other', grossRevenue: 0, netRevenue: 0 },
  };

  for (const cr of channelRevenues) {
    aggregateGrossRevenue += cr.grossRevenue;
    aggregateNetRevenue += cr.netRevenue;
    byChannel[cr.channel] = {
      channel: cr.channel,
      grossRevenue: cr.grossRevenue,
      netRevenue: cr.netRevenue,
    };
  }

  return {
    aggregateGrossRevenue,
    aggregateNetRevenue,
    byChannel,
  };
}

/**
 * Determines whether revenue R exceeds the threshold based on boundary rule.
 */
export function isRevenueAboveThreshold(
  R: number,
  threshold: number,
  boundaryRule: '<=' | '<'
): boolean {
  if (boundaryRule === '<=') {
    return R > threshold;
  } else {
    return R >= threshold;
  }
}

/**
 * Evaluates annual tax liability, withholding settlement, and after-tax profit.
 * @param aggregateRevenue Seller's total aggregate annual revenue across ALL channels
 * @param netProfitBeforeTax Seller's total pre-tax profit
 * @param policy Active TaxPolicyVersion
 * @param withholdings Historical platform withholding tax records
 * @param warningMargin Proximity threshold ratio (e.g. 0.90 for 90%)
 * @param taxYear Calendar year
 */
export function calculateTaxObligation(
  aggregateRevenue: number,
  netProfitBeforeTax: number,
  policy: TaxPolicyVersion,
  withholdings: WithholdingRecord[] = [],
  warningMargin = 0.9,
  taxYear = new Date().getFullYear()
): TaxCalculationResult {
  const isAbove = isRevenueAboveThreshold(
    aggregateRevenue,
    policy.revenue_threshold,
    policy.boundary_rule
  );

  let totalTaxLiability = 0;
  const effectiveTaxRates: TaxCalculationResult['effectiveTaxRates'] = [];

  if (isAbove && policy.tax_rates.length > 0) {
    // If tax rates configured, apply them. Default assumption: revenue distributes across categories
    // If single category, applies to entire aggregate revenue
    const perCategoryRevenue = aggregateRevenue / policy.tax_rates.length;
    for (const rateItem of policy.tax_rates) {
      const vatAmount = perCategoryRevenue * rateItem.vat_rate;
      const pitAmount = perCategoryRevenue * rateItem.pit_rate;
      const totalTaxAmount = vatAmount + pitAmount;

      effectiveTaxRates.push({
        category: rateItem.category,
        vatRate: rateItem.vat_rate,
        pitRate: rateItem.pit_rate,
        applicableRevenue: perCategoryRevenue,
        vatAmount,
        pitAmount,
        totalTaxAmount,
      });

      totalTaxLiability += totalTaxAmount;
    }
  }

  const totalWithheld = withholdings.reduce((sum, w) => sum + w.amount, 0);

  // Settlement = liability - withholding
  // Negative means refund or tax credit (never double-count tax already withheld)
  const settlementAmount = totalTaxLiability - totalWithheld;
  const isRefund = settlementAmount < 0;

  const complianceCost = isAbove ? policy.compliance_cost_above_threshold : 0;
  const afterTaxProfit = netProfitBeforeTax - totalTaxLiability - complianceCost;

  const distanceToThreshold = policy.revenue_threshold - aggregateRevenue;
  const ratioToThreshold =
    policy.revenue_threshold > 0 ? aggregateRevenue / policy.revenue_threshold : 1;

  const closeToThresholdWarning =
    !isAbove && ratioToThreshold >= warningMargin && ratioToThreshold < 1.0;

  return {
    taxYear,
    aggregateAnnualRevenue: aggregateRevenue,
    revenueThreshold: policy.revenue_threshold,
    boundaryRule: policy.boundary_rule,
    isAboveThreshold: isAbove,
    effectiveTaxRates,
    totalTaxLiability,
    totalWithheld,
    settlementAmount,
    isRefund,
    complianceCost,
    afterTaxProfit,
    distanceToThreshold,
    ratioToThreshold,
    closeToThresholdWarning,
    appliedPolicyVersionId: policy.id,
  };
}

/**
 * Generates data points for the Tax Cliff Curve (After-tax profit vs Annual Revenue)
 * spanning [minRatio * threshold, maxRatio * threshold].
 */
export function generateTaxCliffData(
  baselineProfitMargin: number, // e.g. 0.15 for 15% pre-tax margin
  policy: TaxPolicyVersion,
  minRatio = 0.6,
  maxRatio = 1.4,
  steps = 50
): Array<{
  revenue: number;
  preTaxProfit: number;
  afterTaxProfit: number;
  isAboveThreshold: boolean;
  taxAmount: number;
  complianceCost: number;
}> {
  const points: ReturnType<typeof generateTaxCliffData> = [];
  const startRev = policy.revenue_threshold * minRatio;
  const endRev = policy.revenue_threshold * maxRatio;
  const stepSize = (endRev - startRev) / steps;

  // Aggregate VAT+PIT rate across policy items
  const totalRate = policy.tax_rates.reduce(
    (sum, r) => sum + (r.vat_rate + r.pit_rate) / Math.max(1, policy.tax_rates.length),
    0
  );

  for (let i = 0; i <= steps; i++) {
    const rev = startRev + i * stepSize;
    const isAbove = isRevenueAboveThreshold(rev, policy.revenue_threshold, policy.boundary_rule);
    const preTax = rev * baselineProfitMargin;
    const tax = isAbove ? rev * totalRate : 0;
    const compliance = isAbove ? policy.compliance_cost_above_threshold : 0;
    const postTax = preTax - tax - compliance;

    points.push({
      revenue: Math.round(rev),
      preTaxProfit: Math.round(preTax),
      afterTaxProfit: Math.round(postTax),
      isAboveThreshold: isAbove,
      taxAmount: Math.round(tax),
      complianceCost: compliance,
    });
  }

  return points;
}

