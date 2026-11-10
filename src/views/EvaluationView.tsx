import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database.ts';
import { SusResponse } from '../engine/types.ts';
import { STANDARD_SUS_QUESTIONS, calculateSusScore } from '../engine/sus.ts';
import {
  runRadarBenchmark,
  exportBenchmarkCsv,
  SYNTHETIC_GOLD_DATASET,
  ExtractorBenchmarkResult,
} from '../engine/benchmark.ts';
import { RuleExtractor } from '../radar/extractors/rule_extractor.ts';
import { MockExtractor } from '../radar/extractors/mock_extractor.ts';
import { LlmExtractor } from '../radar/extractors/llm_extractor.ts';
import { formatVND, formatPercent } from '../utils/formatters.ts';
import {
  FileCheck,
  Download,
  Trash2,
  Play,
  ClipboardList,
  CheckCircle,
  BarChart2,
} from 'lucide-react';

export const EvaluationView: React.FC = () => {
  const scenarioRuns = useLiveQuery(() => db.scenario_runs.reverse().toArray(), []) ?? [];
  const susResponses = useLiveQuery(() => db.sus_responses.reverse().toArray(), []) ?? [];

  const [activeTab, setActiveTab] = useState<'runs' | 'sus' | 'benchmark'>('runs');

  // SUS State
  const [susAnswers, setSusAnswers] = useState<number[]>(new Array(10).fill(3));
  const [participantCode, setParticipantCode] = useState<string>('');
  const [susSuccessMessage, setSusSuccessMessage] = useState<string | null>(null);

  // Benchmark State
  const [benchmarkResults, setBenchmarkResults] = useState<ExtractorBenchmarkResult[]>([]);
  const [isRunningBenchmark, setIsRunningBenchmark] = useState<boolean>(false);
  const [customDatasetJson, setCustomDatasetJson] = useState<string>('');
  const [datasetNoticeCount, setDatasetNoticeCount] = useState<number>(SYNTHETIC_GOLD_DATASET.length);

  // 1. Scenario Runs Handlers
  const handleExportRunsCsv = () => {
    if (scenarioRuns.length === 0) {
      alert('Chưa có lịch sử chạy mô phỏng để xuất.');
      return;
    }

    const headers = [
      'Id',
      'Timestamp',
      'Seed',
      'Mode',
      'Iterations',
      'BaselineProfit_VND',
      'ExpectedProfit_VND',
      'PLoss_pct',
      'VaR95_VND',
      'CVaR95_VND',
    ];

    const rows = scenarioRuns.map((r) => [
      r.id,
      r.timestamp,
      r.seed,
      r.parameters_snapshot?.mode || 'stochastic',
      r.parameters_snapshot?.iterations || 10000,
      Math.round(r.outputs?.baselineProfit || 0),
      Math.round(r.outputs?.expectedProfit || 0),
      Number(((r.outputs?.pLoss || 0) * 100).toFixed(2)),
      Math.round(r.outputs?.var95 || 0),
      Math.round(r.outputs?.cvar95 || 0),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `scenario_runs_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClearRuns = async () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử các lần chạy mô phỏng?')) {
      await db.scenario_runs.clear();
    }
  };

  // 2. SUS Form Submit
  const handleSusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = calculateSusScore(susAnswers);

    const record: SusResponse = {
      timestamp: new Date().toISOString(),
      participant_code: participantCode.trim() || undefined,
      answers: susAnswers,
      calculated_score: result.score,
    };

    await db.sus_responses.add(record);
    setSusSuccessMessage(`Đã ghi nhận khảo sát thành công! Điểm SUS của bạn: ${result.score}/100 (Hạng ${result.grade} - ${result.adjective})`);
    setSusAnswers(new Array(10).fill(3));
    setParticipantCode('');
  };

  // 3. Benchmark Execution
  const handleRunBenchmark = async () => {
    setIsRunningBenchmark(true);
    try {
      let dataset = SYNTHETIC_GOLD_DATASET;
      if (customDatasetJson.trim()) {
        const parsed = JSON.parse(customDatasetJson);
        if (Array.isArray(parsed) && parsed.length > 0) {
          dataset = parsed;
          setDatasetNoticeCount(dataset.length);
        }
      }

      const ruleExtractor = new RuleExtractor();
      const mockExtractor = new MockExtractor();

      const ruleResult = await runRadarBenchmark(ruleExtractor, dataset);
      const mockResult = await runRadarBenchmark(mockExtractor, dataset);

      // Check if LLM is configured
      const llmSetting = await db.settings.get('llm_config');
      if (llmSetting && llmSetting.value && llmSetting.value.apiKey) {
        const llmExtractor = new LlmExtractor(llmSetting.value);
        const llmResult = await runRadarBenchmark(llmExtractor, dataset);
        setBenchmarkResults([ruleResult, llmResult, mockResult]);
      } else {
        setBenchmarkResults([ruleResult, mockResult]);
      }
    } catch (err: any) {
      alert(`Lỗi thực thi benchmark: ${err.message}`);
    } finally {
      setIsRunningBenchmark(false);
    }
  };

  const handleExportBenchmarkCsv = () => {
    if (benchmarkResults.length === 0) return;
    const csv = exportBenchmarkCsv(benchmarkResults);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `radar_benchmark_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileCheck className="w-6 h-6 text-slate-700" />
            Bộ Công Cụ Đánh Giá Nghiên Cứu (Research Evaluation Suite)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Ghi nhật ký kịch bản mô phỏng, khảo sát khả năng sử dụng SUS tiêu chuẩn và Benchmark độ chính xác Radar (F1-score).
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('runs')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'runs'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Nhật ký kịch bản ({scenarioRuns.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sus')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'sus'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Khảo sát SUS ({susResponses.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('benchmark')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'benchmark'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Radar Benchmark
          </button>
        </div>
      </div>

      {/* Tab 1: Scenario Runs */}
      {activeTab === 'runs' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">
                Nhật Ký Các Lần Chạy Mô Phỏng Sốc Phí ({scenarioRuns.length} bản ghi)
              </h3>
              <p className="text-xs text-slate-500">
                Toàn bộ tham số đầu vào, seed tái lập và kết quả rủi ro được lưu trữ phục vụ phân tích dữ liệu nghiên cứu.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClearRuns}
                disabled={scenarioRuns.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-red-600 bg-slate-100 hover:bg-red-50 rounded-lg transition cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" /> Xóa lịch sử
              </button>
              <button
                type="button"
                onClick={handleExportRunsCsv}
                disabled={scenarioRuns.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" /> Xuất CSV (Ẩn danh)
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                  <th className="p-2.5">Thời điểm</th>
                  <th className="p-2.5">Chế độ</th>
                  <th className="p-2.5 text-center font-mono">Seed</th>
                  <th className="p-2.5 text-right font-mono">Số lần lặp</th>
                  <th className="p-2.5 text-right">E[Profit]</th>
                  <th className="p-2.5 text-right">P(loss)</th>
                  <th className="p-2.5 text-right">VaR95</th>
                  <th className="p-2.5 text-right">Biên chịu phí</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scenarioRuns.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-400">
                      Chưa có lần chạy mô phỏng nào được ghi nhận. Vào tab &quot;Mô phỏng phí&quot; để thực hiện.
                    </td>
                  </tr>
                ) : (
                  scenarioRuns.map((run) => (
                    <tr key={run.id} className="hover:bg-slate-50/50">
                      <td className="p-2.5 text-slate-600 font-mono text-[11px]">
                        {new Date(run.timestamp).toLocaleString('vi-VN')}
                      </td>
                      <td className="p-2.5 text-slate-800 font-medium">
                        {run.parameters_snapshot?.mode === 'preset' ? 'Cố định' : 'Ngẫu nhiên'}
                      </td>
                      <td className="p-2.5 text-center font-mono text-slate-700">{run.seed}</td>
                      <td className="p-2.5 text-right font-mono text-slate-700">
                        {(run.parameters_snapshot?.iterations || 10000).toLocaleString('vi-VN')}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-blue-600">
                        {formatVND(run.outputs?.expectedProfit || 0)}
                      </td>
                      <td className="p-2.5 text-right font-mono text-amber-600">
                        {formatPercent(run.outputs?.pLoss || 0)}
                      </td>
                      <td className="p-2.5 text-right font-mono text-slate-700">
                        {formatVND(run.outputs?.var95 || 0)}
                      </td>
                      <td className="p-2.5 text-right font-mono font-semibold text-purple-700">
                        {run.outputs?.feeTolerance?.tolerancePercentagePoints
                          ? `+${run.outputs.feeTolerance.tolerancePercentagePoints.toFixed(2)} pp`
                          : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: SUS Questionnaire */}
      {activeTab === 'sus' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-emerald-600" />
                Khảo Sát Thang Đo Khả Năng Sử Dụng Tiêu Chuẩn (System Usability Scale - SUS)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Thang đo 10 câu hỏi chuẩn (Brooke, 1996) đo lường mức độ dễ dùng, tính trực quan và sự nhất quán của ứng dụng (điểm từ 0 đến 100).
              </p>
            </div>

            {susSuccessMessage && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{susSuccessMessage}</span>
              </div>
            )}

            <form onSubmit={handleSusSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Mã người tham gia (Tùy chọn, ẩn danh):
                </label>
                <input
                  type="text"
                  value={participantCode}
                  onChange={(e) => setParticipantCode(e.target.value)}
                  placeholder="Ví dụ: P01, SELLER-HCM..."
                  className="w-48 bg-white border border-slate-300 rounded-lg p-2 font-mono"
                />
              </div>

              <div className="space-y-3 pt-2">
                {STANDARD_SUS_QUESTIONS.map((question, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <span className="font-medium text-slate-800 text-xs">
                      {idx + 1}. {question}
                    </span>

                    <div className="flex items-center gap-4 shrink-0">
                      <span className="text-[10px] text-slate-400 font-semibold">Hoàn toàn phản đối</span>
                      <div className="flex items-center gap-2.5">
                        {[1, 2, 3, 4, 5].map((val) => (
                          <label
                            key={val}
                            className="inline-flex flex-col items-center gap-0.5 cursor-pointer"
                          >
                            <input
                              type="radio"
                              name={`sus-q-${idx}`}
                              checked={susAnswers[idx] === val}
                              onChange={() => {
                                const copy = [...susAnswers];
                                copy[idx] = val;
                                setSusAnswers(copy);
                              }}
                              className="text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-[10px] text-slate-600 font-mono">{val}</span>
                          </label>
                        ))}
                      </div>
                      <span className="text-[10px] text-slate-400 font-semibold">Hoàn toàn đồng ý</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs cursor-pointer text-xs"
                >
                  Nộp Đánh Giá & Tính Điểm SUS
                </button>
              </div>
            </form>
          </div>

          {/* Past SUS Submissions */}
          {susResponses.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-3">
              <h3 className="font-bold text-slate-800 text-sm">
                Lịch Sử Phản Hồi Khảo Sát SUS ({susResponses.length} lượt nộp)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                      <th className="p-2.5">Thời gian</th>
                      <th className="p-2.5">Mã người tham gia</th>
                      <th className="p-2.5 text-right font-mono">Điểm SUS (0 - 100)</th>
                      <th className="p-2.5 text-center">Xếp loại</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {susResponses.map((r, i) => {
                      const grade =
                        r.calculated_score >= 80.3
                          ? 'A'
                          : r.calculated_score >= 68
                          ? 'B'
                          : r.calculated_score >= 51
                          ? 'C'
                          : 'F';
                      return (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="p-2.5 text-slate-600 font-mono text-[11px]">
                            {new Date(r.timestamp).toLocaleString('vi-VN')}
                          </td>
                          <td className="p-2.5 text-slate-800 font-mono">
                            {r.participant_code || '(Ẩn danh)'}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-blue-600 text-sm">
                            {r.calculated_score}
                          </td>
                          <td className="p-2.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                grade === 'A'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : grade === 'B'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              Hạng {grade}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Radar Benchmark Suite */}
      {activeTab === 'benchmark' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-purple-600" />
                  Thử Nghiệm Đối Soát Radar (Radar Benchmark Suite)
                </h3>
                <p className="text-xs text-slate-500">
                  Chạy tập dữ liệu chuẩn vàng ({datasetNoticeCount} văn bản) để đo lường Precision, Recall, F1-Score, tỷ lệ phải sửa thủ công và độ trễ.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {benchmarkResults.length > 0 && (
                  <button
                    type="button"
                    onClick={handleExportBenchmarkCsv}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg shadow-xs cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Xuất Báo Cáo CSV
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleRunBenchmark}
                  disabled={isRunningBenchmark}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isRunningBenchmark ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Đang chạy benchmark...
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" /> Chạy Thử Nghiệm Đối Soát
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Custom Dataset JSON Dropdown / Input */}
            <details className="text-xs text-slate-600 space-y-2">
              <summary className="font-semibold cursor-pointer text-blue-600 hover:text-blue-800">
                Tùy chỉnh hoặc nạp thêm tập dữ liệu chuẩn vàng (Gold Standard JSON)
              </summary>
              <div className="pt-2">
                <textarea
                  rows={4}
                  value={customDatasetJson}
                  onChange={(e) => setCustomDatasetJson(e.target.value)}
                  placeholder="Dán mảng JSON chứa các mẫu văn bản và groundTruth (hoặc để trống để dùng 5 mẫu SYNTHETIC mặc định)..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono text-[11px]"
                />
              </div>
            </details>

            {/* Benchmark Comparison Table */}
            {benchmarkResults.length > 0 ? (
              <div className="space-y-4 pt-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-semibold">
                        <th className="p-3">Bộ trích xuất</th>
                        <th className="p-3 text-right">Precision (%)</th>
                        <th className="p-3 text-right">Recall (%)</th>
                        <th className="p-3 text-right">F1-Score (%)</th>
                        <th className="p-3 text-right">Cần sửa tay (%)</th>
                        <th className="p-3 text-right">Độ trễ TB (ms)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {benchmarkResults.map((b) => (
                        <tr key={b.extractorId} className="hover:bg-slate-50/50">
                          <td className="p-3 font-semibold text-slate-900 flex items-center gap-1.5">
                            {b.extractorName}
                          </td>
                          <td className="p-3 text-right font-mono font-semibold text-slate-800">
                            {b.overallPrecision}%
                          </td>
                          <td className="p-3 text-right font-mono font-semibold text-slate-800">
                            {b.overallRecall}%
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-purple-700 text-sm">
                            {b.overallF1}%
                          </td>
                          <td className="p-3 text-right font-mono text-amber-600">
                            {b.manualEditShare}%
                          </td>
                          <td className="p-3 text-right font-mono text-slate-600">
                            {b.avgTimePerNoticeMs} ms
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Per-field Breakdown for Best Extractor */}
                {benchmarkResults[0] && (
                  <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-200 space-y-3">
                    <h4 className="font-bold text-slate-800 text-xs">
                      Chi Tiết Hiệu Suất Theo Từng Trường ({benchmarkResults[0].extractorName})
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="text-slate-500 border-b border-slate-200 font-semibold">
                            <th className="py-2">Trường trích xuất</th>
                            <th className="py-2 text-center">Số nhãn chuẩn (GT)</th>
                            <th className="py-2 text-center">Trích được</th>
                            <th className="py-2 text-center">Đúng (TP)</th>
                            <th className="py-2 text-right">F1-Score</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {Object.entries(benchmarkResults[0].byField).map(([field, stat]) => (
                            <tr key={field}>
                              <td className="py-2 font-mono font-medium text-slate-800">{field}</td>
                              <td className="py-2 text-center font-mono">{stat.groundTruthCount}</td>
                              <td className="py-2 text-center font-mono">{stat.extractedCount}</td>
                              <td className="py-2 text-center font-mono text-emerald-600 font-bold">
                                {stat.truePositives}
                              </td>
                              <td className="py-2 text-right font-mono font-bold text-purple-700">
                                {stat.f1}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-12 text-center text-slate-400 text-xs">
                Chưa có dữ liệu benchmark. Bấm &quot;Chạy Thử Nghiệm Đối Soát&quot; để so sánh RuleExtractor vs LlmExtractor trên tập nhãn chuẩn.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
