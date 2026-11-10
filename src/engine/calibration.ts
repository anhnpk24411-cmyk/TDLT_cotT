import { FeeEvent } from './types.ts';

export interface CalibrationResult {
  insufficientData: boolean;
  eventCount: number;
  timeSpanYears: number;
  lambdaEstimated: number; // Estimated events per year
  triangularMin: number; // in decimal, e.g. 0.01 for 1pp
  triangularMode: number;
  triangularMax: number;
  hikesObserved: number[]; // List of hike magnitudes in decimal
  warning?: string;
  sourceEventIds: string[];
}

export const DEFAULT_MANUAL_CALIBRATION = {
  lambdaEstimated: 2.0, // 2 hikes per year
  triangularMin: 0.01, // +1pp
  triangularMode: 0.02, // +2pp
  triangularMax: 0.04, // +4pp
};

/**
 * Calibrates Poisson arrival rate (lambda) and Triangular magnitude parameters
 * from the user's empirical FeeEvent history.
 */
export function calibrateShockParameters(events: FeeEvent[]): CalibrationResult {
  if (!events || events.length < 2) {
    return {
      insufficientData: true,
      eventCount: events ? events.length : 0,
      timeSpanYears: 0,
      lambdaEstimated: DEFAULT_MANUAL_CALIBRATION.lambdaEstimated,
      triangularMin: DEFAULT_MANUAL_CALIBRATION.triangularMin,
      triangularMode: DEFAULT_MANUAL_CALIBRATION.triangularMode,
      triangularMax: DEFAULT_MANUAL_CALIBRATION.triangularMax,
      hikesObserved: [],
      warning:
        'Chưa đủ dữ liệu lịch sử tăng phí (cần tối thiểu 2 sự kiện). Vui lòng nhập thông số thủ công hoặc bổ sung thêm sự kiện.',
      sourceEventIds: events ? events.map((e) => e.id) : [],
    };
  }

  // Calculate hikes
  const hikes: number[] = [];
  const dates: number[] = [];

  for (const ev of events) {
    const diff = ev.new_rate - ev.old_rate;
    if (diff > 0) {
      hikes.push(diff);
    }
    const d = new Date(ev.announced_date).getTime();
    if (!isNaN(d)) {
      dates.push(d);
    }
  }

  if (hikes.length === 0) {
    return {
      insufficientData: true,
      eventCount: events.length,
      timeSpanYears: 0,
      lambdaEstimated: DEFAULT_MANUAL_CALIBRATION.lambdaEstimated,
      triangularMin: DEFAULT_MANUAL_CALIBRATION.triangularMin,
      triangularMode: DEFAULT_MANUAL_CALIBRATION.triangularMode,
      triangularMax: DEFAULT_MANUAL_CALIBRATION.triangularMax,
      hikesObserved: [],
      warning: 'Không tìm thấy sự kiện tăng phí nào có mức tăng dương (> 0).',
      sourceEventIds: events.map((e) => e.id),
    };
  }

  // Calculate timespan in years
  let timeSpanYears = 1.0;
  if (dates.length >= 2) {
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    const msDiff = maxDate - minDate;
    const years = msDiff / (1000 * 60 * 60 * 24 * 365.25);
    timeSpanYears = Math.max(0.25, years); // Minimum floor of 0.25 years (3 months)
  }

  const lambdaEstimated = Math.max(0.5, hikes.length / timeSpanYears);

  // Triangular parameters
  hikes.sort((a, b) => a - b);
  const triangularMin = hikes[0];
  const triangularMax = hikes[hikes.length - 1];

  // Median as mode estimate
  const midIndex = Math.floor(hikes.length / 2);
  const triangularMode =
    hikes.length % 2 !== 0
      ? hikes[midIndex]
      : (hikes[midIndex - 1] + hikes[midIndex]) / 2;

  return {
    insufficientData: false,
    eventCount: events.length,
    timeSpanYears: Number(timeSpanYears.toFixed(2)),
    lambdaEstimated: Number(lambdaEstimated.toFixed(2)),
    triangularMin: Number(triangularMin.toFixed(4)),
    triangularMode: Number(triangularMode.toFixed(4)),
    triangularMax: Number(triangularMax.toFixed(4)),
    hikesObserved: hikes,
    sourceEventIds: events.map((e) => e.id),
  };
}

