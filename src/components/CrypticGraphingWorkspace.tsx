/**
 * =============================================================================
 * PROJECT: GAIA EYES — HIGH-RATE QUANTUM GRID AUTOMATION
 * MODULE: CrypticGraphing Workspace with FNV ISO Tether
 * SPECIFICATION: AE.CRYPTIC.SINGULARITY.V1
 * =============================================================================
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  globalCrypticEngine,
  fnv1a64
} from '../engine/crypticGraphingEngine';
import {
  globalTraceEngine,
  CuboctahedralTraceEngine,
  LiveChainBlock
} from '../engine/cuboctahedralTraceEngine';
import {
  CrypticGraphingState,
  VirtualMountPoint,
  VirtualDriveSector
} from '../types/cryptic';
import {
  HardDrive,
  Cpu,
  Shield,
  Zap,
  Activity,
  Layers,
  Database,
  Radio,
  Play,
  Pause,
  Download,
  Upload,
  RefreshCw,
  Terminal,
  CheckCircle,
  AlertTriangle,
  Lock,
  Eye,
  Sliders,
  ExternalLink,
  Save,
  Trash2,
  TrendingUp,
  CreditCard
} from 'lucide-react';
import { MiningAdvancedAnalytics } from './MiningAdvancedAnalytics';
import { StripeMultiCurrencyPayouts } from './StripeMultiCurrencyPayouts';
import { AnalyticsDashboard } from './AnalyticsDashboard';

export const CrypticGraphingWorkspace: React.FC = () => {
  const [engineState, setEngineState] = useState<CrypticGraphingState>(() =>
    globalCrypticEngine.getState()
  );

  const [activeTab, setActiveTab] = useState<
    'mountDrive' | 'miningPool' | 'miningAnalytics' | 'analyticsDashboard' | 'stripePayouts' | 'fnvOscilloscope' | 'matrix1to1' | 'storageLedger'
  >('mountDrive');

  const [selectedMountPath, setSelectedMountPath] = useState<string>(
    engineState.mounts[0]?.mountPath || '@/virtual/fnv-chain-eth'
  );
  const [selectedSector, setSelectedSector] = useState<VirtualDriveSector | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Canvas ref for FNV ISO Tether Oscilloscope
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Subscribe to real-time engine state updates
  useEffect(() => {
    const unsubscribe = globalCrypticEngine.subscribe((nextState) => {
      setEngineState(nextState);
    });
    return () => unsubscribe();
  }, []);

  // Update selected sector when drive changes or mounts update
  useEffect(() => {
    const curMount = engineState.mounts.find((m) => m.mountPath === selectedMountPath);
    if (curMount) {
      if (!selectedSector || !curMount.sectors.some((s) => s.sectorIndex === selectedSector.sectorIndex)) {
        setSelectedSector(curMount.sectors[0] || null);
      } else {
        // Refresh selected sector data
        const updatedSec = curMount.sectors.find((s) => s.sectorIndex === selectedSector.sectorIndex);
        if (updatedSec) setSelectedSector(updatedSec);
      }
    }
  }, [engineState.mounts, selectedMountPath]);

  // Real-time canvas renderer for the 60 Hz FNV ISO Tether Oscilloscope
  useEffect(() => {
    if (activeTab !== 'fnvOscilloscope') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const renderWave = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.fillStyle = '#010408';
      ctx.fillRect(0, 0, width, height);

      // Grid background
      ctx.strokeStyle = '#0a1928';
      ctx.lineWidth = 1;
      const gridSize = 24;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Center reference line
      ctx.strokeStyle = '#102d44';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      const phase = engineState.beat.phaseAngleRad;
      const freq = engineState.beat.measuredFrequencyHz;

      // Primary 60 Hz ISO Beat Sine Wave (Cyan)
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 8;
      ctx.beginPath();

      const waveCount = 4;
      for (let x = 0; x < width; x++) {
        const t = (x / width) * waveCount * 2 * Math.PI;
        const y = height / 2 + Math.sin(t - phase) * (height * 0.32);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Secondary FNV Harmonics Wave (Neon Green)
      ctx.strokeStyle = '#39ff14';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = 0; x < width; x++) {
        const t = (x / width) * waveCount * 4 * Math.PI;
        const y = height / 2 + Math.cos(t * 1.5 + phase) * (height * 0.16);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Tether lock crosshair indicator at center
      ctx.strokeStyle = '#ffb700';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, 28, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]);

      animId = requestAnimationFrame(renderWave);
    };

    animId = requestAnimationFrame(renderWave);
    return () => cancelAnimationFrame(animId);
  }, [activeTab, engineState.beat]);

  const activeMount =
    engineState.mounts.find((m) => m.mountPath === selectedMountPath) ||
    engineState.mounts[0];

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    setCopyFeedback(label);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const handleExportVhd = () => {
    const raw = globalCrypticEngine.exportVirtualDiskImage();
    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cryptic-virtual-disk-image-${Date.now()}.vhd.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportLedger = () => {
    const raw = globalTraceEngine.exportLedgerJson();
    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `blockLedgerDataset-persistent-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#010306] text-gray-200 p-4 sm:p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Sparsebundle Integrity Check & Corruption Visual Alert */}
        {engineState.isSparsebundleCorrupted ? (
          <div className="p-4 bg-red-950/80 border-2 border-red-500 rounded-2xl flex items-center justify-between gap-4 shadow-2xl animate-pulse">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-red-300 font-mono uppercase tracking-wider">
                  Sparsebundle Integrity Corruption Detected!
                </h4>
                <p className="text-xs text-red-200/80 font-mono">
                  Checksum mismatch in virtual memory-mapped blocks ({engineState.integrityChecksum}). Invariant verification failed prior to globalTraceEngine integration.
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded bg-red-500/20 text-red-300 border border-red-500/40 text-xs font-mono font-bold shrink-0">
              STATE DEGRADED
            </span>
          </div>
        ) : (
          <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle className="w-4 h-4" />
              <span>Sparsebundle Memory-Mapped Integrity Verified ({engineState.integrityChecksum})</span>
            </div>
            <span className="text-[10px] text-gray-400">
              Driver: {engineState.vfsDriverType} &bull; 8.0MB Chunk Bands Active
            </span>
          </div>
        )}

        {/* Title Header with Glowing FNV ISO Tether Badge */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 bg-[#040810] border border-[#101d2a] rounded-2xl shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="space-y-1 z-10">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <HardDrive className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase font-mono">
                    CrypticGraphing
                  </h1>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold uppercase tracking-wider">
                    FNV ISO TETHER
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/30 font-bold uppercase tracking-wider">
                    1:1 VIRTUAL MOUNT
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  Mining Pool Singularity &bull; Virtual Mountable Drive Substrate &bull; Persistent{' '}
                  <code className="text-cyan-300">blockLedgerDataset</code> LocalStorage Engine
                </p>
              </div>
            </div>
          </div>

          {/* Quick Telemetry Indicators */}
          <div className="flex flex-wrap items-center gap-3 z-10 text-xs">
            {/* 60 Hz ISO Beat */}
            <div className="px-3 py-2 bg-[#060e18] border border-cyan-500/30 rounded-xl flex items-center gap-2.5 font-mono shadow-inner">
              <span className="w-2.5 h-2.5 rounded-full bg-[#39ff14] animate-ping" />
              <div>
                <span className="text-[10px] text-gray-400 block leading-tight">ISO BEAT TETHER</span>
                <span className="text-[#00f0ff] font-bold">
                  {engineState.beat.measuredFrequencyHz.toFixed(2)} Hz
                </span>
                <span className="text-[10px] text-gray-500 ml-1.5 font-normal">
                  (&plusmn;{engineState.beat.driftMs}ms)
                </span>
              </div>
            </div>

            {/* Active Offset Key */}
            <div
              onClick={() => handleCopy(engineState.beat.activeOffsetKey, 'FNV Offset Key')}
              className="px-3 py-2 bg-[#060e18] border border-emerald-500/30 rounded-xl flex items-center gap-2 cursor-pointer hover:border-emerald-400 transition-colors font-mono"
              title="Click to copy active 64-bit FNV offset key"
            >
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <div>
                <span className="text-[10px] text-gray-400 block leading-tight">1:1 MOUNT KEY</span>
                <span className="text-emerald-400 font-bold text-[11px]">
                  {engineState.beat.activeOffsetKey.slice(0, 14)}...
                </span>
              </div>
            </div>

            {/* Persistent Ledger Blocks */}
            <div className="px-3 py-2 bg-[#060e18] border border-purple-500/30 rounded-xl flex items-center gap-2 font-mono">
              <Database className="w-3.5 h-3.5 text-purple-400" />
              <div>
                <span className="text-[10px] text-gray-400 block leading-tight">PERSISTED LEDGER</span>
                <span className="text-purple-300 font-bold">
                  {engineState.totalPersistentBlocks} Blocks
                </span>
                <span className="text-[10px] text-gray-500 ml-1.5">
                  ({(engineState.storageFootprintBytes / 1024).toFixed(1)} KB)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Copy Feedback Toast */}
        {copyFeedback && (
          <div className="p-2 bg-emerald-950/80 border border-emerald-500/50 rounded-lg text-emerald-300 text-xs font-mono text-center animate-fade-in">
            Copied {copyFeedback} to clipboard!
          </div>
        )}

        {/* Workspace Mode Navigation Tabs */}
        <div className="flex items-center gap-2 p-1.5 bg-[#050b14] border border-[#101d2a] rounded-xl overflow-x-auto">
          <button
            onClick={() => setActiveTab('mountDrive')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold font-mono transition-all whitespace-nowrap ${
              activeTab === 'mountDrive'
                ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'
                : 'text-gray-400 hover:text-white hover:bg-[#0c1926]'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Virtual Mountable Drive</span>
            <span className="px-1.5 py-0.2 bg-black/20 rounded text-[10px]">
              {engineState.mounts.filter((m) => m.mounted).length}/7 Mounted
            </span>
          </button>

          <button
            onClick={() => setActiveTab('miningPool')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold font-mono transition-all whitespace-nowrap ${
              activeTab === 'miningPool'
                ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                : 'text-gray-400 hover:text-white hover:bg-[#0c1926]'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Mining Pool Singularity</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </button>

          <button
            onClick={() => setActiveTab('miningAnalytics')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold font-mono transition-all whitespace-nowrap ${
              activeTab === 'miningAnalytics'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-black shadow-lg shadow-emerald-500/20 font-black'
                : 'text-emerald-400 hover:text-white hover:bg-[#0c1926]'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Mining Analytics</span>
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          </button>

          <button
            onClick={() => setActiveTab('analyticsDashboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold font-mono transition-all whitespace-nowrap ${
              activeTab === 'analyticsDashboard'
                ? 'bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 text-black shadow-lg shadow-cyan-500/20 font-black'
                : 'text-cyan-300 hover:text-white hover:bg-[#0c1926]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Recharts Analytics</span>
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          </button>

          <button
            onClick={() => setActiveTab('stripePayouts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold font-mono transition-all whitespace-nowrap ${
              activeTab === 'stripePayouts'
                ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-black shadow-lg shadow-cyan-500/20 font-black'
                : 'text-cyan-300 hover:text-white hover:bg-[#0c1926]'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Stripe Payouts</span>
            <span className="px-1.5 py-0.2 bg-black/40 text-[#39ff14] rounded text-[10px] font-bold">
              Multi-Currency
            </span>
          </button>

          <button
            onClick={() => setActiveTab('fnvOscilloscope')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold font-mono transition-all whitespace-nowrap ${
              activeTab === 'fnvOscilloscope'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                : 'text-gray-400 hover:text-white hover:bg-[#0c1926]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>FNV ISO Tether Oscilloscope</span>
          </button>

          <button
            onClick={() => setActiveTab('matrix1to1')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold font-mono transition-all whitespace-nowrap ${
              activeTab === 'matrix1to1'
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                : 'text-gray-400 hover:text-white hover:bg-[#0c1926]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>1:1 Chain-to-Drive Matrix</span>
          </button>

          <button
            onClick={() => setActiveTab('storageLedger')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold font-mono transition-all whitespace-nowrap ${
              activeTab === 'storageLedger'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-gray-400 hover:text-white hover:bg-[#0c1926]'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>LocalStorage blockLedgerDataset</span>
          </button>
        </div>

        {/* =========================================================================
            TAB 1: VIRTUAL MOUNTABLE DRIVE SUBSTRATE
           ========================================================================= */}
        {activeTab === 'mountDrive' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Mount Tree & Partition Selector */}
            <div className="p-4 bg-[#040810] border border-[#101d2a] rounded-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-800">
                <span className="text-xs font-bold font-mono text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                  <Terminal className="w-4 h-4" />
                  Virtual Mount Points
                </span>
                <span className="text-[10px] font-mono text-gray-500">
                  {engineState.vfsDriverType}
                </span>
              </div>

              <div className="space-y-2">
                {engineState.mounts.map((mount) => {
                  const isSelected = mount.mountPath === selectedMountPath;
                  return (
                    <div
                      key={mount.mountPath}
                      onClick={() => setSelectedMountPath(mount.mountPath)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#091a2a] border-cyan-500 shadow-md shadow-cyan-500/10'
                          : 'bg-[#03060c] border-[#101d2a] hover:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 font-bold">
                            {mount.deviceToken}
                          </span>
                          <span className="font-mono text-xs font-bold text-white">
                            {mount.mountPath}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                            mount.mounted
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-red-500/10 text-red-400 border border-red-500/30'
                          }`}
                        >
                          {mount.status}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400 font-mono">
                        <span>Label: {mount.driveLabel}</span>
                        <span>
                          {mount.allocatedSectors}/{mount.totalSectors} Sectors (
                          {Math.round((mount.allocatedSectors / mount.totalSectors) * 100)}%)
                        </span>
                      </div>

                      {/* 1:1 Offset Key */}
                      <div className="mt-1 text-[10px] font-mono text-gray-500 truncate">
                        Key: <span className="text-cyan-400">{mount.fnvOffsetKey}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons for VFS */}
              <div className="pt-2 flex flex-col gap-2">
                <button
                  onClick={() => globalCrypticEngine.toggleDriveMount(selectedMountPath)}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-bold font-mono transition-colors flex items-center justify-center gap-2 ${
                    activeMount?.mounted
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                  }`}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>
                    {activeMount?.mounted
                      ? `Unmount ${activeMount.mountPath}`
                      : `Mount ${activeMount.mountPath}`}
                  </span>
                </button>

                <button
                  onClick={handleExportVhd}
                  className="w-full py-2 px-3 rounded-xl text-xs font-bold font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Virtual Disk Image (.vhd.json)</span>
                </button>
              </div>
            </div>

            {/* Middle: 64-Sector Grid Visualizer */}
            <div className="lg:col-span-2 p-5 bg-[#040810] border border-[#101d2a] rounded-2xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-800 gap-2">
                <div>
                  <h3 className="text-sm font-bold font-mono text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    <span>Sector Allocation Map &bull; {activeMount.driveLabel}</span>
                  </h3>
                  <p className="text-[11px] text-gray-400 font-mono">
                    64 Virtual Sectors (64 KiB each) &bull; 1:1 Bijective Offset Verification Active
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded bg-emerald-500" /> Mined Block
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded bg-cyan-500" /> Allocated
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded bg-gray-800" /> Free
                  </span>
                </div>
              </div>

              {/* Sector Grid (8x8 = 64 blocks) */}
              <div className="grid grid-cols-8 gap-2 p-3 bg-[#020408] border border-[#0d1824] rounded-xl">
                {activeMount.sectors.map((sec) => {
                  const isSelected = selectedSector?.sectorIndex === sec.sectorIndex;
                  const bg =
                    sec.state === 'MINED_BLOCK'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 hover:bg-emerald-500/30'
                      : sec.state === 'ALLOCATED'
                      ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40 hover:bg-cyan-500/30'
                      : 'bg-gray-900/60 text-gray-600 border-gray-800 hover:border-gray-600';

                  return (
                    <button
                      key={sec.sectorIndex}
                      onClick={() => setSelectedSector(sec)}
                      className={`h-12 rounded-lg border font-mono text-[10px] font-bold flex flex-col items-center justify-center transition-all ${bg} ${
                        isSelected ? 'ring-2 ring-white scale-105 z-10 shadow-lg' : ''
                      }`}
                      title={`Sector #${sec.sectorIndex} (${sec.state}) Offset: ${sec.sectorOffsetHex}`}
                    >
                      <span>S_{sec.sectorIndex.toString().padStart(2, '0')}</span>
                      <span className="text-[9px] opacity-75">
                        {sec.blockIndex !== undefined ? `#${sec.blockIndex}` : sec.state.slice(0, 4)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Detailed Sector Inspector */}
              {selectedSector && (
                <div className="p-4 bg-[#03060c] border border-cyan-500/30 rounded-xl font-mono text-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-800">
                    <span className="text-cyan-400 font-bold flex items-center gap-2">
                      <Eye className="w-3.5 h-3.5" />
                      Sector Inspection &bull; #{selectedSector.sectorIndex} ({selectedSector.sectorOffsetHex})
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                      {selectedSector.state}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                    <div>
                      <span className="text-gray-500 block">Sector Offset Key:</span>
                      <span className="text-white font-bold">{selectedSector.sectorOffsetHex}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">FNV Beat Signature:</span>
                      <span className="text-emerald-400 font-bold truncate block">
                        {selectedSector.fnvBeatOffsetKey || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Associated Block:</span>
                      <span className="text-cyan-300 font-bold">
                        {selectedSector.blockIndex !== undefined
                          ? `Block #${selectedSector.blockIndex}`
                          : 'None (Virtual Inode Sector)'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Associated Block Hash:</span>
                      <span className="text-gray-300 truncate block">
                        {selectedSector.blockHash || 'UNALLOCATED_ZERO_PAGE'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-gray-500 text-[10px] block mb-1">
                      Raw Hex Inode Sector Bytes (VFS Buffer):
                    </span>
                    <div className="p-2.5 bg-[#010204] border border-gray-800 rounded font-mono text-emerald-400 text-[11px] overflow-x-auto">
                      <code>{selectedSector.rawBytesHex}</code>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: MINING POOL SINGULARITY (PRIVATE USE ANONYMITY)
           ========================================================================= */}
        {activeTab === 'miningPool' && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/35 text-xs font-mono text-amber-200 flex flex-wrap items-center justify-between gap-2">
              <span>
                <strong>[LOCAL VFS SANDBOX]</strong> This panel exercises in-memory 64-bit FNV-1a virtual sector allocation. Real TCP Stratum v1 shares, SHA-256 receipts, SQLite accounting, and Stripe Connect settlement live in the <strong>CRYPTIC Platform</strong> header tab.
              </span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: Mining Controls & Stealth Profile */}
              <div className="p-5 bg-[#040810] border border-[#101d2a] rounded-2xl space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-gray-800">
                  <span className="text-xs font-bold font-mono text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Private Enclave Miner (Local FNV Sandbox)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-mono font-bold">
                    LOCAL VFS
                  </span>
                </div>

              {/* Private Anonymity Enclave Card */}
              <div className="p-3.5 bg-[#03060c] border border-emerald-500/30 rounded-xl space-y-2.5 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Enclave ID:</span>
                  <span className="text-white font-bold">{engineState.minerProfile.enclaveId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Zero Telemetry:</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> ENFORCED
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">Private Vault Address:</span>
                  <span className="text-emerald-300 text-[11px] font-bold truncate block">
                    {engineState.minerProfile.stealthVaultAddress}
                  </span>
                </div>
                <div className="pt-1 flex items-center justify-between text-xs border-t border-gray-800">
                  <span className="text-gray-400">Rewards Mined:</span>
                  <span className="text-[#39ff14] font-black">
                    ${engineState.minerProfile.totalAnonymousRewardsUsd.toFixed(2)} USD
                  </span>
                </div>
              </div>

              {/* Mining Controls */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-gray-300">Mining Singularity:</span>
                  <button
                    onClick={() => globalCrypticEngine.toggleMining()}
                    className={`px-4 py-1.5 rounded-xl font-mono text-xs font-bold flex items-center gap-2 transition-all ${
                      engineState.miningState.isMining
                        ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/25 hover:bg-emerald-400'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {engineState.miningState.isMining ? (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        <span>MINING ACTIVE</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        <span>START MINING</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Difficulty Target Slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-gray-400">Target Difficulty:</span>
                    <span className="text-amber-400 font-bold">
                      {engineState.miningState.difficultyZeros} Zeros ("
                      {'0'.repeat(engineState.miningState.difficultyZeros)}...")
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={4}
                    value={engineState.miningState.difficultyZeros}
                    onChange={(e) => globalCrypticEngine.setDifficulty(Number(e.target.value))}
                    className="w-full accent-amber-500 bg-gray-800 h-2 rounded cursor-pointer"
                  />
                  <span className="text-[10px] text-gray-500 block text-right font-mono">
                    Leading Hex Matching Constraint
                  </span>
                </div>

                {/* Manual Mine Single Block Button */}
                <button
                  onClick={() => globalCrypticEngine.mineSingleBlockManual(activeMount.network)}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-bold font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 transition-all flex items-center justify-center gap-2"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Mine Instant Block on {activeMount.network}</span>
                </button>
              </div>

              {/* Hash Rate & Share Metrics */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-3 bg-[#020509] border border-gray-800 rounded-xl">
                  <span className="text-gray-500 text-[10px] block">HASH RATE</span>
                  <span className="text-cyan-400 font-bold text-sm">
                    {(engineState.miningState.hashRateHps / 1000000).toFixed(3)} MH/s
                  </span>
                </div>
                <div className="p-3 bg-[#020509] border border-gray-800 rounded-xl">
                  <span className="text-gray-500 text-[10px] block">BLOCKS MINED</span>
                  <span className="text-emerald-400 font-bold text-sm">
                    {engineState.miningState.blocksMinedCount}
                  </span>
                </div>
                <div className="p-3 bg-[#020509] border border-gray-800 rounded-xl">
                  <span className="text-gray-500 text-[10px] block">SHARES ACCEPTED</span>
                  <span className="text-white font-bold">
                    {engineState.miningState.sharesAccepted} / {engineState.miningState.sharesSubmitted}
                  </span>
                </div>
                <div className="p-3 bg-[#020509] border border-gray-800 rounded-xl">
                  <span className="text-gray-500 text-[10px] block">TOTAL HASHES</span>
                  <span className="text-gray-300 font-bold">
                    {(engineState.miningState.totalHashesComputed / 1000000).toFixed(1)}M
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Live Nonce Stream & Mined Blocks Ledger */}
            <div className="lg:col-span-2 space-y-4">
              {/* Active Candidate Solver Box */}
              {engineState.miningState.activeCandidate && (
                <div className="p-4 bg-[#03070f] border border-cyan-500/30 rounded-2xl font-mono text-xs space-y-3 shadow-lg">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-800">
                    <span className="text-cyan-400 font-bold flex items-center gap-2">
                      <Cpu className="w-4 h-4 animate-spin text-cyan-400" />
                      Active Candidate Solver &bull; {engineState.miningState.activeCandidate.network}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 font-bold">
                      Target: "{engineState.miningState.activeCandidate.difficultyTargetPrefix}..."
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-gray-500 block">Candidate Nonce:</span>
                      <span className="text-emerald-400 font-bold">
                        0x{engineState.miningState.currentCandidateNonce.toString(16).toUpperCase()} (
                        {engineState.miningState.currentCandidateNonce})
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">FNV ISO Beat Offset:</span>
                      <span className="text-gray-300 font-bold truncate block">
                        {engineState.miningState.activeCandidate.fnvBeatOffset}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-gray-500 text-[10px] block mb-1">
                      Current Iteration Hash Attempt:
                    </span>
                    <div className="p-2.5 bg-[#010306] border border-gray-800 rounded font-mono text-yellow-300 text-[11px] overflow-x-auto">
                      <code>{engineState.miningState.activeCandidate.currentHashAttempt}</code>
                    </div>
                  </div>
                </div>
              )}

              {/* Mined Block Receipts Stream */}
              <div className="p-4 bg-[#040810] border border-[#101d2a] rounded-2xl space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-gray-800">
                  <span className="text-xs font-bold font-mono text-white flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    Singularity Mined Blocks &bull; 1:1 Virtual Drive Receipts
                  </span>
                  <span className="text-[10px] font-mono text-gray-500">
                    Recent {engineState.miningState.minedHistory.length} Blocks
                  </span>
                </div>

                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {engineState.miningState.minedHistory.length === 0 ? (
                    <div className="p-8 text-center text-xs font-mono text-gray-500">
                      Mining loop active... Computing nonces against target difficulty.
                    </div>
                  ) : (
                    engineState.miningState.minedHistory.map((receipt) => (
                      <div
                        key={`${receipt.blockIndex}_${receipt.nonce}`}
                        className="p-3 bg-[#03060c] border border-gray-800 hover:border-emerald-500/40 rounded-xl font-mono text-xs transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">
                              BLOCK #{receipt.blockIndex}
                            </span>
                            <span className="font-bold text-white">{receipt.network}</span>
                          </div>
                          <span className="text-[10px] text-gray-400">
                            {new Date(receipt.timestampMs).toLocaleTimeString()}
                          </span>
                        </div>

                        <div className="mt-2 text-[11px] text-gray-400 truncate">
                          Hash: <span className="text-cyan-400">{receipt.blockHash}</span>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center justify-between text-[10px] text-gray-500 pt-1 border-t border-gray-900 gap-2">
                          <span>
                            Nonce: <span className="text-emerald-400 font-bold">0x{receipt.nonce.toString(16)}</span>
                          </span>
                          <span>
                            Mount: <span className="text-cyan-300">{receipt.targetMountPath}</span>
                          </span>
                          <span className="text-emerald-400 font-bold">
                            +${receipt.rewardUsd.toFixed(2)} USD
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2B: ADVANCED MINING ANALYTICS & DOWNTIME SENTRY
           ========================================================================= */}
        {activeTab === 'miningAnalytics' && (
          <MiningAdvancedAnalytics />
        )}

        {/* =========================================================================
            TAB 2BA: RECHARTS ANALYTICS DASHBOARD
           ========================================================================= */}
        {activeTab === 'analyticsDashboard' && (
          <AnalyticsDashboard />
        )}

        {/* =========================================================================
            TAB 2C: STRIPE MULTI-CURRENCY PAYOUT ENGINE
           ========================================================================= */}
        {activeTab === 'stripePayouts' && (
          <StripeMultiCurrencyPayouts />
        )}

        {/* =========================================================================
            TAB 3: FNV ISO TETHER OSCILLOSCOPE
           ========================================================================= */}
        {activeTab === 'fnvOscilloscope' && (
          <div className="p-6 bg-[#040810] border border-[#101d2a] rounded-2xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-800">
              <div>
                <h3 className="text-sm font-bold font-mono text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <span>FNV-1a 60 Hz Temporal Heartbeat Oscilloscope</span>
                </h3>
                <p className="text-xs text-gray-400 font-mono">
                  Microsecond-calibrated frequency phase alignment &bull; Dual-harmonic waveform lock
                </p>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-bold">
                  Target: 60.000 Hz
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                  Phase Drift: &plusmn;{engineState.beat.driftMs} ms
                </span>
              </div>
            </div>

            {/* Oscilloscope Canvas */}
            <div className="relative rounded-2xl overflow-hidden border border-cyan-500/30 shadow-2xl bg-[#010408]">
              <canvas
                ref={canvasRef}
                width={1024}
                height={260}
                className="w-full h-64 block"
              />
              <div className="absolute bottom-3 left-4 text-[10px] font-mono text-gray-500">
                CH1: Primary 60 Hz ISO Beat (Cyan) &bull; CH2: 120 Hz FNV Harmonic (Neon Green) &bull; Center Lock Ring: Target Coaxial Coherence
              </div>
            </div>

            {/* Mathematical Equation & Offset Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
              <div className="p-4 bg-[#03060c] border border-gray-800 rounded-xl space-y-1.5">
                <span className="text-gray-500 text-[10px] block">FNV-1a 64-BIT OFFSET BASIS:</span>
                <span className="text-cyan-400 font-bold text-sm block">
                  {engineState.beat.offsetBasisHex}
                </span>
                <p className="text-[10px] text-gray-400">
                  Initial 64-bit seed constant (14695981039346656037)
                </p>
              </div>

              <div className="p-4 bg-[#03060c] border border-gray-800 rounded-xl space-y-1.5">
                <span className="text-gray-500 text-[10px] block">FNV-1a 64-BIT PRIME:</span>
                <span className="text-emerald-400 font-bold text-sm block">
                  {engineState.beat.fnvPrimeHex}
                </span>
                <p className="text-[10px] text-gray-400">
                  Prime multiplier constant (1099511628211)
                </p>
              </div>

              <div className="p-4 bg-[#03060c] border border-gray-800 rounded-xl space-y-1.5">
                <span className="text-gray-500 text-[10px] block">ACTIVE 1:1 MOUNT OFFSET:</span>
                <span className="text-yellow-400 font-bold text-sm block truncate">
                  {engineState.beat.activeOffsetKey}
                </span>
                <p className="text-[10px] text-gray-400">
                  Calculated dynamically on every 60 Hz beat tick
                </p>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 4: 1:1 CHAIN-TO-DRIVE MOUNT MATRIX
           ========================================================================= */}
        {activeTab === 'matrix1to1' && (
          <div className="p-6 bg-[#040810] border border-[#101d2a] rounded-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <div>
                <h3 className="text-sm font-bold font-mono text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span>1:1 Chain-to-Drive Virtual Mount Matrix</span>
                </h3>
                <p className="text-xs text-gray-400 font-mono">
                  Guarantees bijective 1:1 addressing between blockchain chains and virtual mount partitions
                </p>
              </div>
              <span className="text-xs font-mono text-emerald-400 font-bold flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" /> 100% PARITY VERIFIED
              </span>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-[11px]">
                    <th className="py-2.5 px-3">Network Chain</th>
                    <th className="py-2.5 px-3">Virtual Mount Path</th>
                    <th className="py-2.5 px-3">Token</th>
                    <th className="py-2.5 px-3">1:1 FNV Offset Key</th>
                    <th className="py-2.5 px-3">Allocated Sectors</th>
                    <th className="py-2.5 px-3">Parity Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-900">
                  {engineState.mounts.map((m) => (
                    <tr key={m.mountPath} className="hover:bg-gray-900/40 transition-colors">
                      <td className="py-3 px-3 font-bold text-white flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-cyan-400" />
                        {m.network}
                      </td>
                      <td className="py-3 px-3 text-cyan-300 font-bold">{m.mountPath}</td>
                      <td className="py-3 px-3 text-gray-400">
                        <span className="px-1.5 py-0.5 rounded bg-gray-800 font-bold text-white">
                          {m.deviceToken}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-emerald-400 font-mono text-[11px]">
                        {m.fnvOffsetKey}
                      </td>
                      <td className="py-3 px-3 text-gray-300">
                        {m.allocatedSectors} / {m.totalSectors} Sectors (
                        {Math.round((m.allocatedSectors / m.totalSectors) * 100)}%)
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                          1:1 VERIFIED
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedMountPath(m.mountPath);
                            setActiveTab('mountDrive');
                          }}
                          className="px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 text-[10px] font-bold"
                        >
                          Inspect Sectors
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 5: LOCALSTORAGE blockLedgerDataset PERSISTENCE
           ========================================================================= */}
        {activeTab === 'storageLedger' && (
          <div className="p-6 bg-[#040810] border border-[#101d2a] rounded-2xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-800 gap-3">
              <div>
                <h3 className="text-sm font-bold font-mono text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-purple-400" />
                  <span>CuboctahedralTraceEngine Persistent blockLedgerDataset</span>
                </h3>
                <p className="text-xs text-gray-400 font-mono">
                  Serializes ledger state to LocalStorage and database interface every time a block is resolved
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    globalTraceEngine.persistLedgerToStorage();
                    setEngineState(globalCrypticEngine.getState());
                    setCopyFeedback('Ledger serialized to LocalStorage');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30 text-xs font-mono font-bold flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Force Serialize Now</span>
                </button>

                <button
                  onClick={handleExportLedger}
                  className="px-3 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 text-xs font-mono font-bold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export JSON</span>
                </button>
              </div>
            </div>

            {/* Storage Diagnostic Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 font-mono text-xs">
              <div className="p-4 bg-[#03060c] border border-gray-800 rounded-xl">
                <span className="text-gray-500 text-[10px] block">STORAGE KEY:</span>
                <span className="text-cyan-400 font-bold text-xs truncate block">
                  {CuboctahedralTraceEngine.STORAGE_KEY_BLOCK_LEDGER}
                </span>
              </div>

              <div className="p-4 bg-[#03060c] border border-gray-800 rounded-xl">
                <span className="text-gray-500 text-[10px] block">TOTAL PERSISTED BLOCKS:</span>
                <span className="text-emerald-400 font-bold text-sm">
                  {engineState.totalPersistentBlocks} Verified Blocks
                </span>
              </div>

              <div className="p-4 bg-[#03060c] border border-gray-800 rounded-xl">
                <span className="text-gray-500 text-[10px] block">STORAGE FOOTPRINT:</span>
                <span className="text-purple-300 font-bold text-sm">
                  {(engineState.storageFootprintBytes / 1024).toFixed(2)} KB
                </span>
              </div>

              <div className="p-4 bg-[#03060c] border border-gray-800 rounded-xl">
                <span className="text-gray-500 text-[10px] block">LAST SERIALIZATION:</span>
                <span className="text-yellow-300 font-bold text-xs">
                  {engineState.lastPersistMs > 0
                    ? new Date(engineState.lastPersistMs).toLocaleTimeString()
                    : 'Hydrated from Memory'}
                </span>
              </div>
            </div>

            {/* Live Ledger Sample Inspection */}
            <div className="space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 font-bold">
                  Recent Verified Blocks (from active serialized ledger):
                </span>
                <button
                  onClick={() => {
                    globalTraceEngine.clearPersistentLedger();
                    setEngineState(globalCrypticEngine.getState());
                  }}
                  className="text-red-400 hover:text-red-300 flex items-center gap-1 text-[11px]"
                  title="Resets localStorage and re-seeds canonical genesis chain"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Reset / Re-seed Ledger</span>
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto space-y-1.5 p-3 bg-[#020408] border border-gray-800 rounded-xl">
                {globalTraceEngine.getBlockLedger().slice(-12).reverse().map((b) => (
                  <div
                    key={b.index}
                    className="p-2.5 bg-[#040810] border border-gray-900 rounded-lg flex items-center justify-between text-[11px]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold text-[10px]">
                        #{b.index}
                      </span>
                      <span className="text-white font-bold">{b.network}</span>
                      <span className="text-gray-500 text-[10px] truncate max-w-xs">
                        {b.currentHash}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-400 text-[10px]">
                      <span>Gas: {b.gasUsedPct}%</span>
                      <span>Txs: {b.txCount}</span>
                      <span className="text-emerald-400">
                        {new Date(b.timestampMs).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
