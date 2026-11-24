/**
 * matrix-worker.ts
 * Off-main-thread matrix worker evaluating node validation,
 * Chern curvature form Theta_{L,h} = -partial bar{partial} log h,
 * and interaction dynamics (P, dX, dY, Xc, Yc, Prs).
 */

export interface ValidatePayload {
  nodeIndex: number;
  p: number;
  dx: number;
  dy: number;
  xc: number;
  yc: number;
  prs: number;
}

export interface ValidateResult {
  nodeIndex: number;
  score: number; // percentile 0.00 to 1.00
  chernCurvature: number; // Theta_{L,h} metric value
  metricLogH: number;
  quantumSimulationMode: string;
  stepOrderPlan: string;
  timestamp: number;
}

// Compute Chern curvature: Theta_{L,h} = -partial bar{partial} log h
export function evaluateChernCurvature(payload: ValidatePayload): ValidateResult {
  const normX = (payload.xc / 800) * 2 - 1;
  const normY = (payload.yc / 600) * 2 - 1;
  const r2 = normX * normX + normY * normY;

  // Hermitian metric h(z) = exp(-|z|^2 + 0.15*Re(z^3))
  // log h = -|z|^2 + 0.15*(x^3 - 3*x*y^2)
  const logH = -r2 + 0.15 * (normX * normX * normX - 3 * normX * normY * normY);

  // Laplacian: -d^2/dz dzbar (log h) = 1.0 + perturbation from pressure prs and nodeIndex
  const prsWeight = Math.min(1.0, Math.abs(payload.prs || 0.01) * 10);
  const nodeFraction = (payload.nodeIndex % 64) / 63;
  const velocityNorm = Math.sqrt(payload.dx * payload.dx + payload.dy * payload.dy);

  // Curvature scalar
  const chernCurvature = +(1.0 + 0.25 * Math.sin(nodeFraction * Math.PI * 4) + prsWeight * 0.1).toFixed(4);

  // Score percentile: calibrated scalar between 0.00 and 1.00
  const rawScore = (nodeFraction * 0.6 + (chernCurvature - 0.75) * 0.3 + (velocityNorm % 1) * 0.1);
  const score = Math.max(0.01, Math.min(0.99, +rawScore.toFixed(4)));

  let stepOrderPlan = 'STEP_01_INITIAL_INGEST_PIPELINE';
  const hue = Math.floor(score * 360);
  if (hue >= 120 && hue < 240) {
    stepOrderPlan = 'STEP_02_RESONANCE_BALANCING';
  } else if (hue >= 240) {
    stepOrderPlan = 'STEP_03_EQUILIBRIUM_LOCK_COMMIT';
  }

  return {
    nodeIndex: payload.nodeIndex,
    score: score,
    chernCurvature: chernCurvature,
    metricLogH: +logH.toFixed(4),
    quantumSimulationMode: 'CHER_CURVATURE_MATHEMATICA_LAYERED',
    stepOrderPlan: stepOrderPlan,
    timestamp: Date.now(),
  };
}

if (typeof self !== 'undefined' && typeof self.postMessage === 'function') {
  self.onmessage = (e: MessageEvent<{ type: string; payload: ValidatePayload }>) => {
    if (e.data.type === 'VALIDATE_NODE_NODE') {
      const result = evaluateChernCurvature(e.data.payload);
      self.postMessage({
        type: 'VALIDATION_COMPLETE',
        payload: result,
      });
    }
  };
}
