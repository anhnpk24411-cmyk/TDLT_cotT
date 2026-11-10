import { describe, it, expect } from 'vitest';
import { generateAdaptationSuggestions } from '../../src/engine/adaptation.ts';
import { calculateSusScore } from '../../src/engine/sus.ts';
import { runRadarBenchmark, exportBenchmarkCsv } from '../../src/engine/benchmark.ts';
import { RuleExtractor } from '../../src/radar/extractors/rule_extractor.ts';
import { MockExtractor } from '../../src/radar/extractors/mock_extractor.ts';
import { Product, OrderLine, FeeSchedule } from '../../src/engine/types.ts';

const mockProducts: Product[] = [
  { sku: 'SKU-01', name: 'Áo', category: 'Thời trang', cost_of_goods: 50000, price: 150000 },
];

const mockOrders: OrderLine[] = [
  {
    id: 'ORD-1',
    date: '2024-05-01',
    channel: 'Shopee',
    sku: 'SKU-01',
    quantity: 1,
    gross_revenue: 150000,
    discount: 0,
    returned: false,
    shipping_cost_seller: 0,
    ads_cost_allocated: 20000,
    other_cost: 0,
  },
];

const mockSchedules: FeeSchedule[] = [
  {
    id: 'FS-1',
    platform: 'Shopee',
    category: '*',
    effective_from: '2024-01-01',
    commission_rate: 0.05,
    payment_rate: 0.04,
    service_rate: 0.03,
    program_rates: [],
    is_active: true,
    origin: 'manual',
  },
];

describe('Adaptation Suggestions, SUS, and Radar Benchmark Engine', () => {
  it('generates heuristic adaptation suggestions over price, ads, and channels', () => {
    const suggestions = generateAdaptationSuggestions(mockOrders, mockProducts, mockSchedules);
    expect(suggestions.length).toBeGreaterThan(0);

    const priceStrat = suggestions.find((s) => s.category === 'price');
    expect(priceStrat).toBeDefined();
    expect(priceStrat!.priceDeltaPercent).toBe(5);
    expect(priceStrat!.after.netProfit).toBeGreaterThan(priceStrat!.before.netProfit);

    const adsStrat = suggestions.find((s) => s.category === 'ads');
    expect(adsStrat).toBeDefined();
    expect(adsStrat!.adsDeltaPercent).toBe(-20);
    expect(adsStrat!.after.netProfit).toBeGreaterThan(adsStrat!.before.netProfit);
  });

  it('calculates standard SUS scores accurately', () => {
    // Perfect 5s for all 10 questions -> score 100
    const perfectAnswers = [5, 1, 5, 1, 5, 1, 5, 1, 5, 1];
    const perfect = calculateSusScore(perfectAnswers);
    expect(perfect.score).toBe(100);
    expect(perfect.grade).toBe('A');

    // Neutral 3s for all questions -> score 50 (Grade C / D)
    const neutralAnswers = [3, 3, 3, 3, 3, 3, 3, 3, 3, 3];
    const neutral = calculateSusScore(neutralAnswers);
    expect(neutral.score).toBe(50);
    expect(neutral.grade).toBe('F');

    // High usability -> score > 70
    const goodAnswers = [4, 2, 4, 2, 4, 2, 4, 2, 4, 2];
    const good = calculateSusScore(goodAnswers);
    expect(good.score).toBe(75);
    expect(good.grade).toBe('B');
  });

  it('runs benchmark evaluation for RuleExtractor and MockExtractor', async () => {
    const ruleExtractor = new RuleExtractor();
    const mockExtractor = new MockExtractor();

    const ruleBench = await runRadarBenchmark(ruleExtractor);
    expect(ruleBench.totalNoticesEvaluated).toBe(5);
    expect(ruleBench.overallF1).toBeGreaterThanOrEqual(0);
    expect(ruleBench.avgTimePerNoticeMs).toBeGreaterThanOrEqual(0);

    const mockBench = await runRadarBenchmark(mockExtractor);
    expect(mockBench.totalNoticesEvaluated).toBe(5);

    const csv = exportBenchmarkCsv([ruleBench, mockBench]);
    expect(csv).toContain('Bo_trich_xuat');
    expect(csv).toContain('F1_Score_pct');
  });
});
