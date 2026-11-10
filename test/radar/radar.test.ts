import { describe, it, expect } from 'vitest';
import { verifyRadarRecord } from '../../src/radar/verifier.ts';
import { RuleExtractor } from '../../src/radar/extractors/rule_extractor.ts';
import { MockExtractor } from '../../src/radar/extractors/mock_extractor.ts';
import { RadarDocument, RadarRecord, FeeSchedule, TaxPolicyVersion } from '../../src/engine/types.ts';

const mockDoc: RadarDocument = {
  id: 'DOC-01',
  type: 'platform_notice',
  platform: 'Shopee',
  title: 'Thông báo điều chỉnh biểu phí thanh toán Shopee năm 2024',
  raw_text:
    'Kính gửi Người Bán, từ ngày 01/07/2024, Shopee áp dụng điều chỉnh phí thanh toán từ 3.0% lên 4.0% cho toàn bộ các đơn hàng thành công.',
  uploaded_at: '2024-06-15',
};

const activeSchedules: FeeSchedule[] = [
  {
    id: 'FS-ACTIVE',
    platform: 'Shopee',
    category: '*',
    effective_from: '2024-01-01',
    commission_rate: 0.05,
    payment_rate: 0.03, // 3%
    service_rate: 0.02,
    program_rates: [],
    is_active: true,
    origin: 'manual',
  },
];

const activeTax: TaxPolicyVersion = {
  id: 'TAX-ACTIVE',
  effective_from: '2024-01-01',
  revenue_threshold: 1_000_000_000,
  tax_rates: [],
  boundary_rule: '<=',
  einvoice_required_above_threshold: true,
  compliance_cost_above_threshold: 10_000_000,
  source_note: 'Mặc định',
  origin: 'manual',
  is_active: true,
};

describe('Policy Radar Extraction & Verification Engine', () => {
  it('MockExtractor extracts fee change records from text', async () => {
    const extractor = new MockExtractor();
    const records = await extractor.extract(mockDoc, activeSchedules, activeTax);

    expect(records.length).toBeGreaterThan(0);
    expect(records[0].field).toBe('payment');
    expect(records[0].old_value).toBe(0.03);
    expect(records[0].new_value).toBe(0.04);
    expect(records[0].unit).toBe('percent');
    expect(mockDoc.raw_text).toContain(records[0].source_span.text);
  });

  it('RuleExtractor extracts Vietnamese fee hikes and dates', async () => {
    const extractor = new RuleExtractor();
    const records = await extractor.extract(mockDoc, activeSchedules, activeTax);

    expect(records.length).toBeGreaterThan(0);
    const rec = records[0];
    expect(rec.field).toBe('payment');
    expect(rec.old_value).toBe(0.03);
    expect(rec.new_value).toBe(0.04);
    expect(rec.effective_date).toBe('2024-07-01');
    expect(rec.source_span.start).toBeGreaterThanOrEqual(0);
    expect(mockDoc.raw_text.slice(rec.source_span.start, rec.source_span.end)).toBe(
      rec.source_span.text
    );
  });

  it('Verifier passes when source quote and values are strictly valid', () => {
    const quote = 'phí thanh toán từ 3.0% lên 4.0%';
    const start = mockDoc.raw_text.indexOf(quote);
    const end = start + quote.length;

    const record: RadarRecord = {
      id: 'REC-TEST-1',
      document_id: mockDoc.id,
      kind: 'fee_change',
      platform: 'Shopee',
      category: '*',
      field: 'payment',
      old_value: 0.03,
      new_value: 0.04,
      unit: 'percent',
      effective_date: '2024-07-01',
      source_span: { text: quote, start, end },
      confidence: 0.95,
      status: 'pending',
    };

    const res = verifyRadarRecord(record, mockDoc, activeSchedules, activeTax);
    expect(res.isValid).toBe(true);
    expect(res.issues.length).toBe(0);
    expect(res.record.needs_attention).toBe(false);
  });

  it('Verifier flags needs_attention if value does not appear in source quote', () => {
    const quote = 'toàn bộ các đơn hàng thành công.';
    const start = mockDoc.raw_text.indexOf(quote);
    const end = start + quote.length;

    const hallucinatedRecord: RadarRecord = {
      id: 'REC-HALLUCINATED',
      document_id: mockDoc.id,
      kind: 'fee_change',
      platform: 'Shopee',
      category: '*',
      field: 'payment',
      old_value: 0.03,
      new_value: 0.08, // 8% not anywhere in this span!
      unit: 'percent',
      effective_date: '2024-07-01',
      source_span: { text: quote, start, end },
      confidence: 0.9,
      status: 'pending',
    };

    const res = verifyRadarRecord(hallucinatedRecord, mockDoc, activeSchedules, activeTax);
    expect(res.isValid).toBe(false);
    expect(res.record.needs_attention).toBe(true);
    expect(res.issues.some((i) => i.includes('không xuất hiện trực tiếp'))).toBe(true);
  });

  it('Verifier flags mismatch if old_value differs from active platform schedule', () => {
    const quote = 'phí thanh toán từ 3.0% lên 4.0%';
    const start = mockDoc.raw_text.indexOf(quote);
    const end = start + quote.length;

    const mismatchedOldValueRecord: RadarRecord = {
      id: 'REC-MISMATCH',
      document_id: mockDoc.id,
      kind: 'fee_change',
      platform: 'Shopee',
      category: '*',
      field: 'payment',
      old_value: 0.015, // Claimed old was 1.5%, but active schedule is 3.0%
      new_value: 0.04,
      unit: 'percent',
      effective_date: '2024-07-01',
      source_span: { text: quote, start, end },
      confidence: 0.9,
      status: 'pending',
    };

    const res = verifyRadarRecord(mismatchedOldValueRecord, mockDoc, activeSchedules, activeTax);
    expect(res.record.needs_attention).toBe(true);
    expect(res.issues.some((i) => i.includes('Cảnh báo sai lệch tỷ lệ cũ'))).toBe(true);
  });
});

