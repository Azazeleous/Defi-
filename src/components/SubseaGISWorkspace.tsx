import React, { useState, useEffect, useRef, useCallback } from 'react';
import { OpenLayersMap } from './OpenLayersMap';
import { BathymetricCanvas } from './BathymetricCanvas';
import { GISTerminal } from './GISTerminal';
import { SubseaCablePath, CalculusTensorState, TelemetryPacketStream } from '../types/subsea';
import { INITIAL_SUBSEA_CABLES, INITIAL_TELEMETRY_STREAMS, LOST_DEVICE_TARGET } from '../data/subseaData';
import { computeCalculusFrame } from '../workers/calculusWorker';
import { Activity, AlertTriangle, ArrowRightLeft, CheckCircle2, ChevronRight, RefreshCw, ShieldAlert, Sparkles, Zap } from 'lucide-react';

interface Props {
  onSwitchToArbitrage: () => void;
  onUpdateSubseaLatency: (latencyMs: number) => void;
}

export const SubseaGISWorkspace: React.FC<Props> = ({
  onSwitchToArbitrage,
  onUpdateSubseaLatency,
}) => {
  const [cables, setCables] = useState<SubseaCablePath[]>(INITIAL_SUBSEA_CABLES);
  const [telemetryStreams, setTelemetryStreams] = useState<TelemetryPacketStream[]>(INITIAL_TELEMETRY_STREAMS);
  const [selectedCableId, setSelectedCableId] = useState<string | null>('c-marea');

  // Simulation states
  const [isLossEventActive, setIsLossEventActive] = useState<boolean>(false);
  const [isBgpRerouted, setIsBgpRerouted] = useState<boolean>(false);
  const [isCalculationsHalted, setIsCalculationsHalted] = useState<boolean>(false);

  // Calculus tensor state
  const [tensorState, setTensorState] = useState<CalculusTensorState>({
    internalTimer: 1.61803398,
    centralDifferenceError: 7.0e-7,
    curvatureKappa: 0.003412,
    torsionTau: -0.000185,
    frenetTangent: [0.9998, 0.0152, 0.0041],
    frenetNormal: [-0.0152, 0.9997, 0.0211],
    frenetBinormal: [0.0038, -0.0211, 0.9997],
    koopmanSingularValues: [0.8841, 0.0824, 0.0235, 0.01],
    trenchDepthMeters: -5420,
    dynamicFrictionCoeff: 0.042,
  });
  const [bathyPoints, setBathyPoints] = useState<number[]>([]);

  // Logs for terminal
  const [logs, setLogs] = useState<string[]>([
    '[SYSTEM LOG ONLINE] Map tile layers initialized using OpenLayers client framework.',
    '[SYSTEM LOG ONLINE] Subsea fiber pipeline allocations loaded into 1.1 Synapticsonar ledger.',
    '[INITIALIZED] O(h²) finite central difference tensor kernel listening on background thread.',
  ]);

  const workerRef = useRef<Worker | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timerRef = useRef<number>(1.61803398);

  // Initialize Web Worker with fallback
  useEffect(() => {
    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL('../workers/calculusWorker.ts', import.meta.url), {
        type: 'module',
      });

      worker.onmessage = (e) => {
        if (e.data && e.data.type === 'CALC_FRAME') {
          setTensorState(e.data.state);
          setBathyPoints(e.data.bathyPoints);
        }
      };
      workerRef.current = worker;
    } catch {
      // Fallback runs inside animation loop if Web Workers are restricted in iframe
      workerRef.current = null;
    }

    return () => {
      if (worker) worker.terminate();
    };
  }, []);

  // Frame calculation loop
  useEffect(() => {
    const loop = () => {
      if (!isCalculationsHalted) {
        timerRef.current += 0.01618033;
        const currentTimer = timerRef.current;

        if (workerRef.current) {
          workerRef.current.postMessage({
            type: 'TICK',
            timer: currentTimer,
            windFriction: tensorState.dynamicFrictionCoeff,
          });
        } else {
          // Direct fallback
          const computed = computeCalculusFrame(currentTimer, tensorState.dynamicFrictionCoeff);
          setTensorState(computed.state);
          setBathyPoints(computed.bathyPoints);
        }
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isCalculationsHalted, tensorState.dynamicFrictionCoeff]);

  // Sync subsea latency to parent arbitrage engine
  useEffect(() => {
    const activeCable = cables.find((c) => c.id === (selectedCableId || 'c-marea'));
    const latency = activeCable ? activeCable.rttMs : 14.2;
    onUpdateSubseaLatency(isLossEventActive ? latency * 2.8 : latency);
  }, [cables, selectedCableId, isLossEventActive, onUpdateSubseaLatency]);

  // Inject critical loss event simulation
  const handleTriggerLossEvent = useCallback(() => {
    setIsLossEventActive(true);
    setIsBgpRerouted(false);

    // Update cable status
    setCables((prev) =>
      prev.map((c) =>
        c.id === 'c-marea' ? { ...c, status: 'SEVERED', rttMs: 182.4 } : c
      )
    );

    // Update telemetry stream
    setTelemetryStreams((prev) =>
      prev.map((s) =>
        s.pathId === 'c-marea'
          ? { ...s, parityMetric: 'PACKET GAP ENCOUNTERED', parityStatus: 'GAP_ENCOUNTERED' }
          : s
      )
    );

    setLogs((prev) => [
      ...prev,
      `[EXEC MAP] triggerLossEventSimulation()`,
      `[SIGNAL FAILURE] Packet dropped on MAREA route at Sector 4 Mid-Atlantic. Jitter > 180ms!`,
      `[BGP TELEMETRY] Initializing Synapticsonar BGP deflection algorithm...`,
    ]);

    // Automatic deflection rerouting after 3.2s
    setTimeout(() => {
      setIsBgpRerouted(true);
      setCables((prev) =>
        prev.map((c) =>
          c.id === 'c-marea' ? { ...c, status: 'REROUTED', rttMs: 74.8 } : c
        )
      );

      setTelemetryStreams((prev) =>
        prev.map((s) =>
          s.pathId === 'c-marea'
            ? { ...s, parityMetric: 'DEFLECTED (SMW5 BYPASS)', parityStatus: 'REROUTED' }
            : s
        )
      );

      setLogs((prev) => [
        ...prev,
        `[RECOVERED] Alternative BGP route resolved over Marseille SEA-ME-WE 5 channel to bridge packet gap loss.`,
        `[PARITY RESTORED] Parity signature 137451921129154222 verified across bypass nodes.`,
      ]);
    }, 3200);
  }, []);

  // Realign Oceanic BGP Recovery
  const handleRealignBgp = useCallback(() => {
    setIsLossEventActive(false);
    setIsBgpRerouted(false);

    setCables(INITIAL_SUBSEA_CABLES);
    setTelemetryStreams(INITIAL_TELEMETRY_STREAMS);

    setLogs((prev) => [
      ...prev,
      `[BGP RE-ALIGN] Executing global metadata trace... Aligning subsea pipeline buffers.`,
      `[BGP RE-ALIGN] MAREA transatlantic primary pipeline re-engaged. Jitter normalized to 64.2ms.`,
      `[STATUS] All 4 subsea optical pipelines operating at 100% SECURE parity.`,
    ]);
  }, []);

  // Command parser for terminal
  const handleExecuteCommand = (cmd: string) => {
    const parsed = cmd.toLowerCase().trim();
    const logPrefix = `[EXEC MAP] ${cmd}`;

    if (parsed === 'echo') {
      setLogs((prev) => [
        ...prev,
        logPrefix,
        `[ECHO CONFIRMED] Subsea GIS packet trace synchronized across OpenLayers vector source nodes.`,
      ]);
    } else if (parsed === 'stop' || parsed === 'seize') {
      setIsCalculationsHalted(true);
      setLogs((prev) => [
        ...prev,
        logPrefix,
        `[LOCKOUT SHIELD] Map data and processing matrices set to static rest mode.`,
      ]);
    } else if (parsed === 'start' || parsed === 'spin') {
      setIsCalculationsHalted(false);
      setLogs((prev) => [
        ...prev,
        logPrefix,
        `[ACTIVATED] Real-time geographic telemetry streaming pipelines operational.`,
      ]);
    } else if (parsed === 'loss') {
      handleTriggerLossEvent();
    } else if (parsed === 'reroute') {
      handleRealignBgp();
    } else if (parsed === 'status') {
      setLogs((prev) => [
        ...prev,
        logPrefix,
        `[STATUS MATRIX] Active Cables: 4 | Subsea Stations: 7 | Active Packets: 636,650`,
        `[TELEMETRY] MAREA: ${cables[0].status} (${cables[0].rttMs}ms) | SMW5: ${cables[1].status} (${cables[1].rttMs}ms)`,
        `[DEVICE PING] Target ${LOST_DEVICE_TARGET.hashSignature} locked at -5,420m Mid-Atlantic.`,
      ]);
    } else if (parsed === 'bathy') {
      setLogs((prev) => [
        ...prev,
        logPrefix,
        `[BATHYMETRY] Trench Depth: ${tensorState.trenchDepthMeters}m | O(h²) Error: ±${tensorState.centralDifferenceError.toExponential(2)}`,
        `[FRENET-SERRET] Curvature κ=${tensorState.curvatureKappa} | Torsion τ=${tensorState.torsionTau}`,
        `[KOOPMAN SVD] Singular Values: [${tensorState.koopmanSingularValues.join(', ')}]`,
      ]);
    } else if (parsed === 'mooncake' || parsed === '🥮' || parsed === 'seal' || parsed === 'grandpod') {
      setLogs((prev) => [
        ...prev,
        logPrefix,
        `🥮 [THE MOONCAKE SEAL ENGAGED] Æ / MOONCAKE — 888.88 SATS`,
        `🌕 [THE 15TH NIGHT] The Lunar Harmonic awakens across the 29.53059d Synodic cycle.`,
        `🌱 [THE SEED] Inception: 55AA55AAFF00FF00EEDDEECCBBAA99887766554433221100F0E0D0C0B0A09080`,
        `🔄 [THE CYCLE] Split Inversion (1324) Automation/Shadow parity matched at 0.0.0.0`,
        `🏛️ [UNTO THE GRANDPOD] Enclave pod cluster converged. 888.88 SATS anchored to 0x71C...433855274_ENCLAVE_ZK. 🌕`,
      ]);
    } else if (parsed === 'help') {
      setLogs((prev) => [
        ...prev,
        logPrefix,
        `Available commands: status, echo, loss, reroute, bathy, mooncake, grandpod, stop, start, clear`,
      ]);
    } else if (parsed === 'clear') {
      setLogs([]);
    } else {
      setLogs((prev) => [
        ...prev,
        logPrefix,
        `[MUTATE LOG] Action appended into local memory matrices. Data integrity intact.`,
      ]);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#010306] text-[#b8daf7] font-mono select-none">
      {/* Top Telemetry Header Ribbon */}
      <header className="h-[48px] bg-[#060a10] border-b border-[#101d2a] px-4 flex items-center justify-between text-xs tracking-wider z-30 shrink-0">
        <div className="flex items-center gap-2 text-white font-bold">
          <span className="text-[#00f0ff]">🛰️ ADAM://</span>
          <span>OPENLAYERS AUTHORITATIVE SYSTEM CORE</span>
          <span className="text-[10px] bg-[#07121d] border border-[#00f0ff]/30 text-[#00f0ff] px-2 py-0.5 rounded font-normal">
            NODE_09
          </span>
        </div>

        <div className="flex items-center gap-6">
          <div className="font-mono text-[#ffb700] hidden sm:block">
            CLOCK: {tensorState.internalTimer.toFixed(8)} s
          </div>

          <div className="flex items-center gap-1.5 text-[#39ff14]">
            <span className={`w-2 h-2 rounded-full ${!isCalculationsHalted ? 'bg-[#39ff14] animate-pulse' : 'bg-gray-500'}`} />
            <span className="hidden sm:inline">GEOSTREAM LINKED (1.1 ACTIVE)</span>
          </div>

          <button
            onClick={onSwitchToArbitrage}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#07121d] hover:bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/40 text-xs transition-colors"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Switch to Arbitrage Terminal</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Split (3 Viewports) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 bg-[#101d2a] gap-[1px]">
        {/* Viewport 1: OpenLayers Live Geographic Map (6 columns) */}
        <div className="lg:col-span-6 relative bg-black min-h-[360px] lg:min-h-0">
          <OpenLayersMap
            cables={cables}
            isLossEventActive={isLossEventActive}
            isBgpRerouted={isBgpRerouted}
            selectedCableId={selectedCableId}
            onSelectCable={(id) => setSelectedCableId(id)}
          />
        </div>

        {/* Viewport 2: Bathymetric & Environmental Wave Simulator (3 columns) */}
        <div className="lg:col-span-3 relative bg-[#010306] min-h-[300px] lg:min-h-0">
          <BathymetricCanvas
            tensorState={tensorState}
            bathyPoints={bathyPoints}
            isHalted={isCalculationsHalted}
            onFrictionChange={(val) => {
              setTensorState((prev) => ({ ...prev, dynamicFrictionCoeff: val }));
            }}
          />
        </div>

        {/* Viewport 3: Data Telemetry Streaming Feeds (3 columns) */}
        <div className="lg:col-span-3 bg-[#060a10] border-l border-[#101d2a] flex flex-col h-full min-h-0 overflow-hidden">
          <div className="px-3 py-2.5 bg-[#0a111a] border-b border-[#101d2a] text-[11px] font-bold text-[#ffb700] tracking-wider flex items-center justify-between shrink-0">
            <span>📡 LIVE METADATA PACKET INGESTION TRACE</span>
            <span className="text-[10px] text-[#39ff14] font-mono">60 FPS</span>
          </div>

          <div className="flex-1 h-full p-3 overflow-y-auto space-y-3 font-mono text-[11px] leading-relaxed min-h-0">
            {/* Stream Item 1: MAREA */}
            <div className="p-2.5 rounded bg-[#020407] border border-[#101d2a]">
              <div className="flex items-center justify-between text-[#00f0ff] font-bold">
                <span>[PATH_01] MAREA Pipeline</span>
                <span className="text-[10px] text-gray-400">6,605 km</span>
              </div>
              <div className="text-[10px] text-[#b8daf7] mt-1">
                Nodes: Virginia Beach ◄──► Bilbao
              </div>
              <div className="text-[10px] mt-1 flex items-center justify-between">
                <span className="text-gray-400">Parity Metric:</span>
                <span
                  className={`font-bold ${
                    isLossEventActive && !isBgpRerouted
                      ? 'text-[#ff0055] animate-pulse'
                      : isBgpRerouted
                      ? 'text-[#ffb700]'
                      : 'text-[#39ff14]'
                  }`}
                >
                  {isLossEventActive && !isBgpRerouted
                    ? 'PACKET GAP ENCOUNTERED'
                    : isBgpRerouted
                    ? 'DEFLECTED (SMW5 BYPASS)'
                    : '100% SECURE'}
                </span>
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">
                Latency: {cables[0]?.rttMs}ms &bull; Capacity: 200 Tbps
              </div>
            </div>

            {/* Stream Item 2: SEA-ME-WE 5 */}
            <div className="p-2.5 rounded bg-[#020407] border border-[#101d2a]">
              <div className="flex items-center justify-between text-[#ffb700] font-bold">
                <span>[PATH_02] SEA-ME-WE 5 Core</span>
                <span className="text-[10px] text-gray-400">20,000 km</span>
              </div>
              <div className="text-[10px] text-[#b8daf7] mt-1">
                Nodes: Marseille ◄──► Singapore
              </div>
              <div className="text-[10px] mt-1 flex items-center justify-between">
                <span className="text-gray-400">Parity Metric:</span>
                <span className="text-[#39ff14] font-bold">100% SECURE</span>
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">
                Latency: 148.5ms &bull; Capacity: 24 Tbps
              </div>
            </div>

            {/* Stream Item 3: Dunant */}
            <div className="p-2.5 rounded bg-[#020407] border border-[#101d2a]">
              <div className="flex items-center justify-between text-[#a855f7] font-bold">
                <span>[PATH_03] Dunant Optical</span>
                <span className="text-[10px] text-gray-400">6,400 km</span>
              </div>
              <div className="text-[10px] text-[#b8daf7] mt-1">
                Nodes: Virginia Beach ◄──► St-Hilaire
              </div>
              <div className="text-[10px] mt-1 flex items-center justify-between">
                <span className="text-gray-400">Parity Metric:</span>
                <span className="text-[#39ff14] font-bold">100% SECURE</span>
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">
                Latency: 62.8ms &bull; Space Division Multiplexing
              </div>
            </div>

            {/* Stream Item 4: Lost Device Pings */}
            <div className="p-2.5 rounded bg-[#020407] border border-[#ff0055]/30">
              <div className="flex items-center justify-between text-[#ff0055] font-bold">
                <span>[LOST_DEV] Device Identifier Pings</span>
                <span className="text-[10px] text-[#39ff14]">ACTIVE</span>
              </div>
              <div className="text-[10px] text-gray-300 mt-1">
                Target: Hash Signature <span className="text-[#ffb700] font-bold">137451921129154222</span>
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">
                Position: Lat 39.5, Lon -45.0 &bull; Mid-Atlantic Trench
              </div>
              <div className="text-[10px] text-[#00f0ff] mt-0.5">
                Depth: -5,420m &bull; Frequency: 42.8 Hz Sonar
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Section: Verification Profile & Terminal Panel */}
      <footer className="bg-[#060a10] border-t border-[#101d2a] p-3 grid grid-cols-1 lg:grid-cols-12 gap-3 z-30 shrink-0">
        {/* Left: Authentic Controller Verification Profile Card (5 cols) */}
        <div className="lg:col-span-5 bg-[#020407] border border-[#101d2a] p-3 rounded text-[11px] flex flex-col justify-between">
          <div>
            <div className="text-[#ffb700] font-bold tracking-wider mb-1 flex items-center justify-between">
              <span>AUTHENTIC CONTROLLER VERIFICATION PROFILE</span>
              <span className="text-[#39ff14] text-[10px]">VERIFIED 1.1</span>
            </div>
            <div className="text-[#b8daf7] leading-relaxed">
              <div>SIGNATURE ID : Architect Azazel of Gaia / Architect_01</div>
              <div className="truncate text-gray-400">
                SECURITY HASH: <span className="text-[#ffb700]">137451921129154222</span> | ROUTE POINTERS: 433855274 / 040592
              </div>
              <div className="text-gray-500 text-[10px] mt-0.5">
                Subsea Core Anchor: Virginia Beach CLS Gateway &bull; Bathymetric Matrix Calibrated
              </div>
            </div>
          </div>

          {/* Interactive Simulation Action Buttons */}
          <div className="pt-2 mt-2 border-t border-[#101d2a] flex flex-wrap gap-2">
            <button
              onClick={handleTriggerLossEvent}
              className="px-3 py-1.5 rounded bg-[#07121d] border border-[#ff0055] text-[#ff0055] hover:bg-[#ff0055] hover:text-black font-bold text-xs transition-all shadow-[0_0_8px_rgba(255,0,85,0.25)] flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>🚨 INJECT LOSS EVENT</span>
            </button>

            <button
              onClick={handleRealignBgp}
              className="px-3 py-1.5 rounded bg-[#07121d] border border-[#ffb700] text-[#ffb700] hover:bg-[#ffb700] hover:text-black font-bold text-xs transition-all shadow-[0_0_8px_rgba(255,183,0,0.25)] flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>🔄 RE-ALIGN BGP RECOVERY</span>
            </button>
          </div>
        </div>

        {/* Right: Interactive Terminal Panel (7 cols) */}
        <div className="lg:col-span-7">
          <GISTerminal
            onExecuteCommand={handleExecuteCommand}
            logs={logs}
            onClearLogs={() => setLogs([])}
          />
        </div>
      </footer>
    </div>
  );
};
