import Dexie, { type Table } from 'dexie';
import {
  Product,
  OrderLine,
  FeeSchedule,
  TaxPolicyVersion,
  WithholdingRecord,
  FeeEvent,
  RadarDocument,
  RadarRecord,
  ScenarioRunLog,
  SusResponse,
} from '../engine/types.ts';

export interface AppSetting {
  key: string;
  value: any;
}

export class SellerRadarDatabase extends Dexie {
  products!: Table<Product, string>;
  orders!: Table<OrderLine, string>;
  fee_schedules!: Table<FeeSchedule, string>;
  tax_policies!: Table<TaxPolicyVersion, string>;
  withholding_records!: Table<WithholdingRecord, string>;
  fee_events!: Table<FeeEvent, string>;
  radar_documents!: Table<RadarDocument, string>;
  radar_records!: Table<RadarRecord, string>;
  scenario_runs!: Table<ScenarioRunLog, string>;
  sus_responses!: Table<SusResponse, string>;
  settings!: Table<AppSetting, string>;

  constructor() {
    super('SellerProfitRadarDB');

    this.version(1).stores({
      products: 'sku, name, category',
      orders: '++id, date, channel, sku, returned',
      fee_schedules: 'id, platform, category, effective_from, is_active, origin',
      tax_policies: 'id, effective_from, is_active, origin',
      withholding_records: '++id, channel, date',
      fee_events: 'id, platform, announced_date, effective_date',
      radar_documents: 'id, type, platform, uploaded_at',
      radar_records: 'id, document_id, kind, platform, status, field',
      scenario_runs: 'id, timestamp, seed',
      sus_responses: '++id, timestamp',
      settings: 'key',
    });
  }
}

export const db = new SellerRadarDatabase();
