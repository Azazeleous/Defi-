import React, { useState, useEffect, useRef } from 'react';
import { 
  globalTraceEngine, 
  FourLaneCycleResult 
} from '../engine/cuboctahedralTraceEngine';
import { D3FourLaneTransitionGraph } from './D3FourLaneTransitionGraph';
import { 
  X, 
  Play, 
  Pause, 
  RotateCw, 
  Layers, 
  Cpu, 
  Zap, 
  Activity, 
  Maximize2, 
  Minimize2, 
  ShieldCheck, 
  Radio, 
  Compass, 
  Terminal,
  Grid,
  Binary,
  ArrowRightLeft,
  Flame,
  BatteryCharging,
  TrendingUp
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onViewAuditLog?: () => void;
}

export const CalculusCoprimeGridModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onViewAuditLog,
}) => {
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'4D_CANVAS' | 'D3_TRANSITION' | 'COPRIME_MATRIX' | 'SPARSEBUNDLE'>('4D_CANVAS');
  const [stepIndex, setStepIndex] = useState<number>(180);
  const [rotAngle, setRotAngle] = useState<number>(0);
  const [inversionSpike, setInversionSpike] = useState<boolean>(false);
  const [rotSpeed, setRotSpeed] = useState<number>(0.02);

  // Live cycle results from shared globalTraceEngine
  const [cycleData, setCycleData] = useState<FourLaneCycleResult>(() =>
    globalTraceEngine.executeFourLaneSplitCycle(
      180,
      1.42,
      0xbf58476dn,
      false,
      0.0,
      0.1,
      19374.18,
      0.077
    )
  );

  const stepIndexRef = useRef<number>(180);
  const rotAngleRef = useRef<number>(0);
  const cycleDataRef = useRef<FourLaneCycleResult>(cycleData);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);

  // 4D trajectory history buffer
  const trajectory4DRef = useRef<{ x: number; y: number; z: number; w: number; step: number }[]>([]);

  // Keyboard escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Main computation animation loop
  useEffect(() => {
    if (!isOpen) return;

    let lastUiUpdateTime = performance.now();

    const loop = (time: number) => {
      if (isRunning) {
        stepIndexRef.current += 1;
        const next = stepIndexRef.current;
        rotAngleRef.current += rotSpeed;

        const res = globalTraceEngine.executeFourLaneSplitCycle(
          next,
          1.42,
          0xbf58476dn,
          inversionSpike,
          0.0,
          0.1,
          19374.18,
          0.077,
          false
        );
        cycleDataRef.current = res;

        // Append 4D trajectory
        trajectory4DRef.current.push({
          x: res.projection4D.x,
          y: res.projection4D.y,
          z: res.projection4D.z,
          w: res.projection4D.w,
          step: next,
        });
        if (trajectory4DRef.current.length > 100) {
          trajectory4DRef.current.shift();
        }

        // Throttle React state updates to avoid continuous re-rendering during 60fps animation
        if (time - lastUiUpdateTime > 60) {
          lastUiUpdateTime = time;
          setStepIndex(next);
          setCycleData(res);
          setRotAngle(rotAngleRef.current);
        }
      }

      // Draw 4D Canvas
      const canvas = canvasRef.current;
      if (canvas && activeTab === '4D_CANVAS') {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          draw4DHyperSpatialCanvas(
            ctx,
            canvas.width,
            canvas.height,
            rotAngleRef.current,
            cycleDataRef.current,
            trajectory4DRef.current
          );
        }
      }

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isOpen, isRunning, inversionSpike, rotSpeed, activeTab]);

  // 4D Hyper-Spatial Projection Canvas (Tesseract + Porous Cuboctahedron)
  const draw4DHyperSpatialCanvas = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    rot: number,
    data: FourLaneCycleResult,
    traj: { x: number; y: number; z: number; w: number; step: number }[]
  ) => {
    ctx.fillStyle = '#010306';
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const scale = Math.min(w, h) * 0.26;

    // Draw background 4D coordinate grid
    ctx.strokeStyle = '#0d1825';
    ctx.lineWidth = 1;
    for (let i = -4; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * 45, 0);
      ctx.lineTo(cx + i * 45, h);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, cy + i * 45);
      ctx.lineTo(w, cy + i * 45);
      ctx.stroke();
    }

    // 4D Rotation angles: rotXY, rotXW, rotZW
    const theta = rot;
    const phi = rot * 0.7;
    const psi = rot * 0.5;

    // 16 Vertices of a 4D Hypercube (Tesseract)
    const tesseractVertices: [number, number, number, number][] = [];
    for (let x = -1; x <= 1; x += 2) {
      for (let y = -1; y <= 1; y += 2) {
        for (let z = -1; z <= 1; z += 2) {
          for (let w4 = -1; w4 <= 1; w4 += 2) {
            tesseractVertices.push([x, y, z, w4]);
          }
        }
      }
    }

    // Project 4D -> 3D -> 2D
    const projectedTesseract = tesseractVertices.map(([x0, y0, z0, w0]) => {
      // Rotate in XW plane
      const cosP = Math.cos(phi);
      const sinP = Math.sin(phi);
      const x1 = x0 * cosP - w0 * sinP;
      const w1 = x0 * sinP + w0 * cosP;

      // Rotate in YZ plane
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const y1 = y0 * cosT - z0 * sinT;
      const z1 = y0 * sinT + z0 * cosT;

      // Rotate in ZW plane
      const cosPsi = Math.cos(psi);
      const sinPsi = Math.sin(psi);
      const z2 = z1 * cosPsi - w1 * sinPsi;
      const w2 = z1 * sinPsi + w1 * cosPsi;

      // Stereographic 4D perspective divisor
      const dist4D = 2.8;
      const fov4 = 1.0 / (dist4D - w2 * 0.45);
      const px3 = x1 * fov4;
      const py3 = y1 * fov4;
      const pz3 = z2 * fov4;

      // Standard 3D to 2D
      const dist3D = 3.5;
      const fov3 = 1.0 / (dist3D - pz3 * 0.35);
      const sx = cx + px3 * scale * fov3;
      const sy = cy + py3 * scale * fov3;

      return { sx, sy, w2, z2 };
    });

    // Draw Tesseract edges (connecting vertices differing by exactly 1 coordinate)
    ctx.lineWidth = 1;
    for (let i = 0; i < tesseractVertices.length; i++) {
      for (let j = i + 1; j < tesseractVertices.length; j++) {
        let diff = 0;
        for (let k = 0; k < 4; k++) {
          if (tesseractVertices[i][k] !== tesseractVertices[j][k]) diff++;
        }
        if (diff === 1) {
          const p1 = projectedTesseract[i];
          const p2 = projectedTesseract[j];
          const depth = (p1.w2 + p2.w2) * 0.5;
          ctx.strokeStyle = data.centerCoaxialLocked
            ? '#ffb70044'
            : depth > 0
            ? '#00f0ff33'
            : '#8b5cf622';
          ctx.beginPath();
          ctx.moveTo(p1.sx, p1.sy);
          ctx.lineTo(p2.sx, p2.sy);
          ctx.stroke();
        }
      }
    }

    // Draw Tesseract Vertices
    projectedTesseract.forEach((p) => {
      ctx.fillStyle = data.sudostepActive ? '#ff0055' : p.w2 > 0 ? '#00f0ff' : '#a855f7';
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw 4D Live Trajectory Trail
    if (traj.length > 2) {
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      traj.forEach((pt, idx) => {
        const factor = idx / (traj.length - 1);
        const px = cx + pt.x * scale * 0.7;
        const py = cy + pt.y * scale * 0.7;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.strokeStyle = '#39ff14';
      ctx.stroke();

      // Current Trajectory Head
      const head = traj[traj.length - 1];
      const hx = cx + head.x * scale * 0.7;
      const hy = cy + head.y * scale * 0.7;

      ctx.fillStyle = '#39ff14';
      ctx.shadowColor = '#39ff14';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(hx, hy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Opposing Shadow Head (Amber/Red Inverted Vector)
      const sx = cx - head.x * scale * 0.7;
      const sy = cy - head.y * scale * 0.7;
      ctx.fillStyle = data.sudostepActive ? '#ff0055' : '#ffb700';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Central tether connection
      ctx.strokeStyle = '#00f0ff55';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(sx, sy);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Central Coaxial Line Lock Status Indicator
    if (data.centerCoaxialLocked) {
      ctx.strokeStyle = '#ffb700';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(cx, cy, 38, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#ffb700';
      ctx.font = '10px monospace';
      ctx.fillText('COAXIAL KERNEL LOCKED @ 0.5', cx - 72, cy - 46);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md font-mono select-none">
      <div className="w-full max-w-6xl max-h-[92vh] bg-[#020408] border border-[#00f0ff]/40 rounded-2xl shadow-2xl shadow-[#00f0ff]/10 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Top Modal Header */}
        <div className="p-4 bg-[#060a10] border-b border-[#101d2a] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#00f0ff]/20 to-purple-600/20 border border-[#00f0ff]/50 text-[#00f0ff]">
              <Grid className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  CALCULUS COPRIME GRID // 4TH DIMENSION LIVE GRAPHING
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/30">
                  AE.SL6.DUALTRACE.4P
                </span>
                <span className="hidden sm:inline-flex text-[10px] px-2 py-0.5 rounded font-bold bg-[#39ff14]/10 text-[#39ff14] border border-[#39ff14]/30">
                  0.1ms TRAJECTORY
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Two operands side-by-side &bull; 1234/1324 split lanes &bull; Central coaxial locking kernel at .5 crossing
              </p>
            </div>
          </div>

          {/* Sub-tab Navigation & Close Button */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-[#07121d] border border-[#101d2a] p-1 rounded-lg text-xs overflow-x-auto">
              <button
                onClick={() => setActiveTab('4D_CANVAS')}
                className={`px-3 py-1 rounded font-bold transition-all whitespace-nowrap ${
                  activeTab === '4D_CANVAS'
                    ? 'bg-[#00f0ff] text-black shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                4D Live Canvas
              </button>
              <button
                onClick={() => setActiveTab('D3_TRANSITION')}
                className={`px-3 py-1 rounded font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'D3_TRANSITION'
                    ? 'bg-[#39ff14] text-black shadow-sm'
                    : 'text-[#39ff14]/80 hover:text-[#39ff14]'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>D3 Four-Lane Graph</span>
              </button>
              <button
                onClick={() => setActiveTab('COPRIME_MATRIX')}
                className={`px-3 py-1 rounded font-bold transition-all whitespace-nowrap ${
                  activeTab === 'COPRIME_MATRIX'
                    ? 'bg-[#ffb700] text-black shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Coprime Tensor
              </button>
              <button
                onClick={() => setActiveTab('SPARSEBUNDLE')}
                className={`px-3 py-1 rounded font-bold transition-all whitespace-nowrap ${
                  activeTab === 'SPARSEBUNDLE'
                    ? 'bg-purple-500 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Sparsebundle 8MB
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-[#07121d] border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white transition-colors"
              title="Close 4D Coprime View (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body Container */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[#101d2a] p-4 flex flex-col gap-4">
          {activeTab === '4D_CANVAS' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Column (8 cols): 4D Canvas */}
              <div className="lg:col-span-8 bg-[#010204] border border-[#101d2a] rounded-xl overflow-hidden relative flex flex-col min-h-[380px] lg:min-h-[460px]">
                <canvas ref={canvasRef} width={680} height={460} className="w-full h-full block" />

                {/* 4D Coordinates Readout HUD Overlay */}
                <div className="absolute top-3 left-3 bg-[#060a10]/90 backdrop-blur border border-[#101d2a] p-2.5 rounded-lg text-[10px] space-y-1">
                  <div className="text-[#00f0ff] font-bold flex items-center gap-1.5">
                    <Activity className="w-3 h-3 text-[#39ff14]" />
                    HYPER-SPATIAL 4D COORDINATES
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 text-gray-300">
                    <span>X (Zx): <strong className="text-cyan-300">{cycleData.projection4D.x.toFixed(4)}</strong></span>
                    <span>Y (Vert): <strong className="text-emerald-400">{cycleData.projection4D.y.toFixed(4)}</strong></span>
                    <span>Z (Orth): <strong className="text-purple-400">{cycleData.projection4D.z.toFixed(4)}</strong></span>
                    <span>W (Wy): <strong className="text-[#ffb700]">{cycleData.projection4D.w.toFixed(4)}</strong></span>
                  </div>
                </div>

                {/* Live Stream Legend */}
                <div className="absolute top-3 right-3 bg-[#060a10]/90 backdrop-blur border border-[#101d2a] p-2 rounded-lg text-[10px] flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-[#39ff14]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#39ff14] inline-block" />
                    <span>Automation (1234 &bull; Odd)</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#ffb700]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ffb700] inline-block" />
                    <span>Shadow (1324 &bull; Even)</span>
                  </div>
                  <div className="text-gray-400 text-[9px] pt-1 border-t border-gray-800">
                    Power: {cycleData.powerDrawModulationOhm} &Omega; &bull; Half-decay: 1.000
                  </div>
                </div>

                {/* Bottom Canvas Controls */}
                <div className="absolute bottom-3 left-3 right-3 bg-[#060a10]/95 backdrop-blur border border-[#101d2a] p-2 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsRunning(!isRunning)}
                      className="px-2.5 py-1 rounded bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/30 font-bold flex items-center gap-1"
                    >
                      {isRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                      <span>{isRunning ? 'Pause' : 'Stream'}</span>
                    </button>

                    <button
                      onClick={() => {
                        stepIndexRef.current += 1;
                        const next = stepIndexRef.current;
                        setStepIndex(next);
                        const res = globalTraceEngine.executeFourLaneSplitCycle(
                          next,
                          1.42,
                          0xbf58476dn,
                          inversionSpike,
                          0.0,
                          0.1,
                          19374.18,
                          0.077,
                          false
                        );
                        cycleDataRef.current = res;
                        setCycleData(res);
                      }}
                      className="px-2.5 py-1 rounded bg-[#07121d] hover:bg-gray-800 text-gray-300 border border-gray-700 font-medium"
                    >
                      Step +1
                    </button>

                    <button
                      onClick={() => setInversionSpike(!inversionSpike)}
                      className={`px-2.5 py-1 rounded border font-bold flex items-center gap-1 ${
                        inversionSpike
                          ? 'bg-[#ff0055] text-black border-[#ff0055]'
                          : 'bg-[#ff0055]/10 text-[#ff0055] border-[#ff0055]/30'
                      }`}
                    >
                      <span>( .|. ) Fallback</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-3 text-[10px] text-gray-400">
                    <span>Rot Speed:</span>
                    <input
                      type="range"
                      min="0.005"
                      max="0.06"
                      step="0.005"
                      value={rotSpeed}
                      onChange={(e) => setRotSpeed(parseFloat(e.target.value))}
                      className="w-20 accent-[#00f0ff]"
                    />
                    <span className="text-cyan-400 font-bold">{cycleData.latestBlock.validatedSignature}</span>
                  </div>
                </div>
              </div>

              {/* Right Column (4 cols): Coaxial & 3-Layer Overlay Specs */}
              <div className="lg:col-span-4 flex flex-col gap-3">
                {/* 1. Coaxial Kernel Crossing Box */}
                <div className="p-3 bg-[#060a10] border border-[#101d2a] rounded-xl text-xs space-y-2">
                  <span className="text-[#ffb700] font-bold flex items-center gap-1.5 text-xs">
                    <Compass className="w-4 h-4 text-[#00f0ff]" />
                    COAXIAL LOCKING SPECIFICATION
                  </span>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    "At the halfway point .5 is when the intersection alongside the exact center crosses creating three layers overlaying keeping the network inside of a timed stream."
                  </p>
                  <div className="p-2.5 bg-[#010204] border border-[#101d2a] rounded font-mono text-[11px] space-y-1">
                    <div className="text-cyan-400 flex justify-between">
                      <span>Layer 1 (LU - Left Up):</span>
                      <strong className="text-white">Odd 13579</strong>
                    </div>
                    <div className="text-[#ffb700] flex justify-between">
                      <span>Layer 2 (Coaxial Center):</span>
                      <strong className="text-amber-300">0.5 Crossing Intersect</strong>
                    </div>
                    <div className="text-purple-400 flex justify-between">
                      <span>Layer 3 (RD - Right Down):</span>
                      <strong className="text-white">Even 24680</strong>
                    </div>
                  </div>
                </div>

                {/* 2. Live Arbitrage Additive Stats */}
                <div className="p-3 bg-[#060a10] border border-[#101d2a] rounded-xl text-xs space-y-2">
                  <span className="text-[#39ff14] font-bold flex items-center gap-1.5 text-xs">
                    <Zap className="w-4 h-4 text-[#39ff14]" />
                    ARBITRAGE ADDITIVE TELEMETRY
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="p-2 rounded bg-[#020407] border border-[#101d2a]">
                      <span className="text-gray-500 block">Net PnL (USD):</span>
                      <span className="text-[#39ff14] font-bold text-xs">
                        ${cycleData.arbitrageTelemetry.netProfitUSD.toFixed(2)}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-[#020407] border border-[#101d2a]">
                      <span className="text-gray-500 block">Lattice Multiplier:</span>
                      <span className="text-[#ffb700] font-bold text-xs">
                        {cycleData.arbitrageTelemetry.computingPowerMultiplier}x
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Button to Jump to Audit Log */}
                {onViewAuditLog && (
                  <button
                    onClick={() => {
                      onClose();
                      onViewAuditLog();
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>View Block Ledger Audit Log ({globalTraceEngine.getBlockLedger().length} Blocks)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Real-time D3 Four-Lane Transition Graph Embedded in 4D Canvas */}
            <div className="mt-2">
              <D3FourLaneTransitionGraph cycleResult={cycleData} historyLimit={50} />
            </div>
          </div>
          )}

          {/* Dedicated Full D3 Four-Lane Transition Graph Tab */}
          {activeTab === 'D3_TRANSITION' && (
            <div className="flex flex-col gap-4 font-mono">
              <D3FourLaneTransitionGraph cycleResult={cycleData} historyLimit={100} />

              {/* 4 Lanes Operational Matrix Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {cycleData.lanes.map((lane) => (
                  <div
                    key={`lane-detail-${lane.laneId}`}
                    className={`p-3 rounded-xl border ${
                      lane.laneId === 1
                        ? 'bg-[#020503] border-[#39ff14]/30'
                        : lane.laneId === 2
                        ? 'bg-[#050402] border-[#ffb700]/30'
                        : lane.laneId === 3
                        ? 'bg-[#020507] border-cyan-500/30'
                        : 'bg-[#050207] border-purple-500/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`font-bold text-xs flex items-center gap-1.5 ${
                          lane.laneId === 1
                            ? 'text-[#39ff14]'
                            : lane.laneId === 2
                            ? 'text-[#ffb700]'
                            : lane.laneId === 3
                            ? 'text-cyan-400'
                            : 'text-purple-400'
                        }`}
                      >
                        <Cpu className="w-3.5 h-3.5" />
                        LANE {lane.laneId} &bull; {lane.sequenceOrder}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-gray-400">
                        {lane.role}
                      </span>
                    </div>

                    <div className="space-y-1 text-[11px] text-gray-300">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Coordinate:</span>
                        <strong className="text-white">{(lane.coordinateValue % 1.0).toFixed(4)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Operand Syntax:</span>
                        <span className="font-bold text-cyan-300">
                          {lane.role === 'automation' ? `\u007B t=${lane.fractionalTimingIncrement} \u007D` : `( iter=${lane.wholeCycleIteration} )`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Parity Attribute:</span>
                        <span className="text-amber-400 font-bold">{lane.parityAttribute}</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-gray-800 text-[10px]">
                        <span className="text-gray-500">Mirrored Ticket:</span>
                        <span className="text-gray-400 truncate max-w-[100px]">{lane.mirroredTicket.originalSequenceId}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Coaxial Fusion & Kernel Parity Synchronization Ribbon */}
              <div className="p-3 bg-[#060a10] border border-[#101d2a] rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#39ff14] animate-ping" />
                  <span className="text-white font-bold">
                    CMOS KERNEL EQUILIBRIUM: {cycleData.centerCoaxialLocked ? 'COAXIAL FUSED AT 0.5' : 'CONTINUOUS REVERSIBLE DRIFT'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-gray-400 text-[11px]">
                  <span>Ohm Draw: <strong className="text-[#39ff14]">{cycleData.powerDrawModulationOhm} &Omega;</strong></span>
                  <span>Palindromic: <strong className="text-[#ffb700]">{cycleData.palindromicTail.sequenceOrderForward}</strong></span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'COPRIME_MATRIX' && (
            <div className="p-4 bg-[#010204] border border-[#101d2a] rounded-xl space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-[#101d2a] pb-2">
                <span className="text-[#ffb700] font-bold flex items-center gap-2">
                  <Binary className="w-4 h-4 text-[#00f0ff]" />
                  THREE-LAYER COPRIME DISTRIBUTION MATRIX &bull; CENTRAL COAXIAL LINE
                </span>
                <span className="text-[11px] text-gray-400">
                  Numeral 0 as 1 full cycle every 3rd step
                </span>
              </div>

              {/* Exact Diagram from User Prompt & Technicalities */}
              <div className="p-4 bg-[#050911] border border-[#101d2a] rounded-lg text-center font-mono leading-relaxed select-text space-y-2 overflow-x-auto">
                <div className="text-purple-400 tracking-[0.25em] text-sm font-bold">
                  246802468024680
                </div>
                <div className="text-cyan-400 tracking-[0.25em] text-sm font-bold">
                  135791357913579
                </div>

                <div className="text-emerald-400 tracking-[0.35em] text-base font-bold py-1">
                  .1 .3 .5 .7 .9
                </div>

                {/* Central Coaxial Line */}
                <div className="my-2 py-1 px-4 bg-gradient-to-r from-transparent via-[#ffb700]/30 to-transparent border-y border-[#ffb700]/60 text-[#ffb700] font-bold text-xs flex items-center justify-center gap-2">
                  <span>&bull;&bull;&bull;</span>
                  <span>CENTRAL COAXIAL LINE &bull; KERNEL FUSED AT .5 PARITY INTERSECTION</span>
                  <span>&bull;&bull;&bull;</span>
                </div>

                <div className="text-rose-400 tracking-[0.35em] text-base font-bold py-1">
                  .2 .4 .6 .8 .0
                </div>

                <div className="text-cyan-400 tracking-[0.25em] text-sm font-bold">
                  135791357913579
                </div>
                <div className="text-purple-400 tracking-[0.25em] text-sm font-bold">
                  246802468024680
                </div>
              </div>

              {/* Explanatory Quadrants */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                <div className="p-3 bg-[#060a10] border border-[#101d2a] rounded-lg space-y-1">
                  <span className="text-cyan-400 font-bold block">Top (LU: Left Up):</span>
                  <p className="text-gray-400">
                    High/low binary distributions across odd sequences. Operands represent forward automation stream timed per 0.1ms tick.
                  </p>
                </div>

                <div className="p-3 bg-[#060a10] border border-[#101d2a] rounded-lg space-y-1">
                  <span className="text-purple-400 font-bold block">Bottom (RD: Right Down):</span>
                  <p className="text-gray-400">
                    Inverted shadow operator running at double inverse velocity x2, retaining opposing location ticket and original order.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'SPARSEBUNDLE' && (
            <div className="p-4 bg-[#010204] border border-[#101d2a] rounded-xl space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-[#101d2a] pb-2">
                <span className="text-[#39ff14] font-bold flex items-center gap-2">
                  <BatteryCharging className="w-4 h-4 text-[#39ff14]" />
                  SPARSEBUNDLE 8MB STREAMED CHUNK RECEIPTS &bull; OHM DRAW EQUILIBRIUM
                </span>
                <span className="text-[11px] text-[#ffb700]">
                  388,608 Bytes Palindromic Tail Margin
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
                <div className="p-3 bg-[#060a10] border border-[#101d2a] rounded-lg">
                  <span className="text-gray-500 block text-[10px]">Chunk Size:</span>
                  <span className="text-white font-bold text-sm">8,388,608 Bytes (8 MB)</span>
                  <span className="text-cyan-400 block text-[10px] mt-1">Chunk ID: {cycleData.chunkReceipt.chunkId}</span>
                </div>

                <div className="p-3 bg-[#060a10] border border-[#101d2a] rounded-lg">
                  <span className="text-gray-500 block text-[10px]">Power Draw Regulation:</span>
                  <span className="text-[#39ff14] font-bold text-sm">{cycleData.powerDrawModulationOhm} &Omega;</span>
                  <span className="text-gray-400 block text-[10px] mt-1">1:1:1:1:1:1 Equilibrium Ohm System</span>
                </div>

                <div className="p-3 bg-[#060a10] border border-[#101d2a] rounded-lg">
                  <span className="text-gray-500 block text-[10px]">Palindromic Sequences:</span>
                  <span className="text-[#ffb700] font-bold text-sm">{cycleData.palindromicTail.sequenceOrderForward} &harr; {cycleData.palindromicTail.sequenceOrderBackward}</span>
                  <span className="text-gray-400 block text-[10px] mt-1">FIFO 12344321 / LIFO 43211234</span>
                </div>
              </div>

              {/* Cryptographic Seal & Merkle Branch */}
              <div className="p-3 bg-[#060a10] border border-[#101d2a] rounded-lg space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-400">Cryptographic Seal Signature:</span>
                  <span className="text-cyan-300 font-bold">{cycleData.chunkReceipt.sealSignature}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-400">Merkle Lattice Branch:</span>
                  <span className="text-emerald-400 font-bold">{cycleData.merkleBranch.pathId} (ISOLATED PATH)</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Status Bar */}
        <div className="p-3 bg-[#060a10] border-t border-[#101d2a] flex flex-wrap items-center justify-between gap-2 text-[10px] text-gray-400 shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[#39ff14]">
              <span className="w-2 h-2 rounded-full bg-[#39ff14] animate-pulse" />
              0.1ms Telemetry Drift: {cycleData.asyncPredictiveScan.telemetryDriftMs.toFixed(3)} ms
            </span>
            <span className="text-gray-500">&bull;</span>
            <span>MAC/NAC Solver Sealed: MATCHED</span>
          </div>

          <div className="flex items-center gap-2">
            <span>Press <kbd className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-700">ESC</kbd> to close</span>
          </div>
        </div>
      </div>
    </div>
  );
};
