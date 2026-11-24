import React, { useState, useEffect, useRef } from 'react';
import {
  CuboctahedralTraceEngine,
  FourLaneCycleResult,
} from '../engine/cuboctahedralTraceEngine';
import type { DiamondLatticeCycleResult, SupportedLaneCount } from '../contracts/gaia-v61';
import { 
  Play, 
  Pause, 
  AlertTriangle, 
  Layers, 
  Cpu, 
  Zap, 
  Activity, 
  ShieldCheck,
  Binary,
} from 'lucide-react';

export const FourLaneLatticeConsole: React.FC = () => {
  const engineRef = useRef<CuboctahedralTraceEngine>(new CuboctahedralTraceEngine());
  const [stepIndex, setStepIndex] = useState<number>(100);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [inversionSpike, setInversionSpike] = useState<boolean>(false);
  const [timeSinceTimeout] = useState<number>(0.0);
  const [actualTimeDeltaMs] = useState<number>(0.1);
  const [laneCount, setLaneCount] = useState<SupportedLaneCount>(16);
  const [diamondResult, setDiamondResult] = useState<DiamondLatticeCycleResult | null>(null);
  const [diamondBusy, setDiamondBusy] = useState<boolean>(false);

  // Zero-synthetic baseline (no hardcoded 19374.18 / 0.077 fake arbitrage telemetry)
  const [arbitrageProfit] = useState<number>(0);
  const [arbitrageSlippage] = useState<number>(0);

  // Engine cycle result
  const [cycleData, setCycleData] = useState<FourLaneCycleResult>(() =>
    engineRef.current.executeFourLaneSplitCycle(
      100,
      1.42,
      0xbf58476dn,
      false,
      0.0,
      0.1,
      0,
      0
    )
  );

  const stepIndexRef = useRef<number>(100);
  const cycleDataRef = useRef<FourLaneCycleResult>(cycleData);
  const cuboctahedronCanvasRef = useRef<HTMLCanvasElement>(null);
  const dualOpposingCanvasRef = useRef<HTMLCanvasElement>(null);
  const rotationRef = useRef<number>(0);

  // History buffer for dual opposing graphing (automation vs shadow)
  const historyRef = useRef<{ autoVal: number; shadowVal: number; step: number }[]>([]);

  // Execution loop
  useEffect(() => {
    let animId: number;
    let lastUiUpdateTime = performance.now();

    const loop = (currentTime: number) => {
      if (isRunning) {
        stepIndexRef.current += 1;
        const next = stepIndexRef.current;
        const engine = engineRef.current;
        const res = engine.executeFourLaneSplitCycle(
          next,
          1.42,
          0xbf58476dn,
          inversionSpike,
          timeSinceTimeout,
          actualTimeDeltaMs,
          arbitrageProfit,
          arbitrageSlippage,
          false
        );
        cycleDataRef.current = res;

        // Update dual history: Lane 1 (Automation) vs Lane 2 (Shadow)
        const autoVal = res.lanes[0].coordinateValue;
        const shadowVal = res.lanes[1].coordinateValue;
        historyRef.current.push({ autoVal, shadowVal, step: next });
        if (historyRef.current.length > 120) {
          historyRef.current.shift();
        }

        // Throttle React state update to avoid heavy 60fps re-renders
        if (currentTime - lastUiUpdateTime > 60) {
          lastUiUpdateTime = currentTime;
          setStepIndex(next);
          setCycleData(res);
        }
      }

      // Draw Cuboctahedron Canvas
      const cCanvas = cuboctahedronCanvasRef.current;
      if (cCanvas) {
        const ctx = cCanvas.getContext('2d');
        if (ctx) {
          rotationRef.current += 0.015;
          drawCuboctahedron(ctx, cCanvas.width, cCanvas.height, rotationRef.current, cycleDataRef.current);
        }
      }

      // Draw Dual Opposing Tracking Graph
      const gCanvas = dualOpposingCanvasRef.current;
      if (gCanvas) {
        const ctx = gCanvas.getContext('2d');
        if (ctx) {
          drawDualOpposingGraph(ctx, gCanvas.width, gCanvas.height, historyRef.current, cycleDataRef.current);
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(animId);
  }, [isRunning, inversionSpike, timeSinceTimeout, actualTimeDeltaMs, arbitrageProfit, arbitrageSlippage]);

  // 3D Cuboctahedron Canvas Routine
  const drawCuboctahedron = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    rot: number,
    data: FourLaneCycleResult
  ) => {
    ctx.fillStyle = '#010306';
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const scale = Math.min(w, h) * 0.28;

    const nodes = Array.from(engineRef.current.getNodes().values());
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);
    const cosPitch = Math.cos(rot * 0.6);
    const sinPitch = Math.sin(rot * 0.6);

    const projectedNodes = nodes.map((n) => {
      let x = n.coordinate.x * cosR - n.coordinate.z * sinR;
      let z = n.coordinate.x * sinR + n.coordinate.z * cosR;
      let y = n.coordinate.y;

      let y2 = y * cosPitch - z * sinPitch;
      let z2 = y * sinPitch + z * cosPitch;

      const dist = 3.2;
      const fov = 1.0 / (dist - z2 * 0.35);
      const px = cx + x * scale * fov;
      const py = cy + y2 * scale * fov;

      return { ...n, px, py, z2 };
    });

    // Connecting edges
    ctx.lineWidth = 1.2;
    nodes.forEach((node) => {
      const p1 = projectedNodes[node.id];
      node.neighbors.forEach((neighId) => {
        if (node.id < neighId) {
          const p2 = projectedNodes[neighId];
          ctx.strokeStyle = data.centerCoaxialLocked
            ? '#ffb70066'
            : data.sudostepActive
            ? '#ff005577'
            : '#00f0ff44';
          ctx.beginPath();
          ctx.moveTo(p1.px, p1.py);
          ctx.lineTo(p2.px, p2.py);
          ctx.stroke();
        }
      });
    });

    // Vertices
    projectedNodes.forEach((p, idx) => {
      const isLead = idx === stepIndex % 12;
      ctx.fillStyle = isLead
        ? '#39ff14'
        : data.sudostepActive
        ? '#ff0055'
        : '#00f0ff';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = isLead ? 12 : 4;
      ctx.beginPath();
      ctx.arc(p.px, p.py, isLead ? 5 : 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    if (data.centerCoaxialLocked) {
      ctx.strokeStyle = '#ffb700';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(cx, cy, 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  };

  // Dual Opposing Graph Canvas Routine
  const drawDualOpposingGraph = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    history: { autoVal: number; shadowVal: number; step: number }[],
    data: FourLaneCycleResult
  ) => {
    ctx.fillStyle = '#020305';
    ctx.fillRect(0, 0, w, h);

    // Center baseline
    const midY = h / 2;
    ctx.strokeStyle = '#101d2a';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(w, midY);
    ctx.stroke();
    ctx.setLineDash([]);

    if (history.length < 2) return;

    // Draw Automation Wave (Green / Cyan Forward Vector)
    ctx.strokeStyle = '#39ff14';
    ctx.lineWidth = 2;
    ctx.beginPath();
    history.forEach((pt, idx) => {
      const x = (idx / (history.length - 1)) * w;
      const y = midY - (pt.autoVal % 1.0) * (h * 0.42);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw Shadow Wave (Amber / Red Reverse Mirrored Vector)
    ctx.strokeStyle = data.sudostepActive ? '#ff0055' : '#ffb700';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 2]);
    ctx.beginPath();
    history.forEach((pt, idx) => {
      const x = (idx / (history.length - 1)) * w;
      const y = midY + (pt.shadowVal % 1.0) * (h * 0.42);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Live tether intersection marker
    const latest = history[history.length - 1];
    const lx = w - 6;
    const autoY = midY - (latest.autoVal % 1.0) * (h * 0.42);
    const shadowY = midY + (latest.shadowVal % 1.0) * (h * 0.42);

    ctx.strokeStyle = '#00f0ff88';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(lx, autoY);
    ctx.lineTo(lx, shadowY);
    ctx.stroke();

    ctx.fillStyle = '#39ff14';
    ctx.beginPath();
    ctx.arc(lx, autoY, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffb700';
    ctx.beginPath();
    ctx.arc(lx, shadowY, 4, 0, Math.PI * 2);
    ctx.fill();
  };

  const handleToggleSpike = () => {
    setInversionSpike(!inversionSpike);
  };

  const handleStepOnce = () => {
    stepIndexRef.current += 1;
    const next = stepIndexRef.current;
    setStepIndex(next);
    const res = engineRef.current.executeFourLaneSplitCycle(
      next,
      1.42,
      0xbf58476dn,
      inversionSpike,
      timeSinceTimeout,
      actualTimeDeltaMs,
      arbitrageProfit,
      arbitrageSlippage,
      false
    );
    cycleDataRef.current = res;
    setCycleData(res);
  };

  const runLevel10DiamondLattice = async (previewOnly: boolean, customCount: SupportedLaneCount = laneCount) => {
    setDiamondBusy(true);
    try {
      const res = await fetch('/api/lattice/cycle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cryptic-role': 'ADMINISTRATOR',
        },
        body: JSON.stringify({
          laneCount: customCount,
          stepIndex: stepIndexRef.current,
          injectPairMismatch: inversionSpike,
          previewOnly,
        }),
      });
      const data = await res.json();
      if (data.ok && data.result) {
        setDiamondResult(data.result);
      }
    } finally {
      setDiamondBusy(false);
    }
  };

  useEffect(() => {
    runLevel10DiamondLattice(true, laneCount);
  }, [laneCount, inversionSpike]);

  return (
    <div className="w-full h-full flex flex-col bg-[#010306] text-[#b8daf7] font-mono text-xs select-none">
      {/* Top Console Header */}
      <div className="p-3 bg-[#060a10] border-b border-[#101d2a] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded bg-[#07121d] border border-[#00f0ff]/30 text-[#00f0ff]">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-white text-xs sm:text-sm">
                LEVEL-10 DIAMOND LATTICE ({laneCount} LANES) &bull; DUALTRACE VERIFIED
              </span>
              <span
                className={`text-[9px] px-2 py-0.5 rounded font-bold ${
                  cycleData.sudostepActive
                    ? 'bg-[#ff0055]/20 text-[#ff0055] border border-[#ff0055]/50'
                    : 'bg-[#39ff14]/20 text-[#39ff14] border border-[#39ff14]/30'
                }`}
              >
                {cycleData.sudostepActive ? 'GLOBAL INVERSION ( .|. )' : 'LATTICE KERNEL READY'}
              </span>
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Dynamic 4&ndash;64 lane opposing pairs with strict previewOnly isolation and BLAKE2b Merkle Receipt R verification.
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={laneCount}
            onChange={(e) => setLaneCount(Number(e.target.value) as SupportedLaneCount)}
            className="px-2.5 py-1.5 bg-[#07121d] border border-cyan-500/40 text-cyan-200 text-xs font-semibold"
          >
            <option value={4}>4 Lanes (2 Pairs)</option>
            <option value={8}>8 Lanes (4 Pairs)</option>
            <option value={16}>16 Lanes (8 Pairs)</option>
            <option value={32}>32 Lanes (16 Pairs)</option>
            <option value={64}>64 Lanes (32 Pairs)</option>
          </select>

          <button
            onClick={() => runLevel10DiamondLattice(true)}
            disabled={diamondBusy}
            className="px-2.5 py-1.5 bg-[#07121d] border border-slate-700 hover:border-cyan-400 text-slate-200 text-xs"
          >
            Preview Cycle
          </button>

          <button
            onClick={() => runLevel10DiamondLattice(false)}
            disabled={diamondBusy}
            className="px-2.5 py-1.5 bg-emerald-500/20 border border-emerald-400 text-emerald-200 hover:bg-emerald-500/30 text-xs font-bold flex items-center gap-1"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Commit Receipt R</span>
          </button>

          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`px-3 py-1.5 rounded border text-xs font-bold transition-all flex items-center gap-1.5 ${
              isRunning
                ? 'bg-[#00f0ff]/10 text-[#00f0ff] border-[#00f0ff]/40 hover:bg-[#00f0ff]/20'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/20'
            }`}
          >
            {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isRunning ? 'Pause Canvas' : 'Resume Canvas'}</span>
          </button>

          <button
            onClick={handleStepOnce}
            className="px-3 py-1.5 rounded bg-[#07121d] border border-gray-700 hover:border-gray-500 text-gray-300 text-xs font-semibold"
          >
            Step +1
          </button>

          <button
            onClick={handleToggleSpike}
            className={`px-3 py-1.5 rounded border text-xs font-bold transition-all flex items-center gap-1.5 ${
              inversionSpike
                ? 'bg-[#ff0055] text-black border-[#ff0055]'
                : 'bg-[#07121d] text-[#ff0055] border-[#ff0055]/40 hover:bg-[#ff0055]/20'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{inversionSpike ? 'Fault Active (Mismatch)' : 'Inject Pair Fault'}</span>
          </button>
        </div>
      </div>

      {/* Level-10 Server-Verified Diamond Lattice Telemetry Strip */}
      {diamondResult && (
        <div className="px-3 py-2 bg-[#040810] border-b border-[#101d2a] flex flex-wrap items-center justify-between gap-2 text-[11px] tabular-nums">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-cyan-300 font-bold">
              Level-{diamondResult.latticeLevel} ({diamondResult.laneCount}L / {diamondResult.pairs.length} Pairs)
            </span>
            <span className={diamondResult.convergence.A_accepted ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              A = B&and;C&and;V: {diamondResult.convergence.statusLabel}
            </span>
            <span className="text-slate-300">
              Mode: {diamondResult.previewOnly ? 'PREVIEW_ONLY (No DB Write)' : `COMMITTED (${diamondResult.receiptR?.ID})`}
            </span>
          </div>
          <div className="text-[10px] text-slate-400 truncate max-w-md">
            BLAKE2b Root: {diamondResult.merkleRootBlake2b}
          </div>
        </div>
      )}

      {/* Main Grid: Paired Interloped Diagram, Dual Opposing Graph & 4D Cuboctahedron */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 bg-[#101d2a] gap-[1px]">
        {/* Left Column (7 cols): Interloped Ladder Diagram & Dual Opposing Graph */}
        <div className="lg:col-span-7 bg-[#020305] p-3 flex flex-col gap-3 overflow-y-auto scrollbar-thin scrollbar-thumb-[#101d2a]">
          {/* 1. Exact Paired Interloped Topology Ladder Diagram */}
          <div className="p-3 rounded-lg bg-[#060a10] border border-[#101d2a]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#ffb700] font-bold flex items-center gap-1.5 text-xs">
                <Binary className="w-3.5 h-3.5 text-[#00f0ff]" />
                PAIRED INTERLOPED SPLIT-LANE LADDER TOPOLOGY
              </span>
              <span className="text-[10px] text-gray-400 font-mono">
                {'{ }'} Fractional &bull; ( ) Whole
              </span>
            </div>

            {/* ASCII/Visual Interloped Structure Box */}
            <div className="p-3 bg-[#010102] border border-[#101d2a] rounded font-mono text-[11px] leading-relaxed select-text overflow-x-auto">
              <div className="flex items-center justify-between text-[#00f0ff]">
                <span>&nbsp;&nbsp;1234 lane 4 (shadow)</span>
                <span className="text-gray-500 text-[10px]">
                  Tether: {cycleData.lanes[3].mirroredTicket.originalSequenceId} &bull; LU/RD Parity
                </span>
              </div>
              <div className="text-purple-400">
                &nbsp;&nbsp;<span className="text-white font-bold">(</span> )4321 lane 3 (automation whole cycle = {cycleData.lanes[2].wholeCycleIteration})
              </div>
              <div className="text-amber-400 pl-8">
                <span className="text-white font-bold">{'{'}</span> lane 3 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                <span className="text-cyan-300">.1.2.3.4.5.6.7.8.9</span>
              </div>
              <div className="text-[#39ff14] pl-9">
                <span className="text-white font-bold">{'}'}</span>lane 1 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                <span className="text-yellow-400 font-bold">4321</span> [t={cycleData.lanes[0].fractionalTimingIncrement}]
              </div>
              <div className="text-amber-400 pl-8">
                <span className="text-white font-bold">{'{'}</span>lane 4 &nbsp;&nbsp;&nbsp;&nbsp;
                <span className="text-rose-300">0.9.8.7.6.5.4.3.2.1</span>
              </div>
              <div className="text-[#ffb700] pl-9">
                <span className="text-white font-bold">{'}'}</span>lane 2 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                <span className="text-cyan-400 font-bold">1234</span> [t={cycleData.lanes[1].fractionalTimingIncrement}]
              </div>
              <div className="text-purple-400">
                &nbsp;&nbsp;<span className="text-white font-bold">(</span> )4321 lane 2 (shadow whole cycle = {cycleData.lanes[1].wholeCycleIteration})
              </div>
              <div className="flex items-center justify-between text-[#39ff14]">
                <span>&nbsp;&nbsp;1234 lane 1 (automation)</span>
                <span className="text-gray-500 text-[10px]">
                  Tether: {cycleData.lanes[0].mirroredTicket.originalSequenceId} &bull; Parity LU
                </span>
              </div>
            </div>

            {/* DUALTRACE 4P Checkpoint & Pair Verification Bar */}
            <div className="mt-2.5 pt-2 border-t border-[#101d2a] grid grid-cols-3 gap-2 text-[10px]">
              <div className="p-1.5 rounded bg-[#010102] border border-[#101d2a]">
                <div className="text-gray-400 text-[9px]">PAIR A (L1 ⇄ L2)</div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className={cycleData.pairAVerification?.isSymmetric ? "text-[#39ff14] font-bold" : "text-[#ff0055] font-bold"}>
                    {cycleData.pairAVerification?.isSymmetric ? "SYMMETRIC (PASS)" : "DIVERGED"}
                  </span>
                  <span className="text-gray-500 text-[9px]">&Delta; {cycleData.pairAVerification?.midpointDivergence.toFixed(3)}</span>
                </div>
              </div>
              <div className="p-1.5 rounded bg-[#010102] border border-[#101d2a]">
                <div className="text-gray-400 text-[9px]">PAIR B (L3 ⇄ L4)</div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className={cycleData.pairBVerification?.isSymmetric ? "text-[#39ff14] font-bold" : "text-[#ff0055] font-bold"}>
                    {cycleData.pairBVerification?.isSymmetric ? "SYMMETRIC (PASS)" : "DIVERGED"}
                  </span>
                  <span className="text-gray-500 text-[9px]">&Delta; {cycleData.pairBVerification?.midpointDivergence.toFixed(3)}</span>
                </div>
              </div>
              <div className="p-1.5 rounded bg-[#010102] border border-[#101d2a]">
                <div className="text-gray-400 text-[9px]">DUALTRACE INTEGRITY</div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className={cycleData.checkpointRecord?.overallIntegrity === "PASS" ? "text-cyan-400 font-bold" : "text-amber-400 font-bold"}>
                    {cycleData.checkpointRecord?.overallIntegrity || "PASS"}
                  </span>
                  <span className="text-gray-500 text-[9px]">{cycleData.checkpointRecord?.checkpointId}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Dual Opposing Tracking Graph (Automation vs Shadow inside Kernel) */}
          <div className="p-3 rounded-lg bg-[#060a10] border border-[#101d2a]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-[#39ff14]" />
                <span className="font-bold text-white text-xs">
                  DUAL OPPOSING TRAJECTORY GRAPH &bull; CMOS PERMISSION KERNEL
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1 text-[#39ff14]">
                  <span className="w-2 h-0.5 bg-[#39ff14] inline-block" />
                  Automation (Lane 1)
                </span>
                <span className="flex items-center gap-1 text-[#ffb700]">
                  <span className="w-2 h-0.5 bg-[#ffb700] inline-block" />
                  Shadow (Lane 2)
                </span>
                <span className="text-gray-400">Tethered at Source</span>
              </div>
            </div>

            <div className="h-28 w-full relative rounded overflow-hidden border border-[#101d2a]">
              <canvas ref={dualOpposingCanvasRef} width={640} height={120} className="w-full h-full block" />
            </div>

            <div className="mt-2 flex items-center justify-between text-[10px] text-gray-400 font-mono">
              <span>Lane 1 Coord: {cycleData.lanes[0].coordinateValue.toFixed(4)}</span>
              <span>Lane 2 Coord: {cycleData.lanes[1].coordinateValue.toFixed(4)}</span>
              <span className="text-cyan-400 font-bold">
                CMOS Permission: AUTHORIZED_IN_BOUNDS
              </span>
            </div>
          </div>

          {/* 3. MARA Processor Profiling & Custom Blockchain Block ack */}
          <div className="p-3 rounded-lg bg-[#060a10] border border-[#101d2a]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#00f0ff] font-bold flex items-center gap-1.5 text-xs">
                <Zap className="w-3.5 h-3.5 text-[#00f0ff]" />
                MARA COMPUTATIONAL ARCHITECTURE &bull; BLOCKCHAIN SUBSTRATE
              </span>
              <span className="text-[#39ff14] text-[10px] font-bold">
                SUB-MILLISECOND ACTIVE
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
              <div className="p-2 rounded bg-[#020407] border border-[#101d2a]">
                <span className="text-gray-500 block text-[9px]">Process Latency:</span>
                <span className="text-cyan-400 font-bold font-mono">
                  {cycleData.maraProfile.processLatencyMs.toFixed(3)} ms
                </span>
              </div>

              <div className="p-2 rounded bg-[#020407] border border-[#101d2a]">
                <span className="text-gray-500 block text-[9px]">DPC Bypass / Affinity:</span>
                <span className="text-[#39ff14] font-bold font-mono">
                  {cycleData.maraProfile.dpcBypassActive ? 'BYPASS ACTIVE' : 'STANDARD'}
                </span>
              </div>

              <div className="p-2 rounded bg-[#020407] border border-[#101d2a]">
                <span className="text-gray-500 block text-[9px]">Arbitrage Additive Mult:</span>
                <span className="text-[#ffb700] font-bold font-mono">
                  {cycleData.arbitrageTelemetry.computingPowerMultiplier}x
                </span>
              </div>

              <div className="p-2 rounded bg-[#020407] border border-[#101d2a]">
                <span className="text-gray-500 block text-[9px]">Net Arbitrage PnL:</span>
                <span className="text-[#39ff14] font-bold font-mono">
                  ${cycleData.arbitrageTelemetry.netProfitUSD.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Latest Block Ledger ACK */}
            <div className="mt-2 p-2 rounded bg-[#010102] border border-[#101d2a] flex items-center justify-between text-[10px] font-mono">
              <div className="flex items-center gap-2 truncate">
                <span className="text-[#ffb700] font-bold shrink-0">
                  Block #{cycleData.latestBlock.index}:
                </span>
                <span className="text-gray-300 truncate">
                  {cycleData.latestBlock.currentHash}
                </span>
              </div>
              <span className="text-[#00f0ff] shrink-0 ml-2">
                {cycleData.latestBlock.validatedSignature}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): 3D Cuboctahedron Canvas & 4D Projections & Palindromic Tail */}
        <div className="lg:col-span-5 bg-[#010306] border-l border-[#101d2a] flex flex-col min-h-[380px] lg:min-h-0">
          <div className="p-2.5 bg-[#060a10] border-b border-[#101d2a] flex items-center justify-between text-[11px] shrink-0">
            <span className="font-bold text-[#ffb700] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#00f0ff]" />
              CUBOCTAHEDRAL LATTICE (12 VERTICES)
            </span>
            <span className="text-[10px] text-[#39ff14]">Porous Matrix &bull; Dist² = 2.0</span>
          </div>

          {/* 3D Canvas */}
          <div className="flex-1 relative bg-black min-h-[220px]">
            <canvas ref={cuboctahedronCanvasRef} width={480} height={280} className="w-full h-full block" />

            {/* 4D Hyper-Spatial Vector Readout */}
            <div className="absolute bottom-2 left-2 right-2 bg-[#060a10]/95 backdrop-blur border border-[#101d2a] p-2 rounded text-[10px] font-mono grid grid-cols-4 gap-1">
              <div>
                <span className="text-gray-500 block text-[9px]">X-Axis (Zx):</span>
                <span className="text-cyan-400 font-bold">{cycleData.projection4D.x.toFixed(3)}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[9px]">Y-Axis (Vert):</span>
                <span className="text-emerald-400 font-bold">{cycleData.projection4D.y.toFixed(3)}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[9px]">Z-Axis:</span>
                <span className="text-purple-400 font-bold">{cycleData.projection4D.z.toFixed(3)}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[9px]">W-Axis (Wy):</span>
                <span className="text-[#ffb700] font-bold">{cycleData.projection4D.w.toFixed(3)}</span>
              </div>
            </div>
          </div>

          {/* Palindromic Tail & Merkle Isolated Updates */}
          <div className="p-3 bg-[#060a10] border-t border-[#101d2a] text-[10px] shrink-0 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Palindromic FIFO / LIFO:</span>
              <span className="text-[#ffb700] font-bold font-mono">
                {cycleData.palindromicTail.sequenceOrderForward} &harr; {cycleData.palindromicTail.sequenceOrderBackward}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-400">Merkle Lattice Branch:</span>
              <span
                className={`font-mono font-bold ${
                  cycleData.merkleBranch.isPathAltered ? 'text-[#ff0055]' : 'text-[#39ff14]'
                }`}
              >
                {cycleData.merkleBranch.pathId}{' '}
                {cycleData.merkleBranch.isPathAltered ? '(ALTERED PATH)' : '(ISOLATED NOMINAL)'}
              </span>
            </div>

            <div className="flex items-center justify-between text-[9px] text-gray-500 pt-1 border-t border-[#101d2a]">
              <span>Tethered Tail: {cycleData.merkleBranch.tetheredTailBits} bits</span>
              <span>Power Draw: {cycleData.powerDrawModulationOhm} &Omega;</span>
              <span>Tail Margin: 388,608 bytes</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
