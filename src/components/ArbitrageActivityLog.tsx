import React, { useState, useRef, useEffect } from 'react';
import { TradeExecution, NetworkName } from '../types/arbitrage';
import { NETWORK_CONFIG, NETWORKS } from '../data/mockData';
import { 
  Play, 
  Pause, 
  Search, 
  Filter, 
  ArrowUpDown, 
  ExternalLink, 
  ChevronRight, 
  SlidersHorizontal,
  Clock,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
  TrendingUp,
  Percent
} from 'lucide-react';

interface Props {
  trades: TradeExecution[];
  isLive: boolean;
  onToggleLive: () => void;
  onSelectTrade: (trade: TradeExecution) => void;
}

export const ArbitrageActivityLog: React.FC<Props> = ({
  trades,
  isLive,
  onToggleLive,
  onSelectTrade,
}) => {
  const [selectedNetwork, setSelectedNetwork] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [slippageFilter, setSlippageFilter] = useState<'all' | 'low' | 'med' | 'high'>('all');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logic when new trades arrive
  useEffect(() => {
    if (autoScroll && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }
  }, [trades.length, autoScroll]);

  // Filtered trades
  const filteredTrades = trades.filter((trade) => {
    if (selectedNetwork !== 'ALL' && trade.network !== selectedNetwork) {
      return false;
    }

    if (slippageFilter === 'low' && trade.slippagePct > 0.05) return false;
    if (slippageFilter === 'med' && (trade.slippagePct <= 0.05 || trade.slippagePct > 0.15)) return false;
    if (slippageFilter === 'high' && trade.slippagePct <= 0.15) return false;

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchNetwork = trade.network.toLowerCase().includes(q);
      const matchPair = trade.tokenPair.toLowerCase().includes(q);
      const matchDex = trade.routeDEXs.some((d) => d.toLowerCase().includes(q));
      const matchHash = trade.txHash.toLowerCase().includes(q);
      if (!matchNetwork && !matchPair && !matchDex && !matchHash) {
        return false;
      }
    }

    return true;
  });

  // Calculate average slippage for visible trades
  const avgSlippage = filteredTrades.length > 0
    ? (filteredTrades.reduce((acc, t) => acc + t.slippagePct, 0) / filteredTrades.length).toFixed(3)
    : '0.000';

  const totalFilteredProfit = filteredTrades.reduce((acc, t) => acc + t.netProfitUsd, 0);

  return (
    <section className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl flex flex-col">
      {/* Header Section */}
      <div className="p-5 border-b border-gray-800 bg-gray-950/60">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Arbitrage Activity Log
                </h2>
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
                  {isLive ? 'LIVE FEED' : 'PAUSED'}
                </span>
                <span className="text-xs text-gray-500 font-mono">
                  ({filteredTrades.length} recorded)
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Real-time streaming ledger of multi-hop cyclic execution proofs, network routing, and slippage telemetry.
              </p>
            </div>
          </div>

          {/* Quick Metrics & Controls */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <div className="bg-gray-900/90 border border-gray-800 px-3 py-1.5 rounded-lg flex items-center gap-2">
              <span className="text-gray-400 flex items-center gap-1">
                <Percent className="w-3.5 h-3.5 text-amber-400" />
                Avg Slippage:
              </span>
              <span className="font-mono font-bold text-amber-300">{avgSlippage}%</span>
            </div>

            <div className="bg-gray-900/90 border border-gray-800 px-3 py-1.5 rounded-lg flex items-center gap-2">
              <span className="text-gray-400 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                Captured:
              </span>
              <span className="font-mono font-bold text-emerald-400">+${totalFilteredProfit.toFixed(2)}</span>
            </div>

            <button
              onClick={onToggleLive}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
                isLive
                  ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20'
              }`}
              title={isLive ? 'Pause live trade incoming feed' : 'Resume live trade feed'}
            >
              {isLive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isLive ? 'Pause Feed' : 'Resume'}
            </button>

            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                autoScroll
                  ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                  : 'bg-gray-800/80 text-gray-400 border-gray-700 hover:text-white'
              }`}
            >
              {autoScroll ? 'Auto-Scroll: ON' : 'Auto-Scroll: OFF'}
            </button>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="mt-4 pt-4 border-t border-gray-800/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Network Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none text-xs">
            <span className="text-gray-500 text-xs font-medium mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" />
              Network:
            </span>
            <button
              onClick={() => setSelectedNetwork('ALL')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
                selectedNetwork === 'ALL'
                  ? 'bg-white text-gray-950 font-bold shadow'
                  : 'bg-gray-800/70 text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              All Networks
            </button>
            {NETWORKS.map((net) => {
              const cfg = NETWORK_CONFIG[net];
              const isSelected = selectedNetwork === net;
              return (
                <button
                  key={net}
                  onClick={() => setSelectedNetwork(net)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap border ${
                    isSelected
                      ? `${cfg.badgeBg} font-bold ring-1 ring-white/20`
                      : 'bg-gray-950 text-gray-400 border-gray-800 hover:border-gray-700 hover:text-gray-200'
                  }`}
                >
                  {net}
                </button>
              );
            })}
          </div>

          {/* Slippage & Search Inputs */}
          <div className="flex items-center gap-2">
            {/* Slippage Filter */}
            <div className="flex items-center bg-gray-950 border border-gray-800 rounded-lg px-2 py-1 text-xs text-gray-300">
              <span className="text-gray-500 mr-1.5 flex items-center gap-1">
                <SlidersHorizontal className="w-3 h-3" />
                Slippage:
              </span>
              <select
                value={slippageFilter}
                onChange={(e) => setSlippageFilter(e.target.value as any)}
                className="bg-transparent text-gray-200 outline-none cursor-pointer text-xs"
              >
                <option value="all" className="bg-gray-900 text-white">All Slippages</option>
                <option value="low" className="bg-gray-900 text-emerald-400">&le; 0.05% (Optimal)</option>
                <option value="med" className="bg-gray-900 text-amber-400">0.05% - 0.15% (Normal)</option>
                <option value="high" className="bg-gray-900 text-red-400">&gt; 0.15% (Volatile)</option>
              </select>
            </div>

            {/* Search Box */}
            <div className="relative min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search pair, DEX, hash..."
                className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-8 pr-3 py-1 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/70 transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table Header (Desktop) */}
      <div className="hidden lg:grid grid-cols-12 gap-3 px-5 py-2.5 bg-gray-950/80 text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-800/60">
        <div className="col-span-2 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Timestamp
        </div>
        <div className="col-span-2">Network</div>
        <div className="col-span-3">Arbitrage Pair & DEX Hops</div>
        <div className="col-span-2 flex items-center gap-1">
          <Percent className="w-3 h-3 text-amber-400" />
          Slippage %
        </div>
        <div className="col-span-2 text-right">Net Profit / Gas</div>
        <div className="col-span-1 text-right">Action</div>
      </div>

      {/* Scrolling List Container */}
      <div 
        ref={scrollContainerRef}
        className="divide-y divide-gray-800/40 overflow-y-auto max-h-[480px] scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-gray-950/50 bg-gray-950/20"
      >
        {filteredTrades.length === 0 ? (
          <div className="py-16 text-center text-gray-500 flex flex-col items-center justify-center">
            <Clock className="w-8 h-8 mb-2 text-gray-600 opacity-60" />
            <p className="text-sm font-medium">No trade executions match the current filter criteria.</p>
            <p className="text-xs text-gray-600 mt-1">Try resetting the network filter or search query.</p>
          </div>
        ) : (
          filteredTrades.map((trade) => {
            const netCfg = NETWORK_CONFIG[trade.network];
            
            // Slippage color coding
            const isLow = trade.slippagePct <= 0.05;
            const isMedium = trade.slippagePct > 0.05 && trade.slippagePct <= 0.15;
            const slippageBadgeClass = isLow
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
              : isMedium
              ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
              : 'text-red-400 bg-red-500/10 border-red-500/30';

            return (
              <div
                key={trade.id}
                onClick={() => onSelectTrade(trade)}
                className="group p-4 lg:px-5 lg:py-3.5 hover:bg-gray-800/50 transition-colors cursor-pointer text-xs"
              >
                {/* Desktop Grid Layout */}
                <div className="hidden lg:grid grid-cols-12 gap-3 items-center">
                  {/* Timestamp & Proof status */}
                  <div className="col-span-2 font-mono">
                    <span className="text-white font-medium block">{trade.timestamp}</span>
                    <span className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                      <ShieldCheck className="w-3 h-3 text-purple-400" />
                      {trade.status}
                    </span>
                  </div>

                  {/* Network Name with distinct styling */}
                  <div className="col-span-2 flex items-center gap-1.5">
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${netCfg.badgeBg} flex items-center gap-1.5`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                      {trade.network}
                    </span>
                  </div>

                  {/* Token Pair & Route DEXs */}
                  <div className="col-span-3 overflow-hidden">
                    <div className="font-semibold text-white truncate font-mono text-[12px]">
                      {trade.tokenPair}
                    </div>
                    <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5 truncate">
                      <span className="text-gray-500">DEXs:</span>
                      {trade.routeDEXs.join(' → ')}
                    </div>
                  </div>

                  {/* Slippage Percentage (PROMINENTLY DISPLAYED) */}
                  <div className="col-span-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${slippageBadgeClass}`}>
                        {trade.slippagePct.toFixed(3)}%
                      </span>
                      <span className="text-[10px] text-gray-500">
                        tol: &plusmn;{trade.slippageThreshold}%
                      </span>
                    </div>
                    {/* Mini slippage bar visualizer */}
                    <div className="w-24 h-1 bg-gray-800 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className={`h-full ${isLow ? 'bg-emerald-400' : isMedium ? 'bg-amber-400' : 'bg-red-400'}`}
                        style={{ width: `${Math.min(100, (trade.slippagePct / 0.25) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Net Profit & Gas Cost */}
                  <div className="col-span-2 text-right font-mono">
                    <span className="text-emerald-400 font-bold block text-sm">
                      +${trade.netProfitUsd.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-gray-400 flex items-center justify-end gap-1 mt-0.5">
                      <span>+{trade.netProfitPct.toFixed(2)}%</span>
                      <span>•</span>
                      <span className="text-gray-500">gas ${trade.gasFeeUsd.toFixed(2)}</span>
                    </span>
                  </div>

                  {/* Action / Inspect */}
                  <div className="col-span-1 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTrade(trade);
                      }}
                      className="inline-flex items-center justify-center p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/60 rounded-md transition-colors"
                      title="View trade execution breakdown"
                    >
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-400 transition-colors" />
                    </button>
                  </div>
                </div>

                {/* Mobile / Compact Card Layout */}
                <div className="lg:hidden flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${netCfg.badgeBg}`}>
                        {trade.network}
                      </span>
                      <span className="font-mono text-gray-400 text-xs">{trade.timestamp}</span>
                    </div>
                    {/* Slippage percentage for mobile */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-400">Slippage:</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${slippageBadgeClass}`}>
                        {trade.slippagePct.toFixed(3)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-mono font-bold text-white text-xs">{trade.tokenPair}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{trade.routeDEXs.join(' → ')}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-emerald-400 font-bold font-mono text-sm block">
                        +${trade.netProfitUsd.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-emerald-400/80 font-mono">
                        +{trade.netProfitPct.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-gray-800/40 text-[11px] text-gray-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3 text-cyan-400" />
                      {trade.executionLatencyMs}ms latency
                    </span>
                    <span className="text-blue-400 flex items-center gap-1">
                      View details <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="px-5 py-3 bg-gray-950 border-t border-gray-800 text-[11px] text-gray-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            Optimal Slippage (&le; 0.05%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            Normal (0.05% - 0.15%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
            Volatile (&gt; 0.15%)
          </span>
        </div>
        <div className="font-mono text-gray-400">
          Showing {filteredTrades.length} of {trades.length} executions • Click any row for atomic proofs
        </div>
      </div>
    </section>
  );
};
