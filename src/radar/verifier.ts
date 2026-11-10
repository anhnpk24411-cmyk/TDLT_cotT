import { RadarRecord, RadarDocument, FeeSchedule, TaxPolicyVersion } from '../engine/types.ts';

export interface VerificationResult {
  record: RadarRecord;
  isValid: boolean;
  issues: string[];
}

/**
 * Deterministic verifier ensuring strict traceability back to document source quotes.
 */
export function verifyRadarRecord(
  record: RadarRecord,
  document: RadarDocument,
  activeFeeSchedules: FeeSchedule[],
  activeTaxPolicy?: TaxPolicyVersion
): VerificationResult {
  const issues: string[] = [];
  const rawText = document.raw_text;

  // 1. Check source span verbatim existence in raw document
  const { text: spanText, start, end } = record.source_span;

  if (start < 0 || end > rawText.length || start >= end) {
    // Attempt re-locating the span text in raw text
    const reLocateIndex = rawText.indexOf(spanText);
    if (reLocateIndex !== -1) {
      record.source_span.start = reLocateIndex;
      record.source_span.end = reLocateIndex + spanText.length;
    } else {
      issues.push(`Đoạn trích nguồn không tồn tại nguyên văn trong tài liệu gốc.`);
    }
  } else {
    const actualSubstr = rawText.slice(start, end);
    if (actualSubstr !== spanText) {
      // Offset mismatch: search and fix if verbatim text exists
      const exactIndex = rawText.indexOf(spanText);
      if (exactIndex !== -1) {
        record.source_span.start = exactIndex;
        record.source_span.end = exactIndex + spanText.length;
      } else {
        issues.push(`Đoạn trích (offsets [${start}, ${end}]) không khớp nguyên văn với văn bản gốc.`);
      }
    }
  }

  // 2. Check that the extracted value (new_value) appears in source_span.text
  // Unit could be percent (e.g. 0.05 -> "5" or "5%"), pp, or vnd
  const spanLower = record.source_span.text.toLowerCase();
  let valueFoundInSpan = false;

  if (record.unit === 'percent' || record.unit === 'pp') {
    const valPercent = Math.round(record.new_value * 100 * 100) / 100; // e.g. 5 or 5.5
    const valPercentStr = valPercent.toString();
    const valWithComma = valPercentStr.replace('.', ',');
    if (spanLower.includes(valPercentStr) || spanLower.includes(valWithComma)) {
      valueFoundInSpan = true;
    }
  } else if (record.unit === 'vnd') {
    const vndStr = Math.round(record.new_value).toString();
    const vndMillions = (record.new_value / 1_000_000).toString();
    const vndBillions = (record.new_value / 1_000_000_000).toString();
    if (
      spanLower.includes(vndStr) ||
      spanLower.includes(vndMillions) ||
      spanLower.includes(vndBillions) ||
      spanLower.includes('tỷ') ||
      spanLower.includes('triệu')
    ) {
      valueFoundInSpan = true;
    }
  }

  if (!valueFoundInSpan) {
    issues.push(`Giá trị mới (${record.new_value}) không xuất hiện trực tiếp trong đoạn trích nguồn.`);
  }

  // 3. Date parsing & plausibility check
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(record.effective_date)) {
    issues.push(`Ngày hiệu lực (${record.effective_date}) không đúng định dạng chuẩn YYYY-MM-DD.`);
  } else {
    const parsedYear = parseInt(record.effective_date.slice(0, 4), 10);
    if (isNaN(parsedYear) || parsedYear < 2020 || parsedYear > 2035) {
      issues.push(`Năm áp dụng (${parsedYear}) bất hợp lý (chỉ chấp nhận từ 2020 đến 2035).`);
    }
  }

  // 4. Check old_value against active versions
  if (record.kind === 'fee_change' && record.platform) {
    const activeSchedule = activeFeeSchedules.find(
      (s) => s.is_active && s.platform === record.platform
    );

    if (activeSchedule && record.old_value != null) {
      let currentVal: number | undefined;
      if (record.field === 'commission') currentVal = activeSchedule.commission_rate;
      else if (record.field === 'payment') currentVal = activeSchedule.payment_rate;
      else if (record.field === 'service') currentVal = activeSchedule.service_rate;

      if (currentVal != null && Math.abs(currentVal - record.old_value) > 0.0001) {
        issues.push(
          `Cảnh báo sai lệch tỷ lệ cũ: Giá trị cũ trích xuất (${(record.old_value * 100).toFixed(
            1
          )}%) không khớp với biểu phí hiện tại của ${record.platform} (${(currentVal * 100).toFixed(
            1
          )}%).`
        );
      }
    }
  } else if (record.kind === 'tax_change' && activeTaxPolicy && record.old_value != null) {
    if (
      record.field === 'threshold' &&
      Math.abs(activeTaxPolicy.revenue_threshold - record.old_value) > 100
    ) {
      issues.push(
        `Cảnh báo sai lệch ngưỡng cũ: Ngưỡng trích xuất (${record.old_value.toLocaleString(
          'vi-VN'
        )}đ) khác ngưỡng hiện hành (${activeTaxPolicy.revenue_threshold.toLocaleString('vi-VN')}đ).`
      );
    }
  }

  const isValid = issues.length === 0;
  record.needs_attention = !isValid;
  record.verification_message = issues.length > 0 ? issues.join(' | ') : undefined;

  return {
    record,
    isValid,
    issues,
  };
}

/**
 * Verifies a collection of extracted radar records against document.
 */
export function verifyAllRadarRecords(
  records: RadarRecord[],
  document: RadarDocument,
  activeFeeSchedules: FeeSchedule[],
  activeTaxPolicy?: TaxPolicyVersion
): RadarRecord[] {
  return records.map((rec) => {
    const { record } = verifyRadarRecord(rec, document, activeFeeSchedules, activeTaxPolicy);
    return record;
  });
}

