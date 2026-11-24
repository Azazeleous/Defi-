import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Save, RotateCcw, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import type { MemorySaveReceipt, GaiaMemoryEventRecord, QuantumRoseSnapshotPayload } from '../contracts/gaia-v61';
import type { RbacRole } from '../contracts/cryptic-platform';

interface Props {
  actorRole?: RbacRole;
  onSnapshotSaved?: (receipt: MemorySaveReceipt) => void;
}

interface EigenMode {
  n: number;
  m: number;
  amplitude: number;
  phaseRad: number;
  energy: number;
}

function buildModes(count: number, perturbationPhase: number): EigenMode[] {
  const modes: EigenMode[] = [];
  for (let i = 0; i < count; i++) {
    const n = i + 1;
    const m = i % 2 === 0 ? n : -n;
    const amplitude = +(1 / Math.sqrt(count) * (1 - i * 0.03)).toFixed(4);
    const phaseRad = +((i * 0.85 + perturbationPhase) % (Math.PI * 2)).toFixed(4);
    const energy = +(0.5 * (n * n) * 0.42).toFixed(4);
    modes.push({ n, m, amplitude, phaseRad, energy });
  }
  return modes;
}

function evaluatePsi(
  r: number,
  theta: number,
  t: number,
  modes: readonly EigenMode[],
  coherence: number
): { real: number; imag: number; probDensity: number; phase: number } {
  let real = 0;
  let imag = 0;
  const radialEnv = Math.exp(-2.2 * r * r);
  for (let i = 0; i < modes.length; i++) {
    const mode = modes[i];
    const k = (mode.n + 1) * Math.PI * 0.65;
    const radialBasis = radialEnv * Math.cos(k * r) + 0.35 * Math.sin((mode.n + 0.5) * r * Math.PI) * (1 - r);
    const angularArg = mode.m * theta + mode.phaseRad - mode.energy * t;
    const weight = mode.amplitude * (i === 0 ? 1.0 : coherence);
    real += weight * radialBasis * Math.cos(angularArg);
    imag += weight * radialBasis * Math.sin(angularArg);
  }
  const probDensity = real * real + imag * imag;
  const phase = Math.atan2(imag, real);
  return { real, imag, probDensity, phase };
}

export const QuantumRoseCanvas: React.FC<Props> = ({ actorRole = 'ADMINISTRATOR', onSnapshotSaved }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [eigenstatesCount, setEigenstatesCount] = useState<number>(6);
  const [coherence, setCoherence] = useState<number>(0.92);
  const [timeSpeed, setTimeSpeed] = useState<number>(0.9);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [perturbationPhase, setPerturbationPhase] = useState<number>(0.0);
  const [simTime, setSimTime] = useState<number>(0.0);
  const [probePoint, setProbePoint] = useState<{ r: number; theta: number; prob: number; phase: number }>({
    r: 0.42,
    theta: 0.78,
    prob: 0,
    phase: 0,
  });

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveReceipt, setSaveReceipt] = useState<MemorySaveReceipt | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedSnapshots, setSavedSnapshots] = useState<GaiaMemoryEventRecord[]>([]);

  const simTimeRef = useRef<number>(0.0);
  const modes = buildModes(eigenstatesCount, perturbationPhase);

  const loadSavedSnapshots = async () => {
    try {
      const res = await fetch('/api/memory?eventType=QUANTUM_ROSE_SNAPSHOT&limit=10');
      const data = await res.json();
      if (data.ok && Array.isArray(data.events)) {
        setSavedSnapshots(data.events);
      }
    } catch {
      // Ignore transient load error
    }
  };

  useEffect(() => {
    loadSavedSnapshots();
  }, []);

  // Animation loop — strictly renders canvas; never persists state during animation frames
  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();
    let lastUiSync = performance.now();

    const renderFrame = (now: number) => {
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;
      if (isPlaying) {
        simTimeRef.current += dt * timeSpeed;
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          const cx = w / 2;
          const cy = h / 2;
          const radius = Math.min(w, h) * 0.44;
          const t = simTimeRef.current;
          const currentModes = buildModes(eigenstatesCount, perturbationPhase);

          ctx.fillStyle = '#04070C';
          ctx.fillRect(0, 0, w, h);

          // Polar reference grid
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
          ctx.lineWidth = 1;
          for (const frac of [0.25, 0.5, 0.75, 1.0]) {
            ctx.beginPath();
            ctx.arc(cx, cy, radius * frac, 0, Math.PI * 2);
            ctx.stroke();
          }
          for (let a = 0; a < 8; a++) {
            const ang = (a / 8) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(ang) * radius, cy + Math.sin(ang) * radius);
            ctx.stroke();
          }

          // Wavefunction polar rose probability density field
          const rings = 34;
          const sectors = 128;
          for (let ri = 1; ri <= rings; ri++) {
            const rNorm = ri / rings;
            const ringPx = rNorm * radius;
            ctx.beginPath();
            for (let si = 0; si <= sectors; si++) {
              const theta = (si / sectors) * Math.PI * 2;
              const psi = evaluatePsi(rNorm, theta, t, currentModes, coherence);
              const radialMod = ringPx * (0.72 + Math.min(0.65, psi.probDensity * 0.85));
              const x = cx + Math.cos(theta) * radialMod;
              const y = cy + Math.sin(theta) * radialMod;
              if (si === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.closePath();
            const samplePsi = evaluatePsi(rNorm, t * 0.25, t, currentModes, coherence);
            const hue = ((samplePsi.phase + Math.PI) / (Math.PI * 2)) * 220 + 160;
            const alpha = Math.max(0.08, Math.min(0.85, 0.18 + (1 - rNorm) * 0.55));
            ctx.strokeStyle = `hsla(${hue % 360}, 85%, 62%, ${alpha})`;
            ctx.lineWidth = ri % 5 === 0 ? 1.8 : 1.0;
            ctx.stroke();
          }

          // Outer complex phase interference envelope
          ctx.beginPath();
          for (let si = 0; si <= 256; si++) {
            const theta = (si / 256) * Math.PI * 2;
            const psi = evaluatePsi(0.5, theta, t, currentModes, coherence);
            const rMod = radius * (0.35 + Math.min(0.68, Math.sqrt(psi.probDensity) * 0.9));
            const x = cx + Math.cos(theta) * rMod;
            const y = cy + Math.sin(theta) * rMod;
            if (si === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Cursor probe reticle
          const prPx = probePoint.r * radius;
          const px = cx + Math.cos(probePoint.theta) * prPx;
          const py = cy + Math.sin(probePoint.theta) * prPx;
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(px, py, 6, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      if (now - lastUiSync > 120) {
        lastUiSync = now;
        const currentModes = buildModes(eigenstatesCount, perturbationPhase);
        const sampled = evaluatePsi(probePoint.r, probePoint.theta, simTimeRef.current, currentModes, coherence);
        setSimTime(+simTimeRef.current.toFixed(3));
        setProbePoint((prev) => ({
          ...prev,
          prob: +sampled.probDensity.toFixed(5),
          phase: +sampled.phase.toFixed(4),
        }));
      }

      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafId);
  }, [eigenstatesCount, coherence, timeSpeed, isPlaying, perturbationPhase, probePoint.r, probePoint.theta]);

  const handleCanvasPointer = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.44;
    const dx = x - cx;
    const dy = y - cy;
    const rNorm = Math.max(0.05, Math.min(0.98, Math.sqrt(dx * dx + dy * dy) / radius));
    const theta = Math.atan2(dy, dx);
    setPerturbationPhase(+((theta + Math.PI) * 0.5).toFixed(4));
    const sampled = evaluatePsi(rNorm, theta, simTimeRef.current, modes, coherence);
    setProbePoint({
      r: +rNorm.toFixed(3),
      theta: +theta.toFixed(4),
      prob: +sampled.probDensity.toFixed(5),
      phase: +sampled.phase.toFixed(4),
    });
  };

  // Explicit user-triggered snapshot persistence through Save_Memory.saveMemory
  const handleSaveSnapshot = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveReceipt(null);
    try {
      const payloadObj: QuantumRoseSnapshotPayload = {
        modelVersion: 'quantum-rose.numerical.v1',
        disclaimer: 'INTERACTIVE_NUMERICAL_VISUALIZATION_NOT_PHYSICAL_QUANTUM_HARDWARE',
        eigenstatesCount,
        coherence,
        timeSpeed,
        simulationTime: +simTimeRef.current.toFixed(4),
        amplitudes: modes.map((m) => ({
          re: +(m.amplitude * Math.cos(m.phaseRad)).toFixed(4),
          im: +(m.amplitude * Math.sin(m.phaseRad)).toFixed(4),
          energy: m.energy,
        })),
        phaseRad: perturbationPhase,
        canvasConfig: {
          width: 640,
          height: 460,
          palette: 'obsidian-cyan-amber',
        },
        probeCoordinate: {
          r: probePoint.r,
          theta: probePoint.theta,
          probabilityDensity: probePoint.prob,
        },
        capturedAtUtc: new Date().toISOString(),
      };

      const res = await fetch('/api/memory/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cryptic-role': actorRole,
        },
        body: JSON.stringify({
          event: {
            source: 'quantum_rose_canvas',
            project: 'GAIA-NEXUS',
            eventType: 'QUANTUM_ROSE_SNAPSHOT',
            payload: JSON.stringify(payloadObj),
            tags: ['quantum-rose', `eigenstates-${eigenstatesCount}`],
          },
          authorizationContext: {
            userConsent: true,
            actorRole,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setSaveReceipt(data as MemorySaveReceipt);
      onSnapshotSaved?.(data as MemorySaveReceipt);
      await loadSavedSnapshots();
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save snapshot');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestoreSnapshot = (ev: GaiaMemoryEventRecord) => {
    try {
      const parsed = JSON.parse(ev.payload) as QuantumRoseSnapshotPayload;
      if (parsed.eigenstatesCount) setEigenstatesCount(parsed.eigenstatesCount);
      if (typeof parsed.coherence === 'number') setCoherence(parsed.coherence);
      if (typeof parsed.timeSpeed === 'number') setTimeSpeed(parsed.timeSpeed);
      if (typeof parsed.simulationTime === 'number') {
        simTimeRef.current = parsed.simulationTime;
        setSimTime(parsed.simulationTime);
      }
      if (typeof parsed.phaseRad === 'number') {
        setPerturbationPhase(parsed.phaseRad);
      }
      if (parsed.probeCoordinate) {
        setProbePoint({
          r: parsed.probeCoordinate.r,
          theta: parsed.probeCoordinate.theta,
          prob: parsed.probeCoordinate.probabilityDensity,
          phase: parsed.phaseRad ?? 0,
        });
      }
    } catch {
      setSaveError('Snapshot JSON payload could not be parsed for canvas restoration.');
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#06090F] text-slate-200 font-mono text-xs overflow-y-auto">
      {/* Honest Numerical Simulation Disclaimer */}
      <div className="px-4 py-2.5 bg-[#0B1018] border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-white font-semibold text-xs">
            Quantum Rose Wavefunction Canvas &bull; &Psi;(r,&theta;,t) = &Sigma; c&#8345; &psi;&#8345;(r,&theta;) e^(-iE&#8345;t/&hbar;)
          </div>
          <div className="text-[10px] text-amber-300">
            Interactive numerical wavefunction model only. Physical quantum hardware / Qiskit execution is NOT_CONFIGURED and not claimed.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-700 hover:border-cyan-400 text-cyan-300 flex items-center gap-1.5"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>
          <button
            onClick={() => {
              simTimeRef.current = 0;
              setSimTime(0);
              setPerturbationPhase(0);
            }}
            className="px-3 py-1.5 bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Phase</span>
          </button>
          <button
            onClick={handleSaveSnapshot}
            disabled={isSaving}
            className="px-3 py-1.5 bg-emerald-500/20 border border-emerald-400 text-emerald-200 hover:bg-emerald-500/30 font-semibold flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving to SQLite...' : 'Save Snapshot (Save_Memory)'}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-[1px] bg-slate-800 min-h-0">
        {/* Left: Interactive Wavefunction Canvas */}
        <div className="lg:col-span-7 bg-[#04070C] flex flex-col p-3 gap-2">
          <div className="relative flex-1 min-h-[340px] border border-slate-800 bg-[#04070C] flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={640}
              height={460}
              onClick={handleCanvasPointer}
              className="w-full h-full max-h-[460px] object-contain cursor-crosshair block"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] tabular-nums">
            <div className="p-2 bg-[#0B1018] border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Simulation Time (t)</span>
              <span className="text-cyan-300 font-semibold">{simTime.toFixed(3)} rad</span>
            </div>
            <div className="p-2 bg-[#0B1018] border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Probe (r, &theta;)</span>
              <span className="text-white font-semibold">r={probePoint.r}, &theta;={probePoint.theta}</span>
            </div>
            <div className="p-2 bg-[#0B1018] border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Density |&Psi;|²</span>
              <span className="text-emerald-400 font-semibold">{probePoint.prob.toFixed(5)}</span>
            </div>
            <div className="p-2 bg-[#0B1018] border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Local Phase Arg(&Psi;)</span>
              <span className="text-amber-300 font-semibold">{probePoint.phase.toFixed(4)} rad</span>
            </div>
          </div>
        </div>

        {/* Right: Parameters, Complex Amplitudes, Save_Memory Receipt & Restoration */}
        <div className="lg:col-span-5 bg-[#06090F] p-4 space-y-4 overflow-y-auto">
          <div className="bg-[#0B1018] border border-slate-800 p-3 space-y-3">
            <div className="text-white font-semibold">Wavefunction Superposition Parameters</div>
            <div className="space-y-2 text-[11px]">
              <div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Eigenstate Count (N)</span>
                  <span className="text-cyan-300 font-semibold tabular-nums">{eigenstatesCount}</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={12}
                  step={1}
                  value={eigenstatesCount}
                  onChange={(e) => setEigenstatesCount(Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>
              <div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Coherence Envelope</span>
                  <span className="text-emerald-300 font-semibold tabular-nums">{coherence.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={1.0}
                  step={0.02}
                  value={coherence}
                  onChange={(e) => setCoherence(Number(e.target.value))}
                  className="w-full accent-emerald-400"
                />
              </div>
              <div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Phase Evolution Speed (&omega;)</span>
                  <span className="text-amber-300 font-semibold tabular-nums">{timeSpeed.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min={0.0}
                  max={2.5}
                  step={0.05}
                  value={timeSpeed}
                  onChange={(e) => setTimeSpeed(Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
              </div>
            </div>
          </div>

          {saveError && (
            <div className="p-3 bg-rose-950/30 border border-rose-500/40 text-rose-300 text-[11px] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          {saveReceipt && (
            <div className="p-3 bg-emerald-950/20 border border-emerald-500/40 text-[11px] space-y-1">
              <div className="text-emerald-400 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Snapshot Committed & Verified in SQLite WAL</span>
              </div>
              <div className="text-slate-300">Event: {saveReceipt.event.event_id} (seq #{saveReceipt.event.sequence})</div>
              <div className="text-cyan-300 truncate">SHA-256: {saveReceipt.event.payload_sha256}</div>
              <div className="text-amber-300">
                Receipt R: {saveReceipt.receiptR.ID} &bull; Gate A={String(saveReceipt.convergence.A_accepted)}
              </div>
            </div>
          )}

          {/* Eigenstates Spectrum Table */}
          <div className="bg-[#0B1018] border border-slate-800 p-3 space-y-2">
            <div className="text-white font-semibold">Complex Eigenstate Basis c&#8345; &psi;&#8345;</div>
            <div className="max-h-36 overflow-y-auto border border-slate-800">
              <table className="w-full text-left text-[10px] tabular-nums">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-1.5 px-2">Mode (n, m)</th>
                    <th className="py-1.5 px-2">|c&#8345;|</th>
                    <th className="py-1.5 px-2">Phase (rad)</th>
                    <th className="py-1.5 px-2">Energy E&#8345;</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {modes.map((m) => (
                    <tr key={m.n}>
                      <td className="py-1 px-2 text-cyan-300">({m.n}, {m.m})</td>
                      <td className="py-1 px-2 text-white">{m.amplitude}</td>
                      <td className="py-1 px-2 text-amber-300">{m.phaseRad}</td>
                      <td className="py-1 px-2 text-emerald-300">{m.energy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Saved Snapshots for Deterministic Restoration */}
          <div className="bg-[#0B1018] border border-slate-800 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-white font-semibold">Saved Snapshots ({savedSnapshots.length})</span>
              <button
                onClick={loadSavedSnapshots}
                className="text-cyan-300 hover:text-white flex items-center gap-1 text-[10px]"
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {savedSnapshots.length === 0 ? (
                <div className="text-slate-500 text-[11px]">No Quantum Rose snapshots saved yet. Click Save Snapshot above.</div>
              ) : (
                savedSnapshots.map((snap) => (
                  <div key={snap.event_id} className="p-2 bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-[10px]">
                    <div className="truncate">
                      <div className="text-cyan-300 font-semibold">{snap.event_id} (seq #{snap.sequence})</div>
                      <div className="text-slate-400 truncate">sha256: {snap.payload_sha256.slice(0, 24)}...</div>
                    </div>
                    <button
                      onClick={() => handleRestoreSnapshot(snap)}
                      className="px-2 py-1 border border-cyan-500/40 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20 shrink-0"
                    >
                      Restore
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
