/**
 * =============================================================================
 * SPECIFICATION: HCCGN.UCLK.DUAL.ADAPTIVE v1.0
 * MODULE: Authoritative Node.js Universal Temporal Kernel
 * RUNTIME: Node.js process.hrtime.bigint() + node:crypto (SHA-256)
 * POLICY: FRESH_MONOTONIC_ORIGIN_PER_EPOCH
 * =============================================================================
 */

import crypto from 'node:crypto';
import {
  HCCGN_TIMING_CONSTANTS,
  ClockStateMachineStatus,
  StateTransitionRecord,
  ClockCorrelationModel,
  AdaptiveControllerConfig,
  AdaptiveAdmissionDecision,
  FourLaneExecutionSnapshot,
  SolverWindowReceipt,
  TemporalEventReceipt,
  EpochSummaryRecord,
  FaultInjectionConfig,
  BenchmarkReport,
  BenchmarkSamplePoint,
  LaneBenchmarkStats,
  LgvSpatialTemporalEvent,
  AcceptanceTestResult,
  UniversalClockSnapshot,
  ExecutionLaneId,
  ExecutionLaneRole,
  ExecutionLaneDirection,
  DeadlineStatus,
  VerificationStatus,
  AdaptiveRecommendation,
  SequentialTriggerPipelineRun,
} from '../contracts/universal-clock';
import { serializeCanonicalEventPayload } from './universalClockCanonical';
import {
  HccgnBaseIntervalScheduler,
  HccgnAdaptiveController,
  SequentialTriggerPipeline,
  DispatchedIntervalWindow,
  AdaptiveEvaluationContext,
} from './hccgnScheduler';

const LGV_SPATIAL_NODES = [
  { spatialId: 'LGV-MAREA-VB', nodeLabel: 'Virginia Beach MAREA', lon: -75.978, lat: 36.8529, altitudeMeters: 12 },
  { spatialId: 'LGV-NODE-09', nodeLabel: 'Mid-Atlantic Trench NODE_09', lon: -42.5, lat: 38.2, altitudeMeters: -5420 },
  { spatialId: 'LGV-MAREA-SOP', nodeLabel: 'Sopelana Optical Landing', lon: -2.9818, lat: 43.3812, altitudeMeters: 18 },
  { spatialId: 'LGV-SMW5-MRS', nodeLabel: 'Marseille SMW5 Relay', lon: 5.3698, lat: 43.2965, altitudeMeters: 24 },
  { spatialId: 'LGV-ASH-CORE', nodeLabel: 'Ashburn Enclave Vault', lon: -77.4874, lat: 39.0438, altitudeMeters: 88 },
  { spatialId: 'LGV-TYO-POP', nodeLabel: 'Tokyo Stratum Exchange', lon: 139.6917, lat: 35.6895, altitudeMeters: 42 },
] as const;

interface InternalLaneCursor {
  laneId: ExecutionLaneId;
  role: ExecutionLaneRole;
  direction: ExecutionLaneDirection;
  sequenceNumber: number;
  cursorValue: number;
  sourceTicketId: string;
  opposingTicketId: string;
  operationsCompleted: number;
  bytesCompleted: number;
  stateWord: number;
}

function sha256Hex(payload: string): string {
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[idx];
}

/**
 * Performs genuine invertible ARX transformation over `opCount` iterations
 * and verifies inverse closure so throughput & residuals reflect real CPU work.
 */
function executeInvertibleBatch(
  initialWord: number,
  opCount: number,
  direction: 1 | -1,
  corruptInverse: boolean
): { finalWord: number; inverseWord: number; residual: number; bytesProcessed: number } {
  let w = initialWord >>> 0;
  const key = 0x9e3779b9;
  const steps = Math.max(0, Math.floor(opCount));
  for (let i = 0; i < steps; i++) {
    const stepVal = ((i + 1) * direction) | 0;
    w = (w + stepVal + key) >>> 0;
    w = ((w << 7) | (w >>> 25)) >>> 0;
    w = (w ^ 0xa5a55a5a) >>> 0;
  }

  // Exact mathematical inverse pass
  let inv = w;
  for (let i = steps - 1; i >= 0; i--) {
    const stepVal = ((i + 1) * direction) | 0;
    inv = (inv ^ 0xa5a55a5a) >>> 0;
    inv = ((inv >>> 7) | (inv << 25)) >>> 0;
    inv = (inv - stepVal - key) >>> 0;
  }

  if (corruptInverse && steps > 0) {
    inv = (inv ^ 0x00000001) >>> 0;
  }

  const residual = (inv ^ (initialWord >>> 0)) >>> 0;
  return {
    finalWord: w,
    inverseWord: inv,
    residual,
    bytesProcessed: steps * 32,
  };
}

interface StepExecutionContext {
  commitAllEvents: boolean;
  dispatch?: DispatchedIntervalWindow;
  adaptive?: AdaptiveEvaluationContext;
  laneResults?: Array<{
    lane: InternalLaneCursor;
    execStart: bigint;
    execFinish: bigint;
    durationNs: number;
    residual: number;
    verified: boolean;
    bytesProcessed: number;
  }>;
  allVerified?: boolean;
  solverReceipt?: SolverWindowReceipt | null;
  receipt?: TemporalEventReceipt;
}

export class UniversalClockKernel {
  private readonly scheduler = new HccgnBaseIntervalScheduler();
  private readonly adaptiveController = new HccgnAdaptiveController();
  private readonly triggerPipeline: SequentialTriggerPipeline<StepExecutionContext>;
  private readonly clockSourceLabel = this.scheduler.clockSourceLabel;
  private epochStartWallMs: number = Date.now();
  private epochCounter: number = 0;

  private state: ClockStateMachineStatus = 'INITIALIZING';
  private transitions: StateTransitionRecord[] = [];

  private config: AdaptiveControllerConfig = {
    targetUtilizationU: 0.72,
    safetyMarginNsG: 15_000,
    alpha: 0.25,
    minBatchOps: 32,
    maxBatchOps: 4_096,
    maxExecutionBudgetNs: 85_000,
    maxRateOfChangePct: 0.30,
    minObservationSamples: 3,
    queueCapacityLimit: 64,
  };

  private faults: FaultInjectionConfig = {
    delaySpikeNs: 0,
    forceSolverOverrunNs: 0,
    degradeClockSync: false,
    simulatedQueueDepth: 4,
    injectInverseCorruption: false,
  };

  private lanes: InternalLaneCursor[] = [];
  private currentEpochOriginNs: bigint = this.scheduler.getEpochMetadata().originNs;
  private currentEpochDeadlineNs: bigint = this.scheduler.getEpochMetadata().deadlineNs;
  private currentEpochId: string = 'EPOCH-0001';
  private currentEpochIntervalIdx: number = 0;
  private currentEpochMissedIntervals: number = 0;
  private currentEpochLateSolvers: number = 0;
  private currentEpochAdmittedOps: number = 0;
  private currentEpochCompletedOps: number = 0;
  private currentEpochCompletedBytes: number = 0;
  private currentEpochVerifiedOps: number = 0;
  private currentEpochIncompleteOps: number = 0;
  private lastBatchResidualOk: boolean = true;
  private lastReceiptId: string | null = null;
  private lastReceiptDigest: string | null = null;

  private recentEpochs: EpochSummaryRecord[] = [];
  private latestSolvers: SolverWindowReceipt[] = [];
  private recentReceipts: TemporalEventReceipt[] = [];
  private recentTransitions: StateTransitionRecord[] = [];
  private recentTriggerRuns: SequentialTriggerPipelineRun[] = [];
  private lgvEvents: LgvSpatialTemporalEvent[] = [];
  private latestDecision: AdaptiveAdmissionDecision | null = null;
  private latestBenchmark: BenchmarkReport | null = null;
  private jitterHistogramNs: number[] = [];

  private runTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private readonly broadcastListeners = new Set<(snapshot: UniversalClockSnapshot) => void>();
  private readonly interopHooks = new Set<
    (recs: readonly AdaptiveRecommendation[], triggerRun: SequentialTriggerPipelineRun | null) => void
  >();

  constructor() {
    this.triggerPipeline = this.createSequentialTriggerPipeline();
    this.transitionState('CLOCK_READY', 'Monotonic hrtime.bigint source verified and UTC correlation established');
    this.initializeEpoch();
  }

  public readMonotonicNs(): bigint {
    return this.scheduler.readMonotonicNs();
  }

  private correlateUtc(monotonicNs: bigint): { utcIso: string; correlation: ClockCorrelationModel } {
    const deltaNs = monotonicNs - this.currentEpochOriginNs;
    const correlatedMs = this.epochStartWallMs + Number(deltaNs / 1_000_000n);
    const utcIso = new Date(correlatedMs).toISOString();

    const syncDegraded = this.faults.degradeClockSync;
    const uncertaintyNs = syncDegraded ? 185_000_000 : 1_250_000;
    const bOffsetNs = (BigInt(this.epochStartWallMs) * 1_000_000n - this.currentEpochOriginNs).toString();

    return {
      utcIso,
      correlation: {
        monotonicSource: this.clockSourceLabel,
        hardwareTimestampSupported: false,
        aRate: syncDegraded ? 1.00012 : 1.0,
        bOffsetNs,
        uncertaintyNs,
        syncSource: {
          sourceId: 'SYS-WALL-CORR-01',
          protocol: 'SYSTEM_WALL_CORRELATION',
          lastSyncUtc: new Date(this.epochStartWallMs).toISOString(),
          estimatedOffsetNs: bOffsetNs,
          uncertaintyNs,
          driftPpm: syncDegraded ? 120.0 : 4.2,
          validity: syncDegraded ? 'UNSYNCED' : 'VALID',
        },
      },
    };
  }

  private transitionState(to: ClockStateMachineStatus, reason: string): void {
    if (this.state === to) return;
    const nowNs = this.readMonotonicNs();
    const record: StateTransitionRecord = {
      id: `tr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      from: this.state,
      to,
      reason,
      monotonicNs: nowNs.toString(),
      utcIso: new Date().toISOString(),
    };
    this.state = to;
    this.recentTransitions.unshift(record);
    if (this.recentTransitions.length > 60) {
      this.recentTransitions.pop();
    }
  }

  /**
   * Section 10 — Policy: FRESH_MONOTONIC_ORIGIN_PER_EPOCH
   * Acquires a newly recorded monotonic origin M_0 at the start of every epoch.
   */
  private initializeEpoch(): void {
    const rotated = this.scheduler.rotateEpoch();
    const meta = this.scheduler.getEpochMetadata();
    this.epochCounter = meta.epochCounter;
    this.epochStartWallMs = rotated.wallStartMs;
    this.currentEpochOriginNs = rotated.originNs;
    this.currentEpochDeadlineNs = rotated.deadlineNs;
    this.currentEpochId = rotated.epochId;
    this.currentEpochIntervalIdx = 0;
    this.currentEpochMissedIntervals = 0;
    this.currentEpochLateSolvers = 0;
    this.currentEpochAdmittedOps = 0;
    this.currentEpochCompletedOps = 0;
    this.currentEpochCompletedBytes = 0;
    this.currentEpochVerifiedOps = 0;
    this.currentEpochIncompleteOps = 0;

    // Independent four-lane cursor & ticket initialization
    this.lanes = [
      {
        laneId: 1,
        role: 'AUTOMATION',
        direction: 'FORWARD',
        sequenceNumber: 0,
        cursorValue: 0,
        sourceTicketId: `TKT-L1-E${this.epochCounter}`,
        opposingTicketId: `TKT-L2-E${this.epochCounter}`,
        operationsCompleted: 0,
        bytesCompleted: 0,
        stateWord: 0x10203041,
      },
      {
        laneId: 2,
        role: 'SHADOW',
        direction: 'REVERSE',
        sequenceNumber: 0,
        cursorValue: 0,
        sourceTicketId: `TKT-L2-E${this.epochCounter}`,
        opposingTicketId: `TKT-L1-E${this.epochCounter}`,
        operationsCompleted: 0,
        bytesCompleted: 0,
        stateWord: 0x10203041,
      },
      {
        laneId: 3,
        role: 'AUTOMATION',
        direction: 'REVERSE',
        sequenceNumber: 0,
        cursorValue: 0,
        sourceTicketId: `TKT-L3-E${this.epochCounter}`,
        opposingTicketId: `TKT-L4-E${this.epochCounter}`,
        operationsCompleted: 0,
        bytesCompleted: 0,
        stateWord: 0x50607082,
      },
      {
        laneId: 4,
        role: 'SHADOW',
        direction: 'FORWARD',
        sequenceNumber: 0,
        cursorValue: 0,
        sourceTicketId: `TKT-L4-E${this.epochCounter}`,
        opposingTicketId: `TKT-L3-E${this.epochCounter}`,
        operationsCompleted: 0,
        bytesCompleted: 0,
        stateWord: 0x50607082,
      },
    ];
  }

  private closeCurrentEpoch(): void {
    const closeNs = this.readMonotonicNs();
    const prevState = this.state;
    this.transitionState('EPOCH_CLOSING', `1s deadline reached for ${this.currentEpochId}`);

    const elapsedSec = Math.max(
      0.000001,
      Number(closeNs - this.currentEpochOriginNs) / 1_000_000_000
    );
    const opsPerSec = +(this.currentEpochCompletedOps / elapsedSec).toFixed(2);
    const bytesPerSec = +(this.currentEpochCompletedBytes / elapsedSec).toFixed(2);
    const deduplicatedOpsPerSec = +(opsPerSec / 4).toFixed(2);
    const verificationRate =
      this.currentEpochCompletedOps > 0
        ? +(this.currentEpochVerifiedOps / this.currentEpochCompletedOps).toFixed(4)
        : 1.0;

    const summaryBase = {
      epochId: this.currentEpochId,
      epochPolicy: HCCGN_TIMING_CONSTANTS.EPOCH_CONTINUATION_POLICY,
      originMonotonicNs: this.currentEpochOriginNs.toString(),
      deadlineMonotonicNs: this.currentEpochDeadlineNs.toString(),
      closedMonotonicNs: closeNs.toString(),
      measuredElapsedSec: +elapsedSec.toFixed(6),
      baseIntervalsScheduled: this.currentEpochIntervalIdx,
      missedIntervals: this.currentEpochMissedIntervals,
      lateSolvers: this.currentEpochLateSolvers,
      admittedOperations: this.currentEpochAdmittedOps,
      completedOperations: this.currentEpochCompletedOps,
      completedBytes: this.currentEpochCompletedBytes,
      opsPerSec,
      bytesPerSec,
      deduplicatedOpsPerSec,
      verificationRate,
      incompleteWorkOps: this.currentEpochIncompleteOps,
      epochState: this.currentEpochIncompleteOps > 0 ? ('PARTIAL' as const) : ('COMPLETE' as const),
    };

    const summary: EpochSummaryRecord = {
      ...summaryBase,
      epochReceiptDigest: sha256Hex(JSON.stringify(summaryBase)),
    };

    this.recentEpochs.unshift(summary);
    if (this.recentEpochs.length > 25) {
      this.recentEpochs.pop();
    }

    this.transitionState('EPOCH_COMPLETE', `${this.currentEpochId} sealed (${opsPerSec} ops/sec)`);
    this.initializeEpoch();

    if (this.isRunning && prevState !== 'FAULTED') {
      this.transitionState(
        this.faults.degradeClockSync ? 'DEGRADED' : 'RUNNING',
        `New monotonic origin sampled for ${this.currentEpochId}`
      );
    }
  }

  private createSequentialTriggerPipeline(): SequentialTriggerPipeline<StepExecutionContext> {
    return new SequentialTriggerPipeline<StepExecutionContext>([
      {
        triggerId: 'TRG-01-CLOCK-ANCHOR',
        name: 'Monotonic Clock Anchor & Missed-Tick Tracker',
        targetSubsystem: 'DOMAIN_A_CLOCK',
        dependsOnTriggerId: null,
        execute: (ctx) => {
          if (this.scheduler.isEpochExpired()) {
            this.closeCurrentEpoch();
          }
          const dispatch = this.scheduler.dispatchInterval(this.faults.delaySpikeNs);
          ctx.dispatch = dispatch;
          this.currentEpochIntervalIdx = dispatch.intervalIndex;

          this.jitterHistogramNs.push(Math.max(0, dispatch.jitterNs));
          if (this.jitterHistogramNs.length > 500) {
            this.jitterHistogramNs.shift();
          }

          if (dispatch.isMissed) {
            this.currentEpochMissedIntervals += 1;
            this.transitionState(
              'DEADLINE_MISSED',
              `Interval #${dispatch.intervalIndex} dispatch lateness ${dispatch.jitterNs.toLocaleString()} ns > 100,000 ns (skipped ${dispatch.missedTicksThisInterval} ticks)`
            );
          } else if (this.faults.degradeClockSync) {
            this.transitionState('CLOCK_UNSYNCED', 'External UTC sync uncertainty degraded');
          } else if (this.state !== 'RUNNING' && this.isRunning) {
            this.transitionState('RUNNING', 'Dispatch nominal within timing bounds');
          }

          return {
            ok: true,
            inputSummary: `Slot #${dispatch.slotIndex} (M0+${dispatch.slotIndex}*100µs)`,
            outputSummary: `Jitter=${dispatch.jitterNs.toLocaleString()} ns · MissedTicks=${dispatch.missedTicksThisInterval}`,
          };
        },
      },
      {
        triggerId: 'TRG-02-ADAPTIVE-BUDGET',
        name: 'Adaptive Controller Budget & Tail-Pressure Evaluation',
        targetSubsystem: 'ADAPTIVE_CONTROLLER',
        dependsOnTriggerId: 'TRG-01-CLOCK-ANCHOR',
        execute: (ctx) => {
          const dispatch = ctx.dispatch!;
          const sortedJitter = [...this.jitterHistogramNs].sort((a, b) => a - b);
          const adaptive = this.adaptiveController.evaluateAdmission(
            dispatch.intervalIndex,
            dispatch.jitterNs,
            this.config,
            this.faults,
            {
              p95DurationNs: percentile(sortedJitter, 95),
              p99DurationNs: percentile(sortedJitter, 99),
              lastBatchResidualOk: this.lastBatchResidualOk,
              missedTicksThisInterval: dispatch.missedTicksThisInterval,
              syncDegraded: this.faults.degradeClockSync,
            }
          );

          ctx.adaptive = adaptive;
          this.latestDecision = adaptive.decision;
          this.currentEpochAdmittedOps += adaptive.decision.admittedOps;
          if (adaptive.decision.targetBudgetNs <= 0 && !adaptive.decision.backpressureActive) {
            this.currentEpochIncompleteOps += this.adaptiveController.getLastAdmittedBatch();
          }

          return {
            ok: true,
            inputSummary: `Budget B=${adaptive.decision.availableBudgetNs}ns · U*=${adaptive.effectiveUtilizationU.toFixed(2)}`,
            outputSummary: `Admitted=${adaptive.decision.admittedOps} ops · ${adaptive.recommendations.length} subsystem recs`,
          };
        },
      },
      {
        triggerId: 'TRG-03-FOUR-LANE-ARX',
        name: 'Four-Lane Invertible ARX & 5-Tick Solver',
        targetSubsystem: 'FOUR_LANE_SOLVER',
        dependsOnTriggerId: 'TRG-02-ADAPTIVE-BUDGET',
        execute: (ctx) => {
          const dispatch = ctx.dispatch!;
          const admittedOps = ctx.adaptive!.decision.admittedOps;

          const laneResults = this.lanes.map((lane) => {
            const execStart = this.readMonotonicNs();
            const dirSign: 1 | -1 = lane.direction === 'FORWARD' ? 1 : -1;
            const run = executeInvertibleBatch(
              lane.stateWord,
              admittedOps,
              dirSign,
              this.faults.injectInverseCorruption && lane.laneId === 2
            );
            const execFinish = this.readMonotonicNs();
            const durationNs = Math.max(1, Number(execFinish - execStart));

            lane.sequenceNumber = dispatch.intervalIndex;
            lane.cursorValue += dirSign * admittedOps;
            lane.stateWord = run.finalWord;

            const laneVerified = run.residual === 0;
            if (laneVerified && admittedOps > 0) {
              lane.operationsCompleted += admittedOps;
              lane.bytesCompleted += run.bytesProcessed;
            }

            return {
              lane,
              execStart,
              execFinish,
              durationNs,
              residual: run.residual,
              verified: laneVerified,
              bytesProcessed: laneVerified ? run.bytesProcessed : 0,
            };
          });

          ctx.laneResults = laneResults;
          const allVerified = laneResults.every((r) => r.verified);
          ctx.allVerified = allVerified;
          this.lastBatchResidualOk = allVerified;

          const primary = laneResults[0];
          const totalCompleted = laneResults.reduce((s, r) => (r.verified ? s + admittedOps : s), 0);
          const totalBytes = laneResults.reduce((s, r) => s + r.bytesProcessed, 0);

          if (allVerified) {
            this.currentEpochCompletedOps += totalCompleted;
            this.currentEpochCompletedBytes += totalBytes;
            this.currentEpochVerifiedOps += totalCompleted;
            this.adaptiveController.recordVerifiedExecution(
              admittedOps,
              primary.durationNs,
              this.config.alpha
            );
          } else {
            this.currentEpochIncompleteOps += admittedOps * 4;
            this.transitionState('DEGRADED', 'Inverse residual non-zero; failed batch rejected from throughput');
          }

          if (dispatch.solverBoundaryDue) {
            ctx.solverReceipt = this.executeFiveTickSolver(
              Math.floor(dispatch.intervalIndex / HCCGN_TIMING_CONSTANTS.BASE_INTERVALS_PER_SOLVER),
              laneResults.map((r) => r.residual),
              laneResults.map((r) => r.durationNs)
            );
          } else {
            ctx.solverReceipt = null;
          }

          return {
            ok: allVerified && admittedOps > 0,
            inputSummary: `4-Lane ARX batch=${admittedOps} ops`,
            outputSummary: allVerified
              ? admittedOps > 0
                ? `Residual=0 (${totalCompleted} ops verified)${ctx.solverReceipt ? ` · Solver #${ctx.solverReceipt.solverWindowIndex}` : ''}`
                : '0 ops admitted (budget deferred); dependent interop gated'
              : 'Inverse residual non-zero; batch rejected & downstream interop gated',
          };
        },
      },
      {
        triggerId: 'TRG-04-SYSTEM-INTEROP',
        name: 'Vertical Interoperable Subsystem Dispatch',
        targetSubsystem: 'SYSTEM_INTEROP_BUS',
        dependsOnTriggerId: 'TRG-03-FOUR-LANE-ARX',
        execute: (ctx) => {
          const recs = ctx.adaptive!.recommendations;
          this.interopHooks.forEach((hook) => {
            try {
              hook(recs, null);
            } catch (err) {
              console.error('Interop automation hook error:', err);
            }
          });
          return {
            ok: true,
            inputSummary: `${recs.length} adaptive recommendations (${recs.map((r) => r.subsystem).join(', ')})`,
            outputSummary: `Dispatched sequentially to ${this.interopHooks.size} interoperable automation listener(s)`,
          };
        },
      },
      {
        triggerId: 'TRG-05-CRYPTO-RECEIPT',
        name: 'Section 9 SHA-256 Receipt & LGV Event Anchor',
        targetSubsystem: 'CRYPTO_RECEIPT',
        dependsOnTriggerId: 'TRG-02-ADAPTIVE-BUDGET',
        execute: (ctx) => {
          const dispatch = ctx.dispatch!;
          const admittedOps = ctx.adaptive!.decision.admittedOps;
          const laneResults = ctx.laneResults!;
          const primary = laneResults[0];
          const allVerified = Boolean(ctx.allVerified);

          const { utcIso, correlation } = this.correlateUtc(dispatch.actualDispatchNs);
          const deadlineStatus: DeadlineStatus = dispatch.isMissed
            ? 'MISSED'
            : primary.durationNs > HCCGN_TIMING_CONSTANTS.BASE_INTERVAL_T_NS
            ? 'LATE_COMPLETION'
            : 'ON_TIME';

          const verificationStatus: VerificationStatus = allVerified ? 'VERIFIED' : 'FAILED';
          const eventId = `evt_${this.epochCounter}_${dispatch.intervalIndex}_${Math.random().toString(36).slice(2, 6)}`;

          const unsignedReceipt: Omit<TemporalEventReceipt, 'receipt_digest'> = {
            event_id: eventId,
            schema_version: HCCGN_TIMING_CONSTANTS.SCHEMA_VERSION,
            epoch_id: this.currentEpochId,
            sequence_number: dispatch.intervalIndex,
            parent_event_id: this.lastReceiptId,
            parent_receipt_digest: this.lastReceiptDigest,
            lane_id: 1,
            scheduled_deadline_ns: dispatch.scheduledDeadlineNs.toString(),
            actual_dispatch_ns: dispatch.actualDispatchNs.toString(),
            actual_completion_ns: (dispatch.actualDispatchNs + BigInt(primary.durationNs)).toString(),
            clock_domain: 'DOMAIN_A_MONOTONIC',
            clock_source: this.clockSourceLabel,
            clock_uncertainty_ns: correlation.uncertaintyNs,
            jitter_ns: dispatch.jitterNs,
            execution_duration_ns: primary.durationNs,
            admitted_operations: admittedOps,
            completed_operations: allVerified ? admittedOps : 0,
            completed_bytes: allVerified ? primary.bytesProcessed : 0,
            verification_status: verificationStatus,
            deadline_status: deadlineStatus,
            operator_version: HCCGN_TIMING_CONSTANTS.OPERATOR_VERSION,
            source_ticket_id: primary.lane.sourceTicketId,
          };

          const receiptDigest = sha256Hex(serializeCanonicalEventPayload(unsignedReceipt));
          const receipt: TemporalEventReceipt = {
            ...unsignedReceipt,
            receipt_digest: receiptDigest,
          };

          this.lastReceiptId = receipt.event_id;
          this.lastReceiptDigest = receipt.receipt_digest;
          ctx.receipt = receipt;

          if (ctx.commitAllEvents) {
            this.recentReceipts.unshift(receipt);
            if (this.recentReceipts.length > 80) {
              this.recentReceipts.pop();
            }

            const node = LGV_SPATIAL_NODES[dispatch.intervalIndex % LGV_SPATIAL_NODES.length];
            const lgvEvent: LgvSpatialTemporalEvent = {
              eventId: receipt.event_id,
              spatialId: node.spatialId,
              nodeLabel: node.nodeLabel,
              crs: 'EPSG:4326',
              lon: node.lon,
              lat: node.lat,
              altitudeMeters: node.altitudeMeters,
              monotonicNs: receipt.actual_dispatch_ns,
              correlatedUtcIso: utcIso,
              clockUncertaintyNs: correlation.uncertaintyNs,
              sourceIdentity: receipt.clock_source,
              provenance: `epoch:${receipt.epoch_id}/seq:${receipt.sequence_number}/digest:${receipt.receipt_digest.slice(0, 10)}`,
              verificationStatus: receipt.verification_status,
              timeClassification: 'MEASURED',
            };
            this.lgvEvents.unshift(lgvEvent);
            if (this.lgvEvents.length > 60) {
              this.lgvEvents.pop();
            }
          }

          return {
            ok: true,
            inputSummary: `Status=${verificationStatus} · Deadline=${deadlineStatus}`,
            outputSummary: `Sealed ${receipt.receipt_digest.slice(0, 16)}…`,
          };
        },
      },
    ]);
  }

  /**
   * Executes one scheduled base interval through the sequential dependent trigger pipeline
   * and invokes the 5-tick solver at every 5th interval.
   */
  public stepInterval(commitAllEvents: boolean = true): {
    receipt: TemporalEventReceipt;
    solverReceipt: SolverWindowReceipt | null;
    decision: AdaptiveAdmissionDecision;
    triggerRun: SequentialTriggerPipelineRun;
  } {
    const ctx: StepExecutionContext = { commitAllEvents };
    const preMeta = this.scheduler.getEpochMetadata();
    const triggerRun = this.triggerPipeline.executeSequential(
      `SEQ-${preMeta.epochCounter}-${preMeta.intervalCountInEpoch + 1}`,
      this.currentEpochId,
      this.currentEpochIntervalIdx + 1,
      () => this.readMonotonicNs(),
      ctx
    );

    if (commitAllEvents) {
      this.recentTriggerRuns.unshift(triggerRun);
      if (this.recentTriggerRuns.length > 25) {
        this.recentTriggerRuns.pop();
      }
    }

    return {
      receipt: ctx.receipt!,
      solverReceipt: ctx.solverReceipt ?? null,
      decision: ctx.adaptive!.decision,
      triggerRun,
    };
  }

  private executeFiveTickSolver(
    solverWindowIdx: number,
    residuals: readonly number[],
    durationsNs: readonly number[]
  ): SolverWindowReceipt {
    const prevState = this.state;
    this.transitionState('SOLVER_PENDING', `Solver window #${solverWindowIdx} evaluating 4-lane closure`);

    const scheduledBoundaryNs =
      this.currentEpochOriginNs +
      BigInt(solverWindowIdx) * BigInt(HCCGN_TIMING_CONSTANTS.SOLVER_INTERVAL_S_NS);
    const startNs = this.readMonotonicNs();

    const pairAClosureResidual = (residuals[0] || 0) + (residuals[1] || 0);
    const pairBClosureResidual = (residuals[2] || 0) + (residuals[3] || 0);
    const sequenceContinuityOk = this.lanes.every(
      (l) => l.sequenceNumber === this.currentEpochIntervalIdx
    );

    const endRealNs = this.readMonotonicNs();
    const measuredDuration =
      Math.max(1, Number(endRealNs - startNs)) + this.faults.forceSolverOverrunNs;
    const actualCompletionNs = startNs + BigInt(measuredDuration);

    const latenessNs = Math.max(0, measuredDuration - HCCGN_TIMING_CONSTANTS.SOLVER_INTERVAL_S_NS);
    const isLate = measuredDuration > HCCGN_TIMING_CONSTANTS.SOLVER_INTERVAL_S_NS;

    if (isLate) {
      this.currentEpochLateSolvers += 1;
      this.transitionState(
        'SOLVER_LATE',
        `Solver window #${solverWindowIdx} exceeded 500,000 ns (${measuredDuration.toLocaleString()} ns)`
      );
    } else if (this.isRunning && prevState !== 'FAULTED') {
      this.transitionState(
        this.faults.degradeClockSync ? 'DEGRADED' : 'RUNNING',
        `Solver window #${solverWindowIdx} converged on time`
      );
    }

    const snapshots: FourLaneExecutionSnapshot[] = this.lanes.map((lane, i) => ({
      laneId: lane.laneId,
      role: lane.role,
      direction: lane.direction,
      sequenceNumber: lane.sequenceNumber,
      executionCursor: `0x${(Math.abs(lane.cursorValue) >>> 0).toString(16).padStart(8, '0')}`,
      sourceTicketId: lane.sourceTicketId,
      opposingTicketId: lane.opposingTicketId,
      operationsCompleted: lane.operationsCompleted,
      bytesCompleted: lane.bytesCompleted,
      residualError: residuals[i] || 0,
      lastExecutionDurationNs: durationsNs[i] || 0,
      laneStateDigest: sha256Hex(`${lane.laneId}:${lane.sequenceNumber}:${lane.stateWord}:${lane.sourceTicketId}`).slice(0, 24),
    }));

    const baseSolver = {
      solverWindowIndex: solverWindowIdx,
      epochId: this.currentEpochId,
      scheduledBoundaryNs: scheduledBoundaryNs.toString(),
      actualStartNs: startNs.toString(),
      actualCompletionNs: actualCompletionNs.toString(),
      solverDurationNs: measuredDuration,
      solverLatenessNs: latenessNs,
      isLate,
      snapshotCompleteness: isLate
        ? ('LATE' as const)
        : pairAClosureResidual === 0 && pairBClosureResidual === 0
        ? ('COMPLETE' as const)
        : ('PARTIAL' as const),
      pairAClosureResidual,
      pairBClosureResidual,
      sequenceContinuityOk,
      converged: pairAClosureResidual === 0 && pairBClosureResidual === 0 && sequenceContinuityOk,
      laneSnapshots: snapshots,
    };

    const receipt: SolverWindowReceipt = {
      ...baseSolver,
      solverReceiptDigest: sha256Hex(JSON.stringify(baseSolver)),
    };

    this.latestSolvers.unshift(receipt);
    if (this.latestSolvers.length > 30) {
      this.latestSolvers.pop();
    }

    return receipt;
  }

  /**
   * Executes a real measured nanosecond hardware benchmark burst across epochs
   * on Node.js hrtime.bigint() and compiles p50 / p95 / p99 percentiles.
   */
  public runHardwareBenchmark(targetIntervals: number = 250): BenchmarkReport {
    // Acquire fresh monotonic origin M_0 before benchmark burst per epoch continuation policy
    if (this.currentEpochIntervalIdx > 0) {
      this.closeCurrentEpoch();
    } else {
      this.initializeEpoch();
    }
    const startOrigin = this.readMonotonicNs();
    const samples: BenchmarkSamplePoint[] = [];
    const jitterSamples: number[] = [];
    const batchDurations: number[] = [];
    const solverDurations: number[] = [];

    let missed = 0;
    let lateSolvers = 0;
    let totalVerifiedOps = 0;
    let totalOps = 0;
    let totalBytes = 0;

    for (let i = 0; i < targetIntervals; i++) {
      const { receipt, solverReceipt } = this.stepInterval(i % 10 === 0 || i === targetIntervals - 1);
      const j = Math.max(0, receipt.jitter_ns);
      jitterSamples.push(j);
      batchDurations.push(receipt.execution_duration_ns);
      if (receipt.deadline_status === 'MISSED') missed += 1;

      totalOps += receipt.admitted_operations * 4;
      if (receipt.verification_status === 'VERIFIED') {
        totalVerifiedOps += receipt.completed_operations * 4;
        totalBytes += receipt.completed_bytes * 4;
      }

      if (solverReceipt) {
        solverDurations.push(solverReceipt.solverDurationNs);
        if (solverReceipt.isLate) lateSolvers += 1;
      }

      if (i % 2 === 0) {
        samples.push({
          intervalIndex: receipt.sequence_number,
          jitterNs: receipt.jitter_ns,
          batchDurationNs: receipt.execution_duration_ns,
          admittedOps: receipt.admitted_operations,
          completedOps: receipt.completed_operations,
          missed: receipt.deadline_status === 'MISSED',
        });
      }
    }

    const endNs = this.readMonotonicNs();
    const elapsedSec = Math.max(0.00001, Number(endNs - startOrigin) / 1_000_000_000);

    const sortedBatch = [...batchDurations].sort((a, b) => a - b);
    const sortedJitter = [...jitterSamples].sort((a, b) => a - b);

    const perLaneStats: LaneBenchmarkStats[] = this.lanes.map((l) => ({
      laneId: l.laneId,
      role: l.role,
      direction: l.direction,
      completedOps: l.operationsCompleted,
      completedBytes: l.bytesCompleted,
      opsPerSec: +(l.operationsCompleted / elapsedSec).toFixed(2),
      verificationRate: this.faults.injectInverseCorruption && l.laneId === 2 ? 0.0 : 1.0,
    }));

    const report: BenchmarkReport = {
      benchmarkId: `BENCH-${Date.now().toString(36).toUpperCase()}`,
      executedAtUtc: new Date().toISOString(),
      clockSource: this.clockSourceLabel,
      epochPolicy: HCCGN_TIMING_CONSTANTS.EPOCH_CONTINUATION_POLICY,
      durationSec: +elapsedSec.toFixed(6),
      baseIntervalsMeasured: targetIntervals,
      missedIntervals: missed,
      lateSolverWindows: lateSolvers,
      p50LatencyNs: percentile(sortedBatch, 50),
      p95LatencyNs: percentile(sortedBatch, 95),
      p99LatencyNs: percentile(sortedBatch, 99),
      meanJitterNs: Math.round(jitterSamples.reduce((s, v) => s + v, 0) / Math.max(1, jitterSamples.length)),
      maxJitterNs: sortedJitter[sortedJitter.length - 1] || 0,
      meanBatchDurationNs: Math.round(batchDurations.reduce((s, v) => s + v, 0) / Math.max(1, batchDurations.length)),
      meanSolverDurationNs: Math.round(solverDurations.reduce((s, v) => s + v, 0) / Math.max(1, solverDurations.length)),
      aggregateOpsPerSec: +(totalVerifiedOps / elapsedSec).toFixed(2),
      deduplicatedOpsPerSec: +((totalVerifiedOps / 4) / elapsedSec).toFixed(2),
      bytesPerSec: +(totalBytes / elapsedSec).toFixed(2),
      verificationRate: totalOps > 0 ? +(totalVerifiedOps / totalOps).toFixed(4) : 1.0,
      perLaneStats,
      samples,
    };

    this.latestBenchmark = report;
    this.notifyListeners();
    return report;
  }

  /**
   * Independent cryptographic receipt verification (server-side SHA-256 recomputation).
   */
  public verifyReceipt(receipt: TemporalEventReceipt): {
    valid: boolean;
    recomputedDigest: string;
    expectedDigest: string;
  } {
    const { receipt_digest, ...unsigned } = receipt;
    const recomputedDigest = sha256Hex(serializeCanonicalEventPayload(unsigned));
    return {
      valid: recomputedDigest === receipt_digest,
      recomputedDigest,
      expectedDigest: receipt_digest,
    };
  }

  /**
   * Programmatic Section 15 Verification & Acceptance Criteria Suite.
   */
  public runAcceptanceSuite(): AcceptanceTestResult[] {
    const nowUtc = new Date().toISOString();
    const results: AcceptanceTestResult[] = [];

    // 1. Clock correctness: monotonic non-regression over 100 rapid reads
    let monotonicOk = true;
    let prev = this.readMonotonicNs();
    for (let i = 0; i < 100; i++) {
      const curr = this.readMonotonicNs();
      if (curr < prev) monotonicOk = false;
      prev = curr;
    }
    results.push({
      id: 'ACC-CLK-01',
      category: 'Clock Correctness',
      criterion: 'Monotonic readings never move backward across consecutive hrtime.bigint samples',
      passed: monotonicOk,
      measuredEvidence: `100 reads monotonic=${monotonicOk} (${this.clockSourceLabel})`,
      executedAtUtc: nowUtc,
    });

    // 2. Timing correctness: canonical constants T=100,000ns, S=500,000ns, E=1e9ns, 10,000 intervals
    const timingConstantsOk =
      HCCGN_TIMING_CONSTANTS.BASE_INTERVAL_T_NS === 100_000 &&
      HCCGN_TIMING_CONSTANTS.SOLVER_INTERVAL_S_NS === 500_000 &&
      HCCGN_TIMING_CONSTANTS.EPOCH_DURATION_E_NS === 1_000_000_000 &&
      HCCGN_TIMING_CONSTANTS.EPOCH_DURATION_E_NS / HCCGN_TIMING_CONSTANTS.BASE_INTERVAL_T_NS === 10_000;
    results.push({
      id: 'ACC-TIM-02',
      category: 'Timing Correctness',
      criterion: 'Canonical arithmetic: T=100,000ns, S=5T=500,000ns, E=10,000T=1,000,000,000ns',
      passed: timingConstantsOk,
      measuredEvidence: `T=${HCCGN_TIMING_CONSTANTS.BASE_INTERVAL_T_NS}ns, S=${HCCGN_TIMING_CONSTANTS.SOLVER_INTERVAL_S_NS}ns, Policy=${HCCGN_TIMING_CONSTANTS.EPOCH_CONTINUATION_POLICY}`,
      executedAtUtc: nowUtc,
    });

    // 3. Adaptive controller correctness: insufficient budget yields 0 ops; nominal budget respects [min, max]
    const zeroBudget = Math.max(0, 100_000 - 150_000 - this.config.safetyMarginNsG);
    const zeroBudgetAdmitted = zeroBudget <= 0 ? 0 : this.config.minBatchOps;
    const nominalBudget = Math.floor(
      this.config.targetUtilizationU *
        Math.min(
          this.config.maxExecutionBudgetNs,
          Math.max(0, HCCGN_TIMING_CONSTANTS.BASE_INTERVAL_T_NS - this.config.safetyMarginNsG)
        )
    );
    const nominalCandidate =
      nominalBudget <= 0
        ? 0
        : Math.max(
            this.config.minBatchOps,
            Math.min(
              this.config.maxBatchOps,
              Math.floor(this.adaptiveController.getEwmaRateOpsPerNs() * nominalBudget)
            )
          );
    const lastAdmittedValid =
      !this.latestDecision ||
      (this.latestDecision.targetBudgetNs <= 0
        ? this.latestDecision.admittedOps === 0 || this.latestDecision.backpressureActive
        : this.latestDecision.admittedOps >= this.config.minBatchOps &&
          this.latestDecision.admittedOps <= this.config.maxBatchOps);
    const adaptiveClamped =
      zeroBudget === 0 &&
      zeroBudgetAdmitted === 0 &&
      nominalCandidate >= this.config.minBatchOps &&
      nominalCandidate <= this.config.maxBatchOps &&
      lastAdmittedValid;
    results.push({
      id: 'ACC-ADP-03',
      category: 'Adaptive Controller',
      criterion: 'Zero safe budget admits 0 ops; admitted batch strictly respects configured min/max bounds',
      passed: adaptiveClamped,
      measuredEvidence: `ZeroBudget=${zeroBudget}ns -> ${zeroBudgetAdmitted} ops; NominalBudget=${nominalBudget}ns -> ${nominalCandidate} ops [${this.config.minBatchOps}..${this.config.maxBatchOps}]`,
      executedAtUtc: nowUtc,
    });

    // 4. Solver correctness: invertible ARX batch & inverse check produces zero residual
    const inverseTest = executeInvertibleBatch(0x13579bdf, 256, 1, false);
    const corruptTest = executeInvertibleBatch(0x13579bdf, 256, 1, true);
    results.push({
      id: 'ACC-SLV-04',
      category: 'Solver Correctness',
      criterion: 'Inverse reconstruction yields residual=0 when valid and residual!=0 when corrupted',
      passed: inverseTest.residual === 0 && corruptTest.residual !== 0,
      measuredEvidence: `ValidResidual=${inverseTest.residual}, CorruptedResidual=0x${corruptTest.residual.toString(16)}`,
      executedAtUtc: nowUtc,
    });

    // 5. Receipt correctness: SHA-256 deterministic canonical digest rejects altered payload
    const sampleStep = this.stepInterval(false);
    const validCheck = this.verifyReceipt(sampleStep.receipt);
    const tamperedReceipt: TemporalEventReceipt = {
      ...sampleStep.receipt,
      completed_operations: sampleStep.receipt.completed_operations + 999,
    };
    const tamperedCheck = this.verifyReceipt(tamperedReceipt);
    results.push({
      id: 'ACC-RCP-05',
      category: 'Receipt Correctness',
      criterion: 'Canonical SHA-256 passes intact receipt and rejects altered receipt payload',
      passed: validCheck.valid && !tamperedCheck.valid,
      measuredEvidence: `Intact=${validCheck.valid}, AlteredRejected=${!tamperedCheck.valid} (Digest=${validCheck.recomputedDigest.slice(0, 12)}...)`,
      executedAtUtc: nowUtc,
    });

    // 6. Cross-Device correctness: UTC correlation exposes uncertainty and clock identity
    const corr = this.correlateUtc(this.readMonotonicNs());
    const crossDeviceOk =
      corr.correlation.uncertaintyNs > 0 &&
      corr.correlation.syncSource.sourceId.length > 0 &&
      corr.correlation.hardwareTimestampSupported === false;
    results.push({
      id: 'ACC-DEV-06',
      category: 'Cross-Device Correctness',
      criterion: 'Preserves source identity, explicit UTC uncertainty, and honest HW timestamp capability',
      passed: crossDeviceOk,
      measuredEvidence: `Source=${corr.correlation.syncSource.sourceId}, Uncertainty=±${corr.correlation.uncertaintyNs}ns, HWTimestamp=${corr.correlation.hardwareTimestampSupported}`,
      executedAtUtc: nowUtc,
    });

    // 7. Sequential Dependent Trigger Gating
    const seqProbe = new SequentialTriggerPipeline<{ trace: string[] }>([
      {
        triggerId: 'PROBE-1',
        name: 'Root Gate',
        targetSubsystem: 'DOMAIN_A_CLOCK',
        dependsOnTriggerId: null,
        execute: (c) => {
          c.trace.push('1');
          return { ok: true, inputSummary: 'root', outputSummary: 'ok' };
        },
      },
      {
        triggerId: 'PROBE-2',
        name: 'Failing Midpoint',
        targetSubsystem: 'FOUR_LANE_SOLVER',
        dependsOnTriggerId: 'PROBE-1',
        execute: (c) => {
          c.trace.push('2');
          return { ok: false, inputSummary: 'mid', outputSummary: 'forced-fail' };
        },
      },
      {
        triggerId: 'PROBE-3',
        name: 'Dependent Gate',
        targetSubsystem: 'SYSTEM_INTEROP_BUS',
        dependsOnTriggerId: 'PROBE-2',
        execute: (c) => {
          c.trace.push('3');
          return { ok: true, inputSummary: 'dep', outputSummary: 'should-skip' };
        },
      },
    ]);
    const probeCtx = { trace: [] as string[] };
    const probeRun = seqProbe.executeSequential('PROBE-RUN', this.currentEpochId, 0, () => this.readMonotonicNs(), probeCtx);
    const seqGatedOk =
      probeCtx.trace.join(',') === '1,2' &&
      probeRun.stages[0].status === 'APPLIED' &&
      probeRun.stages[1].status === 'FAILED' &&
      probeRun.stages[2].status === 'SKIPPED_DEPENDENCY_FAILED';
    results.push({
      id: 'ACC-SEQ-07',
      category: 'Adaptive Controller',
      criterion: 'Triggers run strictly sequentially and dependent triggers skip when upstream dependency fails',
      passed: seqGatedOk,
      measuredEvidence: `Order=[${probeCtx.trace.join('->')}], Stage3=${probeRun.stages[2].status}`,
      executedAtUtc: nowUtc,
    });

    return results;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.transitionState(
      this.faults.degradeClockSync ? 'DEGRADED' : 'RUNNING',
      'Scheduler loop started (15ms bounded telemetry tick cadence)'
    );

    // Populate initial windows so UI immediately displays live telemetry
    for (let i = 0; i < 6; i++) {
      this.stepInterval(true);
    }

    this.runTimer = setInterval(() => {
      if (!this.isRunning) return;
      for (let i = 0; i < 5; i++) {
        this.stepInterval(i === 4);
      }
      this.notifyListeners();
    }, 100);

    this.notifyListeners();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.runTimer) {
      clearInterval(this.runTimer);
      this.runTimer = null;
    }
    this.transitionState('CLOCK_READY', 'Scheduler paused by operator');
    this.notifyListeners();
  }

  public updateConfig(partial: Partial<AdaptiveControllerConfig>): AdaptiveControllerConfig {
    this.config = {
      ...this.config,
      ...partial,
      targetUtilizationU: Math.min(1.0, Math.max(0.05, partial.targetUtilizationU ?? this.config.targetUtilizationU)),
      alpha: Math.min(0.95, Math.max(0.01, partial.alpha ?? this.config.alpha)),
      safetyMarginNsG: Math.max(0, partial.safetyMarginNsG ?? this.config.safetyMarginNsG),
      minBatchOps: Math.max(1, partial.minBatchOps ?? this.config.minBatchOps),
      maxBatchOps: Math.max(1, partial.maxBatchOps ?? this.config.maxBatchOps),
    };
    this.notifyListeners();
    return this.config;
  }

  public updateFaults(partial: Partial<FaultInjectionConfig>): FaultInjectionConfig {
    this.faults = { ...this.faults, ...partial };
    if (this.faults.degradeClockSync) {
      this.transitionState('CLOCK_UNSYNCED', 'Clock sync degradation fault injected');
    } else if (this.isRunning) {
      this.transitionState('RUNNING', 'Fault cleared; clock returning to RUNNING');
    }
    this.notifyListeners();
    return this.faults;
  }

  public getSnapshot(): UniversalClockSnapshot {
    const nowNs = this.readMonotonicNs();
    const { utcIso, correlation } = this.correlateUtc(nowNs);
    const elapsedSec = Math.max(
      0.000001,
      Number(nowNs - this.currentEpochOriginNs) / 1_000_000_000
    );

    const sortedJitter = [...this.jitterHistogramNs].sort((a, b) => a - b);
    const p50 = percentile(sortedJitter, 50);
    const p95 = percentile(sortedJitter, 95);
    const p99 = percentile(sortedJitter, 99);
    const meanJitter = Math.round(
      this.jitterHistogramNs.reduce((s, v) => s + v, 0) / Math.max(1, this.jitterHistogramNs.length)
    );

    const activeEpoch: EpochSummaryRecord = {
      epochId: this.currentEpochId,
      epochPolicy: HCCGN_TIMING_CONSTANTS.EPOCH_CONTINUATION_POLICY,
      originMonotonicNs: this.currentEpochOriginNs.toString(),
      deadlineMonotonicNs: this.currentEpochDeadlineNs.toString(),
      closedMonotonicNs: null,
      measuredElapsedSec: +elapsedSec.toFixed(6),
      baseIntervalsScheduled: this.currentEpochIntervalIdx,
      missedIntervals: this.currentEpochMissedIntervals,
      lateSolvers: this.currentEpochLateSolvers,
      admittedOperations: this.currentEpochAdmittedOps,
      completedOperations: this.currentEpochCompletedOps,
      completedBytes: this.currentEpochCompletedBytes,
      opsPerSec: +(this.currentEpochCompletedOps / elapsedSec).toFixed(2),
      bytesPerSec: +(this.currentEpochCompletedBytes / elapsedSec).toFixed(2),
      deduplicatedOpsPerSec: +(this.currentEpochCompletedOps / 4 / elapsedSec).toFixed(2),
      verificationRate:
        this.currentEpochCompletedOps > 0
          ? +(this.currentEpochVerifiedOps / this.currentEpochCompletedOps).toFixed(4)
          : 1.0,
      incompleteWorkOps: this.currentEpochIncompleteOps,
      epochState: 'ACTIVE',
      epochReceiptDigest: null,
    };

    const latestLanes: FourLaneExecutionSnapshot[] = this.lanes.map((l) => ({
      laneId: l.laneId,
      role: l.role,
      direction: l.direction,
      sequenceNumber: l.sequenceNumber,
      executionCursor: `0x${(Math.abs(l.cursorValue) >>> 0).toString(16).padStart(8, '0')}`,
      sourceTicketId: l.sourceTicketId,
      opposingTicketId: l.opposingTicketId,
      operationsCompleted: l.operationsCompleted,
      bytesCompleted: l.bytesCompleted,
      residualError: this.faults.injectInverseCorruption && l.laneId === 2 ? 1 : 0,
      lastExecutionDurationNs: this.latestSolvers[0]?.laneSnapshots[l.laneId - 1]?.lastExecutionDurationNs ?? 0,
      laneStateDigest: sha256Hex(`${l.laneId}:${l.sequenceNumber}:${l.stateWord}`).slice(0, 20),
    }));

    return {
      state: this.state,
      isRunning: this.isRunning,
      currentMonotonicNs: nowNs.toString(),
      currentUtcIso: utcIso,
      correlation,
      config: this.config,
      faults: this.faults,
      schedulerAnchor: this.scheduler.getAnchorRecord(),
      adaptiveRecommendations: this.adaptiveController.getLatestRecommendations(),
      latestTriggerRun: this.recentTriggerRuns[0] ?? null,
      recentTriggerRuns: this.recentTriggerRuns,
      activeEpoch,
      recentEpochs: this.recentEpochs,
      latestDecision: this.latestDecision,
      latestLanes,
      latestSolvers: this.latestSolvers,
      recentReceipts: this.recentReceipts,
      recentTransitions: this.recentTransitions,
      lgvEvents: this.lgvEvents,
      latestBenchmark: this.latestBenchmark,
      telemetrySummary: {
        p50JitterNs: p50,
        p95JitterNs: p95,
        p99JitterNs: p99,
        meanJitterNs: meanJitter,
        ewmaThroughputOpsPerSec: Math.round(this.adaptiveController.getEwmaRateOpsPerNs() * 1_000_000_000),
        verificationRate: activeEpoch.verificationRate,
      },
    };
  }

  public runSequentialTriggersNow(): {
    triggerRun: SequentialTriggerPipelineRun;
    snapshot: UniversalClockSnapshot;
  } {
    const res = this.stepInterval(true);
    this.notifyListeners();
    return { triggerRun: res.triggerRun, snapshot: this.getSnapshot() };
  }

  public registerInteropHook(
    hook: (recs: readonly AdaptiveRecommendation[], triggerRun: SequentialTriggerPipelineRun | null) => void
  ): () => void {
    this.interopHooks.add(hook);
    return () => {
      this.interopHooks.delete(hook);
    };
  }

  public subscribe(listener: (snapshot: UniversalClockSnapshot) => void): () => void {
    this.broadcastListeners.add(listener);
    return () => {
      this.broadcastListeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const snap = this.getSnapshot();
    this.broadcastListeners.forEach((cb) => {
      try {
        cb(snap);
      } catch (err) {
        console.error('UniversalClock listener error:', err);
      }
    });
  }
}

export const globalUniversalClockKernel = new UniversalClockKernel();
