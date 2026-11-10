import { describe, it, expect } from 'vitest';
import { FeeSchedule } from '../../src/engine/types.ts';
import { resolveFeeSchedule, calculatePlatformFees } from '../../src/engine/fee_resolver.ts';

describe('Fee Resolver & Platform Fees', () => {
  const baseSchedules: FeeSchedule[] = [
    {
      id: 'sch-shopee-v1',
      platform: 'Shopee',
      category: '*',
      effective_from: '2024-01-01',
      commission_rate: 0.04, // 4%
      payment_rate: 0.03, // 3%
      service_rate: 0.05, // 5%
      program_rates: [
        { name: 'Freeship Xtra', rate: 0.06, cap: 20000 }, // 6% max 20k per item
      ],
      is_active: true,
      origin: 'manual',
    },
    {
      id: 'sch-shopee-v2',
      platform: 'Shopee',
      category: '*',
      effective_from: '2024-07-01', // Mid-year fee hike
      commission_rate: 0.05, // Raised from 4% to 5%
      payment_rate: 0.04, // Raised from 3% to 4%
      service_rate: 0.05,
      program_rates: [
        { name: 'Freeship Xtra', rate: 0.06, cap: 25000 },
      ],
      is_active: true,
      origin: 'radar',
    },
    {
      id: 'sch-shopee-fashion',
      platform: 'Shopee',
      category: 'Thời trang',
      effective_from: '2024-01-01',
      commission_rate: 0.06, // Special 6% commission for fashion
      payment_rate: 0.03,
      service_rate: 0.05,
      program_rates: [],
      is_active: true,
      origin: 'manual',
    },
  ];

  it('resolves correct version when fee versions change mid-year', () => {
    // Order before 2024-07-01 gets v1
    const orderBefore = resolveFeeSchedule(baseSchedules, 'Shopee', 'Điện tử', '2024-05-15');
    expect(orderBefore?.id).toBe('sch-shopee-v1');
    expect(orderBefore?.commission_rate).toBe(0.04);
    expect(orderBefore?.payment_rate).toBe(0.03);

    // Order on or after 2024-07-01 gets v2
    const orderAfter = resolveFeeSchedule(baseSchedules, 'Shopee', 'Điện tử', '2024-07-01');
    expect(orderAfter?.id).toBe('sch-shopee-v2');
    expect(orderAfter?.commission_rate).toBe(0.05);
    expect(orderAfter?.payment_rate).toBe(0.04);
  });

  it('prefers specific category over wildcard category when dates match', () => {
    const fashionOrder = resolveFeeSchedule(baseSchedules, 'Shopee', 'Thời trang', '2024-03-01');
    expect(fashionOrder?.id).toBe('sch-shopee-fashion');
    expect(fashionOrder?.commission_rate).toBe(0.06);
  });

  it('returns null if no active schedule exists for platform or date', () => {
    const noPlatform = resolveFeeSchedule(baseSchedules, 'Lazada', '*', '2024-05-01');
    expect(noPlatform).toBeNull();

    const tooEarly = resolveFeeSchedule(baseSchedules, 'Shopee', '*', '2023-12-31');
    expect(tooEarly).toBeNull();
  });

  it('calculates platform fees and respects program fee cap per item', () => {
    const schedule = baseSchedules[0]; // 4% comm, 3% pay, 5% serv, 6% Freeship (cap 20,000/item)
    const grossRevenue = 1_000_000; // 1,000,000 VND for 1 item
    const quantity = 1;

    // 6% of 1,000,000 = 60,000 -> capped at 20,000
    const fees = calculatePlatformFees(grossRevenue, quantity, schedule);

    expect(fees.commissionFee).toBe(40_000); // 4%
    expect(fees.paymentFee).toBe(30_000); // 3%
    expect(fees.serviceFee).toBe(50_000); // 5%
    expect(fees.programFees).toBe(20_000); // capped at 20,000
    expect(fees.totalPlatformFees).toBe(140_000);
  });

  it('scales program fee cap by quantity', () => {
    const schedule = baseSchedules[0];
    const grossRevenue = 1_000_000;
    const quantity = 3; // 3 items -> cap = 3 * 20,000 = 60,000
    // 6% of 1,000,000 = 60,000 -> <= 60,000 cap

    const fees = calculatePlatformFees(grossRevenue, quantity, schedule);
    expect(fees.programFees).toBe(60_000);
  });
});

