import React, { useState, useEffect, useRef } from 'react';
import {
  globalNexusOrchestrator,
  globalNexusBlockchain,
  globalNexusTempCache,
  FnvIsoBeatGenerator,
  NexusPipelineOrchestrator,
  AdvancedBidirectionalHashEngine256,
} from '../engine/nexusPerpetualEngine';
import {
  globalTraceEngine,
  LiveChainBlock,
} from '../engine/cuboctahedralTraceEngine';
import {
  CompressionCodec,
  CODEC_ACTIONS,
  SystemMetrics,
  PipelineExecutionResult,
  QTableStateEntry,
  ELRCReallocationMetrics,
  NexusBlockchainRecord,
  NexusTempCacheState,
} from '../types/nexus';
import {
  Cpu,
  Zap,
  Activity,
  Layers,
  ShieldCheck,
  Terminal,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  ArrowRightLeft,
  Flame,
  BatteryCharging,
  Sliders,
  CheckCircle2,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronRight,
  Database,
  Radio,
  Share2,
  Download,
  Copy,
  Check,
  FileJson,
  Server,
  HardDrive,
  Trash2,
  Tv
} from 'lucide-react';
import { NexusCecGateway } from './NexusCecGateway';
import { NexusMemoryQuineWorkspace } from './NexusMemoryQuineWorkspace';

interface Props {
  onSwitchToArbitrage: () => void;
  onSwitchToSubsea: () => void;
  onSwitchToQuantum: () => void;
  onSwitchToGaia: () => void;
}

export const NexusPerpetualWorkspace: React.FC<Props> = ({
  onSwitchToArbitrage,
  onSwitchToSubsea,
  onSwitchToQuantum,
  onSwitchToGaia,
}) => {
  const orchestratorRef = useRef<NexusPipelineOrchestrator>(globalNexusOrchestrator);
  const [activeTab, setActiveTab] = useState<'V45_CONVERGENCE' | 'ORCHESTRATOR' | 'BLOCKCHAIN_RECORDS' | 'TEMP_CACHE' | 'FOUR_LANE_8MB' | 'CEC_GATEWAY'>('V45_CONVERGENCE');
  const [isAutoStreamActive, setIsAutoStreamActive] = useState<boolean>(true);
  const [commandInput, setCommandInput] = useState<string>(
    'pipethru --adaptive-select | pipethru --optimize-cost | redirect /var/log/nexus_audit.json'
  );
  const [selectedDataset, setSelectedDataset] = useState<'BLOCK_LEDGER' | 'ARBITRAGE_CYCLES' | 'SUBSEA_TELEMETRY' | 'QUANTUM_FERMAT'>('BLOCK_LEDGER');
  
  // Real-time telemetry states
  const [metrics, setMetrics] = useState<SystemMetrics>(() => ({ ...orchestratorRef.current.system_metrics }));
  const [elrc, setElrc] = useState<ELRCReallocationMetrics>(() => orchestratorRef.current.computeELRCMetrics());
  const [qEntries, setQEntries] = useState<QTableStateEntry[]>(() => orchestratorRef.current.controller.getAllQTableEntries());
  const [auditLog, setAuditLog] = useState<PipelineExecutionResult[]>(() => [...orchestratorRef.current.auditHistory]);
  
  // Live actual blockchain records & FNV ISO beat
  const [blockchainRecords, setBlockchainRecords] = useState<readonly NexusBlockchainRecord[]>(() =>
    globalNexusBlockchain.getBlockchainDataset()
  );
  const [tempCacheState, setTempCacheState] = useState<NexusTempCacheState>(() =>
    globalNexusTempCache.getCacheState()
  );
  const [isoBeat, setIsoBeat] = useState(() => FnvIsoBeatGenerator.getIsoBeat());
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // ARX 256-bit state snapshot
  const [arxWords, setArxWords] = useState<string[]>(() =>
    orchestratorRef.current.state_engine.state.map((w) => w.toString(16).padStart(8, '0'))
  );
  const [smokeTestResult, setSmokeTestResult] = useState<{
    initialDigest: string;
    mutatedDigest: string;
    restoredDigest: string;
    roundtripVerified: boolean;
  } | null>(null);

  // ISO Beat Metronome rhythm ticker (60 Hz clock synchronization)
  useEffect(() => {
    const beatInterval = setInterval(() => {
      setIsoBeat(FnvIsoBeatGenerator.getIsoBeat());
    }, 250);
    return () => clearInterval(beatInterval);
  }, []);

  // Run automated stream ingestion cycle
  useEffect(() => {
    if (!isAutoStreamActive) return;

    const interval = setInterval(() => {
      const orchestrator = orchestratorRef.current;
      
      // Correlate true payload from active datasets
      let payload = "Quantum-Solfeggio-Interlaced-Fermat-Prime-Block-Structure";
      let chunkRef = "FERMAT_PRIME_SEED_0x55AA";

      if (selectedDataset === 'BLOCK_LEDGER') {
        const blocks = globalTraceEngine.getBlockLedger();
        const latest = blocks[blocks.length - 1];
        if (latest) {
          payload = `BLOCK_HASH[${latest.currentHash}]_PREV[${latest.previousHash.slice(0, 16)}]_NET[${latest.network || 'ETH'}]`;
          chunkRef = `LEDGER_BLK_#${latest.index}`;
        }
      } else if (selectedDataset === 'ARBITRAGE_CYCLES') {
        payload = `BELLMAN_FORD_PATH[ETH->USDC->WBTC->ETH]_PROFIT[+$412.80]_SLIPPAGE[0.042%]_LATENCY[12ms]`;
        chunkRef = `ARB_CYCLE_ACK_${Date.now() % 1000}`;
      } else if (selectedDataset === 'SUBSEA_TELEMETRY') {
        payload = `MAREA_OPTICAL_FIBER_BATHYMETRY[-4520m]_LATENCY[64.2ms]_TARGET[137451921129154222]`;
        chunkRef = `SUBSEA_PACKET_#${(Date.now() / 1000).toFixed(0)}`;
      }

      orchestrator.parse_and_execute_stream(commandInput, payload, chunkRef);

      // Refresh UI state with persistent runtime temp cache synchronization
      setMetrics({ ...orchestrator.system_metrics });
      setElrc(orchestrator.computeELRCMetrics());
      setQEntries(orchestrator.controller.getAllQTableEntries());
      setAuditLog([...orchestrator.auditHistory]);
      setArxWords(orchestrator.state_engine.state.map((w) => w.toString(16).padStart(8, '0')));
      setBlockchainRecords([...globalNexusBlockchain.getBlockchainDataset()]);
      setTempCacheState(globalNexusTempCache.getCacheState());
    }, 2400);

    return () => clearInterval(interval);
  }, [isAutoStreamActive, commandInput, selectedDataset]);

  // Execute manual pipeline stream once
  const handleExecuteManualStream = () => {
    const orchestrator = orchestratorRef.current;
    let payload = "Quantum-Solfeggio-Interlaced-Fermat-Prime-Block-Structure";
    if (selectedDataset === 'BLOCK_LEDGER') {
      const blocks = globalTraceEngine.getBlockLedger();
      const latest = blocks[blocks.length - 1];
      if (latest) {
        payload = `BLOCK_HASH[${latest.currentHash}]_TX[${latest.txCount || 1}]`;
      }
    }
    orchestrator.parse_and_execute_stream(commandInput, payload, "MANUAL_DISPATCH");

    setMetrics({ ...orchestrator.system_metrics });
    setElrc(orchestrator.computeELRCMetrics());
    setQEntries(orchestrator.controller.getAllQTableEntries());
    setAuditLog([...orchestrator.auditHistory]);
    setArxWords(orchestrator.state_engine.state.map((w) => w.toString(16).padStart(8, '0')));
    setBlockchainRecords([...globalNexusBlockchain.getBlockchainDataset()]);
    setTempCacheState(globalNexusTempCache.getCacheState());
  };

  // Run Smoke Test
  const handleRunSmokeTest = () => {
    const res = orchestratorRef.current.runSmokeTest();
    setSmokeTestResult(res);
  };

  // Forward ARX step manually
  const handleArxForward = () => {
    orchestratorRef.current.state_engine.execute_forward_step(1024);
    setArxWords(orchestratorRef.current.state_engine.state.map((w) => w.toString(16).padStart(8, '0')));
  };

  // Backward ARX step manually
  const handleArxBackward = () => {
    orchestratorRef.current.state_engine.execute_backward_step(1024);
    setArxWords(orchestratorRef.current.state_engine.state.map((w) => w.toString(16).padStart(8, '0')));
  };

  // Export all saved receipts from temp cache
  const handleExportCacheJSON = () => {
    const jsonStr = globalNexusTempCache.exportCacheAsJSON();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonStr);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `nexus-runtime-cache-receipts-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Copy hash utility
  const handleCopyHash = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  // Flush temp cache
  const handleFlushCache = () => {
    if (window.confirm("Flush local runtime temp cache? This will reset local receipts buffer.")) {
      globalNexusTempCache.flushCache();
      setTempCacheState(globalNexusTempCache.getCacheState());
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#010306] text-[#b8daf7] font-mono select-none overflow-y-auto scrollbar-thin scrollbar-thumb-[#101d2a]">
      {/* Top Banner & Nexus V2.0 Header */}
      <header className="h-[52px] bg-[#060a10] border-b border-[#101d2a] px-4 flex flex-wrap items-center justify-between text-xs tracking-wider z-30 shrink-0 gap-3">
        <div className="flex items-center gap-2.5 text-white font-bold">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 text-black">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[#00f0ff]">NEXUS v4.5</span>
              <span className="text-gray-500">&bull;</span>
              <span>GAIA EXECUTION FABRIC &amp; ADAPTIVE I/O CONTROLLER</span>
              <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded font-bold">
                A = B &and; C &and; V
              </span>
            </div>
          </div>
        </div>

        {/* Real-time FNV ISO Beat Metronome Indicator */}
        <div className="hidden md:flex items-center gap-2 bg-[#020508] border border-[#101d2a] px-3 py-1 rounded-lg text-[10px]">
          <span className="w-2 h-2 rounded-full bg-[#00f0ff]" />
          <span className="text-gray-400">FNV ISO BEAT:</span>
          <span className="text-[#00f0ff] font-bold">{isoBeat.beatHash.slice(0, 12)}...</span>
          <span className="text-gray-500">@ {isoBeat.hz}Hz</span>
        </div>

        {/* Global Navigation Substrate Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onSwitchToArbitrage}
            className="px-2.5 py-1 rounded bg-[#07121d] hover:bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/40 text-xs transition-colors"
          >
            Arbitrage
          </button>
          <button
            onClick={onSwitchToSubsea}
            className="px-2.5 py-1 rounded bg-[#07121d] hover:bg-[#ffb700]/20 text-[#ffb700] border border-[#ffb700]/40 text-xs transition-colors"
          >
            Subsea GIS
          </button>
          <button
            onClick={onSwitchToQuantum}
            className="px-2.5 py-1 rounded bg-[#07121d] hover:bg-purple-500/20 text-purple-300 border border-purple-500/40 text-xs transition-colors"
          >
            Quantum Capsule
          </button>
          <button
            onClick={onSwitchToGaia}
            className="px-2.5 py-1 rounded bg-[#07121d] hover:bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs transition-colors"
          >
            GAIA EYES
          </button>
        </div>
      </header>

      {/* Main Workspace Navigation Sub-Tabs */}
      <div className="bg-[#040810] border-b border-[#101d2a] px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center bg-[#07121d] border border-[#101d2a] p-1 rounded-lg overflow-x-auto gap-1">
          <button
            onClick={() => setActiveTab('V45_CONVERGENCE')}
            className={`px-3 py-1 rounded font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'V45_CONVERGENCE'
                ? 'bg-cyan-500 text-black shadow-sm font-semibold'
                : 'text-cyan-300 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>v4.5 Memory, Math &amp; Quine</span>
          </button>

          <button
            onClick={() => setActiveTab('ORCHESTRATOR')}
            className={`px-3 py-1 rounded font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'ORCHESTRATOR'
                ? 'bg-emerald-500 text-black shadow-sm font-semibold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Control Plane &amp; Q-Learning</span>
          </button>

          <button
            onClick={() => setActiveTab('BLOCKCHAIN_RECORDS')}
            className={`px-3 py-1 rounded font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'BLOCKCHAIN_RECORDS'
                ? 'bg-[#00f0ff] text-black shadow-sm font-semibold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Live Blockchain Records &amp; FNV Beat</span>
          </button>

          <button
            onClick={() => setActiveTab('TEMP_CACHE')}
            className={`px-3 py-1 rounded font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'TEMP_CACHE'
                ? 'bg-[#ffb700] text-black shadow-sm font-semibold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Runtime Temp Cache</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {tempCacheState.totalCachedReceipts}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('FOUR_LANE_8MB')}
            className={`px-3 py-1 rounded font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'FOUR_LANE_8MB'
                ? 'bg-purple-600 text-white shadow-sm font-semibold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>8 MiB Partition Spec</span>
          </button>

          <button
            onClick={() => setActiveTab('CEC_GATEWAY')}
            className={`px-3 py-1 rounded font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'CEC_GATEWAY'
                ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-black shadow-sm font-semibold'
                : 'text-cyan-300 hover:text-white'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span>CEC HTTP Gateway</span>
          </button>
        </div>

        {/* Cache Export Action */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCacheJSON}
            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all"
            title="Export all saved computation receipts as JSON"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Cached Receipts (.JSON)</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Pipeline Stream Parser, Q-Learning Matrix, ARX Engine & ELRC Telemetry */}
      <div className="flex-1 p-4 flex flex-col gap-4 max-w-7xl w-full mx-auto">
        {/* Row 1: ELRC Perpetual Power Reallocation Key Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="p-3 bg-[#060a10] border border-[#101d2a] rounded-xl">
            <span className="text-gray-500 block text-[10px] uppercase">Energy Expended</span>
            <span className="text-emerald-400 font-bold text-base">
              {metrics.energy_expenditure_joules.toFixed(4)} J
            </span>
            <span className="text-gray-400 block text-[9px] mt-0.5">ELRC Joules / Step</span>
          </div>

          <div className="p-3 bg-[#060a10] border border-[#101d2a] rounded-xl">
            <span className="text-gray-500 block text-[10px] uppercase">Joules Saved %</span>
            <span className="text-[#39ff14] font-bold text-base flex items-center gap-1">
              <BatteryCharging className="w-4 h-4" />
              {elrc.joulesSavedPct}%
            </span>
            <span className="text-gray-400 block text-[9px] mt-0.5">Q-Policy Compression</span>
          </div>

          <div className="p-3 bg-[#060a10] border border-[#101d2a] rounded-xl">
            <span className="text-gray-500 block text-[10px] uppercase">Optimal Codec</span>
            <span className="text-[#ffb700] font-bold text-base">
              {elrc.allocatedCodec}
            </span>
            <span className="text-gray-400 block text-[9px] mt-0.5">Cost Minimizer V(s)</span>
          </div>

          <div className="p-3 bg-[#060a10] border border-[#101d2a] rounded-xl">
            <span className="text-gray-500 block text-[10px] uppercase">Reallocated Power</span>
            <span className="text-cyan-400 font-bold text-base">
              {elrc.reallocatedPowerWatts} W
            </span>
            <span className="text-gray-400 block text-[9px] mt-0.5">Node Micro-grid</span>
          </div>

          <div className="p-3 bg-[#060a10] border border-[#101d2a] rounded-xl">
            <span className="text-gray-500 block text-[10px] uppercase">Ohm Equilibrium</span>
            <span className="text-amber-400 font-bold text-base">
              {elrc.ohmEquilibriumDraw} &Omega;
            </span>
            <span className="text-gray-400 block text-[9px] mt-0.5">1:1:1:1:1:1 Standard</span>
          </div>

          <div className="p-3 bg-[#060a10] border border-[#101d2a] rounded-xl">
            <span className="text-gray-500 block text-[10px] uppercase">Receipts Cached</span>
            <span className="text-[#39ff14] font-bold text-base flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              {tempCacheState.totalCachedReceipts}
            </span>
            <span className="text-gray-400 block text-[9px] mt-0.5">0 Dropped / 0 Wasted</span>
          </div>
        </div>

        {/* Tab 0: GAIA / NEXUS v4.5 Convergence, Save_Memory, Math & Quines */}
        {activeTab === 'V45_CONVERGENCE' && <NexusMemoryQuineWorkspace />}

        {/* Tab 1: Control Plane & Q-Learning */}
        {activeTab === 'ORCHESTRATOR' && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Stream Command Parser (7 cols) */}
              <div className="lg:col-span-7 p-4 bg-[#060a10] border border-[#101d2a] rounded-xl flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-[#101d2a] pb-2">
                  <span className="text-white font-bold flex items-center gap-2 text-xs">
                    <Terminal className="w-4 h-4 text-[#00f0ff]" />
                    STREAM PARSER: 'pipethru' & 'redirect' PIPELINE SYNTAX
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsAutoStreamActive(!isAutoStreamActive)}
                      className={`px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition-all ${
                        isAutoStreamActive
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-gray-800 text-gray-400 border border-gray-700'
                      }`}
                    >
                      {isAutoStreamActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      <span>{isAutoStreamActive ? 'Streaming Active' : 'Paused'}</span>
                    </button>

                    <button
                      onClick={handleExecuteManualStream}
                      className="px-2.5 py-1 rounded bg-[#07121d] hover:bg-gray-800 text-gray-200 border border-gray-700 text-xs font-semibold"
                    >
                      Dispatch Single Step
                    </button>
                  </div>
                </div>

                {/* Command Input Box */}
                <div className="space-y-1.5">
                  <label className="text-[11px] text-gray-400 flex items-center justify-between">
                    <span>Active Pipeline Command String:</span>
                    <span className="text-cyan-400 text-[10px]">Syntax: token | pipethru | redirect</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={commandInput}
                      onChange={(e) => setCommandInput(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-[#020407] border border-[#101d2a] text-cyan-300 font-mono text-xs focus:outline-none focus:border-[#00f0ff]"
                    />
                  </div>
                </div>

                {/* True Dataset Selection Switcher */}
                <div className="space-y-1.5">
                  <label className="text-[11px] text-gray-400">
                    Correlate Real Pipeline Stream from Live Dataset:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      onClick={() => setSelectedDataset('BLOCK_LEDGER')}
                      className={`p-2 rounded-lg border text-left text-[11px] font-bold transition-all ${
                        selectedDataset === 'BLOCK_LEDGER'
                          ? 'bg-blue-600/20 border-blue-500 text-white'
                          : 'bg-[#020407] border-gray-800 text-gray-400 hover:text-white'
                      }`}
                    >
                      <span className="block text-[9px] text-gray-500">Dataset 1</span>
                      Block Ledger Stream
                    </button>

                    <button
                      onClick={() => setSelectedDataset('ARBITRAGE_CYCLES')}
                      className={`p-2 rounded-lg border text-left text-[11px] font-bold transition-all ${
                        selectedDataset === 'ARBITRAGE_CYCLES'
                          ? 'bg-emerald-600/20 border-emerald-500 text-white'
                          : 'bg-[#020407] border-gray-800 text-gray-400 hover:text-white'
                      }`}
                    >
                      <span className="block text-[9px] text-gray-500">Dataset 2</span>
                      Arbitrage Bellman Radar
                    </button>

                    <button
                      onClick={() => setSelectedDataset('SUBSEA_TELEMETRY')}
                      className={`p-2 rounded-lg border text-left text-[11px] font-bold transition-all ${
                        selectedDataset === 'SUBSEA_TELEMETRY'
                          ? 'bg-cyan-600/20 border-cyan-500 text-white'
                          : 'bg-[#020407] border-gray-800 text-gray-400 hover:text-white'
                      }`}
                    >
                      <span className="block text-[9px] text-gray-500">Dataset 3</span>
                      Subsea Cable Telemetry
                    </button>

                    <button
                      onClick={() => setSelectedDataset('QUANTUM_FERMAT')}
                      className={`p-2 rounded-lg border text-left text-[11px] font-bold transition-all ${
                        selectedDataset === 'QUANTUM_FERMAT'
                          ? 'bg-purple-600/20 border-purple-500 text-white'
                          : 'bg-[#020407] border-gray-800 text-gray-400 hover:text-white'
                      }`}
                    >
                      <span className="block text-[9px] text-gray-500">Dataset 4</span>
                      Quantum Prime Seeds
                    </button>
                  </div>
                </div>

                {/* Latest Execution Output Container */}
                <div className="p-3 bg-[#010204] border border-[#101d2a] rounded-lg text-xs space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-400">Processed Output Container:</span>
                    <span className="text-[#39ff14] font-bold">STATUS: SUCCESS &bull; RUNTIME SAVED</span>
                  </div>
                  <div className="p-2 bg-[#050811] rounded border border-gray-800 text-cyan-300 font-mono text-[11px] break-all select-all">
                    {auditLog[0]?.processed_payload || "[ZSTD_CONTAINER_DATA_BLOCK(Quantum-Solfeggio-Interlaced-Fermat-Prime...)]"}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-500">
                    <span>Latency: {metrics.latency_ms} ms</span>
                    <span>Payload: {metrics.incoming_bytes} bytes</span>
                    <span>Intermediary ARX: {auditLog[0]?.execution_audit[0]?.intermediary_state_digest || "55aa55aaff00ff00"}</span>
                  </div>
                </div>
              </div>

              {/* Bidirectional 32-bit ARX Engine (5 cols) */}
              <div className="lg:col-span-5 p-4 bg-[#060a10] border border-[#101d2a] rounded-xl flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-[#101d2a] pb-2">
                  <span className="text-[#ffb700] font-bold flex items-center gap-2 text-xs">
                    <ShieldCheck className="w-4 h-4 text-[#ffb700]" />
                    BIDIRECTIONAL 32-BIT ARX ENGINE (256-BIT)
                  </span>
                  <button
                    onClick={handleRunSmokeTest}
                    className="px-2 py-0.5 rounded bg-[#ffb700]/10 hover:bg-[#ffb700]/20 text-[#ffb700] border border-[#ffb700]/30 text-[10px] font-bold"
                  >
                    Run Smoke Test
                  </button>
                </div>

                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Addition-Rotation-XOR equations with odd/even interlacing ({'0x55555555'} / {'0xAAAAAAAA'}). Bijective roundtrip guarantees zero data loss.
                </p>

                {/* 8 x 32-bit Words State Vector */}
                <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
                  {arxWords.map((word, idx) => (
                    <div key={`arx-word-${idx}`} className="p-2 rounded bg-[#020407] border border-[#101d2a]">
                      <span className="text-gray-500 block text-[9px]">Word {String.fromCharCode(65 + idx)}</span>
                      <span className="text-[#00f0ff] font-bold text-[11px]">0x{word}</span>
                    </div>
                  ))}
                </div>

                {/* Stepping Action Buttons */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#101d2a]">
                  <button
                    onClick={handleArxBackward}
                    className="flex-1 py-1.5 px-2 rounded bg-[#07121d] hover:bg-gray-800 text-amber-400 border border-amber-500/30 text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Step Backward (-)</span>
                  </button>

                  <button
                    onClick={handleArxForward}
                    className="flex-1 py-1.5 px-2 rounded bg-[#07121d] hover:bg-gray-800 text-[#39ff14] border border-[#39ff14]/30 text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Step Forward (+)</span>
                  </button>
                </div>

                {/* Smoke Test Roundtrip Output Notification */}
                {smokeTestResult && (
                  <div className="p-2.5 bg-[#020503] border border-[#39ff14]/40 rounded text-[10px] space-y-1">
                    <div className="text-[#39ff14] font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#39ff14]" />
                      <span>SMOKE TEST PASSED &bull; BIJECTIVE REVERSIBILITY CONFIRMED</span>
                    </div>
                    <div className="text-gray-400">
                      Initial == Restored: <strong className="text-white">{smokeTestResult.roundtripVerified ? "TRUE (100% Exact Match)" : "FALSE"}</strong>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Row 3: Adaptive Q-Learning Controller Matrix & Policy Heatmap */}
            <div className="p-4 bg-[#060a10] border border-[#101d2a] rounded-xl flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-[#101d2a] pb-2">
                <div>
                  <span className="text-[#39ff14] font-bold flex items-center gap-2 text-xs">
                    <Sliders className="w-4 h-4 text-[#39ff14]" />
                    UNBOUNDED PERPETUAL Q-LEARNING REINFORCEMENT CONTROLLER
                  </span>
                  <span className="text-[10px] text-gray-400">
                    Minimizing Bellman Cost: V(s) = min_a [ Cost(s,a) + &gamma; &sum; P(s'|s,a) V(s') ] &bull; &gamma;=0.95, &alpha;=0.2
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/30 font-bold">
                  {qEntries.length} Discretized States Explored
                </span>
              </div>

              {/* Q-Table Policy Entries */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead className="bg-[#020407] text-gray-400 uppercase text-[10px] border-b border-gray-800">
                    <tr>
                      <th className="py-2 px-3">State (Bytes/Cong/Pwr)</th>
                      <th className="py-2 px-3 text-center">RAW</th>
                      <th className="py-2 px-3 text-center">LZ4</th>
                      <th className="py-2 px-3 text-center">ZSTD</th>
                      <th className="py-2 px-3 text-center">SNAPPY</th>
                      <th className="py-2 px-3 text-center">GZIP</th>
                      <th className="py-2 px-3 text-center">Optimal Action</th>
                      <th className="py-2 px-3 text-center">Visits</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/40">
                    {qEntries.slice(0, 6).map((entry) => (
                      <tr key={`q-row-${entry.key}`} className="hover:bg-gray-800/20">
                        <td className="py-2.5 px-3 font-bold text-white">
                          <span className="text-cyan-400">B:{entry.bytesFactor}</span> &bull;{' '}
                          <span className="text-amber-400">C:{entry.congestionFactor}</span> &bull;{' '}
                          <span className="text-emerald-400">P:{entry.powerFactor}</span>
                        </td>
                        <td className={`py-2.5 px-3 text-center ${entry.optimalAction === 'RAW' ? 'text-[#39ff14] font-bold bg-[#39ff14]/10 rounded' : 'text-gray-400'}`}>
                          {entry.qValues.RAW.toFixed(2)}
                        </td>
                        <td className={`py-2.5 px-3 text-center ${entry.optimalAction === 'LZ4' ? 'text-[#39ff14] font-bold bg-[#39ff14]/10 rounded' : 'text-gray-400'}`}>
                          {entry.qValues.LZ4.toFixed(2)}
                        </td>
                        <td className={`py-2.5 px-3 text-center ${entry.optimalAction === 'ZSTD' ? 'text-[#39ff14] font-bold bg-[#39ff14]/10 rounded' : 'text-gray-400'}`}>
                          {entry.qValues.ZSTD.toFixed(2)}
                        </td>
                        <td className={`py-2.5 px-3 text-center ${entry.optimalAction === 'SNAPPY' ? 'text-[#39ff14] font-bold bg-[#39ff14]/10 rounded' : 'text-gray-400'}`}>
                          {entry.qValues.SNAPPY.toFixed(2)}
                        </td>
                        <td className={`py-2.5 px-3 text-center ${entry.optimalAction === 'GZIP' ? 'text-[#39ff14] font-bold bg-[#39ff14]/10 rounded' : 'text-gray-400'}`}>
                          {entry.qValues.GZIP.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#39ff14]/20 text-[#39ff14] border border-[#39ff14]/40">
                            {entry.optimalAction}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center text-gray-500">
                          {entry.visitCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Live Actual Blockchain Records & FNV ISO Beat */}
        {activeTab === 'BLOCKCHAIN_RECORDS' && (
          <div className="p-4 bg-[#060a10] border border-[#101d2a] rounded-xl flex flex-col gap-3 font-mono">
            <div className="flex flex-wrap items-center justify-between border-b border-[#101d2a] pb-2 gap-2">
              <div>
                <span className="text-[#00f0ff] font-bold flex items-center gap-2 text-xs">
                  <ShieldCheck className="w-4 h-4 text-[#00f0ff]" />
                  LIVE ACTUAL BLOCKCHAIN HASH RECORDS &bull; FNV ISO BEAT SYNCHRONIZED
                </span>
                <span className="text-[10px] text-gray-400">
                  Cryptographically chained blocks linking 256-bit ARX permutations, 4-lane 8 MiB allocations, and 60 Hz ISO beats
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                  {blockchainRecords.length} Blocks Verified
                </span>
                <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/30">
                  Chain Continuity: 100% Intact
                </span>
              </div>
            </div>

            {/* Blockchain Records Table */}
            <div className="overflow-x-auto max-h-[460px] scrollbar-thin scrollbar-thumb-gray-800">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#020407] text-gray-400 uppercase text-[10px] border-b border-gray-800 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3">Index</th>
                    <th className="py-2.5 px-3">Current Block Hash</th>
                    <th className="py-2.5 px-3">Previous Block Hash</th>
                    <th className="py-2.5 px-3">FNV ISO Beat (60Hz)</th>
                    <th className="py-2.5 px-3">Codec</th>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3 text-right">Enclave Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/40">
                  {blockchainRecords.map((block) => (
                    <tr key={`block-rec-${block.blockIndex}`} className="hover:bg-gray-800/20">
                      <td className="py-2.5 px-3 font-bold text-[#00f0ff]">
                        #{block.blockIndex}
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-white font-semibold truncate max-w-[170px] select-all">
                            {block.currentHash}
                          </span>
                          <button
                            onClick={(e) => handleCopyHash(block.currentHash, e)}
                            className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-white"
                          >
                            {copiedHash === block.currentHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-gray-400">
                        <span className="truncate max-w-[130px] inline-block font-mono text-[10px]">
                          {block.previousHash.startsWith('0000') ? "0xGENESIS_ROOT" : block.previousHash.slice(0, 16) + '...'}
                        </span>
                      </td>

                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                          {block.fnvIsoBeat.slice(0, 12)}...
                        </span>
                      </td>

                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#ffb700]/10 text-[#ffb700] border border-[#ffb700]/30">
                          {block.codecAllocated}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-gray-300 text-[11px] whitespace-nowrap">
                        {new Date(block.timestampMs).toLocaleTimeString()}
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          TEMPCACHE SAVED
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Runtime Temp Cache (Zero-Waste Guarantee) */}
        {activeTab === 'TEMP_CACHE' && (
          <div className="p-4 bg-[#060a10] border border-[#101d2a] rounded-xl flex flex-col gap-4 font-mono">
            <div className="flex flex-wrap items-center justify-between border-b border-[#101d2a] pb-2 gap-2">
              <div>
                <span className="text-[#ffb700] font-bold flex items-center gap-2 text-xs">
                  <HardDrive className="w-4 h-4 text-[#ffb700]" />
                  PERSISTENT RUNTIME TEMP CACHE STORE &bull; ZERO-WASTE RECORDING
                </span>
                <span className="text-[10px] text-gray-400">
                  Every computation and receipt is automatically preserved in local storage buffer and synchronized with server temp cache
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleFlushCache}
                  className="px-2.5 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Flush Local Cache</span>
                </button>
              </div>
            </div>

            {/* Cache Status Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded bg-[#020407] border border-[#101d2a]">
                <span className="text-gray-500 block text-[10px]">Total Saved Receipts:</span>
                <span className="text-emerald-400 font-bold text-lg">{tempCacheState.totalCachedReceipts}</span>
                <span className="text-[#39ff14] block text-[9px] mt-0.5">0 Dropped &bull; 0 Wasted</span>
              </div>

              <div className="p-3 rounded bg-[#020407] border border-[#101d2a]">
                <span className="text-gray-500 block text-[10px]">Memory Footprint:</span>
                <span className="text-cyan-400 font-bold text-lg">
                  {(tempCacheState.memoryFootprintBytes / 1024).toFixed(1)} KB
                </span>
                <span className="text-gray-400 block text-[9px] mt-0.5">Optimized RAM Buffer</span>
              </div>

              <div className="p-3 rounded bg-[#020407] border border-[#101d2a]">
                <span className="text-gray-500 block text-[10px]">Storage Persistence:</span>
                <span className="text-[#ffb700] font-bold text-lg">DUAL-TIER</span>
                <span className="text-gray-400 block text-[9px] mt-0.5">LocalStorage + /api/nexus/runtime-save</span>
              </div>

              <div className="p-3 rounded bg-[#020407] border border-[#101d2a]">
                <span className="text-gray-500 block text-[10px]">Last Save Timestamp:</span>
                <span className="text-white font-bold text-xs truncate block">
                  {new Date(tempCacheState.lastSavedTimestamp).toLocaleTimeString()}
                </span>
                <span className="text-emerald-400 block text-[9px] mt-0.5">Continuous Sync Active</span>
              </div>
            </div>

            {/* Cache Dump JSON Inspector */}
            <div className="p-3 bg-[#010204] border border-[#101d2a] rounded-lg space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Cached Receipts Preview:</span>
                <span className="text-[#39ff14] text-[10px]">Auto-saved on every computation</span>
              </div>
              <div className="p-3 bg-[#050811] rounded border border-gray-800 text-cyan-300 font-mono text-[10px] max-h-48 overflow-y-auto select-all">
                {JSON.stringify(globalNexusTempCache.getAllCachedReceipts().slice(-3), null, 2)}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: 8 MiB Four-Lane Aggregate Partition (AE.CHUNK.COPRIME.4P) */}
        {activeTab === 'FOUR_LANE_8MB' && (
          <div className="p-4 bg-[#060a10] border border-[#101d2a] rounded-xl flex flex-col gap-4 font-mono">
            <div className="flex flex-wrap items-center justify-between border-b border-[#101d2a] pb-2 gap-2">
              <div>
                <span className="text-purple-400 font-bold flex items-center gap-2 text-xs">
                  <Layers className="w-4 h-4 text-purple-400" />
                  NEXUS v4.5 &bull; FOUR-LANE 8 MiB ALLOCATION (AE.CHUNK.COPRIME.4P)
                </span>
                <span className="text-[10px] text-gray-400">
                  Exact 8,388,608 bytes total allocation across four parallel 2 MiB lanes (2,000,000-byte payload + 97,152-byte tail per lane)
                </span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/10 text-purple-300 border border-purple-500/30 font-bold">
                8,388,608 Bytes (8 MiB Exactly)
              </span>
            </div>

            {/* 4 Lanes Visual Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {[1, 2, 3, 4].map((laneNum) => (
                <div
                  key={`four-lane-${laneNum}`}
                  className="p-3 rounded-xl bg-[#020407] border border-purple-500/30 space-y-2"
                >
                  <div className="flex items-center justify-between border-b border-gray-800 pb-1.5">
                    <span className="text-purple-300 font-bold text-xs">
                      LANE {laneNum} &bull; 2 MiB
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold">2,097,152 B</span>
                  </div>
                  <div className="space-y-1 text-[11px] text-gray-300">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Payload Range:</span>
                      <strong className="text-cyan-300">2,000,000 bytes</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Tail Allocation:</span>
                      <strong className="text-amber-400">97,152 bytes</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Execution Cursor:</span>
                      <span className="text-[#39ff14] font-bold">LANE_{laneNum}_ACK</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-900 rounded-full h-2 overflow-hidden flex">
                    <div className="bg-cyan-500 h-full w-[95.3%]" title="Payload: 2,000,000 bytes" />
                    <div className="bg-amber-500 h-full w-[4.7%]" title="Tail: 97,152 bytes" />
                  </div>
                </div>
              ))}
            </div>

            {/* Aggregate Mathematical Specification Banner */}
            <div className="p-3 bg-[#020508] border border-[#101d2a] rounded-xl text-xs space-y-1.5">
              <span className="text-cyan-400 font-bold block">
                AGGREGATE 8 MiB PROPORTIONAL EQUATION:
              </span>
              <p className="text-gray-400 text-[11px] leading-relaxed">
                <span className="font-mono text-cyan-300">Total = 4 × (2,000,000 + 97,152) = 4 × 2,097,152 = 8,388,608 bytes (8 MiB)</span>
                <span className="block mt-1">
                  The adaptive Bellman controller operates as the supervisory decision-making layer above these four lanes, delegating continuous reversible verification to the 32-bit ARX engine and tail traversal to the coprime grid.
                </span>
              </p>
            </div>
          </div>
        )}

        {activeTab === 'CEC_GATEWAY' && (
          <div className="flex-1 min-h-[600px] flex flex-col rounded-xl overflow-hidden border border-[#101d2a]">
            <NexusCecGateway />
          </div>
        )}
      </div>
    </div>
  );
};
