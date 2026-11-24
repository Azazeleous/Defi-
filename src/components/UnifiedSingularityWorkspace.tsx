import React, { useState } from 'react';
import { 
  ShieldCheck, Cpu, Database, Orbit, Layers, Binary, ArrowRightLeft, 
  FileText, CheckCircle2, RefreshCw, Terminal, Sparkles, ShieldAlert 
} from 'lucide-react';
import { globalSingularityEngine, HistoricalSnapshot } from '../engine/unifiedSingularityEngine';

export const UnifiedSingularityWorkspace: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'INVARIANT' | 'ADL_SCHEDULE' | 'SNAPSHOTS' | 'DEWEY_INDEX' | 'PLANES'>('INVARIANT');
  const [snapshots, setSnapshots] = useState<HistoricalSnapshot[]>(() => globalSingularityEngine.listSnapshots());
  const [newEventType, setNewEventType] = useState<string>('SYSTEM_CHECKPOINT');
  const [newPayload, setNewPayload] = useState<string>('GAIA/NEXUS Singularity Genesis State v7.0.0');
  const [selectedSnapshot, setSelectedSnapshot] = useState<HistoricalSnapshot | null>(null);

  const adlSchedule = globalSingularityEngine.getADLSchedule();
  const inverseADL = globalSingularityEngine.getInverseADLSchedule();
  const deweyIndex = globalSingularityEngine.getDeweyIndexStructure();

  const handleCreateSnapshot = (e: React.FormEvent) => {
    e.preventDefault();
    const created = globalSingularityEngine.createSnapshot(newEventType, newPayload, 'ALG_SHA256_SINGULARITY');
    setSnapshots(globalSingularityEngine.listSnapshots());
    setSelectedSnapshot(created);
  };

  return (
    <div className="w-full p-4 sm:p-6 max-w-7xl mx-auto font-mono text-xs text-slate-100 space-y-6">
      
      {/* Top Banner */}
      <div className="bg-[#060b14] border border-cyan-500/30 p-4 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-400">
            <Orbit className="w-6 h-6 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-wider">
                GAIA / NEXUS &bull; UNIFIED SINGULARITY &amp; VERIFIABLE HISTORY
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
                SPEC v1.0.0
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Central Six-Axis Hypercube &bull; AE.BELLMAN.ADAPTIVE.IO &bull; Immutable Snapshot &amp; NFT Provenance Registry
            </p>
          </div>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex items-center bg-slate-950 border border-slate-800 p-1 rounded-xl overflow-x-auto max-w-full">
          {(['INVARIANT', 'ADL_SCHEDULE', 'SNAPSHOTS', 'DEWEY_INDEX', 'PLANES'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-cyan-500 text-black shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: Invariant & Proof Domains */}
      {activeTab === 'INVARIANT' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 bg-[#060b14] border border-cyan-500/30 p-5 rounded-2xl space-y-4">
            <div className="border-b border-cyan-950 pb-2 flex justify-between items-center">
              <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                The Architect&apos;s Governing Invariant (A = B &amp;&amp; C &amp;&amp; V)
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                ADMISSIBLE: TRUE
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950 border border-slate-800 flex justify-between items-center">
                <div>
                  <strong className="text-cyan-300">B (Boundary Admissibility):</strong>
                  <div className="text-slate-400 text-[11px]">Execution within authorized temporal &amp; coordinate bounds</div>
                </div>
                <span className="text-emerald-400 font-bold">TRUE</span>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 flex justify-between items-center">
                <div>
                  <strong className="text-cyan-300">C (Measured Capacity):</strong>
                  <div className="text-slate-400 text-[11px]">Real-time resource budget, memory ceiling &amp; interval jitter</div>
                </div>
                <span className="text-emerald-400 font-bold">TRUE</span>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 flex justify-between items-center">
                <div>
                  <strong className="text-cyan-300">V (Independent Verification):</strong>
                  <div className="text-slate-400 text-[11px]">V_recovery &amp;&amp; V_algebraic &amp;&amp; V_cryptographic</div>
                </div>
                <span className="text-emerald-400 font-bold">TRUE</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-[#060b14] border border-cyan-500/30 p-5 rounded-2xl space-y-4">
            <div className="border-b border-cyan-950 pb-2">
              <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-emerald-400" />
                Three Independent Proof Domains
              </h3>
            </div>

            <div className="space-y-2 text-[11px] leading-relaxed text-slate-300">
              <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg">
                <strong className="text-emerald-300 block mb-0.5">1. V_recovery (Payload Reconstruction)</strong>
                Verifies preserved original bytes can be independently reconstructed and validated against content digests.
              </div>
              <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg">
                <strong className="text-emerald-300 block mb-0.5">2. V_algebraic (Mathematical Invariants)</strong>
                Checks modular arithmetic, prime matrix coprimality, and inverse schedule mappings S^-1.
              </div>
              <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg">
                <strong className="text-emerald-300 block mb-0.5">3. V_cryptographic (Digests &amp; Merkle Proofs)</strong>
                Validates SHA-256/SHA-256d payloads, signed receipts, and Merkle inclusion roots.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: ADL Schedule & Reverse Schedule */}
      {activeTab === 'ADL_SCHEDULE' && (
        <div className="bg-[#060b14] border border-cyan-500/30 p-5 rounded-2xl space-y-4">
          <div className="border-b border-cyan-950 pb-2 flex justify-between items-center">
            <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-cyan-400" />
              Six-Position ADL Schedule (L = [2,1,1,2,2,1]) &amp; Inverse (S^-1)
            </h3>
            <span className="text-[10px] text-slate-400">AE.BELLMAN.ADAPTIVE.IO</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Forward Schedule S */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <span className="text-cyan-300 font-bold block mb-2">Forward Schedule S:</span>
              <div className="space-y-1.5">
                {adlSchedule.map((ev) => (
                  <div key={`fwd-${ev.position}`} className="p-2 bg-slate-900 border border-slate-800 flex justify-between text-[11px]">
                    <span>Pos {ev.position} &bull; Lane {ev.lane}</span>
                    <span className={ev.direction > 0 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                      Direction: {ev.direction > 0 ? '+1 (Forward)' : '-1 (Backward)'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Inverse Schedule S^-1 */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <span className="text-amber-300 font-bold block mb-2">Inverse Schedule S^-1 = Reverse(S) (d_i -&gt; -d_i):</span>
              <div className="space-y-1.5">
                {inverseADL.map((ev, idx) => (
                  <div key={`inv-${idx}`} className="p-2 bg-slate-900 border border-slate-800 flex justify-between text-[11px]">
                    <span>Step {idx + 1} &bull; Lane {ev.lane}</span>
                    <span className={ev.direction > 0 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                      Inverted Dir: {ev.direction > 0 ? '+1' : '-1'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Historical Snapshot & NFT Registry */}
      {activeTab === 'SNAPSHOTS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 bg-[#060b14] border border-cyan-500/30 p-5 rounded-2xl space-y-4">
            <div className="border-b border-cyan-950 pb-2">
              <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
                <Database className="w-4 h-4 text-cyan-400" />
                Commit Historical Snapshot
              </h3>
            </div>

            <form onSubmit={handleCreateSnapshot} className="space-y-3">
              <div>
                <label className="text-slate-300 block mb-1">Event Type / Classification</label>
                <input
                  type="text"
                  value={newEventType}
                  onChange={(e) => setNewEventType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 p-2 text-xs text-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Payload / Artifact String</label>
                <textarea
                  rows={4}
                  value={newPayload}
                  onChange={(e) => setNewPayload(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 p-2 text-xs text-slate-200 rounded-lg resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-black font-bold rounded-lg transition"
              >
                Create Immutable Snapshot &amp; NFT Receipt
              </button>
            </form>

            <div className="space-y-2 mt-4">
              <span className="text-slate-400 block text-[11px] font-bold">Existing Snapshots ({snapshots.length}):</span>
              <div className="max-h-[160px] overflow-y-auto space-y-1 pr-1">
                {snapshots.map((s) => (
                  <button
                    key={s.snapshotId}
                    onClick={() => setSelectedSnapshot(s)}
                    className={`w-full text-left p-2 rounded-lg border text-[11px] flex justify-between items-center transition ${
                      selectedSnapshot?.snapshotId === s.snapshotId
                        ? 'bg-cyan-500/20 border-cyan-400 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-300'
                    }`}
                  >
                    <span className="font-bold">{s.snapshotId}</span>
                    <span className="text-emerald-400 text-[10px]">{s.eventType}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 bg-[#060b14] border border-cyan-500/30 p-5 rounded-2xl space-y-4 flex flex-col">
            <div className="border-b border-cyan-950 pb-2">
              <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                Snapshot JSON Canonicalization &amp; NFT Metadata
              </h3>
            </div>

            {selectedSnapshot ? (
              <div className="flex-1 flex flex-col gap-3">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[11px] space-y-1">
                  <div className="text-cyan-300 font-bold">Snapshot ID: {selectedSnapshot.snapshotId}</div>
                  <div className="text-slate-400">Created: {selectedSnapshot.createdUtc}</div>
                  <div className="text-emerald-400">SHA-256 Digest: {selectedSnapshot.artifact.digest}</div>
                  <div className="text-purple-400">Merkle Root: {selectedSnapshot.merkle.root}</div>
                </div>

                <div className="flex-1 bg-slate-950 border border-slate-800 p-3 rounded-xl overflow-y-auto max-h-[280px]">
                  <pre className="text-[10px] text-cyan-200 whitespace-pre-wrap font-mono select-text">
                    {JSON.stringify(selectedSnapshot, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
                Select a historical snapshot on the left to inspect its canonical JSON structure &amp; NFT receipt.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Dewey Decimal Index */}
      {activeTab === 'DEWEY_INDEX' && (
        <div className="bg-[#060b14] border border-cyan-500/30 p-5 rounded-2xl space-y-4">
          <div className="border-b border-cyan-950 pb-2">
            <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
              <Binary className="w-4 h-4 text-cyan-400" />
              Dewey Decimal System Index File Structure (CRYPTIC Cube Navigator)
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {deweyIndex.map((d) => (
              <div key={d.code} className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <div className="text-cyan-400 font-bold text-sm">{d.code}</div>
                <div className="text-slate-300 text-[11px] leading-snug">{d.title}</div>
                <span className="inline-block mt-2 text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                  {d.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: 8 Interoperable Planes */}
      {activeTab === 'PLANES' && (
        <div className="bg-[#060b14] border border-cyan-500/30 p-5 rounded-2xl space-y-4">
          <div className="border-b border-cyan-950 pb-2">
            <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              Eight Interoperable Planes (Specification v1.0.0)
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {[
              { plane: 'Plane A', name: 'Canonical State & Control', status: 'ACTIVE' },
              { plane: 'Plane B', name: 'Adaptive Directional-Lattice', status: 'ACTIVE' },
              { plane: 'Plane C', name: 'Cryptographic Computation', status: 'ACTIVE' },
              { plane: 'Plane D', name: 'Error Correction & QC-LDPC', status: 'ACTIVE' },
              { plane: 'Plane E', name: 'Blockchain & Merkle Proofs', status: 'ACTIVE' },
              { plane: 'Plane F', name: 'Historical Snapshot & NFT', status: 'ACTIVE' },
              { plane: 'Plane G', name: 'CRYPTIC Cube & Geometry', status: 'ACTIVE' },
              { plane: 'Plane H', name: 'AI Model & Algorithm Registry', status: 'ACTIVE' },
            ].map((p) => (
              <div key={p.plane} className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-cyan-400 font-bold">{p.plane}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                    {p.status}
                  </span>
                </div>
                <div className="text-slate-200 font-medium text-[11px]">{p.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
