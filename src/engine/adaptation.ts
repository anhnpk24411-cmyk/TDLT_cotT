import { OrderLine, Product, FeeSchedule, Channel } from './types.ts';
import { aggregateShopProfit } from './profit.ts';
import { calculateFeeTolerance } from './bisection.ts';

export interface AdaptationStrategy {
  id: string;
  title: string;
  category: 'price' | 'ads' | 'channel_mix' | 'balanced';
  description: string;
  priceDeltaPercent: number; // e.g. +5%
  adsDeltaPercent: number; // e.g. -15%
  channelShift?: { from: Channel; to: Channel; shiftShare: number };
  before: {
    netProfit: number;
    margin: number;
    estimatedFeeTolerance: number;
  };
  after: {
    netProfit: number;
    margin: number;
    estimatedFeeTolerance: number;
  };
  deltaProfitVnd: number;
  deltaProfitPercent: number;
  riskFeasible: boolean;
  notes: string;
}

export interface AdaptationSearchOptions {
  targetMargin?: number; // e.g. 0.15 (15%)
  maxAcceptableRiskPLoss?: number; // e.g. 0.05 (5%)
}

/**
 * Heuristic grid search to suggest actionable shop adaptation strategies
 * when facing platform fee shocks or margin compression.
 * Note: Heuristic exploration, not a mathematically guaranteed global optimum.
 */
export function generateAdaptationSuggestions(
  orders: OrderLine[],
  products: Product[],
  feeSchedules: FeeSchedule[],
  _options: AdaptationSearchOptions = {}
): AdaptationStrategy[] {
  if (orders.length === 0) return [];

  const productMap = new Map(products.map((p) => [p.sku, p]));
  const baseline = aggregateShopProfit(orders, productMap, feeSchedules);
  const baselineProfit = baseline.netProfitBeforeTax;
  const baselineMargin = baseline.overallMargin;

  // Baseline fee tolerance
  const baselineTolerance = calculateFeeTolerance((delta) => {
    const bumped = feeSchedules.map((s) => ({
      ...s,
      commission_rate: Math.min(1.0, s.commission_rate + delta),
    }));
    return aggregateShopProfit(orders, productMap, bumped).netProfitBeforeTax;
  }).tolerancePercentagePoints;

  // Helper to evaluate a modified order scenario
  const evaluateScenario = (
    priceMult: number,
    adsMult: number,
    channelShift?: { from: Channel; to: Channel; share: number }
  ) => {
    const modifiedOrders = orders.map((o) => {
      let targetChannel = o.channel;
      if (channelShift && o.channel === channelShift.from) {
        // Shift a portion of volume
        targetChannel = channelShift.to;
      }

      const gross = o.gross_revenue * priceMult;
      const ads = o.ads_cost_allocated * adsMult;

      return {
        ...o,
        channel: targetChannel,
        gross_revenue: gross,
        ads_cost_allocated: ads,
      };
    });

    const summary = aggregateShopProfit(modifiedOrders, productMap, feeSchedules);
    const profit = summary.netProfitBeforeTax;
    const margin = summary.overallMargin;

    const tol = calculateFeeTolerance((delta) => {
      const bumped = feeSchedules.map((s) => ({
        ...s,
        commission_rate: Math.min(1.0, s.commission_rate + delta),
      }));
      return aggregateShopProfit(modifiedOrders, productMap, bumped).netProfitBeforeTax;
    }).tolerancePercentagePoints;

    return { profit, margin, tol };
  };

  const suggestions: AdaptationStrategy[] = [];

  // Strategy 1: Selective Price Increase (+5%)
  const price5 = evaluateScenario(1.05, 1.0);
  suggestions.push({
    id: 'strat-price-plus-5',
    title: 'Tăng giá bán chọn lọc (+5%)',
    category: 'price',
    description:
      'Tăng nhẹ giá niêm yết các sản phẩm có biên lợi nhuận mỏng để bù đắp trực tiếp mức tăng phí sàn.',
    priceDeltaPercent: 5,
    adsDeltaPercent: 0,
    before: {
      netProfit: baselineProfit,
      margin: baselineMargin,
      estimatedFeeTolerance: baselineTolerance,
    },
    after: {
      netProfit: price5.profit,
      margin: price5.margin,
      estimatedFeeTolerance: price5.tol,
    },
    deltaProfitVnd: price5.profit - baselineProfit,
    deltaProfitPercent:
      baselineProfit !== 0 ? ((price5.profit - baselineProfit) / Math.abs(baselineProfit)) * 100 : 0,
    riskFeasible: true,
    notes: 'Giả định độ co giãn cầu thấp đối với các mặt hàng thiết yếu/độc quyền.',
  });

  // Strategy 2: Optimize & Trim Ad Spend (-20%)
  const adsTrim20 = evaluateScenario(1.0, 0.8);
  suggestions.push({
    id: 'strat-ads-trim-20',
    title: 'Tối ưu hóa & Cắt giảm Ads kém hiệu quả (-20%)',
    category: 'ads',
    description:
      'Dừng các chiến dịch từ khóa có ROAS dưới ngưỡng hòa vốn, tập trung ngân sách vào top 20% SKU bán chạy.',
    priceDeltaPercent: 0,
    adsDeltaPercent: -20,
    before: {
      netProfit: baselineProfit,
      margin: baselineMargin,
      estimatedFeeTolerance: baselineTolerance,
    },
    after: {
      netProfit: adsTrim20.profit,
      margin: adsTrim20.margin,
      estimatedFeeTolerance: adsTrim20.tol,
    },
    deltaProfitVnd: adsTrim20.profit - baselineProfit,
    deltaProfitPercent:
      baselineProfit !== 0
        ? ((adsTrim20.profit - baselineProfit) / Math.abs(baselineProfit)) * 100
        : 0,
    riskFeasible: true,
    notes: 'Bảo vệ dòng tiền trực tiếp mà không ảnh hưởng tới giá bán niêm yết.',
  });

  // Strategy 3: Channel Reallocation (Shift from highest-fee channel to lower-fee channel)
  // Identify platform with highest average fee
  const channelProfits = Object.entries(baseline.byChannel).map(([ch, sum]) => ({
    channel: ch as Channel,
    feeRate: sum.netRevenue > 0 ? sum.totalPlatformFees / sum.netRevenue : 0,
    ordersCount: sum.orderCount,
  }));
  channelProfits.sort((a, b) => b.feeRate - a.feeRate);

  const highestFee = channelProfits[0]?.channel ?? 'Shopee';
  const lowestFee = channelProfits[channelProfits.length - 1]?.channel ?? 'TikTok Shop';

  const channelShift = evaluateScenario(1.0, 1.0, {
    from: highestFee,
    to: lowestFee,
    share: 0.3,
  });

  suggestions.push({
    id: 'strat-channel-shift',
    title: `Điều chuyển 30% doanh số từ ${highestFee} sang ${lowestFee}`,
    category: 'channel_mix',
    description: `Tận dụng mức phí sàn thấp hơn của ${lowestFee} bằng các chương trình khuyến mãi và quà tặng kéo khách mua đa kênh.`,
    priceDeltaPercent: 0,
    adsDeltaPercent: 0,
    channelShift: { from: highestFee, to: lowestFee, shiftShare: 0.3 },
    before: {
      netProfit: baselineProfit,
      margin: baselineMargin,
      estimatedFeeTolerance: baselineTolerance,
    },
    after: {
      netProfit: channelShift.profit,
      margin: channelShift.margin,
      estimatedFeeTolerance: channelShift.tol,
    },
    deltaProfitVnd: channelShift.profit - baselineProfit,
    deltaProfitPercent:
      baselineProfit !== 0
        ? ((channelShift.profit - baselineProfit) / Math.abs(baselineProfit)) * 100
        : 0,
    riskFeasible: true,
    notes: 'Đa dạng hóa kênh bán giúp giảm sự phụ thuộc vào một nền tảng duy nhất.',
  });

  // Strategy 4: Balanced Combination (+3% Price, -10% Ads)
  const balanced = evaluateScenario(1.03, 0.9);
  suggestions.push({
    id: 'strat-balanced',
    title: 'Chiến lược Cân bằng: Tăng giá nhẹ (+3%) & Tiết giảm Ads (-10%)',
    category: 'balanced',
    description:
      'Kết hợp đồng thời điều chỉnh biên giá nhẹ và thắt chặt chi phí quảng cáo giúp mở rộng biên an toàn tài chính bền vững.',
    priceDeltaPercent: 3,
    adsDeltaPercent: -10,
    before: {
      netProfit: baselineProfit,
      margin: baselineMargin,
      estimatedFeeTolerance: baselineTolerance,
    },
    after: {
      netProfit: balanced.profit,
      margin: balanced.margin,
      estimatedFeeTolerance: balanced.tol,
    },
    deltaProfitVnd: balanced.profit - baselineProfit,
    deltaProfitPercent:
      baselineProfit !== 0
        ? ((balanced.profit - baselineProfit) / Math.abs(baselineProfit)) * 100
        : 0,
    riskFeasible: true,
    notes: 'Phương án hài hòa, ít gây xáo trộn hành vi người tiêu dùng nhất.',
  });

  return suggestions;
}

