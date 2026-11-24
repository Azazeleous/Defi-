import React, { useState, useEffect } from 'react';
import { 
  Compass, Eye, Volume2, VolumeX, Zap, Sparkles, Orbit, Download, 
  Layers, ShieldCheck, Crosshair, ArrowRightLeft, Radio, Flame
} from 'lucide-react';
import { globalHarmonicEngine, HarmonicAudioState } from '../engine/harmonicResonanceEngine';
import { globalSingularityEngine } from '../engine/unifiedSingularityEngine';
import { globalTraceEngine } from '../engine/cuboctahedralTraceEngine';

interface Props {
  onRestoreUi: () => void;
  onSelectLevel?: (level: number) => void;
  currentLevel?: number;
}

export const FlightHudOverlay: React.FC<Props> = ({
  onRestoreUi,
  onSelectLevel,
  currentLevel = 1,
}) => {
  const [activeLvl, setActiveLvl] = useState<number>(currentLevel);
  const [audioState, setAudioState] = useState<HarmonicAudioState>(() => globalHarmonicEngine.getState());
  const [burstActive, setBurstActive] = useState<boolean>(false);
  const [snapshotMsg, setSnapshotMsg] = useState<string | null>(null);

  // Drone telemetry state for live readout
  const [telemetry, setTelemetry] = useState({
    x: 0.0,
    y: 0.0,
    z: 7.5,
    w: 0.0,
    yaw: 0,
    pitch: 0,
  });

  const levelConfigs = [
    { id: 1, name: 'Tesseract', subtitle: 'Coprime Stride & ModInv', color: '#00f0ff', mult: '1.42x' },
    { id: 2, name: '24-Cell', subtitle: 'QC-LDPC Parity GF(256)', color: '#39ff14', mult: '2.10x' },
    { id: 3, name: '120-Cell', subtitle: 'SHA-256d Merkle Chain', color: '#ffb700', mult: '3.85x' },
    { id: 4, name: '600-Cell', subtitle: 'Paired Inverse S^-1', color: '#ff0055', mult: '5.20x' },
    { id: 5, name: 'Great 120-Cell', subtitle: 'Hamiltonian Wavefield', color: '#a855f7', mult: '8.40x' },
    { id: 6, name: 'Sephiroth Sphere', subtitle: 'Dewey Torsion Engine', color: '#ffffff', mult: '14.2x' },
  ];

  useEffect(() => {
    const unsub = globalHarmonicEngine.subscribe((st) => setAudioState(st));
    return () => unsub();
  }, []);

  // Keyboard shortcut listener for level warping (1-6) and burst (B)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const num = parseInt(e.key);
      if (num >= 1 && num <= 6) {
        handleWarpLevel(num);
      } else if (e.code === 'KeyB') {
        handleTriggerSolveBurst();
      } else if (e.code === 'KeyM') {
        handleToggleAudio();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeLvl]);

  // Read slight drone drift for telemetry visualization
  useEffect(() => {
    const interval = setInterval(() => {
      setTelemetry((prev) => ({
        ...prev,
        z: prev.z + (Math.sin(Date.now() * 0.001) * 0.02),
        w: Math.sin(Date.now() * 0.0005) * 1.5,
      }));
    }, 150);
    return () => clearInterval(interval);
  }, []);

  const handleWarpLevel = (lvl: number) => {
    setActiveLvl(lvl);
    globalHarmonicEngine.playLevelShiftSound(lvl);
    if (onSelectLevel) onSelectLevel(lvl);
  };

  const handleToggleAudio = () => {
    globalHarmonicEngine.toggleMute();
  };

  const handleTriggerSolveBurst = () => {
    setBurstActive(true);
    globalHarmonicEngine.playSolveBurstSound();

    // Trigger instant block resolution with active level algorithm signature
    const cfg = levelConfigs.find((c) => c.id === activeLvl) || levelConfigs[0];
    globalTraceEngine.resolveCustomBlockchainBlock(
      Math.floor(Date.now() % 100000),
      `SOLVE_BURST_LVL${activeLvl}_[${cfg.name.toUpperCase()}]`,
      BigInt(Math.floor(parseFloat(cfg.mult) * 10000))
    );

    setTimeout(() => setBurstActive(false), 600);
  };

  const handleCaptureSnapshot = () => {
    const cfg = levelConfigs.find((c) => c.id === activeLvl) || levelConfigs[0];
    const snap = globalSingularityEngine.createSnapshot(
      `4D_VOID_LEVEL_${activeLvl}_CHECKPOINT`,
      JSON.stringify({
        level: activeLvl,
        name: cfg.name,
        telemetry,
        harmonicFreqHz: audioState.frequencyHz,
        multiplier: cfg.mult,
        timestampUtc: new Date().toISOString(),
      }),
      `ALG_LVL${activeLvl}_${cfg.name.toUpperCase()}`
    );

    // Create JSON download
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GAIA_NEXUS_SNAPSHOT_${snap.snapshotId}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setSnapshotMsg(`Exported ${snap.snapshotId} (SHA-256 Verified)`);
    setTimeout(() => setSnapshotMsg(null), 4000);
  };

  const activeConfig = levelConfigs.find((c) => c.id === activeLvl) || levelConfigs[0];

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-4 sm:p-6 font-mono text-slate-100 select-none animate-in fade-in duration-500">
      
      {/* Top Floating Telemetry & Mode Bar */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-950/70 backdrop-blur-xl border border-cyan-500/40 p-4 rounded-2xl shadow-2xl pointer-events-auto">
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="w-3 h-3 rounded-full bg-cyan-400 block animate-ping" />
            <span className="w-3 h-3 rounded-full bg-cyan-400 block absolute inset-0" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-white tracking-widest flex items-center gap-2">
                <span>4D VOID TRAVERSAL HUD</span>
                <span className="text-cyan-400 text-xs">&bull; LEVEL {activeLvl} ACTIVE</span>
              </h1>
              <span 
                className="text-[10px] px-2 py-0.5 rounded font-bold border"
                style={{ backgroundColor: `${activeConfig.color}22`, borderColor: activeConfig.color, color: activeConfig.color }}
              >
                {activeConfig.name}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Flight: <kbd className="px-1 py-0.5 rounded bg-slate-900 text-cyan-300">W S A D</kbd> | Elev: <kbd className="px-1 py-0.5 rounded bg-slate-900 text-cyan-300">Q E</kbd> | Look: <kbd className="px-1 py-0.5 rounded bg-slate-900 text-cyan-300">&larr; &uarr; &rarr; &darr;</kbd>
            </p>
          </div>
        </div>

        {/* Top Right Actions */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {/* Audio Resonance Toggle */}
          <button
            onClick={handleToggleAudio}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
              !audioState.isMuted
                ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.3)] animate-pulse'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
            }`}
            title="Toggle 432 Hz Pythagorean Audio Synthesis (Key: M)"
          >
            {!audioState.isMuted ? <Volume2 className="w-3.5 h-3.5 text-cyan-400" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{!audioState.isMuted ? `${Math.round(audioState.frequencyHz)} Hz` : 'Muted'}</span>
          </button>

          {/* Instant Solve Burst Trigger */}
          <button
            onClick={handleTriggerSolveBurst}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-bold transition-all cursor-pointer ${
              burstActive
                ? 'bg-emerald-500 text-black border-emerald-400 shadow-[0_0_20px_#10b981]'
                : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30'
            }`}
            title="Execute Instant Cryptographic Solve Burst (Key: B)"
          >
            <Zap className={`w-3.5 h-3.5 ${burstActive ? 'animate-bounce' : ''}`} />
            <span>Solve Burst ({activeConfig.mult})</span>
          </button>

          {/* Capture Verified Snapshot */}
          <button
            onClick={handleCaptureSnapshot}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-200 hover:bg-purple-500/30 transition-all cursor-pointer"
            title="Export Immutable GAIA/NEXUS Snapshot & Verified JSON"
          >
            <Download className="w-3.5 h-3.5 text-purple-300" />
            <span className="hidden sm:inline">Snapshot</span>
          </button>

          {/* Restore Full UI Button */}
          <button
            onClick={onRestoreUi}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-black font-bold shadow-lg shadow-cyan-500/25 transition-all cursor-pointer"
            title="Restore Full Dashboard UI"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Restore UI</span>
          </button>
        </div>
      </header>

      {/* Snapshot Toast notification */}
      {snapshotMsg && (
        <div className="self-center bg-purple-950/90 border border-purple-400 text-purple-200 px-4 py-2 rounded-xl text-xs shadow-2xl backdrop-blur animate-in fade-in slide-in-from-top-2">
          {snapshotMsg}
        </div>
      )}

      {/* Central Targeting Reticle */}
      <div className="self-center flex flex-col items-center gap-1 opacity-75">
        <Crosshair className="w-8 h-8 text-cyan-400/80 animate-pulse" />
        <span className="text-[10px] text-cyan-300 tracking-wider">
          TARGET: {activeConfig.name.toUpperCase()} &bull; 0.5 COAXIAL LOCK
        </span>
      </div>

      {/* Bottom Floating Hypergeometric Level Ring Selector */}
      <footer className="bg-slate-950/70 backdrop-blur-xl border border-slate-800 p-4 rounded-2xl shadow-2xl flex flex-col gap-3 pointer-events-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
          <div className="flex items-center gap-2">
            <Orbit className="w-4 h-4 text-cyan-400 animate-spin-slow" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Hypergeometric Matrix Levels &bull; Quick Warp (Keys 1-6)
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span>POS: ({telemetry.x.toFixed(1)}, {telemetry.y.toFixed(1)}, {telemetry.z.toFixed(1)}, W: {telemetry.w.toFixed(2)})</span>
            <span>&bull;</span>
            <span className="text-emerald-400 font-bold">ACCELERATION: {activeConfig.mult}</span>
          </div>
        </div>

        {/* 6 Hypergeometric Levels Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {levelConfigs.map((lvl) => {
            const isSelected = lvl.id === activeLvl;
            return (
              <button
                key={lvl.id}
                onClick={() => handleWarpLevel(lvl.id)}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'shadow-lg'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
                style={
                  isSelected
                    ? { backgroundColor: `${lvl.color}20`, borderColor: lvl.color, color: '#ffffff' }
                    : {}
                }
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400">KEY [{lvl.id}]</span>
                  <span 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: lvl.color }}
                  />
                </div>
                <div className="font-bold text-xs mt-1 truncate">{lvl.name}</div>
                <div className="text-[9px] text-slate-400 truncate">{lvl.subtitle}</div>
                <div className="text-[10px] text-emerald-300 font-bold mt-1">{lvl.mult}</div>
              </button>
            );
          })}
        </div>
      </footer>

    </div>
  );
};
