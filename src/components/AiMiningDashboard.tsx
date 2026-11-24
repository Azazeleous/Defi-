import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
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
import {
  Activity, Zap, Cpu, Wifi, TrendingUp, DollarSign, AlertTriangle,
  CheckCircle2, RefreshCw, Clock, ArrowUpRight, ArrowDownRight,
  ShieldAlert, ShieldCheck, Play, Pause, Layers, Sliders, Database,
  Server, HardDrive, BellRing, RotateCcw
} from 'lucide-react';
import { globalTraceEngine } from '../engine/cuboctahedralTraceEngine';
import { globalHarmonicEngine } from '../engine/harmonicResonanceEngine';
import { globalMfaAuthService } from '../services/mfaAuthService';

interface Props {
  onOpenMfaSecurity?: () => void;
  onOpenReports?: () => void;
  subseaLatencyMs?: number;
}

interface DowntimeAlert {
  id: string;
  severity: 'CRITICAL' | 'WARNING' | 'RESOLVED';
  title: string;
  description: string;
  timestamp: string;
  impactMinutes: number;
  lostProfitUsd: number;
  recovered: boolean;
}

export const AiMiningDashboard: React.FC<Props> = ({
  onOpenMfaSecurity,
  onOpenReports,
  subseaLatencyMs = 64.2,
}) => {
  const [timeRange, setTimeRange] = useState<'1H' | '24H' | '7D' | '30D'>('24H');
  const [isMiningActive, setIsMiningActive] = useState<boolean>(true);
  const [hashPowerBase, setHashPowerBase] = useState<number>(482.4); // TH/s
  const [unpaidBalanceUsd, setUnpaidBalanceUsd] = useState<number>(1842.50);
  const [rev24hUsd, setRev24hUsd] = useState<number>(428.10);

  // Downtime alerts state
  const [alerts, setAlerts] = useState<DowntimeAlert[]>([
    {
      id: 'alt_01',
      severity: 'WARNING',
      title: 'Subsea Fiber Cable Jitter Spike',
      description: 'Transient latency excursion (+18ms) observed on NODE_09 transatlantic link. Fallback route active.',
      timestamp: '14 mins ago',
      impactMinutes: 4,
      lostProfitUsd: 1.85,
      recovered: true,
    },
    {
      id: 'alt_02',
      severity: 'CRITICAL',
      title: 'Worker Stratum-Node-04 Heartbeat Missed',
      description: 'No accepted share received from rig Cluster-B for 180 seconds. Thermal throttle suspected.',
      timestamp: '2 mins ago',
      impactMinutes: 2,
      lostProfitUsd: 4.20,
      recovered: false,
    },
  ]);

  // Historical performance series generator based on time range
  const performanceData = useMemo(() => {
    const pointsCount = timeRange === '1H' ? 24 : timeRange === '24H' ? 24 : timeRange === '7D' ? 28 : 30;
    const data = [];
    const now = Date.now();
    const intervalMs =
      timeRange === '1H'
        ? 2.5 * 60 * 1000
        : timeRange === '24H'
        ? 60 * 60 * 1000
        : timeRange === '7D'
        ? 6 * 60 * 60 * 1000
        : 24 * 60 * 60 * 1000;

    let rollingBalance = 1400;

    for (let i = pointsCount - 1; i >= 0; i--) {
      const timestamp = new Date(now - i * intervalMs);
      const label =
        timeRange === '1H'
          ? `${timestamp.getHours()}:${('0' + timestamp.getMinutes()).slice(-2)}`
          : timeRange === '24H'
          ? `${timestamp.getHours()}:00`
          : `${timestamp.getMonth() + 1}/${timestamp.getDate()}`;

      // Simulate realistic fluctuation around base hashpower
      const noise = Math.sin(i * 0.7) * 18 + Math.cos(i * 1.3) * 12 + (Math.random() - 0.5) * 8;
      const totalHash = +(hashPowerBase + noise).toFixed(1);
      const aiTensorHash = +(totalHash * 0.68).toFixed(1);
      const powHash = +(totalHash * 0.32).toFixed(1);

      // Network throughput in MB/s
      const throughput = +(16.5 + Math.sin(i * 0.5) * 3.2 + (Math.random() - 0.5) * 1.5).toFixed(2);
      // Latency in ms (modulated by subsea)
      const latency = Math.max(8, Math.round(14 + Math.sin(i * 0.9) * 4 + (subseaLatencyMs / 64.2 - 1) * 6));

      // Earnings increment
      const earningIncrement = +(12.5 + (totalHash / 480) * 5 + (Math.random() - 0.5) * 2).toFixed(2);
      rollingBalance += earningIncrement;

      data.push({
        time: label,
        totalHash,
        aiTensorHash,
        powHash,
        difficultyTarget: 460,
        throughputMb: throughput,
        latencyMs: latency,
        earningsAccumUsd: +rollingBalance.toFixed(2),
        periodProfitUsd: earningIncrement,
      });
    }

    return data;
  }, [timeRange, hashPowerBase, subseaLatencyMs]);

  // Periodic tick for live metrics
  useEffect(() => {
    if (!isMiningActive) return;

    const interval = setInterval(() => {
      const delta = (Math.random() - 0.5) * 3.5;
      setHashPowerBase((prev) => +(prev + delta).toFixed(1));
      setUnpaidBalanceUsd((prev) => +(prev + 0.12).toFixed(2));
      setRev24hUsd((prev) => +(prev + 0.08).toFixed(2));
    }, 3000);

    return () => clearInterval(interval);
  }, [isMiningActive]);

  // Handle 1-click recover alert
  const handleRecoverAlert = (alertId: string) => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === alertId ? { ...a, severity: 'RESOLVED', recovered: true } : a
      )
    );
    globalHarmonicEngine.playCoaxialChime();
  };

  // Trigger manual instant solve burst
  const handleManualSolveBurst = () => {
    globalHarmonicEngine.playSolveBurstSound();
    setUnpaidBalanceUsd((prev) => +(prev + 8.50).toFixed(2));
    setRev24hUsd((prev) => +(prev + 8.50).toFixed(2));
    globalTraceEngine.resolveCustomBlockchainBlock(
      Math.floor(Date.now() / 1000),
      `SIG_AI_MINING_MANUAL_BLOCK_${Date.now().toString(16).slice(-6)}`,
      8500000n
    );
  };

  const mfaAccount = globalMfaAuthService.getAccountSecurity();
  const isMfaActive = mfaAccount.activeMethods.length > 0;

  return (
    <div className="w-full flex flex-col gap-5 text-slate-100 font-mono text-xs select-none">
      
      {/* Top Header & Quick Action Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[#060B14] border border-cyan-500/30 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/40 text-cyan-400">
            <Cpu className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-wide">
                AI MINING OPERATIONAL COMMAND DASHBOARD
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {isMiningActive ? 'LIVE MINING' : 'SUSPENDED'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Real-Time AI Tensor Compute &bull; Stratum Throughput &bull; Subsea Fiber Latency &bull; Unpaid Revenue Balance
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* MFA Security Shield Status */}
          {onOpenMfaSecurity && (
            <button
              onClick={onOpenMfaSecurity}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isMfaActive
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20 shadow-sm'
                  : 'bg-amber-500/20 border-amber-400 text-amber-300 hover:bg-amber-500/30 animate-pulse'
              }`}
              title="Configure Two-Factor Authentication (Authenticator App & SMS)"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{isMfaActive ? 'MFA: ENFORCED' : 'MFA: ACTION REQ'}</span>
            </button>
          )}

          {/* Advanced Reports Button */}
          {onOpenReports && (
            <button
              onClick={onOpenReports}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-400 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition"
            >
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
              <span>Reports &amp; Forecasts</span>
            </button>
          )}

          {/* Time Range Switcher */}
          <div className="flex bg-slate-950 border border-slate-800 p-1 rounded-xl">
            {(['1H', '24H', '7D', '30D'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all ${
                  timeRange === r
                    ? 'bg-cyan-500 text-black shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Power Switch */}
          <button
            onClick={() => setIsMiningActive(!isMiningActive)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition ${
              isMiningActive
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200 hover:bg-emerald-500/30'
                : 'bg-rose-500/20 border-rose-500/50 text-rose-200 hover:bg-rose-500/30'
            }`}
          >
            {isMiningActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isMiningActive ? 'Pause Mining' : 'Resume Mining'}</span>
          </button>
        </div>
      </div>

      {/* Proactive Downtime & Fault Sentry Alert Banner */}
      {alerts.some((a) => !a.recovered) && (
        <div className="p-3.5 bg-rose-950/30 border border-rose-500/50 rounded-xl space-y-2 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-300 font-bold text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-400 animate-bounce" />
              <span>DOWNTIME &amp; SENTRY ALERT DETECTED ({alerts.filter((a) => !a.recovered).length} ACTIVE)</span>
            </div>
            <span className="text-[10px] text-rose-400/80">Est. Impact: -$4.20 USD / hr</span>
          </div>

          <div className="space-y-1.5">
            {alerts.filter((a) => !a.recovered).map((a) => (
              <div
                key={a.id}
                className="p-2.5 bg-[#090D18] border border-rose-500/30 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="text-white font-bold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                    <span>{a.title}</span>
                    <span className="text-[10px] text-slate-500">[{a.timestamp}]</span>
                  </div>
                  <div className="text-slate-400 text-[11px] mt-0.5">{a.description}</div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRecoverAlert(a.id)}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] rounded-lg transition shadow-md"
                  >
                    Recover Worker &amp; Reconnect
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4 Primary Operational Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Real-Time Computational Hashing Power */}
        <div className="p-4 bg-[#060B14] border border-cyan-500/30 rounded-2xl relative overflow-hidden group hover:border-cyan-400 transition-all shadow-lg">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                COMPUTATIONAL HASH POWER
              </div>
              <div className="text-2xl font-bold text-white mt-1 flex items-baseline gap-1">
                <span>{hashPowerBase.toFixed(1)}</span>
                <span className="text-sm font-semibold text-cyan-400">TH/s</span>
              </div>
            </div>
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Cpu className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-400">AI Matrix Tensor Compute:</span>
              <span className="text-emerald-300 font-bold">{(hashPowerBase * 0.68).toFixed(1)} TH/s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Blake2b / SHA256d PoW:</span>
              <span className="text-cyan-300 font-bold">{(hashPowerBase * 0.32).toFixed(1)} TH/s</span>
            </div>
            <div className="flex justify-between text-slate-500 text-[10px]">
              <span>Valid Share Acceptance:</span>
              <span className="text-emerald-400 font-bold">99.88% (0.12% Stale)</span>
            </div>
          </div>
        </div>

        {/* Card 2: Network Throughput */}
        <div className="p-4 bg-[#060B14] border border-slate-800 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all shadow-lg">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                NETWORK THROUGHPUT
              </div>
              <div className="text-2xl font-bold text-white mt-1 flex items-baseline gap-1">
                <span>18.42</span>
                <span className="text-sm font-semibold text-emerald-400">MB/s</span>
              </div>
            </div>
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Wifi className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-400">Stratum TCP Ingest:</span>
              <span className="text-slate-200 font-bold">12.80 MB/s (2,840 pkts/s)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Share Broadcast Out:</span>
              <span className="text-slate-200 font-bold">5.62 MB/s</span>
            </div>
            <div className="flex justify-between text-slate-500 text-[10px]">
              <span>Block Propagation Rate:</span>
              <span className="text-cyan-300 font-bold">24.2 blocks / hr</span>
            </div>
          </div>
        </div>

        {/* Card 3: Real-Time Latency & Transport Jitter */}
        <div className="p-4 bg-[#060B14] border border-slate-800 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all shadow-lg">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                STRATUM LATENCY &amp; JITTER
              </div>
              <div className="text-2xl font-bold text-white mt-1 flex items-baseline gap-1">
                <span>{Math.round(14 * (subseaLatencyMs / 64.2))}</span>
                <span className="text-sm font-semibold text-cyan-400">ms RTT</span>
              </div>
            </div>
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-400">p50 / p95 / p99:</span>
              <span className="text-slate-200 font-bold">11ms / 22ms / 38ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Subsea Fiber Link RTT:</span>
              <span className="text-cyan-300 font-bold">{subseaLatencyMs.toFixed(1)} ms</span>
            </div>
            <div className="flex justify-between text-slate-500 text-[10px]">
              <span>Hardware Clock Jitter:</span>
              <span className="text-emerald-400 font-bold">&plusmn;12 &mu;s (Stable)</span>
            </div>
          </div>
        </div>

        {/* Card 4: User Earnings & Projected Revenue */}
        <div className="p-4 bg-[#060B14] border border-emerald-500/30 rounded-2xl relative overflow-hidden group hover:border-emerald-400 transition-all shadow-lg">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider">
                TOTAL UNPAID EARNINGS
              </div>
              <div className="text-2xl font-bold text-emerald-300 mt-1 flex items-baseline gap-1">
                <span>${unpaidBalanceUsd.toFixed(2)}</span>
                <span className="text-xs text-slate-400 font-normal">USD</span>
              </div>
            </div>
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-400">Last 24h Revenue:</span>
              <span className="text-emerald-300 font-bold">+${rev24hUsd.toFixed(2)} USD</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Projected 30d Revenue:</span>
              <span className="text-cyan-300 font-bold">${(rev24hUsd * 30).toFixed(0)} USD</span>
            </div>
            <div className="flex justify-between text-slate-500 text-[10px]">
              <span>Net Profit Margin:</span>
              <span className="text-emerald-400 font-bold">88.4% (After Fees &amp; Power)</span>
            </div>
          </div>
        </div>

      </div>

      {/* Visualizations for Historical Performance Data */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Chart (7 cols): Computational Hash Power & Difficulty Target */}
        <div className="lg:col-span-7 p-4 bg-[#060B14] border border-slate-800 rounded-2xl flex flex-col space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                Historical Computational Hash Power Trajectory ({timeRange})
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                AI Tensor Matrix acceleration vs Classical Cryptographic Proof-of-Work
              </p>
            </div>
            <button
              onClick={handleManualSolveBurst}
              className="px-2.5 py-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-[10px] rounded-lg shadow-md transition"
            >
              Solve Block (+8.50 USD)
            </button>
          </div>

          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="aiTensorGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00f0ff" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#00f0ff" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="powGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#39ff14" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#39ff14" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#0e1726" />
                <XAxis dataKey="time" stroke="#475569" tick={{ fontSize: 10 }} />
                <YAxis stroke="#475569" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#060B14', borderColor: '#1e293b', fontSize: '11px' }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '6px' }} />
                <Area type="monotone" dataKey="aiTensorHash" name="AI Tensor Hash (TH/s)" stroke="#00f0ff" fill="url(#aiTensorGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="powHash" name="Cryptographic PoW (TH/s)" stroke="#39ff14" fill="url(#powGrad)" strokeWidth={2} />
                <Line type="monotone" dataKey="difficultyTarget" name="Pool Difficulty Line" stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Chart (5 cols): Cumulative Earnings Accumulation */}
        <div className="lg:col-span-5 p-4 bg-[#060B14] border border-slate-800 rounded-2xl flex flex-col space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Cumulative Mining Earnings Curve
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Block Rewards &bull; Stratum Shares &bull; MEV Arbitrage Split
              </p>
            </div>
            <span className="text-[10px] text-emerald-400 font-bold font-mono">
              +${(rev24hUsd).toFixed(2)} 24h
            </span>
          </div>

          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#0e1726" />
                <XAxis dataKey="time" stroke="#475569" tick={{ fontSize: 10 }} />
                <YAxis stroke="#475569" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#060B14', borderColor: '#1e293b', fontSize: '11px' }}
                  labelStyle={{ color: '#94a3b8' }}
                  formatter={(val: any) => [`$${val} USD`, 'Cumulative Earnings']}
                />
                <Area type="monotone" dataKey="earningsAccumUsd" name="Balance ($USD)" stroke="#10b981" fill="url(#earningsGrad)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Network Throughput & Latency Dual Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-3.5 bg-[#060B14] border border-slate-800 rounded-xl space-y-1">
          <div className="text-[10px] text-slate-400 uppercase font-bold">Network Bandwidth Utilization</div>
          <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden mt-1.5 border border-slate-800">
            <div className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-full w-[64%]" />
          </div>
          <div className="text-[10px] text-slate-400 flex justify-between pt-1">
            <span>64% Saturation</span>
            <span className="text-cyan-300 font-bold">18.42 MB/s / 28.8 MB/s Cap</span>
          </div>
        </div>

        <div className="p-3.5 bg-[#060B14] border border-slate-800 rounded-xl space-y-1">
          <div className="text-[10px] text-slate-400 uppercase font-bold">Active Mining Workers</div>
          <div className="text-base font-bold text-white mt-0.5 flex items-center justify-between">
            <span>12 Online / 1 Faulted</span>
            <span className="text-emerald-400 text-xs">92.3% Uptime</span>
          </div>
          <div className="text-[10px] text-slate-400">
            ASIC Rigs: 8 &bull; GPU Tensor Nodes: 4 &bull; Failover: 1
          </div>
        </div>

        <div className="p-3.5 bg-[#060B14] border border-slate-800 rounded-xl space-y-1">
          <div className="text-[10px] text-slate-400 uppercase font-bold">Subsea Fiber Latency Bridge</div>
          <div className="text-base font-bold text-cyan-300 mt-0.5 flex items-center justify-between">
            <span>{subseaLatencyMs.toFixed(1)} ms RTT</span>
            <span className="text-[10px] text-emerald-400 font-normal">Transatlantic Optical</span>
          </div>
          <div className="text-[10px] text-slate-400">
            Optical Dispersion: Minimal &bull; Packets: 0% loss
          </div>
        </div>

        <div className="p-3.5 bg-[#060B14] border border-slate-800 rounded-xl space-y-1">
          <div className="text-[10px] text-slate-400 uppercase font-bold">Security &amp; MFA Status</div>
          <div className="text-base font-bold text-emerald-300 mt-0.5 flex items-center justify-between">
            <span>{isMfaActive ? 'Protected' : 'Unprotected'}</span>
            <button
              onClick={onOpenMfaSecurity}
              className="text-[10px] text-cyan-400 hover:underline cursor-pointer"
            >
              Configure &rarr;
            </button>
          </div>
          <div className="text-[10px] text-slate-400">
            Methods: {mfaAccount.activeMethods.join(' + ') || 'None'} &bull; 8 Recovery Codes
          </div>
        </div>
      </div>

    </div>
  );
};
