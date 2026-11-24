import React from 'react';
import { Activity, Zap, DollarSign, Percent, Clock, Layers, ArrowUpRight } from 'lucide-react';
import { EngineStats } from '../types/arbitrage';

interface Props {
  stats: EngineStats;
}

export const MetricsOverview: React.FC<Props> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* Network Throughput */}
      <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl relative overflow-hidden group hover:border-gray-700 transition-colors">
        <div className="flex items-center justify-between text-gray-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Network Throughput</span>
          <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400 border border-blue-500/20">
            <Activity className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-white">{stats.throughput}</span>
          <span className="text-xs text-gray-400 font-mono">tx/s</span>
        </div>
        <div className="mt-2 text-[11px] text-emerald-400 flex items-center gap-1">
          <ArrowUpRight className="w-3 h-3" />
          <span>7 L1/L2 Mempools synced</span>
        </div>
      </div>

      {/* Active Cyclic Opportunities */}
      <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl relative overflow-hidden group hover:border-gray-700 transition-colors">
        <div className="flex items-center justify-between text-gray-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Active Cyclic Paths</span>
          <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400 border border-amber-500/20">
            <Zap className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-white">{stats.activeOpportunities}</span>
          <span className="text-xs text-gray-400 font-mono">positive cycles</span>
        </div>
        <div className="mt-2 text-[11px] text-amber-400/90 flex items-center gap-1">
          <span>Negative-weight cycle detection</span>
        </div>
      </div>

      {/* Realized 24h Profit */}
      <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl relative overflow-hidden group hover:border-gray-700 transition-colors">
        <div className="flex items-center justify-between text-gray-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Cumulative 24h Profit</span>
          <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/20">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-emerald-400">
            ${stats.totalProfit24h.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="mt-2 text-[11px] text-emerald-400 flex items-center gap-1">
          <ArrowUpRight className="w-3 h-3" />
          <span>Net after flash-loan & gas fees</span>
        </div>
      </div>

      {/* Average Slippage */}
      <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl relative overflow-hidden group hover:border-gray-700 transition-colors">
        <div className="flex items-center justify-between text-gray-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Avg Slippage</span>
          <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400 border border-purple-500/20">
            <Percent className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-purple-300">
            {stats.avgSlippagePct.toFixed(3)}%
          </span>
          <span className="text-xs text-emerald-400 font-mono">&plusmn;0.02%</span>
        </div>
        <div className="mt-2 text-[11px] text-purple-400 flex items-center gap-1">
          <span>Rehydrated 11/15 signers pools</span>
        </div>
      </div>

      {/* Median Execution Latency */}
      <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl relative overflow-hidden group hover:border-gray-700 transition-colors">
        <div className="flex items-center justify-between text-gray-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Median Latency</span>
          <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400 border border-cyan-500/20">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-cyan-300">{stats.avgLatencyMs}</span>
          <span className="text-xs text-gray-400 font-mono">ms</span>
        </div>
        <div className="mt-2 text-[11px] text-cyan-400 flex items-center gap-1">
          <span>MARA Sub-millisecond engine</span>
        </div>
      </div>
    </div>
  );
};
