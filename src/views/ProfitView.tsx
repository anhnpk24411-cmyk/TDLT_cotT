import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database.ts';
import { aggregateShopProfit, calculateOrderProfit } from '../engine/profit.ts';
import { Channel } from '../engine/types.ts';
import { formatVND, formatPercent, formatDateVN } from '../utils/formatters.ts';
import { KpiCard } from '../components/common/KpiCard.tsx';
import { AssumptionsPanel } from '../components/common/AssumptionsPanel.tsx';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
} from 'recharts';
import {
  TrendingUp,
  AlertTriangle,
  Receipt,
  DollarSign,
  Filter,
} from 'lucide-react';

export const ProfitView: React.FC = () => {
  const orders = useLiveQuery(() => db.orders.toArray()) ?? [];
  const products = useLiveQuery(() => db.products.toArray()) ?? [];
  const feeSchedules = useLiveQuery(() => db.fee_schedules.toArray()) ?? [];
  const taxPolicy = useLiveQuery(() => db.tax_policies.filter((p) => p.is_active).first());

  const [selectedChannel, setSelectedChannel] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const productMap = useMemo(() => new Map(products.map((p) => [p.sku, p])), [products]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (selectedChannel !== 'ALL' && o.channel !== selectedChannel) return false;
      if (searchTerm && !o.sku.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [orders, selectedChannel, searchTerm]);

  // Aggregate shop profit
  const shopProfit = useMemo(() => {
    return aggregateShopProfit(filteredOrders, productMap, feeSchedules);
  }, [filteredOrders, productMap, feeSchedules]);

  // Waterfall chart data points
  const waterfallData = useMemo(() => {
    const gross = shopProfit.grossRevenue;
    const discount = shopProfit.discount;
    const cogs = shopProfit.cogs;
    const commFee = shopProfit.commissionFee;
    const hiddenFee = shopProfit.paymentFee + shopProfit.serviceFee + shopProfit.programFees;
    const ads = shopProfit.adsCostAllocated;
    const ship = shopProfit.shippingCostSeller;
    const other = shopProfit.otherCost;
    const profit = shopProfit.netProfitBeforeTax;

    return [
      { name: 'Doanh thu gốc', amount: gross, fill: '#1E3A8A', isTotal: true },
      { name: 'Giảm giá/Voucher', amount: -discount, fill: '#EF4444' },
      { name: 'Giá vốn (COGS)', amount: -cogs, fill: '#F97316' },
      { name: 'Phí hoa hồng', amount: -commFee, fill: '#EAB308' },
      { name: 'Phí ẩn sàn', amount: -hiddenFee, fill: '#F59E0B' }, // payment + service + program
      { name: 'Quảng cáo sàn', amount: -ads, fill: '#EC4899' },
      { name: 'Vận chuyển chịu', amount: -ship, fill: '#8B5CF6' },
      { name: 'Chi phí khác', amount: -other, fill: '#64748B' },
      {
        name: 'Lợi nhuận ròng',
        amount: profit,
        fill: profit >= 0 ? '#10B981' : '#DC2626',
        isTotal: true,
      },
    ];
  }, [shopProfit]);

  // Order level rows with breakdowns
  const orderBreakdowns = useMemo(() => {
    return filteredOrders.slice(0, 50).map((o) => {
      const prod = productMap.get(o.sku);
      return calculateOrderProfit(o, prod, feeSchedules);
    });
  }, [filteredOrders, productMap, feeSchedules]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Lợi Nhuận Thực Tế Người Bán (True Net Profit)
          </h2>
          <p className="text-xs text-slate-500">
            Bóc tách toàn diện doanh thu, chi phí ẩn của sàn, giá vốn và tỷ suất lợi nhuận ròng.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs shadow-2xs">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="bg-transparent font-medium text-slate-700 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">Tất cả kênh bán</option>
              <option value="Shopee">Shopee</option>
              <option value="TikTok Shop">TikTok Shop</option>
              <option value="Lazada">Lazada</option>
              <option value="Other">Khác</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Doanh thu thuần (Net Revenue)"
          value={formatVND(shopProfit.netRevenue)}
          subtext={`Từ ${shopProfit.totalOrders} đơn hàng`}
          icon={<DollarSign className="w-5 h-5 text-blue-700" />}
        />
        <KpiCard
          title="Tổng phí sàn khấu trừ"
          value={formatVND(shopProfit.totalPlatformFees)}
          subtext={`Chiếm ${formatPercent(
            shopProfit.netRevenue > 0 ? shopProfit.totalPlatformFees / shopProfit.netRevenue : 0
          )} doanh thu`}
          icon={<Receipt className="w-5 h-5 text-amber-600" />}
          variant="warning"
        />
        <KpiCard
          title="Lợi nhuận ròng trước thuế"
          value={formatVND(shopProfit.netProfitBeforeTax)}
          subtext={`Tỷ suất lợi nhuận: ${formatPercent(shopProfit.overallMargin)}`}
          icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
          variant={shopProfit.netProfitBeforeTax >= 0 ? 'success' : 'danger'}
        />
        <KpiCard
          title="Đơn hàng hoàn / hủy"
          value={`${shopProfit.totalReturned} đơn`}
          subtext={`Tỷ lệ hoàn: ${formatPercent(
            shopProfit.totalOrders > 0 ? shopProfit.totalReturned / shopProfit.totalOrders : 0
          )}`}
          icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
          variant={shopProfit.totalReturned > 0 ? 'danger' : 'default'}
        />
      </div>

      {/* Hidden Platform Fees Callout Banner */}
      <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-100 text-amber-800">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-amber-950">
              Cảnh giác các chi phí sàn "dễ bị lãng quên" (Hidden Fees Alert)
            </h4>
            <p className="text-xs text-amber-900/80 mt-0.5 leading-relaxed">
              Ngoài phí hoa hồng cố định ({formatVND(shopProfit.commissionFee)}), người bán đã chi trả{' '}
              <strong className="font-mono-num text-amber-950">
                {formatVND(shopProfit.paymentFee + shopProfit.serviceFee + shopProfit.programFees)}
              </strong>{' '}
              cho phí thanh toán, phí dịch vụ & gói Freeship/Voucher Xtra.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono-num">
          <div className="bg-white px-2.5 py-1.5 rounded-md border border-amber-200 text-slate-800">
            Thanh toán: <span className="font-bold">{formatVND(shopProfit.paymentFee)}</span>
          </div>
          <div className="bg-white px-2.5 py-1.5 rounded-md border border-amber-200 text-slate-800">
            Dịch vụ: <span className="font-bold">{formatVND(shopProfit.serviceFee)}</span>
          </div>
          <div className="bg-white px-2.5 py-1.5 rounded-md border border-amber-200 text-slate-800">
            Gói phụ: <span className="font-bold">{formatVND(shopProfit.programFees)}</span>
          </div>
        </div>
      </div>

      {/* Waterfall Breakdown Chart */}
      <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Biểu đồ Thác nước Bóc tách Lợi nhuận (Revenue to Profit Waterfall)
          </h3>
          <p className="text-xs text-slate-500">
            Trực quan hoá từng khoản khấu trừ từ doanh thu gộp đến dòng tiền ròng thực tế về tài khoản.
          </p>
        </div>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={waterfallData} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} interval={0} />
              <YAxis
                tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}Tr`}
                tick={{ fontSize: 11, fill: '#64748B' }}
              />
              <Tooltip
                formatter={(val: any) => [formatVND(Number(val)), 'Số tiền']}
                labelStyle={{ fontWeight: 'bold', color: '#1E293B' }}
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                {waterfallData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Channel Breakdown Cards */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
          Hiệu quả Lợi nhuận theo Từng Kênh Bán Hàng
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {(['Shopee', 'TikTok Shop', 'Lazada', 'Other'] as Channel[]).map((ch) => {
            const chData = shopProfit.byChannel[ch];
            const hasOrders = chData.orderCount > 0;
            return (
              <div
                key={ch}
                className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">{ch}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-700 font-mono-num">
                    {chData.orderCount} đơn
                  </span>
                </div>
                {hasOrders ? (
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-500">
                      <span>Doanh thu thuần:</span>
                      <span className="font-mono-num font-medium text-slate-800">
                        {formatVND(chData.netRevenue)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Tổng phí sàn:</span>
                      <span className="font-mono-num font-medium text-amber-700">
                        {formatVND(chData.totalPlatformFees)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Chi phí ads:</span>
                      <span className="font-mono-num font-medium text-slate-800">
                        {formatVND(chData.adsCostAllocated)}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-100 flex justify-between font-bold">
                      <span className="text-slate-700">Lợi nhuận ròng:</span>
                      <span
                        className={`font-mono-num ${
                          chData.netProfitBeforeTax >= 0 ? 'text-emerald-700' : 'text-red-600'
                        }`}
                      >
                        {formatVND(chData.netProfitBeforeTax)} ({formatPercent(chData.profitMargin)})
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Chưa phát sinh đơn hàng</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Orders Table */}
      <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Chi tiết Đơn hàng & Bóc tách Chi phí
            </h3>
            <p className="text-xs text-slate-500">
              Hiển thị tối đa 50 đơn hàng gần nhất. Phí sàn được tính tự động theo biểu phí có hiệu lực tại ngày đặt.
            </p>
          </div>
          <input
            type="text"
            placeholder="Tìm theo mã SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600 max-w-xs"
          />
        </div>

        {orderBreakdowns.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            Không tìm thấy đơn hàng nào phù hợp với bộ lọc.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Ngày</th>
                  <th className="p-2.5">Kênh</th>
                  <th className="p-2.5">SKU / SL</th>
                  <th className="p-2.5 text-right">Doanh thu gốc</th>
                  <th className="p-2.5 text-right">Giá vốn (COGS)</th>
                  <th className="p-2.5 text-right">Phí sàn</th>
                  <th className="p-2.5 text-right">Ads + Ship</th>
                  <th className="p-2.5 text-right">Lợi nhuận ròng</th>
                  <th className="p-2.5 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono-num">
                {orderBreakdowns.map((ord, idx) => (
                  <tr key={ord.orderId || idx} className="hover:bg-slate-50/80">
                    <td className="p-2.5 text-slate-600">{formatDateVN(ord.date)}</td>
                    <td className="p-2.5 font-sans font-medium text-slate-800">{ord.channel}</td>
                    <td className="p-2.5 font-sans">
                      <span className="font-semibold text-slate-900">{ord.sku}</span>
                      <span className="text-slate-400 ml-1">x{ord.quantity}</span>
                    </td>
                    <td className="p-2.5 text-right text-slate-800">
                      {formatVND(ord.grossRevenue)}
                    </td>
                    <td className="p-2.5 text-right text-slate-600">{formatVND(ord.cogs)}</td>
                    <td className="p-2.5 text-right text-amber-700 font-medium">
                      {formatVND(ord.totalPlatformFees)}
                    </td>
                    <td className="p-2.5 text-right text-slate-600">
                      {formatVND(ord.adsCostAllocated + ord.shippingCostSeller)}
                    </td>
                    <td
                      className={`p-2.5 text-right font-bold ${
                        ord.netProfitBeforeTax >= 0 ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {formatVND(ord.netProfitBeforeTax)}
                    </td>
                    <td className="p-2.5 text-center font-sans">
                      {ord.returned ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                          Hoàn trả
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800">
                          Thành công
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Persistent Assumptions Panel on result page */}
      <AssumptionsPanel feeSchedules={feeSchedules} taxPolicy={taxPolicy} />
    </div>
  );
};
