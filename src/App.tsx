/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { MetricsOverview } from './components/MetricsOverview';
import { ArbitrageOpportunities } from './components/ArbitrageOpportunities';
import { ArbitrageActivityLog } from './components/ArbitrageActivityLog';
import { ArbitrageAuditLog } from './components/ArbitrageAuditLog';
import { CalculusCoprimeGridModal } from './components/CalculusCoprimeGridModal';
import { ExecutionDetailModal } from './components/ExecutionDetailModal';
import { SubseaGISWorkspace } from './components/SubseaGISWorkspace';
import { QuantumWorkspace } from './components/QuantumWorkspace';
import { GaiaEyesWorkspace } from './components/GaiaEyesWorkspace';
import { NexusPerpetualWorkspace } from './components/NexusPerpetualWorkspace';
import { CrypticGraphingWorkspace } from './components/CrypticGraphingWorkspace';
import { TradeExecution, ArbitrageOpportunity, EngineStats } from './types/arbitrage';
import { 
  getInitialTradeHistory, 
  generateSingleTrade, 
  INITIAL_OPPORTUNITIES 
} from './data/mockData';
import { 
  globalTraceEngine, 
  LiveChainBlock 
} from './engine/cuboctahedralTraceEngine';
import { globalUdevWatcher, UdevStorageEvent } from './engine/udevStorageWatcher';
import { ShieldCheck, Zap, Cpu, FileJson } from 'lucide-react';
import { NexusCecGateway } from './components/NexusCecGateway';
import { GenesisXrMonolith, type GenesisSubView } from './components/GenesisXrMonolith';
import { UniversalClockWorkspace } from './components/UniversalClockWorkspace';
import { CrypticPlatformWorkspace } from './components/CrypticPlatformWorkspace';
import { CosmicGuardianVoidCanvas } from './components/CosmicGuardianVoidCanvas';
import { FourDimensionalHypergeometricWorkspace } from './components/FourDimensionalHypergeometricWorkspace';
import { UnifiedSingularityWorkspace } from './components/UnifiedSingularityWorkspace';
import { FlightHudOverlay } from './components/FlightHudOverlay';
import { NeuralInvariantCapacityModal } from './components/NeuralInvariantCapacityModal';
import { AiMiningDashboard } from './components/AiMiningDashboard';
import { AiMiningAnalyticsReporting } from './components/AiMiningAnalyticsReporting';
import { MfaSecurityModal } from './components/MfaSecurityModal';
import { MiningArbitrageCommandDashboard } from './components/MiningArbitrageCommandDashboard';

export default function App() {
  const [workspaceMode, setWorkspaceMode] = useState<'mining-arbitrage' | 'arbitrage' | 'subsea' | 'quantum' | 'gaia' | 'nexus' | 'cryptic' | 'cec' | 'genesis' | 'uclk' | 'cryptic-platform' | 'singularity' | 'ai-mining' | 'mining-reports'>('mining-arbitrage');
  const [isMfaModalOpen, setIsMfaModalOpen] = useState<boolean>(false);
  const [genesisInitialSubView, setGenesisInitialSubView] = useState<GenesisSubView>('split');
  const [subseaLatencyMs, setSubseaLatencyMs] = useState<number>(64.2);

  // Sub-view within Arbitrage Dashboard: 'radar' (Live Feed) vs 'auditLog' (Block Ledger)
  const [arbitrageView, setArbitrageView] = useState<'radar' | 'auditLog'>('radar');
  const [isCoprimeGridOpen, setIsCoprimeGridOpen] = useState<boolean>(false);
  const [is4DWorkspaceOpen, setIs4DWorkspaceOpen] = useState<boolean>(false);
  const [isCapacityModalOpen, setIsCapacityModalOpen] = useState<boolean>(false);

  // Live block ledger dataset state from globalTraceEngine
  const [blockLedger, setBlockLedger] = useState<readonly LiveChainBlock[]>(() =>
    globalTraceEngine.getBlockLedger()
  );

  // Subscribe to persistent blockLedger updates from CuboctahedralTraceEngine
  useEffect(() => {
    const unsubscribe = globalTraceEngine.subscribeLedger((updatedLedger) => {
      setBlockLedger(updatedLedger);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to udev storage monitoring events and inject drop/corruption alerts into the ledger
  useEffect(() => {
    const unsubscribeUdev = globalUdevWatcher.subscribe((event: UdevStorageEvent) => {
      if (event.severity === 'CRITICAL' || event.severity === 'WARNING') {
        // Resolve a special udev storage event block onto the persistent ledger
        globalTraceEngine.resolveCustomBlockchainBlock(
          999900 + Math.floor(Math.random() * 1000),
          `UDEV_STORAGE_ALERT:[${event.eventType}:${event.devicePath}]`,
          BigInt(event.timestampMs % 1000000)
        );
        setBlockLedger([...globalTraceEngine.getBlockLedger()]);
      }
    });
    return () => unsubscribeUdev();
  }, []);

  const [trades, setTrades] = useState<TradeExecution[]>(() => getInitialTradeHistory(16));
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>(INITIAL_OPPORTUNITIES);
  const [isLive, setIsLive] = useState<boolean>(true);
  const [isEngineActive, setIsEngineActive] = useState<boolean>(true);
  const [selectedTrade, setSelectedTrade] = useState<TradeExecution | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toLocaleTimeString());
  const [isMooncakeActive, setIsMooncakeActive] = useState<boolean>(false);
  const [isUiCleared, setIsUiCleared] = useState<boolean>(false);
  const [activeHypergeometricLevel, setActiveHypergeometricLevel] = useState<number>(1);

  // Statistics
  const [stats, setStats] = useState<EngineStats>({
    throughput: 482,
    activeOpportunities: 4,
    totalProfit24h: 18450.75,
    avgSlippagePct: 0.038,
    avgLatencyMs: 14,
    solvedCyclesCount: 1420,
  });

  // Calculate live dynamic metrics based on trades and subsea latency
  useEffect(() => {
    if (trades.length === 0) return;

    const recentSlice = trades.slice(0, 30);
    const avgSlippage = recentSlice.reduce((sum, t) => sum + t.slippagePct, 0) / recentSlice.length;
    // Modulate execution latency by physical subsea fiber cable RTT
    const baseLatency = Math.round(recentSlice.reduce((sum, t) => sum + t.executionLatencyMs, 0) / recentSlice.length);
    const modulatedLatency = Math.round(baseLatency * (subseaLatencyMs / 64.2));
    const profitSum = trades.reduce((sum, t) => sum + t.netProfitUsd, 0);

    setStats((prev) => ({
      ...prev,
      avgSlippagePct: +avgSlippage.toFixed(3),
      avgLatencyMs: Math.max(8, modulatedLatency),
      totalProfit24h: +(18450.75 + profitSum * 0.1).toFixed(2),
    }));
  }, [trades, subseaLatencyMs]);

  // Periodic trade execution simulator
  useEffect(() => {
    if (!isLive || !isEngineActive) return;

    const streamInterval = setInterval(() => {
      // Generate a new trade execution with latency scaled by subsea condition
      const newTrade = generateSingleTrade();
      newTrade.executionLatencyMs = Math.round(newTrade.executionLatencyMs * (subseaLatencyMs / 64.2));

      setTrades((prevTrades) => {
        const next = [newTrade, ...prevTrades];
        if (next.length > 100) return next.slice(0, 100);
        return next;
      });

      const lvlMultipliers: Record<number, number> = { 1: 1.42, 2: 2.10, 3: 3.85, 4: 5.20, 5: 8.40, 6: 14.2 };
      const currentMult = lvlMultipliers[activeHypergeometricLevel] || 1.42;

      // Generate a new block on the persistent ledger matching trade execution and active hypergeometric level
      globalTraceEngine.resolveCustomBlockchainBlock(
        stats.solvedCyclesCount + 1,
        `SIG_LVL${activeHypergeometricLevel}_${newTrade.id.slice(0, 8)}`,
        BigInt(Math.floor(newTrade.netProfitUsd * 1000 * currentMult))
      );
      setBlockLedger([...globalTraceEngine.getBlockLedger()]);

      // Fluctuate network throughput scaled by active hypergeometric level
      setStats((prev) => ({
        ...prev,
        throughput: Math.floor((420 + Math.random() * 210) * (currentMult / 1.42)),
        activeOpportunities: Math.floor(3 + Math.random() * 5),
        solvedCyclesCount: prev.solvedCyclesCount + 1,
      }));

      setLastUpdated(new Date().toLocaleTimeString());
    }, 3200);

    return () => clearInterval(streamInterval);
  }, [isLive, isEngineActive, subseaLatencyMs, stats.solvedCyclesCount, activeHypergeometricLevel]);

  // Manually trigger execution of an opportunity
  const handleExecuteOpportunity = useCallback((opp: ArbitrageOpportunity) => {
    const now = Date.now();
    const d = new Date(now);
    const pad = (n: number, z = 2) => ('00' + n).slice(-z);
    const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;

    const customTrade: TradeExecution = {
      id: `manual-${now}`,
      txHash: `0x${Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
      timestamp: timeStr,
      rawTimestamp: now,
      network: opp.network,
      tokenPair: opp.path.join(' → '),
      routeDEXs: opp.dexes,
      amountIn: '10.0 ETH equivalent',
      amountOut: `${(10.0 * (1 + opp.expectedProfitPct / 100)).toFixed(4)} ETH`,
      slippagePct: opp.estSlippagePct,
      slippageThreshold: +(opp.estSlippagePct + 0.1).toFixed(2),
      netProfitUsd: opp.expectedProfitUsd,
      netProfitPct: opp.expectedProfitPct,
      executionLatencyMs: Math.round(12 * (subseaLatencyMs / 64.2)),
      gasFeeUsd: opp.gasCostUsd,
      status: 'ZK-Verified',
      algorithm: 'Bellman-Ford Cyclic',
      blockNumber: 19842500 + Math.floor(Math.random() * 200),
    };

    setTrades((prev) => [customTrade, ...prev]);
    setSelectedTrade(customTrade);

    // Resolve verified block onto block ledger dataset
    globalTraceEngine.resolveCustomBlockchainBlock(
      customTrade.blockNumber,
      `SIG_MARA_MANUAL_${customTrade.id.slice(-6)}`,
      BigInt(Math.floor(customTrade.netProfitUsd * 1000))
    );
    setBlockLedger([...globalTraceEngine.getBlockLedger()]);
  }, [subseaLatencyMs]);

  return (
    <div className="min-h-screen bg-[#04070D] text-gray-100 flex flex-col font-sans antialiased relative selection:bg-blue-500/30 selection:text-blue-200">
      {/* Full-App WebGL2 Cosmic Guardian Void() Backdrop */}
      <CosmicGuardianVoidCanvas />

      {/* Ambient Flight HUD when UI is cleared */}
      {isUiCleared && (
        <FlightHudOverlay
          onRestoreUi={() => setIsUiCleared(false)}
          currentLevel={activeHypergeometricLevel}
          onSelectLevel={(lvl) => setActiveHypergeometricLevel(lvl)}
        />
      )}

      <div className="relative z-10 flex-1 flex flex-col">
      {/* Top Navigation & Status Header with 4D Coprime Trigger */}
      <Header
        lastUpdated={lastUpdated}
        isEngineActive={isEngineActive}
        onToggleEngine={() => setIsEngineActive(!isEngineActive)}
        activeMode={workspaceMode}
        onChangeMode={(m) => {
          if (m === 'genesis') setGenesisInitialSubView('split');
          setWorkspaceMode(m);
        }}
        subseaLatencyMs={subseaLatencyMs}
        onOpenCoprimeGrid={() => setIs4DWorkspaceOpen(true)}
        onOpenCapacityModal={() => setIsCapacityModalOpen(true)}
        onOpenMfaSecurity={() => setIsMfaModalOpen(true)}
        isMooncakeActive={isMooncakeActive}
        onTriggerMooncake={() => {
          setGenesisInitialSubView('split');
          setWorkspaceMode('genesis');
          setIsMooncakeActive((prev) => !prev);
        }}
        onOpenV7Grimoire={() => {
          setGenesisInitialSubView('grimoire');
          setWorkspaceMode('genesis');
        }}
        onToggleClearUi={() => setIsUiCleared((prev) => !prev)}
        isUiCleared={isUiCleared}
      />

      {/* Main Workspace Body with Clear UI Transition */}
      <div className={`flex-1 flex flex-col transition-opacity duration-700 ${isUiCleared ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      {workspaceMode === 'mining-arbitrage' ? (
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
          <MiningArbitrageCommandDashboard subseaLatencyMs={subseaLatencyMs} />
        </main>
      ) : workspaceMode === 'subsea' ? (
        <div className="flex-1 flex flex-col h-[calc(100vh-65px)]">
          <SubseaGISWorkspace
            onSwitchToArbitrage={() => setWorkspaceMode('arbitrage')}
            onUpdateSubseaLatency={(lat) => setSubseaLatencyMs(lat)}
          />
        </div>
      ) : workspaceMode === 'quantum' ? (
        <div className="flex-1 flex flex-col h-[calc(100vh-65px)]">
          <QuantumWorkspace
            onSwitchToArbitrage={() => setWorkspaceMode('arbitrage')}
            onSwitchToSubsea={() => setWorkspaceMode('subsea')}
          />
        </div>
      ) : workspaceMode === 'gaia' ? (
        <div className="flex-1 flex flex-col h-[calc(100vh-65px)]">
          <GaiaEyesWorkspace
            onSwitchToArbitrage={() => setWorkspaceMode('arbitrage')}
            onSwitchToSubsea={() => setWorkspaceMode('subsea')}
            onSwitchToQuantum={() => setWorkspaceMode('quantum')}
          />
        </div>
      ) : workspaceMode === 'nexus' ? (
        <div className="flex-1 flex flex-col h-[calc(100vh-65px)]">
          <NexusPerpetualWorkspace
            onSwitchToArbitrage={() => setWorkspaceMode('arbitrage')}
            onSwitchToSubsea={() => setWorkspaceMode('subsea')}
            onSwitchToQuantum={() => setWorkspaceMode('quantum')}
            onSwitchToGaia={() => setWorkspaceMode('gaia')}
          />
        </div>
      ) : workspaceMode === 'cryptic' ? (
        <div className="flex-1 flex flex-col min-h-[calc(100vh-65px)]">
          <CrypticGraphingWorkspace />
        </div>
      ) : workspaceMode === 'cec' ? (
        <div className="flex-1 flex flex-col min-h-[calc(100vh-65px)]">
          <NexusCecGateway />
        </div>
      ) : workspaceMode === 'uclk' ? (
        <div className="flex-1 flex flex-col min-h-[calc(100vh-65px)]">
          <UniversalClockWorkspace />
        </div>
      ) : workspaceMode === 'cryptic-platform' ? (
        <div className="flex-1 flex flex-col min-h-[calc(100vh-65px)]">
          <CrypticPlatformWorkspace />
        </div>
      ) : workspaceMode === 'singularity' ? (
        <div className="flex-1 flex flex-col min-h-[calc(100vh-65px)]">
          <UnifiedSingularityWorkspace />
        </div>
      ) : workspaceMode === 'ai-mining' ? (
        <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
          <AiMiningDashboard
            onOpenMfaSecurity={() => setIsMfaModalOpen(true)}
            onOpenReports={() => setWorkspaceMode('mining-reports')}
            subseaLatencyMs={subseaLatencyMs}
          />
        </div>
      ) : workspaceMode === 'mining-reports' ? (
        <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
          <AiMiningAnalyticsReporting />
        </div>
      ) : workspaceMode === 'genesis' ? (
        <div className="flex-1 flex flex-col min-h-[calc(100vh-65px)]">
          <GenesisXrMonolith
            onExit={() => setWorkspaceMode('arbitrage')}
            isMooncakeActive={isMooncakeActive}
            onToggleMooncake={() => setIsMooncakeActive((prev) => !prev)}
            initialSubView={genesisInitialSubView}
          >
            {/* Embedded DeFi Arbitrage Engine inside Omega Frame 1 at 0.0.0.0 */}
            <div className="w-full max-w-7xl mx-auto flex flex-col gap-6">
              <MetricsOverview stats={stats} />

              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setArbitrageView('radar')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                      arbitrageView === 'radar'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                        : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Live Cyclic Radar & Trades</span>
                  </button>

                  <button
                    onClick={() => setArbitrageView('auditLog')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                      arbitrageView === 'auditLog'
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20'
                        : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Block Ledger Audit Log</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                      {blockLedger.length}
                    </span>
                  </button>
                </div>

                <button
                  onClick={() => setIsCoprimeGridOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-300 text-xs font-semibold transition-colors"
                >
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  <span>4D Coprime Grid Visual</span>
                </button>
              </div>

              {arbitrageView === 'radar' ? (
                <>
                  <ArbitrageOpportunities
                    opportunities={opportunities}
                    onExecuteOpportunity={handleExecuteOpportunity}
                  />
                  <div className="mt-2">
                    <ArbitrageActivityLog
                      trades={trades}
                      isLive={isLive}
                      onToggleLive={() => setIsLive(!isLive)}
                      onSelectTrade={(t) => setSelectedTrade(t)}
                    />
                  </div>
                </>
              ) : (
                <div className="mt-1">
                  <ArbitrageAuditLog
                    blocks={blockLedger}
                    isLive={isLive}
                    onRefresh={() => setBlockLedger([...globalTraceEngine.getBlockLedger()])}
                    onOpenCoprimeGrid={() => setIsCoprimeGridOpen(true)}
                  />
                </div>
              )}
            </div>
          </GenesisXrMonolith>
        </div>
      ) : (
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
          {/* Row 1: Key Performance Metrics */}
          <MetricsOverview stats={stats} />

          {/* Arbitrage Dashboard Sub-View Switcher: Live Feed vs Block Ledger Audit Log */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setArbitrageView('radar')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                  arbitrageView === 'radar'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Live Cyclic Radar & Trades</span>
              </button>

              <button
                onClick={() => setArbitrageView('auditLog')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                  arbitrageView === 'auditLog'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Block Ledger Audit Log</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                  {blockLedger.length}
                </span>
              </button>
            </div>

            <button
              onClick={() => setIsCoprimeGridOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-300 text-xs font-semibold transition-colors"
            >
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>4D Coprime Grid Visual</span>
            </button>
          </div>

          {/* Sub-view Content */}
          {arbitrageView === 'radar' ? (
            <>
              {/* Row 2: Live Bellman-Ford Cyclic Route Radar */}
              <ArbitrageOpportunities
                opportunities={opportunities}
                onExecuteOpportunity={handleExecuteOpportunity}
              />

              {/* Row 3: Arbitrage Activity Log (Bottom of Dashboard) */}
              <div className="mt-2">
                <ArbitrageActivityLog
                  trades={trades}
                  isLive={isLive}
                  onToggleLive={() => setIsLive(!isLive)}
                  onSelectTrade={(t) => setSelectedTrade(t)}
                />
              </div>
            </>
          ) : (
            /* Dedicated Block Ledger Audit Log View */
            <div className="mt-1">
              <ArbitrageAuditLog
                blocks={blockLedger}
                isLive={isLive}
                onRefresh={() => setBlockLedger([...globalTraceEngine.getBlockLedger()])}
                onOpenCoprimeGrid={() => setIsCoprimeGridOpen(true)}
              />
            </div>
          )}
        </main>
      )}
      </div>

      {/* Footer (when in arbitrage mode) */}
      {workspaceMode === 'arbitrage' && (
        <footer className="border-t border-gray-900 bg-gray-950 px-6 py-4 text-center text-xs text-gray-500">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>DeFi Arbitrage Engine &bull; Pure Low-Latency Algorithmic Execution</span>
            <span>NODE_09 Subsea Fiber Allocation Linked &bull; GAIA EYES AE.SL6.INVPAIR &bull; Halo2 ZK Proof Cryptography</span>
          </div>
        </footer>
      )}

      {/* Detail Modal for Trades */}
      {selectedTrade && (
        <ExecutionDetailModal
          trade={selectedTrade}
          onClose={() => setSelectedTrade(null)}
        />
      )}

      {/* Calculus Coprime Grid 4th Dimension Live Graphing Modal */}
      <CalculusCoprimeGridModal
        isOpen={isCoprimeGridOpen}
        onClose={() => setIsCoprimeGridOpen(false)}
        onViewAuditLog={() => {
          setWorkspaceMode('arbitrage');
          setArbitrageView('auditLog');
        }}
      />

      {/* 4th Dimension Traversable Void & Hypergeometric Ring Workspace */}
      <FourDimensionalHypergeometricWorkspace
        isOpen={is4DWorkspaceOpen}
        onClose={() => setIs4DWorkspaceOpen(false)}
        onOpenAuditLog={() => {
          setWorkspaceMode('arbitrage');
          setArbitrageView('auditLog');
        }}
        onOpenCapacityModal={() => setIsCapacityModalOpen(true)}
      />

      {/* Neural Parameter Capacity Budget (P_total) & Invariant Recurrence (I_{t+1}) Modal */}
      <NeuralInvariantCapacityModal
        isOpen={isCapacityModalOpen}
        onClose={() => setIsCapacityModalOpen(false)}
        onOpenAuditLog={() => {
          setWorkspaceMode('arbitrage');
          setArbitrageView('auditLog');
        }}
      />

      {/* Multi-Factor Authentication (MFA) Security Enclave Modal */}
      <MfaSecurityModal
        isOpen={isMfaModalOpen}
        onClose={() => setIsMfaModalOpen(false)}
      />
      </div>
    </div>
  );
}
