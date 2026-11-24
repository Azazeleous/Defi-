import React, { useEffect, useRef } from 'react';
import { OperatorTelemetry, EvolutionDirection } from '../types/gaiaNexus';
import { 
  Compass, 
  RotateCw, 
  Layers, 
  CircleDot, 
  Clock, 
  ArrowRightLeft, 
  Activity, 
  ShieldCheck, 
  Zap,
  Power
} from 'lucide-react';

interface Props {
  telemetry: OperatorTelemetry;
  onToggleDirection: () => void;
  onTriggerLift: () => void;
  onResetOrigin: () => void;
  onToggleHalt: () => void;
}

export const GaiaPixelstreamCanvas: React.FC<Props> = ({
  telemetry,
  onToggleDirection,
  onTriggerLift,
  onResetOrigin,
  onToggleHalt,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high-DPI scaling
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    }

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const minDim = Math.min(w, h);

    // Deep Void Background #010306
    ctx.fillStyle = '#010306';
    ctx.fillRect(0, 0, w, h);

    // 1. Draw 360° Circular Angular Ring (100 ticks = 1% increments)
    const ringRadius = minDim * 0.42;
    ctx.lineWidth = 1;

    for (let i = 0; i < 100; i++) {
      const angle = (i / 100) * Math.PI * 2 - Math.PI / 2;
      const isMajor = i % 10 === 0;
      const rInner = ringRadius - (isMajor ? 8 : 4);
      const rOuter = ringRadius;

      const x1 = cx + Math.cos(angle) * rInner;
      const y1 = cy + Math.sin(angle) * rInner;
      const x2 = cx + Math.cos(angle) * rOuter;
      const y2 = cy + Math.sin(angle) * rOuter;

      const hueVal = i * 3.6;
      ctx.strokeStyle = Math.abs(telemetry.quantizedHue - hueVal) < 7.2
        ? `hsl(${hueVal}, 100%, 60%)`
        : isMajor
        ? '#1e293b'
        : '#0f172a';

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Outer guide circle
    ctx.strokeStyle = '#101d2a';
    ctx.beginPath();
    ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    // 2. Draw Three Symplectic Paired Coordinate Axes (X1-Y1, X2-Y2, X3-Y3)
    const planeAngles = [0, Math.PI / 3, (2 * Math.PI) / 3];
    const planeLabels = ['X₁ ↔ Y₁', 'X₂ ↔ Y₂', 'X₃ ↔ Y₃'];
    const planeColors = ['#00f0ff', '#a855f7', '#ffb700'];

    planeAngles.forEach((ang, idx) => {
      ctx.strokeStyle = '#0e1a26';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - Math.cos(ang) * ringRadius * 0.9, cy - Math.sin(ang) * ringRadius * 0.9);
      ctx.lineTo(cx + Math.cos(ang) * ringRadius * 0.9, cy + Math.sin(ang) * ringRadius * 0.9);
      ctx.stroke();

      // Plane Label Tag
      const lx = cx + Math.cos(ang) * (ringRadius + 16);
      const ly = cy + Math.sin(ang) * (ringRadius + 16);
      ctx.fillStyle = planeColors[idx];
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(planeLabels[idx], lx, ly);
    });

    // 3. Render Cubic Bézier Trajectory: B(t) = (1-t)^3 P0 + 3(1-t)^2 t P1 + 3(1-t) t^2 P2 + t^3 P3
    const { P0, P1, P2, P3 } = telemetry.bezier;
    const scale = minDim * 0.32;

    const mapToCanvas = (pt: [number, number, number]): [number, number] => {
      // 3D to 2D isometric projection
      const px = cx + (pt[0] - pt[1] * 0.5) * scale;
      const py = cy + (pt[2] - pt[0] * 0.25 - pt[1] * 0.25) * scale;
      return [px, py];
    };

    const p0c = mapToCanvas(P0);
    const p1c = mapToCanvas(P1);
    const p2c = mapToCanvas(P2);
    const p3c = mapToCanvas(P3);

    // Forward (+) Trajectory Path in Cyan
    ctx.strokeStyle = telemetry.direction === 'FORWARD_POS' ? '#00f0ff' : '#00f0ff88';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(p0c[0], p0c[1]);
    ctx.bezierCurveTo(p1c[0], p1c[1], p2c[0], p2c[1], p3c[0], p3c[1]);
    ctx.stroke();
    ctx.shadowBlur = 0; // reset

    // Reverse (-) Opposing Trajectory Path in Amber/Gold
    const p0cNeg = mapToCanvas([-P0[0], -P0[1], -P0[2]]);
    const p1cNeg = mapToCanvas([-P1[0], -P1[1], -P1[2]]);
    const p2cNeg = mapToCanvas([-P2[0], -P2[1], -P2[2]]);
    const p3cNeg = mapToCanvas([-P3[0], -P3[1], -P3[2]]);

    ctx.strokeStyle = telemetry.direction === 'INVERSE_NEG' ? '#ffb700' : '#ffb70088';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(p0cNeg[0], p0cNeg[1]);
    ctx.bezierCurveTo(p1cNeg[0], p1cNeg[1], p2cNeg[0], p2cNeg[1], p3cNeg[0], p3cNeg[1]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Origin Node: 0.0 · 0.0 (OMNI NEXUS ORIGIN)
    ctx.fillStyle = '#060a10';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Interpunct · Marker
    ctx.fillStyle = '#39ff14';
    ctx.shadowColor = '#39ff14';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#b8daf7';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('0.0 · 0.0', cx, cy + 24);

    // 5. Active Evolution Particles along Bézier Curve
    const tProgress = (telemetry.stageSequence % 100) / 100;
    const invT = 1 - tProgress;

    // Point on curve B(t)
    const bx =
      invT * invT * invT * p0c[0] +
      3 * invT * invT * tProgress * p1c[0] +
      3 * invT * tProgress * tProgress * p2c[0] +
      tProgress * tProgress * tProgress * p3c[0];
    const by =
      invT * invT * invT * p0c[1] +
      3 * invT * invT * tProgress * p1c[1] +
      3 * invT * tProgress * tProgress * p2c[1] +
      tProgress * tProgress * tProgress * p3c[1];

    ctx.fillStyle = '#39ff14';
    ctx.shadowColor = '#39ff14';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(bx, by, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Opposite particle along reverse path
    const bNegX =
      invT * invT * invT * p0cNeg[0] +
      3 * invT * invT * tProgress * p1cNeg[0] +
      3 * invT * tProgress * tProgress * p2cNeg[0] +
      tProgress * tProgress * tProgress * p3cNeg[0];
    const bNegY =
      invT * invT * invT * p0cNeg[1] +
      3 * invT * invT * tProgress * p1cNeg[1] +
      3 * invT * tProgress * tProgress * p2cNeg[1] +
      tProgress * tProgress * tProgress * p3cNeg[1];

    ctx.fillStyle = '#ffb700';
    ctx.shadowColor = '#ffb700';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(bNegX, bNegY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }, [telemetry]);

  return (
    <div className="relative w-full h-full min-h-[460px] bg-[#010306] flex flex-col overflow-hidden select-none">
      {/* Top HUD Badge: Operator Designation & Invariants */}
      <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-2 bg-[#060a10]/95 backdrop-blur border border-[#101d2a] px-3 py-1.5 rounded text-[11px] font-mono shadow-xl">
        <span className="text-[#00f0ff] font-bold">AE.SL6.INVPAIR</span>
        <span className="text-gray-500">&bull;</span>
        <span className="text-gray-300">v0.1.0</span>
        <span className="text-gray-500">&bull;</span>
        <span className="text-[#ffb700]">ROOT: {telemetry.rootMarker}</span>
        <span className="text-gray-500">&bull;</span>
        <span className="text-[#39ff14] font-semibold">ORIGIN: {telemetry.originState}</span>
      </div>

      {/* Top-Right: Three Clocks Status Display */}
      <div className="absolute top-3 right-3 z-20 bg-[#060a10]/95 backdrop-blur border border-[#101d2a] px-3 py-1.5 rounded text-[10px] font-mono text-gray-300 flex items-center gap-3 shadow-xl">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-[#00f0ff]" />
          <span className="text-gray-400">0.1ms:</span>
          <span className="text-white font-bold">{telemetry.clocks.sampleClockMs01}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-400">1-Frame:</span>
          <span className="text-[#39ff14] font-bold">60Hz</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-400">Heartbeat:</span>
          <span className="text-[#ffb700] font-bold">{telemetry.clocks.epochSec}</span>
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <canvas ref={canvasRef} className="w-full h-full flex-1 block cursor-crosshair" />

      {/* Bottom Floating Tactical Control Rail */}
      <div className="absolute bottom-3 left-3 right-3 z-20 bg-[#060a10]/95 backdrop-blur border border-[#101d2a] p-2.5 rounded-lg shadow-2xl flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2">
          {/* Direction Toggle */}
          <button
            onClick={onToggleDirection}
            className={`px-3 py-1.5 rounded border text-xs font-bold transition-all flex items-center gap-1.5 ${
              telemetry.direction === 'FORWARD_POS'
                ? 'bg-[#00f0ff]/20 text-[#00f0ff] border-[#00f0ff]/50'
                : 'bg-[#ffb700]/20 text-[#ffb700] border-[#ffb700]/50'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>
              {telemetry.direction === 'FORWARD_POS' ? '+ FORWARD TRAVERSAL' : '− INVERSE REVERSAL'}
            </span>
          </button>

          {/* Inverse-Fed Lift Button */}
          <button
            onClick={onTriggerLift}
            className="px-3 py-1.5 rounded bg-[#07121d] hover:bg-[#a855f7]/20 text-[#a855f7] border border-[#a855f7]/40 text-xs font-semibold transition-all flex items-center gap-1.5"
            title="K_{n+1} = lambda*I + B_n^T * P_n * B_n"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>INVERSE-FED LIFT (K_{'{n+1}'})</span>
          </button>

          {/* Reset Origin */}
          <button
            onClick={onResetOrigin}
            className="px-3 py-1.5 rounded bg-[#07121d] hover:bg-[#39ff14]/20 text-[#39ff14] border border-[#39ff14]/40 text-xs font-semibold transition-all flex items-center gap-1.5"
          >
            <CircleDot className="w-3.5 h-3.5" />
            <span>0.0 · 0.0 RESET</span>
          </button>
        </div>

        {/* Telemetry Summary Pills */}
        <div className="flex items-center gap-3 text-[11px]">
          <div>
            <span className="text-gray-500">Euler &chi;:</span>
            <span className="text-white font-bold ml-1">{telemetry.eulerCharacteristic} (Sphere S²)</span>
          </div>

          <div>
            <span className="text-gray-500">Quantized Hue:</span>
            <span className="text-[#ffb700] font-bold ml-1">{telemetry.quantizedHue}°</span>
          </div>

          <div>
            <span className="text-gray-500">Parity Dual &pi;:</span>
            <span className="text-[#00f0ff] font-bold ml-1">{telemetry.parityDualState}</span>
          </div>

          {/* Graceful Shutdown Switch */}
          <button
            onClick={onToggleHalt}
            className={`p-1.5 rounded border transition-colors ${
              telemetry.isHalted
                ? 'bg-red-500/20 text-red-400 border-red-500/50'
                : 'bg-gray-800 text-gray-300 border-gray-700 hover:text-white'
            }`}
            title={telemetry.isHalted ? 'Resume Kernel Execution' : 'First-Class Graceful Shutdown / Commit'}
          >
            <Power className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
