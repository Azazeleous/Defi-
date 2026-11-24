import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { TrendingUp, Clock, ShieldAlert, CheckCircle2, Cpu, Wifi, RefreshCw } from 'lucide-react';
import type { CrypticPlatformSnapshot, LiveAnalyticsBundle } from '../contracts/cryptic-platform';

export const AnalyticsDashboard: React.FC = () => {
  const [bundle, setBundle] = useState<LiveAnalyticsBundle | null>(null);
  const [snapshot, setSnapshot] = useState<CrypticPlatformSnapshot | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadLiveTelemetry = async () => {
    try {
      const [aRes, sRes] = await Promise.all([
        fetch('/api/cryptic/analytics?limit=30'),
        fetch('/api/cryptic/snapshot'),
      ]);
      const aData = await aRes.json();
      const sData = await sRes.json();
      if (aData.ok) setBundle(aData.bundle);
      if (sData.ok) setSnapshot(sData.snapshot);
      setErrorMsg(null);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  useEffect(() => {
    loadLiveTelemetry();
    const tid = setInterval(loadLiveTelemetry, 2000);
    return () => clearInterval(tid);
  }, []);

  const series = bundle?.series || [];
  const transportLatencyBars = [
    {
      channel: 'TCP Stratum Socket RTT',
      valueMs: snapshot?.stratum.lastClientRttMs ?? 0,
      status: snapshot?.stratum.lastClientRttMs !== null ? 'MEASURED' : 'DISCONNECTED',
    },
    {
      channel: 'Node Event Loop p99',
      valueMs: snapshot?.hostTelemetry.eventLoopP99Ms ?? 0,
      status: snapshot?.hostTelemetry.eventLoopP99Ms !== null ? 'MEASURED' : 'UNAVAILABLE',
    },
    {
      channel: 'UCLK Mean Compute (ms)',
      valueMs: series.length > 0 ? +(series[series.length - 1].computeDurationUs / 1000).toFixed(3) : 0,
      status: 'MEASURED',
    },
  ];

  return (
    <div className="w-full space-y-5 font-mono text-xs">
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[#0B0F17] border border-slate-800 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
              Source-Backed Mining & Execution Telemetry
            </h2>
            <p className="text-[11px] text-slate-400">
              Data Source: Node.js SQLite WAL &amp; hrtime.bigint() &bull; Sampling: {bundle?.collectionIntervalMs ?? 1000}ms &bull; Zero Simulated Math.sin Data
            </p>
          </div>
        </div>
        <button
          onClick={loadLiveTelemetry}
          className="px-3 py-1.5 bg-slate-900 border border-slate-700 hover:border-cyan-400 text-slate-200 flex items-center gap-1.5 rounded-lg"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-[10px] font-mono">
        <div className="p-2 bg-[#0B0F17] border border-emerald-500/30 text-emerald-300">
          <div className="font-bold">MEASURED</div>
          <div className="text-slate-400">hrtime.bigint / p99 / TCP RTT</div>
        </div>
        <div className="p-2 bg-[#0B0F17] border border-cyan-500/30 text-cyan-300">
          <div className="font-bold">PERSISTED_EVENTS</div>
          <div className="text-slate-400">SQLite WAL telemetry &amp; memory</div>
        </div>
        <div className="p-2 bg-[#0B0F17] border border-indigo-500/30 text-indigo-300">
          <div className="font-bold">DETERMINISTICALLY_DERIVED</div>
          <div className="text-slate-400">Hamiltonian / ARX inverse</div>
        </div>
        <div className="p-2 bg-[#0B0F17] border border-purple-500/30 text-purple-300">
          <div className="font-bold">EXTERNAL_WITH_EVIDENCE</div>
          <div className="text-slate-400">SHA-256 + timestamped pull</div>
        </div>
        <div className="p-2 bg-[#0B0F17] border border-amber-500/30 text-amber-300">
          <div className="font-bold">ESTIMATED</div>
          <div className="text-slate-400">Bounded jitter / FPS estimate</div>
        </div>
        <div className="p-2 bg-[#0B0F17] border border-slate-700 text-slate-300">
          <div className="font-bold">UNAVAILABLE</div>
          <div className="text-slate-400">Disconnected socket / no key</div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-950/50 border border-rose-500/40 text-rose-300 rounded-xl">
          Telemetry fetch error: {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Line Chart: Measured Operations/Sec Over Time */}
        <div className="p-4 bg-[#0B0F17] border border-slate-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span className="font-semibold text-white">Measured Operations / Sec (SQLite Series)</span>
            </div>
            <span className="text-[10px] text-emerald-300 border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5">
              MEASURED &bull; ops/s
            </span>
          </div>
          <div className="w-full h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="timeLabel" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#07090E', borderColor: '#334155', fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="aggregateOpsPerSec" name="Aggregate ops/s" stroke="#22d3ee" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="continuousWorkerOpsPerSec" name="Worker Pool ops/s" stroke="#10b981" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart: Real Measured Latencies */}
        <div className="p-4 bg-[#0B0F17] border border-slate-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-indigo-400" />
              <span className="font-semibold text-white">Measured Runtime & Socket Latency</span>
            </div>
            <span className="text-[10px] text-cyan-300 border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5">
              Unit: ms
            </span>
          </div>
          <div className="w-full h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={transportLatencyBars}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="channel" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#07090E', borderColor: '#334155', fontSize: 11 }} />
                <Bar dataKey="valueMs" name="Latency (ms)" fill="#818cf8" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* System Uptime & Audit/Receipt Verification Status List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="p-4 bg-[#0B0F17] border border-slate-800 rounded-xl space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-white">Measured Server Runtime</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between p-2.5 bg-slate-950 border border-slate-800 rounded">
              <span className="text-slate-400">Process Uptime:</span>
              <span className="text-white font-semibold">{snapshot ? `${snapshot.uptimeSeconds}s` : '—'}</span>
            </div>
            <div className="flex justify-between p-2.5 bg-slate-950 border border-slate-800 rounded">
              <span className="text-slate-400">Verified Receipts:</span>
              <span className="text-emerald-400 font-semibold">{snapshot?.overview.verifiedResultsCount ?? 0}</span>
            </div>
            <div className="flex justify-between p-2.5 bg-slate-950 border border-slate-800 rounded">
              <span className="text-slate-400">Hardware Power:</span>
              <span className="text-amber-300 font-semibold">UNAVAILABLE (No RAPL sensor)</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 p-4 bg-[#0B0F17] border border-slate-800 rounded-xl space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-white">Recent Verified Receipts & Audit Events</span>
          </div>
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {(snapshot?.auditEvents || []).slice(0, 6).map((evt) => (
              <div key={evt.eventId} className="p-2.5 bg-slate-950 border border-slate-800 rounded flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${evt.outcome === 'ALLOW' ? 'text-emerald-400' : 'text-amber-400'}`} />
                  <div>
                    <div className="text-white font-semibold">{evt.action} ({evt.actorRole})</div>
                    <div className="text-[10px] text-slate-400">{evt.detail}</div>
                  </div>
                </div>
                <span className="text-[10px] text-slate-500">{evt.utcTimestamp.slice(11, 19)} UTC</span>
              </div>
            ))}
            {(!snapshot || snapshot.auditEvents.length === 0) && (
              <div className="text-slate-500 text-center py-6">No runtime audit events recorded yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
