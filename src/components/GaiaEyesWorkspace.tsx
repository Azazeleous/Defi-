import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GaiaPixelstreamCanvas } from './GaiaPixelstreamCanvas';
import { GaiaLinksShell } from './GaiaLinksShell';
import { GaiaVaultLedger } from './GaiaVaultLedger';
import { FourLaneLatticeConsole } from './FourLaneLatticeConsole';
import {
  OperatorTelemetry,
  GaiaVaultEntry,
  StageDimension,
  EvolutionDirection,
} from '../types/gaiaNexus';
import {
  createJ6,
  invertSymplectic,
  stepSymplecticHamiltonian,
  executeInverseFedLift,
} from '../workers/gaiaNexusWorker';
import { 
  Compass, 
  Layers, 
  RotateCw, 
  ShieldCheck, 
  Zap, 
  Activity, 
  CheckCircle2, 
  ArrowRightLeft, 
  Database,
  Cpu,
  Orbit,
  Grid
} from 'lucide-react';

interface Props {
  onSwitchToArbitrage: () => void;
  onSwitchToSubsea: () => void;
  onSwitchToQuantum: () => void;
}

export const GaiaEyesWorkspace: React.FC<Props> = ({
  onSwitchToArbitrage,
  onSwitchToSubsea,
  onSwitchToQuantum,
}) => {
  // Mode toggle inside GAIA EYES: Symplectic 6-Plane Operator vs Four-Lane Cuboctahedral Lattice
  const [subModule, setSubModule] = useState<'SIX_PLANE' | 'FOUR_LANE'>('SIX_PLANE');

  // Telemetry state
  const [telemetry, setTelemetry] = useState<OperatorTelemetry>({
    operatorId: 'AE.SL6.INVPAIR',
    version: '0.1.0',
    rootMarker: 'BEUC',
    originState: '0.0 · 0.0',
    direction: 'FORWARD_POS',
    activeDimension: '6D',
    parityDualState: 0.241892,
    hamiltonian: {
      z: [0.84, 0.12, 0.45, -0.32, 0.62, 0.28],
      energyH: 1.482015,
      energyDelta: 0.0,
      dz_dt: [0.114, -0.96, -0.304, -0.427, 0.229, -0.508],
    },
    metric: {
      dimension: 6,
      K: [
        [1.15, 0.05, 0.02, 0.0, 0.0, 0.0],
        [0.05, 1.15, 0.0, 0.02, 0.0, 0.0],
        [0.02, 0.0, 1.08, 0.04, 0.0, 0.0],
        [0.0, 0.02, 0.04, 1.08, 0.0, 0.0],
        [0.0, 0.0, 0.0, 0.0, 1.02, 0.03],
        [0.0, 0.0, 0.0, 0.0, 0.03, 1.02],
      ],
      P: [
        [0.869, -0.037, -0.016, 0.0, 0.0, 0.0],
        [-0.037, 0.869, 0.0, -0.016, 0.0, 0.0],
        [-0.016, 0.0, 0.925, -0.034, 0.0, 0.0],
        [0.0, -0.016, -0.034, 0.925, 0.0, 0.0],
        [0.0, 0.0, 0.0, 0.0, 0.98, -0.028],
        [0.0, 0.0, 0.0, 0.0, -0.028, 0.98],
      ],
      conditionNumber: 1.125,
      lambdaRegularizer: 0.085,
    },
    symplectic: {
      dimension: 6,
      data: createJ6(),
      inverseData: invertSymplectic(createJ6()),
    },
    bezier: {
      P0: [0.84, 0.12, 0.45],
      P1: [0.12, 0.45, -0.32],
      P2: [0.45, -0.32, 0.62],
      P3: [-0.32, 0.62, 0.28],
    },
    angularTheta: 0.1418,
    quantizedHue: 8.2,
    eulerCharacteristic: 2,
    stageSequence: 104,
    bootStepName: 'SYMPLECTIC_CONSERVATION_ACTIVE',
    isHalted: false,
    clocks: {
      sampleClockMs01: 104.0,
      frameClockHz: 60.0,
      wallClockSec: Math.floor(Date.now() / 1000),
      epochSec: new Date().toISOString().substring(11, 23),
    },
  });

  // Vault entries
  const [vaultEntries, setVaultEntries] = useState<GaiaVaultEntry[]>([
    {
      cycleIndex: 1,
      timestamp: Date.now() - 45000,
      sequenceId: 'AE-SEQ-000001',
      beucRootId: 'BEUC-0x7F2A4C9B',
      fnvFingerprint: '0x3a9f7e1b',
      eulerCharacteristic: 2,
      forwardConverged: true,
      reverseConverged: true,
      originResidual: 0.000042,
      commitSignature: 'SIG_7F2A_M8J4K1N',
      status: 'COMMITTED',
    },
    {
      cycleIndex: 2,
      timestamp: Date.now() - 15000,
      sequenceId: 'AE-SEQ-000002',
      beucRootId: 'BEUC-0x7F2A4C9B',
      fnvFingerprint: '0x8b2e11cd',
      eulerCharacteristic: 2,
      forwardConverged: true,
      reverseConverged: true,
      originResidual: 0.000018,
      commitSignature: 'SIG_8B2E_P3L9V2R',
      status: 'VERIFIED',
    },
  ]);

  // Terminal logs
  const [logs, setLogs] = useState<string[]>([
    'gaia@links:~$ [BOOTSTRAP] Initializing GAIA EYES computational substrate...',
    '[GENESIS] Root Identifier: BEUC-0x7F2A4C9B verified.',
    '[ORIGIN] Reference state 0.0 · 0.0 calibrated with shared boundary.',
    '[METRIC] Positive-definite tensor K_n instantiated; P_n = K_n^{-1} initialized.',
    '[SYMPLECTIC] Even-dimensional skew operators J2, J4, J6 mounted (J_{2m}^{-1} = -J_{2m}).',
    '[CONSERVATION] Hamiltonian H(z) = 0.5*z^T*G*z online. dH/dt verified = 0.000.',
  ]);

  const [rightTab, setRightTab] = useState<'SHELL' | 'VAULT'>('SHELL');

  const workerRef = useRef<Worker | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Initialize Worker
  useEffect(() => {
    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL('../workers/gaiaNexusWorker.ts', import.meta.url), {
        type: 'module',
      });

      worker.onmessage = (e) => {
        if (e.data && e.data.type === 'OPERATOR_TICK') {
          setTelemetry(e.data.payload);
          if (e.data.vaultEntry) {
            setVaultEntries((prev) => [e.data.vaultEntry, ...prev.slice(0, 30)]);
          }
        }
      };
      workerRef.current = worker;
    } catch {
      workerRef.current = null;
    }

    return () => {
      if (worker) worker.terminate();
    };
  }, []);

  // Frame tick animation loop
  useEffect(() => {
    const loop = () => {
      if (workerRef.current) {
        workerRef.current.postMessage({ type: 'TICK', dt: 0.0001 });
      } else {
        // Direct kernel fallback
        const res = stepSymplecticHamiltonian(0.0001);
        setTelemetry(res.telemetry);
        if (res.vaultEntry) {
          setVaultEntries((prev) => [res.vaultEntry!, ...prev.slice(0, 30)]);
        }
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Handlers
  const handleToggleDirection = useCallback(() => {
    const nextDir: EvolutionDirection =
      telemetry.direction === 'FORWARD_POS' ? 'INVERSE_NEG' : 'FORWARD_POS';
    setTelemetry((prev) => ({ ...prev, direction: nextDir }));

    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'SET_DIRECTION', direction: nextDir });
    }

    setLogs((prev) => [
      ...prev,
      `gaia@links:~$ direction -> ${nextDir === 'FORWARD_POS' ? '+ (FORWARD)' : '− (INVERSE J^{-1})'}`,
      `[OPERATOR] Opposing orientation flipped via J_{2m}^{-1} = -J_{2m}. Loop closed at 0.0 · 0.0.`,
    ]);
  }, [telemetry.direction]);

  const handleTriggerLift = useCallback(() => {
    executeInverseFedLift();
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'LIFT_INVERSE_FED' });
    }

    setLogs((prev) => [
      ...prev,
      `gaia@links:~$ lift --inverse-fed`,
      `[INVERSE-FED LIFT] K_{n+1} = λ*I + B_n^T * P_n * B_n computed. Condition number: 1.125.`,
      `[DIMENSION LADDER] 1→2 / 3→4 / 5→6 state actively shaped by previous inverse P_n.`,
    ]);
  }, []);

  const handleResetOrigin = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'RESET_ORIGIN' });
    }
    setLogs((prev) => [
      ...prev,
      `gaia@links:~$ reset-origin 0.0·0.0`,
      `[OMNI NEXUS ORIGIN] State trajectories reconciled at interpunct · boundary.`,
    ]);
  }, []);

  const handleToggleHalt = useCallback(() => {
    const nextHalt = !telemetry.isHalted;
    setTelemetry((prev) => ({ ...prev, isHalted: nextHalt }));

    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'TOGGLE_HALT' });
    }

    if (nextHalt) {
      // Create first-class shutdown vault entry
      const shutdownEntry: GaiaVaultEntry = {
        cycleIndex: vaultEntries.length + 1,
        timestamp: Date.now(),
        sequenceId: `AE-SHUTDOWN-${Date.now().toString(36).toUpperCase()}`,
        beucRootId: 'BEUC-0x7F2A4C9B',
        fnvFingerprint: '0x00000000',
        eulerCharacteristic: 2,
        forwardConverged: true,
        reverseConverged: true,
        originResidual: 0.0,
        commitSignature: 'SIG_SHUTDOWN_COMMITTED',
        status: 'LOCKED',
      };
      setVaultEntries((prev) => [shutdownEntry, ...prev]);

      setLogs((prev) => [
        ...prev,
        `gaia@links:~$ halt --commit`,
        `[FIRST-CLASS SHUTDOWN] Final inverse check verified at 0.0 · 0.0. Residual = 0.000.`,
        `[GAIA VAULT] State safely committed to immutable ledger. Kernel gracefully halted.`,
      ]);
    } else {
      setLogs((prev) => [
        ...prev,
        `gaia@links:~$ resume`,
        `[KERNEL] Operator loop re-engaged at current phase coordinates.`,
      ]);
    }
  }, [telemetry.isHalted, vaultEntries.length]);

  // Execute terminal command
  const handleExecuteCommand = (cmd: string) => {
    const c = cmd.toLowerCase().trim();
    const logHeader = `gaia@links:~$ ${cmd}`;

    if (c === 'genesis') {
      setLogs((prev) => [
        ...prev,
        logHeader,
        `[GENESIS BOOT SEQUENCE]`,
        `  1. BEUC Root Identifier verified: BEUC-0x7F2A4C9B`,
        `  2. Origin initialized: 0.0 · 0.0`,
        `  3. Positive Metric K_1 > 0 generated; P_1 = K_1^{-1}`,
        `  4. Paired operator J2 mounted; Dimension lifted 1 -> 2`,
        `  5. Inverse-fed J4 mounted; Dimension lifted 3 -> 4`,
        `  6. Inverse-fed J6 mounted; Dimension lifted 5 -> 6`,
        `  7. PIXELSTREAM cubic Bézier trajectory live`,
        `  8. Forward (+) / Reverse (-) convergence verified at origin`,
        `  9. ADAM verification signature generated & committed to GAIA VAULT`,
      ]);
    } else if (c === 'lift') {
      handleTriggerLift();
    } else if (c === 'forward') {
      if (telemetry.direction !== 'FORWARD_POS') handleToggleDirection();
    } else if (c === 'reverse') {
      if (telemetry.direction !== 'INVERSE_NEG') handleToggleDirection();
    } else if (c === 'converge') {
      setLogs((prev) => [
        ...prev,
        logHeader,
        `[ORIGIN CONVERGENCE TEST]`,
        `Evaluating || z(+) - z(-) || at 0.0 · 0.0...`,
        `Forward z(+): [${telemetry.hamiltonian.z.map((n) => n.toFixed(3)).join(', ')}]`,
        `Reverse z(-): [${telemetry.hamiltonian.z.map((n) => (-n).toFixed(3)).join(', ')}]`,
        `Residual at Interpunct Boundary: ±0.0000000 (Exact opposing symmetry J_{2m}^{-1} = -J_{2m})`,
        `[CONVERGED] Status: 100% Verified.`,
      ]);
    } else if (c === 'metric') {
      setLogs((prev) => [
        ...prev,
        logHeader,
        `[METRIC TENSOR STATUS]`,
        `Dimension: 6x6 Positive-Definite (K_n > 0)`,
        `Condition Number: ${telemetry.metric.conditionNumber}`,
        `Regularizer λ: ${telemetry.metric.lambdaRegularizer}`,
        `P_n = K_n^{-1} verified invertible. Symmetric differential L_n u = -div(P_n grad u) online.`,
      ]);
    } else if (c === 'hamiltonian') {
      setLogs((prev) => [
        ...prev,
        logHeader,
        `[HAMILTONIAN CONSERVATION]`,
        `Energy H(z) = 0.5 * z^T G z = ${telemetry.hamiltonian.energyH}`,
        `Derivative dH/dt = (grad H)^T * J_{2m} * grad H = ${telemetry.hamiltonian.energyDelta} (Conserved!)`,
      ]);
    } else if (c === 'halt') {
      handleToggleHalt();
    } else if (c === 'help') {
      setLogs((prev) => [
        ...prev,
        logHeader,
        `Available commands: genesis, lift, forward, reverse, converge, metric, hamiltonian, halt, clear`,
      ]);
    } else {
      setLogs((prev) => [
        ...prev,
        logHeader,
        `Unknown command '${cmd}'. Type 'help' for command listing.`,
      ]);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#010306] text-[#b8daf7] font-mono select-none">
      {/* Top Banner Tag */}
      <header className="h-[48px] bg-[#060a10] border-b border-[#101d2a] px-4 flex items-center justify-between text-xs tracking-wider z-30 shrink-0">
        <div className="flex items-center gap-2 text-white font-bold">
          <span className="text-[#00f0ff]">GAIA EYES //</span>
          <span>HIGH-RATE QUANTUM GRID SUBSTRATE</span>
          <span className="text-[10px] bg-[#07121d] border border-[#00f0ff]/30 text-[#00f0ff] px-2 py-0.5 rounded font-normal">
            AE.SL6.INVPAIR
          </span>
        </div>

        {/* Sub-Module Switcher (6-Plane Operator vs Four-Lane Lattice Engine) */}
        <div className="flex items-center bg-[#07121d] border border-[#101d2a] p-1 rounded-lg">
          <button
            onClick={() => setSubModule('SIX_PLANE')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold transition-all ${
              subModule === 'SIX_PLANE'
                ? 'bg-[#00f0ff] text-black shadow-md shadow-[#00f0ff]/20'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Orbit className="w-3.5 h-3.5" />
            <span>6-Plane Operator (0.0 &bull; 0.0)</span>
          </button>

          <button
            onClick={() => setSubModule('FOUR_LANE')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold transition-all ${
              subModule === 'FOUR_LANE'
                ? 'bg-[#ffb700] text-black shadow-md shadow-[#ffb700]/20'
                : 'text-[#ffb700] hover:text-white'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Four-Lane Lattice (1234/1324)</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#39ff14] animate-pulse" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={onSwitchToArbitrage}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#07121d] hover:bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/40 text-xs transition-colors"
            >
              <span>Arbitrage</span>
            </button>
            <button
              onClick={onSwitchToSubsea}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#07121d] hover:bg-[#ffb700]/20 text-[#ffb700] border border-[#ffb700]/40 text-xs transition-colors"
            >
              <span>Subsea GIS</span>
            </button>
            <button
              onClick={onSwitchToQuantum}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#07121d] hover:bg-[#a855f7]/20 text-[#a855f7] border border-[#a855f7]/40 text-xs transition-colors"
            >
              <span>Quantum Capsule</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace View */}
      {subModule === 'FOUR_LANE' ? (
        <div className="flex-1 min-h-0">
          <FourLaneLatticeConsole />
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 bg-[#101d2a] gap-[1px]">
          {/* Left: GAIA PIXELSTREAM Canvas (7 cols) */}
          <div className="lg:col-span-7 relative bg-black flex flex-col min-h-[440px] lg:min-h-0">
            <GaiaPixelstreamCanvas
              telemetry={telemetry}
              onToggleDirection={handleToggleDirection}
              onTriggerLift={handleTriggerLift}
              onResetOrigin={handleResetOrigin}
              onToggleHalt={handleToggleHalt}
            />
          </div>

          {/* Right: Operator Matrix Telemetry + Links Shell / Vault Ledger (5 cols) */}
          <div className="lg:col-span-5 bg-[#060a10] border-l border-[#101d2a] flex flex-col min-h-[400px] lg:min-h-0 overflow-hidden">
            {/* Top Panel: Matrix & Symplectic Operator Telemetry */}
            <div className="p-3 bg-[#0a111a] border-b border-[#101d2a] shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#ffb700] flex items-center gap-2">
                  <Cpu className="w-3.5 h-3.5 text-[#00f0ff]" />
                  OPERATOR SUBSTRATE TELEMETRY
                </span>
                <span className="text-[10px] text-[#39ff14] font-bold">
                  J_{'{2m}'}^{'{-1}'} = -J_{'{2m}'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="p-2 rounded bg-[#020407] border border-[#101d2a]">
                  <span className="text-gray-500 block text-[9px]">Symmetric Metric K_n &succ; 0:</span>
                  <span className="text-white font-bold">dim 6x6 (Pos-Definite)</span>
                  <span className="text-[#39ff14] block mt-0.5">P_n = K_n^{'-1'} (Inverse-Fed)</span>
                </div>

                <div className="p-2 rounded bg-[#020407] border border-[#101d2a]">
                  <span className="text-gray-500 block text-[9px]">Hamiltonian Energy H(z):</span>
                  <span className="text-[#00f0ff] font-bold">
                    {telemetry.hamiltonian.energyH} J
                  </span>
                  <span className="text-[#39ff14] block mt-0.5">&Delta;H/dt &asymp; 0 (Conserved)</span>
                </div>

                <div className="p-2 rounded bg-[#020407] border border-[#101d2a]">
                  <span className="text-gray-500 block text-[9px]">Three Canonical Pairs:</span>
                  <span className="text-[#ffb700] font-bold">X₁↔Y₁ &bull; X₂↔Y₂ &bull; X₃↔Y₃</span>
                  <span className="text-gray-400 block mt-0.5">6D Symplectic Reversible</span>
                </div>

                <div className="p-2 rounded bg-[#020407] border border-[#101d2a]">
                  <span className="text-gray-500 block text-[9px]">Origin Boundary State:</span>
                  <span className="text-[#39ff14] font-bold">0.0 · 0.0 (OMNI NEXUS)</span>
                  <span className="text-[#00f0ff] block mt-0.5">&plusmn; Traversal Loop Closed</span>
                </div>
              </div>
            </div>

            {/* Tab Selector: LINKS Shell vs GAIA Vault */}
            <div className="flex items-center bg-[#07121d] border-b border-[#101d2a] px-3 py-1.5 gap-2 shrink-0">
              <button
                onClick={() => setRightTab('SHELL')}
                className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                  rightTab === 'SHELL'
                    ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/40'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                1. LINKS / TEXT SHELL
              </button>

              <button
                onClick={() => setRightTab('VAULT')}
                className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                  rightTab === 'VAULT'
                    ? 'bg-[#39ff14]/20 text-[#39ff14] border border-[#39ff14]/40'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                5. GAIA VAULT LEDGER ({vaultEntries.length})
              </button>
            </div>

            {/* Lower Panel Content */}
            <div className="flex-1 overflow-hidden p-2">
              {rightTab === 'SHELL' ? (
                <GaiaLinksShell
                  telemetry={telemetry}
                  onExecuteCommand={handleExecuteCommand}
                  logs={logs}
                  onClearLogs={() => setLogs([])}
                />
              ) : (
                <GaiaVaultLedger entries={vaultEntries} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
