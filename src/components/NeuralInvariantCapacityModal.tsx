import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Cpu, Activity, Zap, ShieldCheck, Play, Pause, RotateCcw,
  Sliders, Layers, Binary, Database, Award, ArrowRight, CheckCircle2,
  AlertTriangle, Download, Sparkles, TrendingUp, HelpCircle
} from 'lucide-react';
import {
  globalNeuralInvariantCapacityEngine,
  TransformerCapacitySpec,
  TransformerCapacityResult,
  InvariantObservationStep,
  InvariantTrajectoryResult,
  InvariantStepResult,
} from '../engine/neuralInvariantCapacityEngine';
import { globalTraceEngine } from '../engine/cuboctahedralTraceEngine';
import { globalHarmonicEngine } from '../engine/harmonicResonanceEngine';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuditLog?: () => void;
}

type TabMode = 'CAPACITY_BUDGET' | 'INVARIANT_RECURRENCE';

export const NeuralInvariantCapacityModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onOpenAuditLog,
}) => {
  const [activeTab, setActiveTab] = useState<TabMode>('CAPACITY_BUDGET');

  // =========================================================================
  // STATE: FORMULATION 1 (Model Parameter Capacity Budget P_total)
  // =========================================================================
  const [P_enc, setP_enc] = useState<number>(25000000); // 25M
  const [vocabK, setVocabK] = useState<number>(32000); // 32K vocab
  const [numLayersL, setNumLayersL] = useState<number>(12); // 12 layers
  const [dimV, setDimV] = useState<number>(3072); // V_l = 3072
  const [rankR, setRankR] = useState<number>(64); // r_l = 64
  const [P_heads, setP_heads] = useState<number>(5000000); // 5M
  const [isPerLayerCustom, setIsPerLayerCustom] = useState<boolean>(false);
  const [customRanks, setCustomRanks] = useState<number[]>(() => Array(12).fill(64));

  // Compute P_total dynamically
  const capacityResult: TransformerCapacityResult = useMemo(() => {
    const layers = Array.from({ length: numLayersL }, (_, idx) => {
      const r = isPerLayerCustom && customRanks[idx] !== undefined ? customRanks[idx] : rankR;
      return {
        layerIndex: idx + 1,
        V: dimV,
        r,
      };
    });

    return globalNeuralInvariantCapacityEngine.calculateModelCapacity({
      P_enc,
      K: vocabK,
      layers,
      P_heads,
    });
  }, [P_enc, vocabK, numLayersL, dimV, rankR, P_heads, isPerLayerCustom, customRanks]);

  // =========================================================================
  // STATE: FORMULATION 2 (Invariant Information State Recurrence I_{t+1})
  // =========================================================================
  const [initialI, setInitialI] = useState<number>(100.0);
  const [alpha, setAlpha] = useState<number>(0.50);
  const [beta, setBeta] = useState<number>(0.25);
  const [manualConfidence, setManualConfidence] = useState<number>(0.92);
  const [manualValue, setManualValue] = useState<number>(10.0);
  const [manualError, setManualError] = useState<number>(1.5);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [linkToLedger, setLinkToLedger] = useState<boolean>(true);

  const [trajectory, setTrajectory] = useState<InvariantTrajectoryResult>(() => {
    const defaultObs = globalNeuralInvariantCapacityEngine.generateSyntheticObservations(16, 0.90, 10.0, 1.2);
    return globalNeuralInvariantCapacityEngine.simulateInvariantRecurrence(100.0, 0.50, 0.25, defaultObs);
  });

  const [activeStepIndex, setActiveStepIndex] = useState<number>(trajectory.steps.length - 1);
  const latestStep: InvariantStepResult | undefined = trajectory.steps[activeStepIndex] || trajectory.steps[trajectory.steps.length - 1];

  // Streaming auto-simulation for Invariant recurrence
  useEffect(() => {
    if (!isOpen || !isStreaming || activeTab !== 'INVARIANT_RECURRENCE') return;

    const interval = setInterval(() => {
      setTrajectory((prev) => {
        const lastStep = prev.steps[prev.steps.length - 1];
        const nextT = lastStep ? lastStep.t + 1 : 0;
        const currentI = lastStep ? lastStep.I_next : initialI;

        // Perturb observation
        const conf = Math.max(0.2, Math.min(1.0, manualConfidence + (Math.random() - 0.5) * 0.1));
        const val = Math.max(1.0, manualValue + (Math.random() - 0.5) * 2.0);
        const err = Math.max(0.01, manualError + (Math.random() - 0.5) * 0.8);

        const newObs: InvariantObservationStep = {
          t: nextT,
          confidence: conf,
          verificationValue: val,
          errorResidual: err,
          timestampMs: Date.now(),
        };

        const gainTerm = prev.alpha * conf * val;
        const lossTerm = prev.beta * err;
        const deltaI = gainTerm - lossTerm;
        const nextI = currentI + deltaI;

        const newStep: InvariantStepResult = {
          t: nextT,
          I_prev: +currentI.toFixed(4),
          gainTerm: +gainTerm.toFixed(4),
          lossTerm: +lossTerm.toFixed(4),
          deltaI: +deltaI.toFixed(4),
          I_next: +nextI.toFixed(4),
          C_Ot: +conf.toFixed(4),
          V_t: +val.toFixed(4),
          epsilon_t: +err.toFixed(4),
          isEquilibrium: Math.abs(deltaI) < 0.05,
          equilibriumEpsilon: prev.beta > 0 ? +((prev.alpha * conf * val) / prev.beta).toFixed(4) : 0,
        };

        const updatedSteps = [...prev.steps.slice(-29), newStep];
        setActiveStepIndex(updatedSteps.length - 1);

        if (linkToLedger && newStep.isEquilibrium) {
          globalTraceEngine.resolveCustomBlockchainBlock(
            99000 + nextT,
            `SIG_INVARIANT_EQUILIBRIUM_T${nextT}`,
            BigInt(Math.floor(nextI * 1000))
          );
        }

        return {
          ...prev,
          steps: updatedSteps,
          finalI: +nextI.toFixed(4),
          cumulativeGain: +(prev.cumulativeGain + gainTerm).toFixed(4),
          cumulativeLoss: +(prev.cumulativeLoss + lossTerm).toFixed(4),
          netDelta: +(nextI - prev.initialI).toFixed(4),
        };
      });
    }, 1800);

    return () => clearInterval(interval);
  }, [isOpen, isStreaming, activeTab, manualConfidence, manualValue, manualError, initialI, linkToLedger]);

  // Manual step forward
  const handleManualRecurrenceStep = () => {
    setTrajectory((prev) => {
      const lastStep = prev.steps[prev.steps.length - 1];
      const nextT = lastStep ? lastStep.t + 1 : 0;
      const currentI = lastStep ? lastStep.I_next : initialI;

      const gainTerm = prev.alpha * manualConfidence * manualValue;
      const lossTerm = prev.beta * manualError;
      const deltaI = gainTerm - lossTerm;
      const nextI = currentI + deltaI;

      const newStep: InvariantStepResult = {
        t: nextT,
        I_prev: +currentI.toFixed(4),
        gainTerm: +gainTerm.toFixed(4),
        lossTerm: +lossTerm.toFixed(4),
        deltaI: +deltaI.toFixed(4),
        I_next: +nextI.toFixed(4),
        C_Ot: +manualConfidence.toFixed(4),
        V_t: +manualValue.toFixed(4),
        epsilon_t: +manualError.toFixed(4),
        isEquilibrium: Math.abs(deltaI) < 0.05,
        equilibriumEpsilon: prev.beta > 0 ? +((prev.alpha * manualConfidence * manualValue) / prev.beta).toFixed(4) : 0,
      };

      globalHarmonicEngine.playCoaxialChime();

      const updatedSteps = [...prev.steps, newStep];
      setActiveStepIndex(updatedSteps.length - 1);

      return {
        ...prev,
        steps: updatedSteps,
        finalI: +nextI.toFixed(4),
        cumulativeGain: +(prev.cumulativeGain + gainTerm).toFixed(4),
        cumulativeLoss: +(prev.cumulativeLoss + lossTerm).toFixed(4),
        netDelta: +(nextI - prev.initialI).toFixed(4),
      };
    });
  };

  // Reset recurrence
  const handleResetRecurrence = () => {
    const obs = globalNeuralInvariantCapacityEngine.generateSyntheticObservations(16, manualConfidence, manualValue, manualError);
    const res = globalNeuralInvariantCapacityEngine.simulateInvariantRecurrence(initialI, alpha, beta, obs);
    setTrajectory(res);
    setActiveStepIndex(res.steps.length - 1);
  };

  // Solidify to Persistent Blockchain Ledger
  const handleSolidifyToLedger = () => {
    const finalVal = trajectory.finalI;
    const block = globalTraceEngine.resolveCustomBlockchainBlock(
      888800 + Math.floor(Math.random() * 1000),
      `SIG_INVARIANT_SOLIDIFY_${trajectory.receiptId}`,
      BigInt(Math.floor(finalVal * 100000))
    );
    globalHarmonicEngine.playSolveBurstSound();
    alert(`Solidified Invariant State Block #${block.index} onto persistent ledger with Hash: ${block.currentHash.slice(0, 24)}...`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-md font-mono select-none text-slate-100">
      <div className="w-full max-w-6xl max-h-[94vh] bg-[#02050b] border border-cyan-500/40 rounded-2xl shadow-2xl shadow-cyan-500/10 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Header */}
        <div className="p-4 bg-[#060b14] border-b border-cyan-950 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/40 text-cyan-400">
              <Cpu className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  NEURAL CAPACITY BUDGET &bull; INVARIANT INFORMATION STATE RECURRENCE
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
                  AE.AXS.MATHEMATICS
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Piecewise Transformer Parameter Budget &bull; Invariant State Recurrence Filter with Noise Damping
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode Switcher Tabs */}
            <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('CAPACITY_BUDGET')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'CAPACITY_BUDGET'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>P_total (Parameter Budget)</span>
              </button>

              <button
                onClick={() => setActiveTab('INVARIANT_RECURRENCE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'INVARIANT_RECURRENCE'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>I_{'{t+1}'} (Invariant Filter)</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mathematical Equation Display Banner */}
        <div className="bg-[#030816] px-4 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          {activeTab === 'CAPACITY_BUDGET' ? (
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-cyan-400 font-bold uppercase">GOVERNING LAW:</span>
              <code className="text-white bg-slate-950 px-3 py-1 rounded border border-cyan-500/30 font-serif text-sm">
                P_total = P_enc + 768K + &sum;[ r &lt; 768 ? (V_&ell; r_&ell; + 768 r_&ell;) : 768 V_&ell; ] + P_heads
              </code>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-emerald-400 font-bold uppercase">GOVERNING LAW:</span>
              <code className="text-white bg-slate-950 px-3 py-1 rounded border border-emerald-500/30 font-serif text-sm">
                I_{'{t+1}'} = I_t + &alpha; C(O_t) V_t - &beta; &epsilon;_t
              </code>
            </div>
          )}

          <div className="text-[11px] text-slate-400 flex items-center gap-3">
            <span>Verified Exact IEEE-754 / BigInt Representation</span>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* ================================================================= */}
          {/* TAB 1: TRANSFORMER CAPACITY BUDGET (P_total) */}
          {/* ================================================================= */}
          {activeTab === 'CAPACITY_BUDGET' && (
            <div className="space-y-4">
              
              {/* Top Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 bg-[#060b14] border border-cyan-500/30 rounded-xl space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Total Parameter Budget (P_total)</div>
                  <div className="text-xl font-bold text-white tracking-wide">
                    {capacityResult.P_total.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-cyan-400">
                    &approx; {(capacityResult.P_total / 1e6).toFixed(2)}M Parameters
                  </div>
                </div>

                <div className="p-3.5 bg-[#060b14] border border-slate-800 rounded-xl space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Embedding Weight (768 &times; K)</div>
                  <div className="text-xl font-bold text-slate-200">
                    {capacityResult.embeddingParams.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Vocab K = {vocabK.toLocaleString()} tokens
                  </div>
                </div>

                <div className="p-3.5 bg-[#060b14] border border-slate-800 rounded-xl space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Sum of Layer Projections</div>
                  <div className="text-xl font-bold text-slate-200">
                    {capacityResult.sumLayerParams.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    L = {numLayersL} layers &bull; V = {dimV}
                  </div>
                </div>

                <div className="p-3.5 bg-[#060b14] border border-emerald-500/30 rounded-xl space-y-1">
                  <div className="text-[10px] text-emerald-400 uppercase font-bold">Low-Rank Savings vs Full Rank</div>
                  <div className="text-xl font-bold text-emerald-300">
                    -{capacityResult.overallCompressionPct}%
                  </div>
                  <div className="text-[11px] text-emerald-400">
                    Saved {capacityResult.totalSavingsParams.toLocaleString()} params
                  </div>
                </div>
              </div>

              {/* Memory Footprints */}
              <div className="p-3 bg-[#060b14] border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="text-slate-400 font-bold uppercase text-[10px] flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-cyan-400" />
                  Estimated Memory Footprint:
                </span>
                <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
                  <span>FP32: <strong className="text-cyan-300">{capacityResult.memoryEstimateMb.fp32Mb} MB</strong></span>
                  <span>FP16 / BF16: <strong className="text-cyan-300">{capacityResult.memoryEstimateMb.fp16Mb} MB</strong></span>
                  <span>INT8: <strong className="text-emerald-300">{capacityResult.memoryEstimateMb.int8Mb} MB</strong></span>
                  <span>INT4: <strong className="text-purple-300">{capacityResult.memoryEstimateMb.int4Mb} MB</strong></span>
                </div>
              </div>

              {/* Interactive Parameter Sliders & Formula Controls */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                
                {/* Left (7 cols): Global Model Parameters */}
                <div className="lg:col-span-7 bg-[#060b14] border border-slate-800 p-4 rounded-xl space-y-3.5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-cyan-400" />
                      Model Parameter Configuration
                    </h3>
                    <span className="text-[10px] text-slate-400">d_model = 768 fixed hidden dim</span>
                  </div>

                  {/* 1. Encoder Backbone P_enc */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">Encoder / Backbone Parameters (P_enc):</span>
                      <span className="text-cyan-300 font-bold">{(P_enc / 1e6).toFixed(2)}M ({P_enc.toLocaleString()})</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100000000}
                      step={1000000}
                      value={P_enc}
                      onChange={(e) => setP_enc(Number(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>

                  {/* 2. Vocabulary Size K */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">Vocabulary Size K (768 &times; K Embedding):</span>
                      <span className="text-cyan-300 font-bold">K = {vocabK.toLocaleString()} ({(768 * vocabK / 1e6).toFixed(2)}M)</span>
                    </div>
                    <div className="flex gap-2 mb-1.5">
                      {[32000, 50257, 65536, 128000].map((kVal) => (
                        <button
                          key={kVal}
                          onClick={() => setVocabK(kVal)}
                          className={`px-2 py-0.5 rounded text-[10px] border ${
                            vocabK === kVal
                              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          {kVal >= 1000 ? `${kVal / 1000}K` : kVal}
                        </button>
                      ))}
                    </div>
                    <input
                      type="range"
                      min={1000}
                      max={150000}
                      step={1000}
                      value={vocabK}
                      onChange={(e) => setVocabK(Number(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>

                  {/* 3. Number of Layers L */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">Number of Layers L:</span>
                      <span className="text-cyan-300 font-bold">L = {numLayersL} layers</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={48}
                      step={1}
                      value={numLayersL}
                      onChange={(e) => {
                        const newL = Number(e.target.value);
                        setNumLayersL(newL);
                        setCustomRanks(Array(newL).fill(rankR));
                      }}
                      className="w-full accent-cyan-400"
                    />
                  </div>

                  {/* 4. Value / Projection Dimension V */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">Value / Projection Dimension V_&ell;:</span>
                      <span className="text-cyan-300 font-bold">V = {dimV} (e.g. 4 &times; 768 = 3072)</span>
                    </div>
                    <input
                      type="range"
                      min={768}
                      max={8192}
                      step={256}
                      value={dimV}
                      onChange={(e) => setDimV(Number(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>

                  {/* 5. Rank r (with piecewise branch switch) */}
                  <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-200 font-bold">Bottleneck Rank r_&ell; [Piecewise Trigger]:</span>
                      <span className={`font-bold font-mono px-2 py-0.5 rounded border text-xs ${
                        rankR < 768
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                      }`}>
                        r = {rankR} {rankR < 768 ? '(Low-Rank Factorized)' : '(Full-Rank Direct 768)'}
                      </span>
                    </div>

                    <input
                      type="range"
                      min={1}
                      max={768}
                      step={1}
                      value={rankR}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setRankR(val);
                        setCustomRanks(Array(numLayersL).fill(val));
                      }}
                      className="w-full accent-emerald-400"
                    />

                    {/* Branch explanation */}
                    <div className="text-[10px] leading-relaxed">
                      {rankR < 768 ? (
                        <div className="text-emerald-300 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            <strong>Branch r &lt; 768:</strong> Factorized projection V&middot;r + 768&middot;r = ({dimV} &times; {rankR}) + (768 &times; {rankR}) = {(dimV * rankR + 768 * rankR).toLocaleString()} params/layer.
                          </span>
                        </div>
                      ) : (
                        <div className="text-purple-300 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            <strong>Branch r = 768:</strong> Full uncompressed direct projection 768&middot;V = 768 &times; {dimV} = {(768 * dimV).toLocaleString()} params/layer.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 6. Heads Parameters P_heads */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">Prediction &amp; Task Heads (P_heads):</span>
                      <span className="text-cyan-300 font-bold">{(P_heads / 1e6).toFixed(2)}M ({P_heads.toLocaleString()})</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={50000000}
                      step={500000}
                      value={P_heads}
                      onChange={(e) => setP_heads(Number(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>
                </div>

                {/* Right (5 cols): Layer-by-Layer Breakdown & Compression Gauge */}
                <div className="lg:col-span-5 bg-[#060b14] border border-slate-800 p-4 rounded-xl flex flex-col space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-400" />
                      Layer Breakdown ({capacityResult.layerDetails.length} Layers)
                    </h3>
                  </div>

                  <div className="flex-1 overflow-y-auto max-h-[280px] space-y-1.5 pr-1">
                    {capacityResult.layerDetails.map((ld) => (
                      <div
                        key={ld.layerIndex}
                        className={`p-2 rounded-lg border text-[11px] flex items-center justify-between gap-2 ${
                          ld.isLowRank
                            ? 'bg-slate-950/70 border-emerald-500/30'
                            : 'bg-purple-950/20 border-purple-500/30'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-slate-200">
                            Layer #{ld.layerIndex}: r={ld.r} {ld.isLowRank ? '< 768' : '= 768'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {ld.isLowRank
                              ? `${ld.downProjParams.toLocaleString()} (V&times;r) + ${ld.upProjParams.toLocaleString()} (768&times;r)`
                              : `768 &times; ${ld.V} (Full Direct)`}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-bold font-mono text-cyan-300">
                            {ld.layerParams.toLocaleString()}
                          </div>
                          {ld.savingsParams > 0 && (
                            <div className="text-[9px] text-emerald-400 font-bold">
                              -{ld.savingsPct}%
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Summary Footer */}
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-[10px] text-slate-300 space-y-1">
                    <div className="flex justify-between">
                      <span>Uncompressed Full Rank:</span>
                      <span className="font-bold font-mono text-slate-400">{capacityResult.totalUncompressedParams.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Factorized Model (P_total):</span>
                      <span className="font-bold font-mono text-cyan-300">{capacityResult.P_total.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-emerald-400 font-bold pt-1 border-t border-slate-900">
                      <span>Net Parameter Reduction:</span>
                      <span>-{capacityResult.totalSavingsParams.toLocaleString()} (-{capacityResult.overallCompressionPct}%)</span>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 2: INVARIANT INFORMATION RECURRENCE (I_{t+1}) */}
          {/* ================================================================= */}
          {activeTab === 'INVARIANT_RECURRENCE' && (
            <div className="space-y-4">
              
              {/* Top Metrics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 bg-[#060b14] border border-emerald-500/30 rounded-xl space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Current Invariant Potential (I_t)</div>
                  <div className="text-xl font-bold text-emerald-300 tracking-wide font-mono">
                    {trajectory.finalI.toFixed(3)}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Initial I_0 = {trajectory.initialI.toFixed(2)} &bull; &Delta;I = {trajectory.netDelta > 0 ? `+${trajectory.netDelta.toFixed(2)}` : trajectory.netDelta.toFixed(2)}
                  </div>
                </div>

                <div className="p-3.5 bg-[#060b14] border border-slate-800 rounded-xl space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Accumulation Gain Term (&alpha;&middot;C&middot;V)</div>
                  <div className="text-xl font-bold text-cyan-300 font-mono">
                    +{latestStep ? latestStep.gainTerm.toFixed(3) : '0.000'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    &alpha;={trajectory.alpha} &bull; C(O_t)={latestStep?.C_Ot ?? 0} &bull; V_t={latestStep?.V_t ?? 0}
                  </div>
                </div>

                <div className="p-3.5 bg-[#060b14] border border-slate-800 rounded-xl space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Damping Error Loss Term (&beta;&middot;&epsilon;)</div>
                  <div className="text-xl font-bold text-rose-400 font-mono">
                    -{latestStep ? latestStep.lossTerm.toFixed(3) : '0.000'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    &beta;={trajectory.beta} &bull; &epsilon;_t={latestStep?.epsilon_t ?? 0}
                  </div>
                </div>

                <div className="p-3.5 bg-[#060b14] border border-slate-800 rounded-xl space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Equilibrium Tolerance (&epsilon;*)</div>
                  <div className="text-xl font-bold text-amber-300 font-mono">
                    &epsilon;* = {latestStep ? latestStep.equilibriumEpsilon.toFixed(2) : '0.00'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Steady State: {trajectory.steadyStateAchieved ? 'CONVERGED' : 'DRIFTING'}
                  </div>
                </div>
              </div>

              {/* Invariant Trajectory Visualization Canvas/SVG */}
              <div className="p-4 bg-[#010308] border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    Invariant State Trajectory (I_t across Time Steps)
                  </span>
                  <div className="flex items-center gap-3 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-1 bg-cyan-400 inline-block rounded" /> Invariant I_t</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-1 bg-emerald-400 inline-block rounded" /> Gain (&alpha;&middot;C&middot;V)</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-1 bg-rose-400 inline-block rounded" /> Loss (&beta;&middot;&epsilon;)</span>
                  </div>
                </div>

                {/* SVG Curve Plot */}
                <div className="w-full h-44 relative bg-[#030610] rounded-lg border border-slate-900 overflow-hidden">
                  <svg className="w-full h-full p-2" viewBox="0 0 700 160" preserveAspectRatio="none">
                    {/* Grid lines */}
                    <line x1="0" y1="40" x2="700" y2="40" stroke="#0e1726" strokeWidth="1" />
                    <line x1="0" y1="80" x2="700" y2="80" stroke="#0e1726" strokeWidth="1" />
                    <line x1="0" y1="120" x2="700" y2="120" stroke="#0e1726" strokeWidth="1" />

                    {/* Gain bar sticks */}
                    {trajectory.steps.map((st, i) => {
                      const totalSteps = Math.max(1, trajectory.steps.length);
                      const x = (i / (totalSteps - 1 || 1)) * 680 + 10;
                      const gainHeight = Math.min(60, st.gainTerm * 6);
                      const lossHeight = Math.min(60, st.lossTerm * 6);
                      return (
                        <g key={i}>
                          <line x1={x} y1="80" x2={x} y2={80 - gainHeight} stroke="#10b981" strokeWidth="2" strokeOpacity="0.4" />
                          <line x1={x} y1="80" x2={x} y2={80 + lossHeight} stroke="#f43f5e" strokeWidth="2" strokeOpacity="0.4" />
                        </g>
                      );
                    })}

                    {/* Polyline for I_t trajectory */}
                    {trajectory.steps.length > 1 && (
                      <polyline
                        fill="none"
                        stroke="#00f0ff"
                        strokeWidth="2.5"
                        points={(() => {
                          const minI = Math.min(...trajectory.steps.map((s) => s.I_next), trajectory.initialI);
                          const maxI = Math.max(...trajectory.steps.map((s) => s.I_next), trajectory.initialI) + 0.001;
                          const range = maxI - minI || 1;
                          return trajectory.steps
                            .map((st, i) => {
                              const x = (i / (trajectory.steps.length - 1)) * 680 + 10;
                              const y = 140 - ((st.I_next - minI) / range) * 120;
                              return `${x},${y}`;
                            })
                            .join(' ');
                        })()}
                      />
                    )}
                  </svg>
                </div>
              </div>

              {/* Interactive Controls & Parameter Adjustments */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                
                {/* Left (7 cols): Recurrence Controls */}
                <div className="lg:col-span-7 bg-[#060b14] border border-slate-800 p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-emerald-400" />
                      Observation Parameters &bull; [C(O_t), V_t, &epsilon;_t]
                    </h3>
                  </div>

                  {/* 1. Alpha Accumulation Rate */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">Gain Factor (&alpha;):</span>
                      <span className="text-cyan-300 font-bold">&alpha; = {alpha.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min={0.01}
                      max={2.0}
                      step={0.01}
                      value={alpha}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setAlpha(val);
                        setTrajectory((prev) => ({ ...prev, alpha: val }));
                      }}
                      className="w-full accent-cyan-400"
                    />
                  </div>

                  {/* 2. Beta Damping Error Rate */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">Damping / Error Penalty Rate (&beta;):</span>
                      <span className="text-rose-400 font-bold">&beta; = {beta.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min={0.01}
                      max={1.5}
                      step={0.01}
                      value={beta}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setBeta(val);
                        setTrajectory((prev) => ({ ...prev, beta: val }));
                      }}
                      className="w-full accent-rose-400"
                    />
                  </div>

                  {/* 3. Confidence C(O_t) */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">Observation Confidence C(O_t) &isin; [0, 1]:</span>
                      <span className="text-emerald-300 font-bold">C(O_t) = {manualConfidence.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min={0.0}
                      max={1.0}
                      step={0.02}
                      value={manualConfidence}
                      onChange={(e) => setManualConfidence(Number(e.target.value))}
                      className="w-full accent-emerald-400"
                    />
                  </div>

                  {/* 4. Verification Magnitude V_t */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">Verification Magnitude (V_t):</span>
                      <span className="text-cyan-300 font-bold">V_t = {manualValue.toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={30.0}
                      step={0.5}
                      value={manualValue}
                      onChange={(e) => setManualValue(Number(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>

                  {/* 5. Error Residual epsilon_t */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">Error Residual / Noise (&epsilon;_t):</span>
                      <span className="text-rose-400 font-bold">&epsilon;_t = {manualError.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min={0.0}
                      max={10.0}
                      step={0.1}
                      value={manualError}
                      onChange={(e) => setManualError(Number(e.target.value))}
                      className="w-full accent-rose-400"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 border-t border-slate-800 flex flex-wrap gap-2">
                    <button
                      onClick={handleManualRecurrenceStep}
                      className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>Step Recurrence (t &rarr; t+1)</span>
                    </button>

                    <button
                      onClick={() => setIsStreaming(!isStreaming)}
                      className={`px-3.5 py-2 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all ${
                        isStreaming
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                          : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                      }`}
                    >
                      {isStreaming ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      <span>{isStreaming ? 'Pause Stream' : 'Live Stream Ingestion'}</span>
                    </button>

                    <button
                      onClick={handleResetRecurrence}
                      className="p-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 text-xs"
                      title="Reset Recurrence History"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Right (5 cols): Step History & Ledger Solidification */}
                <div className="lg:col-span-5 bg-[#060b14] border border-slate-800 p-4 rounded-xl flex flex-col space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Binary className="w-4 h-4 text-cyan-400" />
                      Recurrence Step Log ({trajectory.steps.length} Steps)
                    </h3>
                  </div>

                  <div className="flex-1 overflow-y-auto max-h-[260px] space-y-1.5 pr-1 font-mono text-[10px]">
                    {trajectory.steps.slice(-15).reverse().map((step) => (
                      <div
                        key={step.t}
                        className={`p-2 rounded border flex items-center justify-between gap-2 ${
                          step.deltaI >= 0
                            ? 'bg-slate-950 border-emerald-500/30 text-emerald-200'
                            : 'bg-slate-950 border-rose-500/30 text-rose-200'
                        }`}
                      >
                        <div>
                          <div className="font-bold">
                            t={step.t}: I_next = {step.I_next}
                          </div>
                          <div className="text-[9px] text-slate-400">
                            Gain: +{step.gainTerm} | Loss: -{step.lossTerm}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`font-bold ${step.deltaI >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {step.deltaI >= 0 ? `+${step.deltaI}` : step.deltaI}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Solidify to Persistent Block Ledger Button */}
                  <button
                    onClick={handleSolidifyToLedger}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all"
                  >
                    <Award className="w-4 h-4" />
                    <span>Solidify Invariant to Block Ledger</span>
                  </button>
                </div>

              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3 bg-[#060b14] border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-cyan-400 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              Active Mathematics Kernel: AE.AXS.CAPACITY.V1
            </span>
            <span>&bull;</span>
            <span>Canonical Invariant Verified: &Delta;I = &alpha;C(O)V - &beta;&epsilon;</span>
          </div>
          <div>
            <span>Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200">ESC</kbd> to exit</span>
          </div>
        </div>

      </div>
    </div>
  );
};
