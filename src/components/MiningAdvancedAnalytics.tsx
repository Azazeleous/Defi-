import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Activity, Bell, CheckCircle2, RefreshCw, Sliders } from 'lucide-react';
import type { CrypticPlatformSnapshot, TelemetryPoint } from '../contracts/cryptic-platform';

export const MiningAdvancedAnalytics: React.FC = () => {
  const [series, setSeries] = useState<TelemetryPoint[]>([]);
  const [snapshot, setSnapshot] = useState<CrypticPlatformSnapshot | null>(null);
  const [jitterAlertThresholdUs, setJitterAlertThresholdUs] = useState<number>(5000);
  const [limit, setLimit] = useState<number>(60);

  const refresh = async () => {
    try {
      const [aRes, sRes] = await Promise.all([
        fetch(`/api/cryptic/analytics?limit=${limit}`),
        fetch('/api/cryptic/snapshot'),
      ]);
      const aData = await aRes.json();
      const sData = await sRes.json();
      if (aData.ok) setSeries(aData.bundle.series);
      if (sData.ok) setSnapshot(sData.snapshot);
    } catch {
      // ignore transient poll error
    }
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, [limit]);

  const latest = series[series.length - 1];
  const activeAlerts = [
    ...(snapshot?.workers || [])
      .filter((w) => w.state === 'FAILED' || w.state === 'DEGRADED')
      .map((w) => ({
        id: w.workerId,
        severity: w.state === 'FAILED' ? 'CRITICAL' : 'WARNING',
        title: `Worker ${w.label} (${w.state})`,
        detail: w.failureReason || 'Lease expiration or fault',
      })),
    ...series
      .filter((pt) => pt.clockJitterUs > jitterAlertThresholdUs)
      .slice(-3)
      .map((pt) => ({
        id: `jit_${pt.seq}`,
        severity: 'WARNING',
        title: `Clock Jitter Spike (${pt.clockJitterUs} μs)`,
        detail: `Exceeded configured ${jitterAlertThresholdUs} μs threshold at ${pt.timeLabel}`,
      })),
  ];

  return (
    <div className="w-full flex flex-col gap-5 text-slate-200 font-mono text-xs">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-white text-sm font-semibold flex items-center gap-2 tracking-wide">
            <Activity className="w-4 h-4 text-emerald-400" />
            LIVE COMPUTATION ANALYTICS & SENTRY DIAGNOSTICS
          </h2>
          <p className="text-slate-400 text-[11px] mt-0.5">
            Backed strictly by SQLite telemetry_series, Node.js process metrics, and real worker/clock state transitions.
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-950 p-1 border border-slate-800">
          {[30, 60, 120, 240].map((val) => (
            <button
              key={val}
              onClick={() => setLimit(val)}
              className={`px-2.5 py-1 text-[11px] transition-colors ${
                limit === val ? 'bg-emerald-500 text-black font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              {val}s
            </button>
          ))}
          <button onClick={refresh} className="px-2 py-1 text-slate-300 hover:text-white">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Measured Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-[#0B0F17] border border-slate-800">
          <div className="text-slate-400 text-[10px]">MEASURED OPS / SEC</div>
          <div className="text-xl font-semibold text-white mt-1">
            {latest?.aggregateOpsPerSec ?? 0} <span className="text-xs text-cyan-400">ops/s</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Instant: {latest?.instantOpsPerSec ?? 0} | Workers: {latest?.continuousWorkerOpsPerSec ?? 0}
          </div>
        </div>

        <div className="p-4 bg-[#0B0F17] border border-slate-800">
          <div className="text-slate-400 text-[10px]">SERVER UPTIME & CLOCK</div>
          <div className="text-xl font-semibold text-emerald-400 mt-1">
            {snapshot ? `${snapshot.uptimeSeconds}s` : '—'}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            State: {snapshot?.overview.clockState || '—'}
          </div>
        </div>

        <div className="p-4 bg-[#0B0F17] border border-slate-800">
          <div className="text-slate-400 text-[10px]">STRATUM TCP RTT</div>
          <div className="text-xl font-semibold text-white mt-1">
            {snapshot?.stratum.lastClientRttMs !== null && snapshot?.stratum.lastClientRttMs !== undefined
              ? `${snapshot.stratum.lastClientRttMs} ms`
              : 'UNAVAILABLE'}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Accepted Shares: {snapshot?.overview.acceptedSharesCount ?? 0}
          </div>
        </div>

        <div className="p-4 bg-[#0B0F17] border border-slate-800">
          <div className="text-slate-400 text-[10px]">ACTIVE SENTRY ALERTS</div>
          <div className="text-xl font-semibold text-white mt-1 flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" />
            <span>{activeAlerts.length}</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Threshold: Jitter &gt; {jitterAlertThresholdUs} μs
          </div>
        </div>
      </div>

      {/* Measured Area Chart */}
      <div className="p-4 bg-[#0B0F17] border border-slate-800 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="text-white font-semibold">Measured Aggregate Operations / Sec &amp; Clock Jitter (μs)</span>
          <span className="text-[10px] text-emerald-400">PROVENANCE: MEASURED</span>
        </div>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="timeLabel" stroke="#64748b" tick={{ fontSize: 10 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: '#07090E', borderColor: '#334155', fontSize: 11 }} />
              <Area type="monotone" dataKey="aggregateOpsPerSec" name="ops/sec" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Alerts + Threshold */}
      <div className="p-4 bg-[#0B0F17] border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-2">
          <span className="text-white font-semibold flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            Live Sentry Events & Threshold
          </span>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Jitter Threshold (μs):</span>
            <input
              type="number"
              min={50}
              max={100000}
              value={jitterAlertThresholdUs}
              onChange={(e) => setJitterAlertThresholdUs(Number(e.target.value))}
              className="w-24 bg-slate-950 border border-slate-700 px-2 py-1 text-white"
            />
          </div>
        </div>

        {activeAlerts.length === 0 ? (
          <div className="p-4 bg-slate-950 border border-slate-800 text-center text-slate-400 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>No threshold breaches or failed workers recorded.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {activeAlerts.map((a) => (
              <div key={a.id} className="p-3 bg-amber-950/30 border border-amber-500/30 flex justify-between items-center">
                <div>
                  <div className="font-semibold text-amber-200">{a.title}</div>
                  <div className="text-[11px] text-slate-400">{a.detail}</div>
                </div>
                <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-300">{a.severity}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
