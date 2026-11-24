import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Download,
  FileJson,
  Layers,
  Lock,
  Save,
  ShieldCheck,
} from 'lucide-react';
import type { GrimoireComposition, GrimoireSourceArtifact } from '../contracts/v7-convergence';
import type { DreamLogEntry } from '../contracts/cryptic-platform';
import { globalCircularRuntime } from '../engine/circularProcessingRuntime';

export const DreamingGrimoireWorkspace: React.FC = () => {
  const [title, setTitle] = useState<string>('Hamiltonian Convergence Plate I');
  const [narrativeNote, setNarrativeNote] = useState<string>(
    'Observer journal retained verbatim: calm obsidian wavefield synchronized with closed-system eigenstates.'
  );
  const [includeQuantumRose, setIncludeQuantumRose] = useState<boolean>(true);
  const [includeMathDigest, setIncludeMathDigest] = useState<boolean>(true);
  const [includeDreamJournal, setIncludeDreamJournal] = useState<boolean>(true);
  const [userConsent, setUserConsent] = useState<boolean>(true);
  const [userApproved, setUserApproved] = useState<boolean>(true);
  const [compositions, setCompositions] = useState<GrimoireComposition[]>([]);
  const [dreamLogs, setDreamLogs] = useState<DreamLogEntry[]>([]);
  const [activeComp, setActiveComp] = useState<GrimoireComposition | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [gRes, dRes] = await Promise.all([
        fetch('/api/v7/grimoire/compositions'),
        fetch('/api/dreamscape/logs'),
      ]);
      const gData = await gRes.json();
      const dData = await dRes.json();
      if (gData.ok && Array.isArray(gData.compositions)) {
        setCompositions(gData.compositions);
        if (!activeComp && gData.compositions.length > 0) {
          setActiveComp(gData.compositions[0]);
        }
      }
      if (dData.ok && Array.isArray(dData.logs)) {
        setDreamLogs(dData.logs);
      }
    } catch {
      // keep existing UI state on transient fetch error
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCompose = async () => {
    setSubmitting(true);
    setStatusNotice(null);
    try {
      const latestHam = globalCircularRuntime.getLatestSnapshot();
      const sources: Array<{
        sourceId?: string;
        kind: GrimoireSourceArtifact['kind'];
        title: string;
        rawContent: string;
        provenance: GrimoireSourceArtifact['provenance'];
        epistemicStatus: GrimoireSourceArtifact['epistemicStatus'];
      }> = [];

      if (includeQuantumRose) {
        sources.push({
          sourceId: `qrose_${latestHam.activePalette.paletteHash}`,
          kind: 'QUANTUM_ROSE_SNAPSHOT',
          title: 'Quantum Rose Hamiltonian State',
          rawContent: JSON.stringify({
            simTime: latestHam.simTime,
            normSum: latestHam.normSum,
            normDrift: latestHam.normDrift,
            expectationEnergy: latestHam.expectationEnergy,
            paletteHash: latestHam.activePalette.paletteHash,
          }),
          provenance: 'DETERMINISTICALLY_DERIVED',
          epistemicStatus: 'VERIFIED',
        });
      }

      if (includeMathDigest) {
        sources.push({
          sourceId: `clock_${Date.now().toString(36)}`,
          kind: 'MATHEMATICAL_OUTPUT',
          title: 'Circular Slice Hamiltonian Norm Check',
          rawContent: JSON.stringify({
            normConserved: latestHam.normConserved,
            eigenstates: latestHam.eigenstates.length,
            gateA: latestHam.gateEvaluation.decision,
          }),
          provenance: 'DETERMINISTICALLY_DERIVED',
          epistemicStatus: 'VERIFIED',
        });
      }

      if (includeDreamJournal) {
        const latestDream = dreamLogs[0];
        sources.push({
          sourceId: latestDream ? latestDream.logId : `jrnl_${Date.now().toString(36)}`,
          kind: 'USER_JOURNAL',
          title: latestDream ? `Cognitive Journal ${latestDream.logId}` : 'Observer Journal Entry',
          rawContent: latestDream ? latestDream.dreamText : narrativeNote,
          provenance: 'PERSISTED_EVENTS',
          epistemicStatus: 'INTERPRETIVE',
        });
      }

      const res = await fetch('/api/v7/grimoire/compose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cryptic-role': 'ADMINISTRATOR',
        },
        body: JSON.stringify({
          title,
          narrativeNote,
          sources,
          userConsent,
          userApproved,
        }),
      });
      const data = await res.json();
      if (data.ok && data.composition) {
        setActiveComp(data.composition);
        setCompositions((prev) => [data.composition, ...prev]);
        setStatusNotice(
          data.composition.memoryEventId
            ? `Grimoire sealed across 8 stages & committed to Save_Memory (${data.composition.memoryEventId})`
            : `Grimoire composed (${data.composition.approvalStatus}; Gate A withheld persistence without consent)`
        );
      } else {
        setStatusNotice(`Composition failed: ${data.error}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportJson = (comp: GrimoireComposition) => {
    const blob = new Blob([JSON.stringify(comp, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${comp.compositionId}.grimoire.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPngCard = (comp: GrimoireComposition) => {
    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 540;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#04070D';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('GAIA.NEXUS.HCCGN.QUANTUM-ROSE.V7 // DREAMING GRIMOIRE PLATE', 44, 60);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(comp.title.slice(0, 56), 44, 102);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px monospace';
    ctx.fillText(`ID: ${comp.compositionId} | Epistemic: ${comp.epistemicClass}`, 44, 134);
    ctx.fillText(`SHA-256: ${comp.compositionSha256}`, 44, 158);
    ctx.fillText(`Gate A: ${comp.gateEvaluation.decision} | Approval: ${comp.approvalStatus}`, 44, 182);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '15px sans-serif';
    const words = comp.narrativeNote.split(' ');
    let line = '';
    let y = 228;
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (test.length > 84) {
        ctx.fillText(line, 44, y);
        y += 22;
        line = w;
        if (y > 460) break;
      } else {
        line = test;
      }
    }
    if (line && y <= 460) ctx.fillText(line, 44, y);

    ctx.fillStyle = '#34d399';
    ctx.font = '13px monospace';
    ctx.fillText(`Sources Retained Verbatim: ${comp.sources.length} | Pipeline Stages Verified: ${comp.stageTrace.length}/8`, 44, 496);

    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `${comp.compositionId}.png`;
    a.click();
  };

  return (
    <div className="w-full p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 font-mono text-xs text-slate-100">
      {/* Left: Non-Destructive Composition Builder */}
      <div className="lg:col-span-5 bg-[#080D16]/90 border border-slate-800 p-4 space-y-4">
        <div className="border-b border-slate-800 pb-2">
          <div className="text-[10px] uppercase tracking-wider text-purple-300">
            DISCOVER &rarr; CATALOG &rarr; PROVENANCE &rarr; NORMALIZE &rarr; VERIFY &rarr; COMPOSE &rarr; SNAPSHOT &rarr; LEDGER
          </div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2 mt-1">
            <BookOpen className="w-4 h-4 text-purple-400" />
            <span>Dreaming Grimoire Non-Destructive Composer</span>
          </h2>
        </div>

        <label className="block space-y-1">
          <span className="text-slate-400 text-[11px]">Composition Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 text-white focus:border-purple-400 focus:outline-none"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-slate-400 text-[11px]">
            Verbatim Journal / Narrative Note (Never Rewritten or Auto-Promoted to Fact)
          </span>
          <textarea
            rows={4}
            value={narrativeNote}
            onChange={(e) => setNarrativeNote(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 text-slate-100 focus:border-purple-400 focus:outline-none resize-none"
          />
        </label>

        <div className="space-y-2 border-t border-slate-800 pt-3">
          <span className="text-[11px] text-slate-300 font-semibold block">Attach Immutable Source Artifacts:</span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={includeQuantumRose} onChange={(e) => setIncludeQuantumRose(e.target.checked)} />
            <span>Quantum Rose Hamiltonian State (DETERMINISTICALLY_DERIVED)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={includeMathDigest} onChange={(e) => setIncludeMathDigest(e.target.checked)} />
            <span>Math / Unitary Norm Check (VERIFIED)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={includeDreamJournal} onChange={(e) => setIncludeDreamJournal(e.target.checked)} />
            <span>Cognitive Journal Entry (PERSISTED_EVENTS &bull; Kept INTERPRETIVE)</span>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-slate-800 pt-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={userConsent} onChange={(e) => setUserConsent(e.target.checked)} />
            <span>Explicit userConsent</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={userApproved} onChange={(e) => setUserApproved(e.target.checked)} />
            <span>User Approved</span>
          </label>
        </div>

        <button
          onClick={handleCompose}
          disabled={submitting}
          className="w-full py-2.5 bg-purple-600/25 border border-purple-400/60 hover:bg-purple-600/35 text-purple-100 font-bold flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          <span>{submitting ? 'Executing 8-Stage Pipeline...' : 'Run 8-Stage Pipeline & Save_Memory'}</span>
        </button>

        {statusNotice && (
          <div className="p-2.5 bg-slate-950 border border-cyan-500/40 text-cyan-200 text-[11px]">
            {statusNotice}
          </div>
        )}
      </div>

      {/* Right: 8-Stage Trace & Provenance Inspector */}
      <div className="lg:col-span-7 space-y-4">
        <div className="bg-[#080D16]/90 border border-slate-800 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span className="font-bold text-white">
                {activeComp ? activeComp.title : 'No Composition Loaded Yet'}
              </span>
            </div>
            {activeComp && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExportJson(activeComp)}
                  className="px-2.5 py-1 bg-slate-900 border border-slate-700 hover:border-cyan-400 text-cyan-300 flex items-center gap-1"
                >
                  <FileJson className="w-3.5 h-3.5" />
                  <span>JSON</span>
                </button>
                <button
                  onClick={() => handleExportPngCard(activeComp)}
                  className="px-2.5 py-1 bg-slate-900 border border-slate-700 hover:border-emerald-400 text-emerald-300 flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PNG Plate</span>
                </button>
              </div>
            )}
          </div>

          {!activeComp ? (
            <div className="p-6 text-center text-slate-400 bg-slate-950 border border-slate-800">
              Compose a plate on the left to inspect all 8 non-destructive Grimoire stages, source hashes, and Gate A ruling.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="p-2 bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block">Epistemic Class</span>
                  <span className="text-amber-300 font-semibold">{activeComp.epistemicClass}</span>
                </div>
                <div className="p-2 bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block">Approval Status</span>
                  <span className="text-emerald-300 font-semibold">{activeComp.approvalStatus}</span>
                </div>
                <div className="p-2 bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block">Gate A Decision</span>
                  <span className="text-cyan-300 font-semibold">{activeComp.gateEvaluation.decision}</span>
                </div>
                <div className="p-2 bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block">Save_Memory ID</span>
                  <span className="text-white truncate block">{activeComp.memoryEventId ?? 'NOT_COMMITTED'}</span>
                </div>
              </div>

              <div>
                <div className="text-[11px] font-bold text-slate-300 mb-1.5">8-Stage Pipeline Audit Trail</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {activeComp.stageTrace.map((st) => (
                    <div key={st.stage} className="p-2 bg-slate-950 border border-slate-800 text-[10px]">
                      <div className="flex items-center justify-between text-cyan-300 font-bold">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          {st.stage}
                        </span>
                        <span className="text-slate-500">{st.outputSha256.slice(0, 10)}</span>
                      </div>
                      <div className="text-slate-300 mt-0.5">{st.detail}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-bold text-slate-300 mb-1.5">
                  Retained Source Artifacts ({activeComp.sources.length})
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {activeComp.sources.map((src) => (
                    <div key={src.sourceId} className="p-2 bg-slate-950 border border-slate-800 text-[11px]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-white">{src.title}</span>
                        <span className="text-purple-300">
                          {src.provenance} &bull; {src.epistemicStatus}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">SHA-256: {src.sourceSha256}</div>
                      <div className="text-slate-300 mt-1 break-all">{src.rawContent}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* History */}
        <div className="bg-[#080D16]/90 border border-slate-800 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Persisted Grimoire Plates ({compositions.length})</span>
            </span>
            <span className="text-[10px] text-slate-500 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Read-Only Lineage
            </span>
          </div>
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {compositions.map((c) => (
              <button
                key={c.compositionId}
                onClick={() => setActiveComp(c)}
                className={`w-full text-left p-2 border transition-colors flex items-center justify-between ${
                  activeComp?.compositionId === c.compositionId
                    ? 'border-purple-400 bg-purple-500/10'
                    : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                }`}
              >
                <span className="font-semibold text-white truncate">{c.title}</span>
                <span className="text-[10px] text-cyan-300 shrink-0 ml-2">
                  {c.compositionId} &bull; {c.approvalStatus}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
