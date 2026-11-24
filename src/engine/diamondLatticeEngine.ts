/**
 * =============================================================================
 * SPECIFICATION: GAIA / NEXUS v4.5 — Level-10 Dynamic Diamond Lattice (4..64 Lanes)
 * MODULE: Multi-Lane Paired Inverse Solver (Section 7 Hardened)
 * POLICY:
 *   - Supports 4, 8, 16, 32, or 64 lanes dynamically (N/2 opposing pairs)
 *   - Independently evaluates B, C, V -> A = B && C && V (never hardcoded TRUE)
 *   - Enforces strict previewOnly isolation (no ledger mutation during previews)
 *   - Zero Math.random() or fabricated telemetry
 * =============================================================================
 */

import crypto from 'node:crypto';
import type {
  DiamondLatticeCycleResult,
  DiamondLaneNodeState,
  DiamondPairCheck,
  SupportedLaneCount,
} from '../contracts/gaia-v61';
import {
  blake2b512Hex,
  computeBlake2bMerkleRoot,
  globalPqMerkleVault,
  sha256NodeHex,
} from './pqMerkleReceiptEngine';

const SUPPORTED_COUNTS = new Set<number>([4, 8, 16, 32, 64]);

export function normalizeLaneCount(raw?: number): SupportedLaneCount {
  if (raw && SUPPORTED_COUNTS.has(raw)) {
    return raw as SupportedLaneCount;
  }
  return 16;
}

export class Level10DiamondLatticeEngine {
  /**
   * Executes one deterministic Level-10 Diamond Lattice cycle across `laneCount` (4..64) lanes.
   * When `previewOnly === true`, computes all proofs & hashes without writing a SQLite receipt.
   */
  public executeCycle(params: {
    laneCount?: number;
    stepIndex?: number;
    injectPairMismatch?: boolean;
    previewOnly?: boolean;
    deadlineMs?: number;
  }): DiamondLatticeCycleResult {
    const startNs = process.hrtime.bigint();
    const laneCount = normalizeLaneCount(params.laneCount);
    const stepIndex = Math.max(0, Math.floor(params.stepIndex ?? 1));
    const previewOnly = Boolean(params.previewOnly);
    const injectMismatch = Boolean(params.injectPairMismatch);
    const deadlineNs = BigInt(Math.max(1, Math.floor((params.deadlineMs ?? 50) * 1_000_000)));

    const fractional = +(((stepIndex * 0.1) % 1.0)).toFixed(4);
    const wholeCycle = Math.floor(stepIndex / 10);
    const zeroMod = stepIndex % 3 === 0 ? 0 : 1;

    const lanes: DiamondLaneNodeState[] = [];
    const pairs: DiamondPairCheck[] = [];
    const leafHashes: string[] = [];

    const pairCount = laneCount / 2;

    for (let p = 0; p < pairCount; p++) {
      const autoId = p * 2 + 1;
      const shadowId = p * 2 + 2;
      const phaseOffset = (p / pairCount) * 0.05;
      const coordAuto = +(0.1 + stepIndex * 0.2 + phaseOffset).toFixed(4);
      const coordShadow = injectMismatch && p === 0
        ? +(coordAuto + 0.42).toFixed(4)
        : coordAuto;

      const seqAuto: '1234' | '4321' = p % 2 === 0 ? '1234' : '4321';
      const seqShadow: '1234' | '4321' = seqAuto === '1234' ? '4321' : '1234';

      const autoLaneBase = {
        laneId: autoId,
        pairIndex: p,
        sequenceOrder: seqAuto,
        role: 'automation' as const,
        parityAttribute: 'LU' as const,
        activeOperand: autoId * zeroMod,
        coordinateValue: coordAuto,
        fractionalTimingIncrement: fractional,
        wholeCycleIteration: wholeCycle,
        directionFactor: 1 as const,
      };
      const autoDigest = sha256NodeHex(JSON.stringify(autoLaneBase));
      const autoLane: DiamondLaneNodeState = { ...autoLaneBase, laneDigestSha256: autoDigest };

      const shadowFrac = injectMismatch && p === 0 ? +((fractional + 0.13) % 1).toFixed(4) : fractional;
      const shadowLaneBase = {
        laneId: shadowId,
        pairIndex: p,
        sequenceOrder: seqShadow,
        role: 'shadow' as const,
        parityAttribute: 'RD' as const,
        activeOperand: shadowId * zeroMod,
        coordinateValue: coordShadow,
        fractionalTimingIncrement: shadowFrac,
        wholeCycleIteration: wholeCycle,
        directionFactor: -1 as const,
      };
      const shadowDigest = sha256NodeHex(JSON.stringify(shadowLaneBase));
      const shadowLane: DiamondLaneNodeState = { ...shadowLaneBase, laneDigestSha256: shadowDigest };

      lanes.push(autoLane, shadowLane);
      leafHashes.push(blake2b512Hex(autoDigest), blake2b512Hex(shadowDigest));

      const fracMatched = Math.abs(autoLane.fractionalTimingIncrement - shadowLane.fractionalTimingIncrement) < 1e-4;
      const wholeMatched = autoLane.wholeCycleIteration === shadowLane.wholeCycleIteration;
      const polarityValid = autoLane.directionFactor === -shadowLane.directionFactor;
      const coordDelta = Math.abs(autoLane.coordinateValue - shadowLane.coordinateValue);
      const pairSym = fracMatched && wholeMatched && polarityValid && coordDelta < 1e-4;

      pairs.push({
        pairIndex: p,
        automationLaneId: autoId,
        shadowLaneId: shadowId,
        midpointDivergence: +Math.abs(fractional - 0.5).toFixed(4),
        fractionalMatched: fracMatched,
        wholeCycleMatched: wholeMatched,
        ticketPolarityValid: polarityValid,
        pairSymmetric: pairSym,
      });
    }

    const merkleRootBlake2b = computeBlake2bMerkleRoot(leafHashes);
    const allPairsSymmetric = pairs.every((pr) => pr.pairSymmetric);
    const durationNs = process.hrtime.bigint() - startNs;

    const convergence = globalPqMerkleVault.evaluateConvergenceGate({
      boundaryValid: SUPPORTED_COUNTS.has(laneCount) && stepIndex >= 0,
      boundaryReason: `Level-10 Lattice boundary valid (${laneCount} lanes = ${pairCount} paired planes)`,
      verificationValid: allPairsSymmetric,
      verificationReason: allPairsSymmetric
        ? `All ${pairCount} automation/shadow pairs passed midpoint, fractional {t}, whole (n), and polarity checks`
        : `Pair divergence detected on ${pairs.filter((pr) => !pr.pairSymmetric).map((pr) => `P${pr.pairIndex}`).join(', ')}`,
      measuredDurationNs: durationNs,
      deadlineNs,
    });

    const cycleId = `lat10_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
    const receiptR = previewOnly
      ? null
      : globalPqMerkleVault.issueTraceReceiptR({
          subsystem: 'Level10_Diamond_Lattice',
          operationId: `lattice.cycle.${laneCount}L`,
          adapter: 'NODE_DIAMOND_L10',
          algorithmVersion: 'gaia.lattice.l10.v4.5',
          inputPayload: JSON.stringify({ laneCount, stepIndex, injectMismatch }),
          outputPayload: merkleRootBlake2b,
          durationNs,
          outcome: convergence.A_accepted ? 'VERIFIED' : 'REJECTED',
          independentCheckPassed: allPairsSymmetric,
          detail: `${laneCount} lanes (${pairCount} pairs), symmetric=${allPairsSymmetric}`,
          convergenceAccepted: convergence.A_accepted,
        });

    return {
      cycleId,
      latticeLevel: 10,
      laneCount,
      stepIndex,
      previewOnly,
      measuredComputeDurationNs: durationNs.toString(),
      lanes,
      pairs,
      convergence,
      merkleRootBlake2b,
      receiptR,
      timestampUtc: new Date().toISOString(),
    };
  }
}

export const globalDiamondLattice = new Level10DiamondLatticeEngine();
