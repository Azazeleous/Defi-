/**
 * =============================================================================
 * PROJECT: GAIA EYES — HIGH-RATE QUANTUM GRID AUTOMATION
 * MODULE: CrypticGraphing with FNV ISO Tether
 * SPECIFICATION: AE.CRYPTIC.SINGULARITY.V1 // 1:1 VIRTUAL MOUNT DRIVE & PRIVATE MINING
 * =============================================================================
 */

import { LiveChainBlock } from '../engine/cuboctahedralTraceEngine';

export type MountDeviceToken = '~' | '@' | '|' | '.|.';

export type VirtualSectorState = 'FREE' | 'ALLOCATED' | 'MINED_BLOCK' | 'ISO_SYNC_BUFFER';

export interface VirtualDriveSector {
  readonly sectorIndex: number;
  readonly sectorOffsetHex: string;
  readonly state: VirtualSectorState;
  readonly rawBytesHex: string;
  readonly blockIndex?: number;
  readonly blockHash?: string;
  readonly fnvBeatOffsetKey?: string;
  readonly lastWrittenMs: number;
}

export interface VirtualMountPoint {
  readonly mountPath: string;            // e.g. "@/virtual/fnv-chain-eth"
  readonly driveLabel: string;            // e.g. "ETH-L1-SETTLEMENT"
  readonly network: string;               // e.g. "Ethereum"
  readonly deviceToken: MountDeviceToken; // "@" for net virtual disk, "~" for local physical
  readonly fnvOffsetKey: string;          // 64-bit hex key e.g. "0xcbf29ce484222325"
  readonly mounted: boolean;
  readonly mountTimestamp: number;
  readonly totalSectors: number;
  readonly allocatedSectors: number;
  readonly sectorSizeKib: number;         // 64 KiB sectors
  readonly sectors: VirtualDriveSector[];
  readonly status: 'SYNCHRONIZED' | 'MOUNTING' | 'OFFLINE' | 'DEGRADED';
  readonly lastBlockMined?: LiveChainBlock;
  readonly oneToOneParityVerified: boolean;
}

export interface FnvTemporalBeatSnapshot {
  readonly currentTick: number;
  readonly timestampMs: number;
  readonly frequencyHz: number;          // Target 60.00 Hz
  readonly measuredFrequencyHz: number;
  readonly offsetBasisHex: string;       // 0xcbf29ce484222325
  readonly fnvPrimeHex: string;          // 0x100000001b3
  readonly activeOffsetKey: string;      // Current calculated beat offset
  readonly driftMs: number;              // Microsecond drift monitor
  readonly phaseAngleRad: number;        // 0 to 2*PI for oscilloscope
  readonly isTetherLocked: boolean;
}

export interface AnonymousMinerProfile {
  readonly enclaveId: string;
  readonly stealthVaultAddress: string;   // 0xSTEALTH_ENCLAVE_ZK_...
  readonly isPrivateAnonymityActive: boolean;
  readonly ringSignatures: string[];     // Ring of 5 enclave public keys
  readonly zeroTelemetryEnforced: boolean;
  totalAnonymousRewardsUsd: number;
}

export interface SingularityMiningPoolState {
  readonly poolName: string;
  readonly poolAlgorithm: string;         // "FNV-1a-ARX-SHA256"
  readonly isMining: boolean;
  readonly hashRateHps: number;           // Hashes per second
  readonly difficultyZeros: number;       // Difficulty target (leading hex zeros: 2, 3, or 4)
  readonly totalHashesComputed: number;
  readonly sharesSubmitted: number;
  readonly sharesAccepted: number;
  readonly blocksMinedCount: number;
  readonly currentCandidateNonce: number;
  readonly activeCandidate: {
    readonly network: string;
    readonly parentHash: string;
    readonly fnvBeatOffset: string;
    readonly difficultyTargetPrefix: string;
    readonly currentHashAttempt: string;
  } | null;
  readonly minedHistory: MinedBlockReceipt[];
}

export interface MinedBlockReceipt {
  readonly blockIndex: number;
  readonly blockHash: string;
  readonly nonce: number;
  readonly fnvOffsetKey: string;
  readonly network: string;
  readonly timestampMs: number;
  readonly stealthSignature: string;
  readonly targetMountPath: string;
  readonly rewardUsd: number;
  readonly verifiedOneToOne: boolean;
}

export interface CrypticGraphingState {
  readonly beat: FnvTemporalBeatSnapshot;
  readonly mounts: VirtualMountPoint[];
  readonly minerProfile: AnonymousMinerProfile;
  readonly miningState: SingularityMiningPoolState;
  readonly totalPersistentBlocks: number;
  readonly storageFootprintBytes: number;
  readonly lastPersistMs: number;
  readonly vfsDriverType: string;         // "dynamic-thread-coredriver"
  readonly isSparsebundleCorrupted: boolean;
  readonly integrityChecksum: string;
}
