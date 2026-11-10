import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database.ts';
import { formatVND, formatPercent, formatDateVN } from '../utils/formatters.ts';
import { AssumptionsPanel } from '../components/common/AssumptionsPanel.tsx';
import {
  Sliders,
  ShieldCheck,
  Receipt,
} from 'lucide-react';

export const AssumptionsView: React.FC = () => {
  const feeSchedules = useLiveQuery(() => db.fee_schedules.toArray()) ?? [];
  const taxPolicies = useLiveQuery(() => db.tax_policies.toArray()) ?? [];

  // Toggle FeeSchedule active state
  const toggleFeeScheduleActive = async (id: string, currentState: boolean) => {
    await db.fee_schedules.update(id, { is_active: !currentState });
  };

  // Toggle TaxPolicy active state
  const toggleTaxPolicyActive = async (id: string, currentState: boolean) => {
    await db.tax_policies.update(id, { is_active: !currentState });
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Sliders className="w-5 h-5 text-blue-800" />
          Giả Định & Quản Lý Phiên Bản Chính Sách (Assumptions & Policy Versions)
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Các bản ghi demo được tạo để thử chức năng, không xác nhận mức phí hay hiệu lực pháp luật. Bản ghi thực tế phải kèm nguồn và ngày hiệu lực; phiên bản mới không ghi đè lịch sử.
        </p>
      </div>

      {/* Fee Schedules Table */}
      <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-700" />
              Lịch sử Biểu phí Sàn Thương Mại Điện Tử ({feeSchedules.length} phiên bản)
            </h3>
            <p className="text-xs text-slate-500">
              Đơn hàng tự động áp dụng biểu phí có ngày hiệu lực gần nhất trước hoặc bằng ngày đặt đơn.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-2.5">Mã ID</th>
                <th className="p-2.5">Sàn</th>
                <th className="p-2.5">Danh mục</th>
                <th className="p-2.5 text-right">Hoa hồng</th>
                <th className="p-2.5 text-right">Thanh toán</th>
                <th className="p-2.5 text-right">Dịch vụ</th>
                <th className="p-2.5">Gói phụ (Program)</th>
                <th className="p-2.5">Hiệu lực từ</th>
                <th className="p-2.5">Nguồn gốc</th>
                <th className="p-2.5 text-center">Kích hoạt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono-num">
              {feeSchedules.map((s) => (
                <tr
                  key={s.id}
                  className={`hover:bg-slate-50 ${!s.is_active ? 'opacity-40 bg-slate-50/50' : ''}`}
                >
                  <td className="p-2.5 font-sans font-bold text-slate-900">{s.id}</td>
                  <td className="p-2.5 font-sans font-semibold text-slate-800">{s.platform}</td>
                  <td className="p-2.5 font-sans text-slate-600">
                    {s.category === '*' ? 'Tất cả (*)' : s.category}
                  </td>
                  <td className="p-2.5 text-right font-bold text-slate-900">
                    {formatPercent(s.commission_rate)}
                  </td>
                  <td className="p-2.5 text-right text-slate-700">
                    {formatPercent(s.payment_rate)}
                  </td>
                  <td className="p-2.5 text-right text-slate-700">
                    {formatPercent(s.service_rate)}
                  </td>
                  <td className="p-2.5 font-sans text-slate-600">
                    {s.program_rates && s.program_rates.length > 0
                      ? s.program_rates
                          .map(
                            (p) =>
                              `${p.name}: ${formatPercent(p.rate)}${
                                p.cap ? ` (trần ${formatVND(p.cap)})` : ''
                              }`
                          )
                          .join('; ')
                      : '-'}
                  </td>
                  <td className="p-2.5 text-slate-600">{formatDateVN(s.effective_from)}</td>
                  <td className="p-2.5 font-sans">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        s.origin === 'radar'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {s.origin === 'radar' ? 'Radar' : 'Thủ công'}
                    </span>
                  </td>
                  <td className="p-2.5 text-center font-sans">
                    <button
                      type="button"
                      onClick={() => toggleFeeScheduleActive(s.id, s.is_active)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer ${
                        s.is_active
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                    >
                      {s.is_active ? 'Đang bật' : 'Đã tắt'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tax Policies Table */}
      <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-700" />
              Lịch sử Phiên bản Chính sách Thuế & Ngưỡng Doanh Thu ({taxPolicies.length} phiên bản)
            </h3>
            <p className="text-xs text-slate-500">
              Chú ý: bản ghi demo có ngưỡng 1 tỷ dù mang mốc thời gian 2024; đây là kịch bản giả định, KHÔNG phải khẳng định quy định năm 2024.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-2.5">Mã ID</th>
                <th className="p-2.5">Hiệu lực từ</th>
                <th className="p-2.5 text-right">Ngưỡng doanh thu năm</th>
                <th className="p-2.5 text-center">Quy tắc biên</th>
                <th className="p-2.5">Thuế suất cấu hình</th>
                <th className="p-2.5 text-right">Chi phí tuân thủ</th>
                <th className="p-2.5">Ghi chú nguồn</th>
                <th className="p-2.5 text-center">Kích hoạt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono-num">
              {taxPolicies.map((tp) => (
                <tr
                  key={tp.id}
                  className={`hover:bg-slate-50 ${!tp.is_active ? 'opacity-40 bg-slate-50/50' : ''}`}
                >
                  <td className="p-2.5 font-sans font-bold text-slate-900">{tp.id}</td>
                  <td className="p-2.5 text-slate-600">{formatDateVN(tp.effective_from)}</td>
                  <td className="p-2.5 text-right font-bold text-slate-900">
                    {formatVND(tp.revenue_threshold)}
                  </td>
                  <td className="p-2.5 text-center font-bold text-slate-700 font-sans">
                    {tp.boundary_rule}
                  </td>
                  <td className="p-2.5 font-sans text-slate-700">
                    {tp.tax_rates.length > 0 ? (
                      tp.tax_rates.map((r, i) => (
                        <div key={i}>
                          {r.category}: VAT {formatPercent(r.vat_rate)}, TNCN {formatPercent(r.pit_rate)}
                        </div>
                      ))
                    ) : (
                      <span className="text-amber-700 italic">Chưa nhập</span>
                    )}
                  </td>
                  <td className="p-2.5 text-right text-slate-800">
                    {formatVND(tp.compliance_cost_above_threshold)}
                  </td>
                  <td className="p-2.5 font-sans text-slate-500 max-w-xs truncate" title={tp.source_note}>
                    {tp.source_note}
                  </td>
                  <td className="p-2.5 text-center font-sans">
                    <button
                      type="button"
                      onClick={() => toggleTaxPolicyActive(tp.id, tp.is_active)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer ${
                        tp.is_active
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                    >
                      {tp.is_active ? 'Đang bật' : 'Đã tắt'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Integrated Assumptions Panel */}
      <AssumptionsPanel
        feeSchedules={feeSchedules}
        taxPolicy={taxPolicies.find((p) => p.is_active)}
      />
    </div>
  );
};
