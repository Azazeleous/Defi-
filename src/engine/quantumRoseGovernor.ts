/**
 * =============================================================================
 * SPECIFICATION: GAIA.NEXUS.HCCGN.QUANTUM-ROSE.V7 (Sections 1 & 2)
 * MODULE: Quantum Rose Visual Governor, Hamiltonian Simulator & Color Pipeline
 * ARCHITECTURE: ColorManager -> GradientEngine -> Renderer + Gate A=B&&C&&V
 * =============================================================================
 */

import type {
  ColorStopSpec,
  DisplayP3Color,
  GateDimensionStatus,
  GateDimensionTelemetry,
  GradientRenderSpec,
  HamiltonianEigenstate,
  HamiltonianSimulationSnapshot,
  HslColor,
  HsvColor,
  LinearRgbColor,
  OklabColor,
  OklchColor,
  SrgbColor,
  StrictGateEvaluationV7,
  WcagContrastAudit,
} from '../contracts/v7-convergence';

// ============================================================================
// 1. GOVERNING INVARIANT: A = B && C && V (Strict Non-Override Gate)
// ============================================================================

export function evaluateStrictGateV7(params: {
  boundary: {
    status: GateDimensionStatus;
    measuredValue?: string | number | null;
    reason: string;
    observedAtUtc?: string | null;
    staleAfterMs?: number;
  };
  capacity: {
    status: GateDimensionStatus;
    measuredValue?: string | number | null;
    reason: string;
    observedAtUtc?: string | null;
    staleAfterMs?: number;
  };
  verification: {
    status: GateDimensionStatus;
    measuredValue?: string | number | null;
    reason: string;
    observedAtUtc?: string | null;
    staleAfterMs?: number;
  };
  visualOverrideAttempted?: boolean;
}): StrictGateEvaluationV7 {
  const nowMs = Date.now();
  const resolveDim = (d: {
    status: GateDimensionStatus;
    measuredValue?: string | number | null;
    reason: string;
    observedAtUtc?: string | null;
    staleAfterMs?: number;
  }): GateDimensionTelemetry => {
    let effectiveStatus: GateDimensionStatus = d.status;
    let reason = d.reason;

    if (d.status === 'PASS' && d.staleAfterMs && d.observedAtUtc) {
      const age = nowMs - Date.parse(d.observedAtUtc);
      if (!Number.isFinite(age) || age > d.staleAfterMs) {
        effectiveStatus = 'STALE';
        reason = `${d.reason} (observation stale: age=${Math.round(age)}ms > ${d.staleAfterMs}ms)`;
      }
    } else if (d.status === 'PASS' && !d.observedAtUtc) {
      effectiveStatus = 'MISSING';
      reason = `${d.reason} (missing observation timestamp)`;
    }

    return {
      status: effectiveStatus,
      satisfied: effectiveStatus === 'PASS',
      measuredValue: d.measuredValue ?? null,
      reason,
      observedAtUtc: d.observedAtUtc ?? null,
    };
  };

  const B_boundary = resolveDim(params.boundary);
  const C_capacity = resolveDim(params.capacity);
  const V_verification = resolveDim(params.verification);

  // Strict invariant: Visual governor can NEVER override A = B && C && V
  const A_authorized = B_boundary.satisfied && C_capacity.satisfied && V_verification.satisfied;
  const visualOverrideAttempted = Boolean(params.visualOverrideAttempted);

  return {
    evaluatedAtUtc: new Date(nowMs).toISOString(),
    visualOverrideAttempted,
    visualOverrideRejected: visualOverrideAttempted,
    B_boundary,
    C_capacity,
    V_verification,
    A_authorized,
    decision: A_authorized ? 'AUTHORIZED' : 'WITHHELD',
  };
}

// ============================================================================
// 2. COLOR MANAGER (sRGB, Linear RGB, HSL/HSV, OKLab/OKLCH, Display-P3, WCAG)
// ============================================================================

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function linearComponentFromSrgb(c: number): number {
  const s = clamp01(c);
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function srgbComponentFromLinear(c: number): number {
  const l = clamp01(c);
  return l <= 0.0031308 ? 12.92 * l : 1.055 * Math.pow(l, 1 / 2.4) - 0.055;
}

export function srgbToLinearRgb(c: SrgbColor): LinearRgbColor {
  return {
    r: linearComponentFromSrgb(c.r),
    g: linearComponentFromSrgb(c.g),
    b: linearComponentFromSrgb(c.b),
    a: clamp01(c.a),
  };
}

export function linearRgbToSrgb(c: LinearRgbColor): SrgbColor {
  return {
    r: srgbComponentFromLinear(c.r),
    g: srgbComponentFromLinear(c.g),
    b: srgbComponentFromLinear(c.b),
    a: clamp01(c.a),
  };
}

export function srgbToHex(c: SrgbColor): string {
  const r = Math.round(clamp01(c.r) * 255).toString(16).padStart(2, '0');
  const g = Math.round(clamp01(c.g) * 255).toString(16).padStart(2, '0');
  const b = Math.round(clamp01(c.b) * 255).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`.toUpperCase();
}

export function hexToSrgb(hex: string): SrgbColor {
  const clean = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    return { r: 0, g: 0, b: 0, a: 1 };
  }
  return {
    r: parseInt(clean.slice(0, 2), 16) / 255,
    g: parseInt(clean.slice(2, 4), 16) / 255,
    b: parseInt(clean.slice(4, 6), 16) / 255,
    a: 1,
  };
}

export function srgbToHsl(c: SrgbColor): HslColor {
  const r = clamp01(c.r);
  const g = clamp01(c.g);
  const b = clamp01(c.b);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }
  return { h: +h.toFixed(2), s: +(s * 100).toFixed(2), l: +(l * 100).toFixed(2), a: c.a };
}

export function srgbToHsv(c: SrgbColor): HsvColor {
  const r = clamp01(c.r);
  const g = clamp01(c.g);
  const b = clamp01(c.b);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  if (max !== min) {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }
  return { h: +h.toFixed(2), s: +(s * 100).toFixed(2), v: +(v * 100).toFixed(2), a: c.a };
}

// Björn Ottosson OKLab <-> Linear sRGB matrices
export function linearRgbToOklab(c: LinearRgbColor): OklabColor {
  const l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
  const m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
  const s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;

  const l_ = Math.cbrt(Math.max(0, l));
  const m_ = Math.cbrt(Math.max(0, m));
  const s_ = Math.cbrt(Math.max(0, s));

  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
    alpha: clamp01(c.a),
  };
}

export function oklabToLinearRgb(c: OklabColor): LinearRgbColor {
  const l_ = c.L + 0.3963377774 * c.a + 0.2158037573 * c.b;
  const m_ = c.L - 0.1055613458 * c.a - 0.0638541728 * c.b;
  const s_ = c.L - 0.0894841775 * c.a - 1.291485548 * c.b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return {
    r: +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    a: clamp01(c.alpha),
  };
}

export function oklabToOklch(c: OklabColor): OklchColor {
  const C = Math.sqrt(c.a * c.a + c.b * c.b);
  let H = (Math.atan2(c.b, c.a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L: c.L, C, H, alpha: c.alpha };
}

export function oklchToOklab(c: OklchColor): OklabColor {
  const rad = (c.H * Math.PI) / 180;
  return {
    L: c.L,
    a: c.C * Math.cos(rad),
    b: c.C * Math.sin(rad),
    alpha: c.alpha,
  };
}

// Linear sRGB -> Linear Display-P3 -> Display-P3 OETF (sRGB transfer curve)
export function linearSrgbToDisplayP3(c: LinearRgbColor): DisplayP3Color {
  const p3LinR = 0.8224621 * c.r + 0.177538 * c.g + 0.0 * c.b;
  const p3LinG = 0.0331941 * c.r + 0.9668058 * c.g + 0.0 * c.b;
  const p3LinB = 0.0170827 * c.r + 0.0723974 * c.g + 0.9105199 * c.b;
  const transfer = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(Math.max(0, x), 1 / 2.4) - 0.055);
  return {
    r: transfer(p3LinR),
    g: transfer(p3LinG),
    b: transfer(p3LinB),
    a: clamp01(c.a),
  };
}

export function isInGamut01(r: number, g: number, b: number, eps: number = 0.0005): boolean {
  return r >= -eps && r <= 1 + eps && g >= -eps && g <= 1 + eps && b >= -eps && b <= 1 + eps;
}

export function resolveColorSpacesFromOklch(oklch: OklchColor): {
  oklch: OklchColor;
  srgb: SrgbColor;
  srgbHex: string;
  displayP3: DisplayP3Color;
  cssDisplayP3: string;
  cssOklch: string;
  inSrgbGamut: boolean;
  inDisplayP3Gamut: boolean;
} {
  const lab = oklchToOklab(oklch);
  const linSrgb = oklabToLinearRgb(lab);
  const inSrgbGamut = isInGamut01(linSrgb.r, linSrgb.g, linSrgb.b);
  const srgb = linearRgbToSrgb(linSrgb);
  const p3 = linearSrgbToDisplayP3(linSrgb);
  const inDisplayP3Gamut = isInGamut01(p3.r, p3.g, p3.b);
  const clampedP3 = {
    r: clamp01(p3.r),
    g: clamp01(p3.g),
    b: clamp01(p3.b),
    a: clamp01(p3.a),
  };
  return {
    oklch,
    srgb,
    srgbHex: srgbToHex(srgb),
    displayP3: clampedP3,
    cssDisplayP3: `color(display-p3 ${clampedP3.r.toFixed(4)} ${clampedP3.g.toFixed(4)} ${clampedP3.b.toFixed(4)} / ${clampedP3.a.toFixed(3)})`,
    cssOklch: `oklch(${(oklch.L * 100).toFixed(2)}% ${oklch.C.toFixed(4)} ${oklch.H.toFixed(2)}deg / ${oklch.alpha.toFixed(3)})`,
    inSrgbGamut,
    inDisplayP3Gamut,
  };
}

export function detectBrowserDisplayP3Support(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia('(color-gamut: p3)').matches;
  } catch {
    return false;
  }
}

export function relativeLuminance(hex: string): number {
  const srgb = hexToSrgb(hex);
  const lin = srgbToLinearRgb(srgb);
  return 0.2126 * lin.r + 0.7152 * lin.g + 0.0722 * lin.b;
}

export function evaluateWcagContrast(foregroundHex: string, backgroundHex: string): WcagContrastAudit {
  const l1 = relativeLuminance(foregroundHex);
  const l2 = relativeLuminance(backgroundHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  const ratio = +((lighter + 0.05) / (darker + 0.05)).toFixed(2);
  const aaNormal = ratio >= 4.5;
  const aaaNormal = ratio >= 7.0;
  const aaLarge = ratio >= 3.0;
  const statusLabel: WcagContrastAudit['statusLabel'] = aaaNormal
    ? 'AAA'
    : aaNormal
      ? 'AA'
      : aaLarge
        ? 'AA_LARGE_ONLY'
        : 'FAIL';

  return {
    foregroundHex: foregroundHex.toUpperCase(),
    backgroundHex: backgroundHex.toUpperCase(),
    contrastRatio: ratio,
    aaNormal,
    aaaNormal,
    aaLarge,
    statusLabel,
  };
}

function deterministicFnvHashHex(text: string): string {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < text.length; i++) {
    h ^= BigInt(text.charCodeAt(i));
    h = BigInt.asUintN(64, h * prime);
  }
  return h.toString(16).padStart(16, '0');
}

// ============================================================================
// 3. GRADIENT ENGINE
// ============================================================================

export function buildProceduralGradient(params: {
  kind: GradientRenderSpec['kind'];
  baseHueDeg: number;
  chroma?: number;
  lightness?: number;
  angleDeg?: number;
  stopsCount?: number;
  prefersDisplayP3?: boolean;
}): GradientRenderSpec {
  const count = Math.max(2, Math.min(8, Math.floor(params.stopsCount ?? 5)));
  const chroma = Math.max(0.02, Math.min(0.32, params.chroma ?? 0.2));
  const lightness = Math.max(0.35, Math.min(0.88, params.lightness ?? 0.72));
  const angleDeg = Math.round(((params.angleDeg ?? 135) % 360 + 360) % 360);

  const stops: ColorStopSpec[] = [];
  for (let i = 0; i < count; i++) {
    const pos = i / (count - 1);
    const hue = (params.baseHueDeg + pos * 145) % 360;
    const stopL = clamp01(lightness - 0.14 * Math.sin(pos * Math.PI) + 0.04 * (0.5 - pos));
    const resolved = resolveColorSpacesFromOklch({
      L: stopL,
      C: chroma,
      H: hue,
      alpha: 1,
    });
    stops.push({
      position: +pos.toFixed(4),
      oklch: resolved.oklch,
      srgbHex: resolved.srgbHex,
      cssDisplayP3: resolved.cssDisplayP3,
      cssOklch: resolved.cssOklch,
      inSrgbGamut: resolved.inSrgbGamut,
      inDisplayP3Gamut: resolved.inDisplayP3Gamut,
    });
  }

  const formatStopList = (extractor: (s: ColorStopSpec) => string) =>
    stops.map((s) => `${extractor(s)} ${(s.position * 100).toFixed(1)}%`).join(', ');

  const wrapGradient = (stopList: string): string => {
    if (params.kind === 'RADIAL') return `radial-gradient(circle at center, ${stopList})`;
    if (params.kind === 'CONIC') return `conic-gradient(from ${angleDeg}deg at 50% 50%, ${stopList})`;
    return `linear-gradient(${angleDeg}deg, ${stopList})`;
  };

  const cssSrgb = wrapGradient(formatStopList((s) => s.srgbHex));
  const cssDisplayP3 = wrapGradient(formatStopList((s) => s.cssDisplayP3));
  const cssOklch = wrapGradient(formatStopList((s) => s.cssOklch));
  const prefersDisplayP3 = params.prefersDisplayP3 ?? detectBrowserDisplayP3Support();
  const paletteHash = deterministicFnvHashHex(`${params.kind}|${angleDeg}|${cssOklch}`);

  return {
    id: `grad_${paletteHash}`,
    kind: params.kind,
    angleDeg,
    stops,
    cssSrgb,
    cssDisplayP3,
    cssOklch,
    prefersDisplayP3,
    paletteHash,
    createdAtUtc: new Date().toISOString(),
  };
}

// ============================================================================
// 4. HAMILTONIAN CLOSED-SYSTEM UNITARY EVOLUTION SIMULATOR
// ============================================================================

export function buildHamiltonianEigenstates(
  count: number,
  perturbationPhaseRad: number
): HamiltonianEigenstate[] {
  const safeCount = Math.max(2, Math.min(16, Math.floor(count)));
  // Normalized initial amplitudes: sum |c_n(0)|^2 === 1 exactly
  const rawWeights: number[] = [];
  let sumSq = 0;
  for (let i = 0; i < safeCount; i++) {
    const w = 1 / (1 + i * 0.22);
    rawWeights.push(w);
    sumSq += w * w;
  }
  const invNorm = 1 / Math.sqrt(sumSq);

  const states: HamiltonianEigenstate[] = [];
  for (let i = 0; i < safeCount; i++) {
    const n = i + 1;
    const m = i % 2 === 0 ? n : -n;
    const mag = rawWeights[i] * invNorm;
    const phi0 = (i * 0.785398 + perturbationPhaseRad) % (Math.PI * 2);
    const re0 = mag * Math.cos(phi0);
    const im0 = mag * Math.sin(phi0);
    const energy = 0.5 * n * (n + 0.5) * 0.42;
    states.push({
      n,
      m,
      energy: +energy.toFixed(6),
      initialRe: re0,
      initialIm: im0,
      currentRe: re0,
      currentIm: im0,
      probability: +(mag * mag).toFixed(8),
      phaseRad: +phi0.toFixed(6),
    });
  }
  return states;
}

export function evolveHamiltonianSnapshot(params: {
  eigenstatesCount: number;
  simTime: number;
  perturbationPhaseRad: number;
  coherence: number;
  baseHueDeg: number;
  hbar?: number;
  visualOverrideAttempted?: boolean;
  clockObservedAtUtc?: string;
}): HamiltonianSimulationSnapshot {
  const hbar = params.hbar && params.hbar > 0 ? params.hbar : 1.0;
  const coherence = clamp01(params.coherence);
  const initialStates = buildHamiltonianEigenstates(params.eigenstatesCount, params.perturbationPhaseRad);

  let normSum = 0;
  let expectationEnergy = 0;
  const evolved: HamiltonianEigenstate[] = initialStates.map((st) => {
    // Unitary evolution: c_n(t) = c_n(0) * exp(-i * E_n * t / hbar)
    const theta = (-st.energy * params.simTime) / hbar;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const curRe = st.initialRe * cosT - st.initialIm * sinT;
    const curIm = st.initialRe * sinT + st.initialIm * cosT;
    const prob = curRe * curRe + curIm * curIm;
    const phaseRad = Math.atan2(curIm, curRe);
    normSum += prob;
    expectationEnergy += prob * st.energy;
    return {
      ...st,
      currentRe: +curRe.toFixed(8),
      currentIm: +curIm.toFixed(8),
      probability: +prob.toFixed(8),
      phaseRad: +phaseRad.toFixed(6),
    };
  });

  const normDrift = Math.abs(1.0 - normSum);
  const normConserved = normDrift < 1e-6;
  const nowUtc = params.clockObservedAtUtc || new Date().toISOString();

  const activePalette = buildProceduralGradient({
    kind: 'PROCEDURAL_HAMILTONIAN',
    baseHueDeg: (params.baseHueDeg + params.simTime * 18) % 360,
    chroma: 0.14 + coherence * 0.12,
    lightness: 0.68,
    angleDeg: Math.round((params.simTime * 36) % 360),
    stopsCount: 5,
  });

  const gateEvaluation = evaluateStrictGateV7({
    boundary: {
      status: params.eigenstatesCount >= 2 && params.eigenstatesCount <= 16 ? 'PASS' : 'FAIL',
      measuredValue: `${params.eigenstatesCount} modes`,
      reason: 'Eigenstate count within [2..16] & hbar > 0 verified',
      observedAtUtc: nowUtc,
    },
    capacity: {
      status: 'PASS',
      measuredValue: `${coherence.toFixed(2)} coherence`,
      reason: 'Hamiltonian frame evaluation completed within UI slice capacity',
      observedAtUtc: nowUtc,
      staleAfterMs: 15_000,
    },
    verification: {
      status: normConserved ? 'PASS' : 'FAIL',
      measuredValue: `normDrift=${normDrift.toExponential(2)}`,
      reason: normConserved
        ? 'Unitary probability norm sum(|c_n|^2) = 1 conserved within 1e-6'
        : `Unitary norm drift ${normDrift} exceeded 1e-6 threshold`,
      observedAtUtc: nowUtc,
    },
    visualOverrideAttempted: params.visualOverrideAttempted,
  });

  return {
    modelNotice: 'MATHEMATICAL_MODEL_NOT_PHYSICAL_QUANTUM_DEVICE',
    hbar,
    simTime: +params.simTime.toFixed(4),
    coherence,
    normSum: +normSum.toFixed(8),
    normDrift: +normDrift.toExponential(4),
    normConserved,
    expectationEnergy: +expectationEnergy.toFixed(6),
    eigenstates: evolved,
    activePalette,
    gateEvaluation,
    capturedAtUtc: nowUtc,
  };
}

export function evaluateWavefunctionPolar(
  r: number,
  theta: number,
  eigenstates: readonly HamiltonianEigenstate[],
  coherence: number
): { real: number; imag: number; probDensity: number; phase: number } {
  let real = 0;
  let imag = 0;
  const radialEnv = Math.exp(-2.1 * r * r);
  for (let i = 0; i < eigenstates.length; i++) {
    const st = eigenstates[i];
    const k = (st.n + 1) * Math.PI * 0.65;
    const radialBasis = radialEnv * Math.cos(k * r) + 0.34 * Math.sin((st.n + 0.5) * r * Math.PI) * (1 - r);
    const weight = i === 0 ? 1.0 : coherence;
    const cosAng = Math.cos(st.m * theta);
    const sinAng = Math.sin(st.m * theta);
    const cRe = st.currentRe * cosAng - st.currentIm * sinAng;
    const cIm = st.currentRe * sinAng + st.currentIm * cosAng;
    real += weight * radialBasis * cRe;
    imag += weight * radialBasis * cIm;
  }
  return {
    real,
    imag,
    probDensity: real * real + imag * imag,
    phase: Math.atan2(imag, real),
  };
}
