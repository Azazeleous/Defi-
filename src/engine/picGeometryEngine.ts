/**
 * =============================================================================
 * SPECIFICATION: GAIA.NEXUS.HCCGN.QUANTUM-ROSE.V7 (Section 3)
 * MODULE: PIC Bitwise Geometry Engine
 * POLICY:
 *   - Retains the `PIC` technical designation without inventing an expansion
 *   - Strictly separates integer RGBA pixel-plane math from float color math
 *   - Bounds-enforced buffers integrated with Gate A = B && C && V
 *   - CSS clip-path geometric masks never substitute for real buffer transforms
 * =============================================================================
 */

import type {
  PicBitwiseOperationReport,
  PicBufferBoundsCheck,
  PicClipPathMaskSpec,
  PicMaskKind,
} from '../contracts/v7-convergence';
import { evaluateStrictGateV7 } from './quantumRoseGovernor';

export const PIC_MAX_DIMENSION = 2048;
export const PIC_MAX_BUFFER_BYTES = 16 * 1024 * 1024; // 16 MiB strict cap

export function validatePicBufferBounds(width: number, height: number): PicBufferBoundsCheck {
  const validInts = Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0;
  const pixelCount = validInts ? width * height : 0;
  const byteLength = pixelCount * 4;
  const withinDim = validInts && width <= PIC_MAX_DIMENSION && height <= PIC_MAX_DIMENSION;
  const withinMem = validInts && byteLength <= PIC_MAX_BUFFER_BYTES;
  const withinBounds = validInts && withinDim && withinMem;

  const reason = !validInts
    ? `Invalid buffer dimensions (${width}x${height})`
    : !withinDim
      ? `Dimensions ${width}x${height} exceed MAX ${PIC_MAX_DIMENSION}x${PIC_MAX_DIMENSION}`
      : !withinMem
        ? `Allocation ${byteLength} bytes exceeds MAX ${PIC_MAX_BUFFER_BYTES} bytes`
        : `PIC bounds OK (${width}x${height}, ${byteLength} bytes)`;

  return {
    width,
    height,
    pixelCount,
    byteLength,
    maxBytes: PIC_MAX_BUFFER_BYTES,
    maxDimension: PIC_MAX_DIMENSION,
    withinBounds,
    reason,
  };
}

export function checksumUint32Buffer(buf: Uint32Array): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < buf.length; i++) {
    const v = buf[i];
    h ^= v & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (v >>> 8) & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (v >>> 16) & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (v >>> 24) & 0xff;
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function extractRgbaChannels(packedRgba: number): { r: number; g: number; b: number; a: number } {
  return {
    r: (packedRgba >>> 24) & 0xff,
    g: (packedRgba >>> 16) & 0xff,
    b: (packedRgba >>> 8) & 0xff,
    a: packedRgba & 0xff,
  };
}

export function packRgbaInt32(r: number, g: number, b: number, a: number): number {
  return (((r & 0xff) << 24) | ((g & 0xff) << 16) | ((b & 0xff) << 8) | (a & 0xff)) >>> 0;
}

export function createDeterministicPicTestBuffer(width: number, height: number): Uint32Array {
  const bounds = validatePicBufferBounds(width, height);
  if (!bounds.withinBounds) {
    throw new Error(`PIC_BOUNDS_REJECTED: ${bounds.reason}`);
  }
  const buf = new Uint32Array(bounds.pixelCount);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const r = (x * 7 + y * 3) & 0xff;
      const g = (x * 5 ^ y * 11) & 0xff;
      const b = ((x + y) * 13) & 0xff;
      const a = 255 - (((x ^ y) * 2) & 0x3f);
      buf[idx] = packRgbaInt32(r, g, b, a);
    }
  }
  return buf;
}

export function applyBitwiseChannelMask(src: Uint32Array, mask32: number): Uint32Array {
  const out = new Uint32Array(src.length);
  const m = mask32 >>> 0;
  for (let i = 0; i < src.length; i++) {
    out[i] = (src[i] & m) >>> 0;
  }
  return out;
}

export function quantizeBufferBitDepth(src: Uint32Array, keepBitsPerChannel: number): Uint32Array {
  const bits = Math.max(1, Math.min(8, Math.floor(keepBitsPerChannel)));
  const shift = 8 - bits;
  const channelMask = (0xff << shift) & 0xff;
  const packedMask = packRgbaInt32(channelMask, channelMask, channelMask, 0xff);
  return applyBitwiseChannelMask(src, packedMask);
}

export function applyAlphaMaskBuffer(src: Uint32Array, alphaPlane: Uint8Array): Uint32Array {
  if (alphaPlane.length !== src.length) {
    throw new Error(`PIC_ALPHA_LENGTH_MISMATCH: expected ${src.length}, got ${alphaPlane.length}`);
  }
  const out = new Uint32Array(src.length);
  for (let i = 0; i < src.length; i++) {
    const px = src[i];
    out[i] = ((px & 0xffffff00) | (alphaPlane[i] & 0xff)) >>> 0;
  }
  return out;
}

export function clipBufferRegion(
  src: Uint32Array,
  srcWidth: number,
  srcHeight: number,
  x0: number,
  y0: number,
  clipW: number,
  clipH: number
): Uint32Array {
  const bounds = validatePicBufferBounds(srcWidth, srcHeight);
  const clipBounds = validatePicBufferBounds(clipW, clipH);
  if (!bounds.withinBounds || !clipBounds.withinBounds) {
    throw new Error(`PIC_CLIP_BOUNDS_ERROR: ${bounds.reason} / ${clipBounds.reason}`);
  }
  if (x0 < 0 || y0 < 0 || x0 + clipW > srcWidth || y0 + clipH > srcHeight) {
    throw new Error(`PIC_CLIP_RECT_OUT_OF_RANGE: (${x0},${y0},${clipW},${clipH}) outside ${srcWidth}x${srcHeight}`);
  }
  const out = new Uint32Array(clipW * clipH);
  for (let y = 0; y < clipH; y++) {
    const srcRow = (y0 + y) * srcWidth + x0;
    const dstRow = y * clipW;
    out.set(src.subarray(srcRow, srcRow + clipW), dstRow);
  }
  return out;
}

export function resampleBufferInteger(
  src: Uint32Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): Uint32Array {
  const dstBounds = validatePicBufferBounds(dstW, dstH);
  if (!dstBounds.withinBounds) {
    throw new Error(`PIC_RESAMPLE_BOUNDS_ERROR: ${dstBounds.reason}`);
  }
  const out = new Uint32Array(dstW * dstH);
  for (let y = 0; y < dstH; y++) {
    const sy = Math.min(srcH - 1, Math.floor((y * srcH) / dstH));
    for (let x = 0; x < dstW; x++) {
      const sx = Math.min(srcW - 1, Math.floor((x * srcW) / dstW));
      out[y * dstW + x] = src[sy * srcW + sx];
    }
  }
  return out;
}

/**
 * Bijective integer bit-plane transform (XOR mask + 32-bit bit-rotation),
 * strictly invertible without floating-point loss.
 */
export function reversibleBitPlaneXorRotate(src: Uint32Array, rotateBits: number = 7, keyMask: number = 0xa55a3cc3): Uint32Array {
  const r = ((rotateBits % 32) + 32) % 32;
  const k = keyMask >>> 0;
  const out = new Uint32Array(src.length);
  for (let i = 0; i < src.length; i++) {
    const xored = (src[i] ^ ((k + i * 0x01010101) >>> 0)) >>> 0;
    out[i] = r === 0 ? xored : ((xored << r) | (xored >>> (32 - r))) >>> 0;
  }
  return out;
}

export function invertBitPlaneXorRotate(encoded: Uint32Array, rotateBits: number = 7, keyMask: number = 0xa55a3cc3): Uint32Array {
  const r = ((rotateBits % 32) + 32) % 32;
  const k = keyMask >>> 0;
  const out = new Uint32Array(encoded.length);
  for (let i = 0; i < encoded.length; i++) {
    const v = encoded[i];
    const unrot = r === 0 ? v : ((v >>> r) | (v << (32 - r))) >>> 0;
    out[i] = (unrot ^ ((k + i * 0x01010101) >>> 0)) >>> 0;
  }
  return out;
}

export function runPicRoundTripVerification(width: number, height: number): PicBitwiseOperationReport {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const bounds = validatePicBufferBounds(width, height);
  const nowUtc = new Date().toISOString();

  if (!bounds.withinBounds) {
    const gate = evaluateStrictGateV7({
      boundary: { status: 'FAIL', measuredValue: `${width}x${height}`, reason: bounds.reason, observedAtUtc: nowUtc },
      capacity: { status: 'FAIL', measuredValue: `${bounds.byteLength}B`, reason: 'Allocation denied by bounds', observedAtUtc: nowUtc },
      verification: { status: 'FAIL', measuredValue: 'SKIPPED', reason: 'Boundary check rejected operation', observedAtUtc: nowUtc },
    });
    return {
      designation: 'PIC',
      operation: 'REVERSIBLE_XOR_ROTATE_ROUNDTRIP',
      bounds,
      inputChecksumHex: '00000000',
      transformedChecksumHex: '00000000',
      restoredChecksumHex: null,
      roundTripExactMatch: false,
      channelPreserved: false,
      durationUs: 0,
      gateEvaluation: gate,
    };
  }

  const input = createDeterministicPicTestBuffer(width, height);
  const encoded = reversibleBitPlaneXorRotate(input, 11, 0x9e3779b9);
  const restored = invertBitPlaneXorRotate(encoded, 11, 0x9e3779b9);

  let exact = input.length === restored.length;
  for (let i = 0; i < input.length && exact; i++) {
    if (input[i] !== restored[i]) exact = false;
  }

  // Verify channel mask preservation (green channel isolation preserves G bits untouched)
  const gMask = packRgbaInt32(0x00, 0xff, 0x00, 0x00);
  const masked = applyBitwiseChannelMask(input, gMask);
  let channelPreserved = true;
  for (let i = 0; i < input.length; i++) {
    if (extractRgbaChannels(masked[i]).g !== extractRgbaChannels(input[i]).g) {
      channelPreserved = false;
      break;
    }
  }

  const inputChecksumHex = checksumUint32Buffer(input);
  const transformedChecksumHex = checksumUint32Buffer(encoded);
  const restoredChecksumHex = checksumUint32Buffer(restored);
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const durationUs = Math.max(1, Math.round((t1 - t0) * 1000));

  const gate = evaluateStrictGateV7({
    boundary: { status: 'PASS', measuredValue: `${width}x${height}`, reason: bounds.reason, observedAtUtc: nowUtc },
    capacity: {
      status: 'PASS',
      measuredValue: `${bounds.byteLength} bytes`,
      reason: `Within ${PIC_MAX_BUFFER_BYTES} byte cap`,
      observedAtUtc: nowUtc,
      staleAfterMs: 30_000,
    },
    verification: {
      status: exact && channelPreserved ? 'PASS' : 'FAIL',
      measuredValue: `${inputChecksumHex} == ${restoredChecksumHex}`,
      reason: exact && channelPreserved
        ? 'Exact 32-bit integer round-trip and channel mask preservation verified'
        : 'Round-trip or channel bit integrity mismatch',
      observedAtUtc: nowUtc,
    },
  });

  return {
    designation: 'PIC',
    operation: 'REVERSIBLE_XOR_ROTATE_ROUNDTRIP',
    bounds,
    inputChecksumHex,
    transformedChecksumHex,
    restoredChecksumHex,
    roundTripExactMatch: exact,
    channelPreserved,
    durationUs,
    gateEvaluation: gate,
  };
}

// ============================================================================
// CSS CLIP-PATH GEOMETRY MASK ENGINE (Strictly Viewport Masking Only)
// ============================================================================

const POLYGON_HEXAGON: readonly [number, number][] = [
  [50, 2],
  [93, 25],
  [93, 75],
  [50, 98],
  [7, 75],
  [7, 25],
];

const POLYGON_DIAMOND: readonly [number, number][] = [
  [50, 0],
  [75, 25],
  [100, 50],
  [75, 75],
  [50, 100],
  [25, 75],
];

export function interpolatePolygonClipPath(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const pts = POLYGON_HEXAGON.map((p, idx) => {
    const target = POLYGON_DIAMOND[idx];
    const x = p[0] + (target[0] - p[0]) * clamped;
    const y = p[1] + (target[1] - p[1]) * clamped;
    return `${x.toFixed(1)}% ${y.toFixed(1)}%`;
  });
  return `polygon(${pts.join(', ')})`;
}

export function buildPicCssClipMask(kind: PicMaskKind, morphT: number = 0): PicClipPathMaskSpec {
  let cssClipPath = '';
  switch (kind) {
    case 'polygon':
      cssClipPath = interpolatePolygonClipPath(morphT);
      break;
    case 'circle': {
      const r = (42 + morphT * 6).toFixed(1);
      cssClipPath = `circle(${r}% at 50% 50%)`;
      break;
    }
    case 'ellipse': {
      const rx = (46 - morphT * 8).toFixed(1);
      const ry = (38 + morphT * 10).toFixed(1);
      cssClipPath = `ellipse(${rx}% ${ry}% at 50% 50%)`;
      break;
    }
    case 'inset': {
      const pad = (3 + morphT * 5).toFixed(1);
      cssClipPath = `inset(${pad}% ${pad}% ${pad}% ${pad}% round 14px)`;
      break;
    }
    case 'path':
      cssClipPath = `path('M 12 0 L 288 0 L 300 24 L 300 276 L 288 300 L 12 300 L 0 276 L 0 24 Z')`;
      break;
  }

  return {
    kind,
    cssClipPath,
    interpolatedFrom: kind === 'polygon' ? 'HEXAGON->DIAMOND' : undefined,
    interpolationT: +morphT.toFixed(3),
    disclaimer: 'CSS_VIEWPORT_MASK_NOT_PIXEL_BUFFER_TRANSFORM',
  };
}
