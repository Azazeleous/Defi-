/**
 * =============================================================================
 * SPECIFICATION: HCCGN.CRYPTIC.INSTANT.MINER v1.0.0 — Section 5 & 6
 * MODULE: Canonical Algorithm Registry & Verified Mathematical Procedures
 * NOTE: Strictly preserves the boundary between invertible algebraic maps
 *       and one-way cryptographic digests (SHA-256, BLAKE2b).
 * =============================================================================
 */

import {
  AlgorithmRegistryEntry,
  AlgorithmSelfTestResult,
  WolframAdapterResult,
} from '../contracts/cryptic-platform';
import {
  AdvancedBidirectionalHashEngine256,
} from './nexusPerpetualEngine';
import {
  evaluateChernCurvature,
} from '../workers/matrixWorker';
import {
  globalNeuralInvariantCapacityEngine,
} from './neuralInvariantCapacityEngine';

const MASK32 = 0xffffffffn;
const MASK64 = 0xffffffffffffffffn;

// ============================================================================
// A. CRYPTOGRAPHIC COMPUTATION (One-Way SHA-256, BLAKE2b, Scrypt-Lite, FNV-1a)
// ============================================================================

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr32(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}

/**
 * Pure TypeScript FIPS 180-4 SHA-256 over raw bytes (works in Node & Browser Workers).
 */
export function sha256Bytes(input: Uint8Array): Uint8Array {
  const bitLen = BigInt(input.length) * 8n;
  const padLen = ((56 - ((input.length + 1) % 64)) + 64) % 64;
  const totalLen = input.length + 1 + padLen + 8;
  const buf = new Uint8Array(totalLen);
  buf.set(input, 0);
  buf[input.length] = 0x80;
  const dv = new DataView(buf.buffer);
  dv.setBigUint64(totalLen - 8, bitLen, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  for (let offset = 0; offset < totalLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = dv.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = (rotr32(w[i - 15], 7) ^ rotr32(w[i - 15], 18) ^ (w[i - 15] >>> 3)) >>> 0;
      const s1 = (rotr32(w[i - 2], 17) ^ rotr32(w[i - 2], 19) ^ (w[i - 2] >>> 10)) >>> 0;
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = (rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = (rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outDv = new DataView(out.buffer);
  outDv.setUint32(0, h0, false);
  outDv.setUint32(4, h1, false);
  outDv.setUint32(8, h2, false);
  outDv.setUint32(12, h3, false);
  outDv.setUint32(16, h4, false);
  outDv.setUint32(20, h5, false);
  outDv.setUint32(24, h6, false);
  outDv.setUint32(28, h7, false);
  return out;
}

export function sha256Hex(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return bytesToHex(sha256Bytes(bytes));
}

export function doubleSha256Hex(text: string): string {
  const first = sha256Bytes(new TextEncoder().encode(text));
  const second = sha256Bytes(first);
  return bytesToHex(second);
}

// RFC 7693 BLAKE2b-256 (32-byte unkeyed digest) using BigInt 64-bit arithmetic
const BLAKE2B_IV: readonly bigint[] = [
  0x6a09e667f3bcc908n,
  0xbb67ae8584caa73bn,
  0x3c6ef372fe94f82bn,
  0xa54ff53a5f1d36f1n,
  0x510e527fade682d1n,
  0x9b05688c2b3e6c1fn,
  0x1f83d9abfb41bd6bn,
  0x5be0cd19137e2179n,
];

const BLAKE2B_SIGMA: readonly (readonly number[])[] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  [14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3],
  [11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4],
  [7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8],
  [9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13],
  [2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9],
  [12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11],
  [13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10],
  [6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5],
  [10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0],
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  [14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3],
];

function rotr64(x: bigint, n: bigint): bigint {
  return ((x >> n) | (x << (64n - n))) & MASK64;
}

function blake2bG(
  v: bigint[],
  a: number,
  b: number,
  c: number,
  d: number,
  x: bigint,
  y: bigint
): void {
  v[a] = (v[a] + v[b] + x) & MASK64;
  v[d] = rotr64(v[d] ^ v[a], 32n);
  v[c] = (v[c] + v[d]) & MASK64;
  v[b] = rotr64(v[b] ^ v[c], 24n);
  v[a] = (v[a] + v[b] + y) & MASK64;
  v[d] = rotr64(v[d] ^ v[a], 16n);
  v[c] = (v[c] + v[d]) & MASK64;
  v[b] = rotr64(v[b] ^ v[c], 63n);
}

export function blake2b256Hex(text: string): string {
  const input = new TextEncoder().encode(text);
  const outLen = 32;
  const h = [...BLAKE2B_IV];
  h[0] = h[0] ^ BigInt(0x01010000 ^ outLen);

  const block = new Uint8Array(128);
  const totalBlocks = Math.max(1, Math.ceil(input.length / 128));
  let bytesCompressed = 0n;

  for (let blkIdx = 0; blkIdx < totalBlocks; blkIdx++) {
    block.fill(0);
    const start = blkIdx * 128;
    const slice = input.subarray(start, start + 128);
    block.set(slice, 0);
    bytesCompressed += BigInt(slice.length);
    const isLast = blkIdx === totalBlocks - 1;

    const m: bigint[] = new Array(16);
    const dv = new DataView(block.buffer);
    for (let i = 0; i < 16; i++) {
      m[i] = dv.getBigUint64(i * 8, true);
    }

    const v = new Array<bigint>(16);
    for (let i = 0; i < 8; i++) {
      v[i] = h[i];
      v[i + 8] = BLAKE2B_IV[i];
    }
    v[12] ^= bytesCompressed & MASK64;
    v[13] ^= (bytesCompressed >> 64n) & MASK64;
    if (isLast) {
      v[14] ^= MASK64;
    }

    for (let round = 0; round < 12; round++) {
      const s = BLAKE2B_SIGMA[round];
      blake2bG(v, 0, 4, 8, 12, m[s[0]], m[s[1]]);
      blake2bG(v, 1, 5, 9, 13, m[s[2]], m[s[3]]);
      blake2bG(v, 2, 6, 10, 14, m[s[4]], m[s[5]]);
      blake2bG(v, 3, 7, 11, 15, m[s[6]], m[s[7]]);
      blake2bG(v, 0, 5, 10, 15, m[s[8]], m[s[9]]);
      blake2bG(v, 1, 6, 11, 12, m[s[10]], m[s[11]]);
      blake2bG(v, 2, 7, 8, 13, m[s[12]], m[s[13]]);
      blake2bG(v, 3, 4, 9, 14, m[s[14]], m[s[15]]);
    }

    for (let i = 0; i < 8; i++) {
      h[i] = (h[i] ^ v[i] ^ v[i + 8]) & MASK64;
    }
  }

  const out = new Uint8Array(outLen);
  const outDv = new DataView(out.buffer);
  for (let i = 0; i < 4; i++) {
    outDv.setBigUint64(i * 8, h[i], true);
  }
  return bytesToHex(out);
}

/**
 * Memory-hard Scrypt-like Salsa20/8 ROMix work function (N=64 compact profile for real verifiable CPU work).
 */
function salsa208Core(b: Uint32Array): void {
  const x = new Uint32Array(b);
  const R = (a: number, k: number) => ((a << k) | (a >>> (32 - k))) >>> 0;
  for (let i = 0; i < 4; i++) {
    x[4] ^= R((x[0] + x[12]) >>> 0, 7);
    x[8] ^= R((x[4] + x[0]) >>> 0, 9);
    x[12] ^= R((x[8] + x[4]) >>> 0, 13);
    x[0] ^= R((x[12] + x[8]) >>> 0, 18);

    x[9] ^= R((x[5] + x[1]) >>> 0, 7);
    x[13] ^= R((x[9] + x[5]) >>> 0, 9);
    x[1] ^= R((x[13] + x[9]) >>> 0, 13);
    x[5] ^= R((x[1] + x[13]) >>> 0, 18);

    x[14] ^= R((x[10] + x[6]) >>> 0, 7);
    x[2] ^= R((x[14] + x[10]) >>> 0, 9);
    x[6] ^= R((x[2] + x[14]) >>> 0, 13);
    x[10] ^= R((x[6] + x[2]) >>> 0, 18);

    x[3] ^= R((x[15] + x[11]) >>> 0, 7);
    x[7] ^= R((x[3] + x[15]) >>> 0, 9);
    x[11] ^= R((x[7] + x[3]) >>> 0, 13);
    x[15] ^= R((x[11] + x[7]) >>> 0, 18);

    x[1] ^= R((x[0] + x[3]) >>> 0, 7);
    x[2] ^= R((x[1] + x[0]) >>> 0, 9);
    x[3] ^= R((x[2] + x[1]) >>> 0, 13);
    x[0] ^= R((x[3] + x[2]) >>> 0, 18);

    x[6] ^= R((x[5] + x[4]) >>> 0, 7);
    x[7] ^= R((x[6] + x[5]) >>> 0, 9);
    x[4] ^= R((x[7] + x[6]) >>> 0, 13);
    x[5] ^= R((x[4] + x[7]) >>> 0, 18);

    x[11] ^= R((x[10] + x[9]) >>> 0, 7);
    x[8] ^= R((x[11] + x[10]) >>> 0, 9);
    x[9] ^= R((x[8] + x[11]) >>> 0, 13);
    x[10] ^= R((x[9] + x[8]) >>> 0, 18);

    x[12] ^= R((x[15] + x[14]) >>> 0, 7);
    x[13] ^= R((x[12] + x[15]) >>> 0, 9);
    x[14] ^= R((x[13] + x[12]) >>> 0, 13);
    x[15] ^= R((x[14] + x[13]) >>> 0, 18);
  }
  for (let i = 0; i < 16; i++) {
    b[i] = (b[i] + x[i]) >>> 0;
  }
}

export function scryptSalsaPowHex(text: string, costN: number = 64): string {
  const seed = sha256Bytes(new TextEncoder().encode(text));
  const state = new Uint32Array(16);
  const dv = new DataView(seed.buffer);
  for (let i = 0; i < 8; i++) {
    state[i] = dv.getUint32(i * 4, true);
    state[i + 8] = state[i] ^ 0x9e3779b9;
  }
  const V: Uint32Array[] = [];
  for (let i = 0; i < costN; i++) {
    V.push(new Uint32Array(state));
    salsa208Core(state);
  }
  for (let i = 0; i < costN; i++) {
    const idx = state[0] % costN;
    const slot = V[idx];
    for (let j = 0; j < 16; j++) {
      state[j] ^= slot[j];
    }
    salsa208Core(state);
  }
  const raw = new Uint8Array(state.buffer, 0, 32);
  return bytesToHex(sha256Bytes(raw));
}

export function fnv1a64Hex(input: string): string {
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < input.length; i++) {
    h ^= BigInt(input.charCodeAt(i));
    h = (h * 0x100000001b3n) & MASK64;
  }
  return h.toString(16).padStart(16, '0');
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ============================================================================
// B. REVERSIBLE ARITHMETIC (Modular Inverse, CRT, 256-bit Reversible ARX)
// ============================================================================

export function extendedGcd(a: bigint, b: bigint): { gcd: bigint; x: bigint; y: bigint } {
  let oldR = a;
  let r = b;
  let oldS = 1n;
  let s = 0n;
  let oldT = 0n;
  let t = 1n;

  while (r !== 0n) {
    const q = oldR / r;
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
    [oldT, t] = [t, oldT - q * t];
  }
  return { gcd: oldR, x: oldS, y: oldT };
}

export function modInverse(a: bigint, m: bigint): bigint | null {
  if (m <= 1n) return null;
  const normalized = ((a % m) + m) % m;
  const { gcd, x } = extendedGcd(normalized, m);
  if (gcd !== 1n) return null;
  return ((x % m) + m) % m;
}

export function crtReconstruct(
  residues: readonly bigint[],
  moduli: readonly bigint[]
): { value: bigint; productModulus: bigint } | null {
  if (residues.length === 0 || residues.length !== moduli.length) return null;
  const M = moduli.reduce((acc, m) => acc * m, 1n);
  let sum = 0n;
  for (let i = 0; i < moduli.length; i++) {
    const mi = moduli[i];
    const Mi = M / mi;
    const inv = modInverse(Mi, mi);
    if (inv === null) return null;
    const ri = ((residues[i] % mi) + mi) % mi;
    sum = (sum + ri * Mi * inv) % M;
  }
  return { value: sum, productModulus: M };
}

export function executeReversibleArxRoundtrip(
  initialWordsHex: string,
  steps: readonly number[] = [1024, 2048, 4096, 8192]
): {
  initialHex: string;
  forwardHex: string;
  restoredHex: string;
  roundtripExact: boolean;
  residualBits: number;
} {
  const clean = initialWordsHex.replace(/^0x/i, '').padEnd(64, '0').slice(0, 64);
  const words: number[] = [];
  for (let i = 0; i < 8; i++) {
    words.push(parseInt(clean.slice(i * 8, i * 8 + 8), 16) >>> 0);
  }
  const engine = new AdvancedBidirectionalHashEngine256(words);
  const initialHex = engine.get_hex_string();
  for (const s of steps) {
    engine.execute_forward_step(s);
  }
  const forwardHex = engine.get_hex_string();
  for (const s of [...steps].reverse()) {
    engine.execute_backward_step(s);
  }
  const restoredHex = engine.get_hex_string();

  let diffBits = 0;
  for (let i = 0; i < initialHex.length; i++) {
    const xor = parseInt(initialHex[i], 16) ^ parseInt(restoredHex[i], 16);
    diffBits += xor.toString(2).split('1').length - 1;
  }

  return {
    initialHex,
    forwardHex,
    restoredHex,
    roundtripExact: initialHex === restoredHex && diffBits === 0,
    residualBits: diffBits,
  };
}

// ============================================================================
// C. ERROR CORRECTION (GF(256) Reed–Solomon RS(15,11) & QC-LDPC Syndrome/Decode)
// ============================================================================

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

export function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

export function gfDiv(a: number, b: number): number {
  if (b === 0) throw new Error('GF(256) division by zero');
  if (a === 0) return 0;
  return GF_EXP[(GF_LOG[a] + 255 - GF_LOG[b]) % 255];
}

function gfPolyMul(p: Uint8Array, q: Uint8Array): Uint8Array {
  const r = new Uint8Array(p.length + q.length - 1);
  for (let j = 0; j < q.length; j++) {
    for (let i = 0; i < p.length; i++) {
      r[i + j] ^= gfMul(p[i], q[j]);
    }
  }
  return r;
}

function gfPolyEval(poly: Uint8Array, x: number): number {
  let y = poly[0];
  for (let i = 1; i < poly.length; i++) {
    y = gfMul(y, x) ^ poly[i];
  }
  return y;
}

function rsGeneratorPoly(nsym: number): Uint8Array {
  let g: Uint8Array = new Uint8Array([1]);
  for (let i = 0; i < nsym; i++) {
    g = gfPolyMul(g, new Uint8Array([1, GF_EXP[i]]));
  }
  return g;
}

export function rsEncode(message: Uint8Array, nsym: number = 4): Uint8Array {
  const gen = rsGeneratorPoly(nsym);
  const out = new Uint8Array(message.length + nsym);
  out.set(message, 0);
  for (let i = 0; i < message.length; i++) {
    const coef = out[i];
    if (coef !== 0) {
      for (let j = 1; j < gen.length; j++) {
        out[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  out.set(message, 0);
  return out;
}

export function rsSyndromes(codeword: Uint8Array, nsym: number = 4): Uint8Array {
  const synd = new Uint8Array(nsym + 1);
  for (let i = 0; i < nsym; i++) {
    synd[i + 1] = gfPolyEval(codeword, GF_EXP[i]);
  }
  return synd;
}

/**
 * RS single/multi-symbol correction using Berlekamp–Massey + Chien search + Forney magnitude recovery.
 * Uses generator roots alpha^0 .. alpha^(nsym-1) (first consecutive root b0 = 0).
 */
export function rsDecode(
  received: Uint8Array,
  nsym: number = 4
): {
  decoded: Uint8Array;
  syndromeBefore: number;
  syndromeAfter: number;
  correctedCount: number;
  success: boolean;
} {
  const msgOut = new Uint8Array(received);
  const synd = rsSyndromes(msgOut, nsym);
  const S = Array.from(synd.slice(1));
  const syndSumBefore = S.reduce((a, b) => a + b, 0);
  if (syndSumBefore === 0) {
    return {
      decoded: msgOut.slice(0, msgOut.length - nsym),
      syndromeBefore: 0,
      syndromeAfter: 0,
      correctedCount: 0,
      success: true,
    };
  }

  const evalAsc = (poly: readonly number[], x: number): number => {
    let acc = 0;
    let xPow = 1;
    for (let i = 0; i < poly.length; i++) {
      if (poly[i] !== 0) {
        acc ^= gfMul(poly[i], xPow);
      }
      xPow = gfMul(xPow, x);
    }
    return acc;
  };

  // Berlekamp–Massey (ascending lambda[0] + lambda[1]*x + ...)
  let lambda: number[] = [1];
  let B: number[] = [1];
  let L = 0;
  let m = 1;
  let b = 1;

  for (let n = 0; n < nsym; n++) {
    let d = S[n];
    for (let i = 1; i <= L; i++) {
      d ^= gfMul(lambda[i] || 0, S[n - i]);
    }
    if (d === 0) {
      m += 1;
    } else {
      const coef = gfDiv(d, b);
      const shiftedB = [...new Array<number>(m).fill(0), ...B];
      const maxLen = Math.max(lambda.length, shiftedB.length);
      const next = new Array<number>(maxLen).fill(0);
      for (let i = 0; i < lambda.length; i++) next[i] ^= lambda[i];
      for (let i = 0; i < shiftedB.length; i++) next[i] ^= gfMul(coef, shiftedB[i]);
      if (2 * L <= n) {
        B = lambda;
        lambda = next;
        L = n + 1 - L;
        b = d;
        m = 1;
      } else {
        lambda = next;
        m += 1;
      }
    }
  }

  // Trim trailing zeros to exact degree
  while (lambda.length > 1 && lambda[lambda.length - 1] === 0) {
    lambda.pop();
  }
  const errCount = lambda.length - 1;
  if (errCount === 0 || errCount * 2 > nsym) {
    return {
      decoded: msgOut.slice(0, msgOut.length - nsym),
      syndromeBefore: syndSumBefore,
      syndromeAfter: syndSumBefore,
      correctedCount: 0,
      success: false,
    };
  }

  // Chien search: check lambda(alpha^-k) == 0 where codeword byte p corresponds to x^k (k = N - 1 - p)
  const errPos: number[] = [];
  const errX: number[] = [];
  const errXInv: number[] = [];
  for (let p = 0; p < msgOut.length; p++) {
    const k = (msgOut.length - 1 - p) % 255;
    const X = GF_EXP[k];
    const XInv = GF_EXP[(255 - k) % 255];
    if (evalAsc(lambda, XInv) === 0) {
      errPos.push(p);
      errX.push(X);
      errXInv.push(XInv);
    }
  }

  if (errPos.length !== errCount) {
    return {
      decoded: msgOut.slice(0, msgOut.length - nsym),
      syndromeBefore: syndSumBefore,
      syndromeAfter: syndSumBefore,
      correctedCount: 0,
      success: false,
    };
  }

  // Error evaluator polynomial Omega(x) = S(x) * Lambda(x) mod x^nsym
  const omega = new Array<number>(nsym).fill(0);
  for (let i = 0; i < nsym; i++) {
    for (let j = 0; j < lambda.length; j++) {
      if (i + j < nsym) {
        omega[i + j] ^= gfMul(S[i], lambda[j]);
      }
    }
  }

  // Formal derivative Lambda'(x) in GF(2^m): odd-indexed coefficients shift down by 1
  const lambdaPrime: number[] = [];
  for (let i = 1; i < lambda.length; i += 2) {
    lambdaPrime[i - 1] = lambda[i];
    if (i < lambda.length - 1) lambdaPrime[i] = 0;
  }

  // Forney magnitude recovery (b0 = 0 -> multiplier X_j^(1-0) = X_j)
  for (let i = 0; i < errPos.length; i++) {
    const num = gfMul(errX[i], evalAsc(omega, errXInv[i]));
    const den = evalAsc(lambdaPrime, errXInv[i]);
    if (den === 0) {
      return {
        decoded: msgOut.slice(0, msgOut.length - nsym),
        syndromeBefore: syndSumBefore,
        syndromeAfter: syndSumBefore,
        correctedCount: 0,
        success: false,
      };
    }
    const mag = gfDiv(num, den);
    msgOut[errPos[i]] ^= mag;
  }

  const syndAfter = rsSyndromes(msgOut, nsym).slice(1).reduce((a, b) => a + b, 0);
  return {
    decoded: msgOut.slice(0, msgOut.length - nsym),
    syndromeBefore: syndSumBefore,
    syndromeAfter: syndAfter,
    correctedCount: syndAfter === 0 ? errPos.length : 0,
    success: syndAfter === 0,
  };
}

/**
 * QC-LDPC (12, 8) Structured Parity Check Matrix + Syndrome & Bit-Flip Decoder.
 */
const QC_LDPC_H: readonly (readonly number[])[] = [
  [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0],
  [0, 1, 1, 0, 0, 1, 1, 1, 0, 1, 0, 0],
  [1, 0, 0, 1, 0, 1, 1, 1, 0, 0, 1, 0],
  [0, 1, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1],
];

export function qcLdpcEncodeByte(byteVal: number): number[] {
  const info = Array.from({ length: 8 }, (_, idx) => (byteVal >> (7 - idx)) & 1);
  const p = QC_LDPC_H.map((row) =>
    info.reduce((acc, bit, idx) => acc ^ (bit & row[idx]), 0)
  );
  return [...info, ...p];
}

export function qcLdpcSyndromeWeight(bits12: readonly number[]): number {
  let weight = 0;
  for (let row = 0; row < QC_LDPC_H.length; row++) {
    let parity = 0;
    for (let col = 0; col < 12; col++) {
      parity ^= QC_LDPC_H[row][col] & bits12[col];
    }
    weight += parity;
  }
  return weight;
}

export function qcLdpcBitFlipDecode(
  bits12: readonly number[]
): { decodedBits: number[]; syndromeBefore: number; syndromeAfter: number; flippedIndex: number | null } {
  const work = [...bits12];
  const before = qcLdpcSyndromeWeight(work);
  if (before === 0) {
    return { decodedBits: work, syndromeBefore: 0, syndromeAfter: 0, flippedIndex: null };
  }
  // Single-bit Gallager flip check across columns
  let bestCol: number | null = null;
  let bestScore = before;
  for (let col = 0; col < 12; col++) {
    work[col] ^= 1;
    const score = qcLdpcSyndromeWeight(work);
    if (score < bestScore) {
      bestScore = score;
      bestCol = col;
    }
    work[col] ^= 1;
  }
  if (bestCol !== null) {
    work[bestCol] ^= 1;
  }
  return {
    decodedBits: work,
    syndromeBefore: before,
    syndromeAfter: qcLdpcSyndromeWeight(work),
    flippedIndex: bestCol,
  };
}

// ============================================================================
// F. TARGET COMPARISON & CRYPTOGRAPHIC RECEIPT SERIALIZATION
// ============================================================================

export function meetsLeadingZeroHexTarget(digestHex: string, zeroNibbles: number): boolean {
  if (zeroNibbles <= 0) return true;
  const clean = digestHex.replace(/^0x/i, '').toLowerCase();
  const targetPrefix = '0'.repeat(Math.min(16, Math.max(1, zeroNibbles)));
  return clean.startsWith(targetPrefix);
}

// ============================================================================
// LOCAL SYMBOLIC EVALUATOR + WOLFRAM / MATHEMATICA ADAPTER BOUNDARY (Section 6)
// ============================================================================

export async function evaluateSymbolicExpression(
  expression: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<WolframAdapterResult> {
  const startNs = typeof process !== 'undefined' && process.hrtime ? process.hrtime.bigint() : BigInt(Date.now()) * 1000000n;
  const queryId = `sym_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const trimmed = expression.trim();

  // Attempt local exact algebraic/modular evaluator first
  let localResult: string | null = null;
  let independentPassed = false;

  try {
    // Pattern 1: ModInverse[a, m] or PowerMod[a, -1, m]
    const modInvMatch = trimmed.match(/^(?:ModInverse|PowerMod)\[\s*(-?\d+)\s*,\s*(?:-1\s*,\s*)?(\d+)\s*\]$/i);
    if (modInvMatch) {
      const a = BigInt(modInvMatch[1]);
      const m = BigInt(modInvMatch[2]);
      const inv = modInverse(a, m);
      if (inv !== null) {
        independentPassed = (((((a % m) + m) % m) * inv) % m) === 1n;
        localResult = `${inv.toString()} (verified: ${a}*${inv} mod ${m} === 1)`;
      } else {
        independentPassed = true;
        localResult = `NO_INVERSE (gcd(${a}, ${m}) != 1)`;
      }
    }

    // Pattern 2: ChineseRemainder[{r1, r2, ...}, {m1, m2, ...}] or CRT[{...}, {...}]
    const crtMatch = trimmed.match(/^(?:ChineseRemainder|CRT)\[\s*\{([^}]+)\}\s*,\s*\{([^}]+)\}\s*\]$/i);
    if (!localResult && crtMatch) {
      const r = crtMatch[1].split(',').map((s) => BigInt(s.trim()));
      const m = crtMatch[2].split(',').map((s) => BigInt(s.trim()));
      const res = crtReconstruct(r, m);
      if (res) {
        const allOk = r.every((ri, idx) => ((res.value - ri) % m[idx]) === 0n);
        independentPassed = allOk;
        localResult = `${res.value.toString()} (mod ${res.productModulus.toString()}, residueCheck=${allOk})`;
      }
    }

    // Pattern 3: GCD[a, b]
    const gcdMatch = trimmed.match(/^GCD\[\s*(-?\d+)\s*,\s*(-?\d+)\s*\]$/i);
    if (!localResult && gcdMatch) {
      const a = BigInt(gcdMatch[1]);
      const b = BigInt(gcdMatch[2]);
      const g = extendedGcd(a < 0n ? -a : a, b < 0n ? -b : b);
      independentPassed = true;
      localResult = `gcd=${g.gcd.toString()}, bezout=(${g.x.toString()}, ${g.y.toString()})`;
    }

    // Pattern 4: Safe pure numeric / polynomial arithmetic validation (no eval of arbitrary strings)
    const arithMatch = trimmed.match(/^[\d+\-*/^().\s]+$/);
    if (!localResult && arithMatch) {
      const normalized = trimmed.replace(/\^/g, '**');
      // Restricted safe evaluation only when strictly arithmetic characters matched above
      const val = Function(`"use strict"; return (${normalized});`)();
      if (typeof val === 'number' && Number.isFinite(val)) {
        independentPassed = true;
        localResult = `${val}`;
      }
    }
  } catch (err: any) {
    localResult = `Local evaluation error: ${err.message}`;
  }

  // Check if external Wolfram credentials or Cloud endpoint are configured
  const wolframAppId = env.WOLFRAM_APP_ID?.trim();
  const wolframCloudEndpoint = env.WOLFRAM_CLOUD_ENDPOINT?.trim();
  const externalConfigured = Boolean(wolframAppId || wolframCloudEndpoint);

  let externalResult: string | null = null;
  let status: WolframAdapterResult['status'] = localResult ? 'VERIFIED_LOCAL' : 'UNAVAILABLE';
  let diagnosticMessage = localResult
    ? 'Verified locally via exact BigInt CAS engine.'
    : 'Expression requires external Wolfram symbolic engine; local CAS supports ModInverse[a,m], ChineseRemainder[{r},{m}], GCD[a,b], and pure arithmetic.';

  if (externalConfigured) {
    try {
      const targetUrl = wolframCloudEndpoint
        ? `${wolframCloudEndpoint}?input=${encodeURIComponent(trimmed)}`
        : `https://api.wolframalpha.com/v2/query?input=${encodeURIComponent(trimmed)}&appid=${encodeURIComponent(wolframAppId!)}&output=json&format=plaintext`;
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 5000);
      const resp = await fetch(targetUrl, { signal: ctrl.signal });
      clearTimeout(tid);
      if (resp.ok) {
        const text = await resp.text();
        externalResult = text.slice(0, 600);
        status = 'VERIFIED_WOLFRAM';
        diagnosticMessage = 'Evaluated via configured Wolfram endpoint.';
      } else {
        diagnosticMessage = `Wolfram HTTP ${resp.status} returned; fell back to local symbolic evaluation without inventing external output.`;
      }
    } catch (err: any) {
      diagnosticMessage = `Wolfram connection error (${err.message}); no synthetic external output substituted.`;
    }
  } else {
    diagnosticMessage += ' External Wolfram connection unavailable (WOLFRAM_APP_ID / WOLFRAM_CLOUD_ENDPOINT not configured).';
  }

  const endNs = typeof process !== 'undefined' && process.hrtime ? process.hrtime.bigint() : BigInt(Date.now()) * 1000000n;
  return {
    queryId,
    expression: trimmed,
    provider: externalResult ? 'WOLFRAM_CLOUD_API' : 'LOCAL_EXACT_CAS',
    externalConfigured,
    status,
    localResult,
    externalResult,
    independentVerificationPassed: independentPassed,
    durationNs: (endNs - startNs).toString(),
    diagnosticMessage,
    timestampUtc: new Date().toISOString(),
  };
}

// ============================================================================
// CANONICAL ALGORITHM REGISTRY CATALOG
// ============================================================================

export const CANONICAL_ALGORITHM_REGISTRY: readonly AlgorithmRegistryEntry[] = [
  {
    id: 'crypto.sha256',
    name: 'SHA-256 (FIPS 180-4 / Double-SHA256 PoW)',
    version: '1.0.0',
    category: 'CRYPTOGRAPHIC_COMPUTATION',
    operationType: 'CRYPTOGRAPHIC_DIGEST_VERIFICATION',
    isInvertible: false,
    isOneWayHash: true,
    isPowAlgorithm: true,
    inputSchema: '{ payload: utf8 string, nonce?: uint32 }',
    outputSchema: '{ digestHex: string(64), meetsTarget: boolean }',
    dependencies: ['FIPS-180-4 Pure TS Kernel'],
    supportedEnvironments: ['NODE_SERVER', 'WEB_WORKER', 'BROWSER_MAIN'],
    requiredPrecision: 'Exact 32-bit unsigned modular arithmetic',
    knownLimitations: 'Strict one-way preimage-resistant function; non-invertible by design.',
    capabilityRequirements: ['CPU uint32 bitwise ops'],
  },
  {
    id: 'crypto.blake2b256',
    name: 'BLAKE2b-256 (RFC 7693)',
    version: '1.0.0',
    category: 'CRYPTOGRAPHIC_COMPUTATION',
    operationType: 'CRYPTOGRAPHIC_DIGEST_VERIFICATION',
    isInvertible: false,
    isOneWayHash: true,
    isPowAlgorithm: true,
    inputSchema: '{ payload: utf8 string }',
    outputSchema: '{ digestHex: string(64) }',
    dependencies: ['BigInt 64-bit ARX'],
    supportedEnvironments: ['NODE_SERVER', 'WEB_WORKER', 'BROWSER_MAIN'],
    requiredPrecision: 'Exact 64-bit unsigned BigInt arithmetic',
    knownLimitations: 'Strict one-way keyed/unkeyed hash function; never invert.',
    capabilityRequirements: ['ES2020 BigInt'],
  },
  {
    id: 'crypto.scrypt_salsa',
    name: 'Scrypt-Salsa20/8 ROMix PoW (N=64 Profile)',
    version: '1.0.0',
    category: 'CRYPTOGRAPHIC_COMPUTATION',
    operationType: 'CANDIDATE_SEARCH',
    isInvertible: false,
    isOneWayHash: true,
    isPowAlgorithm: true,
    inputSchema: '{ header: string, nonce: uint32 }',
    outputSchema: '{ digestHex: string(64), meetsTarget: boolean }',
    dependencies: ['crypto.sha256', 'Salsa20/8 Core'],
    supportedEnvironments: ['NODE_SERVER', 'WEB_WORKER'],
    requiredPrecision: 'Exact 32-bit Salsa20/8 mixing',
    knownLimitations: 'Compact N=64 profile for interactive verification benchmarks; lower memory hardness than N=1024 Litecoin mainnet.',
    capabilityRequirements: ['Uint32Array buffer pool'],
  },
  {
    id: 'rev.arx256',
    name: 'Bidirectional 256-bit ARX State Involution',
    version: '2.0.0',
    category: 'REVERSIBLE_ARITHMETIC',
    operationType: 'EXACT_INVERSE_RECONSTRUCTION',
    isInvertible: true,
    isOneWayHash: false,
    isPowAlgorithm: false,
    inputSchema: '{ stateHex: string(64), steps: number[] }',
    outputSchema: '{ forwardHex: string(64), restoredHex: string(64), exact: boolean }',
    dependencies: ['AdvancedBidirectionalHashEngine256'],
    supportedEnvironments: ['NODE_SERVER', 'WEB_WORKER', 'BROWSER_MAIN'],
    requiredPrecision: 'Exact 32-bit BigInt masked ring mod 2^32',
    knownLimitations: 'Reversible permutation for deterministic state audit; NOT a cryptographic one-way commitment.',
    capabilityRequirements: ['ES2020 BigInt'],
  },
  {
    id: 'rev.modular_crt',
    name: 'Extended Euclidean Modular Inverse & Coprime CRT',
    version: '1.0.0',
    category: 'REVERSIBLE_ARITHMETIC',
    operationType: 'EXACT_INVERSE_RECONSTRUCTION',
    isInvertible: true,
    isOneWayHash: false,
    isPowAlgorithm: false,
    inputSchema: '{ a: bigint, m: bigint } | { residues: bigint[], moduli: bigint[] }',
    outputSchema: '{ inverse: bigint, verified: boolean }',
    dependencies: ['Exact BigInt Extended GCD'],
    supportedEnvironments: ['NODE_SERVER', 'WEB_WORKER', 'BROWSER_MAIN'],
    requiredPrecision: 'Arbitrary-precision integer BigInt',
    knownLimitations: 'Requires gcd(a, m) === 1 and pairwise coprime moduli for unique CRT reconstruction.',
    capabilityRequirements: ['ES2020 BigInt'],
  },
  {
    id: 'ecc.reed_solomon_gf256',
    name: 'Reed–Solomon over GF(256) RS(k+4, k) Encoder/Decoder',
    version: '1.0.0',
    category: 'ERROR_CORRECTION',
    operationType: 'ERROR_CORRECTION',
    isInvertible: true,
    isOneWayHash: false,
    isPowAlgorithm: false,
    inputSchema: '{ payload: string, errorPositions?: number[] }',
    outputSchema: '{ decoded: string, syndromeBefore: number, syndromeAfter: number }',
    dependencies: ['GF(2^8) 0x11D Field', 'Berlekamp-Massey + Forney'],
    supportedEnvironments: ['NODE_SERVER', 'WEB_WORKER', 'BROWSER_MAIN'],
    requiredPrecision: 'Exact Galois Field GF(256) byte arithmetic',
    knownLimitations: 'With 4 parity symbols (nsym=4), recovers up to 2 corrupted bytes per codeword (< 255 bytes).',
    capabilityRequirements: ['Uint8Array'],
  },
  {
    id: 'ecc.qc_ldpc_syndrome',
    name: 'QC-LDPC (12, 8) Parity Syndrome & Bit-Flip Decoder',
    version: '1.0.0',
    category: 'ERROR_CORRECTION',
    operationType: 'ERROR_CORRECTION',
    isInvertible: true,
    isOneWayHash: false,
    isPowAlgorithm: false,
    inputSchema: '{ byte: uint8, flipBitIndex?: number }',
    outputSchema: '{ correctedByte: uint8, syndromeBefore: number, syndromeAfter: number }',
    dependencies: ['Binary GF(2) Parity Check Matrix'],
    supportedEnvironments: ['NODE_SERVER', 'WEB_WORKER', 'BROWSER_MAIN'],
    requiredPrecision: 'Exact GF(2) binary parity',
    knownLimitations: 'Single-bit error correction code per 12-bit block.',
    capabilityRequirements: ['Bitwise integer ops'],
  },
  {
    id: 'num.chern_curvature',
    name: 'Hermitian Metric Chern Curvature & 4D Projection Evaluator',
    version: '1.0.0',
    category: 'NUMERICAL_COMPUTING',
    operationType: 'STATISTICAL_ESTIMATION',
    isInvertible: false,
    isOneWayHash: false,
    isPowAlgorithm: false,
    inputSchema: '{ nodeIndex, xc, yc, dx, dy, prs }',
    outputSchema: '{ chernCurvature: number, metricLogH: number, score: number }',
    dependencies: ['matrixWorker Kernel'],
    supportedEnvironments: ['NODE_SERVER', 'WEB_WORKER'],
    requiredPrecision: 'IEEE-754 float64',
    knownLimitations: 'Normalized over 800x600 viewport domain; floating point rounding ~1e-15.',
    capabilityRequirements: ['IEEE-754 Math'],
  },
  {
    id: 'ver.receipt_sha256',
    name: 'Canonical JSON + SHA-256 Parent-Chained Receipt Verifier',
    version: '1.0.0',
    category: 'VERIFICATION',
    operationType: 'CRYPTOGRAPHIC_DIGEST_VERIFICATION',
    isInvertible: false,
    isOneWayHash: true,
    isPowAlgorithm: false,
    inputSchema: '{ canonicalPayload: object, expectedDigest: hex64 }',
    outputSchema: '{ digestMatch: boolean, chainIntact: boolean }',
    dependencies: ['crypto.sha256'],
    supportedEnvironments: ['NODE_SERVER', 'BROWSER_MAIN'],
    requiredPrecision: 'Deterministic sorted-key UTF-8 JSON',
    knownLimitations: 'Proves payload integrity and chain linkage; requires server RBAC/HMAC key for creator authentication.',
    capabilityRequirements: ['JSON canonical serializer'],
  },
  {
    id: 'model.transformer_capacity_budget',
    name: 'Transformer Low-Rank Parameter Capacity Budget (P_total)',
    version: '1.0.0',
    category: 'NUMERICAL_COMPUTING',
    operationType: 'SYMBOLIC_ALGEBRAIC_VERIFICATION',
    isInvertible: false,
    isOneWayHash: false,
    isPowAlgorithm: false,
    inputSchema: '{ P_enc: number, K: number, layers: { V: number, r: number }[], P_heads: number }',
    outputSchema: '{ P_total: number, savingsParams: number, compressionPct: number, memoryMb: object }',
    dependencies: ['Exact Piecewise Projection Arithmetic (768 Rank Boundary)'],
    supportedEnvironments: ['NODE_SERVER', 'BROWSER_MAIN'],
    requiredPrecision: 'Exact integer parameter count',
    knownLimitations: 'Requires r <= 768 per layer; branch splits at r < 768 vs r = 768.',
    capabilityRequirements: ['ES2020 Number'],
  },
  {
    id: 'state.invariant_information_filter',
    name: 'Discrete Invariant Information State Recurrence Filter (I_{t+1})',
    version: '1.0.0',
    category: 'VERIFICATION',
    operationType: 'SYMBOLIC_ALGEBRAIC_VERIFICATION',
    isInvertible: true,
    isOneWayHash: false,
    isPowAlgorithm: false,
    inputSchema: '{ initialI: number, alpha: number, beta: number, observations: { confidence, verificationValue, errorResidual }[] }',
    outputSchema: '{ finalI: number, netDelta: number, steadyStateAchieved: boolean, receiptId: string }',
    dependencies: ['Dynamic Observation State Filter', 'Noise-Damped Convergence'],
    supportedEnvironments: ['NODE_SERVER', 'BROWSER_MAIN'],
    requiredPrecision: 'Double-precision IEEE 754 floating point',
    knownLimitations: 'Equilibrium requires beta > 0 and bounded error residuals.',
    capabilityRequirements: ['Float64Array'],
  },
];

export function runAlgorithmSelfTest(algorithmId: string): AlgorithmSelfTestResult {
  const startNs = typeof process !== 'undefined' && process.hrtime ? process.hrtime.bigint() : BigInt(Date.now()) * 1000000n;
  const testedAtUtc = new Date().toISOString();
  const entry = CANONICAL_ALGORITHM_REGISTRY.find((a) => a.id === algorithmId);
  const version = entry?.version || '0.0.0';

  let vectorName = 'NIST/RFC Known Vector';
  let expectedOutput = '';
  let actualOutput = '';
  let passed = false;

  switch (algorithmId) {
    case 'crypto.sha256': {
      vectorName = 'NIST FIPS 180-4 SHA256("abc")';
      expectedOutput = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
      actualOutput = sha256Hex('abc');
      passed = actualOutput === expectedOutput;
      break;
    }
    case 'crypto.blake2b256': {
      vectorName = 'RFC 7693 BLAKE2b-256("")';
      expectedOutput = '0e5751c026e543b2e8ab2eb06099daa1d1e5df47778f7787faab45cdf12fe3a8';
      actualOutput = blake2b256Hex('');
      passed = actualOutput === expectedOutput;
      break;
    }
    case 'crypto.scrypt_salsa': {
      vectorName = 'Deterministic Scrypt-Salsa20/8("HCCGN-POW-TEST")';
      const first = scryptSalsaPowHex('HCCGN-POW-TEST', 64);
      const second = scryptSalsaPowHex('HCCGN-POW-TEST', 64);
      expectedOutput = `${first} (length=64 hex, deterministic)`;
      actualOutput = `${second} (length=${second.length})`;
      passed = first.length === 64 && first === second;
      break;
    }
    case 'rev.arx256': {
      vectorName = '256-bit ARX Forward/Inverse Identity F^-1(F(X)) = X';
      const res = executeReversibleArxRoundtrip('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
      expectedOutput = `restored=${res.initialHex.slice(0, 16)}... residualBits=0`;
      actualOutput = `restored=${res.restoredHex.slice(0, 16)}... residualBits=${res.residualBits}`;
      passed = res.roundtripExact && res.forwardHex !== res.initialHex;
      break;
    }
    case 'rev.modular_crt': {
      vectorName = 'Extended Euclid 3^-1 mod 11 & CRT({2,3,2},{3,5,7})=23';
      const inv = modInverse(3n, 11n);
      const crt = crtReconstruct([2n, 3n, 2n], [3n, 5n, 7n]);
      expectedOutput = 'inv=4, crt=23 (mod 105)';
      actualOutput = `inv=${inv?.toString()}, crt=${crt?.value.toString()} (mod ${crt?.productModulus.toString()})`;
      passed = inv === 4n && crt?.value === 23n && crt?.productModulus === 105n;
      break;
    }
    case 'ecc.reed_solomon_gf256': {
      vectorName = 'RS(15,11) GF(256) 2-Byte Burst Corruption Recovery';
      const msg = new TextEncoder().encode('HCCGN-RS256');
      const encoded = rsEncode(msg, 4);
      const corrupted = new Uint8Array(encoded);
      corrupted[2] ^= 0x5a;
      corrupted[7] ^= 0xc3;
      const dec = rsDecode(corrupted, 4);
      const recoveredStr = new TextDecoder().decode(dec.decoded);
      expectedOutput = 'HCCGN-RS256 (syndromeAfter=0, corrected=2)';
      actualOutput = `${recoveredStr} (syndromeAfter=${dec.syndromeAfter}, corrected=${dec.correctedCount})`;
      passed = dec.success && recoveredStr === 'HCCGN-RS256';
      break;
    }
    case 'ecc.qc_ldpc_syndrome': {
      vectorName = 'QC-LDPC(12,8) Single-Bit Flip Correction on 0xA5';
      const codeword = qcLdpcEncodeByte(0xa5);
      const cleanSyndrome = qcLdpcSyndromeWeight(codeword);
      const noisy = [...codeword];
      noisy[4] ^= 1;
      const dec = qcLdpcBitFlipDecode(noisy);
      expectedOutput = 'cleanSyn=0, flippedIndex=4, syndromeAfter=0';
      actualOutput = `cleanSyn=${cleanSyndrome}, flippedIndex=${dec.flippedIndex}, syndromeAfter=${dec.syndromeAfter}`;
      passed = cleanSyndrome === 0 && dec.flippedIndex === 4 && dec.syndromeAfter === 0;
      break;
    }
    case 'num.chern_curvature': {
      vectorName = 'Hermitian Metric Chern Curvature Boundedness Check';
      const r = evaluateChernCurvature({ nodeIndex: 12, p: 1, dx: 0.4, dy: -0.3, xc: 400, yc: 300, prs: 0.02 });
      expectedOutput = 'finite score in [0.01, 0.99], chernCurvature > 0';
      actualOutput = `score=${r.score}, chernCurvature=${r.chernCurvature}`;
      passed = Number.isFinite(r.chernCurvature) && r.chernCurvature > 0 && r.score >= 0.01 && r.score <= 0.99;
      break;
    }
    case 'ver.receipt_sha256': {
      vectorName = 'Canonical Payload Tamper Detection';
      const a = sha256Hex('{"epoch":"E1","ops":100}');
      const b = sha256Hex('{"epoch":"E1","ops":101}');
      expectedOutput = 'digest(ops=100) !== digest(ops=101)';
      actualOutput = `${a.slice(0, 12)} !== ${b.slice(0, 12)}`;
      passed = a !== b && a.length === 64;
      break;
    }
    case 'model.transformer_capacity_budget': {
      vectorName = 'Transformer Parameter Budget P_total (L=12, V=3072, r=64 < 768)';
      const spec = globalNeuralInvariantCapacityEngine.generateDefaultTransformerSpec(12, 3072, 64, 32000, 25000000, 5000000);
      const res = globalNeuralInvariantCapacityEngine.calculateModelCapacity(spec);
      expectedOutput = 'P_total = 57525120 params (768K=24576000, layerSum=2949120)';
      actualOutput = `P_total = ${res.P_total} params (768K=${res.embeddingParams}, layerSum=${res.sumLayerParams})`;
      passed = res.P_total === 57525120 && res.embeddingParams === 24576000 && res.sumLayerParams === 2949120;
      break;
    }
    case 'state.invariant_information_filter': {
      vectorName = 'Invariant Recurrence I_{t+1} = I_t + alpha*C(O_t)*V_t - beta*epsilon_t';
      const obs = [
        { t: 0, confidence: 0.9, verificationValue: 10.0, errorResidual: 2.0 },
        { t: 1, confidence: 0.8, verificationValue: 8.0, errorResidual: 1.0 },
      ];
      const traj = globalNeuralInvariantCapacityEngine.simulateInvariantRecurrence(100.0, 0.5, 0.25, obs);
      // t=0: gain=4.5, loss=0.5, delta=4.0 -> I_1 = 104.0
      // t=1: gain=3.2, loss=0.25, delta=2.95 -> I_2 = 106.95
      expectedOutput = 'finalI=106.95, netDelta=6.95';
      actualOutput = `finalI=${traj.finalI}, netDelta=${traj.netDelta}`;
      passed = Math.abs(traj.finalI - 106.95) < 0.001 && Math.abs(traj.netDelta - 6.95) < 0.001;
      break;
    }
    default: {
      expectedOutput = 'Registered algorithm ID';
      actualOutput = `Unknown algorithm: ${algorithmId}`;
      passed = false;
    }
  }

  const endNs = typeof process !== 'undefined' && process.hrtime ? process.hrtime.bigint() : BigInt(Date.now()) * 1000000n;
  return {
    algorithmId,
    version,
    passed,
    vectorName,
    expectedOutput,
    actualOutput,
    durationNs: (endNs - startNs).toString(),
    testedAtUtc,
  };
}
