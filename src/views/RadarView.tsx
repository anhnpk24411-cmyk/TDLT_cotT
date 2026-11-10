import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database.ts';
import {
  RadarDocument,
  RadarRecord,
  FeeSchedule,
  TaxPolicyVersion,
  Channel,
} from '../engine/types.ts';
import { RuleExtractor } from '../radar/extractors/rule_extractor.ts';
import { MockExtractor } from '../radar/extractors/mock_extractor.ts';
import { LlmExtractor } from '../radar/extractors/llm_extractor.ts';
import { verifyAllRadarRecords } from '../radar/verifier.ts';
import { evaluateRadarImpact, RadarImpactResult } from '../engine/radar_impact.ts';
import { DocumentSplitReview } from '../components/radar/DocumentSplitReview.tsx';
import { ImpactCard } from '../components/radar/ImpactCard.tsx';
import { RadarTimeline } from '../components/radar/RadarTimeline.tsx';
import { ApiKeySettingsModal } from '../components/radar/ApiKeySettingsModal.tsx';
import { LlmConfig } from '../radar/types.ts';
import {
  Radio,
  FileText,
  Settings,
  Sparkles,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

const SYNTHETIC_SAMPLE_NOTICES = [
  {
    title: '[SYNTHETIC] Thông báo Shopee điều chỉnh phí thanh toán từ 01/07/2024',
    platform: 'Shopee' as Channel,
    type: 'platform_notice' as const,
    text: `Kính gửi Quý Người Bán,
Nhằm duy trì chất lượng hệ thống thanh toán và nâng cấp trải nghiệm người mua, từ ngày 01/07/2024, Shopee áp dụng điều chỉnh phí thanh toán từ 3.0% lên 4.0% cho toàn bộ các đơn hàng thành công trên sàn Shopee Việt Nam.
Biểu phí cố định (5.0%) và phí dịch vụ (3.0%) vẫn giữ nguyên.
Trân trọng cảm ơn sự đồng hành của Quý Người Bán.`,
  },
  {
    title: '[SYNTHETIC] Dự thảo Nghị định điều chỉnh ngưỡng doanh thu tính thuế 2025',
    platform: undefined,
    type: 'tax_regulation' as const,
    text: `Dự thảo Nghị định quy định chi tiết về quản lý thuế đối với cá nhân kinh doanh thương mại điện tử:
Từ ngày 01/01/2025, điều chỉnh ngưỡng doanh thu tính thuế GTGT và TNCN từ 1 tỷ lên 2 tỷ đồng/năm.
Cá nhân kinh doanh có doanh thu trên 2 tỷ đồng/năm có trách nhiệm đăng ký và sử dụng hóa đơn điện tử khởi tạo từ máy tính tiền.`,
  },
];

export const RadarView: React.FC = () => {
  const documents = useLiveQuery(() => db.radar_documents.toArray(), []) ?? [];
  const storedRecords = useLiveQuery(() => db.radar_records.toArray(), []) ?? [];
  const feeSchedules = useLiveQuery(() => db.fee_schedules.toArray(), []) ?? [];
  const taxPolicies = useLiveQuery(() => db.tax_policies.toArray(), []) ?? [];
  const orders = useLiveQuery(() => db.orders.toArray(), []) ?? [];
  const products = useLiveQuery(() => db.products.toArray(), []) ?? [];
  const withholdings = useLiveQuery(() => db.withholding_records.toArray(), []) ?? [];

  const activeFeeSchedules = feeSchedules.filter((s: FeeSchedule) => s.is_active);
  const activeTaxPolicy = taxPolicies.find((p: TaxPolicyVersion) => p.is_active) ?? taxPolicies[0];

  // Selected document and current records
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [currentRecords, setCurrentRecords] = useState<RadarRecord[]>([]);

  // Input states
  const [inputTitle, setInputTitle] = useState('');
  const [inputPlatform, setInputPlatform] = useState<Channel>('Shopee');
  const [inputType, setInputType] = useState<'platform_notice' | 'tax_regulation'>('platform_notice');
  const [inputText, setInputText] = useState('');
  const [inputUrl, setInputUrl] = useState('');

  // Extractor choice
  const [extractorType, setExtractorType] = useState<'rule' | 'mock' | 'llm'>('rule');
  const [llmConfig, setLlmConfig] = useState<LlmConfig | null>(null);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  // Financial impact result
  const [impactResult, setImpactResult] = useState<RadarImpactResult | null>(null);
  const [publishedVersionTitle, setPublishedVersionTitle] = useState<string>('');

  // Load LLM setting
  useEffect(() => {
    db.settings.get('llm_config').then((s: any) => {
      if (s && s.value) setLlmConfig(s.value);
    });
  }, []);

  // Sync current records when document selection changes
  useEffect(() => {
    if (selectedDocId) {
      const recs = storedRecords.filter((r: RadarRecord) => r.document_id === selectedDocId);
      setCurrentRecords(recs);
    }
  }, [selectedDocId, storedRecords]);

  const activeDocument = documents.find((d: RadarDocument) => d.id === selectedDocId);

  const handleSelectSample = (sample: typeof SYNTHETIC_SAMPLE_NOTICES[0]) => {
    setInputTitle(sample.title);
    setInputType(sample.type);
    if (sample.platform) setInputPlatform(sample.platform);
    setInputText(sample.text);
  };

  const handleIngestAndExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) {
      alert('Vui lòng nhập nội dung văn bản thông báo.');
      return;
    }

    setIsExtracting(true);
    setExtractionError(null);

    const docId = `DOC-${Date.now()}`;
    const newDoc: RadarDocument = {
      id: docId,
      type: inputType,
      platform: inputType === 'platform_notice' ? inputPlatform : undefined,
      title: inputTitle.trim() || `Thông báo ngày ${new Date().toLocaleDateString('vi-VN')}`,
      raw_text: inputText.trim(),
      uploaded_at: new Date().toISOString(),
      source_url: inputUrl.trim() || undefined,
    };

    try {
      await db.radar_documents.add(newDoc);

      // 1. Run extractor
      let extractor: RuleExtractor | MockExtractor | LlmExtractor;
      if (extractorType === 'llm') {
        if (!llmConfig || !llmConfig.apiKey) {
          setIsApiKeyModalOpen(true);
          throw new Error('Chưa có API Key. Vui lòng nhập API Key để sử dụng LlmExtractor.');
        }
        extractor = new LlmExtractor(llmConfig);
      } else if (extractorType === 'mock') {
        extractor = new MockExtractor();
      } else {
        extractor = new RuleExtractor();
      }

      const rawExtracted = await extractor.extract(newDoc, activeFeeSchedules, activeTaxPolicy);

      // 2. Run deterministic verification
      const verifiedRecords = verifyAllRadarRecords(
        rawExtracted,
        newDoc,
        activeFeeSchedules,
        activeTaxPolicy
      );

      // 3. Save records to IndexedDB
      for (const rec of verifiedRecords) {
        await db.radar_records.put(rec);
      }

      setSelectedDocId(docId);
      setCurrentRecords(verifiedRecords);
      setInputText('');
      setInputTitle('');
      setInputUrl('');
    } catch (err: any) {
      setExtractionError(err.message || 'Lỗi trích xuất thông báo.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleVersionPublished = (newSchedule?: FeeSchedule, newPolicy?: TaxPolicyVersion) => {
    if (orders.length === 0) return;

    // Evaluate radar impact
    const updatedSchedules = newSchedule
      ? [
          ...activeFeeSchedules.filter((s: FeeSchedule) => s.platform !== newSchedule.platform),
          newSchedule,
        ]
      : activeFeeSchedules;

    const updatedTaxPolicy = newPolicy || activeTaxPolicy;

    const impact = evaluateRadarImpact(
      orders,
      products,
      activeFeeSchedules,
      updatedSchedules,
      activeTaxPolicy,
      updatedTaxPolicy,
      withholdings
    );

    setImpactResult(impact);
    setPublishedVersionTitle(
      newSchedule
        ? `Cập nhật biểu phí sàn ${newSchedule.platform} (${newSchedule.id})`
        : `Cập nhật chính sách thuế mới (${newPolicy?.id})`
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Radio className="w-6 h-6 text-purple-600 animate-pulse" />
            Policy Radar (Trích Xuất Thông Báo & Duyệt Chính Sách Bán Hàng)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Tiếp nhận văn bản phí sàn hoặc quy định thuế, tự động trích xuất có trích dẫn nguồn, người bán duyệt để tạo phiên bản và xem ngay tác động tài chính.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsApiKeyModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 shadow-xs cursor-pointer"
        >
          <Settings className="w-3.5 h-3.5 text-purple-600" />
          Cài đặt API Key LLM
        </button>
      </div>

      {/* Impact Card if published */}
      {impactResult && (
        <ImpactCard impact={impactResult} publishedVersionTitle={publishedVersionTitle} />
      )}

      {/* Document Ingestion Form */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              Nạp Văn Bản / Thông Báo Mới (Document Ingestion)
            </h3>
            <p className="text-xs text-slate-500">
              Dán văn bản thông báo phí từ sàn hoặc quy định thuế mới để trích xuất.
            </p>
          </div>

          {/* Sample Notices Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Mẫu thử nghiệm:</span>
            <div className="flex gap-1.5">
              {SYNTHETIC_SAMPLE_NOTICES.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectSample(s)}
                  className="px-2.5 py-1 text-[11px] rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer font-medium"
                >
                  {s.platform || 'Thuế 2025'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={handleIngestAndExtract} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Tiêu đề tài liệu / thông báo
              </label>
              <input
                type="text"
                value={inputTitle}
                onChange={(e) => setInputTitle(e.target.value)}
                placeholder="Ví dụ: Thông báo điều chỉnh phí thanh toán Shopee T7/2024"
                required
                className="w-full bg-white border border-slate-300 rounded-lg p-2"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Loại văn bản
              </label>
              <select
                value={inputType}
                onChange={(e) => setInputType(e.target.value as any)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2"
              >
                <option value="platform_notice">Thông báo sàn TMĐT</option>
                <option value="tax_regulation">Quy định chính sách thuế</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Sàn áp dụng
              </label>
              <select
                value={inputPlatform}
                onChange={(e) => setInputPlatform(e.target.value as Channel)}
                disabled={inputType === 'tax_regulation'}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 disabled:bg-slate-100"
              >
                <option value="Shopee">Shopee</option>
                <option value="TikTok Shop">TikTok Shop</option>
                <option value="Lazada">Lazada</option>
                <option value="Other">Khác</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Nội dung văn bản (Dán toàn văn bản thông báo)
            </label>
            <textarea
              rows={4}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Dán toàn bộ nội dung thông báo phí hoặc luật thuế vào đây..."
              required
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-sans"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            {/* Extractor Engine Picker */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-600">Bộ trích xuất (Extractor):</span>
              <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setExtractorType('rule')}
                  className={`px-3 py-1 rounded-md font-semibold cursor-pointer ${
                    extractorType === 'rule'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Rule-based (Regex VN - Offline)
                </button>
                <button
                  type="button"
                  onClick={() => setExtractorType('mock')}
                  className={`px-3 py-1 rounded-md font-semibold cursor-pointer ${
                    extractorType === 'mock'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Mock Demo
                </button>
                <button
                  type="button"
                  onClick={() => setExtractorType('llm')}
                  className={`px-3 py-1 rounded-md font-semibold cursor-pointer flex items-center gap-1 ${
                    extractorType === 'llm'
                      ? 'bg-white text-purple-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="w-3 h-3 text-purple-600" />
                  LLM AI (Claude/Gemini/OpenAI)
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isExtracting}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isExtracting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Đang phân tích văn bản...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Nạp & Trích xuất tự động
                </>
              )}
            </button>
          </div>
        </form>

        {extractionError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{extractionError}</span>
          </div>
        )}
      </div>

      {/* Split Review Workspace */}
      {activeDocument && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              Khu Vực Duyệt Trích Xuất (Split-Review Workspace)
            </h3>
            <span className="text-xs text-slate-500">
              Văn bản đang chọn: <strong className="text-slate-800">{activeDocument.title}</strong>
            </span>
          </div>

          <DocumentSplitReview
            document={activeDocument}
            records={currentRecords}
            activeFeeSchedules={activeFeeSchedules}
            activeTaxPolicy={activeTaxPolicy}
            onRecordUpdated={(updated: RadarRecord[]) => setCurrentRecords(updated)}
            onVersionPublished={handleVersionPublished}
          />
        </div>
      )}

      {/* Radar Timeline */}
      <RadarTimeline />

      {/* API Key Modal */}
      <ApiKeySettingsModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onSaved={(cfg: LlmConfig) => setLlmConfig(cfg)}
      />
    </div>
  );
};
