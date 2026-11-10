import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database.ts';
import { FeeEvent, Channel } from '../../engine/types.ts';
import { calibrateShockParameters } from '../../engine/calibration.ts';
import { formatPercent } from '../../utils/formatters.ts';
import { Sliders, Plus, Trash2, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';

interface CalibrationPanelProps {
  onApplyParameters: (params: {
    lambda: number;
    triangularMin: number;
    triangularMode: number;
    triangularMax: number;
  }) => void;
}

export const CalibrationPanel: React.FC<CalibrationPanelProps> = ({ onApplyParameters }) => {
  const feeEvents = useLiveQuery(() => db.fee_events.toArray(), []) ?? [];
  const [isAdding, setIsAdding] = useState(false);

  // Form states
  const [platform, setPlatform] = useState<Channel>('Shopee');
  const [category, setCategory] = useState('*');
  const [announcedDate, setAnnouncedDate] = useState('2024-01-15');
  const [effectiveDate, setEffectiveDate] = useState('2024-02-01');
  const [oldRate, setOldRate] = useState(4.0); // %
  const [newRate, setNewRate] = useState(6.0); // %
  const [sourceUrl, setSourceUrl] = useState('');

  // Calibration calculation
  const calibration = calibrateShockParameters(feeEvents);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newRate <= oldRate) {
      alert('Tỷ lệ phí mới phải lớn hơn tỷ lệ phí cũ để tính biên độ sốc.');
      return;
    }

    const event: FeeEvent = {
      id: `FE-${Date.now()}`,
      platform,
      category,
      announced_date: announcedDate,
      effective_date: effectiveDate,
      old_rate: oldRate / 100,
      new_rate: newRate / 100,
      source_url: sourceUrl.trim() || undefined,
    };

    await db.fee_events.add(event);
    setIsAdding(false);
    setSourceUrl('');
  };

  const handleDeleteEvent = async (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa sự kiện tăng phí này?')) {
      await db.fee_events.delete(id);
    }
  };

  const handleApply = () => {
    onApplyParameters({
      lambda: Number(calibration.lambdaEstimated.toFixed(2)),
      triangularMin: calibration.triangularMin,
      triangularMode: calibration.triangularMode,
      triangularMax: calibration.triangularMax,
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-800 text-base">
              Bảng Hiệu Chuẩn Lịch Sử Tăng Phí (FeeEvent Calibration)
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Ước lượng tần suất tăng phí ($\lambda$) và phân phối biên độ (Triangular) từ lịch sử thực tế của bạn.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAdding(!isAdding)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {isAdding ? 'Đóng form' : 'Thêm sự kiện'}
          </button>
          {!calibration.insufficientData && (
            <button
              type="button"
              onClick={handleApply}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Áp dụng vào mô phỏng
            </button>
          )}
        </div>
      </div>

      {/* Warning or Status */}
      {calibration.insufficientData ? (
        <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 space-y-1">
            <p className="font-semibold">Cảnh báo: Dữ liệu chưa đủ để hiệu chuẩn tự động!</p>
            <p>{calibration.warning}</p>
            <p className="text-amber-700">
              * Hệ thống không bao giờ tự bịa đặt lịch sử. Bạn có thể sử dụng các tham số thủ công mặc định hoặc nhập các đợt tăng phí sàn thực tế đã thông báo.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-800 space-y-1">
            <p className="font-semibold">
              Đã hiệu chuẩn từ {calibration.eventCount} sự kiện trong {calibration.timeSpanYears.toFixed(1)} năm:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono font-bold">
              <span className="bg-white/80 p-1.5 rounded border border-emerald-200">
                &lambda;: {calibration.lambdaEstimated.toFixed(2)} lần/năm
              </span>
              <span className="bg-white/80 p-1.5 rounded border border-emerald-200">
                Min: +{(calibration.triangularMin * 100).toFixed(1)} pp
              </span>
              <span className="bg-white/80 p-1.5 rounded border border-emerald-200">
                Mode: +{(calibration.triangularMode * 100).toFixed(1)} pp
              </span>
              <span className="bg-white/80 p-1.5 rounded border border-emerald-200">
                Max: +{(calibration.triangularMax * 100).toFixed(1)} pp
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Form Add Fee Event */}
      {isAdding && (
        <form onSubmit={handleAddEvent} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Ghi nhận đợt tăng phí sàn</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Sàn thương mại</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as Channel)}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="Shopee">Shopee</option>
                <option value="TikTok Shop">TikTok Shop</option>
                <option value="Lazada">Lazada</option>
                <option value="Other">Khác</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Ngành hàng</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="* cho tất cả"
                className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Ngày thông báo</label>
              <input
                type="date"
                value={announcedDate}
                onChange={(e) => setAnnouncedDate(e.target.value)}
                required
                className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Ngày có hiệu lực</label>
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                required
                className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tỷ lệ cũ (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={oldRate}
                onChange={(e) => setOldRate(parseFloat(e.target.value) || 0)}
                required
                className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tỷ lệ mới (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={newRate}
                onChange={(e) => setNewRate(parseFloat(e.target.value) || 0)}
                required
                className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Link nguồn thông báo (URL)</label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://banhang.shopee.vn/edu/article/..."
                className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer shadow-xs"
            >
              Lưu sự kiện
            </button>
          </div>
        </form>
      )}

      {/* Events Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <th className="p-2.5 font-semibold">Sàn</th>
              <th className="p-2.5 font-semibold">Ngành</th>
              <th className="p-2.5 font-semibold">Ngày thông báo</th>
              <th className="p-2.5 font-semibold">Hiệu lực</th>
              <th className="p-2.5 font-semibold text-right">Phí cũ</th>
              <th className="p-2.5 font-semibold text-right">Phí mới</th>
              <th className="p-2.5 font-semibold text-right">Mức tăng</th>
              <th className="p-2.5 font-semibold text-center">Nguồn</th>
              <th className="p-2.5 font-semibold text-center">Xóa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {feeEvents.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-4 text-center text-slate-400">
                  Chưa có sự kiện tăng phí nào được ghi nhận. Bấm &quot;Thêm sự kiện&quot; để bổ sung.
                </td>
              </tr>
            ) : (
              feeEvents.map((ev) => {
                const diff = ev.new_rate - ev.old_rate;
                return (
                  <tr key={ev.id} className="hover:bg-slate-50/60">
                    <td className="p-2.5 font-medium text-slate-900">{ev.platform}</td>
                    <td className="p-2.5 text-slate-600">{ev.category}</td>
                    <td className="p-2.5 text-slate-600">{ev.announced_date}</td>
                    <td className="p-2.5 text-slate-600">{ev.effective_date}</td>
                    <td className="p-2.5 text-right font-mono text-slate-600">{formatPercent(ev.old_rate)}</td>
                    <td className="p-2.5 text-right font-mono font-semibold text-slate-900">
                      {formatPercent(ev.new_rate)}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-red-600">
                      +{(diff * 100).toFixed(1)} pp
                    </td>
                    <td className="p-2.5 text-center">
                      {ev.source_url ? (
                        <a
                          href={ev.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex text-blue-600 hover:text-blue-800"
                          title="Xem thông báo gốc"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="p-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteEvent(ev.id)}
                        className="text-slate-400 hover:text-red-600 transition p-1 cursor-pointer"
                        title="Xóa sự kiện"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

