import { db } from './database.ts';
import {
  Product,
  OrderLine,
  FeeSchedule,
  TaxPolicyVersion,
  FeeEvent,
  WithholdingRecord,
} from '../engine/types.ts';

export const SYNTHETIC_PRODUCTS: Product[] = [
  {
    sku: 'TSHIRT-001',
    name: 'Áo Thun Cotton Compact 250gsm (SYNTHETIC)',
    category: 'Thời trang nam',
    cost_of_goods: 85_000,
    price: 220_000,
  },
  {
    sku: 'HOODIE-002',
    name: 'Áo Khoác Nỉ Unisex Form Rộng (SYNTHETIC)',
    category: 'Thời trang nam',
    cost_of_goods: 160_000,
    price: 380_000,
  },
  {
    sku: 'LIPSTICK-003',
    name: 'Son Kem Lì Mịn Môi Velvet (SYNTHETIC)',
    category: 'Mỹ phẩm',
    cost_of_goods: 60_000,
    price: 180_000,
  },
  {
    sku: 'BOTTLE-004',
    name: 'Bình Giữ Nhiệt Inox 316 800ml (SYNTHETIC)',
    category: 'Gia dụng',
    cost_of_goods: 95_000,
    price: 250_000,
  },
];

export const SYNTHETIC_FEE_SCHEDULES: FeeSchedule[] = [
  {
    id: 'demo-shopee-2024',
    platform: 'Shopee',
    category: '*',
    effective_from: '2024-01-01',
    commission_rate: 0.04, // 4.0%
    payment_rate: 0.035, // 3.5%
    service_rate: 0.05, // 5.0%
    program_rates: [
      { name: 'Gói Freeship Xtra (Placeholder)', rate: 0.06, cap: 30_000 },
    ],
    fixed_fee_per_order: 0,
    note: 'DỮ LIỆU MẪU GIẢ LẬP, KHÔNG PHẢI BIỂU PHÍ CHÍNH THỨC (SYNTHETIC PLACEHOLDER) - Vui lòng kiểm tra lại biểu phí hiện hành từ Shopee Seller Centre',
    origin: 'manual',
    is_active: true,
  },
  {
    id: 'demo-tiktok-2024',
    platform: 'TikTok Shop',
    category: '*',
    effective_from: '2024-01-01',
    commission_rate: 0.04, // 4.0%
    payment_rate: 0.03, // 3.0%
    service_rate: 0.03, // 3.0%
    program_rates: [
      { name: 'Freeship Program (Placeholder)', rate: 0.045, cap: 25_000 },
    ],
    fixed_fee_per_order: 3000,
    note: 'DỮ LIỆU MẪU GIẢ LẬP, KHÔNG PHẢI BIỂU PHÍ CHÍNH THỨC (SYNTHETIC PLACEHOLDER) - Vui lòng kiểm tra lại biểu phí hiện hành từ TikTok Shop Academy',
    origin: 'manual',
    is_active: true,
  },
  {
    id: 'demo-lazada-2024',
    platform: 'Lazada',
    category: '*',
    effective_from: '2024-01-01',
    commission_rate: 0.035, // 3.5%
    payment_rate: 0.03, // 3.0%
    service_rate: 0.04, // 4.0%
    program_rates: [],
    fixed_fee_per_order: 0,
    note: 'DỮ LIỆU MẪU GIẢ LẬP, KHÔNG PHẢI BIỂU PHÍ CHÍNH THỨC (SYNTHETIC PLACEHOLDER) - Vui lòng đối chiếu biểu phí từ Lazada University',
    origin: 'manual',
    is_active: true,
  },
  {
    id: 'ref-tiktok-may2026',
    platform: 'TikTok Shop',
    category: '*',
    effective_from: '2026-05-01',
    commission_rate: 0.14,     // 14% (dải thời trang TikTok 9 - 17.8%)
    payment_rate: 0.06,        // 6% từ 9/5/2026 (V: MISA)
    service_rate: 0.00,
    program_rates: [],
    fixed_fee_per_order: 3000, // V: 3.000đ/đơn từ 27/10/2025
    note: 'THAM CHIẾU - TikTok Shop từ 01/5/2026. Hoa hồng khoảng giữa dải (A); thanh toán 6% (V); hạ tầng 3.000đ/đơn (V).',
    origin: 'manual',
    is_active: true,
  },
  {
    id: 'ref-shopee-may2026',
    platform: 'Shopee',
    category: '*',
    effective_from: '2026-05-01',
    commission_rate: 0.1031,   // 10.31% thời trang (V: MISA eShop)
    payment_rate: 0.06,        // 6% từ 01/5/2026 (V: Điều khoản Shopee 24/4/2026)
    service_rate: 0.055,       // 5.5% Voucher Xtra (V: Tuổi Trẻ 5/2026)
    program_rates: [],
    fixed_fee_per_order: 0,
    note: 'THAM CHIẾU - Shopee từ 01/5/2026. Phí thanh toán 6% có nguồn chính thức; hoa hồng và Voucher Xtra theo báo chí/đơn vị phần mềm.',
    origin: 'manual',
    is_active: true,
  },
  {
    id: 'ref-lazada-may2026',
    platform: 'Lazada',
    category: '*',
    effective_from: '2026-05-01',
    commission_rate: 0.088,    // 8.8% thời trang
    payment_rate: 0.06,        // 6% (V: Tuổi Trẻ 5/2026)
    service_rate: 0.00,
    program_rates: [],
    fixed_fee_per_order: 3000, // V: phí hạ tầng 3.000đ/đơn
    note: 'THAM CHIẾU - Lazada từ 01/5/2026. Thanh toán 6% và hạ tầng 3.000đ/đơn có nguồn báo chí.',
    origin: 'manual',
    is_active: true,
  },
];

export const SYNTHETIC_TAX_POLICY: TaxPolicyVersion = {
  id: 'demo-tax-policy-synthetic',
  effective_from: '2024-01-01',
  revenue_threshold: 1_000_000_000, // 1 tỷ VNĐ
  boundary_rule: '<=',
  tax_rates: [
    {
      category: 'Phân phối, cung cấp hàng hoá',
      vat_rate: 0.01, // 1% VAT
      pit_rate: 0.005, // 0.5% TNCN
      description: 'Mẫu tham khảo hộ kinh doanh phân phối hàng hoá',
    },
  ],
  einvoice_required_above_threshold: true,
  compliance_cost_above_threshold: 12_000_000, // 12 triệu VNĐ/năm chi phí kế toán & hóa đơn điện tử
  source_note: 'GIẢ LẬP, KHÔNG PHẢI QUY ĐỊNH NĂM 2024: ngưỡng 1 tỷ và chi phí tuân thủ 12 triệu chỉ là kịch bản thử nghiệm. Không dùng để xác định nghĩa vụ thuế thực tế. Cần nhập phiên bản có hiệu lực và văn bản gốc.',
  origin: 'manual',
  is_active: true,
};

export const SYNTHETIC_FEE_EVENTS: FeeEvent[] = [
  {
    id: 'fe-01',
    platform: 'Shopee',
    category: '*',
    announced_date: '2023-06-15',
    effective_date: '2023-07-01',
    old_rate: 0.025,
    new_rate: 0.03, // +0.5pp
    // Không gán đường dẫn bịa cho sự kiện mô phỏng.
  },
  {
    id: 'fe-02',
    platform: 'TikTok Shop',
    category: '*',
    announced_date: '2023-09-01',
    effective_date: '2023-10-01',
    old_rate: 0.03,
    new_rate: 0.04, // +1.0pp
    // Không có tài liệu chính thức: sự kiện mô phỏng.
  },
  {
    id: 'fe-03',
    platform: 'Shopee',
    category: '*',
    announced_date: '2024-03-10',
    effective_date: '2024-04-01',
    old_rate: 0.03,
    new_rate: 0.04, // +1.0pp
    // Không có tài liệu chính thức: sự kiện mô phỏng.
  },
];

export const SYNTHETIC_WITHHOLDINGS: WithholdingRecord[] = [
  {
    channel: 'Shopee',
    date: '2024-03-31',
    amount: 3_500_000,
  },
  {
    channel: 'TikTok Shop',
    date: '2024-03-31',
    amount: 4_200_000,
  },
  {
    channel: 'Lazada',
    date: '2024-03-31',
    amount: 1_100_000,
  },
];

/**
 * Generates synthetic order lines for realistic demonstration.
 */
export function generateSyntheticOrders(count = 120): OrderLine[] {
  const channels: Array<OrderLine['channel']> = ['Shopee', 'TikTok Shop', 'Lazada', 'Other'];
  const orders: OrderLine[] = [];

  // Deterministic seed generation
  let pseudoState = 42;
  const pseudoRandom = () => {
    pseudoState = (pseudoState * 9301 + 49297) % 233280;
    return pseudoState / 233280;
  };

  const startDate = new Date('2024-01-05').getTime();
  const endDate = new Date('2024-11-01').getTime();

  for (let i = 1; i <= count; i++) {
    const channelIdx = Math.floor(pseudoRandom() * channels.length);
    const prodIdx = Math.floor(pseudoRandom() * SYNTHETIC_PRODUCTS.length);
    const prod = SYNTHETIC_PRODUCTS[prodIdx];

    const qty = 1 + Math.floor(pseudoRandom() * 3); // 1 to 3 items
    const grossRevenue = prod.price * qty;
    const discount = pseudoRandom() < 0.4 ? Math.floor(grossRevenue * (0.05 + pseudoRandom() * 0.1)) : 0;
    const isReturned = pseudoRandom() < 0.06; // 6% return rate

    const orderTime = startDate + pseudoRandom() * (endDate - startDate);
    const dateStr = new Date(orderTime).toISOString().slice(0, 10);

    const shippingSeller = isReturned ? 25_000 : pseudoRandom() < 0.3 ? 15_000 : 0;
    const adsAllocated = Math.floor(grossRevenue * (0.08 + pseudoRandom() * 0.06)); // 8-14% ad cost
    const otherCost = 3_000 * qty; // packaging

    orders.push({
      id: `DEMO-ORD-${String(i).padStart(4, '0')}`,
      date: dateStr,
      channel: channels[channelIdx],
      sku: prod.sku,
      quantity: qty,
      gross_revenue: grossRevenue,
      discount,
      returned: isReturned,
      shipping_cost_seller: shippingSeller,
      ads_cost_allocated: adsAllocated,
      other_cost: otherCost,
    });
  }

  // Sort chronologically
  orders.sort((a, b) => a.date.localeCompare(b.date));
  return orders;
}

/**
 * Initializes database with demo data if empty or forced.
 */
export async function seedDemoData(force = false): Promise<void> {
  const existingProductsCount = await db.products.count();
  if (existingProductsCount > 0 && !force) {
    return;
  }

  await db.transaction(
    'rw',
    [
      db.products,
      db.fee_schedules,
      db.tax_policies,
      db.fee_events,
      db.withholding_records,
      db.orders,
    ],
    async () => {
      if (force) {
        await db.products.clear();
        await db.fee_schedules.clear();
        await db.tax_policies.clear();
        await db.fee_events.clear();
        await db.withholding_records.clear();
        await db.orders.clear();
      }

      await db.products.bulkAdd(SYNTHETIC_PRODUCTS);
      await db.fee_schedules.bulkAdd(SYNTHETIC_FEE_SCHEDULES);
      await db.tax_policies.add(SYNTHETIC_TAX_POLICY);
      await db.fee_events.bulkAdd(SYNTHETIC_FEE_EVENTS);
      await db.withholding_records.bulkAdd(SYNTHETIC_WITHHOLDINGS);
      await db.orders.bulkAdd(generateSyntheticOrders(120));
    }
  );
}

export async function clearAllData(): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.products,
      db.fee_schedules,
      db.tax_policies,
      db.fee_events,
      db.withholding_records,
      db.orders,
      db.radar_documents,
      db.radar_records,
      db.scenario_runs,
      db.sus_responses,
    ],
    async () => {
      await db.products.clear();
      await db.fee_schedules.clear();
      await db.tax_policies.clear();
      await db.fee_events.clear();
      await db.withholding_records.clear();
      await db.orders.clear();
      await db.radar_documents.clear();
      await db.radar_records.clear();
      await db.scenario_runs.clear();
      await db.sus_responses.clear();
    }
  );
}
