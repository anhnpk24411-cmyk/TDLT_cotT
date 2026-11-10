import React from 'react';
import { RadarImpactResult } from '../../engine/radar_impact.ts';
import { formatVND } from '../../utils/formatters.ts';
import { TrendingDown, TrendingUp, AlertTriangle, Compass, DollarSign } from 'lucide-react';

interface ImpactCardProps {
  impact: RadarImpactResult;
  publishedVersionTitle?: string;
}

export const ImpactCard: React.FC<ImpactCardProps> = ({ impact, publishedVersionTitle }) => {
  const isLossWorsened = impact.deltaProfitVnd < 0;

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl shadow-md p-5 space-y-4 border border-slate-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/80 pb-3">
        <div>
          <span className="text-[10px] font-bold tracking-wider text-blue-400 uppercase">
            Đánh Giá Tác Động Tài Chính Tức Thì (Instant Financial Impact)
          </span>
          <h3 className="text-base font-bold text-white mt-0.5">
            {publishedVersionTitle || 'Tác Động Của Phiên Bản Chính Sách Mới'}
          </h3>
        </div>
        <span className="text-xs text-slate-300 font-mono bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700">
          Khảo sát trên {impact.evaluationPeriodOrdersCount} đơn hàng
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Delta Profit */}
        <div className="p-3.5 bg-slate-800/60 rounded-xl border border-slate-700 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Biến Động Lợi Nhuận Trước Thuế</span>
            {isLossWorsened ? (
              <TrendingDown className="w-4 h-4 text-red-400" />
            ) : (
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            )}
          </div>
          <p
            className={`text-lg font-bold font-mono ${
              isLossWorsened ? 'text-red-400' : 'text-emerald-400'
            }`}
          >
            {impact.deltaProfitVnd > 0 ? '+' : ''}
            {formatVND(impact.deltaProfitVnd)}
          </p>
          <p className="text-[11px] text-slate-400">
            Thay đổi {impact.deltaProfitPercent > 0 ? '+' : ''}
            {impact.deltaProfitPercent.toFixed(2)}% so với mức cũ ({formatVND(impact.oldNetProfitBeforeTax)})
          </p>
        </div>

        {/* New Fee Tolerance */}
        <div className="p-3.5 bg-slate-800/60 rounded-xl border border-slate-700 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Biên Chịu Phí Mới (Tolerance)</span>
            <Compass className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-lg font-bold font-mono text-purple-300">
            {impact.newFeeTolerance.state === 'SOLVED'
              ? `+${impact.newFeeTolerance.tolerancePercentagePoints.toFixed(2)} pp`
              : impact.newFeeTolerance.state === 'ALREADY_NEGATIVE'
              ? 'Đã lỗ'
              : 'Không giới hạn'}
          </p>
          <p className="text-[11px] text-slate-400">
            Mức cũ: +{impact.oldFeeTolerance.tolerancePercentagePoints.toFixed(2)} pp
          </p>
        </div>

        {/* Tax Obligation Impact */}
        <div className="p-3.5 bg-slate-800/60 rounded-xl border border-slate-700 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Lợi Nhuận Thực Tế Sau Thuế</span>
            <DollarSign className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-lg font-bold font-mono text-blue-300">
            {formatVND(impact.taxImpact.newAfterTaxProfit)}
          </p>
          <p className="text-[11px] text-slate-400">
            Chênh lệch: {impact.taxImpact.deltaAfterTaxProfit > 0 ? '+' : ''}
            {formatVND(impact.taxImpact.deltaAfterTaxProfit)}
          </p>
        </div>
      </div>

      {/* Threshold Alert if Crossed or Approaching */}
      {impact.taxImpact.warningMessage && (
        <div className="p-3 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-start gap-2.5 text-xs text-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>{impact.taxImpact.warningMessage}</span>
        </div>
      )}
    </div>
  );
};
