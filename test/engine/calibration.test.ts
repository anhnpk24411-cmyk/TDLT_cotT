import { describe, it, expect } from 'vitest';
import { FeeEvent } from '../../src/engine/types.ts';
import { calibrateShockParameters, DEFAULT_MANUAL_CALIBRATION } from '../../src/engine/calibration.ts';

describe('FeeEvent Calibration Engine', () => {
  it('handles empty FeeEvent history safely with warning and manual fallback', () => {
    const res = calibrateShockParameters([]);

    expect(res.insufficientData).toBe(true);
    expect(res.eventCount).toBe(0);
    expect(res.warning).toBeDefined();
    expect(res.lambdaEstimated).toBe(DEFAULT_MANUAL_CALIBRATION.lambdaEstimated);
    expect(res.triangularMin).toBe(DEFAULT_MANUAL_CALIBRATION.triangularMin);
  });

  it('handles single FeeEvent as insufficient data', () => {
    const singleEvent: FeeEvent[] = [
      {
        id: 'ev-1',
        platform: 'Shopee',
        category: '*',
        announced_date: '2024-01-10',
        effective_date: '2024-02-01',
        old_rate: 0.03,
        new_rate: 0.04,
      },
    ];

    const res = calibrateShockParameters(singleEvent);
    expect(res.insufficientData).toBe(true);
    expect(res.eventCount).toBe(1);
    expect(res.warning).toBeDefined();
  });

  it('calibrates lambda and Triangular parameters from historical FeeEvents', () => {
    const events: FeeEvent[] = [
      {
        id: 'ev-1',
        platform: 'Shopee',
        category: '*',
        announced_date: '2023-01-01',
        effective_date: '2023-02-01',
        old_rate: 0.02,
        new_rate: 0.03, // +1pp (0.01)
      },
      {
        id: 'ev-2',
        platform: 'TikTok Shop',
        category: '*',
        announced_date: '2023-07-01',
        effective_date: '2023-08-01',
        old_rate: 0.03,
        new_rate: 0.05, // +2pp (0.02)
      },
      {
        id: 'ev-3',
        platform: 'Shopee',
        category: '*',
        announced_date: '2024-01-01',
        effective_date: '2024-02-01',
        old_rate: 0.04,
        new_rate: 0.08, // +4pp (0.04)
      },
    ];

    // Timespan from 2023-01-01 to 2024-01-01 = 1 year.
    // 3 events in 1 year -> lambda ~ 3.0
    // Hikes: [0.01, 0.02, 0.04] -> min = 0.01, mode = 0.02, max = 0.04
    const res = calibrateShockParameters(events);

    expect(res.insufficientData).toBe(false);
    expect(res.eventCount).toBe(3);
    expect(res.timeSpanYears).toBeCloseTo(1.0, 1);
    expect(res.lambdaEstimated).toBeCloseTo(3.0, 1);
    expect(res.triangularMin).toBe(0.01);
    expect(res.triangularMode).toBe(0.02);
    expect(res.triangularMax).toBe(0.04);
  });
});

