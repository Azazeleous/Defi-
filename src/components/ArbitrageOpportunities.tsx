import React from 'react';
import { ArbitrageOpportunity } from '../types/arbitrage';
import { NETWORK_CONFIG } from '../data/mockData';
import { Zap, ArrowRight, ShieldCheck, Flame, Timer, Sparkles } from 'lucide-react';

interface Props {
  opportunities: ArbitrageOpportunity[];
  onExecuteOpportunity: (opp: ArbitrageOpportunity) => void;
}

export const ArbitrageOpportunities: React.FC<Props> = ({
  opportunities,
  onExecuteOpportunity,
}) => {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Active Arbitrage Cyclic Routes (Bellman-Ford)
            </h2>
            <p className="text-xs text-gray-400">
              Discovered negative cycle weights across cross-DEX liquidity graphs
            </p>
          </div>
        </div>
        <span className="text-xs font-mono px-2.5 py-1 rounded bg-gray-950 border border-gray-800 text-gray-300">
          Auto-execution: <span className="text-emerald-400 font-bold">ARMED</span>
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {opportunities.map((opp) => {
          const netCfg = NETWORK_CONFIG[opp.network];

          return (
            <div
              key={opp.id}
              className="bg-gray-950/70 border border-gray-800/80 hover:border-gray-700/80 rounded-xl p-4 flex flex-col justify-between transition-all group relative overflow-hidden"
            >
              {/* Network badge & profit pill */}
              <div className="flex items-center justify-between mb-3">
                <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${netCfg.badgeBg}`}>
                  {opp.network}
                </span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  +{opp.expectedProfitPct}% (${opp.expectedProfitUsd.toFixed(2)})
                </span>
              </div>

              {/* Path breakdown */}
              <div className="mb-3">
                <div className="text-xs font-mono font-bold text-white flex items-center flex-wrap gap-1">
                  {opp.path.map((token, i) => (
                    <React.Fragment key={i}>
                      <span>{token}</span>
                      {i < opp.path.length - 1 && <ArrowRight className="w-3 h-3 text-gray-500" />}
                    </React.Fragment>
                  ))}
                </div>
                <div className="text-[11px] text-gray-400 mt-1 truncate">
                  {opp.dexes.join(' &rarr; ')}
                </div>
              </div>

              {/* Metrics footer & execution button */}
              <div className="pt-3 border-t border-gray-800/60 mt-auto">
                <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-400 mb-3">
                  <div>
                    <span className="block text-[10px] text-gray-500">Est. Slippage:</span>
                    <span className="font-mono text-amber-300">{opp.estSlippagePct}%</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-gray-500">Est. Gas:</span>
                    <span className="font-mono text-gray-300">${opp.gasCostUsd}</span>
                  </div>
                </div>

                <button
                  onClick={() => onExecuteOpportunity(opp)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-md shadow-blue-500/20 transition-all active:scale-[0.98]"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Flash Execute Swap
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
