import { OrderLine, Product, FeeSchedule, Channel } from './types.ts';
import { resolveFeeSchedule, calculatePlatformFees } from './fee_resolver.ts';

export interface OrderProfitBreakdown {
  orderId?: string;
  date: string;
  channel: Channel;
  sku: string;
  quantity: number;
  grossRevenue: number;
  discount: number;
  netRevenue: number;
  cogs: number;
  commissionFee: number;
  paymentFee: number;
  serviceFee: number;
  programFees: number;
  fixedFee: number;
  totalPlatformFees: number;
  shippingCostSeller: number;
  adsCostAllocated: number;
  otherCost: number;
  returned: boolean;
  netProfitBeforeTax: number;
  profitMargin: number; // netProfitBeforeTax / netRevenue (0 if netRevenue is 0)
  appliedScheduleId?: string;
}

export interface ChannelProfitSummary {
  channel: Channel;
  orderCount: number;
  returnedCount: number;
  grossRevenue: number;
  discount: number;
  netRevenue: number;
  cogs: number;
  totalPlatformFees: number;
  commissionFee: number;
  paymentFee: number;
  serviceFee: number;
  programFees: number;
  fixedFee: number;
  shippingCostSeller: number;
  adsCostAllocated: number;
  otherCost: number;
  netProfitBeforeTax: number;
  profitMargin: number;
}

export interface ShopProfitSummary {
  totalOrders: number;
  totalReturned: number;
  grossRevenue: number;
  discount: number;
  netRevenue: number;
  cogs: number;
  totalPlatformFees: number;
  commissionFee: number;
  paymentFee: number;
  serviceFee: number;
  programFees: number;
  fixedFee: number;
  shippingCostSeller: number;
  adsCostAllocated: number;
  otherCost: number;
  netProfitBeforeTax: number;
  overallMargin: number;
  byChannel: Record<Channel, ChannelProfitSummary>;
}

/**
 * Calculates profit breakdown for an individual OrderLine.
 */
export function calculateOrderProfit(
  order: OrderLine,
  product: Product | undefined,
  feeSchedules: FeeSchedule[]
): OrderProfitBreakdown {
  const category = product?.category ?? '*';
  const unitCost = product?.cost_of_goods ?? 0;
  const cogs = order.returned ? 0 : unitCost * order.quantity;

  const schedule = resolveFeeSchedule(feeSchedules, order.channel, category, order.date);

  let netRevenue = 0;
  let commissionFee = 0;
  let paymentFee = 0;
  let serviceFee = 0;
  let programFees = 0;
  let fixedFee = 0;
  let totalPlatformFees = 0;

  if (!order.returned) {
    netRevenue = Math.max(0, order.gross_revenue - order.discount);
    const fees = calculatePlatformFees(order.gross_revenue, order.quantity, schedule);
    commissionFee = fees.commissionFee;
    paymentFee = fees.paymentFee;
    serviceFee = fees.serviceFee;
    programFees = fees.programFees;
    fixedFee = fees.fixedFee;
    totalPlatformFees = fees.totalPlatformFees;
  }

  // Formula: net_profit_before_tax = net_revenue - COGS - platform_fees - ads - shipping - return_costs - other_costs
  const netProfitBeforeTax =
    netRevenue -
    cogs -
    totalPlatformFees -
    order.ads_cost_allocated -
    order.shipping_cost_seller -
    order.other_cost;

  const profitMargin = netRevenue > 0 ? netProfitBeforeTax / netRevenue : 0;

  return {
    orderId: order.id,
    date: order.date,
    channel: order.channel,
    sku: order.sku,
    quantity: order.quantity,
    grossRevenue: order.gross_revenue,
    discount: order.discount,
    netRevenue,
    cogs,
    commissionFee,
    paymentFee,
    serviceFee,
    programFees,
    fixedFee,
    totalPlatformFees,
    shippingCostSeller: order.shipping_cost_seller,
    adsCostAllocated: order.ads_cost_allocated,
    otherCost: order.other_cost,
    returned: order.returned,
    netProfitBeforeTax,
    profitMargin,
    appliedScheduleId: schedule?.id,
  };
}

/**
 * Aggregates all orders into channel-level and shop-level profit summaries.
 */
export function aggregateShopProfit(
  orders: OrderLine[],
  products: Map<string, Product> | Product[],
  feeSchedules: FeeSchedule[]
): ShopProfitSummary {
  const productMap: Map<string, Product> =
    products instanceof Map
      ? products
      : new Map(products.map((p) => [p.sku, p]));

  const channels: Channel[] = ['Shopee', 'TikTok Shop', 'Lazada', 'Other'];
  const initChannelSummary = (ch: Channel): ChannelProfitSummary => ({
    channel: ch,
    orderCount: 0,
    returnedCount: 0,
    grossRevenue: 0,
    discount: 0,
    netRevenue: 0,
    cogs: 0,
    totalPlatformFees: 0,
    commissionFee: 0,
    paymentFee: 0,
    serviceFee: 0,
    programFees: 0,
    fixedFee: 0,
    shippingCostSeller: 0,
    adsCostAllocated: 0,
    otherCost: 0,
    netProfitBeforeTax: 0,
    profitMargin: 0,
  });

  const byChannel: Record<Channel, ChannelProfitSummary> = {
    Shopee: initChannelSummary('Shopee'),
    'TikTok Shop': initChannelSummary('TikTok Shop'),
    Lazada: initChannelSummary('Lazada'),
    Other: initChannelSummary('Other'),
  };

  let totalOrders = 0;
  let totalReturned = 0;
  let grossRevenue = 0;
  let discount = 0;
  let netRevenue = 0;
  let cogs = 0;
  let totalPlatformFees = 0;
  let commissionFee = 0;
  let paymentFee = 0;
  let serviceFee = 0;
  let programFees = 0;
  let fixedFee = 0;
  let shippingCostSeller = 0;
  let adsCostAllocated = 0;
  let otherCost = 0;
  let netProfitBeforeTax = 0;

  for (const order of orders) {
    const prod = productMap.get(order.sku);
    const item = calculateOrderProfit(order, prod, feeSchedules);
    const chSum = byChannel[order.channel];

    totalOrders++;
    chSum.orderCount++;
    if (order.returned) {
      totalReturned++;
      chSum.returnedCount++;
    }

    grossRevenue += item.grossRevenue;
    discount += item.discount;
    netRevenue += item.netRevenue;
    cogs += item.cogs;
    totalPlatformFees += item.totalPlatformFees;
    commissionFee += item.commissionFee;
    paymentFee += item.paymentFee;
    serviceFee += item.serviceFee;
    programFees += item.programFees;
    fixedFee += item.fixedFee;
    shippingCostSeller += item.shippingCostSeller;
    adsCostAllocated += item.adsCostAllocated;
    otherCost += item.otherCost;
    netProfitBeforeTax += item.netProfitBeforeTax;

    chSum.grossRevenue += item.grossRevenue;
    chSum.discount += item.discount;
    chSum.netRevenue += item.netRevenue;
    chSum.cogs += item.cogs;
    chSum.totalPlatformFees += item.totalPlatformFees;
    chSum.commissionFee += item.commissionFee;
    chSum.paymentFee += item.paymentFee;
    chSum.serviceFee += item.serviceFee;
    chSum.programFees += item.programFees;
    chSum.fixedFee += item.fixedFee;
    chSum.shippingCostSeller += item.shippingCostSeller;
    chSum.adsCostAllocated += item.adsCostAllocated;
    chSum.otherCost += item.otherCost;
    chSum.netProfitBeforeTax += item.netProfitBeforeTax;
  }

  // Calculate margins
  for (const ch of channels) {
    const chSum = byChannel[ch];
    chSum.profitMargin = chSum.netRevenue > 0 ? chSum.netProfitBeforeTax / chSum.netRevenue : 0;
  }

  const overallMargin = netRevenue > 0 ? netProfitBeforeTax / netRevenue : 0;

  return {
    totalOrders,
    totalReturned,
    grossRevenue,
    discount,
    netRevenue,
    cogs,
    totalPlatformFees,
    commissionFee,
    paymentFee,
    serviceFee,
    programFees,
    fixedFee,
    shippingCostSeller,
    adsCostAllocated,
    otherCost,
    netProfitBeforeTax,
    overallMargin,
    byChannel,
  };
}

