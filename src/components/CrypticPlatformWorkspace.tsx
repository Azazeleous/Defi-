import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Cpu,
  Calculator,
  Server,
  Globe,
  BookOpen,
  Layers,
  BarChart3,
  Clock,
  FileCheck2,
  DollarSign,
  CreditCard,
  ShieldAlert,
  Settings,
  Play,
  Pause,
  Square,
  CheckCircle2,
  AlertTriangle,
  Wifi,
  RefreshCw,
} from 'lucide-react';
import type {
  AcceptanceGateTestResult,
  AlgorithmRegistryEntry,
  AlgorithmSelfTestResult,
  CrypticPlatformSnapshot,
  CrypticViewId,
  LiveAnalyticsBundle,
  MiningNetworkProfile,
  RbacRole,
  RtpClockSyncFrame,
  WebRtcIceConfig,
  WolframAdapterResult,
} from '../contracts/cryptic-platform';
import { CrypticLiveChartsPanel } from './CrypticLiveChartsPanel';
import { CrypticClearingPanel } from './CrypticClearingPanel';
import { FourLaneLatticeConsole } from './FourLaneLatticeConsole';
import { UniversalClockWorkspace } from './UniversalClockWorkspace';
import { NexusMemoryQuineWorkspace } from './NexusMemoryQuineWorkspace';

const NAV_ITEMS: readonly { id: CrypticViewId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: '1. Overview', icon: <Activity className="w-3.5 h-3.5" /> },
  { id: 'instant-miner', label: '2. Instant Miner', icon: <Cpu className="w-3.5 h-3.5" /> },
  { id: 'instant-solver', label: '3. Instant Solver', icon: <Calculator className="w-3.5 h-3.5" /> },
  { id: 'continuous', label: '4. Continuous Instances', icon: <Server className="w-3.5 h-3.5" /> },
  { id: 'federated', label: '5. Federated Coordinator', icon: <Globe className="w-3.5 h-3.5" /> },
  { id: 'registry', label: '6. Algorithm Registry', icon: <BookOpen className="w-3.5 h-3.5" /> },
  { id: 'four-lane', label: '7. Level-10 Lattice', icon: <Layers className="w-3.5 h-3.5" /> },
  { id: 'live-graphing', label: '8. Live Graphing', icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { id: 'clock-timing', label: '9. Clock and Timing', icon: <Clock className="w-3.5 h-3.5" /> },
  { id: 'receipt-ledger', label: '10. Receipt Ledger', icon: <FileCheck2 className="w-3.5 h-3.5" /> },
  { id: 'reward-accounting', label: '11. Reward Accounting', icon: <DollarSign className="w-3.5 h-3.5" /> },
  { id: 'stripe-connect', label: '12. Stripe Connect', icon: <CreditCard className="w-3.5 h-3.5" /> },
  { id: 'audit-diagnostics', label: '13. Audit & Diagnostics', icon: <ShieldAlert className="w-3.5 h-3.5" /> },
  { id: 'settings', label: '14. Settings & RBAC', icon: <Settings className="w-3.5 h-3.5" /> },
  { id: 'memory-convergence', label: '15. Memory, Quine & v6.1', icon: <BookOpen className="w-3.5 h-3.5" /> },
];

export const CrypticPlatformWorkspace: React.FC = () => {
  const [activeView, setActiveView] = useState<CrypticViewId>('overview');
  const [actorRole, setActorRole] = useState<RbacRole>('ADMINISTRATOR');
  const [snapshot, setSnapshot] = useState<CrypticPlatformSnapshot | null>(null);
  const [analyticsBundle, setAnalyticsBundle] = useState<LiveAnalyticsBundle | null>(null);
  const [algorithms, setAlgorithms] = useState<AlgorithmRegistryEntry[]>([]);
  const [networks, setNetworks] = useState<MiningNetworkProfile[]>([]);
  const [sqlitePath, setSqlitePath] = useState<string>('');
  const [selfTests, setSelfTests] = useState<AlgorithmSelfTestResult[]>([]);
  const [acceptanceTests, setAcceptanceTests] = useState<AcceptanceGateTestResult[]>([]);
  const [rtpFrames, setRtpFrames] = useState<RtpClockSyncFrame[]>([]);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  // Tier 1 Instant Miner form
  const [minerAlg, setMinerAlg] = useState<string>('crypto.sha256');
  const [minerNet, setMinerNet] = useState<string>('local.stratum.sha256');
  const [minerPayload, setMinerPayload] = useState<string>('HCCGN_GENESIS_CHALLENGE');
  const [minerZeros, setMinerZeros] = useState<number>(2);
  const [minerMaxIter, setMinerMaxIter] = useState<number>(2500);

  // Tier 1 Instant Solver & Wolfram form
  const [solverAlg, setSolverAlg] = useState<string>('rev.arx256');
  const [solverMode, setSolverMode] = useState<'FORWARD' | 'INVERSE' | 'ROUNDTRIP_VERIFY' | 'ERROR_CORRECT' | 'SYMBOLIC_CHECK'>('ROUNDTRIP_VERIFY');
  const [solverInput, setSolverInput] = useState<string>('HCCGN-REVERSIBLE-VECTOR-01');
  const [wolframExpr, setWolframExpr] = useState<string>('ModInverse[3, 11]');
  const [wolframResult, setWolframResult] = useState<WolframAdapterResult | null>(null);

  // Tier 2 Continuous Worker form
  const [workerLabel, setWorkerLabel] = useState<string>('Stratum-Node-01');
  const [workerAlg, setWorkerAlg] = useState<string>('crypto.sha256');

  // Tier 3 Stratum & WebRTC STUN/TURN state
  const [iceConfig, setIceConfig] = useState<WebRtcIceConfig | null>(null);
  const [stunInput, setStunInput] = useState<string>('stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302');
  const [turnUrlInput, setTurnUrlInput] = useState<string>('');
  const [turnUserInput, setTurnUserInput] = useState<string>('');
  const [webrtcLog, setWebrtcLog] = useState<string[]>([]);
  const [webrtcChannelState, setWebrtcChannelState] = useState<string>('IDLE');
  const [webrtcPingRttMs, setWebrtcPingRttMs] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const loadAll = async () => {
    try {
      const [sRes, aRes, algRes, audRes, netRes] = await Promise.all([
        fetch('/api/cryptic/snapshot'),
        fetch('/api/cryptic/analytics?limit=60'),
        fetch('/api/cryptic/algorithms'),
        fetch('/api/cryptic/audit'),
        fetch('/api/network/webrtc-config'),
      ]);
      const [sData, aData, algData, audData, netData] = await Promise.all([
        sRes.json(),
        aRes.json(),
        algRes.json(),
        audRes.json(),
        netRes.json(),
      ]);
      if (sData.ok) setSnapshot(sData.snapshot);
      if (aData.ok) setAnalyticsBundle(aData.bundle);
      if (algData.ok) {
        setAlgorithms(algData.algorithms);
        setNetworks(algData.networks);
        setSqlitePath(algData.sqlitePath);
      }
      if (audData.ok) setAcceptanceTests(audData.acceptanceTests || []);
      if (netData.ok) {
        setIceConfig(netData.config);
        setStunInput((netData.config?.stunUrls || []).join(','));
        setTurnUrlInput(netData.config?.turnUrl || '');
        setTurnUserInput(netData.config?.turnUsername || '');
      }
    } catch {
      // Transient fetch retry on next poll
    }
  };

  useEffect(() => {
    loadAll();
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}`);
    wsRef.current = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'cryptic:subscribe' }));
    };
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'cryptic:snapshot') {
          setSnapshot(msg.snapshot);
          if (msg.rtpFrame) {
            setRtpFrames((prev) => [msg.rtpFrame, ...prev.slice(0, 14)]);
          }
        }
      } catch {
        // Ignore parse error
      }
    };
    const tid = setInterval(loadAll, 3000);
    return () => {
      clearInterval(tid);
      ws.close();
    };
  }, []);

  const apiPost = async (url: string, body: unknown = {}) => {
    setFeedback(null);
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cryptic-role': actorRole,
      },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    if (!resp.ok || !data.ok) {
      setFeedback({ ok: false, text: data.error || `Request failed (${resp.status})` });
      return null;
    }
    await loadAll();
    return data;
  };

  // Real browser RTCPeerConnection P2P DataChannel verification over STUN/TURN ICE rules
  const runWebRtcP2PHandshake = async () => {
    setWebrtcLog(['Creating real browser RTCPeerConnection pair with configured STUN/TURN ICE servers...']);
    setWebrtcChannelState('CONNECTING');
    try {
      const iceServers: RTCIceServer[] = [
        { urls: stunInput.split(',').map((s) => s.trim()).filter(Boolean) },
      ];
      if (turnUrlInput.trim()) {
        iceServers.push({
          urls: turnUrlInput.trim(),
          username: turnUserInput.trim() || undefined,
        });
      }
      const cfg: RTCConfiguration = {
        iceServers,
        iceTransportPolicy: iceConfig?.iceTransportPolicy || 'all',
      };
      const pcA = new RTCPeerConnection(cfg);
      const pcB = new RTCPeerConnection(cfg);
      const dcA = pcA.createDataChannel('cryptic-telemetry-p2p');

      pcA.onicecandidate = (e) => {
        if (e.candidate) {
          pcB.addIceCandidate(e.candidate).catch(() => {});
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'webrtc:signal', fromPeer: 'pcA', signal: { candidate: e.candidate.candidate } }));
          }
        }
      };
      pcB.onicecandidate = (e) => {
        if (e.candidate) {
          pcA.addIceCandidate(e.candidate).catch(() => {});
        }
      };

      let sentTimeMs = 0;
      pcB.ondatachannel = (ev) => {
        const chB = ev.channel;
        chB.onmessage = (m) => {
          chB.send(`ACK:${m.data}`);
        };
      };

      dcA.onopen = () => {
        setWebrtcChannelState('OPEN');
        sentTimeMs = performance.now();
        dcA.send(`HCCGN_RTC_PING_${Date.now()}`);
        setWebrtcLog((l) => [...l, 'DataChannel OPEN — transmitting real RTC telemetry ping frame']);
      };

      dcA.onmessage = async (ev) => {
        const rtt = +(performance.now() - sentTimeMs).toFixed(2);
        setWebrtcPingRttMs(rtt);
        setWebrtcChannelState('VERIFIED');
        setWebrtcLog((l) => [...l, `Received DataChannel echo "${ev.data}" in ${rtt} ms`]);
        await fetch('/api/network/webrtc-peers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            peerId: 'rtc-local-mesh-01',
            label: 'Browser RTCPeerConnection DataChannel',
            connectionState: pcA.connectionState || 'connected',
            dataChannelState: dcA.readyState,
            selectedCandidateType: turnUrlInput.trim() ? 'stun+turn' : 'host/srflx',
            roundTripTimeMs: rtt,
            bytesTransferred: String(ev.data).length,
            lastSyncUtc: new Date().toISOString(),
          }),
        });
        await loadAll();
        setTimeout(() => {
          pcA.close();
          pcB.close();
        }, 400);
      };

      const offer = await pcA.createOffer();
      await pcA.setLocalDescription(offer);
      await pcB.setRemoteDescription(offer);
      const answer = await pcB.createAnswer();
      await pcB.setLocalDescription(answer);
      await pcA.setRemoteDescription(answer);
    } catch (err: any) {
      setWebrtcChannelState('ERROR');
      setWebrtcLog((l) => [...l, `WebRTC error: ${err.message}`]);
    }
  };

  return (
    <div className="min-h-[calc(100vh-65px)] bg-[#07090E] text-slate-200 flex flex-col lg:flex-row font-sans">
      {/* Left Navigation Sidebar (14 Required Views) */}
      <aside className="w-full lg:w-64 shrink-0 bg-[#0B0F17] border-b lg:border-b-0 lg:border-r border-slate-800 p-3 flex flex-col gap-3">
        <div className="px-2 py-2 border-b border-slate-800">
          <div className="text-[11px] font-mono font-semibold text-cyan-400 tracking-wider">
            HCCGN &bull; GAIA &bull; NEXUS
          </div>
          <div className="text-sm font-semibold text-white">CRYPTIC Platform v6.1.0</div>
          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
            Role: <span className="text-emerald-400">{actorRole}</span>
          </div>
        </div>

        <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-medium whitespace-nowrap text-left transition-colors border ${
                activeView === item.id
                  ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-200'
                  : 'bg-transparent border-transparent text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Workspace Canvas */}
      <section className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-5">
        {feedback && (
          <div
            className={`p-3 border text-xs font-mono flex items-center justify-between ${
              feedback.ok
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
            }`}
          >
            <span>{feedback.text}</span>
            <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white ml-4">
              Dismiss
            </button>
          </div>
        )}

        {/* 1. OVERVIEW */}
        {activeView === 'overview' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-semibold text-white">Platform Operational Overview</h2>
                <p className="text-xs text-slate-400">
                  Measured execution metrics only. SQLite Ledger: <span className="font-mono text-slate-300">{sqlitePath || 'storage/cryptic-ledger.sqlite'}</span>
                </p>
              </div>
              <button
                onClick={loadAll}
                className="px-3 py-1.5 bg-[#0B0F17] border border-slate-700 hover:border-cyan-400 text-xs font-mono flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh Snapshot
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono">
              <div className="bg-[#0B0F17] border border-slate-800 p-4">
                <div className="text-[10px] text-slate-400">UNIVERSAL CLOCK STATE</div>
                <div className="text-base font-semibold text-cyan-300 mt-1">{snapshot?.overview.clockState || 'READY'}</div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Source: {snapshot?.overview.clockSource || 'hrtime.bigint'} (&plusmn;{snapshot?.overview.clockUncertaintyNs?.toLocaleString() || '—'} ns)
                </div>
              </div>
              <div className="bg-[#0B0F17] border border-slate-800 p-4">
                <div className="text-[10px] text-slate-400">MEASURED OPS / SEC</div>
                <div className="text-base font-semibold text-white mt-1 tabular-nums">
                  {snapshot?.overview.aggregateOpsPerSec ?? 0} ops/s
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Active Workers: {snapshot?.overview.activeWorkers ?? 0}/{snapshot?.overview.totalWorkers ?? 0} | Instant Jobs: {snapshot?.overview.activeJobs ?? 0}
                </div>
              </div>
              <div className="bg-[#0B0F17] border border-slate-800 p-4">
                <div className="text-[10px] text-slate-400">VERIFIED RECEIPTS & SHARES</div>
                <div className="text-base font-semibold text-emerald-400 mt-1 tabular-nums">
                  {snapshot?.overview.verifiedResultsCount ?? 0} verified
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Shares Accepted: {snapshot?.overview.acceptedSharesCount ?? 0} | Rejected: {snapshot?.overview.rejectedSharesCount ?? 0}
                </div>
              </div>
              <div className="bg-[#0B0F17] border border-slate-800 p-4">
                <div className="text-[10px] text-slate-400">CONFIRMED USD & SETTLEMENT</div>
                <div className="text-base font-semibold text-white mt-1 tabular-nums">
                  ${(snapshot?.overview.balances.confirmedAvailableUsd ?? 0).toFixed(2)} USD
                </div>
                <div className="text-[10px] text-amber-300 mt-1">
                  Stripe Mode: {snapshot?.overview.settlementState || 'UNCONFIGURED'}
                </div>
              </div>
            </div>

            {/* Process Resource Telemetry */}
            <div className="bg-[#0B0F17] border border-slate-800 p-4 font-mono text-xs space-y-2">
              <div className="text-white font-semibold">Measured Host Runtime Telemetry (Honest Availability)</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                <div className="p-2.5 bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block">RSS Memory</span>
                  <span className="text-white font-semibold">
                    {snapshot ? `${(snapshot.hostTelemetry.memoryRssBytes / (1024 * 1024)).toFixed(1)} MB` : '—'}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block">Heap Used</span>
                  <span className="text-white font-semibold">
                    {snapshot ? `${(snapshot.hostTelemetry.heapUsedBytes / (1024 * 1024)).toFixed(1)} MB` : '—'}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block">Event Loop p99</span>
                  <span className="text-cyan-300 font-semibold">
                    {snapshot?.hostTelemetry.eventLoopP99Ms !== null ? `${snapshot?.hostTelemetry.eventLoopP99Ms} ms` : 'UNAVAILABLE'}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block">Hardware Power</span>
                  <span className="text-amber-300 font-semibold">UNAVAILABLE (No RAPL)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. INSTANT MINER */}
        {activeView === 'instant-miner' && (
          <div className="space-y-4 font-mono text-xs">
            <div className="bg-[#0B0F17] border border-slate-800 p-4 space-y-4">
              <div className="text-sm font-semibold text-white">Tier 1 — Bounded Asynchronous Instant Miner</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">PoW Algorithm</label>
                  <select value={minerAlg} onChange={(e) => setMinerAlg(e.target.value)} className="w-full bg-slate-950 border border-slate-700 p-2 text-white">
                    <option value="crypto.sha256">Double SHA-256 (FIPS 180-4)</option>
                    <option value="crypto.blake2b256">BLAKE2b-256 (RFC 7693)</option>
                    <option value="crypto.scrypt_salsa">Scrypt-Salsa20/8 (N=64)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Target Network (PoS Blocked)</label>
                  <select value={minerNet} onChange={(e) => setMinerNet(e.target.value)} className="w-full bg-slate-950 border border-slate-700 p-2 text-white">
                    {networks.map((n) => (
                      <option key={n.networkId} value={n.networkId}>
                        {n.name} [{n.consensusType}]
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Target 0-Nibbles</label>
                    <input type="number" min={1} max={5} value={minerZeros} onChange={(e) => setMinerZeros(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-700 p-2 text-white" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Max Iterations</label>
                    <input type="number" min={50} max={25000} value={minerMaxIter} onChange={(e) => setMinerMaxIter(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-700 p-2 text-white" />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[220px]">
                  <label className="text-[10px] text-slate-400 block mb-1">Header Input Payload</label>
                  <input type="text" value={minerPayload} onChange={(e) => setMinerPayload(e.target.value)} className="w-full bg-slate-950 border border-slate-700 p-2 text-white" />
                </div>
                <button
                  onClick={() =>
                    apiPost('/api/cryptic/instant-miner/start', {
                      algorithmId: minerAlg,
                      networkId: minerNet,
                      inputPayload: minerPayload,
                      targetLeadingZeroHexDigits: minerZeros,
                      maxIterations: minerMaxIter,
                    })
                  }
                  className="px-4 py-2 bg-cyan-500/20 border border-cyan-400 text-cyan-200 hover:bg-cyan-500/30 font-semibold flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" /> Start Bounded Job
                </button>
              </div>
            </div>

            <div className="bg-[#0B0F17] border border-slate-800 p-4 space-y-3">
              <div className="text-white font-semibold">Recent Instant Miner Sessions ({snapshot?.instantJobs.length || 0})</div>
              <div className="space-y-2">
                {(snapshot?.instantJobs || []).map((j) => (
                  <div key={j.jobId} className="p-3 bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-cyan-300 font-semibold">{j.jobId}</span>
                        <span className="text-slate-400 ml-2">{j.config.algorithmId} ({j.config.networkId})</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 bg-slate-800 text-white">{j.state}</span>
                        <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-300">{j.verificationOutcome}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] text-slate-300">
                      <div>Ops: {j.completedOperations}/{j.config.maxIterations}</div>
                      <div>Hashes/s: {j.hashesPerSec}</div>
                      <div>Valid Hits: {j.validCandidates}</div>
                      <div>p95 Lat: {j.p95LatencyNs} ns</div>
                      <div>Receipt: {j.receiptId || 'Pending'}</div>
                    </div>
                    {j.bestDigestHex && (
                      <div className="text-[10px] text-emerald-300 truncate">Best Digest (Nonce {j.bestNonce}): {j.bestDigestHex}</div>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {(['pause', 'resume', 'stop', 'cancel', 'verify', 'reset'] as const).map((act) => (
                        <button
                          key={act}
                          onClick={() => apiPost(`/api/cryptic/instant-miner/${j.jobId}/${act}`)}
                          className="px-2 py-1 border border-slate-700 bg-slate-900 hover:border-cyan-400 text-[10px] uppercase"
                        >
                          {act}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 3. INSTANT SOLVER & MATHEMATICA / WOLFRAM */}
        {activeView === 'instant-solver' && (
          <div className="space-y-4 font-mono text-xs">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-[#0B0F17] border border-slate-800 p-4 space-y-3">
                <div className="text-sm font-semibold text-white">Algorithm-Independent Instant Solver</div>
                <p className="text-[11px] text-slate-400">
                  Strictly enforces F(F⁻¹(Y)) = Y only on invertible transforms &amp; ECC; one-way hash inverse requests are explicitly rejected.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Registered Algorithm</label>
                    <select value={solverAlg} onChange={(e) => setSolverAlg(e.target.value)} className="w-full bg-slate-950 border border-slate-700 p-2 text-white">
                      {algorithms.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Solver Mode</label>
                    <select value={solverMode} onChange={(e) => setSolverMode(e.target.value as any)} className="w-full bg-slate-950 border border-slate-700 p-2 text-white">
                      <option value="ROUNDTRIP_VERIFY">ROUNDTRIP_VERIFY</option>
                      <option value="FORWARD">FORWARD</option>
                      <option value="INVERSE">INVERSE (Rejected for 1-Way Hashes)</option>
                      <option value="ERROR_CORRECT">ERROR_CORRECT (RS / QC-LDPC)</option>
                      <option value="SYMBOLIC_CHECK">SYMBOLIC_CHECK</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Input Vector / String</label>
                  <input type="text" value={solverInput} onChange={(e) => setSolverInput(e.target.value)} className="w-full bg-slate-950 border border-slate-700 p-2 text-white" />
                </div>
                <button
                  onClick={() => apiPost('/api/cryptic/solver/run', { algorithmId: solverAlg, mode: solverMode, inputData: solverInput })}
                  className="w-full py-2 bg-emerald-500/20 border border-emerald-400 text-emerald-200 hover:bg-emerald-500/30 font-semibold"
                >
                  Execute & Seal Verification Receipt
                </button>
              </div>

              {/* Wolfram / Mathematica CAS Adapter Boundary */}
              <div className="bg-[#0B0F17] border border-slate-800 p-4 space-y-3">
                <div className="text-sm font-semibold text-white">Wolfram / Mathematica &amp; Local Exact CAS Adapter</div>
                <p className="text-[11px] text-slate-400">
                  Evaluates symbolic algebraic checks (<span className="text-cyan-300">ModInverse[a,m]</span>, <span className="text-cyan-300">ChineseRemainder[&#123;r&#125;,&#123;m&#125;]</span>, <span className="text-cyan-300">GCD[a,b]</span>) and reports external Wolfram Cloud connection state honestly.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={wolframExpr}
                    onChange={(e) => setWolframExpr(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 p-2 text-white"
                    placeholder="ModInverse[3, 11]"
                  />
                  <button
                    onClick={async () => {
                      const d = await apiPost('/api/cryptic/wolfram/evaluate', { expression: wolframExpr });
                      if (d?.result) setWolframResult(d.result);
                    }}
                    className="px-4 py-2 bg-cyan-500/20 border border-cyan-400 text-cyan-200 font-semibold"
                  >
                    Evaluate
                  </button>
                </div>
                {wolframResult && (
                  <div className="p-3 bg-slate-950 border border-slate-800 space-y-1 text-[11px]">
                    <div className="text-cyan-300 font-semibold">Provider: {wolframResult.provider} ({wolframResult.status})</div>
                    <div className="text-white">Local Exact Result: {wolframResult.localResult || 'None'}</div>
                    <div className="text-slate-300">External Wolfram Result: {wolframResult.externalResult || 'UNAVAILABLE (not configured)'}</div>
                    <div className="text-[10px] text-amber-300">{wolframResult.diagnosticMessage}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-[#0B0F17] border border-slate-800 p-4 space-y-2">
              <div className="text-white font-semibold">Verified Solver Executions ({snapshot?.recentSolverResults.length || 0})</div>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {(snapshot?.recentSolverResults || []).map((r) => (
                  <div key={r.solveId} className="p-3 bg-slate-950 border border-slate-800 space-y-1 text-[11px]">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="text-cyan-300 font-semibold">{r.solveId} &bull; {r.algorithmId} ({r.mode})</span>
                      <span className={r.verificationOutcome === 'REJECTED' ? 'text-rose-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                        {r.verificationOutcome} (residual={r.residual}, corr={r.correctedErrorsCount})
                      </span>
                    </div>
                    <div className="text-slate-300 truncate">Forward: {r.forwardOutput}</div>
                    {r.inverseOutput && <div className="text-emerald-300 truncate">Inverse/Decoded: {r.inverseOutput}</div>}
                    {r.limitationNotice && <div className="text-amber-300 text-[10px]">{r.limitationNotice}</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 4. CONTINUOUS INSTANCES */}
        {activeView === 'continuous' && (
          <div className="space-y-4 font-mono text-xs">
            <div className="bg-[#0B0F17] border border-slate-800 p-4 flex flex-wrap items-end gap-3">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Worker Label</label>
                <input type="text" value={workerLabel} onChange={(e) => setWorkerLabel(e.target.value)} className="bg-slate-950 border border-slate-700 p-2 text-white" />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Algorithm</label>
                <select value={workerAlg} onChange={(e) => setWorkerAlg(e.target.value)} className="bg-slate-950 border border-slate-700 p-2 text-white">
                  <option value="crypto.sha256">Double SHA-256</option>
                  <option value="crypto.blake2b256">BLAKE2b-256</option>
                  <option value="crypto.scrypt_salsa">Scrypt-Salsa20/8</option>
                </select>
              </div>
              <button
                onClick={() => apiPost('/api/cryptic/workers', { label: workerLabel, algorithmId: workerAlg })}
                className="px-4 py-2 bg-cyan-500/20 border border-cyan-400 text-cyan-200 font-semibold"
              >
                + Provision Disjoint Lease Worker
              </button>
            </div>

            <div className="space-y-3">
              {(snapshot?.workers || []).map((w) => (
                <div key={w.workerId} className="bg-[#0B0F17] border border-slate-800 p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-white font-semibold">{w.label}</span>
                      <span className="text-slate-400 ml-2">({w.workerId}) &bull; Lease: {w.leaseId}</span>
                    </div>
                    <span className={`px-2 py-0.5 font-semibold ${w.state === 'RUNNING' ? 'bg-emerald-500/20 text-emerald-300' : w.state === 'FAILED' ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-800 text-slate-200'}`}>
                      {w.state}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] text-slate-300">
                    <div>Nonce Range: [{w.nonceRangeStart}..{w.nonceRangeEnd}]</div>
                    <div>Cursor: {w.currentCursor}</div>
                    <div>Measured ops/s: {w.measuredOpsPerSec}</div>
                    <div>Completed Ops: {w.completedOperations}</div>
                    <div>Backpressure: {w.backpressureActive ? 'ACTIVE' : 'NOMINAL'}</div>
                  </div>
                  {w.failureReason && <div className="text-amber-300 text-[10px]">{w.failureReason}</div>}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {(['start', 'pause', 'resume', 'stop', 'checkpoint', 'simulate-crash', 'recover', 'expire-lease'] as const).map((act) => (
                      <button
                        key={act}
                        onClick={() => apiPost(`/api/cryptic/workers/${w.workerId}/${act}`)}
                        className="px-2.5 py-1 border border-slate-700 bg-slate-950 hover:border-cyan-400 text-[10px] uppercase"
                      >
                        {act}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. FEDERATED COORDINATOR (TCP STRATUM + WEBRTC STUN/TURN P2P + RTP CLOCK SYNC) */}
        {activeView === 'federated' && (
          <div className="space-y-5 font-mono text-xs">
            {/* Real TCP Stratum Pool & Client */}
            <div className="bg-[#0B0F17] border border-slate-800 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <div>
                  <div className="text-white font-semibold">Real Node.js TCP Stratum v1 Server &amp; Client Socket</div>
                  <div className="text-[10px] text-slate-400">
                    Binds genuine TCP sockets (mining.subscribe &rarr; mining.authorize &rarr; mining.submit). PoS chains (Ethereum, Solana) strictly blocked.
                  </div>
                </div>
                <span className={`px-2 py-0.5 ${snapshot?.stratum.serverListening ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                  {snapshot?.stratum.serverListening ? `LISTENING ${snapshot.stratum.serverHost}:${snapshot.stratum.serverPort}` : 'SERVER STOPPED'}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <button onClick={() => apiPost('/api/stratum/server/start')} className="px-3 py-1.5 bg-emerald-500/20 border border-emerald-400 text-emerald-200">
                  Start TCP Stratum Server
                </button>
                <button onClick={() => apiPost('/api/stratum/server/job', { algorithmId: 'crypto.sha256', difficultyZeroNibbles: 2 })} className="px-3 py-1.5 bg-slate-900 border border-slate-700 text-slate-200">
                  Issue New Stratum Job
                </button>
                <button onClick={() => apiPost('/api/stratum/client/connect', { workerName: 'cryptic.worker.01' })} className="px-3 py-1.5 bg-cyan-500/20 border border-cyan-400 text-cyan-200">
                  Connect Client Socket
                </button>
                <button onClick={() => apiPost('/api/stratum/client/submit-share', { workerName: 'cryptic.worker.01' })} className="px-3 py-1.5 bg-indigo-500/20 border border-indigo-400 text-indigo-200">
                  Mine &amp; Submit Real TCP Share
                </button>
                <button onClick={() => apiPost('/api/stratum/server/stop')} className="px-3 py-1.5 bg-rose-500/20 border border-rose-500/40 text-rose-300">
                  Stop Server
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="p-2.5 bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block">Client Socket</span>
                  <span className="text-white font-semibold">{snapshot?.stratum.clientConnected ? 'CONNECTED' : 'DISCONNECTED'}</span>
                </div>
                <div className="p-2.5 bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block">TCP Measured RTT</span>
                  <span className="text-cyan-300 font-semibold">{snapshot?.stratum.lastClientRttMs !== null ? `${snapshot?.stratum.lastClientRttMs} ms` : '—'}</span>
                </div>
                <div className="p-2.5 bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block">Accepted Shares</span>
                  <span className="text-emerald-400 font-semibold">{snapshot?.stratum.serverAcceptedShares ?? 0}</span>
                </div>
                <div className="p-2.5 bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block">Rejected / Dup Shares</span>
                  <span className="text-rose-400 font-semibold">{snapshot?.stratum.serverRejectedShares ?? 0}</span>
                </div>
              </div>
            </div>

            {/* Live Browser WebRTC STUN/TURN + 90kHz RTP Clock Sync */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-[#0B0F17] border border-slate-800 p-4 space-y-3">
                <div className="text-white font-semibold flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-cyan-400" />
                  <span>WebRTC P2P DataChannel &amp; STUN/TURN ICE Mesh</span>
                </div>
                <div className="space-y-2 text-[11px]">
                  <div>
                    <label className="text-[10px] text-slate-400 block">STUN URLs (comma-separated)</label>
                    <input type="text" value={stunInput} onChange={(e) => setStunInput(e.target.value)} className="w-full bg-slate-950 border border-slate-700 p-2 text-white" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block">TURN URL (optional)</label>
                      <input type="text" value={turnUrlInput} onChange={(e) => setTurnUrlInput(e.target.value)} placeholder="turn:turn.example.com:3478" className="w-full bg-slate-950 border border-slate-700 p-2 text-white" />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block">TURN Username</label>
                      <input type="text" value={turnUserInput} onChange={(e) => setTurnUserInput(e.target.value)} className="w-full bg-slate-950 border border-slate-700 p-2 text-white" />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() =>
                        apiPost('/api/network/webrtc-config', {
                          stunUrls: stunInput.split(',').map((s) => s.trim()).filter(Boolean),
                          turnUrl: turnUrlInput.trim() || null,
                          turnUsername: turnUserInput.trim() || null,
                        })
                      }
                      className="px-3 py-1.5 bg-slate-900 border border-slate-700 text-slate-200"
                    >
                      Save ICE Policy
                    </button>
                    <button onClick={runWebRtcP2PHandshake} className="px-3 py-1.5 bg-cyan-500/20 border border-cyan-400 text-cyan-200 font-semibold">
                      Run Live WebRTC P2P Handshake ({webrtcChannelState})
                    </button>
                  </div>
                  {webrtcPingRttMs !== null && (
                    <div className="text-emerald-400">Measured WebRTC DataChannel RTT: {webrtcPingRttMs} ms</div>
                  )}
                  <div className="p-2 bg-slate-950 border border-slate-800 text-[10px] text-slate-400 max-h-24 overflow-y-auto">
                    {webrtcLog.length === 0 ? 'Click Run Live WebRTC P2P Handshake to exchange real SDP + ICE + DataChannel echo.' : webrtcLog.map((l, i) => <div key={i}>{l}</div>)}
                  </div>
                </div>
              </div>

              <div className="bg-[#0B0F17] border border-slate-800 p-4 space-y-3">
                <div className="text-white font-semibold">90 kHz RTP Media-Clock Sync Stream</div>
                <div className="space-y-1.5 max-h-56 overflow-y-auto text-[10px]">
                  {rtpFrames.length === 0 ? (
                    <div className="text-slate-500 py-6 text-center">Streaming RTP clock sync frames over WebSocket...</div>
                  ) : (
                    rtpFrames.map((f) => (
                      <div key={f.sequenceNumber} className="p-2 bg-slate-950 border border-slate-800 flex justify-between">
                        <span className="text-cyan-300">SSRC:{f.ssrc} Seq#{f.sequenceNumber} RTP:{f.rtpTimestamp90k}</span>
                        <span className="text-amber-300">Jitter: {f.interarrivalJitterUs} μs</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 6. ALGORITHM REGISTRY */}
        {activeView === 'registry' && (
          <div className="space-y-4 font-mono text-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0B0F17] border border-slate-800 p-4">
              <div>
                <div className="text-white font-semibold">Canonical Algorithm Registry ({algorithms.length} Algorithms)</div>
                <div className="text-[11px] text-slate-400">Separates exact reversible maps from cryptographic one-way functions.</div>
              </div>
              <button
                onClick={async () => {
                  const d = await apiPost('/api/cryptic/algorithms/test', {});
                  if (d?.results) setSelfTests(d.results);
                }}
                className="px-4 py-2 bg-emerald-500/20 border border-emerald-400 text-emerald-200 font-semibold"
              >
                Run Known-Answer Self-Test Vectors
              </button>
            </div>

            {selfTests.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {selfTests.map((t) => (
                  <div key={t.algorithmId} className={`p-3 border ${t.passed ? 'bg-emerald-950/20 border-emerald-500/40' : 'bg-rose-950/20 border-rose-500/40'}`}>
                    <div className="flex justify-between font-semibold text-white">
                      <span>{t.algorithmId}</span>
                      <span className={t.passed ? 'text-emerald-400' : 'text-rose-400'}>{t.passed ? 'PASS' : 'FAIL'}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">{t.vectorName}</div>
                    <div className="text-[10px] text-cyan-300 mt-0.5 truncate">{t.actualOutput}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {algorithms.map((a) => (
                <div key={a.id} className="bg-[#0B0F17] border border-slate-800 p-4 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-white font-semibold">{a.name}</span>
                    <span className="text-cyan-400">v{a.version}</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Category: {a.category} | Invertible: {String(a.isInvertible)} | One-Way: {String(a.isOneWayHash)} | PoW: {String(a.isPowAlgorithm)}
                  </div>
                  <div className="text-[11px] text-slate-300">{a.knownLimitations}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7. FOUR-LANE SOLVER */}
        {activeView === 'four-lane' && <FourLaneLatticeConsole />}

        {/* 8. LIVE GRAPHING */}
        {activeView === 'live-graphing' && (
          <CrypticLiveChartsPanel bundle={analyticsBundle} snapshot={snapshot} onRefresh={loadAll} />
        )}

        {/* 9. CLOCK AND TIMING */}
        {activeView === 'clock-timing' && <UniversalClockWorkspace />}

        {/* 10, 11, 12. RECEIPTS, REWARDS, STRIPE */}
        {(activeView === 'receipt-ledger' || activeView === 'reward-accounting' || activeView === 'stripe-connect') && (
          <CrypticClearingPanel
            mode={activeView}
            actorRole={actorRole}
            receipts={snapshot?.receipts || []}
            rewardEntries={snapshot?.rewardEntries || []}
            balances={
              snapshot?.overview.balances || {
                estimatedPendingUsd: 0,
                confirmedAvailableUsd: 0,
                settledLifetimeUsd: 0,
                reversedTotalUsd: 0,
                confirmedEntryCount: 0,
                estimatedEntryCount: 0,
              }
            }
            onRefresh={loadAll}
          />
        )}

        {/* 13. AUDIT & DIAGNOSTICS (GATES B-J TEST RUNNER) */}
        {activeView === 'audit-diagnostics' && (
          <div className="space-y-4 font-mono text-xs">
            <div className="bg-[#0B0F17] border border-slate-800 p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-white font-semibold">Automated Acceptance Gates B &ndash; J &amp; Security Audit Trail</div>
                <div className="text-[11px] text-slate-400">Runs live server-side verification across Miner/Solver, Workers, TCP Stratum, Wolfram CAS, Provenance, 13-State Clearing, Stripe Guard, Clock, and RBAC.</div>
              </div>
              <button
                onClick={async () => {
                  const d = await apiPost('/api/cryptic/acceptance/run', {});
                  if (d?.results) setAcceptanceTests(d.results);
                }}
                className="px-4 py-2 bg-cyan-500/20 border border-cyan-400 text-cyan-200 font-semibold"
              >
                Run Automated Gate B&ndash;J Suite
              </button>
            </div>

            {acceptanceTests.length > 0 && (
              <div className="space-y-2">
                {acceptanceTests.map((t) => (
                  <div key={t.testId} className={`p-3 border ${t.passed ? 'bg-emerald-950/20 border-emerald-500/40' : 'bg-rose-950/20 border-rose-500/40'}`}>
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="text-white font-semibold">Gate {t.gate} ({t.testId}): {t.title}</span>
                      <span className={t.passed ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                        {t.passed ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300 mt-1">Actual: {t.actualResult}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-[#0B0F17] border border-slate-800 p-4 space-y-2">
              <div className="text-white font-semibold">Persistent Security &amp; State Audit Events ({snapshot?.auditEvents.length || 0})</div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {(snapshot?.auditEvents || []).map((e) => (
                  <div key={e.eventId} className="p-2 bg-slate-950 border border-slate-800 flex justify-between text-[10px]">
                    <span>
                      <strong className={e.outcome === 'ALLOW' ? 'text-emerald-400' : 'text-rose-400'}>[{e.outcome}]</strong> {e.actorRole} &rarr; {e.action} ({e.targetId}) &bull; {e.detail}
                    </span>
                    <span className="text-slate-500">{e.utcTimestamp.slice(11, 19)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 14. SETTINGS & RBAC ROLE SWITCHER */}
        {activeView === 'settings' && (
          <div className="bg-[#0B0F17] border border-slate-800 p-4 space-y-4 font-mono text-xs">
            <div className="text-white font-semibold">Section 12 RBAC Role Console &amp; Server Policy</div>
            <p className="text-slate-400 text-[11px]">
              Switch active RBAC role header (`x-cryptic-role`) to verify server-side authorization enforcement across mutating operations (e.g., VIEWER cannot run jobs or trigger payouts; OPERATOR cannot trigger Stripe settlement).
            </p>
            <div className="flex flex-wrap gap-2">
              {(['VIEWER', 'OPERATOR', 'ENGINEER', 'ACCOUNTING', 'ADMINISTRATOR'] as const).map((r) => (
                <button
                  key={r}
                  onClick={async () => {
                    setActorRole(r);
                    await fetch('/api/cryptic/rbac/session', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'x-cryptic-role': r },
                      body: JSON.stringify({ actorId: 'ui-console' }),
                    });
                    await loadAll();
                  }}
                  className={`px-3 py-1.5 border ${
                    actorRole === r ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200 font-semibold' : 'border-slate-700 bg-slate-950 text-slate-400'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 15. MEMORY, QUINE, 4-DOMAIN MATH, HYGIENE & v6.1 VERIFICATION */}
        {activeView === 'memory-convergence' && <NexusMemoryQuineWorkspace actorRole={actorRole} />}
      </section>
    </div>
  );
};
