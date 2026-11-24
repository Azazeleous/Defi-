import React from 'react';
import { TradeExecution } from '../types/arbitrage';
import { NETWORK_CONFIG } from '../data/mockData';
import { X, CheckCircle2, ShieldCheck, Zap, ArrowRight, Copy, Check } from 'lucide-react';

interface Props {
  trade: TradeExecution | null;
  onClose: () => void;
}

export const ExecutionDetailModal: React.FC<Props> = ({ trade, onClose }) => {
  const [copied, setCopied] = React.useState(false);

  if (!trade) return null;

  const networkCfg = NETWORK_CONFIG[trade.network];

  const handleCopyHash = () => {
    navigator.clipboard.writeText(trade.txHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-gray-900 border border-gray-800 rounded-xl max-w-2xl w-full p-6 shadow-2xl relative text-gray-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <span className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${networkCfg.badgeBg}`}>
              {trade.network}
            </span>
            <span className="text-xs text-gray-400 font-mono">Block #{trade.blockNumber}</span>
            <span className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {trade.status}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Title & Net Profit */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2 font-mono">
              {trade.tokenPair}
            </h3>
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-2">
              <span>Executed at: {trade.timestamp}</span>
              <span>•</span>
              <span className="text-blue-400 font-medium">{trade.algorithm}</span>
            </p>
          </div>
          <div className="text-right bg-emerald-950/40 border border-emerald-800/40 p-3 rounded-lg">
            <span className="text-xs text-emerald-400 font-medium block">Net Captured Profit</span>
            <span className="text-2xl font-mono font-bold text-emerald-300">
              +${trade.netProfitUsd.toFixed(2)}
            </span>
            <span className="text-xs text-emerald-400 font-mono ml-1.5">(+{trade.netProfitPct.toFixed(3)}%)</span>
          </div>
        </div>

        {/* Route Details Box */}
        <div className="bg-gray-950/70 border border-gray-800/80 rounded-lg p-4 mb-5">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Atomic Multi-DEX Route Sequence
          </h4>
          <div className="flex flex-wrap items-center gap-2">
            {trade.routeDEXs.map((dex, idx) => (
              <React.Fragment key={idx}>
                <div className="flex items-center gap-2 bg-gray-900 border border-gray-700/60 px-3 py-1.5 rounded-md text-xs font-medium text-gray-200">
                  <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                  {dex}
                </div>
                {idx < trade.routeDEXs.length - 1 && (
                  <ArrowRight className="w-3.5 h-3.5 text-gray-500" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Execution Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="bg-gray-950/50 p-3 rounded-lg border border-gray-800">
            <span className="text-[11px] text-gray-400 block">Realized Slippage</span>
            <span className="text-sm font-mono font-bold text-amber-400">
              {trade.slippagePct.toFixed(3)}%
            </span>
            <span className="text-[10px] text-gray-500 block">Max: {trade.slippageThreshold}%</span>
          </div>

          <div className="bg-gray-950/50 p-3 rounded-lg border border-gray-800">
            <span className="text-[11px] text-gray-400 block">Latency</span>
            <span className="text-sm font-mono font-bold text-cyan-400 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" />
              {trade.executionLatencyMs} ms
            </span>
            <span className="text-[10px] text-gray-500 block">Sub-block HFT</span>
          </div>

          <div className="bg-gray-950/50 p-3 rounded-lg border border-gray-800">
            <span className="text-[11px] text-gray-400 block">Gas / Network Fee</span>
            <span className="text-sm font-mono font-bold text-gray-200">
              ${trade.gasFeeUsd.toFixed(2)}
            </span>
            <span className="text-[10px] text-gray-500 block">Optimized MEV relay</span>
          </div>

          <div className="bg-gray-950/50 p-3 rounded-lg border border-gray-800">
            <span className="text-[11px] text-gray-400 block">ZK Integrity Proof</span>
            <span className="text-sm font-mono font-bold text-purple-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Valid
            </span>
            <span className="text-[10px] text-gray-500 block">Halo2 Polynomial</span>
          </div>
        </div>

        {/* Input / Output Capital */}
        <div className="grid grid-cols-2 gap-3 mb-5 text-xs bg-gray-950/40 p-3 rounded-lg border border-gray-800">
          <div>
            <span className="text-gray-400 block mb-0.5">Input Capital:</span>
            <span className="font-mono font-semibold text-white">{trade.amountIn}</span>
          </div>
          <div>
            <span className="text-gray-400 block mb-0.5">Settled Return:</span>
            <span className="font-mono font-semibold text-emerald-400">{trade.amountOut}</span>
          </div>
        </div>

        {/* Transaction Hash */}
        <div className="flex items-center justify-between bg-gray-950 p-3 rounded-lg border border-gray-800 text-xs font-mono">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="text-gray-400 shrink-0">Tx Hash:</span>
            <span className="text-gray-300 truncate">{trade.txHash}</span>
          </div>
          <button
            onClick={handleCopyHash}
            className="flex items-center gap-1.5 ml-3 px-2.5 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
};
