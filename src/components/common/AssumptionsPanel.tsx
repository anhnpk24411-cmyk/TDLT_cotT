import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import { FeeSchedule, TaxPolicyVersion } from '../../engine/types.ts';
import { formatPercent } from '../../utils/formatters.ts';

interface AssumptionsPanelProps {
  feeSchedules: FeeSchedule[];
  taxPolicy?: TaxPolicyVersion | null;
  compact?: boolean;
}

export const AssumptionsPanel: React.FC<AssumptionsPanelProps> = ({
  feeSchedules,
  taxPolicy,
  compact = false,
}) => {
  const [expanded, setExpanded] = useState(!compact);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(240,242,255,0.6)',
        border: '1px solid rgba(59,111,232,0.1)',
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3.5 cursor-pointer"
        style={{ background: 'transparent' }}
      >
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4" style={{ color: '#3b6fe8' }} />
          <span className="text-sm font-semibold" style={{ color: '#1a2744' }}>
            Giả định & Nguồn dữ liệu
          </span>
          {feeSchedules.length > 0 && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(59,111,232,0.12)', color: '#3b6fe8' }}
            >
              {feeSchedules.length} lịch phí
            </span>
          )}
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4" style={{ color: '#94a3b8' }} />
          : <ChevronDown className="w-4 h-4" style={{ color: '#94a3b8' }} />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          {/* Fee Schedules */}
          {feeSchedules.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#94a3b8' }}>
                Lịch Phí Sàn Đang Áp Dụng
              </p>
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(59,111,232,0.1)' }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: 'rgba(59,111,232,0.06)' }}>
                      <th className="px-3 py-2.5 text-left font-semibold" style={{ color: '#475569' }}>Sàn</th>
                      <th className="px-3 py-2.5 text-left font-semibold" style={{ color: '#475569' }}>Danh mục</th>
                      <th className="px-3 py-2.5 text-right font-semibold" style={{ color: '#475569' }}>Hoa hồng</th>
                      <th className="px-3 py-2.5 text-right font-semibold" style={{ color: '#475569' }}>TT điện tử</th>
                      <th className="px-3 py-2.5 text-right font-semibold" style={{ color: '#475569' }}>Dịch vụ</th>
                      <th className="px-3 py-2.5 text-left font-semibold" style={{ color: '#475569' }}>Hiệu lực</th>
                      <th className="px-3 py-2.5 text-left font-semibold" style={{ color: '#475569' }}>Nguồn</th>
                    </tr>
                  </thead>
                  <tbody style={{ background: 'white' }}>
                    {feeSchedules.map((fs, i) => (
                      <tr key={fs.id} style={{ borderTop: i > 0 ? '1px solid rgba(59,111,232,0.07)' : undefined }}>
                        <td className="px-3 py-2 font-semibold" style={{ color: '#1a2744' }}>{fs.platform}</td>
                        <td className="px-3 py-2" style={{ color: '#64748b' }}>{fs.category}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold" style={{ color: '#3b6fe8' }}>
                          {formatPercent(fs.commission_rate)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono" style={{ color: '#64748b' }}>
                          {formatPercent(fs.payment_rate)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono" style={{ color: '#64748b' }}>
                          {formatPercent(fs.service_rate)}
                        </td>
                        <td className="px-3 py-2 font-mono" style={{ color: '#94a3b8', fontSize: '10px' }}>
                          {fs.effective_from}
                        </td>
                        <td className="px-3 py-2" style={{ color: '#94a3b8', fontSize: '10px' }}>
                          {fs.origin === 'radar' ? (
                            <span
                              className="px-1.5 py-0.5 rounded-md font-semibold"
                              style={{ background: 'rgba(139,92,246,0.1)', color: '#7c3aed' }}
                            >
                              Radar
                            </span>
                          ) : fs.origin === 'manual' ? 'Nhập tay' : 'Demo'}
                          {fs.note && (
                            <span className="ml-1 text-amber-500" title={fs.note}>⚠</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-xs" style={{ color: '#94a3b8' }}>Chưa có lịch phí nào. Vui lòng nhập dữ liệu.</p>
          )}

          {/* Tax Policy */}
          {taxPolicy && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#94a3b8' }}>
                Chính Sách Thuế Hiện Hành
              </p>
              <div
                className="rounded-xl px-4 py-3 text-xs space-y-1.5"
                style={{ background: 'white', border: '1px solid rgba(59,111,232,0.1)' }}
              >
                <div className="flex justify-between">
                  <span style={{ color: '#64748b' }}>Ngưỡng doanh thu (placeholder):</span>
                  <span className="font-mono font-semibold" style={{ color: '#1a2744' }}>
                    {taxPolicy.revenue_threshold.toLocaleString('vi-VN')} ₫
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: '#64748b' }}>Hiệu lực từ:</span>
                  <span className="font-mono" style={{ color: '#64748b' }}>{taxPolicy.effective_from}</span>
                </div>
                {taxPolicy.source_note && (
                  <div className="pt-1" style={{ borderTop: '1px solid rgba(59,111,232,0.07)' }}>
                    <span style={{ color: '#94a3b8', fontSize: '10px' }}>{taxPolicy.source_note}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
