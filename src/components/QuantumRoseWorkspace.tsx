import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Cpu,
  Download,
  Lock,
  Palette,
  Pause,
  Play,
  RefreshCw,
  Save,
  ShieldAlert,
  ShieldCheck,
  Sliders,
} from 'lucide-react';
import type {
  CircularProcessingTelemetry,
  GradientRenderSpec,
  HamiltonianSimulationSnapshot,
  PicBitwiseOperationReport,
  PicMaskKind,
  StrictGateEvaluationV7,
  V7AcceptanceSuiteReport,
} from '../contracts/v7-convergence';
import {
  buildProceduralGradient,
  evaluateWcagContrast,
  evaluateWavefunctionPolar,
  evolveHamiltonianSnapshot,
} from '../engine/quantumRoseGovernor';
import {
  buildPicCssClipMask,
  runPicRoundTripVerification,
  validatePicBufferBounds,
} from '../engine/picGeometryEngine';
import { globalCircularRuntime } from '../engine/circularProcessingRuntime';
import { globalHamiltonianClock } from '../engine/hamiltonianNeuralClock';

type RoseStudioSubTab = 'HAMILTONIAN' | 'COLOR_MANAGER' | 'PIC_GEOMETRY' | 'CIRCULAR_GATES';

export const QuantumRoseWorkspace: React.FC = () => {
  const [subTab, setSubTab] = useState<RoseStudioSubTab>('HAMILTONIAN');

  // Hamiltonian Controls
  const [eigenstatesCount, setEigenstatesCount] = useState<number>(6);
  const [coherence, setCoherence] = useState<number>(0.92);
  const [timeSpeed, setTimeSpeed] = useState<number>(0.9);
  const [perturbationPhase, setPerturbationPhase] = useState<number>(0.35);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [attemptVisualOverride, setAttemptVisualOverride] = useState<boolean>(false);

  // ColorManager Controls
  const [baseHue, setBaseHue] = useState<number>(194);
  const [chroma, setChroma] = useState<number>(0.21);
  const [lightness, setLightness] = useState<number>(0.72);
  const [gradientKind, setGradientKind] = useState<GradientRenderSpec['kind']>('PROCEDURAL_HAMILTONIAN');
  const [angleDeg, setAngleDeg] = useState<number>(135);
  const [fgHex, setFgHex] = useState<string>('#F1F5F9');
  const [bgHex, setBgHex] = useState<string>('#04070D');

  // PIC Bitwise Geometry Controls
  const [picWidth, setPicWidth] = useState<number>(128);
  const [picHeight, setPicHeight] = useState<number>(128);
  const [picMaskKind, setPicMaskKind] = useState<PicMaskKind>('polygon');
  const [picMorphT, setPicMorphT] = useState<number>(0.35);
  const [picReport, setPicReport] = useState<PicBitwiseOperationReport>(() => runPicRoundTripVerification(128, 128));

  // Circular & Verification States
  const [circularTelemetry, setCircularTelemetry] = useState<CircularProcessingTelemetry>(() =>
    globalCircularRuntime.getTelemetry()
  );
  const [v7Report, setV7Report] = useState<V7AcceptanceSuiteReport | null>(null);
  const [runningV7Suite, setRunningV7Suite] = useState<boolean>(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  // Snapshot state & canvases
  const simTimeRef = useRef<number>(0);
  const polarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [snapshot, setSnapshot] = useState<HamiltonianSimulationSnapshot>(() =>
    evolveHamiltonianSnapshot({
      eigenstatesCount: 6,
      simTime: 0,
      perturbationPhaseRad: 0.35,
      coherence: 0.92,
      baseHueDeg: 194,
    })
  );

  useEffect(() => {
    const unsub = globalCircularRuntime.subscribe((tel) => {
      setCircularTelemetry(tel);
    });
    return () => unsub();
  }, []);

  // Sync authoritative clock snapshot periodically
  useEffect(() => {
    const poll = () => {
      fetch('/api/v7/state')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.state?.clock) {
            globalHamiltonianClock.syncAuthoritativeServerTelemetry({
              epochId: d.state.clock.reading?.epochId,
              driftNs: d.state.clock.drift?.authoritativeServerDriftNs,
              receipt: d.state.clock.receipt,
            });
          }
        })
        .catch(() => {});
    };
    poll();
    const iv = setInterval(poll, 3000);
    return () => clearInterval(iv);
  }, []);

  // Dual Quantum Rose Canvas Loop (Polar Wavefield + Phase-Space Eigenstates)
  useEffect(() => {
    let raf = 0;
    let lastTs = performance.now();
    let lastUiPush = performance.now();

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;
      if (isPlaying) {
        simTimeRef.current += dt * timeSpeed;
      }

      const nextSnap = evolveHamiltonianSnapshot({
        eigenstatesCount,
        simTime: simTimeRef.current,
        perturbationPhaseRad: perturbationPhase,
        coherence,
        baseHueDeg: baseHue,
        visualOverrideAttempted: attemptVisualOverride,
      });

      const polar = polarCanvasRef.current;
      if (polar) {
        const ctx = polar.getContext('2d');
        if (ctx) {
          const w = polar.width;
          const h = polar.height;
          const cx = w / 2;
          const cy = h / 2;
          const radius = Math.min(w, h) * 0.43;

          ctx.fillStyle = '#04070D';
          ctx.fillRect(0, 0, w, h);

          // Calibrated polar axes
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
          ctx.lineWidth = 1;
          for (const f of [0.25, 0.5, 0.75, 1]) {
            ctx.beginPath();
            ctx.arc(cx, cy, radius * f, 0, Math.PI * 2);
            ctx.stroke();
          }

          const rings = 26;
          const sectors = 96;
          for (let ri = 1; ri <= rings; ri++) {
            const rNorm = ri / rings;
            const ringPx = rNorm * radius;
            ctx.beginPath();
            for (let si = 0; si <= sectors; si++) {
              const theta = (si / sectors) * Math.PI * 2;
              const psi = evaluateWavefunctionPolar(rNorm, theta, nextSnap.eigenstates, coherence);
              const modR = ringPx * (0.7 + Math.min(0.62, psi.probDensity * 1.1));
              const x = cx + Math.cos(theta) * modR;
              const y = cy + Math.sin(theta) * modR;
              if (si === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.closePath();
            const hue = (baseHue + rNorm * 130 + simTimeRef.current * 14) % 360;
            ctx.strokeStyle = `hsla(${hue}, 82%, 62%, ${(0.18 + (1 - rNorm) * 0.55).toFixed(2)})`;
            ctx.lineWidth = ri % 4 === 0 ? 1.6 : 0.9;
            ctx.stroke();
          }
        }
      }

      const phaseCanvas = phaseCanvasRef.current;
      if (phaseCanvas) {
        const ctx = phaseCanvas.getContext('2d');
        if (ctx) {
          const w = phaseCanvas.width;
          const h = phaseCanvas.height;
          const cx = w / 2;
          const cy = h / 2;
          const R = Math.min(w, h) * 0.4;

          ctx.fillStyle = '#04070D';
          ctx.fillRect(0, 0, w, h);

          ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cx - R, cy);
          ctx.lineTo(cx + R, cy);
          ctx.moveTo(cx, cy - R);
          ctx.lineTo(cx, cy + R);
          ctx.arc(cx, cy, R, 0, Math.PI * 2);
          ctx.stroke();

          nextSnap.eigenstates.forEach((st, idx) => {
            const scale = R * 1.7;
            const px = cx + st.currentRe * scale;
            const py = cy - st.currentIm * scale;
            const hue = (baseHue + idx * 32) % 360;
            ctx.strokeStyle = `hsl(${hue}, 84%, 64%)`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(px, py);
            ctx.stroke();

            ctx.fillStyle = `hsl(${hue}, 90%, 70%)`;
            ctx.beginPath();
            ctx.arc(px, py, 4 + st.probability * 10, 0, Math.PI * 2);
            ctx.fill();
          });
        }
      }

      if (now - lastUiPush > 150) {
        lastUiPush = now;
        setSnapshot(nextSnap);
      }
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [eigenstatesCount, coherence, timeSpeed, perturbationPhase, isPlaying, baseHue, attemptVisualOverride]);

  const gradientSpec = buildProceduralGradient({
    kind: gradientKind,
    baseHueDeg: baseHue,
    chroma,
    lightness,
    angleDeg,
    stopsCount: 5,
  });
  const wcagAudit = evaluateWcagContrast(fgHex, bgHex);
  const clipMask = buildPicCssClipMask(picMaskKind, picMorphT);
  const clockReading = globalHamiltonianClock.read();
  const clockPhase = globalHamiltonianClock.getPhase();
  const clockDrift = globalHamiltonianClock.getDrift();

  const handleSaveRoseSnapshot = async () => {
    setSaveNotice(null);
    try {
      const pngDataUrl = polarCanvasRef.current?.toDataURL('image/png');
      const res = await fetch('/api/memory/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-cryptic-role': 'ADMINISTRATOR' },
        body: JSON.stringify({
          userConsent: true,
          eventType: 'V7_HAMILTONIAN_CHECKPOINT',
          source: 'quantum_rose_governor_v7',
          project: 'GAIA-NEXUS-V7',
          tags: ['hamiltonian', 'quantum_rose_v7', gradientSpec.paletteHash],
          payload: JSON.stringify({
            snapshot: {
              simTime: snapshot.simTime,
              normSum: snapshot.normSum,
              normDrift: snapshot.normDrift,
              expectationEnergy: snapshot.expectationEnergy,
              paletteHash: gradientSpec.paletteHash,
              gateA: snapshot.gateEvaluation.decision,
            },
            hasPngPreview: Boolean(pngDataUrl),
          }),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSaveNotice(`Persisted to SQLite Save_Memory seq #${data.event.sequence} (${data.receiptR.ID})`);
      } else {
        setSaveNotice(`Gate A withheld commit: ${data.error}`);
      }
    } catch (err: any) {
      setSaveNotice(`Save error: ${err.message}`);
    }
  };

  const handleExportColorBundle = () => {
    const payload = {
      spec: 'GAIA.NEXUS.HCCGN.QUANTUM-ROSE.V7',
      colorPipeline: gradientSpec,
      wcagAudit,
      exportedAtUtc: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quantum-rose-color-${gradientSpec.paletteHash}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPng = () => {
    const canvas = polarCanvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `quantum-rose-v7-${Date.now()}.png`;
    a.click();
  };

  const handleRunV7Acceptance = async () => {
    setRunningV7Suite(true);
    try {
      const res = await fetch('/api/v7/acceptance/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-cryptic-role': 'ADMINISTRATOR' },
      });
      const data = await res.json();
      if (data.ok && data.report) {
        setV7Report(data.report);
      }
    } finally {
      setRunningV7Suite(false);
    }
  };

  const renderGateBadge = (gate: StrictGateEvaluationV7) => (
    <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono tabular-nums">
      <span className={`px-2 py-0.5 border ${gate.B_boundary.satisfied ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-rose-500/40 bg-rose-500/10 text-rose-300'}`}>
        B:{gate.B_boundary.status}
      </span>
      <span className={`px-2 py-0.5 border ${gate.C_capacity.satisfied ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-rose-500/40 bg-rose-500/10 text-rose-300'}`}>
        C:{gate.C_capacity.status}
      </span>
      <span className={`px-2 py-0.5 border ${gate.V_verification.satisfied ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-rose-500/40 bg-rose-500/10 text-rose-300'}`}>
        V:{gate.V_verification.status}
      </span>
      <span className={`px-2 py-0.5 border font-bold ${gate.A_authorized ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-200' : 'border-rose-500/60 bg-rose-950/60 text-rose-300'}`}>
        A = {gate.decision}
      </span>
    </div>
  );

  return (
    <div className="w-full h-full flex flex-col bg-[#04070D]/80 backdrop-blur-sm text-slate-100 font-mono overflow-y-auto">
      {/* Top V7 Sub-Navigation & Strict Gate A Header */}
      <div className="px-4 py-2.5 border-b border-slate-800 bg-[#080D16]/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'HAMILTONIAN', label: 'Quantum Rose (Ψ) & Phase Space', icon: Activity },
              { id: 'COLOR_MANAGER', label: 'ColorManager (OKLCH / P3 / WCAG)', icon: Palette },
              { id: 'PIC_GEOMETRY', label: 'PIC Bitwise & clip-path Studio', icon: Sliders },
              { id: 'CIRCULAR_GATES', label: 'Circular Runtime & V7 Verify (9 Gates)', icon: ShieldCheck },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = subTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSubTab(item.id)}
                className={`px-3 py-1.5 text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
                  active
                    ? 'bg-cyan-500/15 border-cyan-400/60 text-cyan-200'
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {renderGateBadge(snapshot.gateEvaluation)}
      </div>

      {/* Sub-Tab 1: Quantum Rose Hamiltonian + Phase Space */}
      {subTab === 'HAMILTONIAN' && (
        <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
          <div className="lg:col-span-4 bg-[#080D16]/90 border border-slate-800 p-4 space-y-4">
            <div className="border-b border-slate-800 pb-2">
              <div className="text-[10px] uppercase tracking-wider text-cyan-400">
                MATHEMATICAL SIMULATION &bull; NOT PHYSICAL QUANTUM HW
              </div>
              <h3 className="text-sm font-bold text-white mt-0.5">
                Hamiltonian Visual Governor |&psi;(t)&rang; = e^(-iHt/&hbar;)|&psi;(0)&rang;
              </h3>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between mb-1 tabular-nums">
                  <span className="text-slate-300">Eigenstates N</span>
                  <span className="text-cyan-300 font-semibold">{eigenstatesCount}</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={14}
                  value={eigenstatesCount}
                  onChange={(e) => setEigenstatesCount(Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1 tabular-nums">
                  <span className="text-slate-300">Phase Coherence</span>
                  <span className="text-cyan-300 font-semibold">{coherence.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.01}
                  value={coherence}
                  onChange={(e) => setCoherence(Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1 tabular-nums">
                  <span className="text-slate-300">Evolution Speed</span>
                  <span className="text-cyan-300 font-semibold">{timeSpeed.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={3}
                  step={0.1}
                  value={timeSpeed}
                  onChange={(e) => setTimeSpeed(Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1 tabular-nums">
                  <span className="text-slate-300">Perturbation Phase &phi;0</span>
                  <span className="text-cyan-300 font-semibold">{perturbationPhase.toFixed(2)} rad</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={6.28}
                  step={0.05}
                  value={perturbationPhase}
                  onChange={(e) => setPerturbationPhase(Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>
            </div>

            {/* Unitary & Clock Readout */}
            <div className="bg-slate-950/80 border border-slate-800 p-3 space-y-1.5 text-[11px] tabular-nums">
              <div className="flex justify-between">
                <span className="text-slate-400">Sim Time t:</span>
                <span className="text-white">{snapshot.simTime.toFixed(3)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Norm Conservation &Sigma;|c_n|&sup2;:</span>
                <span className={snapshot.normConserved ? 'text-emerald-400' : 'text-rose-400'}>
                  {snapshot.normSum.toFixed(6)} (&Delta;={snapshot.normDrift})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Expectation &lang;H&rang;:</span>
                <span className="text-amber-300">{snapshot.expectationEnergy.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Virtual Phase:</span>
                <span className="text-cyan-300 truncate max-w-[180px]">{clockPhase.virtualPicosecondPhase}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Clock Domain:</span>
                <span className="text-slate-300">{clockReading.clockDomain}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setIsPlaying((p) => !p)}
                className="px-3 py-1.5 bg-slate-900 border border-slate-700 hover:border-cyan-400 text-xs flex items-center gap-1.5"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? 'Pause' : 'Resume'}</span>
              </button>
              <button
                onClick={handleSaveRoseSnapshot}
                className="px-3 py-1.5 bg-cyan-600/20 border border-cyan-500/50 hover:bg-cyan-600/30 text-cyan-200 text-xs flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save_Memory</span>
              </button>
              <button
                onClick={handleExportPng}
                className="px-3 py-1.5 bg-slate-900 border border-slate-700 hover:border-emerald-400 text-emerald-300 text-xs flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>PNG</span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-800 space-y-2">
              <button
                onClick={() => setAttemptVisualOverride((v) => !v)}
                className={`w-full px-3 py-1.5 border text-[11px] flex items-center justify-center gap-1.5 ${
                  attemptVisualOverride
                    ? 'border-amber-500/60 bg-amber-500/15 text-amber-300'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-amber-400'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>
                  {attemptVisualOverride
                    ? 'Visual Override Rejected (A = B && C && V Intact)'
                    : 'Test Visual Override Immunity'}
                </span>
              </button>
              {saveNotice && (
                <div className="text-[11px] p-2 bg-emerald-950/50 border border-emerald-500/40 text-emerald-300">
                  {saveNotice}
                </div>
              )}
            </div>
          </div>

          {/* Right Dual Viewports: Polar Wavefield & Complex Phase Space */}
          <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#080D16]/90 border border-slate-800 p-3 flex flex-col">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800 mb-2">
                <span className="font-bold text-cyan-300">Polar Probability Density |&psi;(r,&theta;,t)|&sup2;</span>
                <span className="text-[10px] text-slate-400">DETERMINISTICALLY_DERIVED</span>
              </div>
              <canvas
                ref={polarCanvasRef}
                width={420}
                height={360}
                className="w-full h-[320px] bg-[#04070D] border border-slate-800 cursor-crosshair"
              />
            </div>

            <div className="bg-[#080D16]/90 border border-slate-800 p-3 flex flex-col">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800 mb-2">
                <span className="font-bold text-indigo-300">Complex Phase-Space c_n(t)</span>
                <span className="text-[10px] text-slate-400">Re / Im Argand Plane</span>
              </div>
              <canvas
                ref={phaseCanvasRef}
                width={420}
                height={360}
                className="w-full h-[320px] bg-[#04070D] border border-slate-800"
              />
            </div>

            {/* Eigenstate Table */}
            <div className="md:col-span-2 bg-[#080D16]/90 border border-slate-800 p-3">
              <div className="text-xs font-bold text-white mb-2">
                Live Eigenstate Register (Unitary Amplitudes &amp; Energies)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] tabular-nums">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-800 text-left">
                      <th className="py-1.5 px-2">Mode (n, m)</th>
                      <th className="py-1.5 px-2">Energy E_n</th>
                      <th className="py-1.5 px-2">Re(c_n)</th>
                      <th className="py-1.5 px-2">Im(c_n)</th>
                      <th className="py-1.5 px-2">Prob |c_n|&sup2;</th>
                      <th className="py-1.5 px-2">Phase (rad)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.eigenstates.map((st) => (
                      <tr key={st.n} className="border-b border-slate-900 text-slate-200">
                        <td className="py-1 px-2 text-cyan-300">
                          n={st.n}, m={st.m}
                        </td>
                        <td className="py-1 px-2">{st.energy.toFixed(4)}</td>
                        <td className="py-1 px-2">{st.currentRe.toFixed(5)}</td>
                        <td className="py-1 px-2">{st.currentIm.toFixed(5)}</td>
                        <td className="py-1 px-2 text-emerald-300">{st.probability.toFixed(5)}</td>
                        <td className="py-1 px-2">{st.phaseRad.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 2: ColorManager -> GradientEngine -> Display-P3 & WCAG */}
      {subTab === 'COLOR_MANAGER' && (
        <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 bg-[#080D16]/90 border border-slate-800 p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white">
                ColorManager &rarr; GradientEngine (OKLCH + Display-P3)
              </h3>
              <span className="text-[10px] px-2 py-0.5 border border-cyan-500/40 bg-cyan-500/10 text-cyan-300">
                {gradientSpec.prefersDisplayP3 ? 'Display-P3 Supported' : 'sRGB Default + P3 Emit'}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between mb-1 tabular-nums">
                  <span>Base OKLCH Hue</span>
                  <span className="text-cyan-300">{baseHue}&deg;</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={baseHue}
                  onChange={(e) => setBaseHue(Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1 tabular-nums">
                  <span>OKLCH Chroma C</span>
                  <span className="text-cyan-300">{chroma.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.02}
                  max={0.32}
                  step={0.01}
                  value={chroma}
                  onChange={(e) => setChroma(Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1 tabular-nums">
                  <span>OKLCH Lightness L</span>
                  <span className="text-cyan-300">{(lightness * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min={0.35}
                  max={0.88}
                  step={0.01}
                  value={lightness}
                  onChange={(e) => setLightness(Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {(['LINEAR', 'RADIAL', 'CONIC', 'PROCEDURAL_HAMILTONIAN'] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setGradientKind(k)}
                    className={`px-2 py-1.5 text-[11px] border ${
                      gradientKind === k
                        ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200'
                        : 'border-slate-800 bg-slate-950 text-slate-400'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>

              <div>
                <div className="flex justify-between mb-1 tabular-nums">
                  <span>Gradient Angle</span>
                  <span className="text-cyan-300">{angleDeg}&deg;</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={angleDeg}
                  onChange={(e) => setAngleDeg(Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>
            </div>

            <div className="border-t border-slate-800 pt-3 space-y-2 text-xs">
              <div className="font-bold text-slate-200">WCAG 2.1 Contrast Verifier</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-[10px] text-slate-400 block">Foreground Hex</span>
                  <input
                    type="text"
                    value={fgHex}
                    onChange={(e) => setFgHex(e.target.value)}
                    className="w-full px-2 py-1 bg-slate-950 border border-slate-700 text-slate-100"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] text-slate-400 block">Background Hex</span>
                  <input
                    type="text"
                    value={bgHex}
                    onChange={(e) => setBgHex(e.target.value)}
                    className="w-full px-2 py-1 bg-slate-950 border border-slate-700 text-slate-100"
                  />
                </label>
              </div>
              <div className="p-2.5 bg-slate-950 border border-slate-800 flex items-center justify-between tabular-nums">
                <span>Contrast Ratio: {wcagAudit.contrastRatio}:1</span>
                <span className={wcagAudit.aaNormal ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {wcagAudit.statusLabel} (AA:{wcagAudit.aaNormal ? 'PASS' : 'FAIL'})
                </span>
              </div>
            </div>

            <button
              onClick={handleExportColorBundle}
              className="w-full py-2 bg-cyan-600/20 border border-cyan-500/50 hover:bg-cyan-600/30 text-cyan-200 text-xs flex items-center justify-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Color &amp; Gamut Snapshot JSON ({gradientSpec.paletteHash})</span>
            </button>
          </div>

          <div className="lg:col-span-7 space-y-4">
            <div className="bg-[#080D16]/90 border border-slate-800 p-4 space-y-3">
              <div className="text-xs font-bold text-white">Live Procedural Gradient Preview</div>
              <div
                className="w-full h-44 border border-slate-700"
                style={{
                  background: gradientSpec.prefersDisplayP3 ? gradientSpec.cssDisplayP3 : gradientSpec.cssSrgb,
                }}
              />
              <div className="text-[11px] bg-slate-950 border border-slate-800 p-2.5 space-y-1 break-all">
                <div className="text-slate-400">CSS sRGB: <span className="text-slate-200">{gradientSpec.cssSrgb}</span></div>
                <div className="text-slate-400">CSS OKLCH: <span className="text-cyan-300">{gradientSpec.cssOklch}</span></div>
                <div className="text-slate-400">CSS Display-P3: <span className="text-emerald-300">{gradientSpec.cssDisplayP3}</span></div>
              </div>
            </div>

            <div className="bg-[#080D16]/90 border border-slate-800 p-4">
              <div className="text-xs font-bold text-white mb-2">Perceptual Color Stops &amp; Gamut Boundaries</div>
              <div className="space-y-2 text-[11px] tabular-nums">
                {gradientSpec.stops.map((stop, idx) => (
                  <div key={idx} className="p-2 bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-5 h-5 border border-white/20 shrink-0"
                        style={{ backgroundColor: stop.srgbHex }}
                      />
                      <span className="text-white font-bold">{stop.srgbHex}</span>
                      <span className="text-slate-400">@ {(stop.position * 100).toFixed(0)}%</span>
                    </div>
                    <span className="text-cyan-300">{stop.cssOklch}</span>
                    <span className={stop.inSrgbGamut ? 'text-emerald-400' : 'text-amber-300'}>
                      sRGB:{stop.inSrgbGamut ? 'IN' : 'CLIP'} | P3:{stop.inDisplayP3Gamut ? 'IN' : 'CLIP'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 3: PIC Bitwise Geometry Engine & CSS clip-path Mask Lab */}
      {subTab === 'PIC_GEOMETRY' && (
        <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 bg-[#080D16]/90 border border-slate-800 p-4 space-y-4">
            <div className="border-b border-slate-800 pb-2">
              <div className="text-[10px] text-cyan-400 uppercase">PIC DESIGNATION RETAINED VERBATIM</div>
              <h3 className="text-sm font-bold text-white">
                PIC Integer Pixel-Plane &amp; Bitwise Geometry Engine
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <label className="space-y-1">
                <span className="text-slate-400 block">Width (max 2048)</span>
                <input
                  type="number"
                  value={picWidth}
                  onChange={(e) => setPicWidth(Number(e.target.value))}
                  className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 text-white tabular-nums"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-400 block">Height (max 2048)</span>
                <input
                  type="number"
                  value={picHeight}
                  onChange={(e) => setPicHeight(Number(e.target.value))}
                  className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 text-white tabular-nums"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setPicReport(runPicRoundTripVerification(picWidth, picHeight))}
                className="px-3 py-1.5 bg-cyan-600/20 border border-cyan-500/50 hover:bg-cyan-600/30 text-cyan-200 text-xs font-semibold"
              >
                Run Bitwise Round-Trip Check
              </button>
              <button
                onClick={() => setPicReport(runPicRoundTripVerification(4096, 4096))}
                className="px-3 py-1.5 bg-rose-950/60 border border-rose-500/40 hover:bg-rose-900/50 text-rose-200 text-xs"
              >
                Test Out-of-Bounds (4096&times;4096)
              </button>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 space-y-1.5 text-[11px] tabular-nums">
              <div className="flex justify-between">
                <span className="text-slate-400">Bounds Status:</span>
                <span className={picReport.bounds.withinBounds ? 'text-emerald-400' : 'text-rose-400'}>
                  {picReport.bounds.withinBounds ? 'WITHIN_CAPS' : 'REJECTED_SAFE'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Input Buffer CRC:</span>
                <span className="text-white">{picReport.inputChecksumHex}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">XOR+Rotate CRC:</span>
                <span className="text-cyan-300">{picReport.transformedChecksumHex}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Restored Buffer CRC:</span>
                <span className="text-emerald-300">{picReport.restoredChecksumHex ?? 'NULL'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Exact Round-Trip / G-Channel:</span>
                <span className={picReport.roundTripExactMatch ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {String(picReport.roundTripExactMatch)} / {String(picReport.channelPreserved)}
                </span>
              </div>
              <div className="pt-1 border-t border-slate-800">
                {renderGateBadge(picReport.gateEvaluation)}
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 bg-[#080D16]/90 border border-slate-800 p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white">CSS clip-path Geometric Mask Compositor</h3>
              <span className="text-[10px] text-amber-300 border border-amber-500/30 bg-amber-500/10 px-2 py-0.5">
                VIEWPORT MASK ONLY &ne; PIXEL BUFFER TRANSFORM
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(['polygon', 'circle', 'ellipse', 'inset', 'path'] as const).map((kind) => (
                <button
                  key={kind}
                  onClick={() => setPicMaskKind(kind)}
                  className={`px-3 py-1 text-xs border ${
                    picMaskKind === kind
                      ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200'
                      : 'border-slate-800 bg-slate-950 text-slate-400'
                  }`}
                >
                  {kind}
                </button>
              ))}
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1 tabular-nums">
                <span className="text-slate-300">Animated Mask Morph Factor t</span>
                <span className="text-cyan-300">{picMorphT.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={picMorphT}
                onChange={(e) => setPicMorphT(Number(e.target.value))}
                className="w-full accent-cyan-400"
              />
            </div>

            <div className="h-56 bg-slate-950 border border-slate-800 flex items-center justify-center p-4">
              <div
                className="w-64 h-44 transition-all duration-150 flex items-center justify-center text-xs font-bold text-white shadow-inner"
                style={{
                  clipPath: clipMask.cssClipPath,
                  background: gradientSpec.prefersDisplayP3 ? gradientSpec.cssDisplayP3 : gradientSpec.cssSrgb,
                }}
              >
                <span className="bg-slate-950/75 px-2.5 py-1 border border-white/20">
                  PIC MASK: {clipMask.kind.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="p-2.5 bg-slate-950 border border-slate-800 text-[11px] text-cyan-300 break-all">
              clip-path: {clipMask.cssClipPath};
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 4: Bounded Circular Runtime (1Hz / 10ms) & Full 9-Gate V7 Verification Suite */}
      {subTab === 'CIRCULAR_GATES' && (
        <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 bg-[#080D16]/90 border border-slate-800 p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <span>Circular Data Processing Loop (1 Hz / 10 ms Cap)</span>
              </h3>
              <span className="text-[10px] px-2 py-0.5 border border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
                {circularTelemetry.state}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] tabular-nums">
              <div className="p-2 bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block">Ticks / Checkpoints</span>
                <span className="text-white font-bold">
                  {circularTelemetry.tickCount} / {circularTelemetry.checkpointCount}
                </span>
              </div>
              <div className="p-2 bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block">Last Slice / Max</span>
                <span className="text-cyan-300 font-bold">
                  {circularTelemetry.lastSliceDurationMs}ms / {circularTelemetry.maxSliceObservedMs}ms
                </span>
              </div>
              <div className="p-2 bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block">Visibility / Battery</span>
                <span className="text-slate-200 font-bold">
                  {circularTelemetry.visibilityState} /{' '}
                  {circularTelemetry.batteryApiAvailable && circularTelemetry.batteryLevel !== null
                    ? `${Math.round(circularTelemetry.batteryLevel * 100)}%`
                    : 'N/A'}
                </span>
              </div>
              <div className="p-2 bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block">Backpressure Drops / Errors</span>
                <span className="text-amber-300 font-bold">
                  {circularTelemetry.backpressureDrops} / {circularTelemetry.recoveredErrors}
                </span>
              </div>
            </div>

            <div className="text-[11px] p-2 bg-slate-950 border border-slate-800 text-slate-400 space-y-1">
              <div>Clock Drift (Local / Server): {clockDrift.localSchedulingDriftNs}ns / {clockDrift.authoritativeServerDriftNs}ns</div>
              <div>Last SQLite Checkpoint ID: {circularTelemetry.lastCheckpointEventId ?? 'Pending first 15-tick cycle'}</div>
              <div className="text-[10px] text-amber-300/90">
                Notice: {circularTelemetry.suspensionDisclaimer}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <button
                onClick={() =>
                  circularTelemetry.state === 'RUNNING'
                    ? globalCircularRuntime.pause()
                    : globalCircularRuntime.resume()
                }
                className="px-3 py-1.5 bg-slate-900 border border-slate-700 hover:border-cyan-400"
              >
                {circularTelemetry.state === 'RUNNING' ? 'Pause Loop' : 'Resume Loop'}
              </button>
              <button
                onClick={() => globalCircularRuntime.executeBoundedSlice()}
                className="px-3 py-1.5 bg-slate-900 border border-slate-700 hover:border-emerald-400 text-emerald-300"
              >
                Single Step
              </button>
              <button
                onClick={() => globalCircularRuntime.persistCheckpoint(true)}
                className="px-3 py-1.5 bg-cyan-600/20 border border-cyan-500/50 text-cyan-200"
              >
                Checkpoint Now
              </button>
              <button
                onClick={() => globalCircularRuntime.cancel()}
                className="px-3 py-1.5 bg-rose-950/60 border border-rose-500/40 text-rose-200"
              >
                Cancel
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 bg-[#080D16]/90 border border-slate-800 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <div>
                <h3 className="text-sm font-bold text-white">
                  V7.0.0 Convergence Verification Suite (9 End-to-End Gates)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Verifies Gate A, Hamiltonian Norm, ColorManager, PIC Round-Trip, Clock, Grimoire, SQLite Chain &amp; Circular Checkpoints
                </p>
              </div>
              <button
                onClick={handleRunV7Acceptance}
                disabled={runningV7Suite}
                className="px-3.5 py-1.5 bg-emerald-600/20 border border-emerald-500/50 hover:bg-emerald-600/30 text-emerald-200 text-xs font-semibold flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${runningV7Suite ? 'animate-spin' : ''}`} />
                <span>{runningV7Suite ? 'Executing 9 Gates...' : 'Run V7 Verification Suite'}</span>
              </button>
            </div>

            {!v7Report ? (
              <div className="p-6 text-center bg-slate-950 border border-slate-800 text-xs text-slate-400">
                Click <strong>Run V7 Verification Suite</strong> to execute all 9 live V7 assertions against SQLite WAL, Save_Memory, PIC, ColorManager, and UniversalClockKernel.
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="p-2.5 bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
                  <span className={v7Report.allPassed ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                    {v7Report.passedCount}/{v7Report.totalCount} GATES PASSED ({v7Report.durationMs}ms)
                  </span>
                  <span className="text-cyan-300 text-[11px]">
                    Receipt R: {v7Report.receiptR.ID} (A={String(v7Report.receiptR.A)})
                  </span>
                </div>

                <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
                  {v7Report.gates.map((g) => (
                    <div key={g.gateId} className="p-2.5 bg-slate-950 border border-slate-800 text-[11px] space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          {g.passed ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                          )}
                          <span>
                            {g.gateId} &bull; {g.title}
                          </span>
                        </span>
                        <span className={g.passed ? 'text-emerald-400' : 'text-rose-400'}>
                          {g.passed ? 'PASS' : 'FAIL'}
                        </span>
                      </div>
                      <div className="text-cyan-300 tabular-nums">Measured: {g.measuredValue}</div>
                      <div className="text-slate-400">{g.detail}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
