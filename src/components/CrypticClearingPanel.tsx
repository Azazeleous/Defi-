import React, { useState } from 'react';
import { FileCheck2, ShieldCheck, ArrowRight, DollarSign, AlertCircle } from 'lucide-react';
import type {
  ClearedReceiptRecord,
  RbacRole,
  ReceiptLifecycleState,
  ReceiptTransitionLog,
  RewardAccountingEntry,
  RewardBalancesSummary,
} from '../contracts/cryptic-platform';
import { StripeMultiCurrencyPayouts } from './StripeMultiCurrencyPayouts';

interface Props {
  mode: 'receipt-ledger' | 'reward-accounting' | 'stripe-connect';
  actorRole: RbacRole;
  receipts: readonly ClearedReceiptRecord[];
  rewardEntries: readonly RewardAccountingEntry[];
  balances: RewardBalancesSummary;
  onRefresh: () => void;
}

const NEXT_STATE_HINTS: Partial<Record<ReceiptLifecycleState, ReceiptLifecycleState[]>> = {
  CREATED: ['COMPUTATION_COMPLETE', 'REJECTED'],
  COMPUTATION_COMPLETE: ['LOCALLY_VERIFIED', 'REJECTED'],
  LOCALLY_VERIFIED: ['SUBMITTED', 'REWARD_PENDING', 'REJECTED'],
  SUBMITTED: ['POOL_ACKNOWLEDGED', 'REJECTED', 'DISPUTED'],
  POOL_ACKNOWLEDGED: ['SHARE_ACCEPTED', 'REJECTED', 'DISPUTED'],
  SHARE_ACCEPTED: ['REWARD_PENDING', 'DISPUTED'],
  REWARD_PENDING: ['REWARD_CONFIRMED', 'REJECTED', 'DISPUTED'],
  REWARD_CONFIRMED: ['SETTLEMENT_ELIGIBLE', 'DISPUTED', 'REVERSED'],
  SETTLEMENT_ELIGIBLE: ['SETTLED', 'DISPUTED', 'REVERSED'],
  DISPUTED: ['REWARD_CONFIRMED', 'REJECTED', 'REVERSED'],
  SETTLED: ['REVERSED'],
};

export const CrypticClearingPanel: React.FC<Props> = ({
  mode,
  actorRole,
  receipts,
  rewardEntries,
  balances,
  onRefresh,
}) => {
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [verifyInfo, setVerifyInfo] = useState<{
    digestMatches: boolean;
    recomputedDigest: string | null;
    transitions: ReceiptTransitionLog[];
  } | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const inspectReceipt = async (receiptId: string) => {
    setSelectedReceiptId(receiptId);
    setFeedback(null);
    const res = await fetch(`/api/cryptic/receipts/${receiptId}/verify`);
    const data = await res.json();
    if (data.ok) {
      setVerifyInfo({
        digestMatches: data.verification.digestMatches,
        recomputedDigest: data.verification.recomputedDigest,
        transitions: data.transitions || [],
      });
    }
  };

  const advanceState = async (receiptId: string, targetState: ReceiptLifecycleState) => {
    setFeedback(null);
    const res = await fetch(`/api/cryptic/receipts/${receiptId}/advance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cryptic-role': actorRole,
      },
      body: JSON.stringify({
        targetState,
        note: `Operator advance to ${targetState} under role ${actorRole}`,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setFeedback({ ok: false, text: data.error || 'Transition denied' });
    } else {
      setFeedback({ ok: true, text: `Receipt ${receiptId} advanced -> ${data.receipt.lifecycleState}` });
      await inspectReceipt(receiptId);
      onRefresh();
    }
  };

  if (mode === 'stripe-connect') {
    return <StripeMultiCurrencyPayouts actorRole={actorRole} />;
  }

  if (mode === 'reward-accounting') {
    return (
      <div className="space-y-4 font-mono text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="bg-[#0B0F17] border border-slate-800 p-4">
            <div className="text-[10px] text-slate-400">ESTIMATED PENDING</div>
            <div className="text-lg font-semibold text-amber-300 mt-1">${balances.estimatedPendingUsd.toFixed(4)}</div>
            <div className="text-[10px] text-slate-500">{balances.estimatedEntryCount} pending entries</div>
          </div>
          <div className="bg-[#0B0F17] border border-slate-800 p-4">
            <div className="text-[10px] text-slate-400">CONFIRMED AVAILABLE</div>
            <div className="text-lg font-semibold text-emerald-400 mt-1">${balances.confirmedAvailableUsd.toFixed(4)}</div>
            <div className="text-[10px] text-slate-500">{balances.confirmedEntryCount} verified credits</div>
          </div>
          <div className="bg-[#0B0F17] border border-slate-800 p-4">
            <div className="text-[10px] text-slate-400">SETTLED LIFETIME DEBIT</div>
            <div className="text-lg font-semibold text-cyan-300 mt-1">${balances.settledLifetimeUsd.toFixed(4)}</div>
          </div>
          <div className="bg-[#0B0F17] border border-slate-800 p-4">
            <div className="text-[10px] text-slate-400">REVERSED TOTAL</div>
            <div className="text-lg font-semibold text-rose-400 mt-1">${balances.reversedTotalUsd.toFixed(4)}</div>
          </div>
        </div>

        <div className="bg-[#0B0F17] border border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-semibold text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              Append-Only Reward Accounting Journal (SQLite WAL)
            </span>
            <span className="text-[10px] text-slate-400">Strict Estimated vs Confirmed Separation</span>
          </div>

          {rewardEntries.length === 0 ? (
            <div className="py-8 text-center text-slate-500">
              No reward accounting entries yet. Submit and accept a TCP Stratum share or advance a verified receipt through REWARD_PENDING / REWARD_CONFIRMED.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[10px]">
                    <th className="py-2">ENTRY ID</th>
                    <th className="py-2">TYPE</th>
                    <th className="py-2">RECEIPT</th>
                    <th className="py-2">IDEMPOTENCY KEY</th>
                    <th className="py-2">NET USD</th>
                    <th className="py-2">NOTE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {rewardEntries.map((e) => (
                    <tr key={e.entryId}>
                      <td className="py-2 text-slate-300">{e.entryId}</td>
                      <td className="py-2">
                        <span
                          className={`px-1.5 py-0.5 text-[10px] ${
                            e.entryType === 'CONFIRMED'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : e.entryType === 'ESTIMATED'
                                ? 'bg-amber-500/20 text-amber-300'
                                : e.entryType === 'REVERSED'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : 'bg-cyan-500/20 text-cyan-300'
                          }`}
                        >
                          {e.entryType}
                        </span>
                      </td>
                      <td className="py-2 text-cyan-300">{e.receiptId}</td>
                      <td className="py-2 text-slate-400">{e.idempotencyKey}</td>
                      <td className="py-2 text-white font-semibold">${e.netAmount.toFixed(4)}</td>
                      <td className="py-2 text-slate-400">{e.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-mono text-xs">
      {feedback && (
        <div
          className={`p-3 border flex items-center gap-2 ${
            feedback.ok
              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
          }`}
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{feedback.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 bg-[#0B0F17] border border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-semibold text-white flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-cyan-400" />
              13-State Clearing Receipt Ledger ({receipts.length})
            </span>
            <span className="text-[10px] text-slate-400">Canonical SHA-256 Parent-Chained</span>
          </div>

          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {receipts.length === 0 ? (
              <div className="py-8 text-center text-slate-500">
                No cleared receipts yet. Run Instant Miner, Instant Solver, or Stratum Share submission to seal canonical receipts.
              </div>
            ) : (
              receipts.map((r) => (
                <div
                  key={r.receiptId}
                  onClick={() => inspectReceipt(r.receiptId)}
                  className={`p-3 border cursor-pointer transition-colors ${
                    selectedReceiptId === r.receiptId
                      ? 'bg-slate-900 border-cyan-400'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-cyan-300 font-semibold">{r.receiptId}</span>
                    <span className="px-2 py-0.5 bg-slate-800 text-white text-[10px]">
                      {r.lifecycleState}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-slate-400 flex flex-wrap justify-between gap-2">
                    <span>Alg: {r.algorithmId} ({r.verificationOutcome})</span>
                    <span>Ops: {r.actualOperationCount} | Hashes: {r.actualHashCount}</span>
                  </div>
                  <div className="mt-1 text-[10px] text-slate-500 truncate">
                    Digest: {r.canonicalDigestSha256}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-5 bg-[#0B0F17] border border-slate-800 p-4 space-y-4">
          <div className="font-semibold text-white border-b border-slate-800 pb-2 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Receipt Verification & FSM Transition Console</span>
          </div>

          {!selectedReceiptId ? (
            <div className="py-8 text-center text-slate-500">
              Select a receipt on the left to recompute SHA-256 integrity and step through its 13-state lifecycle.
            </div>
          ) : (
            (() => {
              const selected = receipts.find((r) => r.receiptId === selectedReceiptId);
              if (!selected) return null;
              const nextStates = NEXT_STATE_HINTS[selected.lifecycleState] || [];
              return (
                <div className="space-y-4">
                  <div className="p-3 bg-slate-950 border border-slate-800 space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-400">SHA-256 Integrity:</span>
                      <span className={verifyInfo?.digestMatches ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                        {verifyInfo?.digestMatches ? 'VERIFIED EXACT' : 'MISMATCH'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 break-all">
                      Parent: {selected.parentReceiptDigest || 'GENESIS_ROOT'}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-400 mb-1.5">
                      ALLOWED NEXT LIFECYCLE STATES (Role: {actorRole})
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {nextStates.length === 0 ? (
                        <span className="text-slate-500 text-[11px]">Terminal state reached ({selected.lifecycleState}).</span>
                      ) : (
                        nextStates.map((st) => (
                          <button
                            key={st}
                            onClick={() => advanceState(selected.receiptId, st)}
                            className="px-2.5 py-1 bg-cyan-500/15 border border-cyan-500/40 hover:bg-cyan-500/25 text-cyan-200 flex items-center gap-1"
                          >
                            <ArrowRight className="w-3 h-3" /> {st}
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-400 mb-1.5">TRANSITION AUDIT TRAIL</div>
                    <div className="space-y-1.5 max-h-56 overflow-y-auto">
                      {(verifyInfo?.transitions || []).map((tr) => (
                        <div key={tr.transitionId} className="p-2 bg-slate-950 border border-slate-800 text-[10px]">
                          <div className="text-white font-semibold">
                            {tr.fromState} &rarr; {tr.toState} ({tr.actorRole})
                          </div>
                          <div className="text-slate-400 mt-0.5">{tr.note}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      </div>
    </div>
  );
};
