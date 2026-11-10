import { describe, it, expect } from 'vitest';
import { TaxPolicyVersion, WithholdingRecord } from '../../src/engine/types.ts';
import {
  computeAggregateRevenue,
  isRevenueAboveThreshold,
  calculateTaxObligation,
  generateTaxCliffData,
} from '../../src/engine/tax.ts';

describe('Tax Threshold & Obligation Engine', () => {
  const policy: TaxPolicyVersion = {
    id: 'tax-policy-2024',
    effective_from: '2024-01-01',
    revenue_threshold: 1_000_000_000, // 1 Billion VND
    boundary_rule: '<=', // <= 1B is exempt; > 1B is taxable
    tax_rates: [
      {
        category: 'Phân phối, cung cấp hàng hoá',
        vat_rate: 0.01, // 1% VAT
        pit_rate: 0.005, // 0.5% PIT
      },
    ],
    einvoice_required_above_threshold: true,
    compliance_cost_above_threshold: 12_000_000, // 12M VND / year for accounting & e-invoice software
    source_note: 'Mẫu tham khảo; người dùng cần đối chiếu luật hiện hành',
    origin: 'manual',
    is_active: true,
  };

  it('aggregates multi-channel revenue into seller-level total', () => {
    const channelRevenues = [
      { channel: 'Shopee' as const, grossRevenue: 400_000_000, netRevenue: 380_000_000 },
      { channel: 'TikTok Shop' as const, grossRevenue: 500_000_000, netRevenue: 480_000_000 },
      { channel: 'Lazada' as const, grossRevenue: 200_000_000, netRevenue: 190_000_000 },
    ];

    const agg = computeAggregateRevenue(channelRevenues);
    expect(agg.aggregateGrossRevenue).toBe(1_100_000_000);
    expect(agg.aggregateNetRevenue).toBe(1_050_000_000);
    expect(agg.byChannel.Shopee.grossRevenue).toBe(400_000_000);
  });

  it('tests boundary rule when revenue is exactly at threshold (1,000,000,000 VND)', () => {
    const threshold = 1_000_000_000;

    // Rule '<=': R <= threshold is NOT above threshold (exempt)
    expect(isRevenueAboveThreshold(threshold, threshold, '<=')).toBe(false);
    expect(isRevenueAboveThreshold(threshold + 1, threshold, '<=')).toBe(true);

    // Rule '<': R < threshold is exempt; R >= threshold is ABOVE threshold
    expect(isRevenueAboveThreshold(threshold, threshold, '<')).toBe(true);
    expect(isRevenueAboveThreshold(threshold - 1, threshold, '<')).toBe(false);
  });

  it('calculates zero tax liability and no compliance cost when below threshold', () => {
    const res = calculateTaxObligation(800_000_000, 150_000_000, policy);

    expect(res.isAboveThreshold).toBe(false);
    expect(res.totalTaxLiability).toBe(0);
    expect(res.complianceCost).toBe(0);
    expect(res.afterTaxProfit).toBe(150_000_000);
    expect(res.settlementAmount).toBe(0);
    expect(res.isRefund).toBe(false);
    expect(res.closeToThresholdWarning).toBe(false); // 80% < 90% margin
  });

  it('triggers proximity warning when revenue reaches 90% of threshold', () => {
    const res = calculateTaxObligation(920_000_000, 150_000_000, policy, [], 0.9);

    expect(res.isAboveThreshold).toBe(false);
    expect(res.closeToThresholdWarning).toBe(true);
    expect(res.distanceToThreshold).toBe(80_000_000);
  });

  it('computes tax liability and compliance cost cliff when above threshold', () => {
    const revenue = 1_200_000_000; // 1.2 Billion VND
    const preTaxProfit = 200_000_000;

    // Tax = 1.2B * (1% VAT + 0.5% PIT) = 1.2B * 1.5% = 18,000,000 VND
    // Compliance = 12,000,000 VND
    // Total deductions = 30,000,000 VND
    // After-tax profit = 200M - 30M = 170,000,000 VND
    const res = calculateTaxObligation(revenue, preTaxProfit, policy);

    expect(res.isAboveThreshold).toBe(true);
    expect(res.totalTaxLiability).toBe(18_000_000);
    expect(res.complianceCost).toBe(12_000_000);
    expect(res.afterTaxProfit).toBe(170_000_000);
    expect(res.settlementAmount).toBe(18_000_000);
  });

  it('handles withholding greater than liability (refund / offset)', () => {
    const revenue = 1_200_000_000; // Tax liability = 18,000,000 VND
    const withholdings: WithholdingRecord[] = [
      { channel: 'Shopee', date: '2024-06-01', amount: 12_000_000 },
      { channel: 'TikTok Shop', date: '2024-06-01', amount: 10_000_000 },
    ]; // Total withheld = 22,000,000 VND

    const res = calculateTaxObligation(revenue, 200_000_000, policy, withholdings);

    expect(res.totalTaxLiability).toBe(18_000_000);
    expect(res.totalWithheld).toBe(22_000_000);
    // Settlement = 18M - 22M = -4,000,000 (Refund / offset, never double counted)
    expect(res.settlementAmount).toBe(-4_000_000);
    expect(res.isRefund).toBe(true);
  });

  it('generates tax cliff curve points spanning across the threshold', () => {
    const cliffData = generateTaxCliffData(0.15, policy, 0.8, 1.2, 10);
    expect(cliffData.length).toBe(11);

    const belowPoint = cliffData.find((p) => p.revenue < policy.revenue_threshold);
    const abovePoint = cliffData.find((p) => p.revenue > policy.revenue_threshold);

    expect(belowPoint?.isAboveThreshold).toBe(false);
    expect(belowPoint?.taxAmount).toBe(0);
    expect(belowPoint?.complianceCost).toBe(0);

    expect(abovePoint?.isAboveThreshold).toBe(true);
    expect(abovePoint?.taxAmount).toBeGreaterThan(0);
    expect(abovePoint?.complianceCost).toBe(12_000_000);
  });
});

