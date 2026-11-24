/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * =============================================================================
 * SPECIFICATION: GAIA / NEXUS — Unified CRYPTIC Mining Profiles & Receipt Contracts
 * PROFILES:
 *   1. 'sha256d-80-v1': FIPS 180-4 Bitcoin 80-byte block header double-SHA256
 *   2. 'four-lane-sha256-v1': Interleaved 4-way parallel SIMD pipeline verification
 *   3. 'hccgn-work-v1': Cuboctahedral Hamiltonian cycle topological proof-of-work
 * =============================================================================
 */

export type UnifiedMiningProfileId =
  | 'sha256d-80-v1'
  | 'four-lane-sha256-v1'
  | 'hccgn-work-v1';

export type MiningProviderStatus =
  | 'ACTIVE'
  | 'DEGRADED'
  | 'STALE'
  | 'UNAVAILABLE'
  | 'PAUSED';

export interface MiningSchedulerMetrics {
  readonly queueDepth: number;
  readonly activeLeases: number;
  readonly dispatchLatencyUs: number;
  readonly preemptionCount: number;
  readonly missedDeadlinesCount: number;
  readonly memoryRssMb: number;
  readonly cpuUtilizationPct: number;
}

export interface MiningTelemetryReceipt {
  readonly receiptId: string;
  readonly profileId: UnifiedMiningProfileId;
  readonly workerId: string;
  readonly workerCount: number;
  readonly epochId: string;
  readonly blockNumber: number;
  readonly attempts: number; // Actual iterations executed
  readonly verifiedCandidates: number; // Verified digests meeting target
  readonly verificationFailures: number; // Nonces rejected by proof check
  readonly elapsedMicroseconds: number; // Measured from process.hrtime.bigint()
  readonly hashesPerSecond: number; // Genuine measured throughput
  readonly targetDifficultyBits: number;
  readonly targetLeadingZeroNibbles: number;
  readonly bestDigestHex: string;
  readonly nonceRangeStart: number;
  readonly nonceRangeEnd: number;
  readonly lastNonceEvaluated: number;
  readonly monotonicStartNs: string;
  readonly monotonicEndNs: string;
  readonly timestampUtc: string;
  readonly providerStatus: MiningProviderStatus;
  readonly schedulerMetrics: MiningSchedulerMetrics;
  readonly merkleRootHash: string;
}

export interface ProfileMiningConfig {
  readonly profileId: UnifiedMiningProfileId;
  readonly name: string;
  readonly algorithmDescription: string;
  readonly defaultTargetLeadingZeros: number;
  readonly maxBatchIterations: number;
  readonly isAsicResistant: boolean;
  readonly isMemoryHard: boolean;
  readonly verificationComplexity: 'O(1)' | 'O(N)' | 'O(N log N)';
}

export const CANONICAL_MINING_PROFILES: Record<UnifiedMiningProfileId, ProfileMiningConfig> = {
  'sha256d-80-v1': {
    profileId: 'sha256d-80-v1',
    name: 'Standard Double-SHA256 80-Byte Header',
    algorithmDescription: 'SHA-256(SHA-256(BlockHeader80)) matching Bitcoin consensus specification.',
    defaultTargetLeadingZeros: 4,
    maxBatchIterations: 200000,
    isAsicResistant: false,
    isMemoryHard: false,
    verificationComplexity: 'O(1)',
  },
  'four-lane-sha256-v1': {
    profileId: 'four-lane-sha256-v1',
    name: 'Four-Lane SIMD Pipelined SHA256',
    algorithmDescription: 'Interleaved 4-way pipeline evaluating 4 nonces in lockstep with residue cross-check.',
    defaultTargetLeadingZeros: 3,
    maxBatchIterations: 400000,
    isAsicResistant: true,
    isMemoryHard: false,
    verificationComplexity: 'O(1)',
  },
  'hccgn-work-v1': {
    profileId: 'hccgn-work-v1',
    name: 'HCCGN Cuboctahedral Hamiltonian Work',
    algorithmDescription: 'Topological Hamiltonian cycle constraint verification over cuboctahedral lattice graphs.',
    defaultTargetLeadingZeros: 2,
    maxBatchIterations: 100000,
    isAsicResistant: true,
    isMemoryHard: true,
    verificationComplexity: 'O(N)',
  },
};
