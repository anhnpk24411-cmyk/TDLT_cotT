export const STANDARD_SUS_QUESTIONS = [
  'Tôi nghĩ rằng tôi muốn sử dụng hệ thống này thường xuyên.',
  'Tôi thấy hệ thống này phức tạp một cách không cần thiết.',
  'Tôi nghĩ hệ thống này rất dễ sử dụng.',
  'Tôi nghĩ rằng tôi sẽ cần sự hỗ trợ của một chuyên gia kỹ thuật để có thể sử dụng hệ thống này.',
  'Tôi thấy các tính năng trong hệ thống này được tích hợp rất tốt.',
  'Tôi nghĩ rằng hệ thống này có quá nhiều điểm thiếu nhất quán.',
  'Tôi tưởng tượng rằng hầu hết mọi người sẽ học cách sử dụng hệ thống này rất nhanh.',
  'Tôi thấy hệ thống này rất cồng kềnh và khó thao tác.',
  'Tôi cảm thấy rất tự tin khi sử dụng hệ thống này.',
  'Tôi cần phải học rất nhiều điều trước khi có thể bắt đầu sử dụng hệ thống này.',
];

export interface SusCalculationResult {
  score: number; // 0 to 100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  adjective: string;
  percentileRank: number; // Estimated percentile based on Bangor et al. (2008)
}

/**
 * Calculates standard System Usability Scale (SUS) score from 10 ratings (1 to 5).
 */
export function calculateSusScore(answers: number[]): SusCalculationResult {
  if (!answers || answers.length !== 10) {
    throw new Error('Khảo sát SUS yêu cầu trả lời đủ 10 câu hỏi.');
  }

  let totalScoreContribution = 0;

  for (let i = 0; i < 10; i++) {
    const val = Math.max(1, Math.min(5, Math.round(answers[i])));
    // Odd index in 0-based is questions 1, 3, 5, 7, 9 -> index 0, 2, 4, 6, 8
    if (i % 2 === 0) {
      totalScoreContribution += val - 1;
    } else {
      // Even questions 2, 4, 6, 8, 10 -> index 1, 3, 5, 7, 9
      totalScoreContribution += 5 - val;
    }
  }

  const score = totalScoreContribution * 2.5;

  let grade: SusCalculationResult['grade'] = 'F';
  let adjective = 'Không chấp nhận được (Not Acceptable)';
  let percentileRank = 15;

  if (score >= 80.3) {
    grade = 'A';
    adjective = 'Xuất sắc (Excellent)';
    percentileRank = 90;
  } else if (score >= 68.0) {
    grade = 'B';
    adjective = 'Tốt (Good, vượt chuẩn trung bình ngành 68đ)';
    percentileRank = 70;
  } else if (score >= 51.0) {
    grade = 'C';
    adjective = 'Khá / Trung bình (OK, cần tinh chỉnh thêm)';
    percentileRank = 40;
  } else {
    grade = 'F';
    adjective = 'Kém / Khó sử dụng (Poor)';
    percentileRank = 15;
  }

  return {
    score: Number(score.toFixed(1)),
    grade,
    adjective,
    percentileRank,
  };
}

