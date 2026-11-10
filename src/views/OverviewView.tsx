import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database.ts';
import { aggregateShopProfit } from '../engine/profit.ts';
import { calculateTaxObligation } from '../engine/tax.ts';
import { calculateFeeTolerance } from '../engine/bisection.ts';
import { formatVND, formatPercent } from '../utils/formatters.ts';
import { KpiCard } from '../components/common/KpiCard.tsx';
import { AssumptionsPanel } from '../components/common/AssumptionsPanel.tsx';
import { ScreenId } from '../components/layout/Sidebar.tsx';
import {
  TrendingUp,
  Receipt,
  Radio,
  DollarSign,
  ArrowRight,
  ShieldAlert,
  Activity,
} from 'lucide-react';

interface OverviewViewProps {
  onNavigate: (screen: ScreenId) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ onNavigate }) => {
  const orders       = useLiveQuery(() => db.orders.toArray()) ?? [];
  const products     = useLiveQuery(() => db.products.toArray()) ?? [];
  const feeSchedules = useLiveQuery(() => db.fee_schedules.toArray()) ?? [];
  const taxPolicy    = useLiveQuery(() => db.tax_policies.filter((p) => p.is_active).first());
  const withholdings = useLiveQuery(() => db.withholding_records.toArray()) ?? [];
  const radarRecords = useLiveQuery(() => db.radar_records.toArray()) ?? [];

  const productMap = useMemo(() => new Map(products.map((p) => [p.sku, p])), [products]);

  const shopProfit = useMemo(
    () => aggregateShopProfit(orders, productMap, feeSchedules),
    [orders, productMap, feeSchedules]
  );

  const feeTolerance = useMemo(() => {
    if (orders.length === 0) return { state: 'SOLVED', tolerancePercentagePoints: 0 };
    return calculateFeeTolerance((delta) => {
      const bumped = feeSchedules.map((s) => ({
        ...s,
        commission_rate: Math.min(1.0, s.commission_rate + delta),
      }));
      return aggregateShopProfit(orders, productMap, bumped).netProfitBeforeTax;
    });
  }, [orders, productMap, feeSchedules]);

  const taxResult = useMemo(() => {
    if (!taxPolicy) return null;
    return calculateTaxObligation(
      shopProfit.netRevenue,
      shopProfit.netProfitBeforeTax,
      taxPolicy,
      withholdings
    );
  }, [shopProfit, taxPolicy, withholdings]);

  const pendingRadarCount = useMemo(
    () => radarRecords.filter((r) => r.status === 'pending').length,
    [radarRecords]
  );

  const channels = ['Shopee', 'TikTok Shop', 'Lazada'] as const;
  const channelColors = { 'Shopee': '#f97316', 'TikTok Shop': '#1a2744', 'Lazada': '#3b6fe8' };

  return (
    <div className="space-y-6">
      {/* Empty state CTA */}
      {orders.length === 0 && (
        <div
          className="rounded-2xl p-6 flex items-center justify-between"
          style={{
            background: 'linear-gradient(135deg, #1a2744 0%, #243461 100%)',
            boxShadow: '0 4px 20px rgba(26,39,68,0.25)',
          }}
        >
          <div>
            <p className="text-white font-bold text-base">Chưa có dữ liệu đơn hàng</p>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Nhập CSV hoặc tạo dữ liệu Demo để bắt đầu phân tích lợi nhuận.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('data')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm cursor-pointer flex-shrink-0"
            style={{ background: '#3b6fe8', color: 'white', boxShadow: '0 2px 8px rgba(59,111,232,0.4)' }}
          >
            Nạp Dữ Liệu
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Lợi nhuận ròng trước thuế"
          value={formatVND(shopProfit.netProfitBeforeTax)}
          subtext={`Tỷ suất: ${formatPercent(shopProfit.overallMargin)}`}
          icon={<TrendingUp className="w-5 h-5" />}
          variant={shopProfit.netProfitBeforeTax >= 0 ? 'success' : 'danger'}
          accentColor={shopProfit.netProfitBeforeTax >= 0 ? '#10b981' : '#ef4444'}
        />
        <KpiCard
          title="Doanh thu lũy kế năm"
          value={formatVND(shopProfit.netRevenue)}
          subtext={`${shopProfit.totalOrders} đơn · ${products.length} SKU`}
          icon={<DollarSign className="w-5 h-5" />}
          variant="default"
          accentColor="#3b6fe8"
        />
        <KpiCard
          title="Độ bền phí sàn (Fee Tolerance)"
          value={
            feeTolerance.state === 'ALREADY_NEGATIVE'
              ? 'Đã âm'
              : feeTolerance.state === 'NO_LIMIT_FOUND'
              ? '> 100 pp'
              : `+${feeTolerance.tolerancePercentagePoints.toFixed(1)} pp`
          }
          subtext="Tăng hoa hồng tối đa trước hòa vốn"
          icon={<ShieldAlert className="w-5 h-5" />}
          variant={feeTolerance.state === 'ALREADY_NEGATIVE' ? 'danger' : 'default'}
          accentColor="#6366f1"
        />
        <KpiCard
          title="Radar: thông báo chờ duyệt"
          value={`${pendingRadarCount} thông báo`}
          subtext="Biểu phí & chính sách thuế mới"
          icon={<Radio className="w-5 h-5" />}
          variant={pendingRadarCount > 0 ? 'warning' : 'default'}
          accentColor={pendingRadarCount > 0 ? '#f59e0b' : '#94a3b8'}
        />
      </div>

      {/* Tax threshold progress */}
      {taxResult && (
        <div
          className="bg-white rounded-2xl p-5"
          style={{ boxShadow: '0 1px 4px rgba(26,39,68,0.07), 0 0 0 1px rgba(59,111,232,0.07)' }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(59,111,232,0.1)' }}
              >
                <Receipt className="w-4.5 h-4.5" style={{ color: '#3b6fe8' }} />
              </div>
              <div>
                <p className="font-bold text-sm" style={{ color: '#1a2744' }}>
                  Tiến Độ Doanh Thu vs. Ngưỡng Thuế
                </p>
                <p className="text-xs" style={{ color: '#94a3b8' }}>
                  Tổng tất cả kênh · Ngưỡng: {formatVND(taxResult.revenueThreshold)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-sm font-mono-num" style={{ color: '#1a2744' }}>
                {formatVND(taxResult.aggregateAnnualRevenue)}
              </p>
              <p className="text-xs font-mono-num" style={{ color: '#94a3b8' }}>
                {formatPercent(taxResult.ratioToThreshold)} ngưỡng
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div
            className="w-full h-3 rounded-full overflow-hidden"
            style={{ background: 'rgba(59,111,232,0.08)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(100, taxResult.ratioToThreshold * 100)}%`,
                background: taxResult.isAboveThreshold
                  ? '#ef4444'
                  : taxResult.closeToThresholdWarning
                  ? '#f59e0b'
                  : 'linear-gradient(90deg, #3b6fe8 0%, #60a5fa 100%)',
                boxShadow: taxResult.isAboveThreshold
                  ? '0 0 8px rgba(239,68,68,0.4)'
                  : taxResult.closeToThresholdWarning
                  ? '0 0 8px rgba(245,158,11,0.4)'
                  : '0 0 8px rgba(59,111,232,0.3)',
              }}
            />
          </div>

          <div className="flex items-center justify-between mt-2.5 text-xs">
            <span style={{ color: '#94a3b8' }}>0 ₫</span>
            <span>
              {taxResult.isAboveThreshold ? (
                <span className="font-bold" style={{ color: '#ef4444' }}>
                  ⚠ Đã vượt ngưỡng — dự kiến thuế {formatVND(taxResult.totalTaxLiability + taxResult.complianceCost)}
                </span>
              ) : taxResult.closeToThresholdWarning ? (
                <span className="font-bold" style={{ color: '#f59e0b' }}>
                  ⚠ Gần ngưỡng — còn {formatVND(taxResult.distanceToThreshold)}
                </span>
              ) : (
                <span style={{ color: '#10b981' }}>✓ An toàn dưới ngưỡng</span>
              )}
            </span>
            <span style={{ color: '#94a3b8' }}>{formatVND(taxResult.revenueThreshold)}</span>
          </div>
        </div>
      )}

      {/* Channel summary + Simulator CTA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Channel cards */}
        {channels.map((ch) => {
          const chData = shopProfit.byChannel[ch];
          const color = channelColors[ch];
          return (
            <div
              key={ch}
              className="bg-white rounded-2xl p-5 cursor-pointer group"
              style={{ boxShadow: '0 1px 4px rgba(26,39,68,0.07), 0 0 0 1px rgba(59,111,232,0.07)' }}
              onClick={() => onNavigate('profit')}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: color }}
                  />
                  <span className="font-bold text-sm" style={{ color: '#1a2744' }}>{ch}</span>
                </div>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full font-mono-num"
                  style={{ background: `${color}15`, color }}
                >
                  {chData.orderCount} đơn
                </span>
              </div>
              <p className="text-xl font-bold font-mono-num" style={{ color: '#1a2744' }}>
                {formatVND(chData.netRevenue)}
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>Doanh thu thuần</p>
              <div
                className="flex items-center justify-between mt-3 pt-3 text-xs"
                style={{ borderTop: '1px solid rgba(59,111,232,0.07)' }}
              >
                <span style={{ color: '#94a3b8' }}>Lợi nhuận ròng</span>
                <span
                  className="font-mono-num font-bold"
                  style={{ color: chData.netProfitBeforeTax >= 0 ? '#10b981' : '#ef4444' }}
                >
                  {formatVND(chData.netProfitBeforeTax)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Simulator CTA banner */}
      <div
        className="rounded-2xl p-5 flex items-center justify-between cursor-pointer group"
        style={{
          background: 'linear-gradient(135deg, #1a2744 0%, #243461 60%, #1e3a7a 100%)',
          boxShadow: '0 4px 20px rgba(26,39,68,0.2)',
        }}
        onClick={() => onNavigate('simulator')}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(59,111,232,0.3)' }}
          >
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-base">Mô phỏng sốc tăng phí (Monte Carlo)</p>
            <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Chạy 10.000 kịch bản để đo sức bền tài chính khi sàn tăng phí đột ngột
            </p>
          </div>
        </div>
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm flex-shrink-0 group-hover:scale-105 transition-transform"
          style={{ background: '#3b6fe8', color: 'white' }}
        >
          Chạy ngay
          <ArrowRight className="w-4 h-4" />
        </div>
      </div>

      <AssumptionsPanel feeSchedules={feeSchedules} taxPolicy={taxPolicy} compact />
    </div>
  );
};
