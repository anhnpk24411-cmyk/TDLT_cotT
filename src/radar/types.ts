import { RadarRecord, RadarDocument, FeeSchedule, TaxPolicyVersion } from '../engine/types.ts';

export type LlmProvider = 'openai' | 'gemini' | 'anthropic';

export interface LlmConfig {
  provider: LlmProvider;
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export interface Extractor {
  id: string;
  name: string;
  extract(
    doc: RadarDocument,
    activeFeeSchedules: FeeSchedule[],
    activeTaxPolicy?: TaxPolicyVersion
  ): Promise<RadarRecord[]>;
}

