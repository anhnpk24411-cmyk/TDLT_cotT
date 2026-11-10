import { describe, it, expect } from 'vitest';
import { calculateOrderProfit } from '../../src/engine/profit.ts';
import { calculateTaxObligation } from '../../src/engine/tax.ts';
import { calculateFeeTolerance } from '../../src/engine/bisection.ts';
import type { OrderLine, Product, FeeSchedule, TaxPolicyVersion } from '../../src/engine/types.ts';

describe('Cross-Validation: TypeScript Engine ↔ Python Reference Engine Golden Cases', () => {

  it('CASE 1: Đơn hàng thời trang TikTok Shop (giao thành công, khớp golden 41.500 VND)', () => {
    const order: OrderLine = {
      id: 'ord-cv-1',
      date: '2026-05-15',
      channel: 'TikTok Shop',
      sku: 'SKU-FASHION-01',
      quantity: 1,
      gross_revenue: 250_000,
      discount: 0,
      returned: false,
      shipping_cost_seller: 0,
      ads_cost_allocated: 22_500,
      other_cost: 3_000,
    };

    const product: Product = {
      sku: 'SKU-FASHION-01',
      name: 'Váy thời trang',
      category: 'Thời trang',
      cost_of_goods: 130_000,
      price: 250_000,
    };

    const schedule: FeeSchedule = {
      id: 'sched-cv-1',
      platform: 'TikTok Shop',
      category: '*',
      effective_from: '2026-05-01',
      commission_rate: 0.14,
      payment_rate: 0.06,
      service_rate: 0.0,
      program_rates: [],
      fixed_fee_per_order: 3_000,
      origin: 'manual',
      is_active: true,
    };

    const result = calculateOrderProfit(order, product, [schedule]);

    expect(result.netRevenue).toBe(250_000);
    expect(result.cogs).toBe(130_000);
    expect(result.commissionFee).toBe(35_000); // 14%
    expect(result.paymentFee).toBe(15_000);    // 6%
    expect(result.fixedFee).toBe(3_000);       // 3.000đ
    expect(result.totalPlatformFees).toBe(53_000);
    // 250k - 130k - 53k - 22.5k - 0 - 3k = 41.500 VND
    expect(result.netProfitBeforeTax).toBe(41_500);
    expect(result.profitMargin).toBeCloseTo(41_500 / 250_000, 5);
  });

  it('CASE 2: Đơn hàng hoàn trả (Returned = true, net_revenue=0, cogs=0, fee=0)', () => {
    const order: OrderLine = {
      id: 'ord-cv-2',
      date: '2026-05-15',
      channel: 'Shopee',
      sku: 'SKU-RET-01',
      quantity: 1,
      gross_revenue: 180_000,
      discount: 0,
      returned: true,
      shipping_cost_seller: 20_000,
      ads_cost_allocated: 0,
      other_cost: 3_000,
    };

    const product: Product = {
      sku: 'SKU-RET-01',
      name: 'Sản phẩm hoàn',
      category: 'Gia dụng',
      cost_of_goods: 80_000,
      price: 180_000,
    };

    const result = calculateOrderProfit(order, product, []);

    expect(result.netRevenue).toBe(0);
    expect(result.cogs).toBe(0);
    expect(result.totalPlatformFees).toBe(0);
    // 0 - 0 - 0 - 0 - 20k - 3k = -23.000 VND
    expect(result.netProfitBeforeTax).toBe(-23_000);
  });

  it('CASE 3: Thuế trên ngưỡng 1 tỷ (1,2 tỷ, VAT 1% + TNCN 0,5%, khấu trừ tạm sàn 1,5%)', () => {
    const policy: TaxPolicyVersion = {
      id: 'tax-policy-cv-2026',
      effective_from: '2026-01-01',
      revenue_threshold: 1_000_000_000,
      boundary_rule: '<=',
      tax_rates: [{ category: 'Hàng hoá', vat_rate: 0.01, pit_rate: 0.005 }],
      einvoice_required_above_threshold: true,
      compliance_cost_above_threshold: 12_000_000,
      source_note: 'Golden test case',
      origin: 'manual',
      is_active: true,
    };

    const withheldRecords = [
      { channel: 'Shopee' as const, date: '2026-12-31', amount: 18_000_000 }
    ];

    const result = calculateTaxObligation(
      1_200_000_000,
      180_000_000,
      policy,
      withheldRecords,
      0.9
    );

    expect(result.isAboveThreshold).toBe(true);
    expect(result.totalTaxLiability).toBe(18_000_000); // 1,2 tỷ * 1,5%
    expect(result.settlementAmount).toBe(0); // 18 triệu - 18 triệu đã khấu trừ
    expect(result.complianceCost).toBe(12_000_000);
    // 180 triệu - 18 triệu - 12 triệu = 150 triệu VND
    expect(result.afterTaxProfit).toBe(150_000_000);
  });

  it('CASE 4: Thuế dưới ngưỡng (920 triệu, tỷ lệ 92% >= 90%, miễn thuế và kích hoạt cảnh báo)', () => {
    const policy: TaxPolicyVersion = {
      id: 'tax-policy-cv-2026',
      effective_from: '2026-01-01',
      revenue_threshold: 1_000_000_000,
      boundary_rule: '<=',
      tax_rates: [{ category: 'Hàng hoá', vat_rate: 0.01, pit_rate: 0.005 }],
      einvoice_required_above_threshold: true,
      compliance_cost_above_threshold: 12_000_000,
      source_note: 'Golden test case',
      origin: 'manual',
      is_active: true,
    };

    const result = calculateTaxObligation(
      920_000_000,
      110_000_000,
      policy,
      [],
      0.9
    );

    expect(result.isAboveThreshold).toBe(false);
    expect(result.totalTaxLiability).toBe(0);
    expect(result.ratioToThreshold).toBeCloseTo(0.92, 2);
    expect(result.closeToThresholdWarning).toBe(true);
    expect(result.afterTaxProfit).toBe(110_000_000);
  });

  it('CASE 5: Bisection tìm ngưỡng chịu đựng phí (tolerance ~ 15pp cho shop biên 15%)', () => {
    const grossRevenue = 1_000_000;
    const baseCommission = 0.10;
    const nonFeeCosts = 750_000; // LN cơ sở = 1.000.000 - 100.000 - 750.000 = 150.000

    const result = calculateFeeTolerance((delta) => {
      const fee = (baseCommission + delta) * grossRevenue;
      return grossRevenue - fee - nonFeeCosts;
    });

    expect(result.state).toBe('SOLVED');
    expect(result.tolerancePercentagePoints).toBeCloseTo(15.0, 1);
  });
});

