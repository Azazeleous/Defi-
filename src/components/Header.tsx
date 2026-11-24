import React from 'react';
import { Cpu, ShieldCheck, Zap, Activity, Radio, Globe, Sparkles, Orbit, HardDrive, Tv, Clock, Eye, TrendingUp, Shield } from 'lucide-react';

interface Props {
  lastUpdated: string;
  isEngineActive: boolean;
  onToggleEngine: () => void;
  activeMode: 'mining-arbitrage' | 'arbitrage' | 'subsea' | 'quantum' | 'gaia' | 'nexus' | 'cryptic' | 'cec' | 'genesis' | 'uclk' | 'cryptic-platform' | 'singularity' | 'ai-mining' | 'mining-reports';
  onChangeMode: (mode: 'mining-arbitrage' | 'arbitrage' | 'subsea' | 'quantum' | 'gaia' | 'nexus' | 'cryptic' | 'cec' | 'genesis' | 'uclk' | 'cryptic-platform' | 'singularity' | 'ai-mining' | 'mining-reports') => void;
  subseaLatencyMs: number;
  onOpenCoprimeGrid?: () => void;
  onOpenCapacityModal?: () => void;
  onOpenMfaSecurity?: () => void;
  isMooncakeActive?: boolean;
  onTriggerMooncake?: () => void;
  onOpenV7Grimoire?: () => void;
  onToggleClearUi?: () => void;
  isUiCleared?: boolean;
}

export const Header: React.FC<Props> = ({
  lastUpdated,
  isEngineActive,
  onToggleEngine,
  activeMode,
  onChangeMode,
  subseaLatencyMs,
  onOpenCoprimeGrid,
  onOpenCapacityModal,
  onOpenMfaSecurity,
  isMooncakeActive = false,
  onTriggerMooncake,
  onOpenV7Grimoire,
  onToggleClearUi,
  isUiCleared = false,
}) => {
  return (
    <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-6 py-3">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Brand & Subtitle with Top-Left Calculus Coprime 4D Trigger */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenCoprimeGrid}
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 via-blue-600 to-purple-600 p-0.5 shadow-lg shadow-cyan-500/25 flex items-center justify-center shrink-0 cursor-pointer group hover:scale-105 active:scale-95 transition-all relative"
            title="Reveal Calculus Coprime Grid 4th Dimension Live Graphing Computations"
          >
            <div className="w-full h-full bg-gray-950 rounded-[10px] flex items-center justify-center relative overflow-hidden group-hover:bg-gray-900 transition-colors">
              <Zap className="w-5 h-5 text-cyan-400 group-hover:text-white transition-colors" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#39ff14] rounded-full border border-gray-950 animate-ping" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#39ff14] rounded-full border border-gray-950" />
            </div>
          </button>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                DeFi Arbitrage Engine
              </h1>
              <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
                GAIA EYES
              </span>
              {onOpenCoprimeGrid && (
                <button
                  onClick={onOpenCoprimeGrid}
                  className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors font-semibold"
                  title="Click to reveal Calculus Coprime Grid 4D visual representation"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span>4D COPRIME GRID</span>
                </button>
              )}
              {onOpenCapacityModal && (
                <button
                  onClick={onOpenCapacityModal}
                  className="hidden md:inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors font-semibold"
                  title="Open Neural Parameter Capacity Budget (P_total) & Invariant State Recurrence (I_{t+1}) Engine"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>P_TOTAL &bull; I_&#123;t+1&#125;</span>
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400">
              Bellman-Ford Cyclic Path Detection &bull; Multi-Network Atomic Swap Execution &bull; Zero-Knowledge Verifier
            </p>
          </div>
        </div>

        {/* Workspace Mode Switcher (Quad Substrate Navigation) */}
        <div className="flex items-center bg-gray-900/90 border border-gray-800 p-1 rounded-xl self-start lg:self-auto overflow-x-auto max-w-full">
          <button
            onClick={() => onChangeMode('mining-arbitrage')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeMode === 'mining-arbitrage'
                ? 'bg-sky-600 text-white font-semibold'
                : 'text-sky-300 hover:text-white hover:bg-gray-800/60'
            }`}
            title="Live Hash Rate (Chart.js), Node Connectivity & Bellman-Ford Arbitrage Feed"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Mining &amp; Bellman-Ford</span>
          </button>

          <button
            onClick={() => onChangeMode('arbitrage')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0 ${
              activeMode === 'arbitrage'
                ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-500/20'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Arbitrage</span>
          </button>

          <button
            onClick={() => onChangeMode('subsea')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeMode === 'subsea'
                ? 'bg-[#00f0ff] text-black font-bold shadow-md shadow-[#00f0ff]/20'
                : 'text-[#00f0ff]/80 hover:text-[#00f0ff] hover:bg-gray-800/60'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>NODE_09 Subsea</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#39ff14] animate-pulse" />
          </button>

          <button
            onClick={() => onChangeMode('quantum')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeMode === 'quantum'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold shadow-md shadow-purple-500/20'
                : 'text-purple-300 hover:text-white hover:bg-gray-800/60'
            }`}
            title="Quantum Rose Convergence v7 + ColorManager + PIC Bitwise + Tuning Capsule"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Rose v7 / Quantum</span>
          </button>

          {onOpenV7Grimoire && (
            <button
              onClick={onOpenV7Grimoire}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap text-cyan-200 hover:text-white hover:bg-cyan-500/15 border border-cyan-500/30"
              title="Open Dreaming Grimoire v7, Macro Image Studio & Cosmic Guardian Void()"
            >
              <Orbit className="w-3.5 h-3.5 text-cyan-400" />
              <span>Grimoire &amp; Void</span>
            </button>
          )}

          <button
            onClick={() => onChangeMode('gaia')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeMode === 'gaia'
                ? 'bg-[#ffb700] text-black font-bold shadow-md shadow-[#ffb700]/30'
                : 'text-[#ffb700] hover:text-white hover:bg-gray-800/60'
            }`}
          >
            <Orbit className="w-3.5 h-3.5" />
            <span>GAIA EYES &bull; AE.SL6</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#39ff14] animate-pulse" />
          </button>

          <button
            onClick={() => onChangeMode('nexus')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeMode === 'nexus'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-black font-bold shadow-md shadow-emerald-500/25'
                : 'text-emerald-400 hover:text-white hover:bg-gray-800/60'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>NEXUS v4.5</span>
          </button>

          <button
            onClick={() => onChangeMode('cryptic')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeMode === 'cryptic'
                ? 'bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 text-black font-black shadow-md shadow-cyan-500/30'
                : 'text-cyan-300 hover:text-white hover:bg-gray-800/60'
            }`}
            title="Mining Pool Singularity & Virtual Mountable Drive with FNV ISO Tether"
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>CrypticGraphing</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#39ff14] animate-pulse" />
          </button>

          <button
            onClick={() => onChangeMode('cec')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeMode === 'cec'
                ? 'bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 text-black font-black shadow-md shadow-cyan-500/30'
                : 'text-cyan-400 hover:text-white hover:bg-gray-800/60'
            }`}
            title="Nexus CEC HTTP Gateway: Roku, FireTV ADB, USB Pulse-Eight, Samsung A15 Bridge (:7684)"
          >
            <Tv className="w-3.5 h-3.5" />
            <span>CEC Gateway</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#39ff14] animate-pulse" />
          </button>

          <button
            onClick={() => onChangeMode('genesis')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeMode === 'genesis'
                ? 'bg-gradient-to-r from-cyan-400 via-emerald-400 to-purple-500 text-black font-black shadow-md shadow-cyan-400/40 ring-1 ring-white'
                : 'text-cyan-300 hover:text-white hover:bg-gray-800/60'
            }`}
            title="GENESIS v7 + XR MONOLITH & ONEIROS Chronosphere Dreamscape + Journal"
          >
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>GENESIS XR</span>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
          </button>

          <button
            onClick={() => onChangeMode('uclk')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0 ${
              activeMode === 'uclk'
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/60 font-semibold'
                : 'text-cyan-300/90 hover:text-white hover:bg-gray-800/60'
            }`}
            title="HCCGN Universal Clock & Adaptive Computation Engine (HCCGN.UCLK.DUAL.ADAPTIVE v1.0)"
          >
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Universal Clock</span>
          </button>

          <button
            onClick={() => onChangeMode('cryptic-platform')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0 ${
              activeMode === 'cryptic-platform'
                ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/60 font-semibold'
                : 'text-emerald-300/90 hover:text-white hover:bg-gray-800/60'
            }`}
            title="HCCGN CRYPTIC Platform — 14-View Instant Miner, Instant Solver, TCP Stratum, SQLite Ledger & Stripe Connect"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>CRYPTIC Platform</span>
          </button>

          <button
            onClick={() => onChangeMode('singularity')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0 ${
              activeMode === 'singularity'
                ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/60 font-bold'
                : 'text-cyan-300/90 hover:text-white hover:bg-gray-800/60'
            }`}
            title="GAIA / NEXUS Unified Singularity, CRYPTIC Cube & Verifiable History (Spec v1.0.0)"
          >
            <Orbit className="w-3.5 h-3.5 text-cyan-400 animate-spin-slow" />
            <span>Singularity v1.0</span>
          </button>

          <button
            onClick={() => onChangeMode('ai-mining')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
              activeMode === 'ai-mining'
                ? 'bg-gradient-to-r from-cyan-500 to-emerald-500 text-black font-extrabold shadow-md shadow-cyan-500/30'
                : 'text-emerald-300 hover:text-white hover:bg-gray-800/60'
            }`}
            title="AI Mining Application Operational Command Dashboard (Hashrate, Throughput, Latency, Earnings & Downtime Alerts)"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>AI Mining</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#39ff14] animate-pulse" />
          </button>

          <button
            onClick={() => onChangeMode('mining-reports')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
              activeMode === 'mining-reports'
                ? 'bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-extrabold shadow-md shadow-purple-500/30'
                : 'text-purple-300 hover:text-white hover:bg-gray-800/60'
            }`}
            title="Advanced Analytics & Predictive Reporting Module (Custom Reports, Forecasting & What-If Hardware Expansion)"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Analytics &amp; Reports</span>
          </button>
        </div>

        {/* Engine Telemetry Status Badges */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {/* Mooncake Enclave Quick Trigger */}
          {onTriggerMooncake && (
            <button
              onClick={onTriggerMooncake}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border font-mono transition-all cursor-pointer ${
                isMooncakeActive
                  ? 'bg-amber-500/20 text-amber-300 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.4)] animate-pulse'
                  : 'bg-gray-900 border-gray-800 text-amber-400/80 hover:text-amber-300 hover:border-amber-500/40'
              }`}
              title="Unlock Mooncake Enclave Protocol (Synodic Lunar Cycle & 888.88 SATS)"
            >
              <span className="text-sm">🥮</span>
              <span className="font-bold">{isMooncakeActive ? '888.88 SATS' : 'Mooncake'}</span>
            </button>
          )}

          {/* Subsea Fiber Latency Bridge */}
          <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 px-3 py-1.5 rounded-lg font-mono">
            <span className="text-gray-400">Subsea RTT:</span>
            <span className="text-cyan-400 font-bold">{subseaLatencyMs.toFixed(1)} ms</span>
          </div>

          {/* Multi-Factor Authentication (MFA) Security Enclave Button */}
          {onOpenMfaSecurity && (
            <button
              onClick={onOpenMfaSecurity}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 font-mono text-xs transition-all cursor-pointer shadow-sm hover:border-emerald-400"
              title="Multi-Factor Authentication (MFA) Security Enclave (Authenticator Apps, SMS & Backup Keys)"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-semibold">MFA Security</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#39ff14] animate-pulse" />
            </button>
          )}

          {/* Engine Power Switch */}
          <button
            onClick={onToggleEngine}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-medium transition-all ${
              isEngineActive
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-red-500/10 text-red-300 border-red-500/30 hover:bg-red-500/20'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${isEngineActive ? 'animate-pulse text-emerald-400' : 'text-red-400'}`} />
            <span>{isEngineActive ? 'Active' : 'Halted'}</span>
          </button>

          {/* Clear UI & Reveal Background Animation Icon Button */}
          {onToggleClearUi && (
            <button
              onClick={onToggleClearUi}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono text-xs transition-all cursor-pointer ${
                isUiCleared
                  ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.4)] animate-pulse'
                  : 'bg-gray-900 border-gray-800 text-cyan-400 hover:text-white hover:border-cyan-500/40'
              }`}
              title={isUiCleared ? 'Restore UI Overlay' : 'Clear UI & Reveal Background Void Animation'}
            >
              {isUiCleared ? <Sparkles className="w-3.5 h-3.5 text-cyan-300" /> : <Eye className="w-3.5 h-3.5 text-cyan-400" />}
              <span className="hidden sm:inline">{isUiCleared ? 'Restore UI' : 'Clear UI'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
