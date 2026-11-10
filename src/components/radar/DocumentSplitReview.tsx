import React, { useState } from 'react';
import { RadarDocument, RadarRecord, FeeSchedule, TaxPolicyVersion } from '../../engine/types.ts';
import { db } from '../../db/database.ts';
import { formatPercent, formatVND, formatDateVN } from '../../utils/formatters.ts';
import {
  CheckCircle,
  XCircle,
  Edit2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

interface DocumentSplitReviewProps {
  document: RadarDocument;
  records: RadarRecord[];
  activeFeeSchedules: FeeSchedule[];
  activeTaxPolicy?: TaxPolicyVersion;
  onRecordUpdated: (updatedRecords: RadarRecord[]) => void;
  onVersionPublished: (newSchedule?: FeeSchedule, newPolicy?: TaxPolicyVersion) => void;
}

export const DocumentSplitReview: React.FC<DocumentSplitReviewProps> = ({
  document,
  records,
  activeFeeSchedules,
  activeTaxPolicy,
  onRecordUpdated,
  onVersionPublished,
}) => {
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(
    records.length > 0 ? records[0].id : null
  );
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);

  // Editable fields buffer
  const [editField, setEditField] = useState<string>('');
  const [editOldVal, setEditOldVal] = useState<number>(0);
  const [editNewVal, setEditNewVal] = useState<number>(0);
  const [editEffectiveDate, setEditEffectiveDate] = useState<string>('');

  const selectedRecord = records.find((r) => r.id === selectedRecordId);

  // Render raw text with highlighted spans
  const renderHighlightedDocument = () => {
    const rawText = document.raw_text;
    if (records.length === 0) {
      return <div className="whitespace-pre-wrap font-sans text-xs text-slate-700">{rawText}</div>;
    }

    // Sort spans by start offset
    const sortedSpans = records
      .map((r) => ({
        id: r.id,
        start: r.source_span.start,
        end: r.source_span.end,
        status: r.status,
        isSelected: r.id === selectedRecordId,
      }))
      .filter((s) => s.start >= 0 && s.end <= rawText.length && s.start < s.end)
      .sort((a, b) => a.start - b.start);

    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    sortedSpans.forEach((span, idx) => {
      // Push text before span
      if (span.start > lastIndex) {
        elements.push(
          <span key={`text-${idx}`}>{rawText.slice(lastIndex, span.start)}</span>
        );
      }

      // Span highlight class
      const bgClass = span.isSelected
        ? 'bg-blue-300 text-blue-950 font-bold ring-2 ring-blue-500'
        : span.status === 'approved'
        ? 'bg-emerald-100 text-emerald-900 border-b-2 border-emerald-500'
        : span.status === 'rejected'
        ? 'bg-slate-200 text-slate-500 line-through'
        : 'bg-amber-100 text-amber-950 border-b-2 border-amber-400';

      elements.push(
        <mark
          key={`span-${span.id}`}
          onClick={() => setSelectedRecordId(span.id)}
          className={`cursor-pointer px-1 py-0.5 rounded transition ${bgClass}`}
          title="Bấm để đối chiếu bản ghi"
        >
          {rawText.slice(span.start, span.end)}
        </mark>
      );

      lastIndex = span.end;
    });

    if (lastIndex < rawText.length) {
      elements.push(<span key="tail">{rawText.slice(lastIndex)}</span>);
    }

    return (
      <div className="whitespace-pre-wrap font-sans text-xs text-slate-800 leading-relaxed">
        {elements}
      </div>
    );
  };

  const startEditing = (rec: RadarRecord) => {
    setEditingRecordId(rec.id);
    setEditField(rec.field);
    setEditOldVal(rec.old_value ?? 0);
    setEditNewVal(rec.new_value);
    setEditEffectiveDate(rec.effective_date);
  };

  const saveEditing = (recId: string) => {
    const updated = records.map((r) => {
      if (r.id === recId) {
        return {
          ...r,
          field: editField as any,
          old_value: editOldVal,
          new_value: editNewVal,
          effective_date: editEffectiveDate,
          status: 'edited' as const,
        };
      }
      return r;
    });
    setEditingRecordId(null);
    onRecordUpdated(updated);
  };

  const handleApprove = async (rec: RadarRecord) => {
    let createdVersionId = '';

    if (rec.kind === 'fee_change' && rec.platform) {
      // Find current active schedule for this platform to base off
      const currentSchedule = activeFeeSchedules.find(
        (s) => s.platform === rec.platform && s.is_active
      );

      const newScheduleId = `FS-RADAR-${Date.now()}`;
      createdVersionId = newScheduleId;

      const newSchedule: FeeSchedule = {
        id: newScheduleId,
        platform: rec.platform,
        category: rec.category || '*',
        effective_from: rec.effective_date,
        commission_rate:
          rec.field === 'commission'
            ? rec.new_value
            : currentSchedule?.commission_rate ?? 0.05,
        payment_rate:
          rec.field === 'payment' ? rec.new_value : currentSchedule?.payment_rate ?? 0.04,
        service_rate:
          rec.field === 'service' ? rec.new_value : currentSchedule?.service_rate ?? 0.03,
        program_rates: currentSchedule?.program_rates ?? [],
        source_url: document.source_url,
        note: `Tạo từ Radar: ${rec.source_span.text}`,
        origin: 'radar',
        radar_record_id: rec.id,
        is_active: true,
      };

      // Add new schedule and deactivate old schedule for this platform
      await db.fee_schedules
        .where('platform')
        .equals(rec.platform)
        .modify({ is_active: false });
      await db.fee_schedules.add(newSchedule);

      onVersionPublished(newSchedule, undefined);
    } else if (rec.kind === 'tax_change') {
      const newTaxId = `TAX-RADAR-${Date.now()}`;
      createdVersionId = newTaxId;

      const newPolicy: TaxPolicyVersion = {
        id: newTaxId,
        effective_from: rec.effective_date,
        revenue_threshold:
          rec.field === 'threshold'
            ? rec.new_value
            : activeTaxPolicy?.revenue_threshold ?? 1_000_000_000,
        tax_rates: activeTaxPolicy?.tax_rates ?? [],
        boundary_rule: activeTaxPolicy?.boundary_rule ?? '<=',
        einvoice_required_above_threshold: true,
        compliance_cost_above_threshold:
          activeTaxPolicy?.compliance_cost_above_threshold ?? 12_000_000,
        source_note: `Trích xuất Radar từ: ${document.title}`,
        origin: 'radar',
        radar_record_id: rec.id,
        is_active: true,
      };

      await db.tax_policies.toCollection().modify({ is_active: false });
      await db.tax_policies.add(newPolicy);

      onVersionPublished(undefined, newPolicy);
    }

    const updated = records.map((r) =>
      r.id === rec.id
        ? {
            ...r,
            status: 'approved' as const,
            created_version_id: createdVersionId,
          }
        : r
    );

    // Persist records to IndexedDB
    for (const r of updated) {
      await db.radar_records.put(r);
    }

    onRecordUpdated(updated);
  };

  const handleReject = async (rec: RadarRecord) => {
    const updated = records.map((r) =>
      r.id === rec.id ? { ...r, status: 'rejected' as const } : r
    );
    for (const r of updated) {
      await db.radar_records.put(r);
    }
    onRecordUpdated(updated);
  };

  const handleUndo = async (rec: RadarRecord) => {
    if (rec.created_version_id) {
      if (rec.kind === 'fee_change') {
        await db.fee_schedules.update(rec.created_version_id, { is_active: false });
      } else {
        await db.tax_policies.update(rec.created_version_id, { is_active: false });
      }
    }
    const updated = records.map((r) =>
      r.id === rec.id
        ? { ...r, status: 'pending' as const, created_version_id: undefined }
        : r
    );
    for (const r of updated) {
      await db.radar_records.put(r);
    }
    onRecordUpdated(updated);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Left: Document View with Highlighted Spans */}
      <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col h-[650px] overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-900 text-xs truncate max-w-xs">
              {document.title}
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Nguồn: {document.platform ?? 'Văn bản thuế'} | Tải lên:{' '}
              {formatDateVN(document.uploaded_at)}
            </p>
          </div>
          {document.source_url && (
            <a
              href={document.source_url}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:text-blue-800 p-1"
              title="Mở link gốc"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-[11px] font-semibold text-slate-600 mb-2">
              Văn bản gốc (Các đoạn trích dẫn được tô màu):
            </p>
            {renderHighlightedDocument()}
          </div>
        </div>

        {selectedRecord && (
          <div className="p-3 bg-blue-50/70 border-t border-blue-100 text-xs space-y-1">
            <span className="font-bold text-blue-900 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              Đoạn trích đang chọn:
            </span>
            <p className="font-mono text-[11px] text-blue-950 bg-white p-2 rounded border border-blue-200 italic">
              &quot;{selectedRecord.source_span.text}&quot;
            </p>
          </div>
        )}
      </div>

      {/* Right: Extracted Records Review Table */}
      <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col h-[650px] overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-900 text-xs">
              Bảng Thẩm Định & Phê Duyệt Thay Đổi ({records.length} mục)
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Quy tắc bất biến: Chỉ áp dụng khi có sự đồng ý của con người. Phiên bản mới không bao giờ ghi đè phiên bản cũ.
            </p>
          </div>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {records.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              Không tìm thấy thay đổi nào từ tài liệu này.
            </div>
          ) : (
            records.map((rec) => {
              const isSelected = rec.id === selectedRecordId;
              const isEditing = rec.id === editingRecordId;

              return (
                <div
                  key={rec.id}
                  onClick={() => setSelectedRecordId(rec.id)}
                  className={`p-4 rounded-xl border transition-all text-xs space-y-3 cursor-pointer ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/20 shadow-xs ring-1 ring-blue-500/30'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 capitalize">
                        {rec.kind === 'fee_change' ? `${rec.platform} - ${rec.field}` : `Thuế - ${rec.field}`}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                          rec.confidence >= 0.9
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        Tin cậy: {(rec.confidence * 100).toFixed(0)}%
                      </span>
                      {rec.status === 'approved' && (
                        <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-semibold">
                          Đã duyệt
                        </span>
                      )}
                      {rec.status === 'rejected' && (
                        <span className="text-[10px] bg-slate-300 text-slate-700 px-2 py-0.5 rounded font-semibold">
                          Đã từ chối
                        </span>
                      )}
                      {rec.status === 'edited' && (
                        <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-semibold">
                          Đã chỉnh sửa
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {rec.status === 'approved' ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUndo(rec);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 rounded-md hover:bg-slate-200"
                        >
                          <RotateCcw className="w-3 h-3" /> Hoàn tác
                        </button>
                      ) : (
                        <>
                          {!isEditing && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditing(rec);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-slate-600 hover:text-blue-600 rounded"
                              title="Sửa trực tiếp"
                            >
                              <Edit2 className="w-3 h-3" /> Sửa
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReject(rec);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 rounded-md"
                          >
                            <XCircle className="w-3 h-3" /> Từ chối
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApprove(rec);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-xs"
                          >
                            <CheckCircle className="w-3 h-3" /> Duyệt & Tạo Version
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Verification Issues Warning */}
                  {rec.needs_attention && rec.verification_message && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-[11px] text-amber-800">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>{rec.verification_message}</span>
                    </div>
                  )}

                  {/* Values View or Form */}
                  {isEditing ? (
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 text-xs">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-500">Giá trị cũ</label>
                          <input
                            type="number"
                            step="0.001"
                            value={editOldVal}
                            onChange={(e) => setEditOldVal(parseFloat(e.target.value) || 0)}
                            className="w-full p-1.5 border rounded bg-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500">Giá trị mới</label>
                          <input
                            type="number"
                            step="0.001"
                            value={editNewVal}
                            onChange={(e) => setEditNewVal(parseFloat(e.target.value) || 0)}
                            className="w-full p-1.5 border rounded bg-white font-mono font-bold text-blue-600"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500">Ngày hiệu lực</label>
                          <input
                            type="date"
                            value={editEffectiveDate}
                            onChange={(e) => setEditEffectiveDate(e.target.value)}
                            className="w-full p-1.5 border rounded bg-white"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingRecordId(null)}
                          className="px-2 py-1 text-slate-500 hover:text-slate-800"
                        >
                          Hủy
                        </button>
                        <button
                          type="button"
                          onClick={() => saveEditing(rec.id)}
                          className="px-3 py-1 bg-blue-600 text-white rounded font-semibold"
                        >
                          Lưu sửa đổi
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3 text-xs bg-slate-50/60 p-2.5 rounded-lg border border-slate-100">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Tỷ lệ / Giá trị cũ:</span>
                        <span className="font-mono text-slate-700">
                          {rec.old_value != null
                            ? rec.unit === 'percent'
                              ? formatPercent(rec.old_value)
                              : rec.unit === 'vnd'
                              ? formatVND(rec.old_value)
                              : `${rec.old_value} pp`
                            : '(Chưa xác định)'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Tỷ lệ / Giá trị mới:</span>
                        <span className="font-mono font-bold text-blue-700">
                          {rec.unit === 'percent'
                            ? formatPercent(rec.new_value)
                            : rec.unit === 'vnd'
                            ? formatVND(rec.new_value)
                            : `+${(rec.new_value * 100).toFixed(1)} pp`}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Ngày bắt đầu áp dụng:</span>
                        <span className="font-mono text-slate-700">{formatDateVN(rec.effective_date)}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

