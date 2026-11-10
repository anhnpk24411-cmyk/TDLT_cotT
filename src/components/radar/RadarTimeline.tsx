import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database.ts';
import { formatDateVN } from '../../utils/formatters.ts';
import { Radio, CheckCircle, Clock } from 'lucide-react';

export const RadarTimeline: React.FC = () => {
  const documents = useLiveQuery(() => db.radar_documents.reverse().toArray(), []) ?? [];
  const radarRecords = useLiveQuery(() => db.radar_records.toArray(), []) ?? [];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <Radio className="w-5 h-5 text-purple-600" />
        <div>
          <h3 className="font-bold text-slate-800 text-sm">Dòng Thời Gian Radar (Policy Timeline)</h3>
          <p className="text-xs text-slate-500">
            Lịch sử tiếp nhận thông báo, trích xuất chính sách và các phiên bản đã được phê duyệt.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {documents.length === 0 ? (
          <p className="text-center text-xs text-slate-400 py-6">
            Chưa có thông báo nào được nạp vào Policy Radar.
          </p>
        ) : (
          documents.map((doc) => {
            const docRecords = radarRecords.filter((r) => r.document_id === doc.id);
            const approvedCount = docRecords.filter((r) => r.status === 'approved').length;

            return (
              <div
                key={doc.id}
                className="relative pl-6 pb-4 border-l-2 border-slate-200 last:border-l-0 last:pb-0"
              >
                <div className="absolute -left-2 top-0.5 w-3.5 h-3.5 bg-blue-600 rounded-full border-2 border-white ring-2 ring-blue-100" />
                <div className="text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-slate-500">
                      {formatDateVN(doc.uploaded_at)}
                    </span>
                    <span className="bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded text-[10px]">
                      {doc.platform ?? 'Văn bản thuế'}
                    </span>
                    <span className="text-slate-400">&bull;</span>
                    <span className="text-slate-600 font-medium">
                      {approvedCount}/{docRecords.length} mục đã duyệt
                    </span>
                  </div>

                  <p className="font-bold text-slate-900 text-sm">{doc.title}</p>

                  {docRecords.length > 0 && (
                    <div className="pt-1.5 flex flex-wrap gap-2">
                      {docRecords.map((r) => (
                        <span
                          key={r.id}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono ${
                            r.status === 'approved'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {r.status === 'approved' ? (
                            <CheckCircle className="w-2.5 h-2.5 text-emerald-600" />
                          ) : (
                            <Clock className="w-2.5 h-2.5 text-slate-400" />
                          )}
                          {r.field}:{' '}
                          {r.unit === 'percent'
                            ? `${((r.old_value ?? 0) * 100).toFixed(1)}% -> ${(
                                r.new_value * 100
                              ).toFixed(1)}%`
                            : `+${(r.new_value * 100).toFixed(1)}pp`}
                        </span>
                      ))}
                    </div>
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
