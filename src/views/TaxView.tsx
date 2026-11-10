import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database.ts';
import { TaxPolicyVersion, WithholdingRecord, Channel } from '../engine/types.ts';
import { calculateTaxObligation, generateTaxCliffData } from '../engine/tax.ts';
import { aggregateShopProfit } from '../engine/profit.ts';
import { KpiCard } from '../components/common/KpiCard.tsx';
import { AssumptionsPanel } from '../components/common/AssumptionsPanel.tsx';
import { formatVND, formatPercent, formatDateVN } from '../utils/formatters.ts';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
  CartesianGrid,
} from 'recharts';
import {
  Receipt,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  Plus,
  Trash2,
  FileText,
  DollarSign,
  Building,
} from 'lucide-react';

export const TaxView: React.FC = () => {
  const orders = useLiveQuery(() => db.orders.toArray(), []) ?? [];
  const products = useLiveQuery(() => db.products.toArray(), []) ?? [];
  const feeSchedules = useLiveQuery(() => db.fee_schedules.where('is_active').equals(1).toArray(), []) ?? [];
  const taxPolicies = useLiveQuery(() => db.tax_policies.toArray(), []) ?? [];
  const withholdings = useLiveQuery(() => db.withholding_records.toArray(), []) ?? [];

  // Active policy
  const activePolicy = taxPolicies.find((p) => p.is_active) ?? taxPolicies[0];

  // Configurable proximity warning margin (e.g. 0.85 = 85%)
  const [warningMargin, setWarningMargin] = useState<number>(0.85);

  // Withholding modal state
  const [isAddingWithholding, setIsAddingWithholding] = useState<boolean>(false);
  const [whChannel, setWhChannel] = useState<Channel>('Shopee');
  const [whDate, setWhDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [whAmount, setWhAmount] = useState<number>(5000000);

  // Policy version modal state
  const [isAddingPolicy, setIsAddingPolicy] = useState<boolean>(false);
  const [newEffectiveFrom, setNewEffectiveFrom] = useState<string>(new Date().toISOString().slice(0, 10));
  const [newThreshold, setNewThreshold] = useState<number>(1000000000);
  const [newVatRate, setNewVatRate] = useState<number>(1.0); // %
  const [newPitRate, setNewPitRate] = useState<number>(0.5); // %
  const [newComplianceCost, setNewComplianceCost] = useState<number>(12000000);
  const [newSourceNote, setNewSourceNote] = useState<string>('');

  // 1. Calculate pre-tax shop summary
  const shopSummary = useMemo(() => {
    const productMap = new Map(products.map((p) => [p.sku, p]));
    return aggregateShopProfit(orders, productMap, feeSchedules);
  }, [orders, products, feeSchedules]);

  // Aggregate annual revenue R = sum over ALL channels
  const aggregateRevenue = shopSummary.netRevenue;
  const preTaxProfit = shopSummary.netProfitBeforeTax;

  // 2. Calculate tax obligation
  const taxResult = useMemo(() => {
    if (!activePolicy) return null;
    return calculateTaxObligation(
      aggregateRevenue,
      preTaxProfit,
      activePolicy,
      withholdings,
      warningMargin,
      new Date().getFullYear()
    );
  }, [aggregateRevenue, preTaxProfit, activePolicy, withholdings, warningMargin]);

  // 3. Generate cliff chart points
  const cliffData = useMemo(() => {
    if (!activePolicy) return [];
    const profitMargin = aggregateRevenue > 0 ? preTaxProfit / aggregateRevenue : 0.15;
    return generateTaxCliffData(profitMargin, activePolicy, 0.5, 1.5, 40);
  }, [preTaxProfit, aggregateRevenue, activePolicy]);

  const handleAddWithholding = async (e: React.FormEvent) => {
    e.preventDefault();
    const item: WithholdingRecord = {
      channel: whChannel,
      date: whDate,
      amount: whAmount,
    };
    await db.withholding_records.add(item);
    setIsAddingWithholding(false);
  };

  const handleDeleteWithholding = async (id?: string) => {
    if (id && window.confirm('Bạn có chắc chắn muốn xóa bản ghi khấu trừ này?')) {
      await db.withholding_records.delete(id);
    }
  };

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    const newPolicy: TaxPolicyVersion = {
      id: `tax-policy-${Date.now()}`,
      effective_from: newEffectiveFrom,
      revenue_threshold: newThreshold,
      boundary_rule: '<=',
      tax_rates: [
        {
          category: 'Phân phối, cung cấp hàng hoá',
          vat_rate: newVatRate / 100,
          pit_rate: newPitRate / 100,
          description: 'Hàng hoá thương mại điện tử',
        },
      ],
      einvoice_required_above_threshold: true,
      compliance_cost_above_threshold: newComplianceCost,
      source_note: newSourceNote.trim() || 'Nhập thủ công bởi người dùng',
      origin: 'manual',
      is_active: true,
    };

    // Deactivate previous active policies
    await db.tax_policies.toCollection().modify({ is_active: false });
    await db.tax_policies.add(newPolicy);
    setIsAddingPolicy(false);
    setNewSourceNote('');
  };

  const handleActivatePolicy = async (id: string) => {
    await db.tax_policies.toCollection().modify({ is_active: false });
    await db.tax_policies.update(id, { is_active: true });
  };

  if (!activePolicy || !taxResult) {
    return (
      <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
        <Receipt className="w-10 h-10 text-slate-400 mx-auto mb-2" />
        <p className="text-sm text-slate-600">Đang tải thông tin chính sách thuế...</p>
      </div>
    );
  }

  const thresholdPercent = Math.min(100, Math.round(taxResult.ratioToThreshold * 100));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-emerald-600" />
            Mô Đun Ngưỡng Thuế & Biểu Đồ Vách Đá (Tax Cliff Simulator)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Theo dõi tổng doanh thu đa sàn hợp nhất $R$ so với ngưỡng quy định, tính toán vách đá chi phí tuân thủ và quyết toán bù trừ thuế sàn.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAddingWithholding(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-600" />
            Ghi nhận thuế sàn đã khấu trừ
          </button>
        </div>
      </div>

      {/* Threshold Alert Banner */}
      {taxResult.isAboveThreshold ? (
        <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-purple-700 shrink-0 mt-0.5" />
          <div className="text-xs text-purple-900 space-y-1">
            <p className="font-bold text-sm">
              ĐÃ VƯỢT NGƯỠNG DOANH THU ({formatPercent(taxResult.ratioToThreshold)})
            </p>
            <p>
              Tổng doanh thu đa kênh hợp nhất ({formatVND(taxResult.aggregateAnnualRevenue)}) đã vượt ngưỡng{' '}
              {formatVND(taxResult.revenueThreshold)}.
            </p>
            <p className="text-purple-800">
              * Phát sinh nghĩa vụ thuế GTGT + TNCN ({formatVND(taxResult.totalTaxLiability)}) và chi phí tuân thủ HĐĐT (
              {formatVND(taxResult.complianceCost)}/năm).
            </p>
          </div>
        </div>
      ) : taxResult.closeToThresholdWarning ? (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-bounce" />
          <div className="text-xs text-amber-900 space-y-1">
            <p className="font-bold text-sm">
              CẢNH BÁO TIẾP CẬN NGƯỠNG THUẾ ({thresholdPercent}% NGƯỠNG)
            </p>
            <p>
              Shop chỉ còn cách ngưỡng tính thuế{' '}
              <strong className="font-mono text-slate-900">{formatVND(taxResult.distanceToThreshold)}</strong>.
            </p>
            <p className="text-amber-800">
              Hãy chuẩn bị kế hoạch chi phí khi bước qua ngưỡng (vách đá lợi nhuận do xuất hóa đơn điện tử và biểu thuế khoán).
            </p>
          </div>
        </div>
      ) : (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="text-xs text-emerald-800">
            <span className="font-semibold">Doanh thu hiện tại an toàn dưới ngưỡng:</span> Đạt{' '}
            {thresholdPercent}% ngưỡng ({formatVND(taxResult.aggregateAnnualRevenue)} /{' '}
            {formatVND(taxResult.revenueThreshold)}). Chưa phát sinh nghĩa vụ thuế.
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Tổng Doanh Thu Hợp Nhất (R)"
          value={formatVND(taxResult.aggregateAnnualRevenue)}
          subtext="Tính gộp tất cả các kênh bán"
          icon={<DollarSign className="w-5 h-5 text-blue-600" />}
          variant={taxResult.isAboveThreshold ? 'warning' : 'default'}
        />

        <KpiCard
          title="Nghĩa Vụ Thuế Phát Sinh"
          value={formatVND(taxResult.totalTaxLiability)}
          subtext={taxResult.isAboveThreshold ? 'Áp dụng biểu thuế khoán' : 'Miễn thuế (Dưới ngưỡng)'}
          icon={<Receipt className="w-5 h-5 text-purple-600" />}
          variant={taxResult.totalTaxLiability > 0 ? 'warning' : 'default'}
        />

        <KpiCard
          title="Quyết Toán / Bù Trừ Thuế"
          value={formatVND(Math.abs(taxResult.settlementAmount))}
          subtext={
            taxResult.isRefund
              ? 'Dự kiến ĐƯỢC HOÀN / BÙ TRỪ'
              : taxResult.settlementAmount > 0
              ? 'Dự kiến PHẢI NỘP THÊM'
              : 'Đã hoàn tất nghĩa vụ'
          }
          icon={<Building className="w-5 h-5 text-emerald-600" />}
          variant={taxResult.isRefund ? 'success' : taxResult.settlementAmount > 0 ? 'danger' : 'default'}
        />

        <KpiCard
          title="Lợi Nhuận Sau Thuế"
          value={formatVND(taxResult.afterTaxProfit)}
          subtext={`Trước thuế: ${formatVND(preTaxProfit)}`}
          icon={<TrendingDown className="w-5 h-5 text-emerald-600" />}
          variant={taxResult.afterTaxProfit > 0 ? 'default' : 'danger'}
        />
      </div>

      {/* Cumulative Multi-channel Revenue vs Threshold Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">
              Tiến Độ Doanh Thu Hợp Nhất Đa Kênh vs Ngưỡng Tính Thuế
            </h3>
            <p className="text-xs text-slate-500">
              Quy tắc pháp lý: Doanh thu tính thuế là tổng doanh thu của cá nhân kinh doanh trên TOÀN BỘ các sàn, không tách rời từng sàn.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">Biên cảnh báo:</span>
            <select
              value={warningMargin}
              onChange={(e) => setWarningMargin(parseFloat(e.target.value))}
              className="px-2 py-1 bg-slate-50 border border-slate-300 rounded-md font-mono"
            >
              <option value={0.75}>75%</option>
              <option value={0.80}>80%</option>
              <option value={0.85}>85% (Mặc định)</option>
              <option value={0.90}>90%</option>
              <option value={0.95}>95%</option>
            </select>
          </div>
        </div>

        {/* Multi-segment Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-mono">
            <span className="font-semibold text-slate-700">
              Doanh thu thực tế: {formatVND(taxResult.aggregateAnnualRevenue)} ({thresholdPercent}%)
            </span>
            <span className="text-slate-500">
              Ngưỡng: {formatVND(taxResult.revenueThreshold)}
            </span>
          </div>

          <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex relative">
            {/* Warning Marker Line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-amber-500 z-10"
              style={{ left: `${warningMargin * 100}%` }}
              title={`Vạch cảnh báo cận ngưỡng (${(warningMargin * 100).toFixed(0)}%)`}
            />

            {/* Shopee */}
            <div
              style={{
                width: `${Math.min(
                  100,
                  (shopSummary.byChannel.Shopee.netRevenue / taxResult.revenueThreshold) * 100
                )}%`,
              }}
              className="bg-orange-500 h-full"
              title={`Shopee: ${formatVND(shopSummary.byChannel.Shopee.netRevenue)}`}
            />
            {/* TikTok Shop */}
            <div
              style={{
                width: `${Math.min(
                  100,
                  (shopSummary.byChannel['TikTok Shop'].netRevenue / taxResult.revenueThreshold) * 100
                )}%`,
              }}
              className="bg-slate-900 h-full"
              title={`TikTok Shop: ${formatVND(shopSummary.byChannel['TikTok Shop'].netRevenue)}`}
            />
            {/* Lazada */}
            <div
              style={{
                width: `${Math.min(
                  100,
                  (shopSummary.byChannel.Lazada.netRevenue / taxResult.revenueThreshold) * 100
                )}%`,
              }}
              className="bg-blue-600 h-full"
              title={`Lazada: ${formatVND(shopSummary.byChannel.Lazada.netRevenue)}`}
            />
            {/* Other */}
            <div
              style={{
                width: `${Math.min(
                  100,
                  (shopSummary.byChannel.Other.netRevenue / taxResult.revenueThreshold) * 100
                )}%`,
              }}
              className="bg-purple-600 h-full"
              title={`Kênh khác: ${formatVND(shopSummary.byChannel.Other.netRevenue)}`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px] pt-1">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 bg-orange-500 rounded-full" /> Shopee ({formatVND(shopSummary.byChannel.Shopee.netRevenue)})
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 bg-slate-900 rounded-full" /> TikTok Shop ({formatVND(shopSummary.byChannel['TikTok Shop'].netRevenue)})
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 bg-blue-600 rounded-full" /> Lazada ({formatVND(shopSummary.byChannel.Lazada.netRevenue)})
            </span>
            <span className="flex items-center gap-1.5 font-medium text-amber-700">
              <span className="w-2 h-2 bg-amber-500 rounded-sm" /> Mốc cảnh báo {(warningMargin * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      {/* Cliff Chart: After-Tax Profit vs Annual Revenue */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-emerald-600" />
              Biểu Đồ Vách Đá Lợi Nhuận (Tax Cliff Curve)
            </h3>
            <p className="text-xs text-slate-500">
              Minh họa sự sụt giảm tức thì của lợi nhuận thực tế khi chạm ngưỡng do chi phí phần mềm HĐĐT ({formatVND(activePolicy.compliance_cost_above_threshold)}) và thuế phát sinh.
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1.5 font-medium text-blue-600">
              <span className="w-3 h-0.5 bg-blue-600" /> Trước thuế
            </span>
            <span className="flex items-center gap-1.5 font-medium text-emerald-600">
              <span className="w-3 h-0.5 bg-emerald-600" /> Sau thuế & tuân thủ
            </span>
            <span className="flex items-center gap-1.5 font-medium text-red-600">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600" /> Điểm hiện tại của shop
            </span>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cliffData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <defs>
                <linearGradient id="colorPreTax" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorAfterTax" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="revenue"
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickFormatter={(val) => `${(val / 1000000).toFixed(0)}Tr`}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickFormatter={(val) => `${(val / 1000000).toFixed(0)}Tr`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white p-3 rounded-lg text-xs space-y-1.5 shadow-lg">
                        <p className="font-semibold text-slate-200">
                          Doanh thu: {formatVND(d.revenue)}
                        </p>
                        <p className="text-blue-300 font-mono">
                          Lợi nhuận trước thuế: {formatVND(d.preTaxProfit)}
                        </p>
                        <p className="text-emerald-300 font-mono">
                          Lợi nhuận sau thuế: {formatVND(d.afterTaxProfit)}
                        </p>
                        {d.isAboveThreshold && (
                          <div className="pt-1 border-t border-slate-700 text-[10px] text-red-300">
                            Thuế: {formatVND(d.taxAmount)} | Chi phí HĐĐT: {formatVND(d.complianceCost)}
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine
                x={activePolicy.revenue_threshold}
                stroke="#dc2626"
                strokeDasharray="4 4"
                label={{
                  value: `Ngưỡng ${formatVND(activePolicy.revenue_threshold)}`,
                  position: 'top',
                  fill: '#dc2626',
                  fontSize: 10,
                }}
              />
              <Area
                type="monotone"
                dataKey="preTaxProfit"
                stroke="#2563eb"
                strokeWidth={1.5}
                fillOpacity={1}
                fill="url(#colorPreTax)"
              />
              <Area
                type="stepAfter"
                dataKey="afterTaxProfit"
                stroke="#059669"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorAfterTax)"
              />
              {/* Reference dot for current shop revenue and after tax profit */}
              <ReferenceDot
                x={taxResult.aggregateAnnualRevenue}
                y={taxResult.afterTaxProfit}
                r={5}
                fill="#dc2626"
                stroke="#ffffff"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Withholding & Settlement Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">
              Thuế Đã Khấu Trừ Tại Nguồn & Quyết Toán Năm
            </h3>
            <p className="text-xs text-slate-500">
              Sàn TMĐT tự động trích nộp thuế thay cho người bán theo quy định. Không bao giờ tính trùng lặp số thuế sàn đã nộp.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">
              Tổng đã khấu trừ: <strong className="font-mono text-emerald-600">{formatVND(taxResult.totalWithheld)}</strong>
            </span>
          </div>
        </div>

        {/* Withholdings Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                <th className="p-2.5">Sàn khấu trừ</th>
                <th className="p-2.5">Ngày khấu trừ</th>
                <th className="p-2.5 text-right">Số tiền đã khấu trừ</th>
                <th className="p-2.5 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {withholdings.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-slate-400">
                    Chưa có bản ghi khấu trừ thuế nào. Bấm &quot;Ghi nhận thuế sàn đã khấu trừ&quot; để bổ sung.
                  </td>
                </tr>
              ) : (
                withholdings.map((wh) => (
                  <tr key={wh.id} className="hover:bg-slate-50/50">
                    <td className="p-2.5 font-medium text-slate-900">{wh.channel}</td>
                    <td className="p-2.5 text-slate-600">{formatDateVN(wh.date)}</td>
                    <td className="p-2.5 text-right font-mono font-semibold text-emerald-600">
                      {formatVND(wh.amount)}
                    </td>
                    <td className="p-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteWithholding(wh.id)}
                        className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                        title="Xóa bản ghi"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tax Policy Versions Management */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              Bảng Phiên Bản Chính Sách Thuế (Tax Policy Versions)
            </h3>
            <p className="text-xs text-slate-500">
              Mô hình hướng dữ liệu: Thay đổi chính sách thuế bằng cách tạo phiên bản mới, không sửa mã nguồn cứng.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddingPolicy(!isAddingPolicy)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {isAddingPolicy ? 'Đóng form' : 'Thêm phiên bản mới'}
          </button>
        </div>

        {/* Add Policy Form */}
        {isAddingPolicy && (
          <form onSubmit={handleCreatePolicy} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Tạo phiên bản chính sách thuế mới</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Ngày áp dụng hiệu lực</label>
                <input
                  type="date"
                  value={newEffectiveFrom}
                  onChange={(e) => setNewEffectiveFrom(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-300 rounded-lg p-2"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Ngưỡng doanh thu (VND)</label>
                <input
                  type="number"
                  step="50000000"
                  value={newThreshold}
                  onChange={(e) => setNewThreshold(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Chi phí tuân thủ HĐĐT (VND/năm)</label>
                <input
                  type="number"
                  step="1000000"
                  value={newComplianceCost}
                  onChange={(e) => setNewComplianceCost(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Thuế suất GTGT (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={newVatRate}
                  onChange={(e) => setNewVatRate(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Thuế suất TNCN (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={newPitRate}
                  onChange={(e) => setNewPitRate(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Ghi chú nguồn văn bản</label>
                <input
                  type="text"
                  value={newSourceNote}
                  onChange={(e) => setNewSourceNote(e.target.value)}
                  placeholder="Ví dụ: Thông tư 40/2021/TT-BTC, Nghị định..."
                  required
                  className="w-full bg-white border border-slate-300 rounded-lg p-2"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddingPolicy(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-xs cursor-pointer"
              >
                Lưu phiên bản
              </button>
            </div>
          </form>
        )}

        {/* Policy Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                <th className="p-2.5">Phiên bản</th>
                <th className="p-2.5">Hiệu lực từ</th>
                <th className="p-2.5 text-right">Ngưỡng (VND)</th>
                <th className="p-2.5 text-right">Thuế suất (GTGT + TNCN)</th>
                <th className="p-2.5 text-right">Phí tuân thủ HĐĐT</th>
                <th className="p-2.5">Nguồn</th>
                <th className="p-2.5 text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {taxPolicies.map((pol) => {
                const totalRate = pol.tax_rates.reduce((s, r) => s + r.vat_rate + r.pit_rate, 0);
                return (
                  <tr key={pol.id} className={pol.is_active ? 'bg-blue-50/30' : 'hover:bg-slate-50/50'}>
                    <td className="p-2.5 font-mono text-slate-900">
                      {pol.id} {pol.origin === 'radar' && <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-sans">Radar</span>}
                    </td>
                    <td className="p-2.5 text-slate-600">{formatDateVN(pol.effective_from)}</td>
                    <td className="p-2.5 text-right font-mono font-semibold text-slate-900">
                      {formatVND(pol.revenue_threshold)}
                    </td>
                    <td className="p-2.5 text-right font-mono text-slate-700">
                      {pol.tax_rates.length > 0 ? formatPercent(totalRate) : 'Chưa nhập (Empty)'}
                    </td>
                    <td className="p-2.5 text-right font-mono text-slate-700">
                      {formatVND(pol.compliance_cost_above_threshold)}/năm
                    </td>
                    <td className="p-2.5 text-slate-600 max-w-xs truncate" title={pol.source_note}>
                      {pol.source_note}
                    </td>
                    <td className="p-2.5 text-center">
                      {pol.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                          Đang kích hoạt
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleActivatePolicy(pol.id)}
                          className="px-2 py-0.5 rounded text-[11px] text-blue-600 hover:bg-blue-50 font-semibold cursor-pointer"
                        >
                          Kích hoạt
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assumptions Panel */}
      <AssumptionsPanel
        feeSchedules={feeSchedules}
        taxPolicy={activePolicy}
      />

      {/* Modal Add Withholding Record */}
      {isAddingWithholding && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Ghi nhận thuế sàn đã khấu trừ</h3>
            <form onSubmit={handleAddWithholding} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Sàn khấu trừ</label>
                <select
                  value={whChannel}
                  onChange={(e) => setWhChannel(e.target.value as Channel)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2"
                >
                  <option value="Shopee">Shopee</option>
                  <option value="TikTok Shop">TikTok Shop</option>
                  <option value="Lazada">Lazada</option>
                  <option value="Other">Khác</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ngày khấu trừ</label>
                <input
                  type="date"
                  value={whDate}
                  onChange={(e) => setWhDate(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-300 rounded-lg p-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Số tiền thuế đã khấu trừ (VND)</label>
                <input
                  type="number"
                  step="500000"
                  value={whAmount}
                  onChange={(e) => setWhAmount(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddingWithholding(false)}
                  className="px-3 py-2 text-slate-600 hover:text-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-xs cursor-pointer"
                >
                  Lưu bản ghi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
