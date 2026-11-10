import { OrderLine, OrderLineSchema } from '../engine/types.ts';

export interface ColumnMapping {
  date: string;
  channel: string;
  sku: string;
  quantity: string;
  gross_revenue: string;
  discount: string;
  returned: string;
  shipping_cost_seller: string;
  ads_cost_allocated: string;
  other_cost: string;
}

export interface CsvParseResult {
  headers: string[];
  totalRows: number;
  validOrders: OrderLine[];
  errors: Array<{
    rowIndex: number;
    field: string;
    message: string;
    rawData: Record<string, string>;
  }>;
}

/**
 * Standard CSV template with Vietnamese column names.
 */
export const STANDARD_CSV_HEADERS = [
  'Ngay_don (YYYY-MM-DD)',
  'Kenh_ban (Shopee/TikTok Shop/Lazada/Other)',
  'Ma_SKU',
  'So_luong',
  'Doanh_thu_goc (VND)',
  'Giam_gia_tro_gia (VND)',
  'Hang_hoan (true/false/1/0)',
  'Phi_van_chuyen_nguoi_ban_chiu (VND)',
  'Chi_phi_quang_cao (VND)',
  'Chi_phi_khac (VND)',
];

export function generateCsvTemplate(): string {
  const sampleRows = [
    STANDARD_CSV_HEADERS.join(','),
    '2024-05-10,Shopee,TSHIRT-001,2,440000,40000,false,0,35000,6000',
    '2024-05-11,TikTok Shop,HOODIE-002,1,380000,0,false,15000,40000,3000',
    '2024-05-12,Lazada,LIPSTICK-003,1,180000,10000,true,25000,20000,3000',
  ];
  return sampleRows.join('\n');
}

/**
 * Parses raw CSV text into rows, detecting comma or semicolon delimiter.
 */
export function parseRawCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  // Detect delimiter: comma or semicolon
  const firstLine = lines[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const delimiter = semiCount > commaCount ? ';' : ',';

  // Robust line splitting respecting quotes
  const splitLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = splitLine(lines[0]);
  const rows = lines.slice(1).map(splitLine);

  return { headers, rows };
}

/**
 * Guesses default mapping based on Vietnamese or English header patterns.
 */
export function guessColumnMapping(headers: string[]): ColumnMapping {
  const findMatch = (patterns: string[]): string => {
    for (const h of headers) {
      const norm = h
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\s\-_]+/g, '_');
      if (patterns.some((p) => norm.includes(p.replace(/[\s\-_]+/g, '_')))) {
        return h;
      }
    }
    return '';
  };

  return {
    date: findMatch(['ngay', 'date', 'created']),
    channel: findMatch(['kenh', 'san', 'channel', 'platform']),
    sku: findMatch(['sku', 'ma_hang', 'item_id']),
    quantity: findMatch(['so_luong', 'sl', 'qty', 'quantity']),
    gross_revenue: findMatch(['doanh_thu', 'gross', 'revenue', 'gia_ban', 'total_amount']),
    discount: findMatch(['giam_gia', 'discount', 'voucher', 'tro_gia']),
    returned: findMatch(['hoan', 'tra', 'return', 'cancel', 'huy']),
    shipping_cost_seller: findMatch(['van_chuyen', 'ship', 'shipping', 'phi_vc']),
    ads_cost_allocated: findMatch(['quang_cao', 'ads', 'marketing', 'cpc']),
    other_cost: findMatch(['khac', 'other', 'dong_goi', 'packaging']),
  };
}

/**
 * Validates and maps CSV rows into OrderLine objects.
 */
export function parseAndValidateOrders(
  headers: string[],
  rows: string[][],
  mapping: ColumnMapping
): CsvParseResult {
  const getColIdx = (colName: string) => headers.indexOf(colName);

  const idxDate = getColIdx(mapping.date);
  const idxChannel = getColIdx(mapping.channel);
  const idxSku = getColIdx(mapping.sku);
  const idxQty = getColIdx(mapping.quantity);
  const idxGross = getColIdx(mapping.gross_revenue);
  const idxDisc = getColIdx(mapping.discount);
  const idxRet = getColIdx(mapping.returned);
  const idxShip = getColIdx(mapping.shipping_cost_seller);
  const idxAds = getColIdx(mapping.ads_cost_allocated);
  const idxOther = getColIdx(mapping.other_cost);

  const validOrders: OrderLine[] = [];
  const errors: CsvParseResult['errors'] = [];

  const parseNumber = (val: string | undefined): number => {
    if (!val) return 0;
    const clean = val.replace(/[^\d.-]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  const parseBool = (val: string | undefined): boolean => {
    if (!val) return false;
    const norm = val.toLowerCase().trim();
    return norm === 'true' || norm === '1' || norm === 'có' || norm === 'co' || norm === 'hoàn';
  };

  const normalizeChannel = (val: string | undefined): OrderLine['channel'] => {
    if (!val) return 'Other';
    const norm = val.toLowerCase();
    if (norm.includes('shopee')) return 'Shopee';
    if (norm.includes('tiktok')) return 'TikTok Shop';
    if (norm.includes('lazada') || norm.includes('laz')) return 'Lazada';
    return 'Other';
  };

  rows.forEach((row, idx) => {
    const rawData: Record<string, string> = {};
    headers.forEach((h, hIdx) => {
      rawData[h] = row[hIdx] || '';
    });

    const dateVal = row[idxDate] || new Date().toISOString().slice(0, 10);
    const skuVal = row[idxSku] || '';
    const qtyVal = parseNumber(row[idxQty]) || 1;
    const grossVal = parseNumber(row[idxGross]);

    if (!skuVal) {
      errors.push({
        rowIndex: idx + 2, // header is row 1
        field: 'sku',
        message: 'Mã SKU không được để trống.',
        rawData,
      });
      return;
    }

    if (grossVal < 0) {
      errors.push({
        rowIndex: idx + 2,
        field: 'gross_revenue',
        message: 'Doanh thu không được là số âm.',
        rawData,
      });
      return;
    }

    const orderObj = {
      id: `IMP-${Date.now()}-${idx}`,
      date: dateVal,
      channel: normalizeChannel(row[idxChannel]),
      sku: skuVal,
      quantity: Math.max(1, Math.round(qtyVal)),
      gross_revenue: grossVal,
      discount: parseNumber(row[idxDisc]),
      returned: parseBool(row[idxRet]),
      shipping_cost_seller: parseNumber(row[idxShip]),
      ads_cost_allocated: parseNumber(row[idxAds]),
      other_cost: parseNumber(row[idxOther]),
    };

    const parsed = OrderLineSchema.safeParse(orderObj);
    if (!parsed.success) {
      errors.push({
        rowIndex: idx + 2,
        field: parsed.error.issues[0].path.join('.'),
        message: parsed.error.issues[0].message,
        rawData,
      });
    } else {
      validOrders.push(parsed.data);
    }
  });

  return {
    headers,
    totalRows: rows.length,
    validOrders,
    errors,
  };
}
