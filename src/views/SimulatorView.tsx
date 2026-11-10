import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database.ts';
import { ScenarioRunLog } from '../engine/types.ts';
import { SimulationConfig, SimulationResult, runSimulation, HistogramBin } from '../engine/simulation.ts';
import { CalibrationPanel } from '../components/simulator/CalibrationPanel.tsx';
import { KpiCard } from '../components/common/KpiCard.tsx';
import { AssumptionsPanel } from '../components/common/AssumptionsPanel.tsx';
import { formatVND, formatPercent } from '../utils/formatters.ts';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import {
  Activity,
  RotateCcw,
  Square,
  BookmarkPlus,
  Sliders,
  DollarSign,
  TrendingDown,
  AlertOctagon,
  Percent,
  Compass,
  Zap,
} from 'lucide-react';

export const SimulatorView: React.FC = () => {
  const orders         = useLiveQuery(() => db.orders.toArray(), []) ?? [];
  const products       = useLiveQuery(() => db.products.toArray(), []) ?? [];
  const feeSchedules   = useLiveQuery(() => db.fee_schedules.where('is_active').equals(1).toArray(), []) ?? [];
  const activeTaxPolicy = useLiveQuery(() => db.tax_policies.where('is_active').equals(1).first(), []);

  const [mode, setMode]                       = useState<'preset' | 'stochastic'>('preset');
  const [presetDelta, setPresetDelta]         = useState<number>(0.03);
  const [iterations, setIterations]           = useState<number>(10000);
  const [seed, setSeed]                       = useState<number>(42);
  const [lambda, setLambda]                   = useState<number>(2.0);
  const [triangularMin, setTriangularMin]     = useState<number>(0.01);
  const [triangularMode, setTriangularMode]   = useState<number>(0.02);
  const [triangularMax, setTriangularMax]     = useState<number>(0.04);
  const [uncertaintyReturnRate, setUncertaintyReturnRate] = useState<boolean>(false);
  const [uncertaintyAdCost, setUncertaintyAdCost]         = useState<boolean>(false);
  const [isRunning, setIsRunning]             = useState<boolean>(false);
  const [progress, setProgress]               = useState<number>(0);
  const [result, setResult]                   = useState<SimulationResult | null>(null);
  const [savedScenarios, setSavedScenarios]   = useState<Array<{ name: string; result: SimulationResult }>>([]);
  const [showCalibration, setShowCalibration] = useState<boolean>(false);

  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    return () => { if (workerRef.current) workerRef.current.terminate(); };
  }, []);

  const handleApplyCalibratedParams = (params: {
    lambda: number; triangularMin: number; triangularMode: number; triangularMax: number;
  }) => {
    setLambda(params.lambda);
    setTriangularMin(params.triangularMin);
    setTriangularMode(params.triangularMode);
    setTriangularMax(params.triangularMax);
    setMode('stochastic');
    setShowCalibration(false);
  };

  const handleStartSimulation = () => {
    if (orders.length === 0) {
      alert('Không có dữ liệu đơn hàng. Vui lòng vào tab "Dữ liệu" để nhập CSV hoặc tạo dữ liệu Demo.');
      return;
    }
    setIsRunning(true);
    setProgress(0);
    const config: SimulationConfig = {
      mode, presetCommissionDelta: mode === 'preset' ? presetDelta : undefined,
      iterations, seed, lambda, triangularMin, triangularMode, triangularMax,
      uncertaintyReturnRate, uncertaintyAdCost,
    };
    try {
      if (typeof Worker !== 'undefined') {
        if (workerRef.current) workerRef.current.terminate();
        const worker = new Worker(new URL('../workers/simulator.worker.ts', import.meta.url), { type: 'module' });
        workerRef.current = worker;
        worker.onmessage = async (e: MessageEvent) => {
          const { data } = e;
          if (data.type === 'PROGRESS') {
            setProgress(data.progress);
          } else if (data.type === 'COMPLETE') {
            const simResult: SimulationResult = data.payload;
            setResult(simResult);
            setIsRunning(false);
            setProgress(100);
            const logEntry: ScenarioRunLog = {
              id: `RUN-${Date.now()}`, timestamp: new Date().toISOString(),
              seed: simResult.config.seed, parameters_snapshot: simResult.config,
              outputs: {
                baselineProfit: simResult.baselineProfit,
                expectedProfit: simResult.metrics.expectedProfit,
                pLoss: simResult.metrics.pLoss, var95: simResult.metrics.var95,
                cvar95: simResult.metrics.cvar95, feeTolerance: simResult.feeTolerance,
              },
            };
            await db.scenario_runs.add(logEntry);
          } else if (data.type === 'CANCELLED') {
            setIsRunning(false); setProgress(0);
          } else if (data.type === 'ERROR') {
            alert(`Lỗi mô phỏng: ${data.error}`); setIsRunning(false);
          }
        };
        worker.postMessage({ type: 'START', payload: { orders, products, feeSchedules, config } });
        return;
      }
    } catch (err) {
      console.warn('Worker failed, fallback:', err);
    }
    setTimeout(async () => {
      try {
        const simResult = runSimulation(orders, products, feeSchedules, config, (prog: number) => setProgress(prog));
        setResult(simResult);
        const logEntry: ScenarioRunLog = {
          id: `RUN-${Date.now()}`, timestamp: new Date().toISOString(),
          seed: simResult.config.seed, parameters_snapshot: simResult.config,
          outputs: {
            baselineProfit: simResult.baselineProfit,
            expectedProfit: simResult.metrics.expectedProfit,
            pLoss: simResult.metrics.pLoss, var95: simResult.metrics.var95,
            cvar95: simResult.metrics.cvar95, feeTolerance: simResult.feeTolerance,
          },
        };
        await db.scenario_runs.add(logEntry);
      } catch (err: any) {
        alert(`Lỗi: ${err.message}`);
      } finally {
        setIsRunning(false);
      }
    }, 50);
  };

  const handleCancel = () => {
    if (workerRef.current) { workerRef.current.postMessage({ type: 'CANCEL' }); workerRef.current.terminate(); workerRef.current = null; }
    setIsRunning(false); setProgress(0);
  };

  const handleSaveScenario = () => {
    if (!result) return;
    const name = prompt('Đặt tên kịch bản:', mode === 'preset' ? `Cố định +${(presetDelta * 100).toFixed(0)}pp` : `Ngẫu nhiên λ=${lambda}`);
    if (name) setSavedScenarios([...savedScenarios, { name, result }]);
  };

  const presets = [
    { label: '+1 pp', sublabel: 'Sốc nhẹ', val: 0.01, color: '#10b981' },
    { label: '+3 pp', sublabel: 'Sốc trung bình', val: 0.03, color: '#f59e0b' },
    { label: '+5 pp', sublabel: 'Sốc nặng', val: 0.05, color: '#ef4444' },
  ];

  return (
    <div className="space-y-5">
      {/* Hero banner */}
      <div
        className="rounded-2xl p-5 flex items-center justify-between"
        style={{
          background: 'linear-gradient(135deg, #1a2744 0%, #243461 60%, #1e3a7a 100%)',
          boxShadow: '0 4px 20px rgba(26,39,68,0.2)',
        }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(59,111,232,0.3)' }}
          >
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-base">Mô Phỏng Sốc Phí Sàn — Monte Carlo</p>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Chạy {iterations.toLocaleString('vi-VN')} kịch bản ngẫu nhiên để đo sức bền tài chính khi sàn TMĐT tăng phí đột ngột
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowCalibration(!showCalibration)}
          className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold cursor-pointer flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}
        >
          <Sliders className="w-4 h-4" />
          {showCalibration ? 'Ẩn hiệu chuẩn' : 'Hiệu chuẩn'}
        </button>
      </div>

      {showCalibration && <CalibrationPanel onApplyParameters={handleApplyCalibratedParams} />}

      {/* Control Panel */}
      <div
        className="bg-white rounded-2xl p-5 space-y-5"
        style={{ boxShadow: '0 1px 4px rgba(26,39,68,0.07), 0 0 0 1px rgba(59,111,232,0.07)' }}
      >
        {/* Mode switcher + seed/iterations row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Mode tabs */}
          <div
            className="flex items-center p-1 rounded-xl"
            style={{ background: '#f0f2ff' }}
          >
            {(['preset', 'stochastic'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all"
                style={
                  mode === m
                    ? { background: 'white', color: '#1a2744', boxShadow: '0 1px 4px rgba(26,39,68,0.1)' }
                    : { background: 'transparent', color: '#94a3b8' }
                }
              >
                {m === 'preset' ? 'Kịch bản mẫu' : 'Ngẫu nhiên (Stochastic)'}
              </button>
            ))}
          </div>

          {/* Seed & iterations */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium" style={{ color: '#64748b' }}>Seed:</span>
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(parseInt(e.target.value) || 0)}
                className="w-20 px-2.5 py-1.5 rounded-lg font-mono text-sm text-center"
                style={{ border: '1px solid rgba(59,111,232,0.2)', color: '#1a2744', background: '#f8faff' }}
              />
              <button
                type="button"
                onClick={() => setSeed(Math.floor(Math.random() * 1_000_000))}
                className="p-1.5 rounded-lg cursor-pointer"
                style={{ background: '#f0f2ff', color: '#3b6fe8' }}
                title="Seed ngẫu nhiên"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium" style={{ color: '#64748b' }}>Số lần chạy:</span>
              <select
                value={iterations}
                onChange={(e) => setIterations(parseInt(e.target.value))}
                className="px-2.5 py-1.5 rounded-lg font-mono text-sm"
                style={{ border: '1px solid rgba(59,111,232,0.2)', color: '#1a2744', background: '#f8faff' }}
              >
                <option value={1000}>1.000</option>
                <option value={5000}>5.000</option>
                <option value={10000}>10.000 ✓</option>
                <option value={20000}>20.000</option>
              </select>
            </div>
          </div>
        </div>

        {/* Dynamic params */}
        {mode === 'preset' ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#94a3b8' }}>
              Chọn mức sốc tăng phí hoa hồng
            </p>
            <div className="grid grid-cols-3 gap-3">
              {presets.map((p) => (
                <button
                  key={p.val}
                  type="button"
                  onClick={() => setPresetDelta(p.val)}
                  className="p-4 text-left rounded-2xl cursor-pointer transition-all"
                  style={
                    presetDelta === p.val
                      ? {
                          background: `${p.color}10`,
                          border: `2px solid ${p.color}`,
                          boxShadow: `0 0 0 3px ${p.color}20`,
                        }
                      : {
                          background: '#fafbff',
                          border: '1px solid rgba(59,111,232,0.1)',
                        }
                  }
                >
                  <div
                    className="text-xl font-bold font-mono-num mb-1"
                    style={{ color: presetDelta === p.val ? p.color : '#1a2744' }}
                  >
                    {p.label}
                  </div>
                  <div className="text-xs font-semibold" style={{ color: p.color }}>{p.sublabel}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>
              Tham số phân phối Poisson + Triangular
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                { label: `Tần suất tăng phí (λ)`, value: `${lambda} lần/năm`, min: 0.5, max: 8.0, step: 0.5, val: lambda, setter: setLambda, suffix: '' },
                { label: `Biên độ Min`, value: `+${(triangularMin * 100).toFixed(1)} pp`, min: 0.005, max: 0.03, step: 0.005, val: triangularMin, setter: setTriangularMin, suffix: '' },
                { label: `Biên độ Mode`, value: `+${(triangularMode * 100).toFixed(1)} pp`, min: triangularMin, max: triangularMax, step: 0.005, val: triangularMode, setter: setTriangularMode, suffix: '' },
                { label: `Biên độ Max`, value: `+${(triangularMax * 100).toFixed(1)} pp`, min: 0.03, max: 0.10, step: 0.01, val: triangularMax, setter: setTriangularMax, suffix: '' },
              ].map((param) => (
                <div key={param.label}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold" style={{ color: '#475569' }}>{param.label}</label>
                    <span className="text-xs font-bold font-mono-num" style={{ color: '#3b6fe8' }}>{param.value}</span>
                  </div>
                  <input
                    type="range"
                    min={param.min}
                    max={param.max}
                    step={param.step}
                    value={param.val}
                    onChange={(e) => param.setter(parseFloat(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                    style={{ accentColor: '#3b6fe8' }}
                  />
                </div>
              ))}
            </div>
            <div
              className="flex flex-wrap gap-4 pt-4 text-sm"
              style={{ borderTop: '1px solid rgba(59,111,232,0.08)' }}
            >
              {[
                { label: 'Bất định tỷ lệ hoàn hàng (±20%)', val: uncertaintyReturnRate, setter: setUncertaintyReturnRate },
                { label: 'Bất định chi phí Ads (-10% đến +40%)', val: uncertaintyAdCost, setter: setUncertaintyAdCost },
              ].map((cb) => (
                <label key={cb.label} className="inline-flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cb.val}
                    onChange={(e) => cb.setter(e.target.checked)}
                    className="w-4 h-4 rounded"
                    style={{ accentColor: '#3b6fe8' }}
                  />
                  <span style={{ color: '#475569' }}>{cb.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Run button + progress */}
        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4"
          style={{ borderTop: '1px solid rgba(59,111,232,0.08)' }}
        >
          <div className="flex items-center gap-3">
            {isRunning ? (
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl font-bold text-sm cursor-pointer"
                style={{ background: '#ef4444', color: 'white', boxShadow: '0 2px 8px rgba(239,68,68,0.3)' }}
              >
                <Square className="w-4 h-4" />
                Dừng mô phỏng ({progress}%)
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartSimulation}
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl font-bold text-sm cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #3b6fe8 0%, #60a5fa 100%)', color: 'white', boxShadow: '0 2px 12px rgba(59,111,232,0.4)' }}
              >
                <Zap className="w-4 h-4" />
                Chạy mô phỏng ({iterations.toLocaleString('vi-VN')} lần)
              </button>
            )}
            {result && !isRunning && (
              <button
                type="button"
                onClick={handleSaveScenario}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm cursor-pointer"
                style={{ background: '#f0f2ff', color: '#3b6fe8' }}
              >
                <BookmarkPlus className="w-4 h-4" />
                Lưu kịch bản
              </button>
            )}
          </div>

          {isRunning && (
            <div className="w-full sm:w-72 space-y-1.5">
              <div className="flex justify-between text-xs font-mono" style={{ color: '#64748b' }}>
                <span>Web Worker đang chạy...</span>
                <span className="font-bold" style={{ color: '#3b6fe8' }}>{progress}%</span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: '#e8eeff' }}>
                <div
                  className="h-full rounded-full transition-all duration-150"
                  style={{
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, #3b6fe8 0%, #60a5fa 100%)',
                    boxShadow: '0 0 8px rgba(59,111,232,0.5)',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-5">
          {/* Resilience KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Lợi nhuận kỳ vọng E[Profit]"
              value={formatVND(result.metrics.expectedProfit)}
              subtext={`Gốc: ${formatVND(result.baselineProfit)}`}
              icon={<DollarSign className="w-5 h-5" />}
              variant={result.metrics.expectedProfit > 0 ? 'default' : 'danger'}
              accentColor={result.metrics.expectedProfit > 0 ? '#3b6fe8' : '#ef4444'}
            />
            <KpiCard
              title="Tỷ lệ giữ lợi nhuận"
              value={
                result.metrics.retentionRatioState === 'VALID'
                  ? `${(result.metrics.profitRetentionRatio * 100).toFixed(1)}%`
                  : 'N/A'
              }
              subtext="E[Shock] / Baseline profit"
              icon={<Percent className="w-5 h-5" />}
              variant={result.metrics.profitRetentionRatio >= 0.7 ? 'success' : 'warning'}
              accentColor={result.metrics.profitRetentionRatio >= 0.7 ? '#10b981' : '#f59e0b'}
            />
            <KpiCard
              title="Xác suất thua lỗ P(loss)"
              value={formatPercent(result.metrics.pLoss)}
              subtext="Tỷ lệ runs có profit < 0"
              icon={<AlertOctagon className="w-5 h-5" />}
              variant={result.metrics.pLoss > 0.05 ? 'danger' : 'default'}
              accentColor={result.metrics.pLoss > 0.05 ? '#ef4444' : '#10b981'}
            />
            <KpiCard
              title="Biên chịu phí tối đa"
              value={
                result.feeTolerance.state === 'SOLVED'
                  ? `+${result.feeTolerance.tolerancePercentagePoints.toFixed(2)} pp`
                  : result.feeTolerance.state === 'ALREADY_NEGATIVE'
                  ? 'Đã âm'
                  : '> 100 pp'
              }
              subtext="Tăng hoa hồng tối đa trước khi lỗ"
              icon={<Compass className="w-5 h-5" />}
              variant={result.feeTolerance.tolerancePercentagePoints >= 3 ? 'default' : result.feeTolerance.tolerancePercentagePoints >= 1 ? 'warning' : 'danger'}
              accentColor="#6366f1"
            />
          </div>

          {/* VaR + CVaR */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                label: 'Rủi ro đuôi VaR 95% (5th Percentile)',
                desc: 'Trong 95% trường hợp, lợi nhuận sẽ không thấp hơn ngưỡng này.',
                value: formatVND(result.metrics.var95),
                icon: <TrendingDown className="w-7 h-7" style={{ color: '#f59e0b' }} />,
                color: '#f59e0b',
              },
              {
                label: 'Tổn thất CVaR 95% (Expected Shortfall)',
                desc: 'Lợi nhuận trung bình trong 5% kịch bản xấu nhất.',
                value: formatVND(result.metrics.cvar95),
                icon: <AlertOctagon className="w-7 h-7" style={{ color: '#ef4444' }} />,
                color: '#ef4444',
              },
            ].map((item) => (
              <div
                key={item.label}
                className="bg-white rounded-2xl p-5 flex items-start justify-between gap-4"
                style={{ boxShadow: '0 1px 4px rgba(26,39,68,0.07), 0 0 0 1px rgba(59,111,232,0.07)' }}
              >
                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#94a3b8' }}>
                    {item.label}
                  </p>
                  <p className="text-2xl font-bold font-mono-num" style={{ color: item.color }}>
                    {item.value}
                  </p>
                  <p className="text-xs mt-1.5" style={{ color: '#94a3b8' }}>{item.desc}</p>
                </div>
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${item.color}12` }}
                >
                  {item.icon}
                </div>
              </div>
            ))}
          </div>

          {/* Histogram */}
          <div
            className="bg-white rounded-2xl p-5"
            style={{ boxShadow: '0 1px 4px rgba(26,39,68,0.07), 0 0 0 1px rgba(59,111,232,0.07)' }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h3 className="font-bold text-sm" style={{ color: '#1a2744' }}>
                  Phân Phối Lợi Nhuận — {result.config.iterations.toLocaleString('vi-VN')} kịch bản
                </h3>
                <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
                  Seed: <span className="font-mono font-semibold">{result.config.seed}</span> · Chạy trong {result.executionTimeMs} ms
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
                {[
                  { label: 'Phân phối', color: '#3b6fe8' },
                  { label: 'Hòa vốn', color: '#94a3b8', dashed: true },
                  { label: 'VaR 95%', color: '#f59e0b' },
                  { label: 'CVaR 95%', color: '#ef4444' },
                ].map((leg) => (
                  <span key={leg.label} className="flex items-center gap-1.5">
                    <span
                      className="w-5 h-1.5 rounded-full inline-block"
                      style={{ background: leg.color, opacity: leg.dashed ? 0.5 : 1 }}
                    />
                    <span style={{ color: '#64748b' }}>{leg.label}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={result.histogram} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f2ff" />
                  <XAxis
                    dataKey="binLabel"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    interval={Math.floor(result.histogram.length / 6)}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    tickFormatter={(val) => `${val}%`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div
                            className="px-3.5 py-2.5 rounded-xl text-xs space-y-1 shadow-xl"
                            style={{ background: '#1a2744', color: 'white' }}
                          >
                            <p className="font-semibold" style={{ color: '#93c5fd' }}>
                              {formatVND(d.binStart)} → {formatVND(d.binEnd)}
                            </p>
                            <p className="font-mono">{d.count.toLocaleString('vi-VN')} kịch bản ({d.percentage}%)</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine
                    x={result.histogram.find((b: HistogramBin) => b.binStart <= 0 && b.binEnd >= 0)?.binLabel}
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    label={{ value: 'Hòa vốn', position: 'top', fill: '#94a3b8', fontSize: 10 }}
                  />
                  <ReferenceLine
                    x={result.histogram.find((b: HistogramBin) => b.binStart <= result.metrics.var95 && b.binEnd >= result.metrics.var95)?.binLabel}
                    stroke="#f59e0b"
                    strokeWidth={2}
                    label={{ value: 'VaR95', position: 'insideTopLeft', fill: '#f59e0b', fontSize: 10 }}
                  />
                  <ReferenceLine
                    x={result.histogram.find((b: HistogramBin) => b.binStart <= result.metrics.cvar95 && b.binEnd >= result.metrics.cvar95)?.binLabel}
                    stroke="#ef4444"
                    strokeWidth={2}
                    label={{ value: 'CVaR', position: 'insideTopRight', fill: '#ef4444', fontSize: 10 }}
                  />
                  <Bar dataKey="percentage" fill="#3b6fe8" radius={[4, 4, 0, 0]} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Scenario comparison */}
          {savedScenarios.length > 0 && (
            <div
              className="bg-white rounded-2xl p-5"
              style={{ boxShadow: '0 1px 4px rgba(26,39,68,0.07), 0 0 0 1px rgba(59,111,232,0.07)' }}
            >
              <h3 className="font-bold text-sm mb-4" style={{ color: '#1a2744' }}>
                So Sánh Các Kịch Bản ({savedScenarios.length})
              </h3>
              <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid rgba(59,111,232,0.08)' }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: '#f8faff' }}>
                      {['Kịch bản', 'Chế độ', 'E[Profit]', 'Retention', 'P(loss)', 'VaR95', 'Fee Tolerance'].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left font-semibold" style={{ color: '#475569' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody style={{ background: 'white' }}>
                    {savedScenarios.map((sc, idx) => (
                      <tr key={idx} style={{ borderTop: '1px solid rgba(59,111,232,0.07)' }}>
                        <td className="px-3 py-2.5 font-semibold" style={{ color: '#1a2744' }}>{sc.name}</td>
                        <td className="px-3 py-2.5" style={{ color: '#64748b' }}>{sc.result.config.mode === 'preset' ? 'Cố định' : 'Ngẫu nhiên'}</td>
                        <td className="px-3 py-2.5 font-mono font-bold" style={{ color: '#3b6fe8' }}>{formatVND(sc.result.metrics.expectedProfit)}</td>
                        <td className="px-3 py-2.5 font-mono" style={{ color: '#64748b' }}>{(sc.result.metrics.profitRetentionRatio * 100).toFixed(1)}%</td>
                        <td className="px-3 py-2.5 font-mono" style={{ color: '#f59e0b' }}>{formatPercent(sc.result.metrics.pLoss)}</td>
                        <td className="px-3 py-2.5 font-mono" style={{ color: '#64748b' }}>{formatVND(sc.result.metrics.var95)}</td>
                        <td className="px-3 py-2.5 font-mono font-semibold" style={{ color: '#6366f1' }}>+{sc.result.feeTolerance.tolerancePercentagePoints.toFixed(2)} pp</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Run params */}
          <div
            className="rounded-2xl p-4"
            style={{ background: 'rgba(240,242,255,0.6)', border: '1px solid rgba(59,111,232,0.1)' }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#94a3b8' }}>
              Tham số lần chạy
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Chế độ', value: result.config.mode === 'preset' ? 'Kịch bản mẫu' : 'Ngẫu nhiên' },
                { label: 'Số lần lặp', value: result.config.iterations.toLocaleString('vi-VN') },
                { label: 'Seed (mulberry32)', value: String(result.config.seed) },
                { label: 'λ (tần suất)', value: `${result.config.lambda}/năm` },
                { label: 'Biên độ (min/mode/max)', value: `${(result.config.triangularMin * 100).toFixed(0)}/${(result.config.triangularMode * 100).toFixed(0)}/${(result.config.triangularMax * 100).toFixed(0)} pp` },
                { label: 'Thời gian chạy', value: `${result.executionTimeMs} ms`, highlight: true },
              ].map((item) => (
                <div key={item.label} className="bg-white rounded-xl px-3 py-2.5" style={{ border: '1px solid rgba(59,111,232,0.08)' }}>
                  <p className="text-[10px] mb-0.5" style={{ color: '#94a3b8' }}>{item.label}</p>
                  <p className="text-xs font-bold font-mono-num" style={{ color: item.highlight ? '#3b6fe8' : '#1a2744' }}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <AssumptionsPanel feeSchedules={feeSchedules} taxPolicy={activeTaxPolicy} compact />
        </div>
      )}
    </div>
  );
};
