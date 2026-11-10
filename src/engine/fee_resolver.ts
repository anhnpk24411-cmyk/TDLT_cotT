import { Channel, FeeSchedule } from './types.ts';

/**
 * Resolves the active FeeSchedule applicable for a given channel, category, and date.
 * Rule:
 * 1. Must match channel.
 * 2. Matches product category or wildcard '*'. Specific category takes priority over wildcard.
 * 3. Schedule must be active.
 * 4. effective_from must be <= orderDate (YYYY-MM-DD string comparison).
 * 5. Pick the latest effective_from.
 */
export function resolveFeeSchedule(
  schedules: FeeSchedule[],
  channel: Channel,
  category: string,
  orderDate: string
): FeeSchedule | null {
  const eligible = schedules.filter((s) => {
    if (!s.is_active) return false;
    if (s.platform !== channel) return false;
    if (s.category !== '*' && s.category.toLowerCase() !== category.toLowerCase()) return false;
    if (s.effective_from > orderDate) return false;
    return true;
  });

  if (eligible.length === 0) {
    return null;
  }

  // Sort descending by effective_from, then by specificity (specific category > '*')
  eligible.sort((a, b) => {
    if (a.effective_from !== b.effective_from) {
      return b.effective_from.localeCompare(a.effective_from);
    }
    const aIsSpecific = a.category !== '*' ? 1 : 0;
    const bIsSpecific = b.category !== '*' ? 1 : 0;
    return bIsSpecific - aIsSpecific;
  });

  return eligible[0];
}

/**
 * Calculates total platform fee amount for an order line given a fee schedule.
 * Platform fees = commission + payment + service + program fees.
 */
export function calculatePlatformFees(
  grossRevenue: number,
  quantity: number,
  schedule: FeeSchedule | null
): {
  commissionFee: number;
  paymentFee: number;
  serviceFee: number;
  programFees: number;
  fixedFee: number;
  totalPlatformFees: number;
} {
  if (!schedule) {
    return {
      commissionFee: 0,
      paymentFee: 0,
      serviceFee: 0,
      programFees: 0,
      fixedFee: 0,
      totalPlatformFees: 0,
    };
  }

  const commissionFee = grossRevenue * schedule.commission_rate;
  const paymentFee = grossRevenue * schedule.payment_rate;
  const serviceFee = grossRevenue * schedule.service_rate;

  let programFees = 0;
  if (schedule.program_rates && schedule.program_rates.length > 0) {
    for (const prog of schedule.program_rates) {
      const rawProgFee = grossRevenue * prog.rate;
      if (prog.cap !== undefined && prog.cap > 0) {
        // Cap is per item
        const maxCap = prog.cap * quantity;
        programFees += Math.min(rawProgFee, maxCap);
      } else {
        programFees += rawProgFee;
      }
    }
  }

  // Phí cố định theo đơn hàng (ví dụ: TikTok Shop, Lazada 3.000đ/đơn)
  const fixedFee = schedule.fixed_fee_per_order ?? 0;

  const totalPlatformFees = commissionFee + paymentFee + serviceFee + programFees + fixedFee;

  return {
    commissionFee,
    paymentFee,
    serviceFee,
    programFees,
    fixedFee,
    totalPlatformFees,
  };
}

