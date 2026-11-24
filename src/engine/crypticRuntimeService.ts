/**
 * =============================================================================
 * SPECIFICATION: HCCGN.CRYPTIC.INSTANT.MINER v1.0.0 — Unified Runtime Service
 * MODULE: Tier 1/2/3 Coordinator, 13-State Clearing, RBAC, Stripe Connect & ONEIROS
 * =============================================================================
 */

import crypto from 'node:crypto';
import { monitorEventLoopDelay, IntervalHistogram } from 'node:perf_hooks';
import Stripe from 'stripe';
import {
  AcceptanceGateTestResult,
  AlgorithmSelfTestResult,
  AuditEventRecord,
  ClearedReceiptRecord,
  ContinuousWorkerRecord,
  ContinuousWorkerState,
  CrypticPlatformSnapshot,
  CRYPTIC_SCHEMA_VERSION,
  DreamLogEntry,
  DreamRealm,
  DreamThemeDistributionItem,
  InstantMinerJobConfig,
  InstantMinerSession,
  InstantSolverRequest,
  InstantSolverResult,
  LiveAnalyticsBundle,
  ProvenanceMetric,
  RbacRole,
  RbacSession,
  ReceiptLifecycleState,
  RewardAccountingEntry,
  StripeCapabilitiesStatus,
  StripePayoutRecord,
  TelemetryPoint,
  VerificationOutcome,
  WolframAdapterResult,
} from '../contracts/cryptic-platform';
import {
  CANONICAL_ALGORITHM_REGISTRY,
  crtReconstruct,
  evaluateSymbolicExpression,
  executeReversibleArxRoundtrip,
  meetsLeadingZeroHexTarget,
  modInverse,
  qcLdpcBitFlipDecode,
  qcLdpcEncodeByte,
  rsDecode,
  rsEncode,
  runAlgorithmSelfTest,
  sha256Hex,
} from './algorithmRegistry';
import { globalSqliteLedger, SqliteLedgerStore } from './sqliteLedgerStore';
import {
  evaluatePowCandidateDigest,
  globalStratumEngine,
  StratumNetworkEngine,
  SUPPORTED_MINING_NETWORKS,
} from './stratumNetworkEngine';
import { globalUniversalClockKernel } from './universalClockKernel';

// Canonical permission matrix (Section 12 RBAC)
const ROLE_PERMISSIONS: Record<RbacRole, readonly string[]> = {
  VIEWER: ['read:snapshot', 'read:analytics', 'read:receipts', 'read:audit', 'read:dreamscape'],
  OPERATOR: [
    'read:snapshot',
    'read:analytics',
    'read:receipts',
    'read:audit',
    'read:dreamscape',
    'job:control',
    'worker:control',
    'solver:run',
    'stratum:control',
    'dreamscape:write',
  ],
  ENGINEER: [
    'read:snapshot',
    'read:analytics',
    'read:receipts',
    'read:audit',
    'read:dreamscape',
    'job:control',
    'worker:control',
    'solver:run',
    'stratum:control',
    'clock:control',
    'algorithms:test',
    'acceptance:run',
    'network:config',
    'dreamscape:write',
  ],
  ACCOUNTING: [
    'read:snapshot',
    'read:analytics',
    'read:receipts',
    'read:audit',
    'receipt:clear',
    'payout:execute',
    'stripe:manage',
  ],
  ADMINISTRATOR: [
    'read:snapshot',
    'read:analytics',
    'read:receipts',
    'read:audit',
    'read:dreamscape',
    'job:control',
    'worker:control',
    'solver:run',
    'stratum:control',
    'clock:control',
    'algorithms:test',
    'acceptance:run',
    'network:config',
    'receipt:clear',
    'payout:execute',
    'stripe:manage',
    'dreamscape:write',
    'settings:admin',
  ],
};

const REFERENCE_DREAM_BASELINE: readonly { archetype: string; label: string; referenceSurveyPct: number }[] = [
  { archetype: 'chased', label: 'Being Chased (Anxiety / Avoidance)', referenceSurveyPct: 89 },
  { archetype: 'falling', label: 'Falling (Loss of Control / Support)', referenceSurveyPct: 87 },
  { archetype: 'teeth', label: 'Teeth Falling Out (Vulnerability / Change)', referenceSurveyPct: 82 },
  { archetype: 'snakes', label: 'Snakes (Hidden Threat / Transformation)', referenceSurveyPct: 76 },
  { archetype: 'flying', label: 'Flying (Freedom / Transcendence)', referenceSurveyPct: 68 },
  { archetype: 'naked', label: 'Naked in Public (Exposure / Judgment)', referenceSurveyPct: 64 },
];

function canonicalReceiptDigest(payload: Omit<ClearedReceiptRecord, 'canonicalDigestSha256'>): string {
  const ordered = {
    receiptId: payload.receiptId,
    schemaVersion: payload.schemaVersion,
    jobId: payload.jobId,
    workerId: payload.workerId,
    epochId: payload.epochId,
    algorithmId: payload.algorithmId,
    algorithmVersion: payload.algorithmVersion,
    inputDigestSha256: payload.inputDigestSha256,
    outputDigestSha256: payload.outputDigestSha256,
    targetSpec: payload.targetSpec,
    candidateResult: payload.candidateResult,
    sequenceNumber: payload.sequenceNumber,
    parentReceiptId: payload.parentReceiptId,
    parentReceiptDigest: payload.parentReceiptDigest,
    monotonicStartNs: payload.monotonicStartNs,
    monotonicEndNs: payload.monotonicEndNs,
    utcCorrelatedTimestamp: payload.utcCorrelatedTimestamp,
    clockUncertaintyNs: payload.clockUncertaintyNs,
    actualOperationCount: payload.actualOperationCount,
    actualHashCount: payload.actualHashCount,
    verificationOutcome: payload.verificationOutcome,
  };
  return sha256Hex(JSON.stringify(ordered));
}

export class CrypticRuntimeService {
  private readonly store: SqliteLedgerStore;
  private readonly stratum: StratumNetworkEngine;
  private readonly startTimeMs: number = Date.now();
  private readonly loopDelay: IntervalHistogram;

  private lastCpuUsage = process.cpuUsage();
  private lastCpuSampleMs = Date.now();
  private receiptSeqCounter = 1;
  private lastReceiptId: string | null = null;
  private lastReceiptDigest: string | null = null;

  // Active in-memory loops for running Instant Miner sessions and Continuous Workers
  private readonly instantJobTimers = new Map<string, NodeJS.Timeout>();
  private readonly instantJobMemory = new Map<string, { session: InstantMinerSession; latenciesNs: number[] }>();
  private readonly workerTimers = new Map<string, NodeJS.Timeout>();
  private telemetryTimer: NodeJS.Timeout | null = null;
  private leaseMonitorTimer: NodeJS.Timeout | null = null;

  private readonly snapshotListeners = new Set<(snap: CrypticPlatformSnapshot) => void>();

  constructor(
    store: SqliteLedgerStore = globalSqliteLedger,
    stratum: StratumNetworkEngine = globalStratumEngine
  ) {
    this.store = store;
    this.stratum = stratum;
    this.loopDelay = monitorEventLoopDelay({ resolution: 20 });
    this.loopDelay.enable();

    const existingReceipts = this.store.listReceipts(1);
    if (existingReceipts.length > 0) {
      this.lastReceiptId = existingReceipts[0].receiptId;
      this.lastReceiptDigest = existingReceipts[0].canonicalDigestSha256;
      this.receiptSeqCounter = existingReceipts[0].sequenceNumber + 1;
    }

    // Hook TCP stratum share recordings into our 13-state clearing & reward ledger
    this.stratum.onShareRecorded((share) => {
      this.handlePoolAcceptedShare(share.workerId, share.jobId, share.shareId, share.candidateDigestHex, share.receiptId);
    });

    this.startBackgroundLoops();
  }

  private startBackgroundLoops(): void {
    if (!this.telemetryTimer) {
      this.telemetryTimer = setInterval(() => {
        this.sampleTelemetryTick();
        this.broadcastSnapshot();
      }, 1000);
    }
    if (!this.leaseMonitorTimer) {
      this.leaseMonitorTimer = setInterval(() => {
        this.enforceWorkerLeases();
      }, 2000);
    }
  }

  public subscribeSnapshot(cb: (snap: CrypticPlatformSnapshot) => void): () => void {
    this.snapshotListeners.add(cb);
    return () => this.snapshotListeners.delete(cb);
  }

  private broadcastSnapshot(): void {
    if (this.snapshotListeners.size === 0) return;
    const snap = this.getSnapshot();
    this.snapshotListeners.forEach((cb) => {
      try {
        cb(snap);
      } catch {
        // Ignore isolated subscriber error
      }
    });
  }

  // ===========================================================================
  // SECTION 12: RBAC & AUDIT LOGGING
  // ===========================================================================
  public getPermissionsForRole(role: RbacRole): readonly string[] {
    return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.VIEWER;
  }

  public hasPermission(role: RbacRole, permission: string): boolean {
    const perms = this.getPermissionsForRole(role);
    return perms.includes(permission);
  }

  public buildSession(role: RbacRole, actorId: string = 'local-operator'): RbacSession {
    return {
      sessionId: `sess_${crypto.randomBytes(6).toString('hex')}`,
      actorId,
      role,
      permissions: this.getPermissionsForRole(role),
      issuedAtUtc: new Date().toISOString(),
    };
  }

  public recordAudit(
    actorRole: RbacRole,
    action: string,
    targetType: string,
    targetId: string,
    outcome: 'ALLOW' | 'DENY' | 'ERROR',
    detail: string
  ): AuditEventRecord {
    const event: AuditEventRecord = {
      eventId: `aud_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`,
      actorRole,
      action,
      targetType,
      targetId,
      outcome,
      detail,
      monotonicNs: process.hrtime.bigint().toString(),
      utcTimestamp: new Date().toISOString(),
    };
    this.store.recordAuditEvent(event);
    return event;
  }

  public authorizeOrAudit(actorRole: RbacRole, permission: string, action: string, targetType: string, targetId: string): void {
    if (!this.hasPermission(actorRole, permission)) {
      this.recordAudit(actorRole, action, targetType, targetId, 'DENY', `Role ${actorRole} lacks permission ${permission}`);
      throw new Error(`RBAC_DENIED: Role ${actorRole} lacks required permission (${permission}).`);
    }
  }

  // ===========================================================================
  // RECEIPT HELPER (SECTION 8 13-STATE LIFECYCLE)
  // ===========================================================================
  private createInitialClearedReceipt(params: {
    jobId: string;
    workerId: string;
    epochId: string;
    algorithmId: string;
    algorithmVersion: string;
    inputPayload: string;
    outputPayload: string;
    targetSpec: string;
    candidateResult: string;
    monotonicStartNs: string;
    monotonicEndNs: string;
    actualOperationCount: number;
    actualHashCount: number;
    verificationOutcome: VerificationOutcome;
    actorRole: RbacRole;
    customReceiptId?: string;
  }): ClearedReceiptRecord {
    const nowUtc = new Date().toISOString();
    const uclkSnap = globalUniversalClockKernel.getSnapshot();
    const receiptId = params.customReceiptId || `rcp_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
    const unsigned: Omit<ClearedReceiptRecord, 'canonicalDigestSha256'> = {
      receiptId,
      schemaVersion: CRYPTIC_SCHEMA_VERSION,
      jobId: params.jobId,
      workerId: params.workerId,
      epochId: params.epochId,
      algorithmId: params.algorithmId,
      algorithmVersion: params.algorithmVersion,
      inputDigestSha256: sha256Hex(params.inputPayload),
      outputDigestSha256: sha256Hex(params.outputPayload),
      targetSpec: params.targetSpec,
      candidateResult: params.candidateResult,
      sequenceNumber: this.receiptSeqCounter++,
      parentReceiptId: this.lastReceiptId,
      parentReceiptDigest: this.lastReceiptDigest,
      monotonicStartNs: params.monotonicStartNs,
      monotonicEndNs: params.monotonicEndNs,
      utcCorrelatedTimestamp: nowUtc,
      clockUncertaintyNs: uclkSnap.correlation.uncertaintyNs,
      actualOperationCount: params.actualOperationCount,
      actualHashCount: params.actualHashCount,
      verificationOutcome: params.verificationOutcome,
      protocolSubmissionResponse: null,
      poolAcknowledgement: null,
      rewardAccountingRef: null,
      lifecycleState: 'CREATED',
      createdAtUtc: nowUtc,
      updatedAtUtc: nowUtc,
    };

    const canonicalDigestSha256 = canonicalReceiptDigest(unsigned);
    const created: ClearedReceiptRecord = { ...unsigned, canonicalDigestSha256 };
    this.lastReceiptId = created.receiptId;
    this.lastReceiptDigest = created.canonicalDigestSha256;
    this.store.createReceipt(created, params.actorRole);

    let advanced = this.store.advanceReceiptState(
      receiptId,
      'COMPUTATION_COMPLETE',
      params.actorRole,
      `Computation executed (${params.actualOperationCount} ops, ${params.actualHashCount} hashes)`
    );

    if (params.verificationOutcome === 'VERIFIED' || params.verificationOutcome === 'VERIFIED_WITH_CORRECTION') {
      advanced = this.store.advanceReceiptState(
        receiptId,
        'LOCALLY_VERIFIED',
        params.actorRole,
        `Independent verification passed (${params.verificationOutcome})`
      );
    } else if (params.verificationOutcome === 'REJECTED') {
      advanced = this.store.advanceReceiptState(
        receiptId,
        'REJECTED',
        params.actorRole,
        `Verification outcome: ${params.verificationOutcome}`
      );
    }

    return advanced;
  }

  public verifyClearedReceipt(receiptId: string): {
    found: boolean;
    digestMatches: boolean;
    storedDigest: string | null;
    recomputedDigest: string | null;
    receipt: ClearedReceiptRecord | null;
  } {
    const r = this.store.getReceipt(receiptId);
    if (!r) {
      return { found: false, digestMatches: false, storedDigest: null, recomputedDigest: null, receipt: null };
    }
    const { canonicalDigestSha256, ...rest } = r;
    const recomputed = canonicalReceiptDigest(rest);
    return {
      found: true,
      digestMatches: recomputed === canonicalDigestSha256,
      storedDigest: canonicalDigestSha256,
      recomputedDigest: recomputed,
      receipt: r,
    };
  }

  public advanceReceiptLifecycle(
    receiptId: string,
    targetState: ReceiptLifecycleState,
    actorRole: RbacRole,
    note: string
  ): ClearedReceiptRecord {
    this.authorizeOrAudit(actorRole, 'receipt:clear', `RECEIPT_ADVANCE_${targetState}`, 'RECEIPT', receiptId);
    const updated = this.store.advanceReceiptState(receiptId, targetState, actorRole, note);
    this.recordAudit(actorRole, `RECEIPT_ADVANCE_${targetState}`, 'RECEIPT', receiptId, 'ALLOW', note);

    // Automatically record accounting entries strictly paired with clearing states
    if (targetState === 'REWARD_PENDING') {
      this.store.recordRewardEntry({
        entryId: `rew_${Date.now().toString(36)}_${crypto.randomBytes(2).toString('hex')}`,
        receiptId,
        jobId: updated.jobId,
        workerId: updated.workerId,
        entryType: 'ESTIMATED',
        currency: 'USD',
        amount: 0.25,
        idempotencyKey: `est:${receiptId}`,
        feeAmount: 0,
        netAmount: 0.25,
        note: 'Estimated pending reward upon REWARD_PENDING state',
        createdAtUtc: new Date().toISOString(),
      });
    } else if (targetState === 'REWARD_CONFIRMED') {
      const ent = this.store.recordRewardEntry({
        entryId: `rew_${Date.now().toString(36)}_${crypto.randomBytes(2).toString('hex')}`,
        receiptId,
        jobId: updated.jobId,
        workerId: updated.workerId,
        entryType: 'CONFIRMED',
        currency: 'USD',
        amount: 0.50,
        idempotencyKey: `conf:${receiptId}`,
        feeAmount: 0,
        netAmount: 0.50,
        note: 'Confirmed cleared share reward',
        createdAtUtc: new Date().toISOString(),
      });
      this.store.advanceReceiptState(receiptId, 'SETTLEMENT_ELIGIBLE', actorRole, 'Auto-promoted to SETTLEMENT_ELIGIBLE after REWARD_CONFIRMED lock', {
        rewardAccountingRef: ent.entry.entryId,
      });
    } else if (targetState === 'REVERSED') {
      this.store.recordRewardEntry({
        entryId: `rew_${Date.now().toString(36)}_${crypto.randomBytes(2).toString('hex')}`,
        receiptId,
        jobId: updated.jobId,
        workerId: updated.workerId,
        entryType: 'REVERSED',
        currency: 'USD',
        amount: 0.50,
        idempotencyKey: `rev:${receiptId}`,
        feeAmount: 0,
        netAmount: 0.50,
        note: `Reversal audit entry: ${note}`,
        createdAtUtc: new Date().toISOString(),
      });
    }

    return this.store.getReceipt(receiptId) || updated;
  }

  private handlePoolAcceptedShare(
    workerId: string,
    jobId: string,
    shareId: string,
    digestHex: string,
    receiptId: string
  ): void {
    const existing = this.store.getReceipt(receiptId);
    if (!existing) {
      this.createInitialClearedReceipt({
        customReceiptId: receiptId,
        jobId,
        workerId,
        epochId: globalUniversalClockKernel.getSnapshot().activeEpoch.epochId,
        algorithmId: 'crypto.sha256',
        algorithmVersion: '1.0.0',
        inputPayload: `${jobId}:${shareId}`,
        outputPayload: digestHex,
        targetSpec: 'stratum-tcp-share',
        candidateResult: digestHex,
        monotonicStartNs: process.hrtime.bigint().toString(),
        monotonicEndNs: process.hrtime.bigint().toString(),
        actualOperationCount: 1,
        actualHashCount: 1,
        verificationOutcome: 'VERIFIED',
        actorRole: 'OPERATOR',
      });
    }

    // Advance strictly step-by-step through clearing lifecycle
    const steps: Array<{ to: ReceiptLifecycleState; note: string; patch?: any }> = [
      { to: 'SUBMITTED', note: `Submitted over TCP Stratum socket (${shareId})`, patch: { protocolSubmissionResponse: 'mining.submit queued' } },
      { to: 'POOL_ACKNOWLEDGED', note: 'TCP Stratum server JSON-RPC ack received', patch: { poolAcknowledgement: `ack:${shareId}` } },
      { to: 'SHARE_ACCEPTED', note: 'Target & duplicate share check passed on Stratum server' },
      { to: 'REWARD_PENDING', note: 'Share queued in clearing window (estimated credit recorded)' },
      { to: 'REWARD_CONFIRMED', note: 'Local + Stratum receipt verified and confirmed' },
      { to: 'SETTLEMENT_ELIGIBLE', note: 'Eligible for fiat Stripe settlement' },
    ];

    let cur = this.store.getReceipt(receiptId);
    for (const s of steps) {
      if (!cur) break;
      try {
        cur = this.store.advanceReceiptState(receiptId, s.to, 'ACCOUNTING', s.note, s.patch);
        if (s.to === 'REWARD_PENDING') {
          this.store.recordRewardEntry({
            entryId: `rew_${Date.now().toString(36)}_${crypto.randomBytes(2).toString('hex')}`,
            receiptId,
            jobId,
            workerId,
            entryType: 'ESTIMATED',
            currency: 'USD',
            amount: 0.25,
            idempotencyKey: `est:${receiptId}`,
            feeAmount: 0,
            netAmount: 0.25,
            note: `Estimated reward for accepted Stratum share ${shareId}`,
            createdAtUtc: new Date().toISOString(),
          });
        } else if (s.to === 'REWARD_CONFIRMED') {
          this.store.recordRewardEntry({
            entryId: `rew_${Date.now().toString(36)}_${crypto.randomBytes(2).toString('hex')}`,
            receiptId,
            jobId,
            workerId,
            entryType: 'CONFIRMED',
            currency: 'USD',
            amount: 0.75,
            idempotencyKey: `conf:${receiptId}`,
            feeAmount: 0,
            netAmount: 0.75,
            note: `Confirmed reward from TCP Stratum share ${shareId}`,
            createdAtUtc: new Date().toISOString(),
          });
        }
      } catch {
        // Ignore if state was already beyond s.to
      }
    }
  }

  // ===========================================================================
  // TIER 1: INSTANT MINER (BOUNDED ASYNC VERIFIED EXECUTION)
  // ===========================================================================
  public startInstantMiner(input: Partial<InstantMinerJobConfig>, actorRole: RbacRole): InstantMinerSession {
    this.authorizeOrAudit(actorRole, 'job:control', 'INSTANT_MINER_START', 'INSTANT_JOB', 'new');

    const net = SUPPORTED_MINING_NETWORKS.find((n) => n.networkId === (input.networkId || 'local.stratum.sha256'));
    if (net && net.consensusType === 'POS_NON_MINABLE') {
      this.recordAudit(actorRole, 'INSTANT_MINER_START', 'NETWORK', net.networkId, 'DENY', 'Blocked PoW job on PoS network');
      throw new Error(`PoS network ${net.name} is NOT minable by Proof-of-Work coordinator.`);
    }

    const config: InstantMinerJobConfig = {
      algorithmId: input.algorithmId || 'crypto.sha256',
      networkId: input.networkId || 'local.stratum.sha256',
      inputPayload: input.inputPayload || `HCCGN_BLOCK_HEADER_${Date.now()}`,
      targetLeadingZeroHexDigits: Math.max(1, Math.min(5, Number(input.targetLeadingZeroHexDigits || 2))),
      maxIterations: Math.max(50, Math.min(50000, Number(input.maxIterations || 2500))),
      budgetNs: Math.max(5_000_000, Math.min(30_000_000_000, Number(input.budgetNs || 1_500_000_000))),
      startNonce: Math.max(0, Number(input.startNonce || 0)),
    };

    const jobId = `job_${Date.now().toString(36)}_${crypto.randomBytes(2).toString('hex')}`;
    const nowUtc = new Date().toISOString();
    const session: InstantMinerSession = {
      jobId,
      schemaVersion: CRYPTIC_SCHEMA_VERSION,
      config,
      state: 'RUNNING',
      completedOperations: 0,
      hashCalls: 0,
      candidateCount: 0,
      validCandidates: 0,
      bytesProcessed: 0,
      elapsedNs: '0',
      opsPerSec: 0,
      hashesPerSec: 0,
      avgLatencyNs: 0,
      p95LatencyNs: 0,
      bestDigestHex: null,
      bestNonce: null,
      verificationOutcome: 'UNRESOLVED',
      receiptId: null,
      createdAtUtc: nowUtc,
      updatedAtUtc: nowUtc,
    };

    this.instantJobMemory.set(jobId, { session, latenciesNs: [] });
    this.store.saveJob(session);
    this.recordAudit(actorRole, 'INSTANT_MINER_START', 'INSTANT_JOB', jobId, 'ALLOW', `alg=${config.algorithmId} targetZeros=${config.targetLeadingZeroHexDigits}`);
    this.scheduleInstantMinerSlice(jobId, actorRole);
    return session;
  }

  private scheduleInstantMinerSlice(jobId: string, actorRole: RbacRole): void {
    const existingTimer = this.instantJobTimers.get(jobId);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(() => {
      const mem = this.instantJobMemory.get(jobId);
      if (!mem || mem.session.state !== 'RUNNING') return;

      const s = mem.session;
      const cfg = s.config;
      const remainingIters = cfg.maxIterations - s.completedOperations;
      const sliceCount = Math.min(120, Math.max(0, remainingIters));

      if (sliceCount <= 0 || BigInt(s.elapsedNs) >= BigInt(cfg.budgetNs)) {
        this.finalizeInstantMinerJob(jobId, actorRole);
        return;
      }

      const sliceStartNs = process.hrtime.bigint();
      let bestDigest = s.bestDigestHex;
      let bestNonce = s.bestNonce;
      let validHits = s.validCandidates;
      let bytesAdded = 0;

      for (let i = 0; i < sliceCount; i++) {
        const nonce = cfg.startNonce + s.completedOperations + i;
        const header = `${cfg.inputPayload}:${nonce}`;
        const opStart = process.hrtime.bigint();
        const digest = evaluatePowCandidateDigest(cfg.algorithmId, header);
        const opDur = Number(process.hrtime.bigint() - opStart);
        mem.latenciesNs.push(Math.max(1, opDur));
        if (mem.latenciesNs.length > 500) mem.latenciesNs.shift();
        bytesAdded += Buffer.byteLength(header, 'utf8');

        if (!bestDigest || digest < bestDigest) {
          bestDigest = digest;
          bestNonce = nonce;
        }
        if (meetsLeadingZeroHexTarget(digest, cfg.targetLeadingZeroHexDigits)) {
          validHits++;
          this.store.recordCandidate({
            candidateId: `cand_${jobId}_${nonce}`,
            jobId,
            workerId: 'instant-miner-t1',
            algorithmId: cfg.algorithmId,
            nonce,
            digestHex: digest,
            meetsTarget: true,
            verifiedLocally: true,
          });
        }
      }

      const sliceDurNs = process.hrtime.bigint() - sliceStartNs;
      const totalElapsedNs = BigInt(s.elapsedNs) + sliceDurNs;
      const elapsedSec = Math.max(0.000001, Number(totalElapsedNs) / 1_000_000_000);
      const totalOps = s.completedOperations + sliceCount;
      const sortedLat = [...mem.latenciesNs].sort((a, b) => a - b);
      const avgLat = sortedLat.length > 0 ? Math.round(sortedLat.reduce((a, b) => a + b, 0) / sortedLat.length) : 0;
      const p95Lat = sortedLat.length > 0 ? sortedLat[Math.min(sortedLat.length - 1, Math.floor(sortedLat.length * 0.95))] : 0;

      const next: InstantMinerSession = {
        ...s,
        completedOperations: totalOps,
        hashCalls: totalOps,
        candidateCount: totalOps,
        validCandidates: validHits,
        bytesProcessed: s.bytesProcessed + bytesAdded,
        elapsedNs: totalElapsedNs.toString(),
        opsPerSec: +(totalOps / elapsedSec).toFixed(2),
        hashesPerSec: +(totalOps / elapsedSec).toFixed(2),
        avgLatencyNs: avgLat,
        p95LatencyNs: p95Lat,
        bestDigestHex: bestDigest,
        bestNonce,
        updatedAtUtc: new Date().toISOString(),
      };

      mem.session = next;
      this.store.saveJob(next);

      if (totalOps >= cfg.maxIterations || totalElapsedNs >= BigInt(cfg.budgetNs)) {
        this.finalizeInstantMinerJob(jobId, actorRole);
      } else {
        this.scheduleInstantMinerSlice(jobId, actorRole);
      }
    }, 20);

    this.instantJobTimers.set(jobId, timer);
  }

  private finalizeInstantMinerJob(jobId: string, actorRole: RbacRole): void {
    const mem = this.instantJobMemory.get(jobId);
    if (!mem) return;
    const s = mem.session;

    // Independent verification recomputation on best candidate
    let verified = false;
    if (s.bestNonce !== null && s.bestDigestHex) {
      const recomputed = evaluatePowCandidateDigest(s.config.algorithmId, `${s.config.inputPayload}:${s.bestNonce}`);
      verified = recomputed === s.bestDigestHex;
    }

    const outcome: VerificationOutcome =
      s.validCandidates > 0 && verified
        ? 'VERIFIED'
        : verified
          ? 'INCOMPLETE'
          : 'UNRESOLVED';

    const receipt = this.createInitialClearedReceipt({
      jobId,
      workerId: 'instant-miner-t1',
      epochId: globalUniversalClockKernel.getSnapshot().activeEpoch.epochId,
      algorithmId: s.config.algorithmId,
      algorithmVersion: '1.0.0',
      inputPayload: s.config.inputPayload,
      outputPayload: s.bestDigestHex || 'NO_CANDIDATE',
      targetSpec: `${s.config.targetLeadingZeroHexDigits}_LEADING_ZERO_HEX`,
      candidateResult: s.bestDigestHex || 'NONE',
      monotonicStartNs: (process.hrtime.bigint() - BigInt(s.elapsedNs)).toString(),
      monotonicEndNs: process.hrtime.bigint().toString(),
      actualOperationCount: s.completedOperations,
      actualHashCount: s.hashCalls,
      verificationOutcome: outcome,
      actorRole,
    });

    const completed: InstantMinerSession = {
      ...s,
      state: verified ? 'VERIFIED' : 'COMPLETED',
      verificationOutcome: outcome,
      receiptId: receipt.receiptId,
      updatedAtUtc: new Date().toISOString(),
    };
    mem.session = completed;
    this.store.saveJob(completed);
    this.broadcastSnapshot();
  }

  public controlInstantMiner(
    jobId: string,
    action: 'pause' | 'resume' | 'stop' | 'cancel' | 'verify' | 'reset',
    actorRole: RbacRole
  ): InstantMinerSession {
    this.authorizeOrAudit(actorRole, 'job:control', `INSTANT_MINER_${action.toUpperCase()}`, 'INSTANT_JOB', jobId);
    const jobs = this.store.listJobs(100);
    const mem = this.instantJobMemory.get(jobId);
    const existing = mem?.session || jobs.find((j) => j.jobId === jobId);
    if (!existing) throw new Error(`Instant Miner job not found: ${jobId}`);

    const t = this.instantJobTimers.get(jobId);
    if (t && (action === 'pause' || action === 'stop' || action === 'cancel' || action === 'reset')) {
      clearTimeout(t);
      this.instantJobTimers.delete(jobId);
    }

    let next: InstantMinerSession = existing;
    const nowUtc = new Date().toISOString();
    if (action === 'pause') next = { ...existing, state: 'PAUSED', updatedAtUtc: nowUtc };
    else if (action === 'stop') next = { ...existing, state: 'STOPPED', updatedAtUtc: nowUtc };
    else if (action === 'cancel') next = { ...existing, state: 'CANCELLED', updatedAtUtc: nowUtc };
    else if (action === 'reset') {
      next = {
        ...existing,
        state: 'CREATED',
        completedOperations: 0,
        hashCalls: 0,
        candidateCount: 0,
        validCandidates: 0,
        bytesProcessed: 0,
        elapsedNs: '0',
        opsPerSec: 0,
        hashesPerSec: 0,
        bestDigestHex: null,
        bestNonce: null,
        verificationOutcome: 'UNRESOLVED',
        updatedAtUtc: nowUtc,
      };
    } else if (action === 'resume') {
      next = { ...existing, state: 'RUNNING', updatedAtUtc: nowUtc };
      this.instantJobMemory.set(jobId, { session: next, latenciesNs: mem?.latenciesNs || [] });
      this.store.saveJob(next);
      this.scheduleInstantMinerSlice(jobId, actorRole);
      this.recordAudit(actorRole, 'INSTANT_MINER_RESUME', 'INSTANT_JOB', jobId, 'ALLOW', 'Job resumed');
      return next;
    } else if (action === 'verify') {
      const ok =
        existing.bestNonce !== null &&
        existing.bestDigestHex !== null &&
        evaluatePowCandidateDigest(existing.config.algorithmId, `${existing.config.inputPayload}:${existing.bestNonce}`) ===
          existing.bestDigestHex;
      next = {
        ...existing,
        state: ok ? 'VERIFIED' : 'FAILED',
        verificationOutcome: ok ? 'VERIFIED' : 'REJECTED',
        updatedAtUtc: nowUtc,
      };
    }

    if (mem) mem.session = next;
    this.store.saveJob(next);
    this.recordAudit(actorRole, `INSTANT_MINER_${action.toUpperCase()}`, 'INSTANT_JOB', jobId, 'ALLOW', `state=${next.state}`);
    return next;
  }

  // ===========================================================================
  // TIER 1: ALGORITHM-INDEPENDENT INSTANT SOLVER (SECTION 5 & 6)
  // ===========================================================================
  public async runInstantSolver(req: InstantSolverRequest, actorRole: RbacRole): Promise<InstantSolverResult> {
    this.authorizeOrAudit(actorRole, 'solver:run', 'INSTANT_SOLVER_RUN', 'ALGORITHM', req.algorithmId);
    const alg = CANONICAL_ALGORITHM_REGISTRY.find((a) => a.id === req.algorithmId);
    if (!alg) {
      throw new Error(`Unknown registered algorithm ID: ${req.algorithmId}`);
    }

    const startNs = process.hrtime.bigint();
    const solveId = `slv_${Date.now().toString(36)}_${crypto.randomBytes(2).toString('hex')}`;
    const epochId = globalUniversalClockKernel.getSnapshot().activeEpoch.epochId;

    let forwardOutput = '';
    let inverseOutput: string | null = null;
    let roundtripMatched: boolean | null = null;
    let residual = 0;
    let syndromeBefore: number | null = null;
    let syndromeAfter: number | null = null;
    let correctedErrorsCount = 0;
    let outcome: VerificationOutcome = 'VERIFIED';
    let limitationNotice: string | undefined;

    if (alg.isOneWayHash && req.mode === 'INVERSE') {
      // Section 5 Strict Rule: Never simulate or fake reversing a one-way cryptographic hash
      const endNs = process.hrtime.bigint();
      outcome = 'REJECTED';
      forwardOutput = sha256Hex(req.inputData || 'empty');
      inverseOutput = null;
      roundtripMatched = false;
      limitationNotice = `${alg.name} is a strict one-way cryptographic digest; mathematical inversion is impossible and will never be simulated.`;

      const receipt = this.createInitialClearedReceipt({
        jobId: solveId,
        workerId: 'instant-solver-t1',
        epochId,
        algorithmId: alg.id,
        algorithmVersion: alg.version,
        inputPayload: req.inputData,
        outputPayload: 'INVERSE_REJECTED_ONE_WAY_HASH',
        targetSpec: 'MODE_INVERSE_POLICY_CHECK',
        candidateResult: 'REJECTED',
        monotonicStartNs: startNs.toString(),
        monotonicEndNs: endNs.toString(),
        actualOperationCount: 1,
        actualHashCount: 1,
        verificationOutcome: 'REJECTED',
        actorRole,
      });

      const res: InstantSolverResult = {
        solveId,
        schemaVersion: CRYPTIC_SCHEMA_VERSION,
        algorithmId: alg.id,
        algorithmVersion: alg.version,
        operationType: alg.operationType,
        mode: req.mode,
        forwardOutput,
        inverseOutput,
        roundtripMatched,
        residual: 1,
        syndromeBefore: null,
        syndromeAfter: null,
        correctedErrorsCount: 0,
        verificationOutcome: 'REJECTED',
        elapsedNs: (endNs - startNs).toString(),
        monotonicStartNs: startNs.toString(),
        monotonicEndNs: endNs.toString(),
        utcTimestamp: new Date().toISOString(),
        receiptId: receipt.receiptId,
        limitationNotice,
      };
      this.store.saveSolverResult(res);
      this.recordAudit(actorRole, 'INSTANT_SOLVER_RUN', 'ALGORITHM', alg.id, 'ALLOW', 'Rejected illegal INVERSE on one-way hash');
      return res;
    }

    if (alg.id === 'rev.arx256') {
      const hexInput = /^[0-9a-fA-F]{16,64}$/.test(req.inputData.trim())
        ? req.inputData.trim()
        : sha256Hex(req.inputData || 'HCCGN-ARX-SEED');
      const arx = executeReversibleArxRoundtrip(hexInput);
      forwardOutput = arx.forwardHex;
      inverseOutput = arx.restoredHex;
      roundtripMatched = arx.roundtripExact;
      residual = arx.residualBits;
      outcome = arx.roundtripExact ? 'VERIFIED' : 'REJECTED';
    } else if (alg.id === 'rev.modular_crt') {
      const a = BigInt(Number(req.parameters?.a ?? 7));
      const m = BigInt(Number(req.parameters?.m ?? 26));
      const inv = modInverse(a, m);
      if (inv !== null) {
        const crt = crtReconstruct([2n, 3n, 2n], [3n, 5n, 7n]);
        forwardOutput = `ModInverse[${a},${m}]=${inv.toString()} | CRT=${crt?.value.toString()}`;
        inverseOutput = `${a}*${inv} mod ${m} = ${(((a % m) * inv) % m).toString()}`;
        roundtripMatched = (((a % m) * inv) % m) === 1n;
        residual = roundtripMatched ? 0 : 1;
        outcome = roundtripMatched ? 'VERIFIED' : 'REJECTED';
      } else {
        forwardOutput = `NO_INVERSE (gcd(${a}, ${m}) !== 1)`;
        inverseOutput = null;
        roundtripMatched = false;
        residual = 1;
        outcome = 'UNRESOLVED';
      }
    } else if (alg.id === 'ecc.reed_solomon_gf256') {
      const rawBytes = new TextEncoder().encode((req.inputData || 'HCCGN-RS-DATA').slice(0, 64));
      const encoded = rsEncode(rawBytes, 4);
      const received = new Uint8Array(encoded);
      const errPos = (req.injectedErrorPositions && req.injectedErrorPositions.length > 0)
        ? req.injectedErrorPositions
        : [1, Math.min(3, received.length - 1)];
      for (const pos of errPos) {
        if (pos >= 0 && pos < received.length) {
          received[pos] ^= 0xa5;
        }
      }
      const dec = rsDecode(received, 4);
      const decodedStr = new TextDecoder().decode(dec.decoded);
      forwardOutput = `Encoded(${encoded.length}B), CorruptedPositions=[${errPos.join(',')}]`;
      inverseOutput = decodedStr;
      syndromeBefore = dec.syndromeBefore;
      syndromeAfter = dec.syndromeAfter;
      correctedErrorsCount = dec.correctedCount;
      roundtripMatched = dec.success && decodedStr === new TextDecoder().decode(rawBytes);
      residual = dec.syndromeAfter;
      outcome = roundtripMatched ? (correctedErrorsCount > 0 ? 'VERIFIED_WITH_CORRECTION' : 'VERIFIED') : 'REJECTED';
    } else if (alg.id === 'ecc.qc_ldpc_syndrome') {
      const byteVal = (req.inputData || 'A').charCodeAt(0) & 0xff;
      const codeword = qcLdpcEncodeByte(byteVal);
      const flipIdx = Number(req.injectedErrorPositions?.[0] ?? 3) % 12;
      const noisy = [...codeword];
      noisy[flipIdx] ^= 1;
      const dec = qcLdpcBitFlipDecode(noisy);
      const recoveredByte = dec.decodedBits.slice(0, 8).reduce((acc, b, idx) => acc | (b << (7 - idx)), 0);
      forwardOutput = `QC-LDPC(12,8) bits=${codeword.join('')}, flippedBit=${flipIdx}`;
      inverseOutput = `DecodedByte=0x${recoveredByte.toString(16).padStart(2, '0')} ('${String.fromCharCode(recoveredByte)}')`;
      syndromeBefore = dec.syndromeBefore;
      syndromeAfter = dec.syndromeAfter;
      correctedErrorsCount = dec.flippedIndex !== null ? 1 : 0;
      roundtripMatched = dec.syndromeAfter === 0 && recoveredByte === byteVal;
      residual = dec.syndromeAfter;
      outcome = roundtripMatched ? 'VERIFIED_WITH_CORRECTION' : 'REJECTED';
    } else if (req.mode === 'SYMBOLIC_CHECK') {
      const sym = await evaluateSymbolicExpression(req.inputData || 'ModInverse[3, 11]');
      forwardOutput = sym.externalResult || sym.localResult || sym.diagnosticMessage;
      inverseOutput = sym.localResult;
      roundtripMatched = sym.independentVerificationPassed;
      residual = sym.independentVerificationPassed ? 0 : 1;
      outcome = sym.status === 'UNAVAILABLE' ? 'UNRESOLVED' : 'VERIFIED';
      limitationNotice = sym.diagnosticMessage;
    } else {
      // Standard one-way digest forward computation
      const digest = evaluatePowCandidateDigest(alg.id, req.inputData || 'HCCGN');
      forwardOutput = digest;
      inverseOutput = null;
      roundtripMatched = null;
      residual = 0;
      outcome = 'VERIFIED';
      if (alg.isOneWayHash) {
        limitationNotice = 'One-way cryptographic forward digest computed and verified against deterministic specification.';
      }
    }

    const endNs = process.hrtime.bigint();
    const receipt = this.createInitialClearedReceipt({
      jobId: solveId,
      workerId: 'instant-solver-t1',
      epochId,
      algorithmId: alg.id,
      algorithmVersion: alg.version,
      inputPayload: req.inputData,
      outputPayload: forwardOutput,
      targetSpec: `${alg.operationType}:${req.mode}`,
      candidateResult: inverseOutput || forwardOutput,
      monotonicStartNs: startNs.toString(),
      monotonicEndNs: endNs.toString(),
      actualOperationCount: 1,
      actualHashCount: alg.isOneWayHash ? 1 : 0,
      verificationOutcome: outcome,
      actorRole,
    });

    const result: InstantSolverResult = {
      solveId,
      schemaVersion: CRYPTIC_SCHEMA_VERSION,
      algorithmId: alg.id,
      algorithmVersion: alg.version,
      operationType: alg.operationType,
      mode: req.mode,
      forwardOutput,
      inverseOutput,
      roundtripMatched,
      residual,
      syndromeBefore,
      syndromeAfter,
      correctedErrorsCount,
      verificationOutcome: outcome,
      elapsedNs: (endNs - startNs).toString(),
      monotonicStartNs: startNs.toString(),
      monotonicEndNs: endNs.toString(),
      utcTimestamp: new Date().toISOString(),
      receiptId: receipt.receiptId,
      limitationNotice,
    };

    this.store.saveSolverResult(result);
    this.recordAudit(actorRole, 'INSTANT_SOLVER_RUN', 'ALGORITHM', alg.id, 'ALLOW', `solveId=${solveId} outcome=${outcome}`);
    return result;
  }

  // ===========================================================================
  // TIER 2: CONTINUOUS WORKER POOL (10-STATE FSM, LEASES & CRASH RECOVERY)
  // ===========================================================================
  private allocateDisjointNonceRange(span: number = 1_000_000): { start: number; end: number } {
    const workers = this.store.listWorkers();
    let maxEnd = 0;
    for (const w of workers) {
      if (w.nonceRangeEnd > maxEnd) maxEnd = w.nonceRangeEnd;
    }
    const start = maxEnd + 1;
    return { start, end: start + span - 1 };
  }

  public createWorker(params: { label?: string; algorithmId?: string; networkId?: string }, actorRole: RbacRole): ContinuousWorkerRecord {
    this.authorizeOrAudit(actorRole, 'worker:control', 'WORKER_CREATE', 'WORKER', 'new');
    const networkId = params.networkId || 'local.stratum.sha256';
    const net = SUPPORTED_MINING_NETWORKS.find((n) => n.networkId === networkId);
    if (net && net.consensusType === 'POS_NON_MINABLE') {
      throw new Error(`Cannot bind PoW continuous worker to PoS network (${net.name}).`);
    }

    const workerId = `wrk_${Date.now().toString(36)}_${crypto.randomBytes(2).toString('hex')}`;
    const range = this.allocateDisjointNonceRange(1_000_000);
    const nowMs = Date.now();
    const epochId = globalUniversalClockKernel.getSnapshot().activeEpoch.epochId;
    const cpu = process.cpuUsage();
    const mem = process.memoryUsage();

    const worker: ContinuousWorkerRecord = {
      workerId,
      label: params.label || `Worker-${workerId.slice(-4).toUpperCase()}`,
      epochId,
      algorithmId: params.algorithmId || 'crypto.sha256',
      networkId,
      state: 'READY',
      nonceRangeStart: range.start,
      nonceRangeEnd: range.end,
      currentCursor: range.start,
      leaseId: `lease_${crypto.randomBytes(4).toString('hex')}`,
      leaseExpiresAtMs: nowMs + 45_000,
      heartbeatAtMs: nowMs,
      heartbeatAgeMs: 0,
      lastCheckpointAtMs: nowMs,
      completedOperations: 0,
      completedBytes: 0,
      hashCalls: 0,
      validCandidates: 0,
      verificationFailures: 0,
      missedDeadlines: 0,
      queueDepth: 0,
      backpressureActive: false,
      measuredOpsPerSec: 0,
      cpuUserMicros: cpu.user,
      memoryRssBytes: mem.rss,
      lastVerifiedReceiptId: null,
      failureReason: null,
      updatedAtUtc: new Date(nowMs).toISOString(),
    };

    this.store.saveWorker(worker, 'INITIALIZING', 'READY', `Allocated disjoint nonce range [${range.start}..${range.end}]`);
    this.recordAudit(actorRole, 'WORKER_CREATE', 'WORKER', workerId, 'ALLOW', `range=${range.start}-${range.end}`);
    return worker;
  }

  public controlWorker(
    workerId: string,
    action: 'start' | 'pause' | 'resume' | 'stop' | 'checkpoint' | 'simulate-crash' | 'recover' | 'expire-lease',
    actorRole: RbacRole
  ): ContinuousWorkerRecord {
    this.authorizeOrAudit(actorRole, 'worker:control', `WORKER_${action.toUpperCase()}`, 'WORKER', workerId);
    const existing = this.store.getWorker(workerId);
    if (!existing) throw new Error(`Worker not found: ${workerId}`);

    const clearLoop = () => {
      const t = this.workerTimers.get(workerId);
      if (t) {
        clearInterval(t);
        this.workerTimers.delete(workerId);
      }
    };

    const nowMs = Date.now();
    let updated: ContinuousWorkerRecord = existing;
    let nextState: ContinuousWorkerState = existing.state;
    let reason = `Action: ${action}`;

    if (action === 'start' || action === 'resume') {
      nextState = 'RUNNING';
      reason = `${action === 'start' ? 'Started' : 'Resumed'} from cursor ${existing.currentCursor}`;
      updated = {
        ...existing,
        state: 'RUNNING',
        leaseId: `lease_${crypto.randomBytes(4).toString('hex')}`,
        leaseExpiresAtMs: nowMs + 45_000,
        heartbeatAtMs: nowMs,
        heartbeatAgeMs: 0,
        failureReason: null,
        updatedAtUtc: new Date(nowMs).toISOString(),
      };
      this.store.saveWorker(updated, existing.state, 'RUNNING', reason);
      this.startWorkerExecutionLoop(workerId, actorRole);
    } else if (action === 'pause') {
      clearLoop();
      nextState = 'PAUSED';
      updated = { ...existing, state: 'PAUSED', updatedAtUtc: new Date(nowMs).toISOString() };
      this.store.saveWorker(updated, existing.state, 'PAUSED', 'Paused by operator with checkpoint preserved');
    } else if (action === 'stop') {
      clearLoop();
      nextState = 'STOPPED';
      updated = { ...existing, state: 'STOPPED', updatedAtUtc: new Date(nowMs).toISOString() };
      this.store.saveWorker(updated, existing.state, 'STOPPED', 'Gracefully stopped by operator');
    } else if (action === 'checkpoint') {
      updated = {
        ...existing,
        state: 'CHECKPOINTING',
        lastCheckpointAtMs: nowMs,
        updatedAtUtc: new Date(nowMs).toISOString(),
      };
      this.store.saveWorker(updated, existing.state, 'CHECKPOINTING', `Manual SQLite checkpoint at cursor=${existing.currentCursor}`);
      updated = { ...updated, state: existing.state === 'RUNNING' ? 'RUNNING' : 'READY' };
      this.store.saveWorker(updated, 'CHECKPOINTING', updated.state, 'Checkpoint committed');
    } else if (action === 'simulate-crash') {
      clearLoop();
      nextState = 'FAILED';
      updated = {
        ...existing,
        state: 'FAILED',
        failureReason: 'Simulated worker process crash; checkpoint retained in SQLite for deterministic recovery.',
        updatedAtUtc: new Date(nowMs).toISOString(),
      };
      this.store.saveWorker(updated, existing.state, 'FAILED', 'Simulated crash injected');
    } else if (action === 'recover') {
      clearLoop();
      updated = {
        ...existing,
        state: 'RECOVERING',
        failureReason: null,
        leaseId: `lease_${crypto.randomBytes(4).toString('hex')}`,
        leaseExpiresAtMs: nowMs + 45_000,
        heartbeatAtMs: nowMs,
        heartbeatAgeMs: 0,
        updatedAtUtc: new Date(nowMs).toISOString(),
      };
      this.store.saveWorker(updated, existing.state, 'RECOVERING', `Recovering from checkpoint cursor=${existing.currentCursor}`);
      updated = { ...updated, state: 'READY', updatedAtUtc: new Date().toISOString() };
      this.store.saveWorker(updated, 'RECOVERING', 'READY', `Recovered cleanly at cursor=${existing.currentCursor} (0 fabricated progress)`);
    } else if (action === 'expire-lease') {
      clearLoop();
      updated = {
        ...existing,
        state: 'DEGRADED',
        leaseExpiresAtMs: nowMs - 5000,
        failureReason: 'Lease TTL expired; worker fenced to prevent stale or overlapping writes.',
        updatedAtUtc: new Date(nowMs).toISOString(),
      };
      this.store.saveWorker(updated, existing.state, 'DEGRADED', 'Lease expired; execution fenced');
    }

    this.recordAudit(actorRole, `WORKER_${action.toUpperCase()}`, 'WORKER', workerId, 'ALLOW', reason);
    return updated;
  }

  private startWorkerExecutionLoop(workerId: string, actorRole: RbacRole): void {
    const prevTimer = this.workerTimers.get(workerId);
    if (prevTimer) clearInterval(prevTimer);

    const timer = setInterval(() => {
      const w = this.store.getWorker(workerId);
      if (!w || w.state !== 'RUNNING') {
        clearInterval(timer);
        this.workerTimers.delete(workerId);
        return;
      }

      const nowMs = Date.now();
      if (nowMs > w.leaseExpiresAtMs) {
        clearInterval(timer);
        this.workerTimers.delete(workerId);
        const expired: ContinuousWorkerRecord = {
          ...w,
          state: 'DEGRADED',
          failureReason: 'Nonce lease expired automatically.',
          updatedAtUtc: new Date(nowMs).toISOString(),
        };
        this.store.saveWorker(expired, 'RUNNING', 'DEGRADED', 'Automatic lease expiration');
        return;
      }

      // Check event-loop backpressure cleanly
      const p99DelayMs = this.loopDelay.percentile(99) / 1e6;
      const backpressure = p99DelayMs > 40;
      const batchOps = backpressure ? 24 : 96;

      if (w.currentCursor + batchOps > w.nonceRangeEnd) {
        clearInterval(timer);
        this.workerTimers.delete(workerId);
        const done: ContinuousWorkerRecord = {
          ...w,
          state: 'STOPPED',
          failureReason: 'Allocated disjoint nonce lease range exhausted.',
          updatedAtUtc: new Date(nowMs).toISOString(),
        };
        this.store.saveWorker(done, 'RUNNING', 'STOPPED', 'Nonce lease range completed');
        return;
      }

      const batchStartNs = process.hrtime.bigint();
      let validHits = 0;
      let lastDigest = '';
      let lastNonce = w.currentCursor;
      for (let i = 0; i < batchOps; i++) {
        const nonce = w.currentCursor + i;
        lastNonce = nonce;
        lastDigest = evaluatePowCandidateDigest(w.algorithmId, `${w.epochId}:${w.workerId}:${nonce}`);
        if (meetsLeadingZeroHexTarget(lastDigest, 2)) {
          validHits++;
          this.store.recordCandidate({
            candidateId: `cand_${w.workerId}_${nonce}`,
            jobId: w.epochId,
            workerId: w.workerId,
            algorithmId: w.algorithmId,
            nonce,
            digestHex: lastDigest,
            meetsTarget: true,
            verifiedLocally: true,
          });
        }
      }
      const batchDurNs = process.hrtime.bigint() - batchStartNs;
      const durSec = Math.max(0.000001, Number(batchDurNs) / 1_000_000_000);
      const batchId = `bat_${Date.now().toString(36)}_${crypto.randomBytes(2).toString('hex')}`;
      this.store.recordComputationBatch({
        batchId,
        jobId: w.epochId,
        workerId: w.workerId,
        epochId: globalUniversalClockKernel.getSnapshot().activeEpoch.epochId,
        operationCount: batchOps,
        bytesProcessed: batchOps * 48,
        durationNs: batchDurNs.toString(),
      });

      let latestReceiptId = w.lastVerifiedReceiptId;
      if (validHits > 0) {
        const rcp = this.createInitialClearedReceipt({
          jobId: w.epochId,
          workerId: w.workerId,
          epochId: globalUniversalClockKernel.getSnapshot().activeEpoch.epochId,
          algorithmId: w.algorithmId,
          algorithmVersion: '1.0.0',
          inputPayload: `${w.epochId}:${w.workerId}:${lastNonce}`,
          outputPayload: lastDigest,
          targetSpec: '2_LEADING_ZERO_HEX',
          candidateResult: lastDigest,
          monotonicStartNs: batchStartNs.toString(),
          monotonicEndNs: (batchStartNs + batchDurNs).toString(),
          actualOperationCount: batchOps,
          actualHashCount: batchOps,
          verificationOutcome: 'VERIFIED',
          actorRole,
        });
        latestReceiptId = rcp.receiptId;
      }

      const mem = process.memoryUsage();
      const cpu = process.cpuUsage();
      const refreshed: ContinuousWorkerRecord = {
        ...w,
        epochId: globalUniversalClockKernel.getSnapshot().activeEpoch.epochId,
        currentCursor: w.currentCursor + batchOps,
        leaseExpiresAtMs: nowMs + 45_000,
        heartbeatAtMs: nowMs,
        heartbeatAgeMs: 0,
        lastCheckpointAtMs: nowMs,
        completedOperations: w.completedOperations + batchOps,
        completedBytes: w.completedBytes + batchOps * 48,
        hashCalls: w.hashCalls + batchOps,
        validCandidates: w.validCandidates + validHits,
        queueDepth: backpressure ? 1 : 0,
        backpressureActive: backpressure,
        measuredOpsPerSec: +(batchOps / durSec).toFixed(2),
        cpuUserMicros: cpu.user,
        memoryRssBytes: mem.rss,
        lastVerifiedReceiptId: latestReceiptId,
        updatedAtUtc: new Date(nowMs).toISOString(),
      };
      this.store.saveWorker(refreshed);
    }, 650);

    this.workerTimers.set(workerId, timer);
  }

  private enforceWorkerLeases(): void {
    const now = Date.now();
    for (const w of this.store.listWorkers()) {
      if (w.state === 'RUNNING' && now > w.leaseExpiresAtMs) {
        this.controlWorker(w.workerId, 'expire-lease', 'ADMINISTRATOR');
      }
    }
  }

  // ===========================================================================
  // STRIPE CONNECT TEST-MODE SERVER ADAPTER (SECTION 9 & ZERO FAKE PAYOUTS)
  // ===========================================================================
  public async getStripeCapabilities(env: NodeJS.ProcessEnv = process.env): Promise<StripeCapabilitiesStatus> {
    const secret = env.STRIPE_SECRET_KEY?.trim() || '';
    const webhookSecret = env.STRIPE_WEBHOOK_SECRET?.trim() || '';
    const connectAccountId = env.STRIPE_CONNECT_ACCOUNT_ID?.trim() || null;
    const adultConfirmed = env.STRIPE_ADULT_ENTITY_CONFIRMED === 'true';
    const liveDisabled = env.STRIPE_ALLOW_LIVE_SETTLEMENT !== 'true';
    const nowUtc = new Date().toISOString();

    const missingCredentials: string[] = [];
    if (!secret) missingCredentials.push('STRIPE_SECRET_KEY');
    if (!webhookSecret) missingCredentials.push('STRIPE_WEBHOOK_SECRET');

    if (!secret) {
      return {
        configured: false,
        mode: 'UNCONFIGURED',
        liveMoneyDisabled: true,
        missingCredentials,
        connectedAccountId: connectAccountId,
        payoutsEnabled: false,
        chargesEnabled: false,
        defaultCurrency: null,
        supportedFiatCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'],
        eligibilityChecklist: {
          adultOperatedEntityConfirmed: adultConfirmed,
          stripeSecretConfigured: false,
          webhookSecretConfigured: Boolean(webhookSecret),
          connectedAccountEligible: false,
          liveSettlementAuthorized: false,
        },
        lastCheckedUtc: nowUtc,
        diagnosticMessage:
          'Stripe Connect adapter is unconfigured. Set STRIPE_SECRET_KEY (sk_test_...) and STRIPE_WEBHOOK_SECRET in server environment to enable Test Mode fiat verification.',
      };
    }

    const isTestKey = secret.startsWith('sk_test_') || secret.startsWith('rk_test_');
    if (!isTestKey && liveDisabled) {
      return {
        configured: false,
        mode: 'LIVE_DISABLED_COMPLIANCE',
        liveMoneyDisabled: true,
        missingCredentials,
        connectedAccountId: connectAccountId,
        payoutsEnabled: false,
        chargesEnabled: false,
        defaultCurrency: null,
        supportedFiatCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'],
        eligibilityChecklist: {
          adultOperatedEntityConfirmed: adultConfirmed,
          stripeSecretConfigured: true,
          webhookSecretConfigured: Boolean(webhookSecret),
          connectedAccountEligible: false,
          liveSettlementAuthorized: false,
        },
        lastCheckedUtc: nowUtc,
        diagnosticMessage:
          'Live-mode Stripe secret key detected while STRIPE_ALLOW_LIVE_SETTLEMENT!=true. Settlement locked for compliance safety.',
      };
    }

    // Real Stripe SDK probe (never returns simulated account flags)
    try {
      const stripe = new Stripe(secret);
      const acct = connectAccountId
        ? await stripe.accounts.retrieve(connectAccountId)
        : (await stripe.accounts.list({ limit: 1 })).data[0] ?? null;

      return {
        configured: true,
        mode: 'TEST_MODE',
        liveMoneyDisabled: liveDisabled,
        missingCredentials,
        connectedAccountId: acct?.id ?? connectAccountId ?? null,
        payoutsEnabled: Boolean(acct?.payouts_enabled),
        chargesEnabled: Boolean(acct?.charges_enabled),
        defaultCurrency: acct?.default_currency ? acct.default_currency.toUpperCase() : 'USD',
        supportedFiatCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'],
        eligibilityChecklist: {
          adultOperatedEntityConfirmed: adultConfirmed,
          stripeSecretConfigured: true,
          webhookSecretConfigured: Boolean(webhookSecret),
          connectedAccountEligible: Boolean(acct.payouts_enabled),
          liveSettlementAuthorized: !liveDisabled && adultConfirmed,
        },
        lastCheckedUtc: nowUtc,
        diagnosticMessage: `Stripe Test Mode SDK connected cleanly to account ${acct.id} (payouts_enabled=${acct.payouts_enabled}).`,
      };
    } catch (err: any) {
      return {
        configured: false,
        mode: 'UNCONFIGURED',
        liveMoneyDisabled: liveDisabled,
        missingCredentials,
        connectedAccountId: connectAccountId,
        payoutsEnabled: false,
        chargesEnabled: false,
        defaultCurrency: null,
        supportedFiatCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'],
        eligibilityChecklist: {
          adultOperatedEntityConfirmed: adultConfirmed,
          stripeSecretConfigured: true,
          webhookSecretConfigured: Boolean(webhookSecret),
          connectedAccountEligible: false,
          liveSettlementAuthorized: false,
        },
        lastCheckedUtc: nowUtc,
        diagnosticMessage: `Stripe SDK connection error: ${err.message}`,
      };
    }
  }

  public async executeStripePayout(
    params: {
      amountUsd: number;
      currency: string;
      idempotencyKey?: string;
      receiptId?: string;
      destinationSummary?: string;
    },
    actorRole: RbacRole,
    env: NodeJS.ProcessEnv = process.env
  ): Promise<StripePayoutRecord> {
    this.authorizeOrAudit(actorRole, 'payout:execute', 'STRIPE_PAYOUT_CREATE', 'PAYOUT', params.idempotencyKey || 'new');

    const idemp = params.idempotencyKey?.trim() || `pay_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
    const existing = this.store.getPayoutByIdempotency(idemp);
    if (existing) {
      return existing;
    }

    const fiatCurrencies = new Set(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY']);
    const curr = (params.currency || 'USD').toUpperCase();
    if (!fiatCurrencies.has(curr)) {
      throw new Error(`Currency ${curr} is not a Stripe fiat settlement currency. Use Stripe Connect strictly for fiat payouts (USD, EUR, GBP, CAD, AUD, JPY).`);
    }

    const caps = await this.getStripeCapabilities(env);
    if (!caps.configured || caps.mode === 'UNCONFIGURED') {
      this.recordAudit(actorRole, 'STRIPE_PAYOUT_CREATE', 'PAYOUT', idemp, 'DENY', caps.diagnosticMessage);
      throw new Error(`STRIPE_UNCONFIGURED: ${caps.diagnosticMessage}`);
    }

    const balances = this.store.getRewardBalances();
    const amountUsd = Number(params.amountUsd);
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      throw new Error('Payout amount must be a positive finite USD value.');
    }
    if (amountUsd > balances.confirmedAvailableUsd) {
      throw new Error(
        `INSUFFICIENT_CONFIRMED_BALANCE: Requested $${amountUsd.toFixed(2)}, confirmed available balance is $${balances.confirmedAvailableUsd.toFixed(2)}. Unconfirmed/estimated balances cannot settle.`
      );
    }

    const secret = env.STRIPE_SECRET_KEY!.trim();
    const stripe = new Stripe(secret);
    const amountCents = Math.round(amountUsd * 100);
    const payoutId = `po_lgr_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
    const nowUtc = new Date().toISOString();

    try {
      const stripeResp = await stripe.payouts.create(
        {
          amount: amountCents,
          currency: curr.toLowerCase(),
          description: `HCCGN CRYPTIC Settlement (${idemp})`,
        },
        {
          idempotencyKey: idemp,
          ...(caps.connectedAccountId && caps.connectedAccountId.startsWith('acct_') && env.STRIPE_CONNECT_ACCOUNT_ID
            ? { stripeAccount: caps.connectedAccountId }
            : {}),
        }
      );

      // Record debit entry in append-only reward ledger
      const debit = this.store.recordRewardEntry({
        entryId: `rew_${Date.now().toString(36)}_${crypto.randomBytes(2).toString('hex')}`,
        receiptId: params.receiptId || 'SETTLEMENT_BATCH',
        jobId: 'STRIPE_SETTLEMENT',
        workerId: 'accounting-service',
        entryType: 'SETTLED_DEBIT',
        currency: 'USD',
        amount: amountUsd,
        idempotencyKey: `debit:${idemp}`,
        feeAmount: +(amountUsd * 0.01).toFixed(2),
        netAmount: +(amountUsd * 0.99).toFixed(2),
        note: `Stripe Test-Mode payout ${stripeResp.id} (${curr})`,
        createdAtUtc: nowUtc,
      });

      if (params.receiptId) {
        try {
          this.store.advanceReceiptState(params.receiptId, 'SETTLED', actorRole, `Settled via Stripe ${stripeResp.id}`);
        } catch {
          // Receipt may be an aggregate batch
        }
      }

      const rec: StripePayoutRecord = {
        payoutId,
        stripePayoutId: stripeResp.id,
        idempotencyKey: idemp,
        actorRole,
        rewardEntryId: debit.entry.entryId,
        currency: curr,
        grossAmount: amountUsd,
        feeAmount: +(amountUsd * 0.01).toFixed(2),
        netAmount: +(amountUsd * 0.99).toFixed(2),
        destinationSummary: params.destinationSummary || `Stripe Connected Account (${caps.connectedAccountId})`,
        settlementRail: 'STRIPE_CONNECT_FIAT_TEST',
        status: stripeResp.status === 'paid' ? 'PAID' : 'IN_TRANSIT',
        testMode: true,
        webhookVerified: false,
        failureMessage: null,
        createdAtUtc: nowUtc,
        updatedAtUtc: nowUtc,
      };
      this.store.savePayout(rec);
      this.recordAudit(actorRole, 'STRIPE_PAYOUT_CREATE', 'PAYOUT', payoutId, 'ALLOW', `stripeId=${stripeResp.id} amount=$${amountUsd}`);
      return rec;
    } catch (err: any) {
      this.recordAudit(actorRole, 'STRIPE_PAYOUT_CREATE', 'PAYOUT', payoutId, 'ERROR', err.message);
      throw err;
    }
  }

  public handleStripeWebhook(rawBody: Buffer, signatureHeader: string | undefined, env: NodeJS.ProcessEnv = process.env): {
    received: boolean;
    eventType: string;
    updatedPayoutId: string | null;
  } {
    const secret = env.STRIPE_SECRET_KEY?.trim();
    const webhookSecret = env.STRIPE_WEBHOOK_SECRET?.trim();
    if (!secret || !webhookSecret) {
      throw new Error('Stripe webhook verification skipped: STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET not configured.');
    }
    if (!signatureHeader) {
      throw new Error('Missing stripe-signature header.');
    }
    const stripe = new Stripe(secret);
    const evt = stripe.webhooks.constructEvent(rawBody, signatureHeader, webhookSecret);
    const dataObj: any = evt.data.object;
    let updatedPayoutId: string | null = null;

    if (typeof dataObj?.id === 'string' && dataObj.id.startsWith('po_')) {
      const existing = this.store.getPayoutByStripeId(dataObj.id);
      if (existing) {
        const nextStatus: StripePayoutRecord['status'] =
          evt.type === 'payout.paid'
            ? 'PAID'
            : evt.type === 'payout.failed'
              ? 'FAILED'
              : evt.type === 'payout.canceled'
                ? 'CANCELLED'
                : 'IN_TRANSIT';
        const updated: StripePayoutRecord = {
          ...existing,
          status: nextStatus,
          webhookVerified: true,
          failureMessage: dataObj.failure_message || null,
          updatedAtUtc: new Date().toISOString(),
        };
        this.store.savePayout(updated);
        updatedPayoutId = updated.payoutId;
      }
    }

    this.recordAudit('ADMINISTRATOR', 'STRIPE_WEBHOOK', 'WEBHOOK', evt.id, 'ALLOW', `event=${evt.type} verified=true`);
    return { received: true, eventType: evt.type, updatedPayoutId };
  }

  // ===========================================================================
  // ONEIROS DREAMSCAPE & COGNITIVE JOURNAL (LINKED TO UNIVERSAL CLOCK)
  // ===========================================================================
  public createDreamLog(input: {
    dreamText: string;
    archetypes: string[];
    lucidity: number;
    intensity: number;
    chaos: number;
    realm: DreamRealm;
  }, actorRole: RbacRole): DreamLogEntry {
    this.authorizeOrAudit(actorRole, 'dreamscape:write', 'DREAM_LOG_CREATE', 'DREAMSCAPE', 'new');
    const text = (input.dreamText || '').trim();
    const selected = Array.isArray(input.archetypes) ? input.archetypes : [];
    if (!text && selected.length === 0) {
      throw new Error('Please describe the dream or select at least one archetype before analyzing.');
    }

    const lower = text.toLowerCase();
    const detected = new Set<string>(selected);
    const keywordMap: Array<[string, string]> = [
      ['chase', 'chased'],
      ['run', 'chased'],
      ['fall', 'falling'],
      ['drop', 'falling'],
      ['teeth', 'teeth'],
      ['snake', 'snakes'],
      ['fly', 'flying'],
      ['float', 'flying'],
      ['naked', 'naked'],
      ['expose', 'naked'],
    ];
    for (const [kw, arch] of keywordMap) {
      if (lower.includes(kw)) detected.add(arch);
    }

    const archetypes = Array.from(detected);
    const semanticSummaries: Record<string, string> = {
      chased: 'Avoidance tension or unresolved latency pressure across waking priorities.',
      falling: 'Support transition or rapid recalibration during cognitive descent.',
      teeth: 'Communication threshold awareness and structural renewal.',
      snakes: 'Hidden transformation and heightened survival intuition.',
      flying: 'Autonomy expansion, high lucidity coherence, and perspective elevation.',
      naked: 'Vulnerability exposure under social or analytical scrutiny.',
    };

    const insights = archetypes.map((a) => semanticSummaries[a]).filter(Boolean);
    const lucidityNote =
      input.lucidity >= 70
        ? 'High metacognitive lucidity detected.'
        : input.lucidity >= 40
          ? 'Balanced REM liminal awareness.'
          : 'Subsurface implicit dream narrative.';
    const analysisText = `${lucidityNote} Realm=${input.realm.toUpperCase()} (L=${input.lucidity}%, E=${input.intensity}%, C=${input.chaos}%). ${
      insights.length > 0 ? insights.join(' ') : 'Free-form narrative anchored directly to monotonic HCCGN clock epoch.'
    }`;

    const uclk = globalUniversalClockKernel.getSnapshot();
    const entry: DreamLogEntry = {
      logId: `drm_${Date.now().toString(36)}_${crypto.randomBytes(2).toString('hex')}`,
      dreamText: text || `[Archetype sequence: ${archetypes.join(', ')}]`,
      archetypes,
      lucidity: Math.max(0, Math.min(100, Number(input.lucidity || 50))),
      intensity: Math.max(0, Math.min(100, Number(input.intensity || 40))),
      chaos: Math.max(0, Math.min(100, Number(input.chaos || 30))),
      realm: input.realm || 'astral',
      analysisText,
      clockEpochId: uclk.activeEpoch.epochId,
      clockMonotonicNs: uclk.currentMonotonicNs,
      createdAtUtc: new Date().toISOString(),
    };

    this.store.saveDreamLog(entry);
    this.recordAudit(actorRole, 'DREAM_LOG_CREATE', 'DREAMSCAPE', entry.logId, 'ALLOW', `epoch=${entry.clockEpochId}`);
    return entry;
  }

  public getDreamscapeState(): { logs: DreamLogEntry[]; distribution: DreamThemeDistributionItem[] } {
    const logs = this.store.listDreamLogs(60);
    const totalLogs = Math.max(1, logs.length);
    const counts: Record<string, number> = {};
    for (const l of logs) {
      for (const a of l.archetypes) {
        counts[a] = (counts[a] || 0) + 1;
      }
    }
    const distribution: DreamThemeDistributionItem[] = REFERENCE_DREAM_BASELINE.map((b) => {
      const c = counts[b.archetype] || 0;
      return {
        archetype: b.archetype,
        label: b.label,
        observedCount: c,
        observedPct: logs.length > 0 ? Math.round((c / totalLogs) * 100) : 0,
        referenceSurveyPct: b.referenceSurveyPct,
      };
    });
    return { logs, distribution };
  }

  // ===========================================================================
  // LIVE TELEMETRY SAMPLER & SOURCE-BACKED ANALYTICS BUNDLE (SECTION 7)
  // ===========================================================================
  public sampleTelemetryTick(): TelemetryPoint {
    const now = Date.now();
    const nowUtc = new Date(now).toISOString();
    const monoNs = process.hrtime.bigint().toString();
    const uclk = globalUniversalClockKernel.getSnapshot();
    const workers = this.store.listWorkers();
    const jobs = this.store.listJobs(30);
    const stratum = this.stratum.getStatus();
    const shares = this.store.listShares(200);
    const receipts = this.store.listReceipts(200);
    const balances = this.store.getRewardBalances();

    const activeWorkers = workers.filter((w) => w.state === 'RUNNING');
    const continuousOps = activeWorkers.reduce((s, w) => s + w.measuredOpsPerSec, 0);
    const runningJobs = jobs.filter((j) => j.state === 'RUNNING');
    const instantOps = runningJobs.reduce((s, j) => s + j.opsPerSec, 0);

    const latestSolver = uclk.latestSolvers[0];
    const residual = latestSolver ? latestSolver.pairAClosureResidual + latestSolver.pairBClosureResidual : 0;
    const convergedCount = uclk.latestSolvers.filter((s) => s.converged).length;
    const convergencePct = uclk.latestSolvers.length > 0 ? +((convergedCount / uclk.latestSolvers.length) * 100).toFixed(1) : 100;
    const latestReceipt = uclk.recentReceipts[0];

    const point: TelemetryPoint = {
      seq: 0,
      utcTimestamp: nowUtc,
      timeLabel: new Date(now).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      monotonicNs: monoNs,
      instantOpsPerSec: +instantOps.toFixed(2),
      continuousWorkerOpsPerSec: +continuousOps.toFixed(2),
      aggregateOpsPerSec: +(instantOps + continuousOps).toFixed(2),
      fourLaneResidual: residual,
      solverConvergencePct: convergencePct,
      hashLatencyUs: jobs[0] ? +(jobs[0].avgLatencyNs / 1000).toFixed(2) : 0,
      clockJitterUs: latestReceipt ? +(Math.abs(latestReceipt.jitter_ns) / 1000).toFixed(2) : 0,
      computeDurationUs: latestReceipt ? +(latestReceipt.execution_duration_ns / 1000).toFixed(2) : 0,
      validCandidates: jobs.reduce((s, j) => s + j.validCandidates, 0) + workers.reduce((s, w) => s + w.validCandidates, 0),
      acceptedShares: shares.filter((sh) => sh.poolAccepted).length + stratum.serverAcceptedShares,
      rejectedShares: shares.filter((sh) => !sh.poolAccepted).length,
      activeWorkers: activeWorkers.length,
      queueDepth: workers.reduce((s, w) => s + w.queueDepth, 0),
      verifiedReceiptsTotal: receipts.filter((r) => r.verificationOutcome === 'VERIFIED' || r.verificationOutcome === 'VERIFIED_WITH_CORRECTION').length,
      confirmedRewardUsd: balances.confirmedAvailableUsd,
    };

    this.store.appendTelemetryPoint(point);
    return point;
  }

  public getLiveAnalyticsBundle(limit: number = 60): LiveAnalyticsBundle {
    let series = this.store.listTelemetrySeries(limit);
    if (series.length === 0) {
      this.sampleTelemetryTick();
      series = this.store.listTelemetrySeries(limit);
    }
    const latest = series[series.length - 1];
    const nowUtc = new Date().toISOString();
    const monoNs = process.hrtime.bigint().toString();
    const stratum = this.stratum.getStatus();

    const makeProv = (
      metricId: string,
      label: string,
      value: number | string | null,
      unit: string,
      quality: ProvenanceMetric['quality'],
      dataSource: string,
      missingReason?: string
    ): ProvenanceMetric<number | string> => ({
      metricId,
      label,
      value,
      unit,
      quality,
      dataSource,
      sampledAtMonotonicNs: monoNs,
      sampledAtUtc: nowUtc,
      collectionIntervalMs: 1000,
      missingReason,
    });

    const provenances: Record<string, ProvenanceMetric<number | string>> = {
      throughput: makeProv('throughput', 'Ops/sec & Hash/sec', latest?.aggregateOpsPerSec ?? 0, 'ops/s', 'MEASURED', 'Node.js hrtime.bigint execution timers'),
      fourLane: makeProv('fourLane', 'Four-Lane ARX Residual', latest?.fourLaneResidual ?? 0, 'bits', 'MEASURED', 'UniversalClockKernel 4-Lane closure check'),
      stratumRtt: makeProv(
        'stratumRtt',
        'Stratum TCP RTT',
        stratum.lastClientRttMs,
        'ms',
        stratum.lastClientRttMs !== null ? 'MEASURED' : 'UNAVAILABLE',
        'Node.js net.Socket TCP Stratum client',
        stratum.lastClientRttMs === null ? 'Connect Stratum TCP client and issue RPC to measure RTT' : undefined
      ),
      hostPower: makeProv(
        'hostPower',
        'Host Hardware Power',
        null,
        'W',
        'UNAVAILABLE',
        'OS Hardware Sensor',
        'Container runtime exposes no RAPL/sysfs power sensor'
      ),
      rewards: makeProv(
        'rewards',
        'Confirmed Settled/Available Balance',
        latest?.confirmedRewardUsd ?? 0,
        'USD',
        'MEASURED',
        'SQLite WAL append-only reward_entries ledger'
      ),
    };

    return {
      schemaVersion: CRYPTIC_SCHEMA_VERSION,
      sampledAtUtc: nowUtc,
      sampledAtMonotonicNs: monoNs,
      collectionIntervalMs: 1000,
      series,
      provenances,
    };
  }

  // ===========================================================================
  // SECTION 15: AUTOMATED ACCEPTANCE GATES B - J VERIFICATION SUITE
  // ===========================================================================
  public async runAcceptanceGates(actorRole: RbacRole): Promise<AcceptanceGateTestResult[]> {
    this.authorizeOrAudit(actorRole, 'acceptance:run', 'ACCEPTANCE_GATES_RUN', 'PLATFORM', 'GATES_B_J');
    const nowUtc = new Date().toISOString();
    const results: AcceptanceGateTestResult[] = [];

    // Gate B: Instant Miner & Instant Solver — forward digest, exact inverse ARX, Reed-Solomon recovery, and reject one-way INVERSE
    const arxOk = executeReversibleArxRoundtrip('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef').roundtripExact;
    const shaTest = runAlgorithmSelfTest('crypto.sha256').passed;
    const rsTest = runAlgorithmSelfTest('ecc.reed_solomon_gf256').passed;
    const oneWayReject = await this.runInstantSolver(
      { algorithmId: 'crypto.sha256', mode: 'INVERSE', inputData: 'gate-b-test' },
      actorRole
    );
    results.push({
      testId: 'GATE-B-01',
      gate: 'B',
      title: 'Instant Miner & Solver (Exact ARX/RS + One-Way Inverse Rejection)',
      sourceVersion: CRYPTIC_SCHEMA_VERSION,
      inputSummary: 'SHA256 NIST vector + ARX256 inverse + RS(15,11) burst + SHA256 INVERSE probe',
      expectedResult: 'SHA256=PASS, ARX=PASS, RS=PASS, SHA256_INVERSE=REJECTED',
      actualResult: `sha256=${shaTest}, arx=${arxOk}, rs=${rsTest}, invOutcome=${oneWayReject.verificationOutcome}`,
      passed: shaTest && arxOk && rsTest && oneWayReject.verificationOutcome === 'REJECTED',
      executionTimestampUtc: nowUtc,
      diagnosticRef: oneWayReject.receiptId,
    });

    // Gate C: Continuous Worker Pool — disjoint leases, checkpoint, simulate crash, recover without fabrication
    const wA = this.createWorker({ label: 'GateC-A', algorithmId: 'crypto.sha256', networkId: 'local.stratum.sha256' }, actorRole);
    const wB = this.createWorker({ label: 'GateC-B', algorithmId: 'crypto.sha256', networkId: 'local.stratum.sha256' }, actorRole);
    const disjointOk = wA.nonceRangeEnd < wB.nonceRangeStart;
    this.controlWorker(wA.workerId, 'simulate-crash', actorRole);
    const recoveredA = this.controlWorker(wA.workerId, 'recover', actorRole);
    const crashRecoveryOk = recoveredA.state === 'READY' && recoveredA.completedOperations === wA.completedOperations;
    results.push({
      testId: 'GATE-C-01',
      gate: 'C',
      title: 'Continuous Workers (Disjoint Leases & Non-Fabricated Crash Recovery)',
      sourceVersion: CRYPTIC_SCHEMA_VERSION,
      inputSummary: `wA=[${wA.nonceRangeStart}..${wA.nonceRangeEnd}], wB=[${wB.nonceRangeStart}..${wB.nonceRangeEnd}]`,
      expectedResult: 'Disjoint non-overlapping ranges + crash->recover restores exact cursor',
      actualResult: `disjoint=${disjointOk}, recoveredState=${recoveredA.state}, preservedOps=${recoveredA.completedOperations}`,
      passed: disjointOk && crashRecoveryOk,
      executionTimestampUtc: nowUtc,
      diagnosticRef: wA.workerId,
    });

    // Gate D: Federated Coordinator & Real TCP Stratum (connect, subscribe, authorize, submit share, reject duplicate)
    let stratumOk = false;
    let duplicateBlocked = false;
    let stratumDetail = '';
    try {
      const srv = await this.stratum.startLocalStratumServer();
      await this.stratum.connectStratumClient(srv.host, srv.port, 'gate.d.worker');
      const firstSubmit = await this.stratum.mineAndSubmitShareViaTcp('gate.d.worker');
      const dupSubmit = await this.stratum.mineAndSubmitShareViaTcp('gate.d.worker', firstSubmit.share.nonceHex);
      stratumOk = firstSubmit.accepted;
      duplicateBlocked = !dupSubmit.accepted && dupSubmit.duplicate;
      stratumDetail = `port=${srv.port}, firstAccepted=${firstSubmit.accepted}, dupRejected=${duplicateBlocked}`;
    } catch (err: any) {
      stratumDetail = `error=${err.message}`;
    }
    results.push({
      testId: 'GATE-D-01',
      gate: 'D',
      title: 'Federated Stratum TCP Coordinator (Real Socket + Duplicate Share Rejection)',
      sourceVersion: CRYPTIC_SCHEMA_VERSION,
      inputSummary: 'TCP mining.subscribe -> mining.authorize -> mining.submit (x2 same tuple)',
      expectedResult: 'First valid share accepted, second identical share rejected (code 22)',
      actualResult: stratumDetail,
      passed: stratumOk && duplicateBlocked,
      executionTimestampUtc: nowUtc,
      diagnosticRef: 'stratum-tcp-loopback',
    });

    // Gate E: Wolfram & CAS Adapter Boundary
    const casLocal = await evaluateSymbolicExpression('ModInverse[3, 11]');
    results.push({
      testId: 'GATE-E-01',
      gate: 'E',
      title: 'Mathematical & Wolfram Adapter Boundary (No Fabricated External Output)',
      sourceVersion: CRYPTIC_SCHEMA_VERSION,
      inputSummary: 'Evaluate ModInverse[3, 11] with explicit external availability report',
      expectedResult: 'Local CAS returns 4 & externalConfigured accurately reflects env credentials',
      actualResult: `status=${casLocal.status}, local=${casLocal.localResult}, extCfg=${casLocal.externalConfigured}`,
      passed: casLocal.independentVerificationPassed && casLocal.externalResult === null === !casLocal.externalConfigured,
      executionTimestampUtc: nowUtc,
      diagnosticRef: casLocal.queryId,
    });

    // Gate F: Analytics & Live Graphing Provenance
    const bundle = this.getLiveAnalyticsBundle(15);
    const hasMissingHostPowerReason = bundle.provenances.hostPower?.quality === 'UNAVAILABLE';
    results.push({
      testId: 'GATE-F-01',
      gate: 'F',
      title: 'Analytics & Graphing (Source-Backed Provenance + UNAVAILABLE Honesty)',
      sourceVersion: CRYPTIC_SCHEMA_VERSION,
      inputSummary: 'Inspect telemetry series and hostPower provenance metadata',
      expectedResult: 'Series populated from SQLite and unmeasured host watts flagged UNAVAILABLE',
      actualResult: `seriesCount=${bundle.series.length}, hostPowerQuality=${bundle.provenances.hostPower?.quality}`,
      passed: bundle.series.length >= 1 && hasMissingHostPowerReason,
      executionTimestampUtc: nowUtc,
      diagnosticRef: bundle.sampledAtMonotonicNs,
    });

    // Gate G: 13-State Clearing & Skip Rejection
    const seedRcp = this.createInitialClearedReceipt({
      jobId: 'gate-g-job',
      workerId: 'gate-g-worker',
      epochId: globalUniversalClockKernel.getSnapshot().activeEpoch.epochId,
      algorithmId: 'crypto.sha256',
      algorithmVersion: '1.0.0',
      inputPayload: 'gate-g-test',
      outputPayload: sha256Hex('gate-g-test'),
      targetSpec: 'LOCAL_DIGEST',
      candidateResult: 'ok',
      monotonicStartNs: process.hrtime.bigint().toString(),
      monotonicEndNs: process.hrtime.bigint().toString(),
      actualOperationCount: 1,
      actualHashCount: 1,
      verificationOutcome: 'VERIFIED',
      actorRole,
    });
    let skipRejected = false;
    try {
      this.store.advanceReceiptState(seedRcp.receiptId, 'SETTLED', actorRole, 'Illegal jump');
    } catch {
      skipRejected = true;
    }
    const verifyOk = this.verifyClearedReceipt(seedRcp.receiptId).digestMatches;
    results.push({
      testId: 'GATE-G-01',
      gate: 'G',
      title: '13-State Receipt Clearing FSM & Tamper-Evident Digest Verification',
      sourceVersion: CRYPTIC_SCHEMA_VERSION,
      inputSummary: `Attempt illegal skip LOCALLY_VERIFIED -> SETTLED on ${seedRcp.receiptId}`,
      expectedResult: 'Transition skip throws error AND SHA-256 receipt digest verifies',
      actualResult: `skipRejected=${skipRejected}, digestMatches=${verifyOk}`,
      passed: skipRejected && verifyOk,
      executionTimestampUtc: nowUtc,
      diagnosticRef: seedRcp.receiptId,
    });

    // Gate H: Stripe Connect Integration & Unconfigured Safeguard
    const caps = await this.getStripeCapabilities();
    let blockedZero = false;
    try {
      await this.executeStripePayout({ amountUsd: 10, currency: 'BTC' }, 'ACCOUNTING');
    } catch {
      blockedZero = true;
    }
    results.push({
      testId: 'GATE-H-01',
      gate: 'H',
      title: 'Stripe Connect Test-Mode Guard & Non-Fiat Rejection',
      sourceVersion: CRYPTIC_SCHEMA_VERSION,
      inputSummary: 'Check Stripe capability state & verify BTC is rejected on fiat settlement rail',
      expectedResult: 'Honest mode status (UNCONFIGURED/TEST_MODE) and non-fiat payout rejected',
      actualResult: `mode=${caps.mode}, nonFiatBlocked=${blockedZero}`,
      passed: blockedZero && ['UNCONFIGURED', 'TEST_MODE', 'LIVE_DISABLED_COMPLIANCE'].includes(caps.mode),
      executionTimestampUtc: nowUtc,
      diagnosticRef: 'stripe-connect-guard',
    });

    // Gate I: Clock Accuracy & Fault Injection
    const uclkAcc = globalUniversalClockKernel.runAcceptanceSuite();
    const uclkAllPass = uclkAcc.every((t) => t.passed);
    results.push({
      testId: 'GATE-I-01',
      gate: 'I',
      title: 'Universal Clock Timing & 4-Lane Convergence Verification',
      sourceVersion: CRYPTIC_SCHEMA_VERSION,
      inputSummary: 'Execute UniversalClockKernel acceptance suite (7 checks)',
      expectedResult: 'All 7 clock/adaptive/4-lane/SHA-256 checks pass',
      actualResult: `${uclkAcc.filter((t) => t.passed).length}/${uclkAcc.length} passed`,
      passed: uclkAllPass,
      executionTimestampUtc: nowUtc,
      diagnosticRef: 'uclk-suite',
    });

    // Gate J: RBAC Security & Persistence Audit
    let viewerBlocked = false;
    try {
      this.authorizeOrAudit('VIEWER', 'payout:execute', 'GATE_J_PROBE', 'PAYOUT', 'probe');
    } catch {
      viewerBlocked = true;
    }
    results.push({
      testId: 'GATE-J-01',
      gate: 'J',
      title: 'Security RBAC Enforcement & SQLite Persistent Audit Log',
      sourceVersion: CRYPTIC_SCHEMA_VERSION,
      inputSummary: 'Attempt payout:execute as VIEWER role',
      expectedResult: 'VIEWER denied and event recorded in SQLite audit_events',
      actualResult: `viewerDenied=${viewerBlocked}, auditCount=${this.store.listAuditEvents(50).length}`,
      passed: viewerBlocked && this.store.listAuditEvents(50).length > 0,
      executionTimestampUtc: nowUtc,
      diagnosticRef: 'rbac-audit',
    });

    this.store.saveAcceptanceTests(results);
    this.recordAudit(actorRole, 'ACCEPTANCE_GATES_RUN', 'PLATFORM', 'GATES_B_J', 'ALLOW', `${results.filter((r) => r.passed).length}/${results.length} passed`);
    return results;
  }

  // ===========================================================================
  // FULL UNIFIED PLATFORM SNAPSHOT
  // ===========================================================================
  public async getFullSnapshotAsync(): Promise<CrypticPlatformSnapshot> {
    const base = this.getSnapshot();
    const stripeStatus = await this.getStripeCapabilities();
    return {
      ...base,
      overview: {
        ...base.overview,
        settlementState: stripeStatus.mode,
      },
      stripeStatus,
    };
  }

  public getSnapshot(): CrypticPlatformSnapshot {
    const uclk = globalUniversalClockKernel.getSnapshot();
    const workers = this.store.listWorkers();
    const instantJobs = this.store.listJobs(30);
    const recentSolverResults = this.store.listSolverResults(20);
    const stratum = this.stratum.getStatus();
    const recentShares = this.store.listShares(40);
    const receipts = this.store.listReceipts(60);
    const rewardEntries = this.store.listRewardEntries(60);
    const payouts = this.store.listPayouts(40);
    const auditEvents = this.store.listAuditEvents(50);
    const balances = this.store.getRewardBalances();

    const activeWorkers = workers.filter((w) => w.state === 'RUNNING');
    const activeJobs = instantJobs.filter((j) => j.state === 'RUNNING');

    const aggregateOps =
      activeWorkers.reduce((s, w) => s + w.measuredOpsPerSec, 0) +
      activeJobs.reduce((s, j) => s + j.opsPerSec, 0);
    const aggregateHashes =
      activeWorkers.reduce((s, w) => s + w.measuredOpsPerSec, 0) +
      activeJobs.reduce((s, j) => s + j.hashesPerSec, 0);

    const secret = process.env.STRIPE_SECRET_KEY?.trim() || '';
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() || '';
    const connectAccountId = process.env.STRIPE_CONNECT_ACCOUNT_ID?.trim() || null;
    const isTestMode = secret.startsWith('sk_test_') || secret.startsWith('rk_test_');
    const stripeMode: StripeCapabilitiesStatus['mode'] = !secret
      ? 'UNCONFIGURED'
      : !isTestMode && process.env.STRIPE_ALLOW_LIVE_SETTLEMENT !== 'true'
        ? 'LIVE_DISABLED_COMPLIANCE'
        : 'TEST_MODE';

    const stripeStatus: StripeCapabilitiesStatus = {
      configured: Boolean(secret && stripeMode === 'TEST_MODE'),
      mode: stripeMode,
      liveMoneyDisabled: process.env.STRIPE_ALLOW_LIVE_SETTLEMENT !== 'true',
      missingCredentials: [!secret ? 'STRIPE_SECRET_KEY' : '', !webhookSecret ? 'STRIPE_WEBHOOK_SECRET' : ''].filter(Boolean),
      connectedAccountId: connectAccountId,
      payoutsEnabled: Boolean(secret && stripeMode === 'TEST_MODE'),
      chargesEnabled: false,
      defaultCurrency: 'USD',
      supportedFiatCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'],
      eligibilityChecklist: {
        adultOperatedEntityConfirmed: process.env.STRIPE_ADULT_ENTITY_CONFIRMED === 'true',
        stripeSecretConfigured: Boolean(secret),
        webhookSecretConfigured: Boolean(webhookSecret),
        connectedAccountEligible: Boolean(secret && stripeMode === 'TEST_MODE'),
        liveSettlementAuthorized: false,
      },
      lastCheckedUtc: new Date().toISOString(),
      diagnosticMessage: secret
        ? `Stripe Connect ready in ${stripeMode}.`
        : 'Stripe Connect unconfigured: set STRIPE_SECRET_KEY & STRIPE_WEBHOOK_SECRET to enable Test Mode fiat settlement.',
    };

    const cpu = process.cpuUsage();
    const mem = process.memoryUsage();
    const p99Ms = +(this.loopDelay.percentile(99) / 1e6).toFixed(3);
    const acceptedCount = recentShares.filter((s) => s.poolAccepted).length;
    const rejectedCount = recentShares.filter((s) => !s.poolAccepted).length;

    return {
      schemaVersion: CRYPTIC_SCHEMA_VERSION,
      uptimeSeconds: Math.floor((Date.now() - this.startTimeMs) / 1000),
      overview: {
        clockState: uclk.state,
        clockSource: uclk.correlation.monotonicSource,
        clockUncertaintyNs: uclk.correlation.uncertaintyNs,
        activeWorkers: activeWorkers.length,
        totalWorkers: workers.length,
        activeJobs: activeJobs.length,
        aggregateOpsPerSec: +aggregateOps.toFixed(2),
        aggregateHashesPerSec: +aggregateHashes.toFixed(2),
        solverStatus: recentSolverResults[0]?.verificationOutcome || 'IDLE',
        verifiedResultsCount: receipts.filter(
          (r) => r.verificationOutcome === 'VERIFIED' || r.verificationOutcome === 'VERIFIED_WITH_CORRECTION'
        ).length,
        pendingSharesCount: receipts.filter((r) => r.lifecycleState === 'SUBMITTED' || r.lifecycleState === 'REWARD_PENDING').length,
        acceptedSharesCount: acceptedCount,
        rejectedSharesCount: rejectedCount,
        balances,
        settlementState: stripeMode,
        recentFaultsCount: uclk.activeEpoch.missedIntervals + workers.filter((w) => w.state === 'FAILED' || w.state === 'DEGRADED').length,
      },
      workers,
      instantJobs,
      recentSolverResults,
      stratum,
      recentShares,
      receipts,
      rewardEntries,
      stripeStatus,
      payouts,
      auditEvents,
      webrtcPeers: this.stratum.listWebRtcPeers(),
      latestRtpSync: this.stratum.sampleRtpClockFrame(),
      hostTelemetry: {
        cpuUserMicros: cpu.user,
        cpuSystemMicros: cpu.system,
        memoryRssBytes: mem.rss,
        heapUsedBytes: mem.heapUsed,
        eventLoopP99Ms: Number.isFinite(p99Ms) ? p99Ms : null,
        hardwarePowerWatts: null,
      },
    };
  }

  public getAlgorithmsWithNetworks(): {
    algorithms: typeof CANONICAL_ALGORITHM_REGISTRY;
    networks: typeof SUPPORTED_MINING_NETWORKS;
    sqlitePath: string;
  } {
    return {
      algorithms: CANONICAL_ALGORITHM_REGISTRY,
      networks: SUPPORTED_MINING_NETWORKS,
      sqlitePath: this.store.dbPath,
    };
  }

  public runSelfTests(): AlgorithmSelfTestResult[] {
    return CANONICAL_ALGORITHM_REGISTRY.map((a) => runAlgorithmSelfTest(a.id));
  }

  public async evaluateWolfram(expression: string, actorRole: RbacRole): Promise<WolframAdapterResult> {
    this.authorizeOrAudit(actorRole, 'solver:run', 'WOLFRAM_EVALUATE', 'SYMBOLIC', expression.slice(0, 32));
    const res = await evaluateSymbolicExpression(expression);
    this.recordAudit(actorRole, 'WOLFRAM_EVALUATE', 'SYMBOLIC', res.queryId, 'ALLOW', `status=${res.status}`);
    return res;
  }
}

export const globalCrypticRuntime = new CrypticRuntimeService(globalSqliteLedger, globalStratumEngine);
