import React, { useState, useEffect } from 'react';
import { QuantumCapsule, PipelineStep } from './QuantumCapsule';
import { QuantumRoseWorkspace } from './QuantumRoseWorkspace';
import { 
  Sparkles, 
  Layers, 
  Cpu, 
  Trash2, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRightLeft, 
  Clock, 
  Radio, 
  Sliders
} from 'lucide-react';

interface Props {
  onSwitchToArbitrage: () => void;
  onSwitchToSubsea: () => void;
}

export const QuantumWorkspace: React.FC<Props> = ({
  onSwitchToArbitrage,
  onSwitchToSubsea,
}) => {
  const [pipelineQueue, setPipelineQueue] = useState<PipelineStep[]>([
    {
      id: 'step_init_01',
      stepOrderPlan: 'STEP_01_INITIAL_INGEST_PIPELINE',
      hue: 45,
      percentile: 0.125,
      positionInline: 12,
      hardwareLayer: 'CHER_CURVATURE_MATHEMATICA_LAYERED',
      timestamp: Date.now() - 30000,
    },
    {
      id: 'step_init_02',
      stepOrderPlan: 'STEP_02_RESONANCE_BALANCING',
      hue: 180,
      percentile: 0.50,
      positionInline: 50,
      hardwareLayer: 'CHER_CURVATURE_MATHEMATICA_LAYERED',
      timestamp: Date.now() - 15000,
    },
    {
      id: 'step_init_03',
      stepOrderPlan: 'STEP_03_EQUILIBRIUM_LOCK_COMMIT',
      hue: 290,
      percentile: 0.805,
      positionInline: 80,
      hardwareLayer: 'CHER_CURVATURE_MATHEMATICA_LAYERED',
      timestamp: Date.now() - 5000,
    },
  ]);

  const [viewMode, setViewMode] = useState<'ROSE' | 'CAPSULE'>('ROSE');
  const [reboundCount, setReboundCount] = useState<number>(0);
  const [cacheMemoryItems, setCacheMemoryItems] = useState<number>(8);
  const [lastEvent, setLastEvent] = useState<string>('System initialized');

  // Trigger deterministic packet rebound into pipeline
  const handleTriggerRebound = () => {
    const nextIdx = reboundCount + 1;
    setReboundCount(nextIdx);
    const newStep: PipelineStep = {
      id: `rebound_${Date.now()}`,
      stepOrderPlan: `REBOUNDED_DROP_RECOVERY_NODE_${nextIdx}`,
      hue: 30,
      percentile: 0.083,
      positionInline: (nextIdx * 7) % 25,
      hardwareLayer: 'NETWORK_IP_TUNNEL_0_0_0_0',
      timestamp: Date.now(),
    };

    setPipelineQueue((prev) => {
      const next = [...prev, newStep];
      next.sort((a, b) => a.positionInline - b.positionInline);
      return next;
    });

    setLastEvent(`Rebound injected: ${newStep.stepOrderPlan}`);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#010306] text-[#b8daf7] font-mono select-none">
      {/* Top Banner Tag */}
      <header className="h-[48px] bg-[#060a10] border-b border-[#101d2a] px-4 flex items-center justify-between text-xs tracking-wider z-30 shrink-0">
        <div className="flex items-center gap-2 text-white font-bold">
          <span className="text-[#00f0ff]">&Theta;_(L,h) = -&part;&part;&#772; log h</span>
          <span className="text-gray-400">&bull;</span>
          <span>QUANTUM DATA CAPSULE WORKSPACE</span>
          <span className="text-[10px] bg-[#07121d] border border-[#00f0ff]/30 text-[#00f0ff] px-2 py-0.5 rounded font-normal">
            TUNING FORK LINKED
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center border border-[#101d2a] bg-[#020407]">
            <button
              onClick={() => setViewMode('ROSE')}
              className={`px-3 py-1 text-[11px] font-semibold ${
                viewMode === 'ROSE' ? 'bg-cyan-500/20 text-cyan-200 border-r border-[#101d2a]' : 'text-gray-400 hover:text-white border-r border-[#101d2a]'
              }`}
            >
              Quantum Rose (&Psi;)
            </button>
            <button
              onClick={() => setViewMode('CAPSULE')}
              className={`px-3 py-1 text-[11px] font-semibold ${
                viewMode === 'CAPSULE' ? 'bg-cyan-500/20 text-cyan-200' : 'text-gray-400 hover:text-white'
              }`}
            >
              Tuning Fork Capsule
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-[#39ff14] text-xs">
            <Radio className="w-3.5 h-3.5 text-[#39ff14]" />
            <span className="hidden sm:inline">PIPELINE SYNCHRONIZED</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onSwitchToArbitrage}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#07121d] hover:bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/40 text-xs transition-colors"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Arbitrage</span>
            </button>
            <button
              onClick={onSwitchToSubsea}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#07121d] hover:bg-[#ffb700]/20 text-[#ffb700] border border-[#ffb700]/40 text-xs transition-colors"
            >
              <span>Subsea GIS</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Split Body */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 bg-[#101d2a] gap-[1px]">
        {/* Left: Quantum Rose v7 Workspace or Quantum Data Capsule WebGL Canvas (7 cols) */}
        <div className="lg:col-span-7 relative bg-[#04070D]/90 flex flex-col min-h-[460px] lg:min-h-0 overflow-hidden">
          {viewMode === 'ROSE' ? (
            <QuantumRoseWorkspace />
          ) : (
            <QuantumCapsule
              onPipelineUpdate={(queue) => setPipelineQueue(queue)}
              onDeltaEmitted={(delta) =>
                setLastEvent(`Delta: ${delta.stepOrderPlan} (Hue: ${delta.assignedHue}°)`)
              }
            />
          )}
        </div>

        {/* Right: Inline Workflow Pipeline Register & Net-GC Daemon (5 cols) */}
        <div className="lg:col-span-5 bg-[#060a10] border-l border-[#101d2a] flex flex-col min-h-[360px] lg:min-h-0 overflow-hidden">
          {/* Header */}
          <div className="p-3 bg-[#0a111a] border-b border-[#101d2a] flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-xs font-bold text-[#ffb700] tracking-wider flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-[#ffb700]" />
                INLINE WORKFLOW PIPELINE REGISTER
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Tuning-Fork Convergence &bull; Auto-Formated by Hue Percentile Priority
              </p>
            </div>
            <span className="text-[10px] font-mono text-[#39ff14] px-2 py-0.5 rounded bg-[#020407] border border-[#39ff14]/30">
              {pipelineQueue.length} Active Steps
            </span>
          </div>

          {/* Scrolling Steps List */}
          <div className="flex-1 p-3 overflow-y-auto space-y-2 font-mono text-xs scrollbar-thin scrollbar-thumb-[#101d2a]">
            {pipelineQueue.map((step, idx) => {
              const isRebound = step.stepOrderPlan.includes('REBOUND');

              return (
                <div
                  key={step.id}
                  className={`p-2.5 rounded border transition-all ${
                    isRebound
                      ? 'bg-[#1a080c] border-[#ff0055]/50'
                      : 'bg-[#020407] border-[#101d2a] hover:border-[#00f0ff]/40'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-bold text-[#00f0ff]">
                      [Slot {String(idx + 1).padStart(2, '0')}/{pipelineQueue.length}]
                    </span>
                    <span className="text-[#ffb700] font-mono text-[10px]">
                      Position Priority: {String(step.positionInline).padStart(3, '0')}
                    </span>
                  </div>

                  <div className="text-[11px] font-bold text-white flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                      style={{ backgroundColor: `hsl(${step.hue}, 90%, 55%)` }}
                    />
                    <span className="truncate">{step.stepOrderPlan}</span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1.5 pt-1 border-t border-[#101d2a]">
                    <span>Hue: {step.hue}° ({(step.percentile * 100).toFixed(1)}%)</span>
                    <span className="text-gray-500 truncate max-w-[150px]">
                      {step.hardwareLayer}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Net-GC Runtime Daemon Panel */}
          <div className="p-3 bg-[#020407] border-t border-[#101d2a] text-[11px] shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#ffb700] font-bold flex items-center gap-1.5 text-xs">
                <Cpu className="w-3.5 h-3.5 text-[#00f0ff]" />
                NET-GC RUNTIME LIFE CYCLE DAEMON
              </span>
              <span className="text-[#39ff14] text-[10px] font-bold">DAEMON ACTIVE</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-400 mb-2.5">
              <div>
                <span>Internal RAM Cache:</span>
                <span className="text-white font-bold ml-1">{cacheMemoryItems} entries</span>
              </div>
              <div>
                <span>Drop Rebound Counter:</span>
                <span className="text-[#ff0055] font-bold ml-1">{reboundCount} frames</span>
              </div>
            </div>

            <div className="text-[10px] text-gray-500 mb-2.5 truncate">
              Last Telemetry: <span className="text-gray-300">{lastEvent}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleTriggerRebound}
                className="w-full py-1.5 px-3 rounded bg-[#07121d] hover:bg-[#ff0055]/20 text-[#ff0055] border border-[#ff0055]/40 text-xs font-bold transition-all shadow-[0_0_8px_rgba(255,0,85,0.2)] flex items-center justify-center gap-1.5"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Inject Drop Rebound Frame</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
