import { describe, it, expect } from 'vitest';
import { Product, OrderLine, FeeSchedule } from '../../src/engine/types.ts';
import { calculateOrderProfit, aggregateShopProfit } from '../../src/engine/profit.ts';

describe('Profit Calculation Engine', () => {
  const product: Product = {
    sku: 'A01',
    name: 'Áo Thun Basic',
    category: 'Thời trang',
    cost_of_goods: 80_000,
    price: 200_000,
  };

  const schedule: FeeSchedule = {
    id: 'fee-tiktok-v1',
    platform: 'TikTok Shop',
    category: '*',
    effective_from: '2024-01-01',
    commission_rate: 0.04, // 4% = 8,000 VND
    payment_rate: 0.03, // 3% = 6,000 VND
    service_rate: 0.02, // 2% = 4,000 VND
    program_rates: [],
    is_active: true,
    origin: 'manual',
  };

  it('calculates net profit correctly for normal order', () => {
    const order: OrderLine = {
      id: 'ord-1',
      date: '2024-03-10',
      channel: 'TikTok Shop',
      sku: 'A01',
      quantity: 1,
      gross_revenue: 200_000,
      discount: 20_000, // net_revenue = 180,000
      returned: false,
      shipping_cost_seller: 15_000,
      ads_cost_allocated: 25_000,
      other_cost: 5_000,
    };

    // Platform fees on gross_revenue (200,000):
    // comm (4%): 8,000, pay (3%): 6,000, serv (2%): 4,000 = 18,000
    // COGS: 80,000
    // Net profit = 180,000 - 80,000 - 18,000 - 25,000 - 15,000 - 5,000 = 37,000
    const res = calculateOrderProfit(order, product, [schedule]);

    expect(res.netRevenue).toBe(180_000);
    expect(res.cogs).toBe(80_000);
    expect(res.totalPlatformFees).toBe(18_000);
    expect(res.netProfitBeforeTax).toBe(37_000);
    expect(res.profitMargin).toBeCloseTo(37_000 / 180_000, 4);
    expect(res.returned).toBe(false);
  });

  it('handles returned order: revenue & COGS are 0, platform fees waived, sunk shipping & ads lost', () => {
    const returnOrder: OrderLine = {
      id: 'ord-ret',
      date: '2024-03-11',
      channel: 'TikTok Shop',
      sku: 'A01',
      quantity: 1,
      gross_revenue: 200_000,
      discount: 0,
      returned: true, // RETURNED
      shipping_cost_seller: 20_000, // Return shipping loss
      ads_cost_allocated: 25_000, // Sunk ad cost
      other_cost: 5_000, // Packaging loss
    };

    const res = calculateOrderProfit(returnOrder, product, [schedule]);

    expect(res.netRevenue).toBe(0);
    expect(res.cogs).toBe(0);
    expect(res.totalPlatformFees).toBe(0);
    expect(res.netProfitBeforeTax).toBe(-50_000); // 0 - 20k - 25k - 5k = -50k
    expect(res.profitMargin).toBe(0);
  });

  it('aggregates profit correctly across multi-channels and handles empty list / zero revenue', () => {
    const emptySummary = aggregateShopProfit([], [product], [schedule]);
    expect(emptySummary.totalOrders).toBe(0);
    expect(emptySummary.netRevenue).toBe(0);
    expect(emptySummary.netProfitBeforeTax).toBe(0);
    expect(emptySummary.overallMargin).toBe(0);

    const multiOrders: OrderLine[] = [
      {
        id: 'ord-tt',
        date: '2024-02-01',
        channel: 'TikTok Shop',
        sku: 'A01',
        quantity: 2,
        gross_revenue: 400_000,
        discount: 0,
        returned: false,
        shipping_cost_seller: 0,
        ads_cost_allocated: 0,
        other_cost: 0,
      },
      {
        id: 'ord-other',
        date: '2024-02-02',
        channel: 'Other',
        sku: 'A01',
        quantity: 1,
        gross_revenue: 200_000,
        discount: 0,
        returned: false,
        shipping_cost_seller: 0,
        ads_cost_allocated: 0,
        other_cost: 0,
      },
    ];

    const summary = aggregateShopProfit(multiOrders, [product], [schedule]);
    expect(summary.totalOrders).toBe(2);
    expect(summary.grossRevenue).toBe(600_000);
    expect(summary.byChannel['TikTok Shop'].orderCount).toBe(1);
    expect(summary.byChannel.Other.orderCount).toBe(1);
    expect(summary.byChannel.Shopee.orderCount).toBe(0);
  });
});

