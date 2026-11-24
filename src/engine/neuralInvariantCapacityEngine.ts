/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * =============================================================================
 * SPECIFICATION: GAIA / NEXUS — Neural Invariant & Capacity Engine
 * MODULE: Exact Transformer Parameter Budget & Invariant State Recurrence Filter
 *
 * FORMULATION 1 (Model Parameter Capacity Budget):
 *   P_total = P_enc + 768*K + \sum_{\ell=1}^L [ V_\ell*r_\ell + 768*r_\ell (if r_\ell < 768), 768*V_\ell (if r_\ell = 768) ] + P_heads
 *
 * FORMULATION 2 (Invariant Information State Recurrence):
 *   I_{t+1} = I_t + \alpha * C(O_t) * V_t - \beta * \epsilon_t
 * =============================================================================
 */

export interface LayerRankSpec {
  layerIndex: number;
  V: number; // Value / intermediate representation dimension
  r: number; // Bottleneck rank or adapter rank (1 <= r <= 768)
}

export interface TransformerCapacitySpec {
  P_enc: number; // Encoder backbone parameters
  K: number; // Vocabulary / token dictionary size
  layers: LayerRankSpec[]; // L layers
  P_heads: number; // Head projection parameters
}

export interface LayerCalculationDetail {
  layerIndex: number;
  V: number;
  r: number;
  isLowRank: boolean; // r < 768
  downProjParams: number; // V * r if r < 768, else 0
  upProjParams: number; // 768 * r if r < 768, else 0
  layerParams: number; // (V + 768)*r if r < 768, else 768*V
  uncompressedParams: number; // 768 * V
  savingsParams: number;
  savingsPct: number;
}

export interface TransformerCapacityResult {
  P_total: number;
  P_enc: number;
  embeddingParams: number; // 768 * K
  sumLayerParams: number;
  P_heads: number;
  L: number;
  layerDetails: LayerCalculationDetail[];
  totalUncompressedParams: number;
  totalSavingsParams: number;
  overallCompressionPct: number;
  memoryEstimateMb: {
    fp32Mb: number;
    fp16Mb: number;
    int8Mb: number;
    int4Mb: number;
  };
  formulaString: string;
  calculatedAtUtc: string;
}

export interface InvariantObservationStep {
  t: number;
  confidence: number; // C(O_t) in [0, 1]
  verificationValue: number; // V_t >= 0
  errorResidual: number; // epsilon_t >= 0
  timestampMs?: number;
}

export interface InvariantStepResult {
  t: number;
  I_prev: number; // I_t
  gainTerm: number; // alpha * C(O_t) * V_t
  lossTerm: number; // beta * epsilon_t
  deltaI: number; // gainTerm - lossTerm
  I_next: number; // I_{t+1}
  C_Ot: number;
  V_t: number;
  epsilon_t: number;
  isEquilibrium: boolean;
  equilibriumEpsilon: number; // (alpha * C * V) / beta
}

export interface InvariantTrajectoryResult {
  alpha: number;
  beta: number;
  initialI: number;
  steps: InvariantStepResult[];
  finalI: number;
  cumulativeGain: number;
  cumulativeLoss: number;
  netDelta: number;
  steadyStateAchieved: boolean;
  receiptId: string;
  calculatedAtUtc: string;
}

export class NeuralInvariantCapacityEngine {
  private static instance: NeuralInvariantCapacityEngine;

  public static getInstance(): NeuralInvariantCapacityEngine {
    if (!NeuralInvariantCapacityEngine.instance) {
      NeuralInvariantCapacityEngine.instance = new NeuralInvariantCapacityEngine();
    }
    return NeuralInvariantCapacityEngine.instance;
  }

  /**
   * Computes P_total according to exact mathematical specification:
   *
   *   P_total = P_enc + 768*K + \sum_{\ell=1}^L [ V_\ell*r_\ell + 768*r_\ell (if r_\ell < 768), 768*V_\ell (if r_\ell = 768) ] + P_heads
   */
  public calculateModelCapacity(spec: TransformerCapacitySpec): TransformerCapacityResult {
    const P_enc = Math.max(0, Math.round(spec.P_enc));
    const K = Math.max(1, Math.round(spec.K));
    const P_heads = Math.max(0, Math.round(spec.P_heads));
    const embeddingParams = 768 * K;

    let sumLayerParams = 0;
    let sumUncompressed = 0;

    const layerDetails: LayerCalculationDetail[] = spec.layers.map((layer, idx) => {
      const layerIndex = layer.layerIndex ?? idx + 1;
      const V = Math.max(1, Math.round(layer.V));
      // Clamp rank r between 1 and 768
      const r = Math.min(768, Math.max(1, Math.round(layer.r)));

      const uncompressed = 768 * V;
      sumUncompressed += uncompressed;

      if (r < 768) {
        // Low-rank factorization branch: V_\ell * r_\ell + 768 * r_\ell
        const downProj = V * r;
        const upProj = 768 * r;
        const layerParams = downProj + upProj;
        sumLayerParams += layerParams;
        const savings = Math.max(0, uncompressed - layerParams);
        const savingsPct = uncompressed > 0 ? (savings / uncompressed) * 100 : 0;

        return {
          layerIndex,
          V,
          r,
          isLowRank: true,
          downProjParams: downProj,
          upProjParams: upProj,
          layerParams,
          uncompressedParams: uncompressed,
          savingsParams: savings,
          savingsPct: +savingsPct.toFixed(2),
        };
      } else {
        // Full rank direct projection branch: 768 * V_\ell
        const layerParams = 768 * V;
        sumLayerParams += layerParams;

        return {
          layerIndex,
          V,
          r: 768,
          isLowRank: false,
          downProjParams: 0,
          upProjParams: 0,
          layerParams,
          uncompressedParams: uncompressed,
          savingsParams: 0,
          savingsPct: 0.0,
        };
      }
    });

    const P_total = P_enc + embeddingParams + sumLayerParams + P_heads;
    const totalUncompressed = P_enc + embeddingParams + sumUncompressed + P_heads;
    const totalSavings = Math.max(0, totalUncompressed - P_total);
    const overallCompressionPct = totalUncompressed > 0 ? (totalSavings / totalUncompressed) * 100 : 0;

    // Memory footprints (bytes = params * bytesPerParam)
    const bytesFp32 = P_total * 4;
    const bytesFp16 = P_total * 2;
    const bytesInt8 = P_total * 1;
    const bytesInt4 = P_total * 0.5;

    return {
      P_total,
      P_enc,
      embeddingParams,
      sumLayerParams,
      P_heads,
      L: spec.layers.length,
      layerDetails,
      totalUncompressedParams: totalUncompressed,
      totalSavingsParams: totalSavings,
      overallCompressionPct: +overallCompressionPct.toFixed(2),
      memoryEstimateMb: {
        fp32Mb: +(bytesFp32 / (1024 * 1024)).toFixed(2),
        fp16Mb: +(bytesFp16 / (1024 * 1024)).toFixed(2),
        int8Mb: +(bytesInt8 / (1024 * 1024)).toFixed(2),
        int4Mb: +(bytesInt4 / (1024 * 1024)).toFixed(2),
      },
      formulaString: `P_total = ${P_enc.toLocaleString()} + 768×${K.toLocaleString()} + ${sumLayerParams.toLocaleString()} + ${P_heads.toLocaleString()} = ${P_total.toLocaleString()} params`,
      calculatedAtUtc: new Date().toISOString(),
    };
  }

  /**
   * Helper to generate uniform standard Transformer baseline configuration
   * (e.g. 12 layers, V=3072, default rank r).
   */
  public generateDefaultTransformerSpec(
    numLayers: number = 12,
    V_per_layer: number = 3072,
    r_per_layer: number = 64,
    vocabSizeK: number = 32000,
    P_enc: number = 25000000,
    P_heads: number = 5000000
  ): TransformerCapacitySpec {
    const layers: LayerRankSpec[] = Array.from({ length: numLayers }, (_, idx) => ({
      layerIndex: idx + 1,
      V: V_per_layer,
      r: r_per_layer,
    }));

    return {
      P_enc,
      K: vocabSizeK,
      layers,
      P_heads,
    };
  }

  /**
   * Simulates Invariant Information State Recurrence:
   *
   *   I_{t+1} = I_t + \alpha * C(O_t) * V_t - \beta * \epsilon_t
   */
  public simulateInvariantRecurrence(
    initialI: number,
    alpha: number,
    beta: number,
    observations: InvariantObservationStep[]
  ): InvariantTrajectoryResult {
    const safeAlpha = Math.max(0, alpha);
    const safeBeta = Math.max(0, beta);

    let currentI = initialI;
    let cumulativeGain = 0;
    let cumulativeLoss = 0;

    const stepResults: InvariantStepResult[] = [];

    observations.forEach((obs, idx) => {
      const t = obs.t ?? idx;
      const C_Ot = Math.max(0, Math.min(1.0, obs.confidence));
      const V_t = Math.max(0, obs.verificationValue);
      const epsilon_t = Math.max(0, obs.errorResidual);

      const gainTerm = safeAlpha * C_Ot * V_t;
      const lossTerm = safeBeta * epsilon_t;
      const deltaI = gainTerm - lossTerm;
      const nextI = currentI + deltaI;

      cumulativeGain += gainTerm;
      cumulativeLoss += lossTerm;

      const equilibriumEpsilon = safeBeta > 0 ? (safeAlpha * C_Ot * V_t) / safeBeta : 0;
      const isEquilibrium = Math.abs(deltaI) < 0.0001;

      stepResults.push({
        t,
        I_prev: +currentI.toFixed(6),
        gainTerm: +gainTerm.toFixed(6),
        lossTerm: +lossTerm.toFixed(6),
        deltaI: +deltaI.toFixed(6),
        I_next: +nextI.toFixed(6),
        C_Ot: +C_Ot.toFixed(4),
        V_t: +V_t.toFixed(4),
        epsilon_t: +epsilon_t.toFixed(4),
        isEquilibrium,
        equilibriumEpsilon: +equilibriumEpsilon.toFixed(4),
      });

      currentI = nextI;
    });

    const netDelta = currentI - initialI;
    const lastThreeDeltas = stepResults.slice(-3).map((s) => Math.abs(s.deltaI));
    const steadyStateAchieved = lastThreeDeltas.length >= 3 && lastThreeDeltas.every((d) => d < 0.01);

    const receiptId = `RCPT_INV_RECURRENCE_0x${Math.abs(Math.floor(currentI * 1000)).toString(16).toUpperCase()}`;

    return {
      alpha: safeAlpha,
      beta: safeBeta,
      initialI: +initialI.toFixed(6),
      steps: stepResults,
      finalI: +currentI.toFixed(6),
      cumulativeGain: +cumulativeGain.toFixed(6),
      cumulativeLoss: +cumulativeLoss.toFixed(6),
      netDelta: +netDelta.toFixed(6),
      steadyStateAchieved,
      receiptId,
      calculatedAtUtc: new Date().toISOString(),
    };
  }

  /**
   * Generates a realistic synthetic observation stream for live invariant state tracking.
   */
  public generateSyntheticObservations(
    stepCount: number = 24,
    baseConfidence: number = 0.88,
    baseValue: number = 10.0,
    baseError: number = 1.2
  ): InvariantObservationStep[] {
    const steps: InvariantObservationStep[] = [];
    for (let t = 0; t < stepCount; t++) {
      // Small Gaussian-like noise fluctuations
      const confNoise = (Math.sin(t * 0.7) * 0.08) + ((Math.random() - 0.5) * 0.05);
      const valNoise = (Math.cos(t * 0.5) * 1.5) + ((Math.random() - 0.5) * 1.0);
      const errDecay = Math.exp(-t * 0.08) * baseError + (Math.random() * 0.2);

      steps.push({
        t,
        confidence: Math.max(0.1, Math.min(1.0, baseConfidence + confNoise)),
        verificationValue: Math.max(0.5, baseValue + valNoise),
        errorResidual: Math.max(0.01, errDecay),
        timestampMs: Date.now() + t * 1000,
      });
    }
    return steps;
  }
}

export const globalNeuralInvariantCapacityEngine = NeuralInvariantCapacityEngine.getInstance();
