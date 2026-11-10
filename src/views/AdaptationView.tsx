import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database.ts';
import { generateAdaptationSuggestions } from '../engine/adaptation.ts';
import { formatVND } from '../utils/formatters.ts';
import {
  Lightbulb,
  ArrowRight,
  TrendingUp,
  Sliders,
  AlertTriangle,
} from 'lucide-react';

interface AdaptationViewProps {
  onNavigateToSimulator?: () => void;
}

export const AdaptationView: React.FC<AdaptationViewProps> = ({ onNavigateToSimulator }) => {
  const orders = useLiveQuery(() => db.orders.toArray(), []) ?? [];
  const products = useLiveQuery(() => db.products.toArray(), []) ?? [];
  const feeSchedules = useLiveQuery(
    () => db.fee_schedules.where('is_active').equals(1).toArray(),
    []
  ) ?? [];

  // Constraint filters
  const [targetMargin, setTargetMargin] = useState<number>(0.15); // 15%
  const [maxPLoss, setMaxPLoss] = useState<number>(0.05); // 5%

  const suggestions = useMemo(() => {
    return generateAdaptationSuggestions(orders, products, feeSchedules, {
      targetMargin,
      maxAcceptableRiskPLoss: maxPLoss,
    });
  }, [orders, products, feeSchedules, targetMargin, maxPLoss]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Lightbulb className="w-6 h-6 text-amber-500" />
            Gợi Ý Thích Ứng (Adaptation Suggestions)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Tìm kiếm không gian giải pháp heuristic (giá bán, chi phí ads, cơ cấu kênh) để khôi phục lợi nhuận và mở rộng biên an toàn khi phí sàn tăng.
          </p>
        </div>
      </div>

      {/* Transparent Disclaimer Alert */}
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-start gap-3 shadow-xs">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold">Lưu ý quan trọng về tính chất thuật toán:</p>
          <p>
            Các phương án dưới đây được sinh ra bằng thuật toán <strong>Heuristic Grid Search</strong> mang tính định hướng tham khảo, không phải giải pháp tối ưu toán học toàn cục tuyệt đối. Người bán cần cân nhắc độ co giãn của cầu, mức độ cạnh tranh của từng SKU và thực tế vận hành shop.
          </p>
        </div>
      </div>

      {/* Constraints Controls */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Sliders className="w-4 h-4 text-blue-600" />
          <h3 className="font-bold text-slate-800 text-sm">Ràng Buộc & Mục Tiêu Tài Chính</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Biên Lợi Nhuận Mục Tiêu: {(targetMargin * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0.05"
              max="0.30"
              step="0.01"
              value={targetMargin}
              onChange={(e) => setTargetMargin(parseFloat(e.target.value))}
              className="w-full accent-blue-600"
            />
            <span className="text-[10px] text-slate-400">
              Mức tỷ suất lợi nhuận ròng / doanh thu mong muốn duy trì.
            </span>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Rủi Ro Thua Lỗ Chấp Nhận Tối Đa P(loss): {(maxPLoss * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0.01"
              max="0.20"
              step="0.01"
              value={maxPLoss}
              onChange={(e) => setMaxPLoss(parseFloat(e.target.value))}
              className="w-full accent-blue-600"
            />
            <span className="text-[10px] text-slate-400">
              Giới hạn tỷ lệ kịch bản có lợi nhuận âm khi sốc phí xảy ra.
            </span>
          </div>
        </div>
      </div>

      {/* Suggestions List */}
      <div className="space-y-4">
        {suggestions.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
            Chưa có đủ dữ liệu đơn hàng để sinh gợi ý. Hãy nhập dữ liệu đơn hàng trong tab &quot;Dữ liệu&quot;.
          </div>
        ) : (
          suggestions.map((strat) => {
            return (
              <div
                key={strat.id}
                className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4 hover:border-slate-300 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                        strat.category === 'price'
                          ? 'bg-blue-100 text-blue-800'
                          : strat.category === 'ads'
                          ? 'bg-emerald-100 text-emerald-800'
                          : strat.category === 'channel_mix'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-indigo-100 text-indigo-800'
                      }`}
                    >
                      {strat.category === 'price'
                        ? 'Tối ưu giá'
                        : strat.category === 'ads'
                        ? 'Tiết giảm Ads'
                        : strat.category === 'channel_mix'
                        ? 'Điều chuyển kênh'
                        : 'Chiến lược cân bằng'}
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm">{strat.title}</h3>
                  </div>

                  <span className="text-xs font-mono font-bold text-emerald-600 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    +{formatVND(strat.deltaProfitVnd)} (+{strat.deltaProfitPercent.toFixed(1)}%)
                  </span>
                </div>

                <p className="text-xs text-slate-600">{strat.description}</p>

                {/* Before vs After Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                      Lợi Nhuận Trước Thuế
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-500 line-through">
                        {formatVND(strat.before.netProfit)}
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span className="font-mono font-bold text-slate-900">
                        {formatVND(strat.after.netProfit)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                      Tỷ Suất Lợi Nhuận Ròng (Margin)
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-500">
                        {(strat.before.margin * 100).toFixed(1)}%
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span className="font-mono font-bold text-emerald-600">
                        {(strat.after.margin * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                      Biên Chịu Phí Sàn (Fee Tolerance)
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-500">
                        +{strat.before.estimatedFeeTolerance.toFixed(1)} pp
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span className="font-mono font-bold text-purple-600">
                        +{strat.after.estimatedFeeTolerance.toFixed(1)} pp
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span className="italic">* {strat.notes}</span>
                  {onNavigateToSimulator && (
                    <button
                      type="button"
                      onClick={onNavigateToSimulator}
                      className="text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      Kiểm tra độ nhạy trong Mô phỏng sốc phí <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
