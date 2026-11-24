/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
  Legend,
  type ChartOptions,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import {
  Activity,
  RefreshCw,
  Play,
  Pause,
  Zap,
  ChevronDown,
  ChevronRight,
  Search,
  CheckCircle2,
  AlertTriangle,
  WifiOff,
  Server,
  Cpu,
  ArrowRightLeft,
} from 'lucide-react';
import type {
  UnifiedMiningProfileId,
  MiningTelemetryReceipt,
  ProfileMiningConfig,
} from '../contracts/mining-profiles';
import type { BellmanFordCycleOpportunity } from '../engine/arbitrage/bellmanFordDetector';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
  Legend
);

interface NodeSubsystemSnapshot {
  sampledAtUtc: string;
  uptimeSeconds: number;
  wsClientsConnected: number;
  subsystems: {
    apiServer: { connected: boolean; status: string; port: number };
    websocketBus: { connected: boolean; status: string; clients: number };
    stratumNode: {
      connected: boolean;
      serverListening: boolean;
      clientConnected: boolean;
      port: number;
      status: string;
    };
    sqliteLedger: { connected: boolean; status: string; persistedRows: number };
    miningEngine: {
      connected: boolean;
      status: string;
      activeProfile: UnifiedMiningProfileId;
      workerCount: number;
    };
    clockKernel: { connected: boolean; status: string; uncertaintyNs: number };
    marketFeeds: {
      connected: boolean;
      onlineCount: number;
      totalCount: number;
      providers: Record<
        string,
        {
          providerId: string;
          isOnline: boolean;
          latencyMs: number;
          lastObservedAtUtc?: string;
        }
      >;
    };
  };
}

interface ExecutionReceipt {
  receiptId: string;
  cycleId: string;
  executedAtUtc: string;
  pathAssets: string[];
  venues: string[];
  grossSpreadBps: number;
  netProfitUsd: number;
  status: string;
  verificationDigest: string;
}

const PROFILE_LABELS: Record<UnifiedMiningProfileId, string> = {
  'sha256d-80-v1': 'SHA-256d 80B',
  'four-lane-sha256-v1': '4-Lane SIMD',
  'hccgn-work-v1': 'HCCGN Lattice',
};

function formatHashRate(hps: number): string {
  if (!Number.isFinite(hps) || hps <= 0) return '0 H/s';
  if (hps >= 1_000_000) return `${(hps / 1_000_000).toFixed(2)} MH/s`;
  if (hps >= 1_000) return `${(hps / 1_000).toFixed(2)} kH/s`;
  return `${Math.round(hps).toLocaleString()} H/s`;
}

function formatUtcShort(iso: string): string {
  if (!iso) return '--:--:--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--:--';
  return d.toISOString().slice(11, 19);
}

export const MiningArbitrageCommandDashboard: React.FC<{
  subseaLatencyMs?: number;
}> = ({ subseaLatencyMs }) => {
  // Mining telemetry state
  const [miningHistory, setMiningHistory] = useState<MiningTelemetryReceipt[]>([]);
  const [latestReceipt, setLatestReceipt] = useState<MiningTelemetryReceipt | null>(null);
  const [activeProfile, setActiveProfile] = useState<UnifiedMiningProfileId>('sha256d-80-v1');
  const [workerCount, setWorkerCount] = useState<number>(4);
  const [miningStatus, setMiningStatus] = useState<string>('LOADING');
  const [profilesMeta, setProfilesMeta] = useState<Record<string, ProfileMiningConfig>>({});
  const [isControlBusy, setIsControlBusy] = useState<boolean>(false);

  // Node connectivity state
  const [wsState, setWsState] = useState<'CONNECTED' | 'CONNECTING' | 'DISCONNECTED'>('CONNECTING');
  const [nodeSnapshot, setNodeSnapshot] = useState<NodeSubsystemSnapshot | null>(null);
  const [apiProbeLatencyMs, setApiProbeLatencyMs] = useState<number | null>(null);
  const [isNodeDetailOpen, setIsNodeDetailOpen] = useState<boolean>(false);
  const [isProbingNodes, setIsProbingNodes] = useState<boolean>(false);

  // Bellman-Ford Arbitrage state
  const [cycles, setCycles] = useState<BellmanFordCycleOpportunity[]>([]);
  const [graphStats, setGraphStats] = useState<{
    vertexCount: number;
    edgeCount: number;
    scanDurationUs: number;
    scannedAtUtc: string;
  }>({ vertexCount: 0, edgeCount: 0, scanDurationUs: 0, scannedAtUtc: '' });
  const [capitalUsd, setCapitalUsd] = useState<number>(25000);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyViable, setOnlyViable] = useState<boolean>(false);
  const [expandedCycleId, setExpandedCycleId] = useState<string | null>(null);
  const [executingCycleId, setExecutingCycleId] = useState<string | null>(null);
  const [lastExecutionReceipt, setLastExecutionReceipt] = useState<ExecutionReceipt | null>(null);
  const [isRescanning, setIsRescanning] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const capitalRef = useRef<number>(capitalUsd);
  capitalRef.current = capitalUsd;

  const probeConnectivity = useCallback(async () => {
    setIsProbingNodes(true);
    const t0 = performance.now();
    try {
      const res = await fetch('/api/node/connectivity');
      const rtt = Math.round(performance.now() - t0);
      setApiProbeLatencyMs(rtt);
      if (!res.ok) throw new Error(`Connectivity probe HTTP ${res.status}`);
      const data = await res.json();
      if (data.ok) {
        setNodeSnapshot(data);
        setFetchError(null);
      }
    } catch (err: any) {
      setFetchError(err?.message || 'Unable to reach backend connectivity endpoint');
      setNodeSnapshot(null);
    } finally {
      setIsProbingNodes(false);
    }
  }, []);

  const fetchInitialMining = useCallback(async () => {
    try {
      const res = await fetch('/api/mining/live-telemetry?limit=36');
      if (!res.ok) throw new Error(`Mining telemetry HTTP ${res.status}`);
      const data = await res.json();
      if (data.ok) {
        setMiningStatus(data.status);
        setActiveProfile(data.activeProfile);
        setWorkerCount(data.workerCount || 4);
        if (data.profiles) setProfilesMeta(data.profiles);
        if (Array.isArray(data.history)) {
          setMiningHistory(data.history.slice(-36));
        }
        if (data.latestReceipt) {
          setLatestReceipt(data.latestReceipt);
        }
      }
    } catch (err: any) {
      setFetchError(err?.message || 'Failed to load mining telemetry');
    }
  }, []);

  const fetchBellmanFord = useCallback(async (refresh: boolean, capUsd: number) => {
    setIsRescanning(true);
    try {
      const res = await fetch(
        `/api/arbitrage/bellman-ford?refresh=${refresh ? '1' : '0'}&capitalUsd=${capUsd}`
      );
      if (!res.ok) throw new Error(`Bellman-Ford scan HTTP ${res.status}`);
      const data = await res.json();
      if (data.ok) {
        setCycles(Array.isArray(data.opportunities) ? data.opportunities : []);
        setGraphStats({
          vertexCount: data.vertexCount ?? 0,
          edgeCount: data.edgeCount ?? 0,
          scanDurationUs: data.scanDurationUs ?? 0,
          scannedAtUtc: data.scannedAtUtc ?? '',
        });
        setFetchError(null);
      }
    } catch (err: any) {
      setFetchError(err?.message || 'Bellman-Ford scan failed');
    } finally {
      setIsRescanning(false);
    }
  }, []);

  // Initial load + periodic connectivity probe
  useEffect(() => {
    fetchInitialMining();
    fetchBellmanFord(false, capitalUsd);
    probeConnectivity();

    const probeTimer = setInterval(() => {
      probeConnectivity();
    }, 6000);

    return () => clearInterval(probeTimer);
  }, [fetchInitialMining, fetchBellmanFord, probeConnectivity, capitalUsd]);

  // Real-time WebSocket stream subscription (mining-arb:subscribe)
  useEffect(() => {
    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (closed) return;
      setWsState('CONNECTING');
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${proto}//${window.location.host}`);
      wsRef.current = socket;

      socket.onopen = () => {
        if (closed) return;
        setWsState('CONNECTED');
        socket.send(JSON.stringify({ type: 'mining-arb:subscribe' }));
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'mining-arb:tick') {
            if (msg.receipt) {
              const receipt: MiningTelemetryReceipt = msg.receipt;
              setLatestReceipt(receipt);
              setMiningStatus(receipt.providerStatus);
              setActiveProfile(receipt.profileId);
              if (receipt.workerCount > 0) setWorkerCount(receipt.workerCount);
              setMiningHistory((prev) => {
                if (prev.some((r) => r.receiptId === receipt.receiptId)) return prev;
                return [...prev, receipt].slice(-36);
              });
            }
            if (msg.bellmanFord && capitalRef.current === 25000) {
              setCycles(msg.bellmanFord.opportunities || []);
              setGraphStats({
                vertexCount: msg.bellmanFord.vertexCount ?? 0,
                edgeCount: msg.bellmanFord.edgeCount ?? 0,
                scanDurationUs: msg.bellmanFord.scanDurationUs ?? 0,
                scannedAtUtc: msg.bellmanFord.scannedAtUtc ?? '',
              });
            }
          }
        } catch {
          // Ignore malformed WS frames
        }
      };

      socket.onclose = () => {
        if (closed) return;
        setWsState('DISCONNECTED');
        reconnectTimer = setTimeout(connect, 2500);
      };

      socket.onerror = () => {
        setWsState('DISCONNECTED');
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        try {
          if (wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'mining-arb:unsubscribe' }));
          }
          wsRef.current.close();
        } catch {
          // Safe cleanup
        }
      }
    };
  }, []);

  // Poll Bellman-Ford with custom capital if user switched off 25000 default
  useEffect(() => {
    if (capitalUsd === 25000) return;
    const timer = setInterval(() => {
      fetchBellmanFord(true, capitalUsd);
    }, 3500);
    return () => clearInterval(timer);
  }, [capitalUsd, fetchBellmanFord]);

  const sendMiningControl = async (payload: {
    action?: 'PAUSE' | 'RESUME' | 'BATCH';
    profileId?: UnifiedMiningProfileId;
    workerCount?: number;
  }) => {
    setIsControlBusy(true);
    try {
      const res = await fetch('/api/mining/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        setMiningStatus(data.status);
        setActiveProfile(data.activeProfile);
        if (data.workerCount > 0) setWorkerCount(data.workerCount);
        if (data.latestReceipt) {
          setLatestReceipt(data.latestReceipt);
          setMiningHistory((prev) => {
            if (prev.some((r) => r.receiptId === data.latestReceipt.receiptId)) return prev;
            return [...prev, data.latestReceipt].slice(-36);
          });
        }
        probeConnectivity();
      }
    } catch (err: any) {
      setFetchError(err?.message || 'Mining control request failed');
    } finally {
      setIsControlBusy(false);
    }
  };

  const handleExecuteCycle = async (cycle: BellmanFordCycleOpportunity) => {
    setExecutingCycleId(cycle.cycleId);
    try {
      const res = await fetch('/api/arbitrage/bellman-ford/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycleId: cycle.cycleId }),
      });
      const data = await res.json();
      if (data.ok && data.receipt) {
        setLastExecutionReceipt(data.receipt);
      } else {
        setFetchError(data.error || 'Cycle verification failed');
      }
    } catch (err: any) {
      setFetchError(err?.message || 'Execution verification failed');
    } finally {
      setExecutingCycleId(null);
    }
  };

  // Filtered Bellman-Ford cycles
  const filteredCycles = useMemo(() => {
    const q = searchQuery.trim().toUpperCase();
    return cycles.filter((c) => {
      if (onlyViable && c.status !== 'VIABLE') return false;
      if (!q) return true;
      const pathMatch = c.pathAssets.some((a) => a.toUpperCase().includes(q));
      const venueMatch = c.venues.some((v) => v.toUpperCase().includes(q));
      return pathMatch || venueMatch;
    });
  }, [cycles, onlyViable, searchQuery]);

  // Derived metrics for KPI strip
  const rollingMeanHps = useMemo(() => {
    const activeSamples = miningHistory.filter((r) => r.hashesPerSecond > 0);
    if (activeSamples.length === 0) return 0;
    return Math.round(
      activeSamples.reduce((acc, r) => acc + r.hashesPerSecond, 0) / activeSamples.length
    );
  }, [miningHistory]);

  const viableCyclesCount = useMemo(
    () => cycles.filter((c) => c.status === 'VIABLE').length,
    [cycles]
  );

  const bestCycle = useMemo(() => (cycles.length > 0 ? cycles[0] : null), [cycles]);

  // Chart.js dataset 1: Real-time Hash Rate Stream
  const hashRateChartData = useMemo(() => {
    const labels = miningHistory.map((r) => formatUtcShort(r.timestampUtc));
    const values = miningHistory.map((r) => r.hashesPerSecond);
    const baseline = miningHistory.map(() => rollingMeanHps);

    return {
      labels,
      datasets: [
        {
          label: 'Measured Hash Rate (H/s)',
          data: values,
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.14)',
          borderWidth: 2,
          pointRadius: 2.5,
          pointHoverRadius: 5,
          pointBackgroundColor: '#38bdf8',
          fill: true,
          tension: 0.25,
        },
        {
          label: 'Rolling Mean Baseline (H/s)',
          data: baseline,
          borderColor: '#64748b',
          borderWidth: 1.5,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          tension: 0,
        },
      ],
    };
  }, [miningHistory, rollingMeanHps]);

  const hashRateChartOptions: ChartOptions<'line'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 220 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: {
            color: '#94a3b8',
            boxWidth: 12,
            boxHeight: 2,
            font: { family: '"JetBrains Mono", monospace', size: 11 },
          },
        },
        tooltip: {
          backgroundColor: '#0f172a',
          borderColor: '#334155',
          borderWidth: 1,
          titleColor: '#e2e8f0',
          bodyColor: '#cbd5e1',
          titleFont: { family: '"JetBrains Mono", monospace', size: 11 },
          bodyFont: { family: '"JetBrains Mono", monospace', size: 11 },
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatHashRate(Number(ctx.parsed.y || 0))}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(30, 41, 59, 0.55)' },
          ticks: {
            color: '#64748b',
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
            font: { family: '"JetBrains Mono", monospace', size: 10 },
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(30, 41, 59, 0.7)' },
          ticks: {
            color: '#94a3b8',
            font: { family: '"JetBrains Mono", monospace', size: 10 },
            callback: (val) => {
              const num = Number(val);
              if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
              if (num >= 1_000) return `${(num / 1_000).toFixed(0)}k`;
              return `${num}`;
            },
          },
        },
      },
    }),
    []
  );

  // Chart.js dataset 2: Bellman-Ford Cycle Gross vs Net Spread (bps)
  const spreadBarChartData = useMemo(() => {
    const topCycles = cycles.slice(0, 6);
    return {
      labels: topCycles.map((c) => c.pathAssets.join('→')),
      datasets: [
        {
          label: 'Gross Spread (bps)',
          data: topCycles.map((c) => c.grossSpreadBps),
          backgroundColor: 'rgba(56, 189, 248, 0.45)',
          borderColor: '#38bdf8',
          borderWidth: 1,
          borderRadius: 3,
        },
        {
          label: 'Net Return (bps)',
          data: topCycles.map((c) => c.netReturnBps),
          backgroundColor: topCycles.map((c) =>
            c.netReturnBps > 0 ? 'rgba(16, 185, 129, 0.75)' : 'rgba(239, 68, 68, 0.65)'
          ),
          borderColor: topCycles.map((c) => (c.netReturnBps > 0 ? '#10b981' : '#ef4444')),
          borderWidth: 1,
          borderRadius: 3,
        },
      ],
    };
  }, [cycles]);

  const spreadBarChartOptions: ChartOptions<'bar'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 220 },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: {
            color: '#94a3b8',
            boxWidth: 10,
            font: { family: '"JetBrains Mono", monospace', size: 11 },
          },
        },
        tooltip: {
          backgroundColor: '#0f172a',
          borderColor: '#334155',
          borderWidth: 1,
          titleFont: { family: '"JetBrains Mono", monospace', size: 11 },
          bodyFont: { family: '"JetBrains Mono", monospace', size: 11 },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: '#94a3b8',
            font: { family: '"JetBrains Mono", monospace', size: 10 },
          },
        },
        y: {
          grid: { color: 'rgba(30, 41, 59, 0.7)' },
          ticks: {
            color: '#94a3b8',
            font: { family: '"JetBrains Mono", monospace', size: 10 },
            callback: (val) => `${val} bps`,
          },
        },
      },
    }),
    []
  );

  // Determine overall node connectivity quorum
  const subsystems = nodeSnapshot?.subsystems;
  const allCriticalOnline = Boolean(
    wsState === 'CONNECTED' &&
      subsystems?.apiServer.connected &&
      subsystems?.sqliteLedger.connected &&
      subsystems?.marketFeeds.connected
  );

  return (
    <div className="flex flex-col gap-5 font-uclk-sans text-slate-100">
      {/* Node Connectivity Status Indicator Strip */}
      <section
        aria-label="Node Connectivity Status"
        className="bg-[#0B111C] border border-slate-800 rounded-lg px-4 py-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            {/* Live Connectivity Indicator */}
            <div className="flex items-center gap-2.5">
              {wsState === 'CONNECTED' && subsystems?.apiServer.connected ? (
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
              ) : wsState === 'CONNECTING' ? (
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-400" />
              )}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Node Connectivity
                </div>
                <div className="text-sm font-uclk-mono font-semibold text-white flex items-center gap-2">
                  <span>
                    {allCriticalOnline
                      ? 'QUORUM ONLINE'
                      : wsState === 'CONNECTING'
                      ? 'SYNCHRONIZING'
                      : subsystems?.apiServer.connected
                      ? 'PARTIAL DEGRADED'
                      : 'DISCONNECTED'}
                  </span>
                  <span className="text-slate-600">·</span>
                  <span className="text-xs text-slate-400 tabular-nums">
                    WS {wsState}
                    {nodeSnapshot ? ` (${nodeSnapshot.wsClientsConnected} clients)` : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Subsystem inline telemetry */}
            <div className="hidden md:flex items-center gap-3 text-xs font-uclk-mono text-slate-400 border-l border-slate-800 pl-4 tabular-nums">
              <span>
                API:{' '}
                <strong className={subsystems?.apiServer.connected ? 'text-emerald-400' : 'text-red-400'}>
                  {subsystems?.apiServer.connected ? 'ONLINE' : 'OFFLINE'}
                </strong>
                {apiProbeLatencyMs !== null ? ` (${apiProbeLatencyMs}ms)` : ''}
              </span>
              <span className="text-slate-700">/</span>
              <span>
                Stratum:{' '}
                <strong className={subsystems?.stratumNode.connected ? 'text-cyan-400' : 'text-amber-300'}>
                  {subsystems?.stratumNode.status || 'UNKNOWN'}
                </strong>
              </span>
              <span className="text-slate-700">/</span>
              <span>
                SQLite WAL:{' '}
                <strong className={subsystems?.sqliteLedger.connected ? 'text-emerald-400' : 'text-red-400'}>
                  {subsystems?.sqliteLedger.status || 'UNAVAILABLE'}
                </strong>
                {subsystems?.sqliteLedger ? ` (${subsystems.sqliteLedger.persistedRows} rows)` : ''}
              </span>
              <span className="text-slate-700">/</span>
              <span>
                Feeds:{' '}
                <strong className={subsystems?.marketFeeds.connected ? 'text-cyan-400' : 'text-red-400'}>
                  {subsystems
                    ? `${subsystems.marketFeeds.onlineCount}/${subsystems.marketFeeds.totalCount} Online`
                    : '0/0'}
                </strong>
              </span>
              {typeof subseaLatencyMs === 'number' && (
                <>
                  <span className="text-slate-700">/</span>
                  <span>
                    Subsea RTT: <strong className="text-slate-200">{subseaLatencyMs.toFixed(1)}ms</strong>
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={probeConnectivity}
              disabled={isProbingNodes}
              className="px-2.5 py-1.5 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isProbingNodes ? 'animate-spin' : ''}`} />
              <span>Probe Nodes</span>
            </button>
            <button
              onClick={() => setIsNodeDetailOpen((prev) => !prev)}
              className="px-2.5 py-1.5 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-medium text-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Server className="w-3.5 h-3.5 text-cyan-400" />
              <span>Topology</span>
              {isNodeDetailOpen ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Expandable Node & Provider Matrix */}
        {isNodeDetailOpen && subsystems && (
          <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-uclk-mono">
            <div className="bg-[#060A11] border border-slate-800/80 rounded p-2.5">
              <div className="text-slate-400 mb-1">Execution &amp; Ledger Nodes</div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">API / WS Port</span>
                <span className="text-slate-200">:{subsystems.apiServer.port}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">Stratum TCP</span>
                <span className="text-slate-200">:{subsystems.stratumNode.port}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">Server Uptime</span>
                <span className="text-slate-200 tabular-nums">{nodeSnapshot?.uptimeSeconds ?? 0}s</span>
              </div>
            </div>

            <div className="bg-[#060A11] border border-slate-800/80 rounded p-2.5">
              <div className="text-slate-400 mb-1">Kernel &amp; Mining Scheduler</div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">Universal Clock</span>
                <span className="text-emerald-400">{subsystems.clockKernel.status}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">Clock Uncertainty</span>
                <span className="text-slate-200 tabular-nums">±{subsystems.clockKernel.uncertaintyNs} ns</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">Active Workers</span>
                <span className="text-slate-200 tabular-nums">{subsystems.miningEngine.workerCount} threads</span>
              </div>
            </div>

            <div className="bg-[#060A11] border border-slate-800/80 rounded p-2.5 md:col-span-2">
              <div className="text-slate-400 mb-1">Exchange &amp; Liquidity Provider Adapters</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
                {Object.values(subsystems.marketFeeds.providers).map((p) => (
                  <div key={p.providerId} className="flex items-center justify-between gap-2">
                    <span className="text-slate-300 truncate">{p.providerId.replace(/_PUBLIC|_EXCHANGE|_MAINNET|_SPOT|_V2/g, '')}</span>
                    <span
                      className={`tabular-nums ${
                        p.isOnline ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {p.isOnline ? `${p.latencyMs}ms` : 'OFFLINE'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {fetchError && (
        <div className="bg-red-950/30 border border-red-800/60 rounded-lg px-4 py-2.5 text-xs text-red-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{fetchError}</span>
        </div>
      )}

      {/* 4-Column Genuine Telemetry KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Measured Hash Rate */}
        <div className="bg-[#0B111C] border border-slate-800 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Measured Hash Rate
          </div>
          <div className="mt-1.5 text-2xl font-bold font-uclk-mono tabular-nums text-white">
            {miningStatus === 'PAUSED'
              ? '0 H/s'
              : formatHashRate(latestReceipt?.hashesPerSecond ?? 0)}
          </div>
          <div className="mt-1 text-xs font-uclk-mono text-slate-400 tabular-nums">
            {PROFILE_LABELS[activeProfile]} · {miningStatus === 'PAUSED' ? 'PAUSED' : `${workerCount} workers`}
          </div>
        </div>

        {/* KPI 2: Verified Work & Candidates */}
        <div className="bg-[#0B111C] border border-slate-800 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Batch Work &amp; Verification
          </div>
          <div className="mt-1.5 text-2xl font-bold font-uclk-mono tabular-nums text-white">
            {latestReceipt ? latestReceipt.attempts.toLocaleString() : '0'}{' '}
            <span className="text-sm font-normal text-slate-400">hashes</span>
          </div>
          <div className="mt-1 text-xs font-uclk-mono text-slate-400 tabular-nums">
            <span className="text-emerald-400">{latestReceipt?.verifiedCandidates ?? 0} verified</span> ·{' '}
            {latestReceipt?.elapsedMicroseconds ?? 0} µs · Block #{latestReceipt?.blockNumber ?? '—'}
          </div>
        </div>

        {/* KPI 3: Bellman-Ford Graph Cycles */}
        <div className="bg-[#0B111C] border border-slate-800 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Bellman-Ford Neg Cycles
          </div>
          <div className="mt-1.5 text-2xl font-bold font-uclk-mono tabular-nums text-white">
            {viableCyclesCount}{' '}
            <span className="text-sm font-normal text-slate-400">
              viable / {cycles.length} tracked
            </span>
          </div>
          <div className="mt-1 text-xs font-uclk-mono text-slate-400 tabular-nums">
            {graphStats.vertexCount} assets · {graphStats.edgeCount} directed edges · {graphStats.scanDurationUs} µs
          </div>
        </div>

        {/* KPI 4: Best Net Arbitrage Opportunity */}
        <div className="bg-[#0B111C] border border-slate-800 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Top Net Cycle Yield
          </div>
          <div
            className={`mt-1.5 text-2xl font-bold font-uclk-mono tabular-nums ${
              bestCycle && bestCycle.netProfitUsd > 0 ? 'text-emerald-400' : 'text-slate-300'
            }`}
          >
            {bestCycle
              ? `${bestCycle.netProfitUsd >= 0 ? '+' : ''}$${bestCycle.netProfitUsd.toFixed(2)}`
              : '$0.00'}
          </div>
          <div className="mt-1 text-xs font-uclk-mono text-slate-400 tabular-nums truncate">
            {bestCycle
              ? `${bestCycle.pathAssets.join(' → ')} (${bestCycle.netReturnBps.toFixed(1)} bps)`
              : 'No cycles scanned'}
          </div>
        </div>
      </section>

      {/* Real-Time Chart.js Analytics Row */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Primary Chart: Real-Time Hash Rate Line Chart (Chart.js) */}
        <div className="lg:col-span-7 bg-[#0B111C] border border-slate-800 rounded-lg p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-sky-400" />
                <span>Real-Time Mining Hash Rate Stream (Chart.js)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 font-uclk-mono tabular-nums">
                Rolling Mean: {formatHashRate(rollingMeanHps)} · CPU:{' '}
                {latestReceipt?.schedulerMetrics.cpuUtilizationPct ?? 0}% · RSS:{' '}
                {latestReceipt?.schedulerMetrics.memoryRssMb ?? 0} MB
              </p>
            </div>

            {/* Mining Profile & Worker Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded border border-slate-800 bg-[#060A11] p-0.5">
                {(['sha256d-80-v1', 'four-lane-sha256-v1', 'hccgn-work-v1'] as UnifiedMiningProfileId[]).map(
                  (pid) => (
                    <button
                      key={pid}
                      disabled={isControlBusy}
                      onClick={() => sendMiningControl({ profileId: pid })}
                      title={profilesMeta[pid]?.name || pid}
                      className={`px-2 py-1 rounded text-[11px] font-uclk-mono transition-colors cursor-pointer ${
                        activeProfile === pid
                          ? 'bg-sky-600 text-white font-semibold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {PROFILE_LABELS[pid]}
                    </button>
                  )
                )}
              </div>

              <select
                aria-label="Worker Thread Count"
                value={workerCount}
                disabled={isControlBusy}
                onChange={(e) => sendMiningControl({ workerCount: Number(e.target.value) })}
                className="bg-[#060A11] border border-slate-800 rounded px-2 py-1 text-xs font-uclk-mono text-slate-200 cursor-pointer"
              >
                {[1, 2, 4, 8, 16].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? 'Worker' : 'Workers'}
                  </option>
                ))}
              </select>

              <button
                onClick={() =>
                  sendMiningControl({
                    action: miningStatus === 'PAUSED' ? 'RESUME' : 'PAUSE',
                  })
                }
                disabled={isControlBusy}
                className={`px-2.5 py-1 rounded border text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors ${
                  miningStatus === 'PAUSED'
                    ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30'
                    : 'bg-amber-600/15 border-amber-500/40 text-amber-300 hover:bg-amber-600/25'
                }`}
              >
                {miningStatus === 'PAUSED' ? (
                  <>
                    <Play className="w-3 h-3" />
                    <span>Resume</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-3 h-3" />
                    <span>Pause</span>
                  </>
                )}
              </button>

              <button
                onClick={() => sendMiningControl({ action: 'BATCH' })}
                disabled={isControlBusy || miningStatus === 'PAUSED'}
                className="px-2.5 py-1 rounded border border-sky-500/40 bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 text-xs font-medium flex items-center gap-1 cursor-pointer disabled:opacity-40"
              >
                <Cpu className="w-3 h-3" />
                <span>Hash Batch</span>
              </button>
            </div>
          </div>

          <div className="h-72 w-full">
            {miningHistory.length > 0 ? (
              <Line data={hashRateChartData} options={hashRateChartOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-xs font-uclk-mono text-slate-500">
                Waiting for first measured cryptographic receipt...
              </div>
            )}
          </div>

          {latestReceipt && (
            <div className="border-t border-slate-800/80 pt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] font-uclk-mono text-slate-400">
              <span>
                Latest Digest:{' '}
                <strong className="text-slate-200">{latestReceipt.bestDigestHex.slice(0, 24)}…</strong>
              </span>
              <span>
                Receipt Merkle:{' '}
                <strong className="text-slate-300">{latestReceipt.merkleRootHash.slice(0, 18)}…</strong>
              </span>
            </div>
          )}
        </div>

        {/* Secondary Chart: Bellman-Ford Cycle Spreads (Chart.js Bar) */}
        <div className="lg:col-span-5 bg-[#0B111C] border border-slate-800 rounded-lg p-4 flex flex-col gap-3">
          <div className="border-b border-slate-800/80 pb-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-emerald-400" />
              <span>Cycle Spread vs. Net Yield (bps)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 font-uclk-mono">
              Gross cycle return before gas/slippage vs. verified net edge
            </p>
          </div>
          <div className="h-72 w-full">
            {cycles.length > 0 ? (
              <Bar data={spreadBarChartData} options={spreadBarChartOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-xs font-uclk-mono text-slate-500">
                No directed liquidity cycles loaded
              </div>
            )}
          </div>
          <div className="border-t border-slate-800/80 pt-2.5 flex items-center justify-between text-[11px] font-uclk-mono text-slate-400 tabular-nums">
            <span>Weight Metric: w = -ln(rate · (1 - fee))</span>
            <span>Last Scan: {formatUtcShort(graphStats.scannedAtUtc)} UTC</span>
          </div>
        </div>
      </section>

      {/* Paper Execution Receipt Confirmation Banner */}
      {lastExecutionReceipt && (
        <div className="bg-emerald-950/25 border border-emerald-700/50 rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs font-uclk-mono">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <span className="text-emerald-300 font-semibold">
                {lastExecutionReceipt.status}
              </span>
              <span className="text-slate-500 mx-2">·</span>
              <span className="text-slate-200">{lastExecutionReceipt.pathAssets.join(' → ')}</span>
              <span className="text-slate-500 mx-2">·</span>
              <span className="text-emerald-400 tabular-nums">
                +${lastExecutionReceipt.netProfitUsd.toFixed(2)} ({lastExecutionReceipt.grossSpreadBps} bps gross)
              </span>
            </div>
          </div>
          <div className="text-slate-400 truncate max-w-md">
            SHA-256 Digest: <span className="text-slate-200">{lastExecutionReceipt.verificationDigest}</span>
          </div>
        </div>
      )}

      {/* Live Feed: Bellman-Ford Arbitrage Opportunities */}
      <section className="bg-[#0B111C] border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Bellman-Ford Cyclic Arbitrage Live Feed</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Negative-weight log-space cycle detection across live spot &amp; AMM venue quotes
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter asset or venue..."
                className="bg-[#060A11] border border-slate-800 rounded pl-8 pr-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-sky-500 w-44"
              />
            </div>

            {/* Viable filter toggle */}
            <button
              onClick={() => setOnlyViable((prev) => !prev)}
              className={`px-2.5 py-1.5 rounded border text-xs font-medium cursor-pointer transition-colors ${
                onlyViable
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                  : 'bg-[#060A11] border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {onlyViable ? 'Viable Only' : 'All Cycles'}
            </button>

            {/* Reference Capital selector */}
            <select
              aria-label="Reference Capital USD"
              value={capitalUsd}
              onChange={(e) => {
                const cap = Number(e.target.value);
                setCapitalUsd(cap);
                fetchBellmanFord(false, cap);
              }}
              className="bg-[#060A11] border border-slate-800 rounded px-2.5 py-1.5 text-xs font-uclk-mono text-slate-200 cursor-pointer"
            >
              <option value={10000}>$10,000 Capital</option>
              <option value={25000}>$25,000 Capital</option>
              <option value={100000}>$100,000 Capital</option>
            </select>

            <button
              onClick={() => fetchBellmanFord(true, capitalUsd)}
              disabled={isRescanning}
              className="px-3 py-1.5 rounded border border-sky-500/40 bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 text-xs font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRescanning ? 'animate-spin' : ''}`} />
              <span>Rescan Graph</span>
            </button>
          </div>
        </div>

        {/* High-density Opportunities Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-[#060A11] text-[11px] uppercase tracking-wider text-slate-400">
                <th className="py-2.5 px-4 font-semibold">Cycle Path &amp; Venues</th>
                <th className="py-2.5 px-3 font-semibold text-right">Σ Weight w</th>
                <th className="py-2.5 px-3 font-semibold text-right">Gross (bps)</th>
                <th className="py-2.5 px-3 font-semibold text-right">Fees + Gas + Slip</th>
                <th className="py-2.5 px-3 font-semibold text-right">Net Profit</th>
                <th className="py-2.5 px-3 font-semibold text-right">Age / Status</th>
                <th className="py-2.5 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 font-uclk-mono tabular-nums">
              {filteredCycles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No Bellman-Ford arbitrage cycles match the current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredCycles.map((cycle) => {
                  const isExpanded = expandedCycleId === cycle.cycleId;
                  const totalCost =
                    cycle.estimatedFeesUsd + cycle.estimatedGasUsd + cycle.estimatedSlippageUsd;
                  return (
                    <React.Fragment key={cycle.cycleId}>
                      <tr
                        onClick={() =>
                          setExpandedCycleId(isExpanded ? null : cycle.cycleId)
                        }
                        className="hover:bg-slate-900/50 cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            )}
                            <div>
                              <div className="font-semibold text-slate-100">
                                {cycle.pathAssets.join(' → ')}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                {cycle.venues
                                  .map((v) => v.replace(/_PUBLIC|_EXCHANGE|_MAINNET|_SPOT|_V2/g, ''))
                                  .join(' · ')}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-medium ${
                            cycle.cycleWeightSum < 0 ? 'text-emerald-400' : 'text-slate-400'
                          }`}
                        >
                          {cycle.cycleWeightSum.toFixed(6)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-sky-300">
                          {cycle.grossSpreadBps >= 0 ? '+' : ''}
                          {cycle.grossSpreadBps.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-400">
                          -${totalCost.toFixed(2)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-semibold ${
                            cycle.netProfitUsd > 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {cycle.netProfitUsd >= 0 ? '+' : ''}${cycle.netProfitUsd.toFixed(2)}
                          <span className="block text-[10px] font-normal text-slate-400">
                            {cycle.netReturnBps.toFixed(2)} bps
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span
                            className={`text-[11px] font-semibold ${
                              cycle.status === 'VIABLE'
                                ? 'text-emerald-400'
                                : cycle.status === 'MARGINAL'
                                ? 'text-amber-300'
                                : cycle.status === 'STALE'
                                ? 'text-orange-400'
                                : 'text-slate-500'
                            }`}
                          >
                            {cycle.status}
                          </span>
                          <span className="block text-[10px] text-slate-500">
                            {cycle.observationAgeMs}ms
                          </span>
                        </td>
                        <td
                          className="py-2.5 px-4 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleExecuteCycle(cycle)}
                            disabled={executingCycleId === cycle.cycleId}
                            className="px-2.5 py-1 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-uclk-sans font-medium text-slate-100 cursor-pointer disabled:opacity-50"
                          >
                            {executingCycleId === cycle.cycleId ? 'Verifying…' : 'Verify & Execute'}
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-[#060A11]">
                          <td colSpan={7} className="px-6 py-3 border-t border-slate-800/80">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2 text-[11px] text-slate-400">
                              <span>
                                Cycle ID: <strong className="text-slate-200">{cycle.cycleId}</strong> ·
                                Gross Multiplier:{' '}
                                <strong className="text-sky-300">{cycle.grossMultiplier}x</strong>
                              </span>
                              <span>
                                Costs Breakdown: Fees ${cycle.estimatedFeesUsd.toFixed(2)} · Gas $
                                {cycle.estimatedGasUsd.toFixed(2)} · Slippage $
                                {cycle.estimatedSlippageUsd.toFixed(2)}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                              {cycle.hops.map((hop) => (
                                <div
                                  key={`${cycle.cycleId}_hop_${hop.hopIndex}`}
                                  className="border border-slate-800 rounded px-3 py-2 bg-[#0B111C] text-[11px]"
                                >
                                  <div className="flex items-center justify-between text-slate-300 font-semibold">
                                    <span>
                                      Hop {hop.hopIndex}: {hop.fromAsset} → {hop.toAsset}
                                    </span>
                                    <span className="text-slate-400">{hop.feeBps} bps</span>
                                  </div>
                                  <div className="text-slate-400 mt-1">
                                    {hop.providerId} ({hop.pair} · {hop.side})
                                  </div>
                                  <div className="text-slate-300 mt-0.5">
                                    Rate: {hop.executionRate} · w: {hop.edgeWeight}
                                  </div>
                                </div>
                              ))}
                            </div>

                            <div className="mt-2 text-[10px] text-slate-500 truncate">
                              Verification SHA-256: {cycle.verificationDigest}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
