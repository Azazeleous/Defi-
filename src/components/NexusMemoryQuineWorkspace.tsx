import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Database,
  Terminal,
  FileCheck2,
  Cpu,
  Globe,
  CheckCircle2,
  AlertTriangle,
  Play,
  RefreshCw,
  Download,
  Lock,
  Search,
  Activity,
} from 'lucide-react';
import type { RbacRole } from '../contracts/cryptic-platform';
import type {
  AdapterConnectionStatus,
  GaiaMemoryEventRecord,
  GitHubRepoInspectionResult,
  HostCapabilityEntry,
  HygieneScanReport,
  MemoryChainVerificationReport,
  MerkleBatchRecord,
  PolyglotQuineExecutionResult,
  TraceableExecutionReceiptR,
  TypedCommandIR,
  UnifiedMathConvergenceResult,
} from '../contracts/gaia-v61';

interface Props {
  actorRole?: RbacRole;
}

type SubTab = 'CONVERGENCE' | 'MEMORY' | 'QUINE_NUEF' | 'MERKLE_PQ' | 'HYGIENE_ADAPTERS' | 'ACCEPTANCE_TDOC';

export const NexusMemoryQuineWorkspace: React.FC<Props> = ({ actorRole = 'ADMINISTRATOR' }) => {
  const [subTab, setSubTab] = useState<SubTab>('CONVERGENCE');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // 1. 4-Domain Math Convergence state
  const [mathSample, setMathSample] = useState<string>('GAIA-NEXUS-V45-CONVERGENCE-VECTOR');
  const [rsErrorCount, setRsErrorCount] = useState<number>(2);
  const [ldpcBitFlip, setLdpcBitFlip] = useState<boolean>(true);
  const [mathResult, setMathResult] = useState<UnifiedMathConvergenceResult | null>(null);

  // 2. Save_Memory & Lexical Corpus state
  const [memPayload, setMemPayload] = useState<string>('Zezima @ Lumbridge ✨ ∇·Ψ(r,θ,t)\nCanonical UTF-8 corpus sample line 2');
  const [memProject, setMemProject] = useState<string>('GAIA-NEXUS');
  const [memEventType, setMemEventType] = useState<string>('LEXICAL_CORPUS');
  const [memTags, setMemTags] = useState<string>('corpus,unicode,v6.1');
  const [memIdemKey, setMemIdemKey] = useState<string>('');
  const [userConsent, setUserConsent] = useState<boolean>(true);
  const [memSearch, setMemSearch] = useState<string>('');
  const [memoryEvents, setMemoryEvents] = useState<GaiaMemoryEventRecord[]>([]);
  const [chainReport, setChainReport] = useState<MemoryChainVerificationReport | null>(null);
  const [lastMemMsg, setLastMemMsg] = useState<string | null>(null);

  // 3. NUEF Capabilities & Quine state
  const [capabilities, setCapabilities] = useState<HostCapabilityEntry[]>([]);
  const [quineRuntime, setQuineRuntime] = useState<TypedCommandIR['targetRuntime']>('NODE_JS');
  const [quineMode, setQuineMode] = useState<'SELF_QUINE' | 'STATE_WRAPPER'>('SELF_QUINE');
  const [quineStatePayload, setQuineStatePayload] = useState<string>('GAIA_V45_INVARIANT');
  const [quineResult, setQuineResult] = useState<PolyglotQuineExecutionResult | null>(null);

  // 4. PQ Merkle & Receipts R
  const [receiptsR, setReceiptsR] = useState<TraceableExecutionReceiptR[]>([]);
  const [merkleBatches, setMerkleBatches] = useState<MerkleBatchRecord[]>([]);
  const [verifiedReceiptMsg, setVerifiedReceiptMsg] = useState<string | null>(null);

  // 5. Hygiene & Cloud Adapters
  const [adapters, setAdapters] = useState<AdapterConnectionStatus[]>([]);
  const [hygieneScans, setHygieneScans] = useState<HygieneScanReport[]>([]);
  const [ghOwner, setGhOwner] = useState<string>('nodejs');
  const [ghRepo, setGhRepo] = useState<string>('node');
  const [ghRef, setGhRef] = useState<string>('main');
  const [ghResult, setGhResult] = useState<GitHubRepoInspectionResult | null>(null);

  // 6. Acceptance 15-Gate & TDOC
  const [acceptanceSuite, setAcceptanceSuite] = useState<{
    total: number;
    passed: number;
    results: Array<{ id: number; name: string; passed: boolean; detail: string; durationNs: string }>;
    receiptR: TraceableExecutionReceiptR;
  } | null>(null);
  const [tdocData, setTdocData] = useState<{ tdocId: string; markdown: string; migrations: string[] } | null>(null);

  const callApi = async (url: string, options?: RequestInit) => {
    setErrorBanner(null);
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-cryptic-role': actorRole,
        ...(options?.headers || {}),
      },
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setErrorBanner(data.error || `Request failed (${res.status})`);
      return null;
    }
    return data;
  };

  const refreshMemory = async (searchStr = memSearch) => {
    const qs = searchStr ? `?search=${encodeURIComponent(searchStr)}` : '';
    const data = await callApi(`/api/memory${qs}`);
    if (data) {
      setMemoryEvents(data.events || []);
      setChainReport(data.chain || null);
    }
  };

  const refreshCapabilities = async (force = false) => {
    const data = await callApi(`/api/nuef/capabilities${force ? '?refresh=1' : ''}`);
    if (data) setCapabilities(data.capabilities || []);
  };

  const refreshReceiptsR = async () => {
    const data = await callApi('/api/receipts-r?limit=40');
    if (data) {
      setReceiptsR(data.receipts || []);
      setMerkleBatches(data.batches || []);
    }
  };

  const refreshAdaptersAndScans = async () => {
    const [aData, hData, tData] = await Promise.all([
      callApi('/api/adapters/status'),
      callApi('/api/hygiene/scans'),
      callApi('/api/tdoc/v61'),
    ]);
    if (aData) setAdapters(aData.adapters || []);
    if (hData) setHygieneScans(hData.scans || []);
    if (tData) setTdocData(tData);
  };

  useEffect(() => {
    callApi('/api/math/converge', {
      method: 'POST',
      body: JSON.stringify({ sampleText: mathSample, injectRsErrorCount: rsErrorCount, injectLdpcBitFlip: ldpcBitFlip }),
    }).then((d) => {
      if (d?.result) setMathResult(d.result);
    });
    refreshMemory();
    refreshCapabilities();
    refreshReceiptsR();
    refreshAdaptersAndScans();
  }, []);

  const handleExportArchive = async () => {
    const data = await callApi('/api/memory/archive/export');
    if (!data?.archive) return;
    const blob = new Blob([JSON.stringify(data.archive, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gaia-memory-archive-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full flex flex-col bg-[#06090F] text-slate-200 font-mono text-xs border border-slate-800">
      {/* Sub-navigation bar */}
      <div className="bg-[#0B1018] border-b border-slate-800 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'CONVERGENCE', label: '1. A = B ∧ C ∧ V & 4-Domain Math', icon: <Activity className="w-3.5 h-3.5" /> },
              { id: 'MEMORY', label: '2. Save_Memory & Corpus', icon: <Database className="w-3.5 h-3.5" /> },
              { id: 'QUINE_NUEF', label: '3. NUEF Capabilities & Quines', icon: <Terminal className="w-3.5 h-3.5" /> },
              { id: 'MERKLE_PQ', label: '4. PQ BLAKE2b Merkle Receipts', icon: <Lock className="w-3.5 h-3.5" /> },
              { id: 'HYGIENE_ADAPTERS', label: '5. Hygiene, GitHub & Drive Guard', icon: <Globe className="w-3.5 h-3.5" /> },
              { id: 'ACCEPTANCE_TDOC', label: '6. 15-Gate Verification & TDOC', icon: <FileCheck2 className="w-3.5 h-3.5" /> },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`px-3 py-1.5 border flex items-center gap-1.5 text-[11px] transition-colors ${
                subTab === t.id
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 font-semibold'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <div className="text-[10px] text-slate-400">
          GAIA/NEXUS v4.5 &bull; Role: <span className="text-emerald-400">{actorRole}</span>
        </div>
      </div>

      {errorBanner && (
        <div className="mx-4 mt-3 p-3 bg-rose-950/30 border border-rose-500/40 text-rose-300 flex items-center justify-between">
          <span>{errorBanner}</span>
          <button onClick={() => setErrorBanner(null)} className="text-slate-400 hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* TAB 1: A = B && C && V & 4-DOMAIN MATHEMATICAL CONVERGENCE */}
        {subTab === 'CONVERGENCE' && (
          <div className="space-y-4">
            <div className="bg-[#0B1018] border border-slate-800 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <div>
                  <div className="text-white font-semibold text-sm">
                    Unified 4-Domain Mathematical Convergence (gaia.mir.v1)
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Couples Linear Algebra &rarr; Coding Theory (RS + QC-LDPC) &rarr; Information Theory &rarr; Control Theory under A = B &and; C &and; V.
                  </div>
                </div>
                <button
                  onClick={async () => {
                    const d = await callApi('/api/math/converge', {
                      method: 'POST',
                      body: JSON.stringify({
                        sampleText: mathSample,
                        injectRsErrorCount: rsErrorCount,
                        injectLdpcBitFlip: ldpcBitFlip,
                      }),
                    });
                    if (d?.result) {
                      setMathResult(d.result);
                      await refreshReceiptsR();
                    }
                  }}
                  className="px-4 py-2 bg-emerald-500/20 border border-emerald-400 text-emerald-200 font-semibold flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" /> Execute 4-Domain Pipeline
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="text-[10px] text-slate-400 block mb-1">Input State / Payload Vector Seed</label>
                  <input
                    type="text"
                    value={mathSample}
                    onChange={(e) => setMathSample(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 p-2 text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">RS(15,11) Errors</label>
                    <select
                      value={rsErrorCount}
                      onChange={(e) => setRsErrorCount(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 p-2 text-white"
                    >
                      <option value={0}>0 Symbol Errors</option>
                      <option value={1}>1 Symbol Error</option>
                      <option value={2}>2 Symbol Errors</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">QC-LDPC Bit Flip</label>
                    <button
                      onClick={() => setLdpcBitFlip(!ldpcBitFlip)}
                      className={`w-full p-2 border ${
                        ldpcBitFlip ? 'bg-amber-500/20 border-amber-400 text-amber-200' : 'bg-slate-950 border-slate-700 text-slate-300'
                      }`}
                    >
                      {ldpcBitFlip ? 'Inject 1-Bit Error' : 'Clean Frame'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {mathResult && (
              <>
                {/* Architect Invariant A = B && C && V Matrix */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 tabular-nums">
                  <div className="bg-[#0B1018] border border-slate-800 p-3">
                    <div className="text-[10px] text-slate-400">B: EXECUTION BOUNDARY</div>
                    <div className={`text-sm font-semibold mt-1 ${mathResult.convergence.B_boundaryValid ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {mathResult.convergence.B_boundaryValid ? 'PASS' : 'FAIL'}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">{mathResult.convergence.B_reason}</div>
                  </div>
                  <div className="bg-[#0B1018] border border-slate-800 p-3">
                    <div className="text-[10px] text-slate-400">C: CLOCK & CAPACITY</div>
                    <div className={`text-sm font-semibold mt-1 ${mathResult.convergence.C_capacityValid ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {mathResult.convergence.C_capacityValid ? 'PASS' : 'FAIL'}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">{mathResult.convergence.C_reason}</div>
                  </div>
                  <div className="bg-[#0B1018] border border-slate-800 p-3">
                    <div className="text-[10px] text-slate-400">V: INDEPENDENT VERIFICATION</div>
                    <div className={`text-sm font-semibold mt-1 ${mathResult.convergence.V_verificationValid ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {mathResult.convergence.V_verificationValid ? 'PASS' : 'FAIL'}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">{mathResult.convergence.V_reason}</div>
                  </div>
                  <div className="bg-[#0B1018] border border-cyan-500/40 p-3">
                    <div className="text-[10px] text-cyan-300">A = B &and; C &and; V</div>
                    <div className={`text-sm font-semibold mt-1 ${mathResult.convergence.A_accepted ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {mathResult.convergence.statusLabel} ({String(mathResult.convergence.A_accepted)})
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">Receipt: {mathResult.receiptR.ID}</div>
                  </div>
                </div>

                {/* 4 Domain Stage Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 tabular-nums">
                  {mathResult.stages.map((st) => (
                    <div key={st.stage} className="bg-[#0B1018] border border-slate-800 p-3 space-y-2">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                        <span className="text-white font-semibold">{st.title}</span>
                        <span className={st.verificationPassed ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                          {st.verificationPassed ? 'VERIFIED' : 'FAILED'}
                        </span>
                      </div>
                      <div className="text-[11px] text-cyan-300">{st.verificationDetail}</div>
                      <div className="grid grid-cols-2 gap-1.5 text-[10px] bg-slate-950 p-2 border border-slate-800">
                        {Object.entries(st.metrics).map(([k, v]) => (
                          <div key={k} className="flex justify-between gap-2">
                            <span className="text-slate-400">{k}:</span>
                            <span className="text-white font-semibold">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="text-[10px] text-slate-500 flex justify-between">
                        <span>Version: {st.algorithmVersion}</span>
                        <span>Duration: {st.runtimeNs} ns</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Honest External Math/Quantum Provider Boundaries */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                  <div className="p-3 bg-[#0B1018] border border-amber-500/40">
                    <div className="text-amber-300 font-semibold">Qiskit Adapter: {mathResult.qiskitAdapterStatus.state}</div>
                    <div className="text-slate-300 mt-1">{mathResult.qiskitAdapterStatus.reason}</div>
                  </div>
                  <div className="p-3 bg-[#0B1018] border border-slate-800">
                    <div className="text-cyan-300 font-semibold">
                      Wolfram / CAS Boundary: {mathResult.wolframAdapterStatus.wolframCloudConfigured ? 'CLOUD_READY' : 'LOCAL_CAS_ONLY'}
                    </div>
                    <div className="text-slate-300 mt-1">{mathResult.wolframAdapterStatus.reason}</div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 2: SAVE_MEMORY & LEXICAL CORPUS */}
        {subTab === 'MEMORY' && (
          <div className="space-y-4">
            <div className="bg-[#0B1018] border border-slate-800 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <div>
                  <div className="text-white font-semibold text-sm">Canonical Save_Memory (gaia.memory.event.v1)</div>
                  <div className="text-[11px] text-slate-400">
                    Preserves UTF-8, symbols, and RuneScape/lexical corpus verbatim inside SQLite WAL hash chain. Redacts secrets cleanly prior to write.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => refreshMemory()}
                    className="px-3 py-1.5 bg-slate-900 border border-slate-700 hover:border-cyan-400 text-slate-200 flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Verify Linear Chain
                  </button>
                  <button
                    onClick={handleExportArchive}
                    className="px-3 py-1.5 bg-slate-900 border border-slate-700 hover:border-cyan-400 text-cyan-300 flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> Export Archive JSON
                  </button>
                </div>
              </div>

              <textarea
                rows={4}
                value={memPayload}
                onChange={(e) => setMemPayload(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 p-2.5 text-white font-mono text-xs"
                placeholder="Enter exact UTF-8 payload, lexical corpus text, or Unicode symbols..."
              />

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input
                  type="text"
                  value={memProject}
                  onChange={(e) => setMemProject(e.target.value)}
                  placeholder="Project"
                  className="bg-slate-950 border border-slate-700 p-2 text-white"
                />
                <input
                  type="text"
                  value={memEventType}
                  onChange={(e) => setMemEventType(e.target.value)}
                  placeholder="Event Type"
                  className="bg-slate-950 border border-slate-700 p-2 text-white"
                />
                <input
                  type="text"
                  value={memTags}
                  onChange={(e) => setMemTags(e.target.value)}
                  placeholder="Comma-separated tags"
                  className="bg-slate-950 border border-slate-700 p-2 text-white"
                />
                <input
                  type="text"
                  value={memIdemKey}
                  onChange={(e) => setMemIdemKey(e.target.value)}
                  placeholder="Optional Idempotency Key"
                  className="bg-slate-950 border border-slate-700 p-2 text-white"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={userConsent}
                    onChange={(e) => setUserConsent(e.target.checked)}
                    className="accent-emerald-400"
                  />
                  <span>Explicit User Consent (Boundary B Authorization: unchecking tests Gate A rejection)</span>
                </label>
                <button
                  onClick={async () => {
                    setLastMemMsg(null);
                    const d = await callApi('/api/memory/save', {
                      method: 'POST',
                      body: JSON.stringify({
                        event: {
                          payload: memPayload,
                          project: memProject,
                          eventType: memEventType,
                          tags: memTags.split(',').map((s) => s.trim()).filter(Boolean),
                          idempotencyKey: memIdemKey.trim() || undefined,
                        },
                        authorizationContext: {
                          userConsent,
                          actorRole,
                        },
                      }),
                    });
                    if (d) {
                      setLastMemMsg(
                        `Committed seq #${d.event.sequence} (${d.event.event_id}) | SHA-256 verified=${d.verification.verified} | Redacted=${d.event.redaction.redacted ? d.event.redaction.rulesTriggered.join(',') : 'NONE'}`
                      );
                      await refreshMemory();
                      await refreshReceiptsR();
                    }
                  }}
                  className="px-4 py-2 bg-emerald-500/20 border border-emerald-400 text-emerald-200 font-semibold"
                >
                  Save_Memory Commit
                </button>
              </div>

              {lastMemMsg && (
                <div className="p-2.5 bg-emerald-950/25 border border-emerald-500/40 text-emerald-300 text-[11px]">
                  {lastMemMsg}
                </div>
              )}
            </div>

            {chainReport && (
              <div className={`p-3 border flex flex-wrap justify-between gap-2 ${chainReport.chainValid ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300' : 'bg-rose-950/30 border-rose-500/40 text-rose-300'}`}>
                <span>
                  Linear Hash Chain: <strong>{chainReport.chainValid ? 'INTACT' : 'BROKEN'}</strong> &bull; {chainReport.reason}
                </span>
                <span className="truncate max-w-md text-[10px]">Head: {chainReport.headHash}</span>
              </div>
            )}

            {/* Search & Verbatim Ledger List */}
            <div className="bg-[#0B1018] border border-slate-800 p-4 space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={memSearch}
                  onChange={(e) => setMemSearch(e.target.value)}
                  placeholder="Search SQLite memory events verbatim..."
                  className="flex-1 bg-slate-950 border border-slate-700 p-2 text-white"
                />
                <button
                  onClick={() => refreshMemory(memSearch)}
                  className="px-3 py-2 bg-slate-900 border border-slate-700 hover:border-cyan-400 flex items-center gap-1"
                >
                  <Search className="w-3.5 h-3.5" /> Query
                </button>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto">
                {memoryEvents.map((ev) => (
                  <div key={ev.event_id} className="p-3 bg-slate-950 border border-slate-800 space-y-1 text-[11px]">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="text-cyan-300 font-semibold">
                        seq #{ev.sequence} &bull; {ev.event_id} &bull; {ev.event_type}
                      </span>
                      <span className="text-slate-400">
                        {ev.created_utc} &bull; Redacted: {ev.redaction.redacted ? ev.redaction.rulesTriggered.join(', ') : 'None'}
                      </span>
                    </div>
                    <pre className="whitespace-pre-wrap break-words bg-[#06090F] p-2 border border-slate-800/80 text-white">
                      {ev.payload}
                    </pre>
                    <div className="text-[10px] text-slate-400 flex flex-wrap justify-between gap-2">
                      <span className="truncate">sha256: {ev.payload_sha256}</span>
                      <span className="truncate">eventHash: {ev.event_hash.slice(0, 24)}...</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: NUEF HOST CAPABILITIES & POLYGLOT QUINE */}
        {subTab === 'QUINE_NUEF' && (
          <div className="space-y-4">
            <div className="bg-[#0B1018] border border-slate-800 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <div>
                  <div className="text-white font-semibold text-sm">
                    Shebang-Free Polyglot Quine Dispatcher (TypedCommandIR)
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Executes real container binaries via execFile (shell=false, zero shebangs) verifying Q(Q)=Q &amp; H(S)=H(Q(S)) with SHA-256 + BLAKE2b.
                  </div>
                </div>
                <button
                  onClick={async () => {
                    const d = await callApi('/api/nuef/quine/run', {
                      method: 'POST',
                      body: JSON.stringify({
                        runtimeId: quineRuntime,
                        mode: quineMode,
                        statePayload: quineStatePayload,
                      }),
                    });
                    if (d?.result) {
                      setQuineResult(d.result);
                      await refreshReceiptsR();
                    }
                  }}
                  className="px-4 py-2 bg-cyan-500/20 border border-cyan-400 text-cyan-200 font-semibold flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" /> Execute Real Host Quine
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Host Interpreter Target</label>
                  <select
                    value={quineRuntime}
                    onChange={(e) => setQuineRuntime(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 p-2 text-white"
                  >
                    <option value="NODE_JS">Node.js (node -e)</option>
                    <option value="PYTHON3">Python 3 (python3 -c)</option>
                    <option value="BASH">GNU Bash (bash -c)</option>
                    <option value="POSIX_SH">POSIX sh (sh -c)</option>
                    <option value="BUN">Bun (bun -e)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Quine Mode</label>
                  <select
                    value={quineMode}
                    onChange={(e) => setQuineMode(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 p-2 text-white"
                  >
                    <option value="SELF_QUINE">Q(Q) = Q Exact Self-Quine</option>
                    <option value="STATE_WRAPPER">H(S) = H(Q(S)) State Envelope</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">State Wrapper Payload</label>
                  <input
                    type="text"
                    value={quineStatePayload}
                    onChange={(e) => setQuineStatePayload(e.target.value)}
                    disabled={quineMode === 'SELF_QUINE'}
                    className="w-full bg-slate-950 border border-slate-700 p-2 text-white disabled:opacity-50"
                  />
                </div>
              </div>

              {quineResult && (
                <div className="p-3 bg-slate-950 border border-slate-800 space-y-2 text-[11px]">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="text-white font-semibold">
                      {quineResult.runtimeId} ({quineResult.hostBinaryPath || 'UNAVAILABLE'})
                    </span>
                    <span className={quineResult.status === 'VERIFIED_QUINE' ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                      {quineResult.status} &bull; {(Number(quineResult.durationNs) / 1e6).toFixed(2)} ms
                    </span>
                  </div>
                  <div className="text-slate-300">{quineResult.reason}</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px]">
                    <div className="p-2 bg-[#06090F] border border-slate-800">
                      <span className="text-slate-400 block">Source (No Shebang):</span>
                      <code className="text-cyan-300 break-all">{quineResult.sourceCode}</code>
                    </div>
                    <div className="p-2 bg-[#06090F] border border-slate-800">
                      <span className="text-slate-400 block">Host Stdout:</span>
                      <code className="text-emerald-300 break-all">{quineResult.stdoutOutput || '—'}</code>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    Input SHA-256: {quineResult.inputSha256} | Output SHA-256: {quineResult.outputSha256 || 'N/A'} | Receipt: {quineResult.receiptR.ID}
                  </div>
                </div>
              )}
            </div>

            {/* Host Capabilities & Package Manager Table */}
            <div className="bg-[#0B1018] border border-slate-800 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-white font-semibold">
                  Host Interpreter &amp; Package-Manager Capability Probe ({capabilities.filter((c) => c.available).length} AVAILABLE / {capabilities.filter((c) => !c.available).length} UNAVAILABLE)
                </div>
                <button
                  onClick={() => refreshCapabilities(true)}
                  className="px-3 py-1 bg-slate-900 border border-slate-700 hover:border-cyan-400 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Re-Probe PATH
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto border border-slate-800">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Tool</th>
                      <th className="py-2 px-3">Kind</th>
                      <th className="py-2 px-3">Binary</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Version / Path</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {capabilities.map((c) => (
                      <tr key={c.id}>
                        <td className="py-1.5 px-3 text-white">{c.name}</td>
                        <td className="py-1.5 px-3 text-slate-400">{c.kind}</td>
                        <td className="py-1.5 px-3 text-cyan-300">{c.binary}</td>
                        <td className={`py-1.5 px-3 font-semibold ${c.available ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {c.status}
                        </td>
                        <td className="py-1.5 px-3 text-slate-300 truncate max-w-xs">
                          {c.available ? `${c.version} (${c.resolvedPath})` : 'Not present; auto-install disabled'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PQ BLAKE2B MERKLE & TRACEABLE RECEIPTS R */}
        {subTab === 'MERKLE_PQ' && (
          <div className="space-y-4">
            <div className="bg-[#0B1018] border border-slate-800 p-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-white font-semibold text-sm">Traceable Execution Receipts R = {'{ID, T, M, H_in, H_out, V, A}'}</div>
                <div className="text-[11px] text-slate-400">
                  Signed with Hybrid Post-Quantum WOTS+ (blake2b512) + native Ed25519 co-signatures inside SQLite WAL.
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={refreshReceiptsR}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-700 hover:border-cyan-400"
                >
                  Refresh Receipts
                </button>
                <button
                  onClick={async () => {
                    const d = await callApi('/api/merkle/batch', { method: 'POST', body: JSON.stringify({}) });
                    if (d?.batch) {
                      setVerifiedReceiptMsg(`Committed BLAKE2b Merkle Batch ${d.batch.batchId} (${d.batch.leafCount} leaves, root=${d.batch.rootBlake2bHex.slice(0, 20)}...)`);
                      await refreshReceiptsR();
                    }
                  }}
                  className="px-4 py-1.5 bg-cyan-500/20 border border-cyan-400 text-cyan-200 font-semibold"
                >
                  Commit BLAKE2b Merkle Batch
                </button>
              </div>
            </div>

            {verifiedReceiptMsg && (
              <div className="p-3 bg-emerald-950/25 border border-emerald-500/40 text-emerald-300">
                {verifiedReceiptMsg}
              </div>
            )}

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {receiptsR.map((r) => (
                <div key={r.ID} className="p-3 bg-[#0B1018] border border-slate-800 space-y-1 text-[11px]">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="text-cyan-300 font-semibold">
                      {r.ID} &bull; {r.M.subsystem} / {r.M.operationId}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={r.A ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                        {r.V.outcome} (A={String(r.A)})
                      </span>
                      <button
                        onClick={async () => {
                          const d = await callApi(`/api/receipts-r/${r.ID}/verify`);
                          if (d?.verification) {
                            setVerifiedReceiptMsg(
                              `Receipt ${r.ID}: leafBlake2b=${d.verification.leafHashValid}, ed25519=${d.verification.ed25519Valid}`
                            );
                          }
                        }}
                        className="px-2 py-0.5 bg-slate-900 border border-slate-700 hover:border-emerald-400 text-[10px]"
                      >
                        Verify Signature
                      </button>
                    </div>
                  </div>
                  <div className="text-slate-300">{r.V.detail}</div>
                  <div className="text-[10px] text-slate-500 truncate">
                    BLAKE2b Root: {r.V.blake2bMerkleRootHex} | Scheme: {r.V.pqSignature.scheme} ({r.V.pqSignature.wotsSignatureCount} WOTS limbs)
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: TROJAN HYGIENE SCANNER & GITHUB / GOOGLE DRIVE GUARD */}
        {subTab === 'HYGIENE_ADAPTERS' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Hygiene Scanner */}
              <div className="bg-[#0B1018] border border-slate-800 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-white font-semibold">Trojan, Malware &amp; Ledger Tamper Scanner</span>
                  <button
                    onClick={async () => {
                      const d = await callApi('/api/hygiene/scan', { method: 'POST', body: JSON.stringify({}) });
                      if (d?.report) {
                        await refreshAdaptersAndScans();
                        await refreshReceiptsR();
                      }
                    }}
                    className="px-3 py-1.5 bg-emerald-500/20 border border-emerald-400 text-emerald-200 font-semibold"
                  >
                    Run Workspace Scan
                  </button>
                </div>
                {hygieneScans[0] ? (
                  <div className="space-y-2 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Latest Scan: {hygieneScans[0].scanId}</span>
                      <span className={hygieneScans[0].trojanOrMalwareDetected ? 'text-rose-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                        {hygieneScans[0].trojanOrMalwareDetected ? 'FINDINGS DETECTED' : 'CLEAN (0 TROJANS / 0 TAMPERS)'}
                      </span>
                    </div>
                    <div className="text-slate-300">
                      Files Scanned: {hygieneScans[0].filesScanned} | Memory Events: {hygieneScans[0].memoryEventsChecked} | Receipts: {hygieneScans[0].receiptsChecked}
                    </div>
                    <div className="text-[10px] text-cyan-300 truncate">Manifest SHA-256: {hygieneScans[0].manifestSha256}</div>
                    <div className="space-y-1 max-h-36 overflow-y-auto">
                      {hygieneScans[0].findings.map((f) => (
                        <div key={f.findingId} className="p-2 bg-slate-950 border border-slate-800 text-[10px]">
                          <strong className="text-emerald-300">[{f.severity}] {f.category}:</strong> {f.description} ({f.target})
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-400">Click Run Workspace Scan to audit src/ files and SQLite SHA-256 chain.</div>
                )}
              </div>

              {/* GitHub REST v3 Live Repo Tree Inspector */}
              <div className="bg-[#0B1018] border border-slate-800 p-4 space-y-3">
                <div className="text-white font-semibold border-b border-slate-800 pb-2">
                  GitHub REST v3 Repository Tree Inspector (Live API)
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input type="text" value={ghOwner} onChange={(e) => setGhOwner(e.target.value)} placeholder="Owner" className="bg-slate-950 border border-slate-700 p-2 text-white" />
                  <input type="text" value={ghRepo} onChange={(e) => setGhRepo(e.target.value)} placeholder="Repo" className="bg-slate-950 border border-slate-700 p-2 text-white" />
                  <input type="text" value={ghRef} onChange={(e) => setGhRef(e.target.value)} placeholder="Branch" className="bg-slate-950 border border-slate-700 p-2 text-white" />
                </div>
                <button
                  onClick={async () => {
                    const d = await callApi('/api/adapters/github/inspect', {
                      method: 'POST',
                      body: JSON.stringify({ owner: ghOwner, repo: ghRepo, ref: ghRef }),
                    });
                    if (d?.inspection) setGhResult(d.inspection);
                    if (d?.adapters) setAdapters(d.adapters);
                  }}
                  className="w-full py-2 bg-cyan-500/20 border border-cyan-400 text-cyan-200 font-semibold"
                >
                  Inspect Live GitHub Branch &amp; Tree
                </button>
                {ghResult && (
                  <div className="p-2.5 bg-slate-950 border border-slate-800 space-y-1 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-white font-semibold">{ghResult.owner}/{ghResult.repo}@{ghResult.ref}</span>
                      <span className={ghResult.state === 'VERIFIED' ? 'text-emerald-400' : 'text-rose-400'}>{ghResult.state}</span>
                    </div>
                    <div className="text-slate-300">{ghResult.detail}</div>
                    {ghResult.treeEntries.length > 0 && (
                      <div className="max-h-24 overflow-y-auto text-cyan-300 pt-1">
                        {ghResult.treeEntries.slice(0, 12).map((e) => (
                          <div key={e.sha + e.path}>{e.type}: {e.path}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* External Adapter Lifecycle Matrix */}
            <div className="bg-[#0B1018] border border-slate-800 p-4 space-y-2">
              <div className="text-white font-semibold">Honest Network &amp; External Adapter Connection Matrix</div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {adapters.map((a) => (
                  <div key={a.adapterId} className="p-2.5 bg-slate-950 border border-slate-800 space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-white font-semibold">{a.label}</span>
                      <span
                        className={
                          a.state === 'CONNECTED' || a.state === 'VERIFIED'
                            ? 'text-emerald-400 font-semibold'
                            : a.state === 'CONFIGURED'
                              ? 'text-cyan-300 font-semibold'
                              : 'text-amber-400 font-semibold'
                        }
                      >
                        {a.state}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">{a.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: 15-GATE SECTION 11 VERIFICATION & TDOC LINEAGE */}
        {subTab === 'ACCEPTANCE_TDOC' && (
          <div className="space-y-4">
            <div className="bg-[#0B1018] border border-slate-800 p-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-white font-semibold text-sm">Section 11 Automated Verification Suite (15 Required Gates)</div>
                <div className="text-[11px] text-slate-400">
                  Verifies Unicode verbatim preservation, SHA-256 chain integrity, tamper detection, rollback/idempotency, Gate A consent &amp; RBAC denial, Quantum Rose snapshots, package-manager availability, live Quines, 4-Domain Math Convergence, and Qiskit/Drive honesty.
                </div>
              </div>
              <button
                onClick={async () => {
                  const d = await callApi('/api/acceptance/v61/run', { method: 'POST', body: JSON.stringify({}) });
                  if (d) {
                    setAcceptanceSuite({ total: d.total, passed: d.passed, results: d.results, receiptR: d.receiptR });
                    await refreshMemory();
                    await refreshReceiptsR();
                  }
                }}
                className="px-4 py-2 bg-emerald-500/20 border border-emerald-400 text-emerald-200 font-semibold"
              >
                Run All 15 Section-11 Gates
              </button>
            </div>

            {acceptanceSuite && (
              <div className="space-y-2">
                <div className="p-3 bg-emerald-950/20 border border-emerald-500/40 text-emerald-300 flex justify-between">
                  <span>
                    Section 11 Suite Result: <strong>{acceptanceSuite.passed}/{acceptanceSuite.total} PASSED</strong>
                  </span>
                  <span>Receipt R: {acceptanceSuite.receiptR.ID}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {acceptanceSuite.results.map((r) => (
                    <div key={r.id} className={`p-2.5 border ${r.passed ? 'bg-slate-950 border-emerald-500/30' : 'bg-rose-950/30 border-rose-500/40'}`}>
                      <div className="flex justify-between font-semibold">
                        <span className="text-white">#{r.id}: {r.name}</span>
                        <span className={r.passed ? 'text-emerald-400' : 'text-rose-400'}>{r.passed ? 'PASS' : 'FAIL'}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">{r.detail} ({(Number(r.durationNs) / 1e6).toFixed(2)} ms)</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tdocData && (
              <div className="bg-[#0B1018] border border-slate-800 p-4 space-y-2">
                <div className="text-cyan-300 font-semibold">TDOC Identifier: {tdocData.tdocId}</div>
                <pre className="whitespace-pre-wrap text-[11px] text-slate-300 bg-slate-950 border border-slate-800 p-3 max-h-72 overflow-y-auto">
                  {tdocData.markdown}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
