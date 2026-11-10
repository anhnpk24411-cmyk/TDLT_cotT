import { RadarRecordField, Channel, RadarDocument } from './types.ts';
import { Extractor } from '../radar/types.ts';
import { verifyAllRadarRecords } from '../radar/verifier.ts';

export interface GoldStandardItem {
  field: RadarRecordField;
  new_value: number;
  unit: 'percent' | 'pp' | 'vnd';
  effective_date: string;
}

export interface GoldStandardNotice {
  id: string;
  title: string;
  rawText: string;
  platform?: Channel;
  type: 'platform_notice' | 'tax_regulation';
  groundTruth: GoldStandardItem[];
}

export interface FieldBenchmarkMetric {
  field: string;
  groundTruthCount: number;
  extractedCount: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface ExtractorBenchmarkResult {
  extractorId: string;
  extractorName: string;
  totalNoticesEvaluated: number;
  totalExecutionTimeMs: number;
  avgTimePerNoticeMs: number;
  overallPrecision: number;
  overallRecall: number;
  overallF1: number;
  manualEditShare: number; // Share of records flagged with needs_attention
  byField: Record<string, FieldBenchmarkMetric>;
}

export const SYNTHETIC_GOLD_DATASET: GoldStandardNotice[] = [
  {
    id: 'GOLD-01',
    title: '[SYNTHETIC] Thông báo Shopee điều chỉnh phí thanh toán',
    platform: 'Shopee',
    type: 'platform_notice',
    rawText:
      'Kính gửi Người Bán, từ ngày 01/07/2024, Shopee áp dụng điều chỉnh phí thanh toán từ 3.0% lên 4.0% cho các đơn hàng hoàn tất.',
    groundTruth: [
      {
        field: 'payment',
        new_value: 0.04,
        unit: 'percent',
        effective_date: '2024-07-01',
      },
    ],
  },
  {
    id: 'GOLD-02',
    title: '[SYNTHETIC] TikTok Shop cập nhật phí hoa hồng cố định',
    platform: 'TikTok Shop',
    type: 'platform_notice',
    rawText:
      'TikTok Shop trân trọng thông báo: từ ngày 15/08/2024, mức phí hoa hồng cố định mới là 5.0% áp dụng cho nhà bán hàng toàn quốc.',
    groundTruth: [
      {
        field: 'commission',
        new_value: 0.05,
        unit: 'percent',
        effective_date: '2024-08-15',
      },
    ],
  },
  {
    id: 'GOLD-03',
    title: '[SYNTHETIC] Lazada tăng phí dịch vụ Freeship',
    platform: 'Lazada',
    type: 'platform_notice',
    rawText:
      'Lazada Việt Nam thông báo: từ ngày 01/09/2024, phí dịch vụ sẽ tăng từ 2.5% lên 3.5% đối với các đơn hàng áp dụng gói Freeship Max.',
    groundTruth: [
      {
        field: 'service',
        new_value: 0.035,
        unit: 'percent',
        effective_date: '2024-09-01',
      },
    ],
  },
  {
    id: 'GOLD-04',
    title: '[SYNTHETIC] Dự thảo nâng ngưỡng thuế TMĐT',
    type: 'tax_regulation',
    rawText:
      'Dự thảo sửa đổi Luật Thuế: Từ ngày 01/01/2025, ngưỡng doanh thu chịu thuế GTGT và TNCN sẽ tăng từ 1 tỷ lên 2 tỷ đồng/năm.',
    groundTruth: [
      {
        field: 'threshold',
        new_value: 2_000_000_000,
        unit: 'vnd',
        effective_date: '2025-01-01',
      },
    ],
  },
  {
    id: 'GOLD-05',
    title: '[SYNTHETIC] Thông báo Shopee điều chỉnh phí cố định',
    platform: 'Shopee',
    type: 'platform_notice',
    rawText:
      'Shopee thông báo từ ngày 01/10/2024, mức phí cố định sẽ điều chỉnh từ 4.0% lên 6.0% cho toàn bộ các gian hàng thường.',
    groundTruth: [
      {
        field: 'commission',
        new_value: 0.06,
        unit: 'percent',
        effective_date: '2024-10-01',
      },
    ],
  },
];

/**
 * Runs automated evaluation benchmark over a set of gold standard labeled notices.
 */
export async function runRadarBenchmark(
  extractor: Extractor,
  dataset: GoldStandardNotice[] = SYNTHETIC_GOLD_DATASET
): Promise<ExtractorBenchmarkResult> {
  const startTime = performance.now();
  let totalExtractedRecords = 0;
  let totalNeedsAttentionRecords = 0;

  const fieldStats: Record<
    string,
    { gt: number; ext: number; tp: number; fp: number; fn: number }
  > = {};

  const getStats = (field: string) => {
    if (!fieldStats[field]) {
      fieldStats[field] = { gt: 0, ext: 0, tp: 0, fp: 0, fn: 0 };
    }
    return fieldStats[field];
  };

  for (const notice of dataset) {
    const doc: RadarDocument = {
      id: notice.id,
      type: notice.type,
      platform: notice.platform,
      title: notice.title,
      raw_text: notice.rawText,
      uploaded_at: new Date().toISOString(),
    };

    // Register ground truth counts
    for (const gt of notice.groundTruth) {
      getStats(gt.field).gt++;
    }

    // Run extractor
    const extracted = await extractor.extract(doc, [], undefined);
    const verified = verifyAllRadarRecords(extracted, doc, [], undefined);

    totalExtractedRecords += verified.length;
    totalNeedsAttentionRecords += verified.filter((r) => r.needs_attention).length;

    // Match extracted against ground truth
    const matchedGtIndices = new Set<number>();

    for (const ext of verified) {
      const stats = getStats(ext.field);
      stats.ext++;

      let matchedIndex = -1;
      for (let i = 0; i < notice.groundTruth.length; i++) {
        if (matchedGtIndices.has(i)) continue;
        const gt = notice.groundTruth[i];

        if (gt.field === ext.field) {
          // Check value match
          const valDiff = Math.abs(gt.new_value - ext.new_value);
          const tolerance = ext.unit === 'vnd' ? 1000 : 0.005;

          if (valDiff <= tolerance) {
            matchedIndex = i;
            break;
          }
        }
      }

      if (matchedIndex !== -1) {
        matchedGtIndices.add(matchedIndex);
        stats.tp++;
      } else {
        stats.fp++;
      }
    }

    // Remaining ground truths not matched are false negatives
    for (let i = 0; i < notice.groundTruth.length; i++) {
      if (!matchedGtIndices.has(i)) {
        getStats(notice.groundTruth[i].field).fn++;
      }
    }
  }

  const totalExecutionTimeMs = Math.round(performance.now() - startTime);

  // Compute metrics per field
  let totalTp = 0;
  let totalFp = 0;
  let totalFn = 0;
  const byField: Record<string, FieldBenchmarkMetric> = {};

  for (const [f, s] of Object.entries(fieldStats)) {
    totalTp += s.tp;
    totalFp += s.fp;
    totalFn += s.fn;

    const precision = s.tp + s.fp > 0 ? s.tp / (s.tp + s.fp) : 0;
    const recall = s.tp + s.fn > 0 ? s.tp / (s.tp + s.fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    byField[f] = {
      field: f,
      groundTruthCount: s.gt,
      extractedCount: s.ext,
      truePositives: s.tp,
      falsePositives: s.fp,
      falseNegatives: s.fn,
      precision: Number((precision * 100).toFixed(1)),
      recall: Number((recall * 100).toFixed(1)),
      f1: Number((f1 * 100).toFixed(1)),
    };
  }

  const overallPrecision = totalTp + totalFp > 0 ? totalTp / (totalTp + totalFp) : 0;
  const overallRecall = totalTp + totalFn > 0 ? totalTp / (totalTp + totalFn) : 0;
  const overallF1 =
    overallPrecision + overallRecall > 0
      ? (2 * overallPrecision * overallRecall) / (overallPrecision + overallRecall)
      : 0;

  const manualEditShare =
    totalExtractedRecords > 0 ? totalNeedsAttentionRecords / totalExtractedRecords : 0;

  return {
    extractorId: extractor.id,
    extractorName: extractor.name,
    totalNoticesEvaluated: dataset.length,
    totalExecutionTimeMs,
    avgTimePerNoticeMs: Math.round(totalExecutionTimeMs / dataset.length),
    overallPrecision: Number((overallPrecision * 100).toFixed(1)),
    overallRecall: Number((overallRecall * 100).toFixed(1)),
    overallF1: Number((overallF1 * 100).toFixed(1)),
    manualEditShare: Number((manualEditShare * 100).toFixed(1)),
    byField,
  };
}

/**
 * Generates CSV string for benchmark comparison.
 */
export function exportBenchmarkCsv(results: ExtractorBenchmarkResult[]): string {
  const headers = [
    'Bo_trich_xuat',
    'So_van_ban_danh_gia',
    'Thoi_gian_tb_ms',
    'Precision_pct',
    'Recall_pct',
    'F1_Score_pct',
    'Ty_le_can_sua_thu_cong_pct',
  ];

  const rows = results.map((r) => [
    `"${r.extractorName}"`,
    r.totalNoticesEvaluated,
    r.avgTimePerNoticeMs,
    r.overallPrecision,
    r.overallRecall,
    r.overallF1,
    r.manualEditShare,
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

