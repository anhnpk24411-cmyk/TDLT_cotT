import { describe, it, expect } from 'vitest';
import {
  parseRawCsv,
  guessColumnMapping,
  parseAndValidateOrders,
  generateCsvTemplate,
} from '../../src/utils/csv_parser.ts';

describe('CSV Parser and Validator', () => {
  it('generates standard CSV template with valid headers', () => {
    const template = generateCsvTemplate();
    expect(template).toContain('Ngay_don');
    expect(template).toContain('Kenh_ban');
    expect(template).toContain('Ma_SKU');
  });

  it('parses raw CSV text with comma and semicolon delimiters', () => {
    const commaCsv = 'A,B,C\n1,2,3\n4,5,6';
    const parsedComma = parseRawCsv(commaCsv);
    expect(parsedComma.headers).toEqual(['A', 'B', 'C']);
    expect(parsedComma.rows.length).toBe(2);

    const semiCsv = 'A;B;C\n10;20;30';
    const parsedSemi = parseRawCsv(semiCsv);
    expect(parsedSemi.headers).toEqual(['A', 'B', 'C']);
    expect(parsedSemi.rows[0]).toEqual(['10', '20', '30']);
  });

  it('guesses column mapping correctly from Vietnamese headers', () => {
    const headers = ['Ngày đơn hàng', 'Kênh bán', 'Mã SKU', 'Số lượng', 'Doanh thu'];
    const mapping = guessColumnMapping(headers);

    expect(mapping.date).toBe('Ngày đơn hàng');
    expect(mapping.channel).toBe('Kênh bán');
    expect(mapping.sku).toBe('Mã SKU');
    expect(mapping.quantity).toBe('Số lượng');
    expect(mapping.gross_revenue).toBe('Doanh thu');
  });

  it('validates rows, catches missing SKU errors, and creates OrderLine objects', () => {
    const headers = ['date', 'channel', 'sku', 'quantity', 'revenue'];
    const rows = [
      ['2024-05-01', 'Shopee', 'A01', '2', '200000'],
      ['2024-05-02', 'TikTok', '', '1', '100000'], // Missing SKU -> error
    ];
    const mapping = {
      date: 'date',
      channel: 'channel',
      sku: 'sku',
      quantity: 'quantity',
      gross_revenue: 'revenue',
      discount: '',
      returned: '',
      shipping_cost_seller: '',
      ads_cost_allocated: '',
      other_cost: '',
    };

    const result = parseAndValidateOrders(headers, rows, mapping);
    expect(result.validOrders.length).toBe(1);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].field).toBe('sku');
    expect(result.validOrders[0].channel).toBe('Shopee');
  });
});
