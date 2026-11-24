import React, { useEffect, useState } from 'react';
import { Copy, Orbit, RefreshCw, ShieldAlert } from 'lucide-react';
import type { VoidEngineRuntimeStatus, VoidFieldSettings } from '../contracts/v7-convergence';
import { globalVoidController } from '../engine/cosmicGuardianVoidEngine';

export const CosmicGuardianVoidWorkspace: React.FC = () => {
  const [settings, setSettings] = useState<VoidFieldSettings>(() => globalVoidController.getSettings());
  const [status, setStatus] = useState<VoidEngineRuntimeStatus>(() => globalVoidController.getStatus());
  const [snapshotToken, setSnapshotToken] = useState<string>('');
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = globalVoidController.subscribe((s, st) => {
      setSettings(s);
      setStatus(st);
    });
    return () => unsub();
  }, []);

  const handleCapture = () => {
    setSnapshotToken(globalVoidController.captureRestoreToken());
    setRestoreMsg('Captured live Void() field configuration token (does not trigger Save_Memory).');
  };

  const handleRestore = () => {
    const ok = globalVoidController.restoreFromToken(snapshotToken);
    setRestoreMsg(ok ? 'Restored Void() field parameters.' : 'Invalid snapshot token JSON.');
  };

  return (
    <div className="w-full p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 font-mono text-xs text-slate-100">
      <div className="lg:col-span-6 bg-[#080D16]/90 border border-slate-800 p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div>
            <div className="text-[10px] text-cyan-400 uppercase">FULL-APP PROCEDURAL FIELD &bull; ZERO AUTH AUTHORITY</div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2 mt-0.5">
              <Orbit className="w-4 h-4 text-cyan-400" />
              <span>Cosmic Guardian — Void() Engine Inspector</span>
            </h2>
          </div>
          <span className="text-[10px] px-2 py-0.5 border border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
            {status.rendererMode}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="p-2.5 bg-slate-950 border border-slate-800 flex items-center justify-between cursor-pointer">
            <span>Enable Void() Engine</span>
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => globalVoidController.updateSettings({ enabled: e.target.checked })}
            />
          </label>
          <label className="p-2.5 bg-slate-950 border border-slate-800 flex items-center justify-between cursor-pointer">
            <span>Full-App Backdrop</span>
            <input
              type="checkbox"
              checked={settings.fullAppBackdrop}
              onChange={(e) => globalVoidController.updateSettings({ fullAppBackdrop: e.target.checked })}
            />
          </label>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex justify-between mb-1 tabular-nums">
              <span className="text-slate-300">Field Luminance Intensity</span>
              <span className="text-cyan-300">{Math.round(settings.intensity * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={settings.intensity}
              onChange={(e) => globalVoidController.updateSettings({ intensity: Number(e.target.value) })}
              className="w-full accent-cyan-400"
            />
          </div>

          <div>
            <div className="flex justify-between mb-1 tabular-nums">
              <span className="text-slate-300">Hamiltonian Phase Coupling</span>
              <span className="text-cyan-300">{settings.phaseCoupling.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.phaseCoupling}
              onChange={(e) => globalVoidController.updateSettings({ phaseCoupling: Number(e.target.value) })}
              className="w-full accent-cyan-400"
            />
          </div>

          <div>
            <div className="flex justify-between mb-1 tabular-nums">
              <span className="text-slate-300">Palette Seed Hue</span>
              <span className="text-cyan-300">{Math.round(settings.paletteSeedHue)}&deg;</span>
            </div>
            <input
              type="range"
              min={0}
              max={360}
              value={settings.paletteSeedHue}
              onChange={(e) => globalVoidController.updateSettings({ paletteSeedHue: Number(e.target.value) })}
              className="w-full accent-cyan-400"
            />
          </div>

          <div>
            <span className="text-slate-400 block mb-1.5">prefers-reduced-motion Mode</span>
            <div className="grid grid-cols-3 gap-1.5">
              {(['AUTO', 'FORCE_STATIC', 'ALLOW_MOTION'] as const).map((rm) => (
                <button
                  key={rm}
                  onClick={() => globalVoidController.updateSettings({ reducedMotionOverride: rm })}
                  className={`py-1.5 text-[10px] border ${
                    settings.reducedMotionOverride === rm
                      ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200'
                      : 'border-slate-800 bg-slate-950 text-slate-400'
                  }`}
                >
                  {rm}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-6 bg-[#080D16]/90 border border-slate-800 p-4 space-y-4">
        <div className="border-b border-slate-800 pb-2 font-bold text-white">
          WebGL2 Runtime Telemetry &amp; Snapshot / Restore
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px] tabular-nums">
          <div className="p-2.5 bg-slate-950 border border-slate-800">
            <span className="text-slate-400 block">WebGL2 Available</span>
            <span className={status.webgl2Supported ? 'text-emerald-400 font-bold' : 'text-amber-300 font-bold'}>
              {status.webgl2Supported ? 'YES (GPU Shader)' : 'NO (2D Fallback)'}
            </span>
          </div>
          <div className="p-2.5 bg-slate-950 border border-slate-800">
            <span className="text-slate-400 block">Frame Budget / FPS</span>
            <span className="text-cyan-300 font-bold">
              {status.lastFrameMs}ms / {status.fpsEstimate} fps
            </span>
          </div>
          <div className="p-2.5 bg-slate-950 border border-slate-800">
            <span className="text-slate-400 block">Context Lost Recoveries</span>
            <span className="text-white font-bold">{status.contextLostCount}</span>
          </div>
          <div className="p-2.5 bg-slate-950 border border-slate-800">
            <span className="text-slate-400 block">Reduced Motion Active</span>
            <span className="text-amber-300 font-bold">{status.reducedMotionActive ? 'STATIC' : 'LIVE'}</span>
          </div>
        </div>

        <div className="p-3 bg-amber-950/30 border border-amber-500/30 text-amber-200 text-[11px] flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-300" />
          <div>
            <strong>Boundary Invariant:</strong> Void() is a pure ambient render layer behind all views. It never writes to Save_Memory during animation frames and cannot authorize or override Gate A = B &amp;&amp; C &amp;&amp; V.
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCapture}
              className="px-3 py-1.5 bg-cyan-600/20 border border-cyan-500/50 text-cyan-200 flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Capture Field Snapshot</span>
            </button>
            <button
              onClick={handleRestore}
              className="px-3 py-1.5 bg-slate-900 border border-slate-700 hover:border-emerald-400 text-emerald-300 flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Restore From Token</span>
            </button>
          </div>
          <textarea
            rows={4}
            value={snapshotToken}
            onChange={(e) => setSnapshotToken(e.target.value)}
            placeholder="Capture a snapshot token or paste JSON to restore Void() field settings..."
            className="w-full p-2 bg-slate-950 border border-slate-800 text-[11px] text-slate-200 resize-none"
          />
          {restoreMsg && <div className="text-[11px] text-cyan-300">{restoreMsg}</div>}
        </div>
      </div>
    </div>
  );
};
