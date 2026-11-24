/**
 * =============================================================================
 * SPECIFICATION: HCCGN.CRYPTIC.INSTANT.MINER v1.0.0 — Section 8, 9, 10, 11
 * MODULE: Durable Node.js SQLite WAL Ledger Store
 * ENGINE: Built-in node:sqlite (DatabaseSync) with PRAGMA journal_mode = WAL
 * =============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
  AlgorithmRegistryEntry,
  AuditEventRecord,
  AcceptanceGateTestResult,
  ClearedReceiptRecord,
  ContinuousWorkerRecord,
  ContinuousWorkerState,
  DreamLogEntry,
  DreamRealm,
  InstantMinerSession,
  InstantSolverResult,
  RbacRole,
  ReceiptLifecycleState,
  ReceiptTransitionLog,
  RewardAccountingEntry,
  RewardBalancesSummary,
  StratumJobRecord,
  StratumShareSubmissionRecord,
  StripePayoutRecord,
  TelemetryPoint,
  WorkerTransitionEvent,
} from '../contracts/cryptic-platform';
import { CANONICAL_ALGORITHM_REGISTRY } from './algorithmRegistry';
import type {
  GaiaMemoryEventRecord,
  HygieneScanReport,
  LexicalCorpusIndexEntry,
  MerkleBatchRecord,
  TraceableExecutionReceiptR,
} from '../contracts/gaia-v61';
import type {
  ArbitrageOpportunityEvaluation,
  PaperEvaluationReceipt,
} from '../contracts/arbitrage';
import type {
  MiningTelemetryReceipt,
} from '../contracts/mining-profiles';

interface SqliteStatement {
  run: (...params: unknown[]) => { changes: number; lastInsertRowid: number | bigint };
  get: (...params: unknown[]) => Record<string, unknown> | undefined;
  all: (...params: unknown[]) => Record<string, unknown>[];
}

interface SqliteDatabase {
  exec: (sql: string) => void;
  prepare: (sql: string) => SqliteStatement;
  close: () => void;
}

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (filename: string) => SqliteDatabase;
};

const ORDERED_RECEIPT_STATES: readonly ReceiptLifecycleState[] = [
  'CREATED',
  'COMPUTATION_COMPLETE',
  'LOCALLY_VERIFIED',
  'SUBMITTED',
  'POOL_ACKNOWLEDGED',
  'SHARE_ACCEPTED',
  'REWARD_PENDING',
  'REWARD_CONFIRMED',
  'SETTLEMENT_ELIGIBLE',
  'SETTLED',
];

const ALLOWED_RECEIPT_TRANSITIONS: Record<ReceiptLifecycleState, readonly ReceiptLifecycleState[]> = {
  CREATED: ['COMPUTATION_COMPLETE', 'REJECTED'],
  COMPUTATION_COMPLETE: ['LOCALLY_VERIFIED', 'REJECTED'],
  LOCALLY_VERIFIED: ['SUBMITTED', 'REWARD_PENDING', 'REJECTED'],
  SUBMITTED: ['POOL_ACKNOWLEDGED', 'REJECTED', 'DISPUTED'],
  POOL_ACKNOWLEDGED: ['SHARE_ACCEPTED', 'REJECTED', 'DISPUTED'],
  SHARE_ACCEPTED: ['REWARD_PENDING', 'DISPUTED'],
  REWARD_PENDING: ['REWARD_CONFIRMED', 'REJECTED', 'DISPUTED'],
  REWARD_CONFIRMED: ['SETTLEMENT_ELIGIBLE', 'DISPUTED', 'REVERSED'],
  SETTLEMENT_ELIGIBLE: ['SETTLED', 'DISPUTED', 'REVERSED'],
  SETTLED: ['REVERSED'],
  REJECTED: [],
  DISPUTED: ['REWARD_CONFIRMED', 'REJECTED', 'REVERSED'],
  REVERSED: [],
};

export class SqliteLedgerStore {
  private readonly db: SqliteDatabase;
  public readonly dbPath: string;

  constructor(customPath?: string) {
    const resolved = customPath || process.env.CRYPTIC_SQLITE_PATH || './storage/cryptic-ledger.sqlite';
    this.dbPath = path.resolve(resolved);
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    let dbInstance: SqliteDatabase;
    try {
      dbInstance = new DatabaseSync(this.dbPath);
      dbInstance.exec('PRAGMA journal_mode = WAL;');
    } catch (err: any) {
      console.warn(`[SqliteLedgerStore] Database malformed or corrupted (${err.message}). Recovering clean database...`);
      try {
        if (fs.existsSync(this.dbPath)) fs.renameSync(this.dbPath, `${this.dbPath}.corrupted.${Date.now()}`);
        if (fs.existsSync(`${this.dbPath}-wal`)) fs.unlinkSync(`${this.dbPath}-wal`);
        if (fs.existsSync(`${this.dbPath}-shm`)) fs.unlinkSync(`${this.dbPath}-shm`);
      } catch {
        // Safe fallback
      }
      dbInstance = new DatabaseSync(this.dbPath);
      dbInstance.exec('PRAGMA journal_mode = WAL;');
    }
    this.db = dbInstance;
    this.db.exec('PRAGMA synchronous = NORMAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.initializeSchema();
    this.seedAlgorithms();
    this.reconcileWorkersOnBoot();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS algorithms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        version TEXT NOT NULL,
        category TEXT NOT NULL,
        operation_type TEXT NOT NULL,
        is_invertible INTEGER NOT NULL,
        is_one_way_hash INTEGER NOT NULL,
        is_pow_algorithm INTEGER NOT NULL,
        definition_json TEXT NOT NULL,
        updated_at_utc TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS jobs (
        job_id TEXT PRIMARY KEY,
        schema_version TEXT NOT NULL,
        algorithm_id TEXT NOT NULL,
        network_id TEXT NOT NULL,
        state TEXT NOT NULL,
        session_json TEXT NOT NULL,
        created_at_utc TEXT NOT NULL,
        updated_at_utc TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS solver_results (
        solve_id TEXT PRIMARY KEY,
        algorithm_id TEXT NOT NULL,
        mode TEXT NOT NULL,
        verification_outcome TEXT NOT NULL,
        receipt_id TEXT NOT NULL,
        result_json TEXT NOT NULL,
        created_at_utc TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workers (
        worker_id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        epoch_id TEXT NOT NULL,
        algorithm_id TEXT NOT NULL,
        network_id TEXT NOT NULL,
        state TEXT NOT NULL,
        nonce_range_start INTEGER NOT NULL,
        nonce_range_end INTEGER NOT NULL,
        current_cursor INTEGER NOT NULL,
        lease_id TEXT NOT NULL,
        lease_expires_at_ms INTEGER NOT NULL,
        worker_json TEXT NOT NULL,
        updated_at_utc TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS worker_transitions (
        id TEXT PRIMARY KEY,
        worker_id TEXT NOT NULL,
        from_state TEXT NOT NULL,
        to_state TEXT NOT NULL,
        reason TEXT NOT NULL,
        monotonic_ns TEXT NOT NULL,
        utc_timestamp TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS epochs (
        epoch_id TEXT PRIMARY KEY,
        monotonic_origin_ns TEXT NOT NULL,
        deadline_ns TEXT NOT NULL,
        actual_elapsed_ns TEXT NOT NULL,
        completed_ops INTEGER NOT NULL,
        completed_bytes INTEGER NOT NULL,
        missed_intervals INTEGER NOT NULL,
        summary_json TEXT NOT NULL,
        closed_at_utc TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS computation_batches (
        batch_id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        worker_id TEXT NOT NULL,
        epoch_id TEXT NOT NULL,
        operation_count INTEGER NOT NULL,
        bytes_processed INTEGER NOT NULL,
        duration_ns TEXT NOT NULL,
        created_at_utc TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS candidates (
        candidate_id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        worker_id TEXT NOT NULL,
        algorithm_id TEXT NOT NULL,
        nonce INTEGER NOT NULL,
        digest_hex TEXT NOT NULL,
        meets_target INTEGER NOT NULL,
        verified_locally INTEGER NOT NULL,
        created_at_utc TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS stratum_jobs (
        stratum_job_id TEXT PRIMARY KEY,
        network_id TEXT NOT NULL,
        algorithm_id TEXT NOT NULL,
        prev_hash_hex TEXT NOT NULL,
        header_template_hex TEXT NOT NULL,
        extranonce1_hex TEXT NOT NULL,
        difficulty_zero_nibbles INTEGER NOT NULL,
        clean_jobs INTEGER NOT NULL,
        created_at_utc TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS shares (
        share_id TEXT PRIMARY KEY,
        worker_id TEXT NOT NULL,
        job_id TEXT NOT NULL,
        extranonce2_hex TEXT NOT NULL,
        ntime_hex TEXT NOT NULL,
        nonce_hex TEXT NOT NULL,
        candidate_digest_hex TEXT NOT NULL,
        meets_target INTEGER NOT NULL,
        pool_accepted INTEGER NOT NULL,
        pool_reject_reason TEXT,
        pool_rtt_ns TEXT NOT NULL,
        receipt_id TEXT NOT NULL,
        submitted_at_utc TEXT NOT NULL,
        UNIQUE(job_id, extranonce2_hex, ntime_hex, nonce_hex)
      );

      CREATE TABLE IF NOT EXISTS clock_measurements (
        sample_id TEXT PRIMARY KEY,
        monotonic_ns TEXT NOT NULL,
        utc_timestamp TEXT NOT NULL,
        jitter_us REAL NOT NULL,
        compute_duration_us REAL NOT NULL,
        source TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS telemetry_series (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        utc_timestamp TEXT NOT NULL,
        monotonic_ns TEXT NOT NULL,
        point_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS receipts (
        receipt_id TEXT PRIMARY KEY,
        schema_version TEXT NOT NULL,
        job_id TEXT NOT NULL,
        worker_id TEXT NOT NULL,
        epoch_id TEXT NOT NULL,
        algorithm_id TEXT NOT NULL,
        lifecycle_state TEXT NOT NULL,
        canonical_digest_sha256 TEXT NOT NULL,
        receipt_json TEXT NOT NULL,
        created_at_utc TEXT NOT NULL,
        updated_at_utc TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS receipt_transitions (
        transition_id TEXT PRIMARY KEY,
        receipt_id TEXT NOT NULL,
        from_state TEXT NOT NULL,
        to_state TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        note TEXT NOT NULL,
        monotonic_ns TEXT NOT NULL,
        utc_timestamp TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS reward_entries (
        entry_id TEXT PRIMARY KEY,
        receipt_id TEXT NOT NULL,
        job_id TEXT NOT NULL,
        worker_id TEXT NOT NULL,
        entry_type TEXT NOT NULL,
        currency TEXT NOT NULL,
        amount REAL NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE,
        fee_amount REAL NOT NULL,
        net_amount REAL NOT NULL,
        note TEXT NOT NULL,
        created_at_utc TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS payouts (
        payout_id TEXT PRIMARY KEY,
        stripe_payout_id TEXT,
        idempotency_key TEXT NOT NULL UNIQUE,
        actor_role TEXT NOT NULL,
        reward_entry_id TEXT,
        currency TEXT NOT NULL,
        gross_amount REAL NOT NULL,
        fee_amount REAL NOT NULL,
        net_amount REAL NOT NULL,
        destination_summary TEXT NOT NULL,
        settlement_rail TEXT NOT NULL,
        status TEXT NOT NULL,
        test_mode INTEGER NOT NULL,
        webhook_verified INTEGER NOT NULL,
        failure_message TEXT,
        created_at_utc TEXT NOT NULL,
        updated_at_utc TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_events (
        event_id TEXT PRIMARY KEY,
        actor_role TEXT NOT NULL,
        action TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        outcome TEXT NOT NULL,
        detail TEXT NOT NULL,
        monotonic_ns TEXT NOT NULL,
        utc_timestamp TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS acceptance_tests (
        test_id TEXT PRIMARY KEY,
        gate TEXT NOT NULL,
        result_json TEXT NOT NULL,
        executed_at_utc TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS dream_logs (
        log_id TEXT PRIMARY KEY,
        dream_text TEXT NOT NULL,
        archetypes_json TEXT NOT NULL,
        lucidity INTEGER NOT NULL,
        intensity INTEGER NOT NULL,
        chaos INTEGER NOT NULL,
        realm TEXT NOT NULL,
        analysis_text TEXT NOT NULL,
        clock_epoch_id TEXT NOT NULL,
        clock_monotonic_ns TEXT NOT NULL,
        created_at_utc TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS runtime_settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at_utc TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS memory_events (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL UNIQUE,
        schema_version TEXT NOT NULL,
        created_utc TEXT NOT NULL,
        source TEXT NOT NULL,
        project TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        payload_sha256 TEXT NOT NULL,
        payload_blake2b512 TEXT NOT NULL,
        previous_hash TEXT NOT NULL,
        event_hash TEXT NOT NULL,
        idempotency_key TEXT UNIQUE,
        tags_json TEXT NOT NULL,
        record_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS lexical_index (
        index_id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        token_count INTEGER NOT NULL,
        tokens_json TEXT NOT NULL,
        indexed_at_utc TEXT NOT NULL,
        FOREIGN KEY (event_id) REFERENCES memory_events(event_id)
      );

      CREATE TABLE IF NOT EXISTS trace_receipts_r (
        receipt_id TEXT PRIMARY KEY,
        subsystem TEXT NOT NULL,
        operation_id TEXT NOT NULL,
        utc_iso TEXT NOT NULL,
        monotonic_ns TEXT NOT NULL,
        accepted INTEGER NOT NULL,
        merkle_root_blake2b TEXT NOT NULL,
        receipt_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS merkle_batches (
        batch_id TEXT PRIMARY KEY,
        root_blake2b_hex TEXT NOT NULL,
        leaf_count INTEGER NOT NULL,
        created_at_utc TEXT NOT NULL,
        batch_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS hygiene_scans (
        scan_id TEXT PRIMARY KEY,
        scanned_at_utc TEXT NOT NULL,
        trojan_detected INTEGER NOT NULL,
        memory_chain_valid INTEGER NOT NULL,
        report_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS arbitrage_evaluations (
        opportunity_id TEXT PRIMARY KEY,
        pair TEXT NOT NULL,
        buy_market TEXT NOT NULL,
        sell_market TEXT NOT NULL,
        gross_spread_bps REAL NOT NULL,
        net_profit_usd REAL NOT NULL,
        net_return_bps REAL NOT NULL,
        status TEXT NOT NULL,
        evaluation_receipt_hash TEXT NOT NULL,
        evaluation_json TEXT NOT NULL,
        evaluated_at_utc TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS paper_arbitrage_receipts (
        receipt_id TEXT PRIMARY KEY,
        opportunity_id TEXT NOT NULL,
        pair TEXT NOT NULL,
        buy_market TEXT NOT NULL,
        sell_market TEXT NOT NULL,
        quantity_base REAL NOT NULL,
        net_profit_usd REAL NOT NULL,
        execution_status TEXT NOT NULL,
        deterministic_verification_digest TEXT NOT NULL,
        receipt_json TEXT NOT NULL,
        evaluated_at_utc TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS mining_telemetry_receipts (
        receipt_id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        worker_id TEXT NOT NULL,
        worker_count INTEGER NOT NULL,
        block_number INTEGER NOT NULL,
        attempts INTEGER NOT NULL,
        verified_candidates INTEGER NOT NULL,
        elapsed_us INTEGER NOT NULL,
        hashes_per_second REAL NOT NULL,
        best_digest_hex TEXT NOT NULL,
        merkle_root_hash TEXT NOT NULL,
        receipt_json TEXT NOT NULL,
        timestamp_utc TEXT NOT NULL
      );
    `);
  }

  private seedAlgorithms(): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO algorithms (
        id, name, version, category, operation_type,
        is_invertible, is_one_way_hash, is_pow_algorithm,
        definition_json, updated_at_utc
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const now = new Date().toISOString();
    for (const alg of CANONICAL_ALGORITHM_REGISTRY) {
      stmt.run(
        alg.id,
        alg.name,
        alg.version,
        alg.category,
        alg.operationType,
        alg.isInvertible ? 1 : 0,
        alg.isOneWayHash ? 1 : 0,
        alg.isPowAlgorithm ? 1 : 0,
        JSON.stringify(alg),
        now
      );
    }
  }

  private reconcileWorkersOnBoot(): void {
    const workers = this.listWorkers();
    const nowUtc = new Date().toISOString();
    for (const w of workers) {
      if (w.state === 'RUNNING' || w.state === 'CHECKPOINTING' || w.state === 'VERIFYING') {
        const updated: ContinuousWorkerRecord = {
          ...w,
          state: 'STOPPED',
          failureReason: 'Process restarted; awaiting explicit operator resume from last SQLite checkpoint.',
          updatedAtUtc: nowUtc,
        };
        this.saveWorker(updated, w.state, 'STOPPED', 'Boot reconciliation: interrupted active lease halted safely');
      }
    }
  }

  public getAlgorithms(): AlgorithmRegistryEntry[] {
    const rows = this.db.prepare(`SELECT definition_json FROM algorithms ORDER BY category, id`).all();
    return rows.map((r) => JSON.parse(String(r.definition_json)) as AlgorithmRegistryEntry);
  }

  // ===========================================================================
  // JOBS & SOLVER RESULTS
  // ===========================================================================
  public saveJob(session: InstantMinerSession): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO jobs (
        job_id, schema_version, algorithm_id, network_id, state, session_json, created_at_utc, updated_at_utc
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      session.jobId,
      session.schemaVersion,
      session.config.algorithmId,
      session.config.networkId,
      session.state,
      JSON.stringify(session),
      session.createdAtUtc,
      session.updatedAtUtc
    );
  }

  public listJobs(limit: number = 40): InstantMinerSession[] {
    const rows = this.db.prepare(`SELECT session_json FROM jobs ORDER BY updated_at_utc DESC LIMIT ?`).all(limit);
    return rows.map((r) => JSON.parse(String(r.session_json)) as InstantMinerSession);
  }

  public saveSolverResult(res: InstantSolverResult): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO solver_results (
        solve_id, algorithm_id, mode, verification_outcome, receipt_id, result_json, created_at_utc
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      res.solveId,
      res.algorithmId,
      res.mode,
      res.verificationOutcome,
      res.receiptId,
      JSON.stringify(res),
      res.utcTimestamp
    );
  }

  public listSolverResults(limit: number = 30): InstantSolverResult[] {
    const rows = this.db.prepare(`SELECT result_json FROM solver_results ORDER BY created_at_utc DESC LIMIT ?`).all(limit);
    return rows.map((r) => JSON.parse(String(r.result_json)) as InstantSolverResult);
  }

  public recordCandidate(params: {
    candidateId: string;
    jobId: string;
    workerId: string;
    algorithmId: string;
    nonce: number;
    digestHex: string;
    meetsTarget: boolean;
    verifiedLocally: boolean;
  }): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO candidates (
        candidate_id, job_id, worker_id, algorithm_id, nonce, digest_hex, meets_target, verified_locally, created_at_utc
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.candidateId,
      params.jobId,
      params.workerId,
      params.algorithmId,
      params.nonce,
      params.digestHex,
      params.meetsTarget ? 1 : 0,
      params.verifiedLocally ? 1 : 0,
      new Date().toISOString()
    );
  }

  public recordComputationBatch(params: {
    batchId: string;
    jobId: string;
    workerId: string;
    epochId: string;
    operationCount: number;
    bytesProcessed: number;
    durationNs: string;
  }): void {
    this.db.prepare(`
      INSERT INTO computation_batches (
        batch_id, job_id, worker_id, epoch_id, operation_count, bytes_processed, duration_ns, created_at_utc
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.batchId,
      params.jobId,
      params.workerId,
      params.epochId,
      params.operationCount,
      params.bytesProcessed,
      params.durationNs,
      new Date().toISOString()
    );
  }

  // ===========================================================================
  // CONTINUOUS WORKERS (10-STATE FSM & CHECKPOINT RECOVERY)
  // ===========================================================================
  public saveWorker(
    worker: ContinuousWorkerRecord,
    fromState?: ContinuousWorkerState | 'NONE',
    toState?: ContinuousWorkerState,
    transitionReason?: string
  ): void {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO workers (
          worker_id, label, epoch_id, algorithm_id, network_id, state,
          nonce_range_start, nonce_range_end, current_cursor, lease_id, lease_expires_at_ms,
          worker_json, updated_at_utc
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        worker.workerId,
        worker.label,
        worker.epochId,
        worker.algorithmId,
        worker.networkId,
        worker.state,
        worker.nonceRangeStart,
        worker.nonceRangeEnd,
        worker.currentCursor,
        worker.leaseId,
        worker.leaseExpiresAtMs,
        JSON.stringify(worker),
        worker.updatedAtUtc
      );

      if (fromState && toState && transitionReason) {
        this.db.prepare(`
          INSERT INTO worker_transitions (
            id, worker_id, from_state, to_state, reason, monotonic_ns, utc_timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          `wtr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          worker.workerId,
          fromState,
          toState,
          transitionReason,
          process.hrtime.bigint().toString(),
          new Date().toISOString()
        );
      }
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  public getWorker(workerId: string): ContinuousWorkerRecord | null {
    const row = this.db.prepare(`SELECT worker_json FROM workers WHERE worker_id = ?`).get(workerId);
    return row ? (JSON.parse(String(row.worker_json)) as ContinuousWorkerRecord) : null;
  }

  public listWorkers(): ContinuousWorkerRecord[] {
    const rows = this.db.prepare(`SELECT worker_json FROM workers ORDER BY updated_at_utc DESC`).all();
    return rows.map((r) => JSON.parse(String(r.worker_json)) as ContinuousWorkerRecord);
  }

  public listWorkerTransitions(workerId?: string, limit: number = 50): WorkerTransitionEvent[] {
    const rows = workerId
      ? this.db.prepare(`SELECT * FROM worker_transitions WHERE worker_id = ? ORDER BY utc_timestamp DESC LIMIT ?`).all(workerId, limit)
      : this.db.prepare(`SELECT * FROM worker_transitions ORDER BY utc_timestamp DESC LIMIT ?`).all(limit);
    return rows.map((r) => ({
      id: String(r.id),
      workerId: String(r.worker_id),
      fromState: String(r.from_state) as ContinuousWorkerState | 'NONE',
      toState: String(r.to_state) as ContinuousWorkerState,
      reason: String(r.reason),
      monotonicNs: String(r.monotonic_ns),
      utcTimestamp: String(r.utc_timestamp),
    }));
  }

  // ===========================================================================
  // STRATUM JOBS & DUPLICATE-GUARDED SHARES
  // ===========================================================================
  public saveStratumJob(job: StratumJobRecord): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO stratum_jobs (
        stratum_job_id, network_id, algorithm_id, prev_hash_hex, header_template_hex,
        extranonce1_hex, difficulty_zero_nibbles, clean_jobs, created_at_utc
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      job.stratumJobId,
      job.networkId,
      job.algorithmId,
      job.prevHashHex,
      job.headerTemplateHex,
      job.extranonce1Hex,
      job.difficultyZeroNibbles,
      job.cleanJobs ? 1 : 0,
      job.createdAtUtc
    );
  }

  public getStratumJob(jobId: string): StratumJobRecord | null {
    const row = this.db.prepare(`SELECT * FROM stratum_jobs WHERE stratum_job_id = ?`).get(jobId);
    if (!row) return null;
    return {
      stratumJobId: String(row.stratum_job_id),
      networkId: String(row.network_id),
      algorithmId: String(row.algorithm_id),
      prevHashHex: String(row.prev_hash_hex),
      headerTemplateHex: String(row.header_template_hex),
      extranonce1Hex: String(row.extranonce1_hex),
      difficultyZeroNibbles: Number(row.difficulty_zero_nibbles),
      cleanJobs: Boolean(row.clean_jobs),
      createdAtUtc: String(row.created_at_utc),
    };
  }

  public recordStratumShare(share: StratumShareSubmissionRecord): { inserted: boolean; duplicate: boolean } {
    const existing = this.db.prepare(`
      SELECT share_id FROM shares WHERE job_id = ? AND extranonce2_hex = ? AND ntime_hex = ? AND nonce_hex = ?
    `).get(share.jobId, share.extranonce2Hex, share.ntimeHex, share.nonceHex);
    if (existing) {
      return { inserted: false, duplicate: true };
    }
    this.db.prepare(`
      INSERT INTO shares (
        share_id, worker_id, job_id, extranonce2_hex, ntime_hex, nonce_hex,
        candidate_digest_hex, meets_target, pool_accepted, pool_reject_reason,
        pool_rtt_ns, receipt_id, submitted_at_utc
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      share.shareId,
      share.workerId,
      share.jobId,
      share.extranonce2Hex,
      share.ntimeHex,
      share.nonceHex,
      share.candidateDigestHex,
      share.meetsTarget ? 1 : 0,
      share.poolAccepted ? 1 : 0,
      share.poolRejectReason,
      share.poolRttNs,
      share.receiptId,
      share.submittedAtUtc
    );
    return { inserted: true, duplicate: false };
  }

  public listShares(limit: number = 60): StratumShareSubmissionRecord[] {
    const rows = this.db.prepare(`SELECT * FROM shares ORDER BY submitted_at_utc DESC LIMIT ?`).all(limit);
    return rows.map((r) => ({
      shareId: String(r.share_id),
      workerId: String(r.worker_id),
      jobId: String(r.job_id),
      extranonce2Hex: String(r.extranonce2_hex),
      ntimeHex: String(r.ntime_hex),
      nonceHex: String(r.nonce_hex),
      candidateDigestHex: String(r.candidate_digest_hex),
      meetsTarget: Boolean(r.meets_target),
      isDuplicate: false,
      poolAccepted: Boolean(r.pool_accepted),
      poolRejectReason: r.pool_reject_reason ? String(r.pool_reject_reason) : null,
      poolRttNs: String(r.pool_rtt_ns),
      receiptId: String(r.receipt_id),
      submittedAtUtc: String(r.submitted_at_utc),
    }));
  }

  // ===========================================================================
  // 13-STATE RECEIPT CLEARING & REWARD ACCOUNTING (SECTION 8)
  // ===========================================================================
  public createReceipt(receipt: ClearedReceiptRecord, actorRole: RbacRole): void {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare(`
        INSERT INTO receipts (
          receipt_id, schema_version, job_id, worker_id, epoch_id, algorithm_id,
          lifecycle_state, canonical_digest_sha256, receipt_json, created_at_utc, updated_at_utc
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        receipt.receiptId,
        receipt.schemaVersion,
        receipt.jobId,
        receipt.workerId,
        receipt.epochId,
        receipt.algorithmId,
        receipt.lifecycleState,
        receipt.canonicalDigestSha256,
        JSON.stringify(receipt),
        receipt.createdAtUtc,
        receipt.updatedAtUtc
      );
      this.db.prepare(`
        INSERT INTO receipt_transitions (
          transition_id, receipt_id, from_state, to_state, actor_role, note, monotonic_ns, utc_timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        `rtr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        receipt.receiptId,
        'NONE',
        receipt.lifecycleState,
        actorRole,
        'Receipt initialized',
        process.hrtime.bigint().toString(),
        receipt.createdAtUtc
      );
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  public advanceReceiptState(
    receiptId: string,
    targetState: ReceiptLifecycleState,
    actorRole: RbacRole,
    note: string,
    patch?: Partial<Pick<ClearedReceiptRecord, 'protocolSubmissionResponse' | 'poolAcknowledgement' | 'rewardAccountingRef' | 'canonicalDigestSha256'>>
  ): ClearedReceiptRecord {
    const row = this.db.prepare(`SELECT receipt_json FROM receipts WHERE receipt_id = ?`).get(receiptId);
    if (!row) {
      throw new Error(`Receipt not found: ${receiptId}`);
    }
    const existing = JSON.parse(String(row.receipt_json)) as ClearedReceiptRecord;
    const allowed = ALLOWED_RECEIPT_TRANSITIONS[existing.lifecycleState] || [];
    if (!allowed.includes(targetState)) {
      throw new Error(
        `Illegal receipt lifecycle skip: ${existing.lifecycleState} -> ${targetState} (allowed: ${allowed.join(', ') || 'NONE'})`
      );
    }

    const nowUtc = new Date().toISOString();
    const updated: ClearedReceiptRecord = {
      ...existing,
      ...patch,
      lifecycleState: targetState,
      updatedAtUtc: nowUtc,
    };

    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare(`
        UPDATE receipts
        SET lifecycle_state = ?, receipt_json = ?, updated_at_utc = ?, canonical_digest_sha256 = ?
        WHERE receipt_id = ?
      `).run(targetState, JSON.stringify(updated), nowUtc, updated.canonicalDigestSha256, receiptId);

      this.db.prepare(`
        INSERT INTO receipt_transitions (
          transition_id, receipt_id, from_state, to_state, actor_role, note, monotonic_ns, utc_timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        `rtr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        receiptId,
        existing.lifecycleState,
        targetState,
        actorRole,
        note,
        process.hrtime.bigint().toString(),
        nowUtc
      );
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
    return updated;
  }

  public getReceipt(receiptId: string): ClearedReceiptRecord | null {
    const row = this.db.prepare(`SELECT receipt_json FROM receipts WHERE receipt_id = ?`).get(receiptId);
    return row ? (JSON.parse(String(row.receipt_json)) as ClearedReceiptRecord) : null;
  }

  public listReceipts(limit: number = 80): ClearedReceiptRecord[] {
    const rows = this.db.prepare(`SELECT receipt_json FROM receipts ORDER BY updated_at_utc DESC LIMIT ?`).all(limit);
    return rows.map((r) => JSON.parse(String(r.receipt_json)) as ClearedReceiptRecord);
  }

  public listReceiptTransitions(receiptId: string): ReceiptTransitionLog[] {
    const rows = this.db.prepare(`SELECT * FROM receipt_transitions WHERE receipt_id = ? ORDER BY utc_timestamp ASC`).all(receiptId);
    return rows.map((r) => ({
      transitionId: String(r.transition_id),
      receiptId: String(r.receipt_id),
      fromState: String(r.from_state) as ReceiptLifecycleState | 'NONE',
      toState: String(r.to_state) as ReceiptLifecycleState,
      actorRole: String(r.actor_role) as RbacRole,
      note: String(r.note),
      monotonicNs: String(r.monotonic_ns),
      utcTimestamp: String(r.utc_timestamp),
    }));
  }

  public recordRewardEntry(entry: RewardAccountingEntry): { inserted: boolean; entry: RewardAccountingEntry } {
    const dup = this.db.prepare(`SELECT * FROM reward_entries WHERE idempotency_key = ?`).get(entry.idempotencyKey);
    if (dup) {
      return {
        inserted: false,
        entry: {
          entryId: String(dup.entry_id),
          receiptId: String(dup.receipt_id),
          jobId: String(dup.job_id),
          workerId: String(dup.worker_id),
          entryType: String(dup.entry_type) as RewardAccountingEntry['entryType'],
          currency: String(dup.currency),
          amount: Number(dup.amount),
          idempotencyKey: String(dup.idempotency_key),
          feeAmount: Number(dup.fee_amount),
          netAmount: Number(dup.net_amount),
          note: String(dup.note),
          createdAtUtc: String(dup.created_at_utc),
        },
      };
    }

    this.db.prepare(`
      INSERT INTO reward_entries (
        entry_id, receipt_id, job_id, worker_id, entry_type, currency,
        amount, idempotency_key, fee_amount, net_amount, note, created_at_utc
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.entryId,
      entry.receiptId,
      entry.jobId,
      entry.workerId,
      entry.entryType,
      entry.currency,
      entry.amount,
      entry.idempotencyKey,
      entry.feeAmount,
      entry.netAmount,
      entry.note,
      entry.createdAtUtc
    );
    return { inserted: true, entry };
  }

  public listRewardEntries(limit: number = 100): RewardAccountingEntry[] {
    const rows = this.db.prepare(`SELECT * FROM reward_entries ORDER BY created_at_utc DESC LIMIT ?`).all(limit);
    return rows.map((r) => ({
      entryId: String(r.entry_id),
      receiptId: String(r.receipt_id),
      jobId: String(r.job_id),
      workerId: String(r.worker_id),
      entryType: String(r.entry_type) as RewardAccountingEntry['entryType'],
      currency: String(r.currency),
      amount: Number(r.amount),
      idempotencyKey: String(r.idempotency_key),
      feeAmount: Number(r.fee_amount),
      netAmount: Number(r.net_amount),
      note: String(r.note),
      createdAtUtc: String(r.created_at_utc),
    }));
  }

  public getRewardBalances(): RewardBalancesSummary {
    const rows = this.db.prepare(`SELECT entry_type, net_amount FROM reward_entries`).all();
    let estimatedPendingUsd = 0;
    let confirmedCredits = 0;
    let settledDebits = 0;
    let reversedTotalUsd = 0;
    let confirmedEntryCount = 0;
    let estimatedEntryCount = 0;

    for (const r of rows) {
      const t = String(r.entry_type);
      const amt = Number(r.net_amount);
      if (t === 'ESTIMATED') {
        estimatedPendingUsd += amt;
        estimatedEntryCount++;
      } else if (t === 'CONFIRMED') {
        confirmedCredits += amt;
        confirmedEntryCount++;
      } else if (t === 'SETTLED_DEBIT') {
        settledDebits += amt;
      } else if (t === 'REVERSED') {
        reversedTotalUsd += amt;
      }
    }

    const confirmedAvailableUsd = Math.max(0, +(confirmedCredits - settledDebits - reversedTotalUsd).toFixed(4));
    return {
      estimatedPendingUsd: +estimatedPendingUsd.toFixed(4),
      confirmedAvailableUsd,
      settledLifetimeUsd: +settledDebits.toFixed(4),
      reversedTotalUsd: +reversedTotalUsd.toFixed(4),
      confirmedEntryCount,
      estimatedEntryCount,
    };
  }

  // ===========================================================================
  // PAYOUTS (STRIPE CONNECT)
  // ===========================================================================
  public savePayout(payout: StripePayoutRecord): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO payouts (
        payout_id, stripe_payout_id, idempotency_key, actor_role, reward_entry_id,
        currency, gross_amount, fee_amount, net_amount, destination_summary,
        settlement_rail, status, test_mode, webhook_verified, failure_message,
        created_at_utc, updated_at_utc
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      payout.payoutId,
      payout.stripePayoutId,
      payout.idempotencyKey,
      payout.actorRole,
      payout.rewardEntryId,
      payout.currency,
      payout.grossAmount,
      payout.feeAmount,
      payout.netAmount,
      payout.destinationSummary,
      payout.settlementRail,
      payout.status,
      payout.testMode ? 1 : 0,
      payout.webhookVerified ? 1 : 0,
      payout.failureMessage,
      payout.createdAtUtc,
      payout.updatedAtUtc
    );
  }

  public getPayoutByIdempotency(key: string): StripePayoutRecord | null {
    const row = this.db.prepare(`SELECT * FROM payouts WHERE idempotency_key = ?`).get(key);
    return row ? this.mapPayoutRow(row) : null;
  }

  public getPayoutByStripeId(stripePayoutId: string): StripePayoutRecord | null {
    const row = this.db.prepare(`SELECT * FROM payouts WHERE stripe_payout_id = ?`).get(stripePayoutId);
    return row ? this.mapPayoutRow(row) : null;
  }

  public listPayouts(limit: number = 60): StripePayoutRecord[] {
    const rows = this.db.prepare(`SELECT * FROM payouts ORDER BY created_at_utc DESC LIMIT ?`).all(limit);
    return rows.map((r) => this.mapPayoutRow(r));
  }

  private mapPayoutRow(row: Record<string, unknown>): StripePayoutRecord {
    return {
      payoutId: String(row.payout_id),
      stripePayoutId: row.stripe_payout_id ? String(row.stripe_payout_id) : null,
      idempotencyKey: String(row.idempotency_key),
      actorRole: String(row.actor_role) as RbacRole,
      rewardEntryId: row.reward_entry_id ? String(row.reward_entry_id) : null,
      currency: String(row.currency),
      grossAmount: Number(row.gross_amount),
      feeAmount: Number(row.fee_amount),
      netAmount: Number(row.net_amount),
      destinationSummary: String(row.destination_summary),
      settlementRail: String(row.settlement_rail) as StripePayoutRecord['settlementRail'],
      status: String(row.status) as StripePayoutRecord['status'],
      testMode: Boolean(row.test_mode),
      webhookVerified: Boolean(row.webhook_verified),
      failureMessage: row.failure_message ? String(row.failure_message) : null,
      createdAtUtc: String(row.created_at_utc),
      updatedAtUtc: String(row.updated_at_utc),
    };
  }

  // ===========================================================================
  // TELEMETRY SERIES, AUDIT LOGS, ACCEPTANCE TESTS, DREAM LOGS, SETTINGS
  // ===========================================================================
  public appendTelemetryPoint(point: TelemetryPoint): void {
    this.db.prepare(`
      INSERT INTO telemetry_series (utc_timestamp, monotonic_ns, point_json)
      VALUES (?, ?, ?)
    `).run(point.utcTimestamp, point.monotonicNs, JSON.stringify(point));

    // Trim strictly past 500 historical samples to keep SQLite lean
    this.db.exec(`
      DELETE FROM telemetry_series WHERE seq NOT IN (
        SELECT seq FROM telemetry_series ORDER BY seq DESC LIMIT 500
      )
    `);
  }

  public listTelemetrySeries(limit: number = 120): TelemetryPoint[] {
    const rows = this.db.prepare(`SELECT seq, point_json FROM telemetry_series ORDER BY seq DESC LIMIT ?`).all(limit);
    return rows
      .reverse()
      .map((r) => {
        const pt = JSON.parse(String(r.point_json)) as TelemetryPoint;
        return { ...pt, seq: Number(r.seq) };
      });
  }

  public recordAuditEvent(event: AuditEventRecord): void {
    this.db.prepare(`
      INSERT INTO audit_events (
        event_id, actor_role, action, target_type, target_id, outcome, detail, monotonic_ns, utc_timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.eventId,
      event.actorRole,
      event.action,
      event.targetType,
      event.targetId,
      event.outcome,
      event.detail,
      event.monotonicNs,
      event.utcTimestamp
    );
  }

  public listAuditEvents(limit: number = 100): AuditEventRecord[] {
    const rows = this.db.prepare(`SELECT * FROM audit_events ORDER BY utc_timestamp DESC LIMIT ?`).all(limit);
    return rows.map((r) => ({
      eventId: String(r.event_id),
      actorRole: String(r.actor_role) as RbacRole,
      action: String(r.action),
      targetType: String(r.target_type),
      targetId: String(r.target_id),
      outcome: String(r.outcome) as AuditEventRecord['outcome'],
      detail: String(r.detail),
      monotonicNs: String(r.monotonic_ns),
      utcTimestamp: String(r.utc_timestamp),
    }));
  }

  public saveAcceptanceTests(results: readonly AcceptanceGateTestResult[]): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO acceptance_tests (test_id, gate, result_json, executed_at_utc)
      VALUES (?, ?, ?, ?)
    `);
    for (const r of results) {
      stmt.run(r.testId, r.gate, JSON.stringify(r), r.executionTimestampUtc);
    }
  }

  public listAcceptanceTests(): AcceptanceGateTestResult[] {
    const rows = this.db.prepare(`SELECT result_json FROM acceptance_tests ORDER BY gate, test_id`).all();
    return rows.map((r) => JSON.parse(String(r.result_json)) as AcceptanceGateTestResult);
  }

  public saveDreamLog(entry: DreamLogEntry): void {
    this.db.prepare(`
      INSERT INTO dream_logs (
        log_id, dream_text, archetypes_json, lucidity, intensity, chaos, realm,
        analysis_text, clock_epoch_id, clock_monotonic_ns, created_at_utc
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.logId,
      entry.dreamText,
      JSON.stringify(entry.archetypes),
      entry.lucidity,
      entry.intensity,
      entry.chaos,
      entry.realm,
      entry.analysisText,
      entry.clockEpochId,
      entry.clockMonotonicNs,
      entry.createdAtUtc
    );
  }

  public listDreamLogs(limit: number = 60): DreamLogEntry[] {
    const rows = this.db.prepare(`SELECT * FROM dream_logs ORDER BY created_at_utc DESC LIMIT ?`).all(limit);
    return rows.map((r) => ({
      logId: String(r.log_id),
      dreamText: String(r.dream_text),
      archetypes: JSON.parse(String(r.archetypes_json)) as string[],
      lucidity: Number(r.lucidity),
      intensity: Number(r.intensity),
      chaos: Number(r.chaos),
      realm: String(r.realm) as DreamRealm,
      analysisText: String(r.analysis_text),
      clockEpochId: String(r.clock_epoch_id),
      clockMonotonicNs: String(r.clock_monotonic_ns),
      createdAtUtc: String(r.created_at_utc),
    }));
  }

  public getSetting<T>(key: string, fallback: T): T {
    const row = this.db.prepare(`SELECT value_json FROM runtime_settings WHERE key = ?`).get(key);
    return row ? (JSON.parse(String(row.value_json)) as T) : fallback;
  }

  public saveSetting<T>(key: string, value: T): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO runtime_settings (key, value_json, updated_at_utc)
      VALUES (?, ?, ?)
    `).run(key, JSON.stringify(value), new Date().toISOString());
  }

  public getReceiptLifecycleOrder(): readonly ReceiptLifecycleState[] {
    return ORDERED_RECEIPT_STATES;
  }

  // ===========================================================================
  // UNIVERSAL MEMORY (gaia.memory.event.v1), LEXICAL INDEX, RECEIPT R & HYGIENE
  // ===========================================================================
  public getMemoryHead(): { sequence: number; eventHash: string } {
    const row = this.db
      .prepare(`SELECT sequence, event_hash FROM memory_events ORDER BY sequence DESC LIMIT 1`)
      .get();
    if (!row) {
      return {
        sequence: 0,
        eventHash: '0000000000000000000000000000000000000000000000000000000000000000',
      };
    }
    return {
      sequence: Number(row.sequence),
      eventHash: String(row.event_hash),
    };
  }

  public getMemoryByIdempotencyKey(key: string): GaiaMemoryEventRecord | null {
    const row = this.db
      .prepare(`SELECT record_json FROM memory_events WHERE idempotency_key = ?`)
      .get(key);
    return row ? (JSON.parse(String(row.record_json)) as GaiaMemoryEventRecord) : null;
  }

  public appendMemoryEventTransactional(
    buildRecord: (nextSequence: number, previousHash: string) => GaiaMemoryEventRecord,
    lexicalEntry?: (eventId: string) => LexicalCorpusIndexEntry | null
  ): GaiaMemoryEventRecord {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const head = this.getMemoryHead();
      const nextSequence = head.sequence + 1;
      const record = buildRecord(nextSequence, head.eventHash);

      this.db
        .prepare(`
          INSERT INTO memory_events (
            sequence, event_id, schema_version, created_utc, source, project, event_type,
            payload, payload_sha256, payload_blake2b512, previous_hash, event_hash,
            idempotency_key, tags_json, record_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          record.sequence,
          record.event_id,
          record.schema,
          record.created_utc,
          record.source,
          record.project,
          record.event_type,
          record.payload,
          record.payload_sha256,
          record.payload_blake2b512,
          record.previous_hash,
          record.event_hash,
          record.idempotency_key,
          JSON.stringify(record.tags),
          JSON.stringify(record)
        );

      if (lexicalEntry) {
        const idx = lexicalEntry(record.event_id);
        if (idx) {
          this.db
            .prepare(`
              INSERT INTO lexical_index (index_id, event_id, token_count, tokens_json, indexed_at_utc)
              VALUES (?, ?, ?, ?, ?)
            `)
            .run(
              idx.indexId,
              idx.eventId,
              idx.tokenCount,
              JSON.stringify(idx.distinctTokens),
              idx.indexedAtUtc
            );
        }
      }

      this.db.exec('COMMIT');
      return record;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  public getMemoryEvent(eventId: string): GaiaMemoryEventRecord | null {
    const row = this.db
      .prepare(`SELECT record_json FROM memory_events WHERE event_id = ?`)
      .get(eventId);
    return row ? (JSON.parse(String(row.record_json)) as GaiaMemoryEventRecord) : null;
  }

  public listMemoryEvents(params?: {
    search?: string;
    project?: string;
    eventType?: string;
    limit?: number;
    offset?: number;
  }): GaiaMemoryEventRecord[] {
    const clauses: string[] = [];
    const args: unknown[] = [];
    if (params?.project) {
      clauses.push('project = ?');
      args.push(params.project);
    }
    if (params?.eventType) {
      clauses.push('event_type = ?');
      args.push(params.eventType);
    }
    if (params?.search) {
      clauses.push('(payload LIKE ? OR tags_json LIKE ? OR event_id LIKE ?)');
      const pat = `%${params.search}%`;
      args.push(pat, pat, pat);
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const limit = Math.max(1, Math.min(500, params?.limit ?? 100));
    const offset = Math.max(0, params?.offset ?? 0);
    const rows = this.db
      .prepare(`SELECT record_json FROM memory_events ${where} ORDER BY sequence DESC LIMIT ? OFFSET ?`)
      .all(...args, limit, offset);
    return rows.map((r) => JSON.parse(String(r.record_json)) as GaiaMemoryEventRecord);
  }

  public listAllMemoryEventsAscending(): GaiaMemoryEventRecord[] {
    const rows = this.db
      .prepare(`SELECT record_json FROM memory_events ORDER BY sequence ASC`)
      .all();
    return rows.map((r) => JSON.parse(String(r.record_json)) as GaiaMemoryEventRecord);
  }

  public listLexicalIndices(limit: number = 50): LexicalCorpusIndexEntry[] {
    const rows = this.db
      .prepare(`SELECT * FROM lexical_index ORDER BY indexed_at_utc DESC LIMIT ?`)
      .all(limit);
    return rows.map((r) => ({
      indexId: String(r.index_id),
      eventId: String(r.event_id),
      tokenCount: Number(r.token_count),
      distinctTokens: JSON.parse(String(r.tokens_json)) as string[],
      preservedVerbatim: true,
      indexedAtUtc: String(r.indexed_at_utc),
    }));
  }

  public saveTraceReceiptR(receipt: TraceableExecutionReceiptR): void {
    this.db
      .prepare(`
        INSERT OR REPLACE INTO trace_receipts_r (
          receipt_id, subsystem, operation_id, utc_iso, monotonic_ns, accepted, merkle_root_blake2b, receipt_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        receipt.ID,
        receipt.M.subsystem,
        receipt.M.operationId,
        receipt.T.utcIso,
        receipt.T.monotonicNs,
        receipt.A ? 1 : 0,
        receipt.V.blake2bMerkleRootHex,
        JSON.stringify(receipt)
      );
  }

  public getTraceReceiptR(receiptId: string): TraceableExecutionReceiptR | null {
    const row = this.db
      .prepare(`SELECT receipt_json FROM trace_receipts_r WHERE receipt_id = ?`)
      .get(receiptId);
    return row ? (JSON.parse(String(row.receipt_json)) as TraceableExecutionReceiptR) : null;
  }

  public listTraceReceiptsR(limit: number = 80): TraceableExecutionReceiptR[] {
    const rows = this.db
      .prepare(`SELECT receipt_json FROM trace_receipts_r ORDER BY utc_iso DESC LIMIT ?`)
      .all(limit);
    return rows.map((r) => JSON.parse(String(r.receipt_json)) as TraceableExecutionReceiptR);
  }

  public saveMerkleBatch(batch: MerkleBatchRecord): void {
    this.db
      .prepare(`
        INSERT OR REPLACE INTO merkle_batches (
          batch_id, root_blake2b_hex, leaf_count, created_at_utc, batch_json
        ) VALUES (?, ?, ?, ?, ?)
      `)
      .run(
        batch.batchId,
        batch.rootBlake2bHex,
        batch.leafCount,
        batch.createdAtUtc,
        JSON.stringify(batch)
      );
  }

  public listMerkleBatches(limit: number = 30): MerkleBatchRecord[] {
    const rows = this.db
      .prepare(`SELECT batch_json FROM merkle_batches ORDER BY created_at_utc DESC LIMIT ?`)
      .all(limit);
    return rows.map((r) => JSON.parse(String(r.batch_json)) as MerkleBatchRecord);
  }

  public saveHygieneScan(report: HygieneScanReport): void {
    this.db
      .prepare(`
        INSERT OR REPLACE INTO hygiene_scans (
          scan_id, scanned_at_utc, trojan_detected, memory_chain_valid, report_json
        ) VALUES (?, ?, ?, ?, ?)
      `)
      .run(
        report.scanId,
        report.scannedAtUtc,
        report.trojanOrMalwareDetected ? 1 : 0,
        report.memoryChainValid ? 1 : 0,
        JSON.stringify(report)
      );
  }

  public listHygieneScans(limit: number = 20): HygieneScanReport[] {
    const rows = this.db
      .prepare(`SELECT report_json FROM hygiene_scans ORDER BY scanned_at_utc DESC LIMIT ?`)
      .all(limit);
    return rows.map((r) => JSON.parse(String(r.report_json)) as HygieneScanReport);
  }

  // ===========================================================================
  // ARBITRAGE & GENUINE MINING TELEMETRY PERSISTENCE
  // ===========================================================================

  public saveArbitrageEvaluation(opp: ArbitrageOpportunityEvaluation): void {
    this.db
      .prepare(`
        INSERT OR REPLACE INTO arbitrage_evaluations (
          opportunity_id, pair, buy_market, sell_market,
          gross_spread_bps, net_profit_usd, net_return_bps,
          status, evaluation_receipt_hash, evaluation_json, evaluated_at_utc
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        opp.opportunityId,
        opp.pair,
        opp.buyMarket,
        opp.sellMarket,
        opp.grossSpreadBps,
        opp.netProfitUsd,
        opp.netReturnBps,
        opp.status,
        opp.evaluationReceiptHash,
        JSON.stringify(opp),
        opp.evaluatedAtUtc
      );
  }

  public listArbitrageEvaluations(limit: number = 50): ArbitrageOpportunityEvaluation[] {
    const rows = this.db
      .prepare(`SELECT evaluation_json FROM arbitrage_evaluations ORDER BY evaluated_at_utc DESC LIMIT ?`)
      .all(limit);
    return rows.map((r) => JSON.parse(String(r.evaluation_json)) as ArbitrageOpportunityEvaluation);
  }

  public savePaperArbitrageReceipt(receipt: PaperEvaluationReceipt): void {
    this.db
      .prepare(`
        INSERT OR REPLACE INTO paper_arbitrage_receipts (
          receipt_id, opportunity_id, pair, buy_market, sell_market,
          quantity_base, net_profit_usd, execution_status,
          deterministic_verification_digest, receipt_json, evaluated_at_utc
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        receipt.receiptId,
        receipt.opportunityId,
        receipt.pair,
        receipt.buyMarket,
        receipt.sellMarket,
        receipt.quantityBase,
        receipt.netProfitUsd,
        receipt.executionStatus,
        receipt.deterministicVerificationDigest,
        JSON.stringify(receipt),
        receipt.evaluatedAtUtc
      );
  }

  public listPaperArbitrageReceipts(limit: number = 50): PaperEvaluationReceipt[] {
    const rows = this.db
      .prepare(`SELECT receipt_json FROM paper_arbitrage_receipts ORDER BY evaluated_at_utc DESC LIMIT ?`)
      .all(limit);
    return rows.map((r) => JSON.parse(String(r.receipt_json)) as PaperEvaluationReceipt);
  }

  public saveMiningTelemetryReceipt(receipt: MiningTelemetryReceipt): void {
    this.db
      .prepare(`
        INSERT OR REPLACE INTO mining_telemetry_receipts (
          receipt_id, profile_id, worker_id, worker_count,
          block_number, attempts, verified_candidates, elapsed_us,
          hashes_per_second, best_digest_hex, merkle_root_hash,
          receipt_json, timestamp_utc
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        receipt.receiptId,
        receipt.profileId,
        receipt.workerId,
        receipt.workerCount,
        receipt.blockNumber,
        receipt.attempts,
        receipt.verifiedCandidates,
        receipt.elapsedMicroseconds,
        receipt.hashesPerSecond,
        receipt.bestDigestHex,
        receipt.merkleRootHash,
        JSON.stringify(receipt),
        receipt.timestampUtc
      );
  }

  public listMiningTelemetryReceipts(limit: number = 50): MiningTelemetryReceipt[] {
    const rows = this.db
      .prepare(`SELECT receipt_json FROM mining_telemetry_receipts ORDER BY timestamp_utc DESC LIMIT ?`)
      .all(limit);
    return rows.map((r) => JSON.parse(String(r.receipt_json)) as MiningTelemetryReceipt);
  }

  public verifyLedgerIntegrity(): { isValid: boolean; uncorruptedRowsCount: number; lastHash: string } {
    try {
      const pragmaCheck = this.db.prepare('PRAGMA integrity_check').get() as Record<string, unknown> | undefined;
      const isIntegrityOk = pragmaCheck && Object.values(pragmaCheck)[0] === 'ok';

      const miningCountRow = this.db.prepare('SELECT count(*) as count FROM mining_telemetry_receipts').get() as { count?: number };
      const arbCountRow = this.db.prepare('SELECT count(*) as count FROM arbitrage_evaluations').get() as { count?: number };
      const paperCountRow = this.db.prepare('SELECT count(*) as count FROM paper_arbitrage_receipts').get() as { count?: number };

      const totalRows = (miningCountRow?.count || 0) + (arbCountRow?.count || 0) + (paperCountRow?.count || 0);
      const lastReceipt = this.listMiningTelemetryReceipts(1)[0];

      return {
        isValid: Boolean(isIntegrityOk),
        uncorruptedRowsCount: totalRows,
        lastHash: lastReceipt ? lastReceipt.merkleRootHash : 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      };
    } catch {
      return { isValid: false, uncorruptedRowsCount: 0, lastHash: 'CORRUPTED' };
    }
  }
}

export const globalSqliteLedger = new SqliteLedgerStore();
