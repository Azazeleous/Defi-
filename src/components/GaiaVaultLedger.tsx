import React from 'react';
import { GaiaVaultEntry } from '../types/gaiaNexus';
import { ShieldCheck, Lock, Database, CheckCircle2, FileCode } from 'lucide-react';

interface Props {
  entries: GaiaVaultEntry[];
}

export const GaiaVaultLedger: React.FC<Props> = ({ entries }) => {
  return (
    <div className="bg-[#020407] border border-[#101d2a] rounded-lg p-3 flex flex-col h-full font-mono text-xs select-none">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#101d2a]">
        <div className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-[#39ff14]" />
          <span className="font-bold text-[#39ff14] text-[11px]">
            RAVENEYE &rarr; ADAM &rarr; GAIA VAULT LEDGER
          </span>
        </div>
        <span className="text-[10px] text-[#ffb700]">
          {entries.length} Cycles Recorded
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-[#101d2a] max-h-[220px]">
        {entries.length === 0 ? (
          <div className="py-8 text-center text-gray-500 text-[11px]">
            Awaiting origin convergence verification cycle...
          </div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.sequenceId}
              className="p-2.5 rounded bg-[#060a10] border border-[#101d2a] hover:border-[#39ff14]/40 transition-colors"
            >
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="font-bold text-[#00f0ff]">{entry.sequenceId}</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1 text-[10px]">
                  <CheckCircle2 className="w-3 h-3" />
                  {entry.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1 text-[10px] text-gray-400">
                <div>
                  <span className="text-gray-500">Root Marker:</span>{' '}
                  <span className="text-[#ffb700] font-bold">{entry.beucRootId}</span>
                </div>
                <div>
                  <span className="text-gray-500">FNV Hash:</span>{' '}
                  <span className="text-gray-200">{entry.fnvFingerprint}</span>
                </div>
                <div>
                  <span className="text-gray-500">Euler &chi;:</span>{' '}
                  <span className="text-white font-bold">{entry.eulerCharacteristic}</span>
                </div>
                <div>
                  <span className="text-gray-500">Origin Residual:</span>{' '}
                  <span className="text-[#39ff14] font-bold">{entry.originResidual.toExponential(2)}</span>
                </div>
              </div>

              <div className="mt-1 pt-1 border-t border-[#101d2a] flex items-center justify-between text-[9px] text-gray-500">
                <span className="truncate">Sig: {entry.commitSignature}</span>
                <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
