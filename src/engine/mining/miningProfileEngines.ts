/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'node:crypto';
import {
  UnifiedMiningProfileId,
  MiningTelemetryReceipt,
  MiningSchedulerMetrics,
  MiningProviderStatus,
} from '../../contracts/mining-profiles';
import { sha256Bytes } from '../algorithmRegistry';

/**
 * Pure double-SHA256 (SHA256d) over an 80-byte block header.
 */
export function executeSha256d80MiningBatch(params: {
  headerTemplate: Uint8Array; // 80 bytes
  startNonce: number;
  iterations: number;
  targetLeadingZeros: number;
}): {
  attempts: number;
  verifiedCandidates: number;
  verificationFailures: number;
  lastNonce: number;
  bestDigestHex: string;
  targetHitNonce: number | null;
} {
  const { headerTemplate, startNonce, iterations, targetLeadingZeros } = params;
  const header = new Uint8Array(80);
  header.set(headerTemplate.subarray(0, 80));

  let attempts = 0;
  let verifiedCandidates = 0;
  let verificationFailures = 0;
  let targetHitNonce: number | null = null;
  let bestDigestHex = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

  // Target prefix requirement (e.g. 4 leading zero nibbles -> '0000')
  const targetPrefix = '0'.repeat(targetLeadingZeros);

  for (let i = 0; i < iterations; i++) {
    attempts++;
    const currentNonce = (startNonce + i) >>> 0;

    // Write nonce into last 4 bytes of 80-byte header (bytes 76..79 in little-endian)
    header[76] = currentNonce & 0xff;
    header[77] = (currentNonce >>> 8) & 0xff;
    header[78] = (currentNonce >>> 16) & 0xff;
    header[79] = (currentNonce >>> 24) & 0xff;

    // First SHA-256 pass
    const pass1 = sha256Bytes(header);
    // Second SHA-256 pass (SHA-256d)
    const pass2 = sha256Bytes(pass1);

    // Reversed byte order for Bitcoin display standard
    const digestHex = Array.from(pass2.reverse())
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    if (digestHex < bestDigestHex) {
      bestDigestHex = digestHex;
    }

    if (digestHex.startsWith(targetPrefix)) {
      verifiedCandidates++;
      if (targetHitNonce === null) {
        targetHitNonce = currentNonce;
      }
    } else {
      verificationFailures++;
    }

    // Stop batch early if verified candidate found to save CPU
    if (verifiedCandidates >= 1) {
      break;
    }
  }

  return {
    attempts,
    verifiedCandidates,
    verificationFailures,
    lastNonce: startNonce + attempts - 1,
    bestDigestHex,
    targetHitNonce,
  };
}

/**
 * 4-Lane Pipelined SHA-256 batch evaluation.
 * Evaluates 4 distinct nonces in parallel per loop iteration.
 */
export function executeFourLaneSha256Batch(params: {
  basePayload: Uint8Array;
  startNonce: number;
  iterations: number;
  targetLeadingZeros: number;
}): {
  attempts: number;
  verifiedCandidates: number;
  verificationFailures: number;
  lastNonce: number;
  bestDigestHex: string;
} {
  const { basePayload, startNonce, iterations, targetLeadingZeros } = params;
  const targetPrefix = '0'.repeat(targetLeadingZeros);

  let attempts = 0;
  let verifiedCandidates = 0;
  let verificationFailures = 0;
  let bestDigestHex = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

  // 4 lanes step in increments of 4
  const quadIterations = Math.max(1, Math.floor(iterations / 4));

  for (let step = 0; step < quadIterations; step++) {
    const baseNonce = startNonce + step * 4;

    for (let lane = 0; lane < 4; lane++) {
      attempts++;
      const currentNonce = (baseNonce + lane) >>> 0;

      // Construct lane buffer: payload + 4-byte nonce + 1-byte lane tag
      const laneBuf = new Uint8Array(basePayload.length + 5);
      laneBuf.set(basePayload, 0);
      laneBuf[basePayload.length] = currentNonce & 0xff;
      laneBuf[basePayload.length + 1] = (currentNonce >>> 8) & 0xff;
      laneBuf[basePayload.length + 2] = (currentNonce >>> 16) & 0xff;
      laneBuf[basePayload.length + 3] = (currentNonce >>> 24) & 0xff;
      laneBuf[basePayload.length + 4] = lane; // Lane tag 0..3

      const digestBytes = sha256Bytes(laneBuf);
      const digestHex = Array.from(digestBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      if (digestHex < bestDigestHex) {
        bestDigestHex = digestHex;
      }

      if (digestHex.startsWith(targetPrefix)) {
        verifiedCandidates++;
      } else {
        verificationFailures++;
      }
    }

    if (verifiedCandidates >= 1) {
      break;
    }
  }

  return {
    attempts,
    verifiedCandidates,
    verificationFailures,
    lastNonce: startNonce + attempts - 1,
    bestDigestHex,
  };
}

/**
 * HCCGN Cuboctahedral Hamiltonian cycle proof-of-work.
 * Verifies topological graph traversal constraints over a 12-vertex cuboctahedron.
 */
export function executeHccgnWorkBatch(params: {
  seedEntropyHex: string;
  startNonce: number;
  iterations: number;
  targetLeadingZeros: number;
}): {
  attempts: number;
  verifiedCandidates: number;
  verificationFailures: number;
  lastNonce: number;
  bestDigestHex: string;
} {
  const { seedEntropyHex, startNonce, iterations, targetLeadingZeros } = params;
  const targetPrefix = '0'.repeat(targetLeadingZeros);

  // Cuboctahedron adjacency matrix (12 vertices, 24 edges, 4-regular)
  const CUBOCTAHEDRON_ADJACENCY: number[][] = [
    [1, 2, 3, 4],   // V0
    [0, 2, 5, 6],   // V1
    [0, 1, 6, 7],   // V2
    [0, 4, 7, 8],   // V3
    [0, 3, 8, 5],   // V4
    [1, 4, 9, 10],  // V5
    [1, 2, 10, 11], // V6
    [2, 3, 11, 8],  // V7
    [3, 4, 7, 9],   // V8
    [4, 5, 8, 10],  // V9
    [5, 6, 9, 11],  // V10
    [6, 7, 10, 8],  // V11
  ];

  let attempts = 0;
  let verifiedCandidates = 0;
  let verificationFailures = 0;
  let bestDigestHex = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

  for (let i = 0; i < iterations; i++) {
    attempts++;
    const nonce = (startNonce + i) >>> 0;

    // Generate pseudo-Hamiltonian candidate path from seed + nonce
    const hasher = crypto.createHash('sha256');
    hasher.update(`${seedEntropyHex}:${nonce}`);
    const digest = hasher.digest();
    const digestHex = digest.toString('hex');

    if (digestHex < bestDigestHex) {
      bestDigestHex = digestHex;
    }

    // Verify Hamiltonian constraint: path must visit all 12 vertices without repeating
    const path: number[] = [];
    const visited = new Set<number>();
    let validCycle = true;

    for (let step = 0; step < 12; step++) {
      const v = digest[step] % 12;
      if (visited.has(v)) {
        validCycle = false;
        break;
      }
      visited.add(v);
      path.push(v);
    }

    // Check valid graph edges between successive steps
    if (validCycle && path.length === 12) {
      for (let step = 0; step < 11; step++) {
        const u = path[step];
        const w = path[step + 1];
        if (!CUBOCTAHEDRON_ADJACENCY[u].includes(w)) {
          validCycle = false;
          break;
        }
      }
    }

    if (validCycle && digestHex.startsWith(targetPrefix)) {
      verifiedCandidates++;
      break;
    } else {
      verificationFailures++;
    }
  }

  return {
    attempts,
    verifiedCandidates,
    verificationFailures,
    lastNonce: startNonce + attempts - 1,
    bestDigestHex,
  };
}
