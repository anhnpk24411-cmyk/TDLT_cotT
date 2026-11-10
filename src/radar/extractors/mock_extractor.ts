import { Extractor } from '../types.ts';
import { RadarDocument, RadarRecord, FeeSchedule, TaxPolicyVersion } from '../../engine/types.ts';

export class MockExtractor implements Extractor {
  id = 'mock';
  name = 'Mock Extractor (Test/Offline Demo)';

  async extract(
    doc: RadarDocument,
    _activeFeeSchedules: FeeSchedule[],
    _activeTaxPolicy?: TaxPolicyVersion
  ): Promise<RadarRecord[]> {
    const text = doc.raw_text;
    const records: RadarRecord[] = [];

    // Check for Shopee payment fee pattern
    const shopeePaymentPattern = /phí thanh toán.*?(tăng từ|từ)\s*(\d+[.,]?\d*)\s*%\s*(lên|thành)\s*(\d+[.,]?\d*)\s*%/i;
    const matchShopee = text.match(shopeePaymentPattern);

    if (matchShopee && matchShopee.index !== undefined) {
      const spanText = matchShopee[0];
      const oldVal = parseFloat(matchShopee[2].replace(',', '.')) / 100;
      const newVal = parseFloat(matchShopee[4].replace(',', '.')) / 100;

      records.push({
        id: `REC-${Date.now()}-1`,
        document_id: doc.id,
        kind: 'fee_change',
        platform: doc.platform ?? 'Shopee',
        category: '*',
        field: 'payment',
        old_value: oldVal,
        new_value: newVal,
        unit: 'percent',
        effective_date: '2024-07-01',
        source_span: {
          text: spanText,
          start: matchShopee.index,
          end: matchShopee.index + spanText.length,
        },
        confidence: 0.95,
        status: 'pending',
      });
    }

    // Check for tax threshold pattern
    const taxPattern = /ngưỡng doanh thu.*?(tăng từ|từ)\s*(\d+)\s*(tỷ|triệu).*?(lên|thành)\s*(\d+)\s*(tỷ|triệu)/i;
    const matchTax = text.match(taxPattern);

    if (matchTax && matchTax.index !== undefined) {
      const spanText = matchTax[0];
      const oldMultiplier = matchTax[3].toLowerCase() === 'tỷ' ? 1_000_000_000 : 1_000_000;
      const newMultiplier = matchTax[6].toLowerCase() === 'tỷ' ? 1_000_000_000 : 1_000_000;
      const oldVal = parseFloat(matchTax[2]) * oldMultiplier;
      const newVal = parseFloat(matchTax[5]) * newMultiplier;

      records.push({
        id: `REC-${Date.now()}-2`,
        document_id: doc.id,
        kind: 'tax_change',
        field: 'threshold',
        old_value: oldVal,
        new_value: newVal,
        unit: 'vnd',
        effective_date: '2025-01-01',
        source_span: {
          text: spanText,
          start: matchTax.index,
          end: matchTax.index + spanText.length,
        },
        confidence: 0.92,
        status: 'pending',
      });
    }

    return records;
  }
}

