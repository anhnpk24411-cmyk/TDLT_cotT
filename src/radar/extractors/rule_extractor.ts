import { Extractor } from '../types.ts';
import { RadarDocument, RadarRecord, FeeSchedule, TaxPolicyVersion, Channel, RadarRecordField } from '../../engine/types.ts';

export class RuleExtractor implements Extractor {
  id = 'rule';
  name = 'Rule-based Extractor (Tiếng Việt Regex)';

  async extract(
    doc: RadarDocument,
    _activeFeeSchedules: FeeSchedule[],
    _activeTaxPolicy?: TaxPolicyVersion
  ): Promise<RadarRecord[]> {
    const rawText = doc.raw_text;
    const records: RadarRecord[] = [];

    // Helper to find effective date in text or surrounding sentences
    const findEffectiveDate = (contextText: string): string => {
      // Patterns: dd/mm/yyyy or dd-mm-yyyy or "ngày dd tháng mm năm yyyy"
      const slashDate = contextText.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (slashDate) {
        const day = slashDate[1].padStart(2, '0');
        const month = slashDate[2].padStart(2, '0');
        const year = slashDate[3];
        return `${year}-${month}-${day}`;
      }

      const vnDate = contextText.match(/ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})/i);
      if (vnDate) {
        const day = vnDate[1].padStart(2, '0');
        const month = vnDate[2].padStart(2, '0');
        const year = vnDate[3];
        return `${year}-${month}-${day}`;
      }

      // Default to next month's 1st day if not found
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      d.setDate(1);
      return d.toISOString().slice(0, 10);
    };

    const docDefaultDate = findEffectiveDate(rawText);

    // Detect platform if not set
    let platform: Channel | undefined = doc.platform;
    if (!platform) {
      const lower = rawText.toLowerCase();
      if (lower.includes('shopee')) platform = 'Shopee';
      else if (lower.includes('tiktok')) platform = 'TikTok Shop';
      else if (lower.includes('lazada')) platform = 'Lazada';
    }

    // Pattern 1: Fee hike: "tăng từ X% lên Y%" or "điều chỉnh phí thanh toán từ X% lên Y%" or "phí... tăng từ X% lên Y%"
    const feeHikeRegex =
      /(?:(phí thanh toán|phí cố định|hoa hồng|phí dịch vụ|phí sàn)[\s\w,.-]{0,40}(?:tăng|điều chỉnh)|(?:tăng|điều chỉnh)[\s\w,.-]{0,40}(phí thanh toán|phí cố định|hoa hồng|phí dịch vụ|phí sàn)|(?:tăng|điều chỉnh))\s+(?:từ\s+)?(\d+[.,]?\d*)\s*%\s*(?:lên|thành)\s*(\d+[.,]?\d*)\s*%(?:[\s\w,.-]{0,50}(?:áp dụng\s+)?từ\s+(?:ngày\s+)?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}))?/gi;

    let match: RegExpExecArray | null;
    let index = 0;

    while ((match = feeHikeRegex.exec(rawText)) !== null) {
      index++;
      const spanText = match[0];
      const fieldPhrase = (match[1] || match[2] || '').toLowerCase();
      let field: RadarRecordField = 'commission';

      if (fieldPhrase.includes('thanh toán')) field = 'payment';
      else if (fieldPhrase.includes('dịch vụ')) field = 'service';
      else if (fieldPhrase.includes('cố định') || fieldPhrase.includes('hoa hồng')) field = 'commission';

      const oldVal = parseFloat(match[3].replace(',', '.')) / 100;
      const newVal = parseFloat(match[4].replace(',', '.')) / 100;

      let effectiveDate = docDefaultDate;
      if (match[5]) {
        const parts = match[5].split(/[\/\-]/);
        effectiveDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }

      records.push({
        id: `RULE-FEE-${Date.now()}-${index}`,
        document_id: doc.id,
        kind: 'fee_change',
        platform: platform ?? 'Shopee',
        category: '*',
        field,
        old_value: oldVal,
        new_value: newVal,
        unit: 'percent',
        effective_date: effectiveDate,
        source_span: {
          text: spanText,
          start: match.index,
          end: match.index + spanText.length,
        },
        confidence: 0.88,
        status: 'pending',
      });
    }

    // Pattern 2: Single rate adjustment: "phí thanh toán áp dụng X%" or "mức phí cố định mới là X%"
    const singleFeeRegex =
      /(phí thanh toán|phí cố định|hoa hồng|phí dịch vụ)\s+(?:mới\s+)?(?:là|áp dụng|mức)\s+(\d+[.,]?\d*)\s*%/gi;

    while ((match = singleFeeRegex.exec(rawText)) !== null) {
      // avoid duplicate if already matched by hike regex
      const start = match.index;
      if (records.some((r) => Math.abs(r.source_span.start - start) < 30)) {
        continue;
      }

      index++;
      const spanText = match[0];
      const fieldPhrase = match[1].toLowerCase();
      let field: RadarRecordField = 'commission';
      if (fieldPhrase.includes('thanh toán')) field = 'payment';
      else if (fieldPhrase.includes('dịch vụ')) field = 'service';

      const newVal = parseFloat(match[2].replace(',', '.')) / 100;

      records.push({
        id: `RULE-FEE-${Date.now()}-${index}`,
        document_id: doc.id,
        kind: 'fee_change',
        platform: platform ?? 'Shopee',
        category: '*',
        field,
        old_value: null,
        new_value: newVal,
        unit: 'percent',
        effective_date: docDefaultDate,
        source_span: {
          text: spanText,
          start: match.index,
          end: match.index + spanText.length,
        },
        confidence: 0.82,
        status: 'pending',
      });
    }

    // Pattern 3: Tax threshold changes: "ngưỡng doanh thu ... X tỷ / triệu"
    const taxThresholdRegex =
      /(?:ngưỡng doanh thu|doanh thu chịu thuế)[\s\w,.-]{0,30}(?:từ|trên|mức)\s+(\d+)\s*(tỷ|triệu|đồng)(?:[\s\w,.-]{0,20}(?:lên|thành)\s+(\d+)\s*(tỷ|triệu|đồng))?/gi;

    while ((match = taxThresholdRegex.exec(rawText)) !== null) {
      index++;
      const spanText = match[0];
      const num1 = parseFloat(match[1]);
      const unit1 = match[2].toLowerCase();
      const mult1 = unit1 === 'tỷ' ? 1_000_000_000 : unit1 === 'triệu' ? 1_000_000 : 1;

      let oldVal: number | null = null;
      let newVal = num1 * mult1;

      if (match[3] && match[4]) {
        // "từ X lên Y"
        oldVal = num1 * mult1;
        const num2 = parseFloat(match[3]);
        const mult2 = match[4].toLowerCase() === 'tỷ' ? 1_000_000_000 : match[4].toLowerCase() === 'triệu' ? 1_000_000 : 1;
        newVal = num2 * mult2;
      }

      records.push({
        id: `RULE-TAX-${Date.now()}-${index}`,
        document_id: doc.id,
        kind: 'tax_change',
        field: 'threshold',
        old_value: oldVal,
        new_value: newVal,
        unit: 'vnd',
        effective_date: docDefaultDate,
        source_span: {
          text: spanText,
          start: match.index,
          end: match.index + spanText.length,
        },
        confidence: 0.85,
        status: 'pending',
      });
    }

    return records;
  }
}
