import { z } from 'zod';

export const ChannelSchema = z.enum(['Shopee', 'TikTok Shop', 'Lazada', 'Other']);
export type Channel = z.infer<typeof ChannelSchema>;

export const ProductSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  cost_of_goods: z.number().nonnegative(),
  price: z.number().positive(),
});
export type Product = z.infer<typeof ProductSchema>;

export const OrderLineSchema = z.object({
  id: z.string().optional(),
  date: z.string(), // ISO YYYY-MM-DD
  channel: ChannelSchema,
  sku: z.string().min(1),
  quantity: z.number().int().positive(),
  gross_revenue: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
  returned: z.boolean().default(false),
  shipping_cost_seller: z.number().nonnegative().default(0),
  ads_cost_allocated: z.number().nonnegative().default(0),
  other_cost: z.number().nonnegative().default(0),
});
export type OrderLine = z.infer<typeof OrderLineSchema>;

export const ProgramRateSchema = z.object({
  name: z.string(),
  rate: z.number().min(0).max(1), // e.g. 0.05 for 5%
  cap: z.number().nonnegative().optional(), // optional fee cap per item in VND
});
export type ProgramRate = z.infer<typeof ProgramRateSchema>;

export const FeeScheduleSchema = z.object({
  id: z.string(),
  platform: ChannelSchema,
  category: z.string(), // matches Product.category or '*' for all
  effective_from: z.string(), // ISO YYYY-MM-DD
  commission_rate: z.number().min(0).max(1),
  payment_rate: z.number().min(0).max(1),
  service_rate: z.number().min(0).max(1),
  program_rates: z.array(ProgramRateSchema).default([]),
  fixed_fee_per_order: z.number().nonnegative().default(0), // Phí cố định theo đơn (VND), ví dụ 3.000đ/đơn hạ tầng TikTok/Lazada
  source_url: z.string().optional(),
  note: z.string().optional(),
  origin: z.enum(['manual', 'radar']).default('manual'),
  radar_record_id: z.string().optional(),
  is_active: z.boolean().default(true),
});
export type FeeSchedule = z.infer<typeof FeeScheduleSchema>;

export const TaxRateItemSchema = z.object({
  category: z.string(), // e.g., 'Phân phối, cung cấp hàng hoá'
  vat_rate: z.number().min(0).max(1), // e.g., 0.01 for 1%
  pit_rate: z.number().min(0).max(1), // Personal Income Tax, e.g., 0.005 for 0.5%
  description: z.string().optional(),
});
export type TaxRateItem = z.infer<typeof TaxRateItemSchema>;

export const TaxPolicyVersionSchema = z.object({
  id: z.string(),
  effective_from: z.string(), // ISO YYYY-MM-DD
  revenue_threshold: z.number().nonnegative().default(1_000_000_000), // Default 1 Billion VND
  tax_rates: z.array(TaxRateItemSchema).default([]), // Editable, never hard-code legal rates
  boundary_rule: z.enum(['<=', '<']).default('<='),
  einvoice_required_above_threshold: z.boolean().default(true),
  compliance_cost_above_threshold: z.number().nonnegative().default(0), // VND/year
  source_note: z.string(),
  origin: z.enum(['manual', 'radar']).default('manual'),
  radar_record_id: z.string().optional(),
  is_active: z.boolean().default(true),
});
export type TaxPolicyVersion = z.infer<typeof TaxPolicyVersionSchema>;

export const WithholdingRecordSchema = z.object({
  id: z.string().optional(),
  channel: ChannelSchema,
  date: z.string(), // ISO YYYY-MM-DD
  amount: z.number().nonnegative(),
});
export type WithholdingRecord = z.infer<typeof WithholdingRecordSchema>;

export const FeeEventSchema = z.object({
  id: z.string(),
  platform: ChannelSchema,
  category: z.string(),
  announced_date: z.string(),
  effective_date: z.string(),
  old_rate: z.number().min(0).max(1),
  new_rate: z.number().min(0).max(1),
  source_url: z.string().optional(),
});
export type FeeEvent = z.infer<typeof FeeEventSchema>;

export const SourceSpanSchema = z.object({
  text: z.string(),
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
});
export type SourceSpan = z.infer<typeof SourceSpanSchema>;

export const RadarRecordFieldSchema = z.enum([
  'commission',
  'payment',
  'service',
  'program',
  'threshold',
  'tax_rate',
  'withholding_rule',
  'einvoice_rule',
  'other',
]);
export type RadarRecordField = z.infer<typeof RadarRecordFieldSchema>;

export const RadarRecordSchema = z.object({
  id: z.string(),
  document_id: z.string(),
  kind: z.enum(['fee_change', 'tax_change']),
  platform: ChannelSchema.optional(),
  category: z.string().optional(),
  field: RadarRecordFieldSchema,
  old_value: z.number().nullable().optional(),
  new_value: z.number(),
  unit: z.enum(['percent', 'pp', 'vnd']),
  effective_date: z.string(), // ISO YYYY-MM-DD
  legal_ref: z.string().optional(),
  source_span: SourceSpanSchema,
  confidence: z.number().min(0).max(1),
  status: z.enum(['pending', 'approved', 'edited', 'rejected']).default('pending').optional(),
  reviewer_note: z.string().optional(),
  created_version_id: z.string().optional(),
  needs_attention: z.boolean().default(false).optional(),
  verification_message: z.string().optional(),
});
export type RadarRecord = z.infer<typeof RadarRecordSchema>;

export const RadarDocumentSchema = z.object({
  id: z.string(),
  type: z.enum(['platform_notice', 'tax_regulation']),
  platform: ChannelSchema.optional(),
  title: z.string(),
  raw_text: z.string(),
  uploaded_at: z.string(),
  source_url: z.string().optional(),
});
export type RadarDocument = z.infer<typeof RadarDocumentSchema>;

export const ScenarioRunLogSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  seed: z.number(),
  parameters_snapshot: z.record(z.string(), z.any()),
  outputs: z.record(z.string(), z.any()),
});
export type ScenarioRunLog = z.infer<typeof ScenarioRunLogSchema>;

export const SusResponseSchema = z.object({
  id: z.string().optional(),
  timestamp: z.string(),
  participant_code: z.string().optional(),
  answers: z.array(z.number().int().min(1).max(5)).length(10),
  calculated_score: z.number().min(0).max(100),
});
export type SusResponse = z.infer<typeof SusResponseSchema>;
