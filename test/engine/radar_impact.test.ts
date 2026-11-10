import { describe, it, expect } from 'vitest';
import { Product, OrderLine, FeeSchedule, TaxPolicyVersion } from '../../src/engine/types.ts';
import { evaluateRadarImpact } from '../../src/engine/radar_impact.ts';

describe('Radar Impact Evaluation Engine', () => {
  const product: Product = {
    sku: 'SKU-01',
    name: 'Sản phẩm mẫu',
    category: 'Gia dụng',
    cost_of_goods: 50_000,
    price: 100_000,
  };

  const oldSchedule: FeeSchedule = {
    id: 'fee-v1',
    platform: 'Shopee',
    category: '*',
    effective_from: '2024-01-01',
    commission_rate: 0.03, // 3%
    payment_rate: 0.02, // 2%
    service_rate: 0.03, // 3%
    program_rates: [],
    is_active: true,
    origin: 'manual',
  };

  const newSchedule: FeeSchedule = {
    id: 'fee-v2',
    platform: 'Shopee',
    category: '*',
    effective_from: '2024-01-01',
    commission_rate: 0.06, // Hike from 3% to 6% (+3pp)
    payment_rate: 0.02,
    service_rate: 0.03,
    program_rates: [],
    is_active: true,
    origin: 'radar',
  };

  const oldTaxPolicy: TaxPolicyVersion = {
    id: 'tax-v1',
    effective_from: '2024-01-01',
    revenue_threshold: 1_000_000_000, // 1 Billion VND
    tax_rates: [{ category: 'Gia dụng', vat_rate: 0.01, pit_rate: 0.005 }],
    boundary_rule: '<=',
    einvoice_required_above_threshold: true,
    compliance_cost_above_threshold: 10_000_000,
    source_note: 'Baseline',
    origin: 'manual',
    is_active: true,
  };

  const newTaxPolicyLowerThreshold: TaxPolicyVersion = {
    id: 'tax-v2',
    effective_from: '2024-07-01',
    revenue_threshold: 500_000_000, // Threshold lowered to 500 Million VND
    tax_rates: [{ category: 'Gia dụng', vat_rate: 0.01, pit_rate: 0.005 }],
    boundary_rule: '<=',
    einvoice_required_above_threshold: true,
    compliance_cost_above_threshold: 10_000_000,
    source_note: 'Radar extraction notice',
    origin: 'radar',
    is_active: true,
  };

  const orders: OrderLine[] = [
    {
      id: 'ord-1',
      date: '2024-02-01',
      channel: 'Shopee',
      sku: 'SKU-01',
      quantity: 10_000,
      gross_revenue: 1_000_000_000, // 1 Billion VND
      discount: 200_000_000, // Net revenue = 800M
      returned: false,
      shipping_cost_seller: 20_000_000,
      ads_cost_allocated: 50_000_000,
      other_cost: 10_000_000,
    },
  ];

  it('evaluates monetary drop and fee tolerance reduction from fee hike', () => {
    const impact = evaluateRadarImpact(
      orders,
      [product],
      [oldSchedule],
      [newSchedule],
      oldTaxPolicy,
      oldTaxPolicy
    );

    // Old platform fees: 3% + 2% + 3% = 8% of 1B = 80M
    // New platform fees: 6% + 2% + 3% = 11% of 1B = 110M
    // Fee difference = 30M VND increase -> profit decreases by 30M VND
    expect(impact.deltaProfitVnd).toBe(-30_000_000);
    expect(impact.deltaProfitPercent).toBeLessThan(0);
    expect(impact.newFeeTolerance.toleranceDecimal).toBeLessThan(
      impact.oldFeeTolerance.toleranceDecimal
    );
  });

  it('detects when lower threshold policy pushes seller into tax obligation', () => {
    // Under old tax policy (1B threshold): 800M revenue is below threshold
    // Under new tax policy (500M threshold): 800M revenue crosses threshold!
    const impact = evaluateRadarImpact(
      orders,
      [product],
      [oldSchedule],
      [oldSchedule],
      oldTaxPolicy,
      newTaxPolicyLowerThreshold
    );

    expect(impact.taxImpact.crossedThreshold).toBe(true);
    expect(impact.taxImpact.deltaTaxLiability).toBeGreaterThan(0);
    expect(impact.taxImpact.warningMessage).toBeDefined();
    expect(impact.taxImpact.deltaAfterTaxProfit).toBeLessThan(0);
  });
});
