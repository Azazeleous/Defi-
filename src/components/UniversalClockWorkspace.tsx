import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Play,
  Pause,
  StepForward,
  Gauge,
  ShieldCheck,
  AlertTriangle,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Cpu,
  Globe,
  FileCheck2,
  SlidersHorizontal,
  RotateCcw,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import {
  HCCGN_TIMING_CONSTANTS,
  UniversalClockSnapshot,
  ClockStateMachineStatus,
  AdaptiveControllerConfig,
  FaultInjectionConfig,
  TemporalEventReceipt,
  AcceptanceTestResult,
  TimePrecisionClassification,
} from '../contracts/universal-clock';
import {
  serializeCanonicalEventPayload,
  verifyReceiptDigestBrowser,
} from '../engine/universalClockCanonical';

type UclkStageTab = 'epoch' | 'solver' | 'lgv' | 'benchmarks';

const ALL_FSM_STATES: readonly ClockStateMachineStatus[] = [
  'INITIALIZING',
  'CLOCK_UNSYNCED',
  'CLOCK_READY',
  'RUNNING',
  'DEGRADED',
  'DEADLINE_MISSED',
  'SOLVER_PENDING',
  'SOLVER_LATE',
  'EPOCH_CLOSING',
  'EPOCH_COMPLETE',
  'FAULTED',
];

function formatStateVisual(state: ClockStateMachineStatus): {
  glyph: string;
  label: string;
  className: string;
} {
  switch (state) {
    case 'RUNNING':
    case 'CLOCK_READY':
    case 'EPOCH_COMPLETE':
      return {
        glyph: '●',
        label: state,
        className: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
      };
    case 'SOLVER_PENDING':
    case 'EPOCH_CLOSING':
    case 'INITIALIZING':
      return {
        glyph: '◆',
        label: state,
        className: 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10',
      };
    case 'DEGRADED':
    case 'CLOCK_UNSYNCED':
    case 'SOLVER_LATE':
      return {
        glyph: '▲',
        label: state,
        className: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
      };
    case 'DEADLINE_MISSED':
    case 'FAULTED':
      return {
        glyph: '✖',
        label: state,
        className: 'text-rose-400 border-rose-500/40 bg-rose-500/10',
      };
  }
}

function projectLonLat(lon: number, lat: number, width: number, height: number): { x: number; y: number } {
  const x = ((lon + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return { x, y };
}

export const UniversalClockWorkspace: React.FC = () => {
  const [snapshot, setSnapshot] = useState<UniversalClockSnapshot | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<UclkStageTab>('epoch');
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Calibration form mirror synced cleanly when kernel snapshot arrives
  const [draftConfig, setDraftConfig] = useState<AdaptiveControllerConfig | null>(null);
  const configDirtyRef = useRef<boolean>(false);

  // Acceptance test results
  const [acceptanceResults, setAcceptanceResults] = useState<AcceptanceTestResult[] | null>(null);

  // Selected receipt & verification state
  const [selectedReceipt, setSelectedReceipt] = useState<TemporalEventReceipt | null>(null);
  const [receiptVerifyResult, setReceiptVerifyResult] = useState<{
    mode: 'INTACT' | 'TAMPERED';
    browserValid: boolean;
    serverValid: boolean | null;
    recomputedDigest: string;
    expectedDigest: string;
    canonicalPayload: string;
  } | null>(null);

  // LGV timeline scrubber index
  const [lgvScrubIndex, setLgvScrubIndex] = useState<number>(0);

  const fetchSnapshot = useCallback(async () => {
    try {
      const res = await fetch('/api/uclk/snapshot');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.ok && data.snapshot) {
        setSnapshot(data.snapshot);
        if (!configDirtyRef.current) {
          setDraftConfig(data.snapshot.config);
        }
        setErrorBanner(null);
      }
    } catch (err: any) {
      setErrorBanner(`Telemetry sync error: ${err?.message || 'Unable to reach /api/uclk/snapshot'}`);
    }
  }, []);

  // Initial load + WebSocket subscription (with safe polling fallback)
  useEffect(() => {
    fetchSnapshot();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    let ws: WebSocket | null = null;
    let pollTimer: number | null = null;

    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        setWsConnected(true);
        ws?.send(JSON.stringify({ type: 'uclk:subscribe' }));
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'uclk:snapshot' && msg.snapshot) {
            setSnapshot(msg.snapshot);
            if (!configDirtyRef.current) {
              setDraftConfig(msg.snapshot.config);
            }
          }
        } catch {
          // Ignore unrelated pipeline WS frames
        }
      };
      ws.onerror = () => {
        setWsConnected(false);
      };
      ws.onclose = () => {
        setWsConnected(false);
      };
    } catch {
      setWsConnected(false);
    }

    pollTimer = window.setInterval(() => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        fetchSnapshot();
      }
    }, 1500);

    return () => {
      if (pollTimer !== null) window.clearInterval(pollTimer);
      if (ws) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'uclk:unsubscribe' }));
        }
        ws.close();
      }
    };
  }, [fetchSnapshot]);

  // Select latest receipt automatically if none selected yet
  useEffect(() => {
    if (!selectedReceipt && snapshot?.recentReceipts?.length) {
      setSelectedReceipt(snapshot.recentReceipts[0]);
    }
  }, [snapshot, selectedReceipt]);

  const postAction = useCallback(async (endpoint: string, body?: Record<string, unknown>) => {
    setIsBusy(true);
    setErrorBanner(null);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.snapshot) {
        setSnapshot(data.snapshot);
        if (!configDirtyRef.current) {
          setDraftConfig(data.snapshot.config);
        }
      }
      return data;
    } catch (err: any) {
      setErrorBanner(err?.message || `Action failed: ${endpoint}`);
      return null;
    } finally {
      setIsBusy(false);
    }
  }, []);

  const handleToggleRun = () => {
    if (!snapshot) return;
    postAction(snapshot.isRunning ? '/api/uclk/stop' : '/api/uclk/start');
  };

  const handleStepOnce = async () => {
    const data = await postAction('/api/uclk/step');
    if (data?.step?.receipt) {
      setSelectedReceipt(data.step.receipt);
      setReceiptVerifyResult(null);
    }
  };

  const handleRunTriggerSequence = async () => {
    await postAction('/api/uclk/triggers/run');
  };

  const handleApplyConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftConfig) return;
    configDirtyRef.current = false;
    await postAction('/api/uclk/config', draftConfig as unknown as Record<string, unknown>);
  };

  const handleUpdateFaults = (partial: Partial<FaultInjectionConfig>) => {
    postAction('/api/uclk/faults', partial as Record<string, unknown>);
  };

  const handleRunBenchmark = async () => {
    await postAction('/api/uclk/benchmark', { targetIntervals: 250 });
    setActiveTab('benchmarks');
  };

  const handleRunAcceptance = async () => {
    const data = await postAction('/api/uclk/acceptance');
    if (data?.results) {
      setAcceptanceResults(data.results);
      setActiveTab('benchmarks');
    }
  };

  const handleVerifyReceipt = async (receipt: TemporalEventReceipt, simulateTamper: boolean) => {
    const targetReceipt: TemporalEventReceipt = simulateTamper
      ? { ...receipt, completed_operations: receipt.completed_operations + 1 }
      : receipt;

    const { receipt_digest: _omit, ...unsigned } = targetReceipt;
    const canonicalPayload = serializeCanonicalEventPayload(unsigned);
    const browserCheck = await verifyReceiptDigestBrowser(targetReceipt);

    let serverValid: boolean | null = null;
    try {
      const res = await fetch('/api/uclk/verify-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(targetReceipt),
      });
      if (res.ok) {
        const payload = await res.json();
        serverValid = Boolean(payload?.verification?.valid);
      }
    } catch {
      serverValid = null;
    }

    setReceiptVerifyResult({
      mode: simulateTamper ? 'TAMPERED' : 'INTACT',
      browserValid: browserCheck.valid,
      serverValid,
      recomputedDigest: browserCheck.recomputedDigest,
      expectedDigest: browserCheck.expectedDigest,
      canonicalPayload,
    });
  };

  // Chart data derived from measured receipts (chronological order)
  const intervalTelemetrySeries = useMemo(() => {
    if (!snapshot?.recentReceipts?.length) return [];
    return [...snapshot.recentReceipts]
      .slice(0, 40)
      .reverse()
      .map((r) => ({
        seq: r.sequence_number,
        jitterNs: r.jitter_ns,
        execNs: r.execution_duration_ns,
        admittedOps: r.admitted_operations,
        completedOps: r.completed_operations,
      }));
  }, [snapshot?.recentReceipts]);

  // Derived LGV interpolated preview when scrubbing between adjacent measured events
  const lgvTimelineState = useMemo(() => {
    const events = snapshot?.lgvEvents ?? [];
    if (events.length === 0) {
      return {
        current: null,
        classification: 'ESTIMATED' as TimePrecisionClassification,
        interpolatedCoords: null as { lon: number; lat: number; monoNs: string } | null,
      };
    }
    const clampedIdx = Math.min(events.length - 1, Math.max(0, lgvScrubIndex));
    const ev = events[clampedIdx];
    const nextEv = events[Math.min(events.length - 1, clampedIdx + 1)];
    const interpolatedCoords =
      nextEv && nextEv.eventId !== ev.eventId
        ? {
            lon: +((ev.lon + nextEv.lon) / 2).toFixed(4),
            lat: +((ev.lat + nextEv.lat) / 2).toFixed(4),
            monoNs: (
              (BigInt(ev.monotonicNs) + BigInt(nextEv.monotonicNs)) /
              2n
            ).toString(),
          }
        : null;
    return {
      current: ev,
      classification: ev.timeClassification,
      interpolatedCoords,
    };
  }, [snapshot?.lgvEvents, lgvScrubIndex]);

  const stateMeta = formatStateVisual(snapshot?.state ?? 'INITIALIZING');
  const activeEpoch = snapshot?.activeEpoch;
  const epochElapsedPct = activeEpoch
    ? Math.min(100, Math.max(0, +(activeEpoch.measuredElapsedSec * 100).toFixed(2)))
    : 0;

  return (
    <div className="flex-1 bg-[#07090E] text-slate-100 font-uclk-sans flex flex-col min-h-[calc(100vh-65px)]">
      {/* Top Telemetry Ribbon */}
      <div className="border-b border-slate-800 bg-[#0B0F17] px-4 sm:px-6 py-3">
        <div className="max-w-[1600px] mx-auto flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <div>
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
                <h2 className="text-base font-semibold tracking-tight text-slate-100">
                  HCCGN Universal Clock &amp; Adaptive Computation Kernel
                </h2>
              </div>
              <p className="text-xs text-slate-400 font-uclk-mono tabular-nums mt-0.5">
                {HCCGN_TIMING_CONSTANTS.DESIGNATION} v{HCCGN_TIMING_CONSTANTS.VERSION}
                <span className="mx-2 text-slate-600">·</span>
                Source: {snapshot?.correlation.monotonicSource ?? 'initializing...'}
                <span className="mx-2 text-slate-600">·</span>
                Policy: Fresh M0 / Epoch
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* FSM State Indicator (Glyph + Text + Border) */}
            <div
              className={`px-2.5 py-1 border rounded text-xs font-uclk-mono font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 ${stateMeta.className}`}
            >
              <span>{stateMeta.glyph}</span>
              <span>{stateMeta.label}</span>
            </div>

            {/* WebSocket Status */}
            <div
              className={`px-2.5 py-1 border rounded text-xs font-uclk-mono whitespace-nowrap shrink-0 ${
                wsConnected
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-slate-700 bg-slate-900 text-slate-400'
              }`}
            >
              {wsConnected ? '● WS Stream' : '○ REST Poll'}
            </div>

            {/* Primary Controls */}
            <button
              onClick={handleToggleRun}
              disabled={isBusy || !snapshot}
              className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 border transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 ${
                snapshot?.isRunning
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
                  : 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/25'
              }`}
            >
              {snapshot?.isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{snapshot?.isRunning ? 'Pause Scheduler' : 'Start Scheduler'}</span>
            </button>

            <button
              onClick={handleStepOnce}
              disabled={isBusy || !snapshot}
              className="px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <StepForward className="w-3.5 h-3.5 text-cyan-400" />
              <span>Step 100µs Interval</span>
            </button>

            <button
              onClick={handleRunTriggerSequence}
              disabled={isBusy || !snapshot}
              className="px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 border border-cyan-500/40 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>Run Trigger Sequence</span>
            </button>

            <button
              onClick={handleRunBenchmark}
              disabled={isBusy}
              className="px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 border border-indigo-500/40 bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <Gauge className="w-3.5 h-3.5" />
              <span>Run Benchmark (250T)</span>
            </button>

            <button
              onClick={handleRunAcceptance}
              disabled={isBusy}
              className="px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verify Section 15 Suite</span>
            </button>
          </div>
        </div>
      </div>

      {errorBanner && (
        <div className="bg-rose-950/60 border-b border-rose-800 px-6 py-2 text-xs text-rose-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button
            onClick={() => setErrorBanner(null)}
            className="text-rose-300 hover:text-white text-xs underline whitespace-nowrap shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Asymmetric Split Console */}
      <div className="max-w-[1600px] w-full mx-auto flex-1 flex flex-col lg:flex-row gap-4 p-4 sm:p-5">
        {/* Left Calibration & Fault Injection Column (320px) */}
        <aside className="lg:w-80 shrink-0 flex flex-col gap-4">
          {/* Adaptive Controller Parameters */}
          <form
            onSubmit={handleApplyConfig}
            className="bg-[#111827] border border-slate-800 rounded-lg p-4 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                  Adaptive Controller
                </h3>
              </div>
              <span className="text-[11px] font-uclk-mono text-slate-400">Section 7</span>
            </div>

            {draftConfig && (
              <>
                <label className="flex flex-col gap-1 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Target Utilization (U)</span>
                    <span className="font-uclk-mono tabular-nums text-cyan-300">
                      {(draftConfig.targetUtilizationU * 100).toFixed(0)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={0.98}
                    step={0.02}
                    value={draftConfig.targetUtilizationU}
                    onChange={(e) => {
                      configDirtyRef.current = true;
                      setDraftConfig({ ...draftConfig, targetUtilizationU: parseFloat(e.target.value) });
                    }}
                    className="accent-cyan-400"
                  />
                </label>

                <label className="flex flex-col gap-1 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Safety Margin (G)</span>
                    <span className="font-uclk-mono tabular-nums text-slate-200">
                      {draftConfig.safetyMarginNsG.toLocaleString()} ns
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={60000}
                    step={2500}
                    value={draftConfig.safetyMarginNsG}
                    onChange={(e) => {
                      configDirtyRef.current = true;
                      setDraftConfig({ ...draftConfig, safetyMarginNsG: parseInt(e.target.value, 10) });
                    }}
                    className="accent-cyan-400"
                  />
                </label>

                <label className="flex flex-col gap-1 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>EWMA Alpha (α)</span>
                    <span className="font-uclk-mono tabular-nums text-slate-200">
                      {draftConfig.alpha.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.05}
                    max={0.85}
                    step={0.05}
                    value={draftConfig.alpha}
                    onChange={(e) => {
                      configDirtyRef.current = true;
                      setDraftConfig({ ...draftConfig, alpha: parseFloat(e.target.value) });
                    }}
                    className="accent-cyan-400"
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-slate-400">Max Batch Ops</span>
                    <input
                      type="number"
                      min={32}
                      max={16384}
                      value={draftConfig.maxBatchOps}
                      onChange={(e) => {
                        configDirtyRef.current = true;
                        setDraftConfig({
                          ...draftConfig,
                          maxBatchOps: Math.max(32, parseInt(e.target.value || '256', 10)),
                        });
                      }}
                      className="bg-[#07090E] border border-slate-800 rounded px-2 py-1 font-uclk-mono tabular-nums text-xs text-slate-100"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-slate-400">Queue Limit</span>
                    <input
                      type="number"
                      min={8}
                      max={512}
                      value={draftConfig.queueCapacityLimit}
                      onChange={(e) => {
                        configDirtyRef.current = true;
                        setDraftConfig({
                          ...draftConfig,
                          queueCapacityLimit: Math.max(8, parseInt(e.target.value || '64', 10)),
                        });
                      }}
                      className="bg-[#07090E] border border-slate-800 rounded px-2 py-1 font-uclk-mono tabular-nums text-xs text-slate-100"
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isBusy}
                  className="w-full py-1.5 rounded bg-cyan-600/20 border border-cyan-500/40 text-cyan-200 hover:bg-cyan-600/30 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Apply Calibration Parameters
                </button>
              </>
            )}

            {/* Latest Admission Decision */}
            {snapshot?.latestDecision && (
              <div className="border-t border-slate-800 pt-2.5 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Safe Budget (B)</span>
                  <span className="font-uclk-mono tabular-nums text-slate-200">
                    {snapshot.latestDecision.availableBudgetNs.toLocaleString()} ns
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Target Budget (U·B)</span>
                  <span className="font-uclk-mono tabular-nums text-cyan-300">
                    {snapshot.latestDecision.targetBudgetNs.toLocaleString()} ns
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Admitted Batch</span>
                  <span className="font-uclk-mono tabular-nums text-emerald-300">
                    {snapshot.latestDecision.admittedOps.toLocaleString()} ops
                  </span>
                </div>
                <div className="text-[11px] font-uclk-mono text-slate-400 pt-1">
                  {snapshot.latestDecision.backpressureActive ? '▲ Backpressure Active · ' : ''}
                  {snapshot.latestDecision.reason}
                </div>
              </div>
            )}
          </form>

          {/* Fault Injection Panel */}
          <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                  Fault Injection
                </h3>
              </div>
              <button
                onClick={() =>
                  handleUpdateFaults({
                    delaySpikeNs: 0,
                    forceSolverOverrunNs: 0,
                    degradeClockSync: false,
                    simulatedQueueDepth: 4,
                    injectInverseCorruption: false,
                  })
                }
                className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>

            {snapshot && (
              <div className="space-y-2.5 text-xs">
                <div>
                  <span className="text-slate-400 block mb-1">Wake-up Delay Spike</span>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { label: '0 ns', val: 0 },
                      { label: '+80µs', val: 80_000 },
                      { label: '+180µs', val: 180_000 },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        onClick={() => handleUpdateFaults({ delaySpikeNs: opt.val })}
                        className={`py-1 rounded border text-[11px] font-uclk-mono whitespace-nowrap shrink-0 cursor-pointer ${
                          snapshot.faults.delaySpikeNs === opt.val
                            ? 'border-amber-500/60 bg-amber-500/20 text-amber-200'
                            : 'border-slate-800 bg-[#07090E] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Solver Boundary Overrun (&gt; 500µs)</span>
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      { label: 'Nominal', val: 0 },
                      { label: '+620µs Late', val: 620_000 },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        onClick={() => handleUpdateFaults({ forceSolverOverrunNs: opt.val })}
                        className={`py-1 rounded border text-[11px] font-uclk-mono whitespace-nowrap shrink-0 cursor-pointer ${
                          snapshot.faults.forceSolverOverrunNs === opt.val
                            ? 'border-amber-500/60 bg-amber-500/20 text-amber-200'
                            : 'border-slate-800 bg-[#07090E] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center justify-between py-1 cursor-pointer">
                  <span className="text-slate-300">Degrade External UTC Sync</span>
                  <input
                    type="checkbox"
                    checked={snapshot.faults.degradeClockSync}
                    onChange={(e) => handleUpdateFaults({ degradeClockSync: e.target.checked })}
                    className="accent-amber-400"
                  />
                </label>

                <label className="flex items-center justify-between py-1 cursor-pointer">
                  <span className="text-slate-300">Inject Lane 2 Inverse Residual</span>
                  <input
                    type="checkbox"
                    checked={snapshot.faults.injectInverseCorruption}
                    onChange={(e) => handleUpdateFaults({ injectInverseCorruption: e.target.checked })}
                    className="accent-rose-400"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <div className="flex justify-between text-slate-300">
                    <span>Simulated Queue Depth</span>
                    <span className="font-uclk-mono tabular-nums text-slate-200">
                      {snapshot.faults.simulatedQueueDepth} / {snapshot.config.queueCapacityLimit}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={96}
                    step={4}
                    value={snapshot.faults.simulatedQueueDepth}
                    onChange={(e) =>
                      handleUpdateFaults({ simulatedQueueDepth: parseInt(e.target.value, 10) })
                    }
                    className="accent-amber-400"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Canonical Timing Constants Reference */}
          <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 text-xs space-y-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-2">
              Canonical Constants
            </h3>
            <div className="flex justify-between font-uclk-mono tabular-nums">
              <span className="text-slate-400">Base Interval (T)</span>
              <span className="text-slate-200">100,000 ns (100 µs)</span>
            </div>
            <div className="flex justify-between font-uclk-mono tabular-nums">
              <span className="text-slate-400">Solver Window (S)</span>
              <span className="text-slate-200">500,000 ns (5T)</span>
            </div>
            <div className="flex justify-between font-uclk-mono tabular-nums">
              <span className="text-slate-400">Epoch Budget (E)</span>
              <span className="text-slate-200">1,000,000,000 ns (10,000T)</span>
            </div>
            <div className="flex justify-between font-uclk-mono tabular-nums">
              <span className="text-slate-400">Solver Rate</span>
              <span className="text-slate-200">2,000 windows / sec</span>
            </div>
          </div>
        </aside>

        {/* Main Telemetry Stage */}
        <section className="flex-1 min-w-0 flex flex-col gap-4">
          {/* Segmented Stage Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'epoch', label: 'Epoch & Scheduler', icon: Activity },
                  { id: 'solver', label: 'Four-Lane Solver', icon: Cpu },
                  { id: 'lgv', label: 'LGV Timeline Bridge', icon: Globe },
                  { id: 'benchmarks', label: 'Benchmarks & Acceptance', icon: FileCheck2 },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200'
                        : 'bg-[#111827] border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {snapshot && (
              <div className="text-xs font-uclk-mono tabular-nums text-slate-400">
                M_now: <span className="text-slate-200">{snapshot.currentMonotonicNs} ns</span>
                <span className="mx-2 text-slate-700">|</span>
                UTC: <span className="text-slate-200">{snapshot.currentUtcIso}</span>
              </div>
            )}
          </div>

          {/* TAB 1: EPOCH & SCHEDULER */}
          {activeTab === 'epoch' && snapshot && (
            <div className="flex flex-col gap-4">
              {/* Primary 1s Epoch Metrics & Progress */}
              <div className="bg-[#111827] border border-slate-800 rounded-lg p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">
                      Active 1-Second Execution Epoch · {snapshot.activeEpoch.epochId}
                    </h3>
                    <p className="text-xs text-slate-400 font-uclk-mono tabular-nums mt-0.5">
                      Origin M₀: {snapshot.activeEpoch.originMonotonicNs} ns · Deadline D_E:{' '}
                      {snapshot.activeEpoch.deadlineMonotonicNs} ns
                    </p>
                  </div>
                  <div className="text-xs font-uclk-mono tabular-nums text-cyan-300">
                    Elapsed: {snapshot.activeEpoch.measuredElapsedSec.toFixed(6)} s ({epochElapsedPct.toFixed(1)}%)
                  </div>
                </div>

                <div className="w-full h-1.5 bg-slate-900 rounded overflow-hidden mb-4">
                  <div
                    className="h-full bg-cyan-400 transition-all duration-150"
                    style={{ width: `${epochElapsedPct}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 border-t border-slate-800 pt-3">
                  <div>
                    <div className="text-[11px] text-slate-400">Intervals Scheduled</div>
                    <div className="text-base font-uclk-mono tabular-nums font-semibold text-slate-100 mt-0.5">
                      {snapshot.activeEpoch.baseIntervalsScheduled.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Missed / Late Solvers</div>
                    <div className="text-base font-uclk-mono tabular-nums font-semibold text-amber-300 mt-0.5">
                      {snapshot.activeEpoch.missedIntervals} / {snapshot.activeEpoch.lateSolvers}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Aggregate Ops/sec</div>
                    <div className="text-base font-uclk-mono tabular-nums font-semibold text-emerald-300 mt-0.5">
                      {snapshot.activeEpoch.opsPerSec.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Deduplicated Ops/sec</div>
                    <div className="text-base font-uclk-mono tabular-nums font-semibold text-cyan-300 mt-0.5">
                      {snapshot.activeEpoch.deduplicatedOpsPerSec.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Measured Bytes/sec</div>
                    <div className="text-base font-uclk-mono tabular-nums font-semibold text-slate-100 mt-0.5">
                      {snapshot.activeEpoch.bytesPerSec.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Verification Rate</div>
                    <div
                      className={`text-base font-uclk-mono tabular-nums font-semibold mt-0.5 ${
                        snapshot.activeEpoch.verificationRate >= 0.999 ? 'text-emerald-300' : 'text-rose-300'
                      }`}
                    >
                      {(snapshot.activeEpoch.verificationRate * 100).toFixed(2)}%
                    </div>
                  </div>
                </div>

                {/* Absolute Deadline Anchor & Missed-Tick Tracker (hccgnScheduler.ts) */}
                {snapshot.schedulerAnchor && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-slate-800 pt-3 mt-3 text-xs font-uclk-mono tabular-nums">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Next Anchor Slot (d_n)</span>
                      <span className="text-slate-200">
                        #{snapshot.schedulerAnchor.currentSlotIndex} · {snapshot.schedulerAnchor.nextDeadlineNs} ns
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Missed Ticks (Tick / Total)</span>
                      <span
                        className={
                          snapshot.schedulerAnchor.missedTicksThisInterval > 0
                            ? 'text-amber-300'
                            : 'text-slate-200'
                        }
                      >
                        {snapshot.schedulerAnchor.missedTicksThisInterval} /{' '}
                        {snapshot.schedulerAnchor.cumulativeMissedTicks.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Last Dispatch Lateness</span>
                      <span className="text-cyan-300">
                        {snapshot.schedulerAnchor.lastLatenessNs.toLocaleString()} ns
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Catch-up Policy</span>
                      <span className="text-emerald-300">{snapshot.schedulerAnchor.catchUpPolicy}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Sequential Dependent Trigger Pipeline & Vertical Adaptive Recommendations */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                <div className="xl:col-span-7 bg-[#111827] border border-slate-800 rounded-lg p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                        Sequential Trigger Execution Chain (Ordered &amp; Dependency-Gated)
                      </h3>
                      <p className="text-[11px] font-uclk-mono text-slate-400 mt-0.5">
                        {snapshot.latestTriggerRun
                          ? `Run ${snapshot.latestTriggerRun.runId} · Total: ${snapshot.latestTriggerRun.totalDurationNs.toLocaleString()} ns`
                          : 'Step or Start Scheduler to inspect ordered trigger stages'}
                      </p>
                    </div>
                    <button
                      onClick={handleRunTriggerSequence}
                      disabled={isBusy}
                      className="px-2.5 py-1 rounded border border-cyan-500/40 bg-cyan-500/15 text-cyan-200 text-xs whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Trigger Sequence
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-uclk-mono">
                      <thead className="border-b border-slate-800 text-slate-400">
                        <tr>
                          <th className="py-1.5 pr-2">#</th>
                          <th className="py-1.5 pr-2">Trigger Stage</th>
                          <th className="py-1.5 pr-2">Depends On</th>
                          <th className="py-1.5 pr-2">Status</th>
                          <th className="py-1.5 pr-2">Time</th>
                          <th className="py-1.5">Output</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/70 tabular-nums">
                        {!snapshot.latestTriggerRun ? (
                          <tr>
                            <td colSpan={6} className="py-4 text-center text-slate-500">
                              No sequential trigger run recorded yet.
                            </td>
                          </tr>
                        ) : (
                          snapshot.latestTriggerRun.stages.map((st) => (
                            <tr key={st.triggerId}>
                              <td className="py-1.5 pr-2 text-slate-400">{st.sequenceOrder}</td>
                              <td className="py-1.5 pr-2 text-slate-200 whitespace-nowrap">
                                {st.triggerId}
                              </td>
                              <td className="py-1.5 pr-2 text-slate-400 whitespace-nowrap">
                                {st.dependsOnTriggerId ?? 'ROOT'}
                              </td>
                              <td
                                className={`py-1.5 pr-2 whitespace-nowrap ${
                                  st.status === 'APPLIED'
                                    ? 'text-emerald-400'
                                    : st.status === 'SKIPPED_DEPENDENCY_FAILED'
                                    ? 'text-amber-300'
                                    : 'text-rose-400'
                                }`}
                              >
                                {st.status === 'APPLIED'
                                  ? '● APPLIED'
                                  : st.status === 'SKIPPED_DEPENDENCY_FAILED'
                                  ? '▲ SKIPPED'
                                  : `✖ ${st.status}`}
                              </td>
                              <td className="py-1.5 pr-2 text-slate-300 whitespace-nowrap">
                                {st.durationNs.toLocaleString()} ns
                              </td>
                              <td className="py-1.5 text-slate-400">{st.outputSummary}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="xl:col-span-5 bg-[#111827] border border-slate-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                      Vertical Adaptive Recommendations
                    </h3>
                    <span className="text-[11px] font-uclk-mono text-slate-400">
                      System Interop
                    </span>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {!snapshot.adaptiveRecommendations?.length ? (
                      <p className="text-xs text-slate-500 py-4 text-center">
                        Awaiting adaptive evaluation…
                      </p>
                    ) : (
                      snapshot.adaptiveRecommendations.map((rec) => (
                        <div
                          key={rec.id}
                          className="border-b border-slate-800/80 pb-2 last:border-b-0 text-xs"
                        >
                          <div className="flex items-center justify-between font-uclk-mono">
                            <span className="text-slate-200 font-semibold">{rec.subsystem}</span>
                            <span
                              className={
                                rec.severity === 'CRITICAL'
                                  ? 'text-rose-400'
                                  : rec.severity === 'WARNING'
                                  ? 'text-amber-300'
                                  : 'text-emerald-400'
                              }
                            >
                              {rec.severity === 'CRITICAL'
                                ? '✖ '
                                : rec.severity === 'WARNING'
                                ? '▲ '
                                : '● '}
                              {rec.action}
                            </span>
                          </div>
                          <div className="text-slate-400 mt-0.5">
                            {rec.reason} · Scale {(rec.targetUtilScale * 100).toFixed(0)}% ·{' '}
                            {rec.recommendedBatchOps.toLocaleString()} ops
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Clock Domains A / B / C & Correlation */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 text-xs space-y-1.5">
                  <div className="text-slate-300 font-semibold border-b border-slate-800 pb-1.5 flex justify-between">
                    <span>Domain A — Monotonic Execution</span>
                    <span className="text-emerald-400 font-uclk-mono">● AUTHORITATIVE</span>
                  </div>
                  <div className="font-uclk-mono text-slate-400">
                    Source: <span className="text-slate-200">{snapshot.correlation.monotonicSource}</span>
                  </div>
                  <div className="font-uclk-mono tabular-nums text-slate-400">
                    p50 / p95 / p99 Jitter:{' '}
                    <span className="text-slate-200">
                      {snapshot.telemetrySummary.p50JitterNs.toLocaleString()} /{' '}
                      {snapshot.telemetrySummary.p95JitterNs.toLocaleString()} /{' '}
                      {snapshot.telemetrySummary.p99JitterNs.toLocaleString()} ns
                    </span>
                  </div>
                </div>

                <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 text-xs space-y-1.5">
                  <div className="text-slate-300 font-semibold border-b border-slate-800 pb-1.5 flex justify-between">
                    <span>Domain B — External UTC Correlation</span>
                    <span
                      className={`font-uclk-mono ${
                        snapshot.correlation.syncSource.validity === 'VALID'
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {snapshot.correlation.syncSource.validity === 'VALID' ? '● VALID' : '▲ UNSYNCED'}
                    </span>
                  </div>
                  <div className="font-uclk-mono tabular-nums text-slate-400">
                    Model: <span className="text-slate-200">UTC(M) = {snapshot.correlation.aRate}·M + b</span>
                  </div>
                  <div className="font-uclk-mono tabular-nums text-slate-400">
                    Uncertainty:{' '}
                    <span className="text-cyan-300">
                      ±{(snapshot.correlation.uncertaintyNs / 1_000_000).toFixed(3)} ms
                    </span>{' '}
                    · Drift: {snapshot.correlation.syncSource.driftPpm} ppm
                  </div>
                </div>

                <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 text-xs space-y-1.5">
                  <div className="text-slate-300 font-semibold border-b border-slate-800 pb-1.5 flex justify-between">
                    <span>Domain C — Device Hardware Clock</span>
                    <span className="text-slate-400 font-uclk-mono">○ UNAVAILABLE</span>
                  </div>
                  <div className="font-uclk-mono text-slate-400">
                    NIC HW Timestamping:{' '}
                    <span className="text-slate-200">
                      {String(snapshot.correlation.hardwareTimestampSupported)}
                    </span>
                  </div>
                  <div className="text-slate-400">
                    Zero fabricated HW timestamps; correlation degrades cleanly to software monotonic + UTC.
                  </div>
                </div>
              </div>

              {/* Recharts Interval Jitter & Throughput Telemetry */}
              <div className="bg-[#111827] border border-slate-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                    Measured Dispatch Jitter &amp; Batch Execution Duration (ns)
                  </h3>
                  <span className="text-xs font-uclk-mono tabular-nums text-slate-400">
                    Latest {intervalTelemetrySeries.length} intervals · Target boundary T = 100,000 ns
                  </span>
                </div>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={intervalTelemetrySeries}>
                      <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" />
                      <XAxis dataKey="seq" stroke="#64748B" fontSize={11} />
                      <YAxis stroke="#64748B" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0B0F17',
                          borderColor: '#334155',
                          fontSize: '12px',
                        }}
                      />
                      <ReferenceLine y={100000} stroke="#F59E0B" strokeDasharray="4 4" />
                      <Line
                        type="monotone"
                        dataKey="jitterNs"
                        name="Dispatch Jitter (ns)"
                        stroke="#22D3EE"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="execNs"
                        name="Execution Duration (ns)"
                        stroke="#34D399"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 11-State Finite State Machine Matrix & Transition History */}
              <div className="bg-[#111827] border border-slate-800 rounded-lg p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200 mb-3">
                  Section 12 — Universal Clock Finite State Machine
                </h3>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {ALL_FSM_STATES.map((st) => {
                    const isActive = snapshot.state === st;
                    return (
                      <span
                        key={st}
                        className={`px-2 py-1 rounded border text-[11px] font-uclk-mono ${
                          isActive
                            ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200 font-semibold'
                            : 'border-slate-800 bg-[#07090E] text-slate-500'
                        }`}
                      >
                        {isActive ? '● ' : ''}
                        {st}
                      </span>
                    );
                  })}
                </div>
                <div className="border-t border-slate-800 pt-2 max-h-36 overflow-y-auto">
                  <table className="w-full text-left text-xs font-uclk-mono">
                    <thead className="text-slate-500">
                      <tr>
                        <th className="py-1 pr-3">Transition</th>
                        <th className="py-1 pr-3">Monotonic (ns)</th>
                        <th className="py-1">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {snapshot.recentTransitions.slice(0, 8).map((tr) => (
                        <tr key={tr.id}>
                          <td className="py-1 pr-3 text-slate-200 whitespace-nowrap">
                            {tr.from} → {tr.to}
                          </td>
                          <td className="py-1 pr-3 text-slate-400 tabular-nums whitespace-nowrap">
                            {tr.monotonicNs}
                          </td>
                          <td className="py-1 text-slate-400">{tr.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FOUR-LANE SOLVER */}
          {activeTab === 'solver' && snapshot && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {snapshot.latestLanes.map((lane) => (
                  <div
                    key={lane.laneId}
                    className="bg-[#111827] border border-slate-800 rounded-lg p-4 text-xs"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
                      <div className="font-semibold text-slate-100">
                        Lane {lane.laneId} · {lane.role} ({lane.direction})
                      </div>
                      <span
                        className={`font-uclk-mono ${
                          lane.residualError === 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {lane.residualError === 0 ? '● Residual = 0' : `✖ Residual = ${lane.residualError}`}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-y-1.5 font-uclk-mono tabular-nums">
                      <span className="text-slate-400">Source Ticket:</span>
                      <span className="text-cyan-300">{lane.sourceTicketId}</span>
                      <span className="text-slate-400">Opposing Ticket:</span>
                      <span className="text-slate-300">{lane.opposingTicketId}</span>
                      <span className="text-slate-400">Exec Cursor:</span>
                      <span className="text-slate-200">{lane.executionCursor}</span>
                      <span className="text-slate-400">Seq / Ops:</span>
                      <span className="text-slate-200">
                        #{lane.sequenceNumber} · {lane.operationsCompleted.toLocaleString()} ops
                      </span>
                      <span className="text-slate-400">Bytes Processed:</span>
                      <span className="text-slate-200">{lane.bytesCompleted.toLocaleString()} B</span>
                      <span className="text-slate-400">Lane Digest:</span>
                      <span className="text-slate-400">{lane.laneStateDigest}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* 5-Tick Solver Windows Table */}
              <div className="bg-[#111827] border border-slate-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                    Five-Tick Solver Windows (S = 500,000 ns)
                  </h3>
                  <span className="text-xs font-uclk-mono text-slate-400">
                    2,000 nominal windows / sec
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-uclk-mono">
                    <thead className="border-b border-slate-800 text-slate-400">
                      <tr>
                        <th className="py-2 pr-3">Window</th>
                        <th className="py-2 pr-3">Epoch</th>
                        <th className="py-2 pr-3">Duration</th>
                        <th className="py-2 pr-3">Completeness</th>
                        <th className="py-2 pr-3">Pair A / B Residual</th>
                        <th className="py-2 pr-3">Converged</th>
                        <th className="py-2">Solver Digest</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70 tabular-nums">
                      {snapshot.latestSolvers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-slate-500">
                            No solver windows sealed yet — click Step 100µs Interval 5 times or Start Scheduler.
                          </td>
                        </tr>
                      ) : (
                        snapshot.latestSolvers.slice(0, 14).map((sw) => (
                          <tr key={`${sw.epochId}-${sw.solverWindowIndex}-${sw.solverReceiptDigest}`}>
                            <td className="py-1.5 pr-3 text-slate-200">#{sw.solverWindowIndex}</td>
                            <td className="py-1.5 pr-3 text-slate-400">{sw.epochId}</td>
                            <td
                              className={`py-1.5 pr-3 ${
                                sw.isLate ? 'text-amber-300' : 'text-slate-200'
                              }`}
                            >
                              {sw.solverDurationNs.toLocaleString()} ns
                            </td>
                            <td
                              className={`py-1.5 pr-3 ${
                                sw.snapshotCompleteness === 'COMPLETE'
                                  ? 'text-emerald-400'
                                  : sw.snapshotCompleteness === 'LATE'
                                  ? 'text-amber-400'
                                  : 'text-rose-400'
                              }`}
                            >
                              {sw.snapshotCompleteness}
                            </td>
                            <td className="py-1.5 pr-3 text-slate-300">
                              {sw.pairAClosureResidual} / {sw.pairBClosureResidual}
                            </td>
                            <td
                              className={`py-1.5 pr-3 ${
                                sw.converged ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {sw.converged ? '● TRUE' : '✖ FALSE'}
                            </td>
                            <td className="py-1.5 text-slate-500">
                              {sw.solverReceiptDigest.slice(0, 16)}…
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LGV TIMELINE BRIDGE */}
          {activeTab === 'lgv' && snapshot && (
            <div className="flex flex-col gap-4">
              <div className="bg-[#111827] border border-slate-800 rounded-lg p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                      LGV Spatial-Temporal Bridge (CRS: EPSG:4326)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Correlates monotonic receipts into geographic subsea/relay nodes with explicit uncertainty and precision tags.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-uclk-mono">
                    <span className="text-emerald-400">● MEASURED</span>
                    <span className="text-cyan-400">◆ ESTIMATED (UTC)</span>
                    <span className="text-amber-400">▲ INTERPOLATED (SCRUB)</span>
                  </div>
                </div>

                {/* Equirectangular Vector Plot */}
                <div className="bg-[#07090E] border border-slate-800 rounded p-2 overflow-hidden">
                  <svg viewBox="0 0 800 260" className="w-full h-56">
                    {/* Reference graticule */}
                    {[65, 130, 195].map((y) => (
                      <line key={y} x1={0} y1={y} x2={800} y2={y} stroke="#1E293B" strokeDasharray="3 3" />
                    ))}
                    {[160, 320, 480, 640].map((x) => (
                      <line key={x} x1={x} y1={0} x2={x} y2={260} stroke="#1E293B" strokeDasharray="3 3" />
                    ))}

                    {/* Subsea & Global Relay Backbone Path */}
                    <polyline
                      fill="none"
                      stroke="#0EA5E9"
                      strokeOpacity={0.45}
                      strokeWidth={1.5}
                      points={[
                        [-77.4874, 39.0438],
                        [-75.978, 36.8529],
                        [-42.5, 38.2],
                        [-2.9818, 43.3812],
                        [5.3698, 43.2965],
                        [139.6917, 35.6895],
                      ]
                        .map(([lon, lat]) => {
                          const p = projectLonLat(lon, lat, 800, 260);
                          return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
                        })
                        .join(' ')}
                    />

                    {/* Plotted events */}
                    {snapshot.lgvEvents.slice(0, 12).map((ev, i) => {
                      const p = projectLonLat(ev.lon, ev.lat, 800, 260);
                      const isSelected = lgvTimelineState.current?.eventId === ev.eventId;
                      return (
                        <g key={ev.eventId} onClick={() => setLgvScrubIndex(i)} className="cursor-pointer">
                          {isSelected && (
                            <circle cx={p.x} cy={p.y} r={11} fill="none" stroke="#22D3EE" strokeWidth={1.5} />
                          )}
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={isSelected ? 5 : 3.5}
                            fill={ev.verificationStatus === 'VERIFIED' ? '#34D399' : '#FB7185'}
                          />
                          <text x={p.x + 8} y={p.y + 3} fill="#CBD5E1" fontSize="9" fontFamily="monospace">
                            {ev.spatialId}
                          </text>
                        </g>
                      );
                    })}

                    {/* Interpolated midpoint marker when scrubbing */}
                    {lgvTimelineState.interpolatedCoords && (
                      <g>
                        {(() => {
                          const ip = projectLonLat(
                            lgvTimelineState.interpolatedCoords.lon,
                            lgvTimelineState.interpolatedCoords.lat,
                            800,
                            260
                          );
                          return (
                            <rect
                              x={ip.x - 4}
                              y={ip.y - 4}
                              width={8}
                              height={8}
                              fill="#F59E0B"
                            />
                          );
                        })()}
                      </g>
                    )}
                  </svg>
                </div>

                {/* Scrubber */}
                {snapshot.lgvEvents.length > 0 && (
                  <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-800 pt-3 text-xs">
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-slate-400 whitespace-nowrap">Event Scrubber:</span>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(0, snapshot.lgvEvents.length - 1)}
                        value={Math.min(lgvScrubIndex, Math.max(0, snapshot.lgvEvents.length - 1))}
                        onChange={(e) => setLgvScrubIndex(parseInt(e.target.value, 10))}
                        className="flex-1 accent-cyan-400"
                      />
                    </div>
                    {lgvTimelineState.current && (
                      <div className="font-uclk-mono tabular-nums text-slate-300">
                        ● MEASURED: {lgvTimelineState.current.nodeLabel} ({lgvTimelineState.current.lat.toFixed(2)},{' '}
                        {lgvTimelineState.current.lon.toFixed(2)}) · ◆ ESTIMATED UTC ±
                        {(lgvTimelineState.current.clockUncertaintyNs / 1e6).toFixed(2)} ms
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 overflow-x-auto">
                <table className="w-full text-left text-xs font-uclk-mono">
                  <thead className="border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="py-2 pr-3">Spatial Node</th>
                      <th className="py-2 pr-3">EPSG:4326</th>
                      <th className="py-2 pr-3">Monotonic (MEASURED)</th>
                      <th className="py-2 pr-3">Correlated UTC (ESTIMATED)</th>
                      <th className="py-2 pr-3">Uncertainty</th>
                      <th className="py-2">Provenance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 tabular-nums">
                    {snapshot.lgvEvents.slice(0, 10).map((ev) => (
                      <tr key={ev.eventId}>
                        <td className="py-1.5 pr-3 text-slate-200">{ev.nodeLabel}</td>
                        <td className="py-1.5 pr-3 text-slate-400">
                          {ev.lat.toFixed(3)}, {ev.lon.toFixed(3)} ({ev.altitudeMeters}m)
                        </td>
                        <td className="py-1.5 pr-3 text-emerald-300">{ev.monotonicNs}</td>
                        <td className="py-1.5 pr-3 text-cyan-300">{ev.correlatedUtcIso}</td>
                        <td className="py-1.5 pr-3 text-slate-300">
                          ±{(ev.clockUncertaintyNs / 1e6).toFixed(3)} ms
                        </td>
                        <td className="py-1.5 text-slate-500">{ev.provenance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: BENCHMARKS & SECTION 15 ACCEPTANCE */}
          {activeTab === 'benchmarks' && snapshot && (
            <div className="flex flex-col gap-4">
              {/* Benchmark Report */}
              <div className="bg-[#111827] border border-slate-800 rounded-lg p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                      Hardware Execution Benchmark Report (Section 14)
                    </h3>
                    <p className="text-xs text-slate-400 font-uclk-mono mt-0.5">
                      {snapshot.latestBenchmark
                        ? `${snapshot.latestBenchmark.benchmarkId} · ${snapshot.latestBenchmark.executedAtUtc} · ${snapshot.latestBenchmark.clockSource}`
                        : 'Click "Run Benchmark (250T)" in the header ribbon to execute a measured Node.js hrtime.bigint burst.'}
                    </p>
                  </div>
                  <button
                    onClick={handleRunBenchmark}
                    disabled={isBusy}
                    className="px-3 py-1 rounded border border-indigo-500/40 bg-indigo-500/15 text-indigo-200 text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Re-Run Benchmark</span>
                  </button>
                </div>

                {snapshot.latestBenchmark && (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-6 gap-3 border-y border-slate-800 py-3 mb-4 font-uclk-mono tabular-nums text-xs">
                      <div>
                        <div className="text-slate-400">p50 / p95 / p99 Batch</div>
                        <div className="text-slate-100 font-semibold mt-0.5">
                          {snapshot.latestBenchmark.p50LatencyNs} / {snapshot.latestBenchmark.p95LatencyNs} /{' '}
                          {snapshot.latestBenchmark.p99LatencyNs} ns
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400">Mean / Max Jitter</div>
                        <div className="text-cyan-300 font-semibold mt-0.5">
                          {snapshot.latestBenchmark.meanJitterNs.toLocaleString()} /{' '}
                          {snapshot.latestBenchmark.maxJitterNs.toLocaleString()} ns
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400">Aggregate Throughput</div>
                        <div className="text-emerald-300 font-semibold mt-0.5">
                          {snapshot.latestBenchmark.aggregateOpsPerSec.toLocaleString()} ops/s
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400">Deduplicated Throughput</div>
                        <div className="text-cyan-300 font-semibold mt-0.5">
                          {snapshot.latestBenchmark.deduplicatedOpsPerSec.toLocaleString()} ops/s
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400">Missed / Late Solver</div>
                        <div className="text-amber-300 font-semibold mt-0.5">
                          {snapshot.latestBenchmark.missedIntervals} /{' '}
                          {snapshot.latestBenchmark.lateSolverWindows}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400">Verification Rate</div>
                        <div className="text-emerald-300 font-semibold mt-0.5">
                          {(snapshot.latestBenchmark.verificationRate * 100).toFixed(2)}%
                        </div>
                      </div>
                    </div>

                    <div className="h-48 w-full mb-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[...snapshot.latestBenchmark.samples]}>
                          <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" />
                          <XAxis dataKey="intervalIndex" stroke="#64748B" fontSize={11} />
                          <YAxis stroke="#64748B" fontSize={11} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#0B0F17',
                              borderColor: '#334155',
                              fontSize: '12px',
                            }}
                          />
                          <Bar dataKey="batchDurationNs" name="Batch Duration (ns)" fill="#38BDF8" />
                          <Bar dataKey="jitterNs" name="Dispatch Jitter (ns)" fill="#F59E0B" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
              </div>

              {/* Section 15 Verification & Acceptance Matrix */}
              <div className="bg-[#111827] border border-slate-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                    Section 15 — Verification &amp; Acceptance Criteria Suite
                  </h3>
                  <button
                    onClick={handleRunAcceptance}
                    disabled={isBusy}
                    className="px-3 py-1 rounded border border-emerald-500/40 bg-emerald-500/15 text-emerald-200 text-xs whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Execute Suite
                  </button>
                </div>

                {!acceptanceResults ? (
                  <p className="text-xs text-slate-400 py-4 text-center">
                    Click &quot;Execute Suite&quot; to run programmatic assertions across Clock, Timing, Adaptive Controller, Inverse Solver, SHA-256 Receipt, and Cross-Device UTC invariants.
                  </p>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-800 text-slate-400">
                      <tr>
                        <th className="py-2 pr-3">ID</th>
                        <th className="py-2 pr-3">Category</th>
                        <th className="py-2 pr-3">Criterion</th>
                        <th className="py-2 pr-3">Result</th>
                        <th className="py-2">Measured Evidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {acceptanceResults.map((t) => (
                        <tr key={t.id}>
                          <td className="py-2 pr-3 font-uclk-mono text-slate-300 whitespace-nowrap">
                            {t.id}
                          </td>
                          <td className="py-2 pr-3 text-slate-300 whitespace-nowrap">{t.category}</td>
                          <td className="py-2 pr-3 text-slate-200">{t.criterion}</td>
                          <td
                            className={`py-2 pr-3 font-uclk-mono whitespace-nowrap ${
                              t.passed ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {t.passed ? (
                              <span className="inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> PASS
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1">
                                <XCircle className="w-3.5 h-3.5" /> FAIL
                              </span>
                            )}
                          </td>
                          <td className="py-2 font-uclk-mono text-slate-400">{t.measuredEvidence}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Bottom Append-Only Cryptographic Receipt & Tamper Audit Tray */}
          {snapshot && (
            <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 grid grid-cols-1 xl:grid-cols-12 gap-4">
              <div className="xl:col-span-7 overflow-x-auto">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                    Append-Only SHA-256 Event Receipt Chain (Section 9)
                  </h3>
                  <span className="text-[11px] font-uclk-mono text-slate-400">
                    Click any row to inspect &amp; verify independently
                  </span>
                </div>
                <div className="max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs font-uclk-mono">
                    <thead className="border-b border-slate-800 text-slate-400 sticky top-0 bg-[#111827]">
                      <tr>
                        <th className="py-1.5 pr-2">Seq</th>
                        <th className="py-1.5 pr-2">Epoch</th>
                        <th className="py-1.5 pr-2">Deadline</th>
                        <th className="py-1.5 pr-2">Verification</th>
                        <th className="py-1.5 pr-2">Jitter (ns)</th>
                        <th className="py-1.5 pr-2">Ops</th>
                        <th className="py-1.5">SHA-256 Digest</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70 tabular-nums">
                      {snapshot.recentReceipts.slice(0, 25).map((r) => {
                        const isSelected = selectedReceipt?.event_id === r.event_id;
                        return (
                          <tr
                            key={r.event_id}
                            onClick={() => {
                              setSelectedReceipt(r);
                              setReceiptVerifyResult(null);
                            }}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? 'bg-cyan-500/10' : 'hover:bg-slate-800/50'
                            }`}
                          >
                            <td className="py-1.5 pr-2 text-slate-200">#{r.sequence_number}</td>
                            <td className="py-1.5 pr-2 text-slate-400">{r.epoch_id}</td>
                            <td
                              className={`py-1.5 pr-2 ${
                                r.deadline_status === 'ON_TIME' ? 'text-emerald-400' : 'text-amber-300'
                              }`}
                            >
                              {r.deadline_status}
                            </td>
                            <td
                              className={`py-1.5 pr-2 ${
                                r.verification_status === 'VERIFIED' ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {r.verification_status}
                            </td>
                            <td className="py-1.5 pr-2 text-slate-300">{r.jitter_ns.toLocaleString()}</td>
                            <td className="py-1.5 pr-2 text-slate-300">{r.completed_operations}</td>
                            <td className="py-1.5 text-slate-500">{r.receipt_digest.slice(0, 16)}…</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Independent Receipt Verifier */}
              <div className="xl:col-span-5 border-t xl:border-t-0 xl:border-l border-slate-800 pt-3 xl:pt-0 xl:pl-4 flex flex-col gap-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-slate-200">Independent Receipt Verifier</h4>
                  <span className="font-uclk-mono text-[11px] text-slate-400">
                    WebCrypto SHA-256
                  </span>
                </div>

                {!selectedReceipt ? (
                  <p className="text-slate-500">Select a receipt row from the ledger to verify.</p>
                ) : (
                  <>
                    <div className="font-uclk-mono text-[11px] text-slate-400 space-y-1 bg-[#07090E] border border-slate-800 rounded p-2.5">
                      <div>
                        event_id: <span className="text-slate-200">{selectedReceipt.event_id}</span>
                      </div>
                      <div>
                        parent_digest:{' '}
                        <span className="text-slate-300">
                          {selectedReceipt.parent_receipt_digest
                            ? `${selectedReceipt.parent_receipt_digest.slice(0, 20)}…`
                            : 'NULL (Genesis)'}
                        </span>
                      </div>
                      <div>
                        receipt_digest:{' '}
                        <span className="text-cyan-300 break-all">{selectedReceipt.receipt_digest}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleVerifyReceipt(selectedReceipt, false)}
                        className="px-2.5 py-1.5 rounded border border-emerald-500/40 bg-emerald-500/15 text-emerald-200 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Verify SHA-256 (WebCrypto)
                      </button>
                      <button
                        onClick={() => handleVerifyReceipt(selectedReceipt, true)}
                        className="px-2.5 py-1.5 rounded border border-rose-500/40 bg-rose-500/15 text-rose-200 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Simulate Payload Tamper (+1 op)
                      </button>
                    </div>

                    {receiptVerifyResult && (
                      <div
                        className={`border rounded p-2.5 font-uclk-mono text-[11px] space-y-1 ${
                          receiptVerifyResult.browserValid
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                            : 'border-rose-500/40 bg-rose-500/10 text-rose-200'
                        }`}
                      >
                        <div className="font-semibold">
                          {receiptVerifyResult.browserValid
                            ? '● VERIFIED — Recomputed SHA-256 matches sealed digest'
                            : '✖ TAMPERED — Recomputed SHA-256 rejected modified payload'}
                          {receiptVerifyResult.serverValid !== null &&
                            ` · Server Check: ${receiptVerifyResult.serverValid ? 'VALID' : 'REJECTED'}`}
                        </div>
                        <div className="break-all text-slate-300">
                          Recomputed: {receiptVerifyResult.recomputedDigest}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
