import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Download, Activity, Cpu, Database, Clock, ShieldCheck } from 'lucide-react';
import type {
  CrypticPlatformSnapshot,
  LiveAnalyticsBundle,
  ProvenanceMetric,
} from '../contracts/cryptic-platform';

interface Props {
  bundle: LiveAnalyticsBundle | null;
  snapshot: CrypticPlatformSnapshot | null;
  onRefresh: () => void;
}

const ProvenanceBar: React.FC<{
  title: string;
  source: string;
  unit: string;
  quality: string;
  intervalMs: number;
  sampledAt: string;
  missingReason?: string;
}> = ({ title, source, unit, quality, intervalMs, sampledAt, missingReason }) => (
  <div className="border-b border-slate-800 pb-2 mb-3 flex flex-wrap items-center justify-between gap-2">
    <div>
      <h4 className="text-xs font-semibold text-slate-100">{title}</h4>
      <div className="text-[10px] font-mono text-slate-400 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
        <span>Src: {source}</span>
        <span>Unit: {unit}</span>
        <span>Cadence: {intervalMs}ms</span>
        <span>Sample: {sampledAt ? sampledAt.slice(11, 19) : '—'} UTC</span>
      </div>
      {missingReason && (
        <div className="text-[10px] font-mono text-amber-400 mt-0.5">{missingReason}</div>
      )}
    </div>
    <span
      className={`text-[10px] font-mono px-2 py-0.5 border ${
        quality === 'MEASURED'
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
          : quality === 'DERIVED'
            ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
            : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
      }`}
    >
      {quality}
    </span>
  </div>
);

export const CrypticLiveChartsPanel: React.FC<Props> = ({ bundle, snapshot, onRefresh }) => {
  const [windowSize, setWindowSize] = useState<number>(60);

  const series = useMemo(() => {
    if (!bundle?.series) return [];
    return bundle.series.slice(-windowSize);
  }, [bundle, windowSize]);

  const algoHistogramData = useMemo(() => {
    const counts: Record<string, { alg: string; count: number; avgUs: number; totalUs: number }> = {};
    for (const r of snapshot?.recentSolverResults || []) {
      const k = r.algorithmId;
      if (!counts[k]) counts[k] = { alg: k, count: 0, avgUs: 0, totalUs: 0 };
      counts[k].count += 1;
      counts[k].totalUs += Number(r.elapsedNs) / 1000;
      counts[k].avgUs = +(counts[k].totalUs / counts[k].count).toFixed(2);
    }
    for (const j of snapshot?.instantJobs || []) {
      const k = j.config.algorithmId;
      if (!counts[k]) counts[k] = { alg: k, count: 0, avgUs: 0, totalUs: 0 };
      counts[k].count += 1;
      counts[k].avgUs = +(j.avgLatencyNs / 1000).toFixed(2);
    }
    const list = Object.values(counts);
    return list.length > 0 ? list : [{ alg: 'No executions yet', count: 0, avgUs: 0, totalUs: 0 }];
  }, [snapshot]);

  const workerStatusData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const w of snapshot?.workers || []) {
      map[w.state] = (map[w.state] || 0) + 1;
    }
    const entries = Object.entries(map).map(([state, count]) => ({ state, count }));
    return entries.length > 0 ? entries : [{ state: 'NO_WORKERS', count: 0 }];
  }, [snapshot]);

  const receiptFunnelData = useMemo(() => {
    const order = ['CREATED', 'COMPUTATION_COMPLETE', 'LOCALLY_VERIFIED', 'SUBMITTED', 'SHARE_ACCEPTED', 'REWARD_CONFIRMED', 'SETTLEMENT_ELIGIBLE', 'SETTLED', 'REJECTED'];
    const map: Record<string, number> = {};
    for (const r of snapshot?.receipts || []) {
      map[r.lifecycleState] = (map[r.lifecycleState] || 0) + 1;
    }
    return order.map((st) => ({ state: st, count: map[st] || 0 }));
  }, [snapshot]);

  const cpuMemData = useMemo(() => {
    const h = snapshot?.hostTelemetry;
    if (!h) return [];
    return [
      { metric: 'RSS (MB)', value: +(h.memoryRssBytes / (1024 * 1024)).toFixed(2) },
      { metric: 'Heap (MB)', value: +(h.heapUsedBytes / (1024 * 1024)).toFixed(2) },
      { metric: 'Loop p99 (ms)', value: h.eventLoopP99Ms ?? 0 },
    ];
  }, [snapshot]);

  const handleExportJson = () => {
    if (!bundle) return;
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cryptic-live-telemetry-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    if (!series.length) return;
    const headers = Object.keys(series[0]).join(',');
    const rows = series.map((pt) => Object.values(pt).join(','));
    const blob = new Blob([[headers, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cryptic-live-telemetry-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sampledAt = bundle?.sampledAtUtc || '';
  const hostPowerProv: ProvenanceMetric<number | string> | undefined = bundle?.provenances?.hostPower;

  return (
    <div className="space-y-5 font-sans">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0B0F17] border border-slate-800 p-4">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span>15 Source-Backed Live Telemetry & Provenance Charts</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Every plotted series is read from SQLite WAL <span className="font-mono text-slate-300">telemetry_series</span> and Node.js <span className="font-mono text-slate-300">hrtime.bigint()</span> execution timers. Zero synthetic sine waves.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          {[15, 30, 60, 120].map((w) => (
            <button
              key={w}
              onClick={() => setWindowSize(w)}
              className={`px-2.5 py-1 border transition-colors ${
                windowSize === w
                  ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200 font-semibold'
                  : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              Last {w}s
            </button>
          ))}
          <button
            onClick={onRefresh}
            className="px-2.5 py-1 border border-slate-700 bg-slate-900 hover:border-cyan-400 text-slate-200"
          >
            Refresh
          </button>
          <button
            onClick={handleExportCsv}
            className="px-2.5 py-1 border border-slate-700 bg-slate-900 hover:border-emerald-400 text-emerald-300 flex items-center gap-1"
          >
            <Download className="w-3 h-3" /> CSV
          </button>
          <button
            onClick={handleExportJson}
            className="px-2.5 py-1 border border-slate-700 bg-slate-900 hover:border-cyan-400 text-cyan-300 flex items-center gap-1"
          >
            <Download className="w-3 h-3" /> JSON
          </button>
        </div>
      </div>

      {/* 15 Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 1. Operations/sec Over Time */}
        <div className="bg-[#0B0F17] border border-slate-800 p-4">
          <ProvenanceBar title="1. Aggregate Operations / Sec" source="Tier 1+2 Runtime Timers" unit="ops/s" quality="MEASURED" intervalMs={1000} sampledAt={sampledAt} />
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="timeLabel" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#07090E', borderColor: '#334155', fontSize: 11 }} />
                <Line type="monotone" dataKey="aggregateOpsPerSec" name="Aggregate ops/s" stroke="#22d3ee" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Instant Miner vs Continuous Workers */}
        <div className="bg-[#0B0F17] border border-slate-800 p-4">
          <ProvenanceBar title="2. Instant Miner vs Continuous Worker Throughput" source="Instant Jobs + Worker Pool" unit="ops/s" quality="MEASURED" intervalMs={1000} sampledAt={sampledAt} />
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="timeLabel" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#07090E', borderColor: '#334155', fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Area type="monotone" dataKey="instantOpsPerSec" name="Instant Miner" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.18} />
                <Area type="monotone" dataKey="continuousWorkerOpsPerSec" name="Continuous Workers" stroke="#10b981" fill="#10b981" fillOpacity={0.18} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. Four-Lane Residual & Convergence */}
        <div className="bg-[#0B0F17] border border-slate-800 p-4">
          <ProvenanceBar title="3. Four-Lane Closure Residual & Convergence" source="UniversalClockKernel Solver" unit="bits / %" quality="MEASURED" intervalMs={1000} sampledAt={sampledAt} />
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="timeLabel" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#07090E', borderColor: '#334155', fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="solverConvergencePct" name="Convergence %" stroke="#10b981" dot={false} />
                <Bar dataKey="fourLaneResidual" name="Residual Bits" fill="#f59e0b" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. Solver Convergence & Round-Trip Verification Error */}
        <div className="bg-[#0B0F17] border border-slate-800 p-4">
          <ProvenanceBar title="4. Registered Algorithm Execution Latency" source="Instant Solver + Miner SQLite" unit="μs / count" quality="MEASURED" intervalMs={1000} sampledAt={sampledAt} />
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={algoHistogramData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="alg" stroke="#64748b" tick={{ fontSize: 9 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#07090E', borderColor: '#334155', fontSize: 11 }} />
                <Bar dataKey="avgUs" name="Mean Duration (μs)" fill="#818cf8" />
                <Bar dataKey="count" name="Executions" fill="#22d3ee" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 5. Hash Computation Latency */}
        <div className="bg-[#0B0F17] border border-slate-800 p-4">
          <ProvenanceBar title="5. Hash Computation Latency" source="Per-Op hrtime.bigint() Delta" unit="μs" quality="MEASURED" intervalMs={1000} sampledAt={sampledAt} />
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="timeLabel" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#07090E', borderColor: '#334155', fontSize: 11 }} />
                <Line type="monotone" dataKey="hashLatencyUs" name="Avg Hash Latency (μs)" stroke="#f472b6" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 6. Clock Drift & Jitter Distribution */}
        <div className="bg-[#0B0F17] border border-slate-800 p-4">
          <ProvenanceBar title="6. Monotonic Clock Jitter & Compute Duration" source="UniversalClockScheduler (T=100k ns)" unit="μs" quality="MEASURED" intervalMs={1000} sampledAt={sampledAt} />
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="timeLabel" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#07090E', borderColor: '#334155', fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="clockJitterUs" name="Wake-up Jitter (μs)" stroke="#fbbf24" dot={false} />
                <Line type="monotone" dataKey="computeDurationUs" name="Batch Compute (μs)" stroke="#22d3ee" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 7. Stratum Share Submissions & Acceptance vs Rejection */}
        <div className="bg-[#0B0F17] border border-slate-800 p-4">
          <ProvenanceBar title="7. TCP Stratum Accepted vs Rejected Shares" source="StratumNetworkEngine SQLite shares" unit="shares" quality="MEASURED" intervalMs={1000} sampledAt={sampledAt} />
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series.slice(-20)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="timeLabel" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#07090E', borderColor: '#334155', fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="acceptedShares" name="Accepted Shares" fill="#10b981" />
                <Bar dataKey="rejectedShares" name="Rejected Shares" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 8. Nonce Search Rate vs Valid Candidates Scatter */}
        <div className="bg-[#0B0F17] border border-slate-800 p-4">
          <ProvenanceBar title="8. Throughput vs Valid Candidates Correlation" source="Instant+Worker SQLite" unit="ops/s vs hits" quality="DERIVED" intervalMs={1000} sampledAt={sampledAt} />
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="aggregateOpsPerSec" name="Throughput" unit=" ops/s" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis dataKey="validCandidates" name="Valid Hits" stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#07090E', borderColor: '#334155', fontSize: 11 }} />
                <Scatter name="Samples" data={series} fill="#38bdf8" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 9. Worker Utilization & Active Thread Count */}
        <div className="bg-[#0B0F17] border border-slate-800 p-4">
          <ProvenanceBar title="9. Continuous Worker State & Active Count" source="Tier 2 SQLite Worker Table" unit="workers" quality="MEASURED" intervalMs={1000} sampledAt={sampledAt} />
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workerStatusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="state" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: '#07090E', borderColor: '#334155', fontSize: 11 }} />
                <Bar dataKey="count" name="Workers" fill="#06b6d4" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 10. Memory, Heap & Event Loop Telemetry + Host Power Honest State */}
        <div className="bg-[#0B0F17] border border-slate-800 p-4">
          <ProvenanceBar
            title="10. Node.js Memory, Event Loop & Host Power"
            source="process.memoryUsage() / monitorEventLoopDelay"
            unit="MB / ms"
            quality={hostPowerProv?.quality === 'UNAVAILABLE' ? 'MEASURED' : 'MEASURED'}
            intervalMs={1000}
            sampledAt={sampledAt}
            missingReason={`Host Wattage Sensor: UNAVAILABLE (${hostPowerProv?.missingReason || 'No RAPL interface in container'})`}
          />
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cpuMemData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="metric" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#07090E', borderColor: '#334155', fontSize: 11 }} />
                <Bar dataKey="value" name="Measured Host Resource" fill="#a855f7" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 11. Queue Depth & Adaptive Backpressure */}
        <div className="bg-[#0B0F17] border border-slate-800 p-4">
          <ProvenanceBar title="11. Worker Queue Depth & Active Instance Count" source="Tier 2 Backpressure Monitor" unit="count" quality="MEASURED" intervalMs={1000} sampledAt={sampledAt} />
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="timeLabel" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: '#07090E', borderColor: '#334155', fontSize: 11 }} />
                <Area type="stepAfter" dataKey="activeWorkers" name="Active Workers" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
                <Area type="stepAfter" dataKey="queueDepth" name="Backpressure Depth" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 12. Verification Pass Rate & Verified Receipts Total */}
        <div className="bg-[#0B0F17] border border-slate-800 p-4">
          <ProvenanceBar title="12. Cumulative Verified Receipts Trend" source="SQLite 13-State Receipt Store" unit="receipts" quality="MEASURED" intervalMs={1000} sampledAt={sampledAt} />
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="timeLabel" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: '#07090E', borderColor: '#334155', fontSize: 11 }} />
                <Line type="monotone" dataKey="verifiedReceiptsTotal" name="Verified Receipts" stroke="#34d399" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 13. 13-State Clearing Funnel */}
        <div className="bg-[#0B0F17] border border-slate-800 p-4">
          <ProvenanceBar title="13. 13-State Receipt Clearing Lifecycle Distribution" source="SQLite receipts table" unit="receipts" quality="MEASURED" intervalMs={1000} sampledAt={sampledAt} />
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={receiptFunnelData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="state" stroke="#64748b" tick={{ fontSize: 8 }} interval={0} angle={-20} textAnchor="end" height={45} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: '#07090E', borderColor: '#334155', fontSize: 11 }} />
                <Bar dataKey="count" name="Receipts" fill="#38bdf8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 14. Confirmed Reward Balance Accrual */}
        <div className="bg-[#0B0F17] border border-slate-800 p-4">
          <ProvenanceBar title="14. Confirmed Settlement Balance vs Estimated Credit" source="SQLite append-only reward_entries" unit="USD" quality="MEASURED" intervalMs={1000} sampledAt={sampledAt} />
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="timeLabel" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#07090E', borderColor: '#334155', fontSize: 11 }} />
                <Area type="monotone" dataKey="confirmedRewardUsd" name="Confirmed Available USD" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 15. Network Latency & RTP Interarrival Jitter */}
        <div className="lg:col-span-2 bg-[#0B0F17] border border-slate-800 p-4">
          <ProvenanceBar
            title="15. Real TCP Stratum RTT, WebRTC ICE Peers & 90kHz RTP Clock Jitter"
            source="Node TCP Socket + WebRTC Mesh + RTP Sync"
            unit="ms / μs"
            quality={snapshot?.stratum.lastClientRttMs !== null ? 'MEASURED' : 'UNAVAILABLE'}
            intervalMs={1000}
            sampledAt={sampledAt}
            missingReason={snapshot?.stratum.lastClientRttMs === null ? 'Stratum TCP Client not yet connected; connect in Federated Coordinator tab to record real socket RTT.' : undefined}
          />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 font-mono text-xs mb-3">
            <div className="bg-slate-950 border border-slate-800 p-3">
              <div className="text-[10px] text-slate-400">STRATUM TCP SOCKET RTT</div>
              <div className="text-lg text-cyan-300 font-semibold mt-1">
                {snapshot?.stratum.lastClientRttMs !== null && snapshot?.stratum.lastClientRttMs !== undefined
                  ? `${snapshot.stratum.lastClientRttMs} ms`
                  : 'UNAVAILABLE'}
              </div>
            </div>
            <div className="bg-slate-950 border border-slate-800 p-3">
              <div className="text-[10px] text-slate-400">RTP 90kHz SSRC / SEQ</div>
              <div className="text-lg text-emerald-300 font-semibold mt-1">
                {snapshot?.latestRtpSync.ssrc || '—'} #{snapshot?.latestRtpSync.sequenceNumber ?? 0}
              </div>
            </div>
            <div className="bg-slate-950 border border-slate-800 p-3">
              <div className="text-[10px] text-slate-400">RTP INTERARRIVAL JITTER</div>
              <div className="text-lg text-amber-300 font-semibold mt-1">
                {snapshot?.latestRtpSync.interarrivalJitterUs ?? 0} μs
              </div>
            </div>
            <div className="bg-slate-950 border border-slate-800 p-3">
              <div className="text-[10px] text-slate-400">ACTIVE WEBRTC MESH PEERS</div>
              <div className="text-lg text-white font-semibold mt-1">
                {snapshot?.webrtcPeers.length ?? 0} peers
              </div>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 font-mono flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-cyan-400" /> Clock Uncertainty: ±{snapshot?.overview.clockUncertaintyNs?.toLocaleString() ?? '—'} ns</span>
            <span className="flex items-center gap-1"><Cpu className="w-3.5 h-3.5 text-emerald-400" /> CPU User: {snapshot?.hostTelemetry.cpuUserMicros ?? '—'} μs</span>
            <span className="flex items-center gap-1"><Database className="w-3.5 h-3.5 text-indigo-400" /> Verified Receipts: {snapshot?.overview.verifiedResultsCount ?? 0}</span>
            <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-cyan-400" /> Stripe Mode: {snapshot?.stripeStatus.mode ?? 'UNCONFIGURED'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
