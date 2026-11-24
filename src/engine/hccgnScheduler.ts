/**
 * =============================================================================
 * SPECIFICATION: HCCGN.UCLK.DUAL.ADAPTIVE v1.0
 * MODULE: Authoritative Base Interval Scheduler, Adaptive Controller &
 *         Sequential Interoperable Trigger Pipeline
 * RUNTIME: Node.js process.hrtime.bigint() (nanosecond monotonic precision)
 * =============================================================================
 */

import {
  HCCGN_TIMING_CONSTANTS,
  AdaptiveControllerConfig,
  AdaptiveAdmissionDecision,
  AdaptiveRecommendation,
  FaultInjectionConfig,
  SchedulerAnchorRecord,
  SequentialTriggerStage,
  SequentialTriggerPipelineRun,
} from '../contracts/universal-clock';

export interface DispatchedIntervalWindow {
  readonly epochId: string;
  readonly epochRotated: boolean;
  readonly intervalIndex: number;
  readonly slotIndex: number;
  readonly scheduledDeadlineNs: bigint;
  readonly actualDispatchNs: bigint;
  readonly jitterNs: number;
  readonly latenessNs: number;
  readonly isMissed: boolean;
  readonly missedTicksThisInterval: number;
  readonly cumulativeMissedTicks: number;
  readonly solverBoundaryDue: boolean;
}

export interface AdaptiveEvaluationContext {
  readonly decision: AdaptiveAdmissionDecision;
  readonly recommendations: readonly AdaptiveRecommendation[];
  readonly effectiveUtilizationU: number;
}

export interface TelemetryPressureSnapshot {
  readonly p95DurationNs: number;
  readonly p99DurationNs: number;
  readonly lastBatchResidualOk: boolean;
  readonly missedTicksThisInterval: number;
  readonly syncDegraded: boolean;
}

export interface SequentialTriggerDefinition<TCtx> {
  readonly triggerId: string;
  readonly name: string;
  readonly targetSubsystem: string;
  readonly dependsOnTriggerId: string | null;
  readonly execute: (
    ctx: TCtx,
    upstreamResult: TriggerExecutionOutcome | null
  ) => TriggerExecutionOutcome;
}

export interface TriggerExecutionOutcome {
  readonly ok: boolean;
  readonly inputSummary: string;
  readonly outputSummary: string;
  readonly data?: Record<string, unknown>;
}

/**
 * HCCGN Base Interval Scheduler (Section 2, 4.1, 5, 10)
 * Anchors every scheduling slot absolutely to d_n = M_0 + n * T using
 * process.hrtime.bigint() and tracks missed ticks without catch-up bursts.
 */
function getSafeMonotonicNs(): bigint {
  if (typeof process !== 'undefined' && process && typeof process.hrtime === 'function' && typeof process.hrtime.bigint === 'function') {
    return process.hrtime.bigint();
  }
  if (typeof performance !== 'undefined' && performance && typeof performance.now === 'function') {
    return BigInt(Math.floor(performance.now() * 1_000_000));
  }
  return BigInt(Date.now()) * 1_000_000n;
}

export class HccgnBaseIntervalScheduler {
  public readonly clockSourceLabel = 'node:process.hrtime.bigint (CLOCK_MONOTONIC)';
  private lastMonotonicReading: bigint = getSafeMonotonicNs();

  private epochCounter: number = 0;
  private epochId: string = 'EPOCH-0000';
  private epochOriginNs: bigint = this.lastMonotonicReading;
  private epochDeadlineNs: bigint =
    this.epochOriginNs + BigInt(HCCGN_TIMING_CONSTANTS.EPOCH_DURATION_E_NS);
  private epochStartWallMs: number = Date.now();

  private intervalCountInEpoch: number = 0;
  private nextSlotIndex: number = 1;
  private lastScheduledDeadlineNs: bigint = this.epochOriginNs;
  private lastActualDispatchNs: bigint = this.epochOriginNs;
  private lastLatenessNs: number = 0;
  private lastMissedTicksThisInterval: number = 0;
  private cumulativeMissedTicks: number = 0;

  constructor() {
    this.rotateEpoch();
  }

  /**
   * Monotonic read with strict non-regression guarantee (Section 4.1).
   */
  public readMonotonicNs(): bigint {
    const raw = getSafeMonotonicNs();
    if (raw >= this.lastMonotonicReading) {
      this.lastMonotonicReading = raw;
    }
    return this.lastMonotonicReading;
  }

  /**
   * Section 10 — Policy: FRESH_MONOTONIC_ORIGIN_PER_EPOCH
   * Acquires a newly sampled monotonic origin M_0 at the start of every 1s epoch.
   */
  public rotateEpoch(): {
    epochId: string;
    originNs: bigint;
    deadlineNs: bigint;
    wallStartMs: number;
  } {
    this.epochCounter += 1;
    this.epochStartWallMs = Date.now();
    this.epochOriginNs = this.readMonotonicNs();
    this.epochDeadlineNs =
      this.epochOriginNs + BigInt(HCCGN_TIMING_CONSTANTS.EPOCH_DURATION_E_NS);
    this.epochId = `EPOCH-${String(this.epochCounter).padStart(4, '0')}`;
    this.intervalCountInEpoch = 0;
    this.nextSlotIndex = 1;
    this.lastScheduledDeadlineNs =
      this.epochOriginNs + BigInt(HCCGN_TIMING_CONSTANTS.BASE_INTERVAL_T_NS);
    this.lastActualDispatchNs = this.epochOriginNs;
    this.lastLatenessNs = 0;
    this.lastMissedTicksThisInterval = 0;

    return {
      epochId: this.epochId,
      originNs: this.epochOriginNs,
      deadlineNs: this.epochDeadlineNs,
      wallStartMs: this.epochStartWallMs,
    };
  }

  public isEpochExpired(nowNs?: bigint): boolean {
    const reading = nowNs ?? this.readMonotonicNs();
    return reading >= this.epochDeadlineNs;
  }

  public getEpochMetadata() {
    return {
      epochCounter: this.epochCounter,
      epochId: this.epochId,
      originNs: this.epochOriginNs,
      deadlineNs: this.epochDeadlineNs,
      wallStartMs: this.epochStartWallMs,
      intervalCountInEpoch: this.intervalCountInEpoch,
    };
  }

  /**
   * Schedules and anchors the next base interval at d_n = M_0 + slot * T.
   * Tracks missed ticks when dispatch exceeds d_n + T and advances the next
   * anchor slot without issuing catch-up bursts (Section 5.4).
   */
  public dispatchInterval(injectedDelayNs: number = 0): DispatchedIntervalWindow {
    const T = BigInt(HCCGN_TIMING_CONSTANTS.BASE_INTERVAL_T_NS);
    const slotUsed = this.nextSlotIndex;
    const scheduledDeadlineNs = this.epochOriginNs + BigInt(slotUsed) * T;

    let actualDispatchNs = this.readMonotonicNs();
    if (injectedDelayNs > 0) {
      actualDispatchNs += BigInt(Math.floor(injectedDelayNs));
    }

    this.intervalCountInEpoch += 1;
    const jitterNs = Number(actualDispatchNs - scheduledDeadlineNs);
    const latenessNs = Math.max(0, jitterNs);
    const isMissed = jitterNs > HCCGN_TIMING_CONSTANTS.BASE_INTERVAL_T_NS;

    let missedTicksThisInterval = 0;
    if (actualDispatchNs > scheduledDeadlineNs + T) {
      const skippedSlots = Math.floor(
        Number(actualDispatchNs - scheduledDeadlineNs) / HCCGN_TIMING_CONSTANTS.BASE_INTERVAL_T_NS
      );
      missedTicksThisInterval = Math.max(1, skippedSlots);
      this.cumulativeMissedTicks += missedTicksThisInterval;

      // Advance deadline anchor cleanly past the elapsed gap (no catch-up burst)
      const currentSlot = Math.floor(
        Number(actualDispatchNs - this.epochOriginNs) / HCCGN_TIMING_CONSTANTS.BASE_INTERVAL_T_NS
      );
      this.nextSlotIndex = Math.max(slotUsed + 1, currentSlot + 1);
    } else {
      this.nextSlotIndex = slotUsed + 1;
    }

    this.lastScheduledDeadlineNs = scheduledDeadlineNs;
    this.lastActualDispatchNs = actualDispatchNs;
    this.lastLatenessNs = latenessNs;
    this.lastMissedTicksThisInterval = missedTicksThisInterval;

    return {
      epochId: this.epochId,
      epochRotated: false,
      intervalIndex: this.intervalCountInEpoch,
      slotIndex: slotUsed,
      scheduledDeadlineNs,
      actualDispatchNs,
      jitterNs,
      latenessNs,
      isMissed,
      missedTicksThisInterval,
      cumulativeMissedTicks: this.cumulativeMissedTicks,
      solverBoundaryDue:
        this.intervalCountInEpoch % HCCGN_TIMING_CONSTANTS.BASE_INTERVALS_PER_SOLVER === 0,
    };
  }

  public getAnchorRecord(): SchedulerAnchorRecord {
    const T = BigInt(HCCGN_TIMING_CONSTANTS.BASE_INTERVAL_T_NS);
    const nextDeadlineNs = this.epochOriginNs + BigInt(this.nextSlotIndex) * T;
    return {
      epochId: this.epochId,
      epochOriginNs: this.epochOriginNs.toString(),
      epochDeadlineNs: this.epochDeadlineNs.toString(),
      currentSlotIndex: this.nextSlotIndex,
      nextDeadlineNs: nextDeadlineNs.toString(),
      lastScheduledDeadlineNs: this.lastScheduledDeadlineNs.toString(),
      lastActualDispatchNs: this.lastActualDispatchNs.toString(),
      lastLatenessNs: this.lastLatenessNs,
      missedTicksThisInterval: this.lastMissedTicksThisInterval,
      cumulativeMissedTicks: this.cumulativeMissedTicks,
      catchUpPolicy: 'ADVANCE_WITHOUT_BURST',
      solverBoundaryDue:
        this.intervalCountInEpoch > 0 &&
        this.intervalCountInEpoch % HCCGN_TIMING_CONSTANTS.BASE_INTERVALS_PER_SOLVER === 0,
      clockSource: this.clockSourceLabel,
    };
  }
}

/**
 * HCCGN Adaptive Computation Controller (Section 3.2 & Section 7)
 * Combines safe budget math, p95/p99 tail pressure damping, queue backpressure,
 * verified-only EWMA throughput adaptation, and vertical subsystem recommendations.
 */
export class HccgnAdaptiveController {
  private ewmaOpsPerNs: number = 0.045;
  private observationCount: number = 0;
  private lastAdmittedBatch: number = 256;
  private latestRecommendations: AdaptiveRecommendation[] = [];

  public getEwmaRateOpsPerNs(): number {
    return this.ewmaOpsPerNs;
  }

  public getLastAdmittedBatch(): number {
    return this.lastAdmittedBatch;
  }

  public getLatestRecommendations(): readonly AdaptiveRecommendation[] {
    return this.latestRecommendations;
  }

  public evaluateAdmission(
    intervalIndex: number,
    jitterNs: number,
    config: AdaptiveControllerConfig,
    faults: FaultInjectionConfig,
    pressure: TelemetryPressureSnapshot
  ): AdaptiveEvaluationContext {
    const latenessL = Math.max(0, jitterNs);
    const availableBudgetNs = Math.max(
      0,
      HCCGN_TIMING_CONSTANTS.BASE_INTERVAL_T_NS - latenessL - config.safetyMarginNsG
    );

    // Dynamically adjust target utilization using p95/p99 & missed-tick recommendations
    let utilScale = 1.0;
    if (pressure.p99DurationNs > HCCGN_TIMING_CONSTANTS.BASE_INTERVAL_T_NS * 0.75) {
      utilScale = 0.7;
    } else if (pressure.p95DurationNs > HCCGN_TIMING_CONSTANTS.BASE_INTERVAL_T_NS * 0.5) {
      utilScale = 0.85;
    }
    if (pressure.missedTicksThisInterval > 0) {
      utilScale = Math.min(utilScale, 0.75);
    }

    const effectiveU = Math.max(0.1, config.targetUtilizationU * utilScale);
    const boundedBudget = Math.min(availableBudgetNs, config.maxExecutionBudgetNs);
    const targetBudgetNs = Math.floor(effectiveU * boundedBudget);

    const queueDepth = faults.simulatedQueueDepth;
    const backpressureActive = queueDepth >= config.queueCapacityLimit;

    let admittedOps = 0;
    let reason = 'Nominal budget admission';

    if (backpressureActive) {
      admittedOps = config.minBatchOps;
      reason = `Backpressure clamp (queue=${queueDepth}/${config.queueCapacityLimit})`;
    } else if (targetBudgetNs <= 0) {
      admittedOps = 0;
      reason = 'Insufficient remaining budget (deferred)';
    } else {
      const rawEstimate = Math.floor(this.ewmaOpsPerNs * targetBudgetNs);
      let candidate = Math.max(config.minBatchOps, Math.min(config.maxBatchOps, rawEstimate));

      if (this.observationCount >= config.minObservationSamples) {
        const maxDelta = Math.max(1, Math.floor(this.lastAdmittedBatch * config.maxRateOfChangePct));
        if (candidate > this.lastAdmittedBatch + maxDelta) {
          candidate = this.lastAdmittedBatch + maxDelta;
          reason = 'Clamped upward rate-of-change step';
        } else if (candidate < this.lastAdmittedBatch - maxDelta) {
          candidate = this.lastAdmittedBatch - maxDelta;
          reason = 'Damped downward rate step';
        } else if (utilScale < 1.0) {
          reason = `p95/p99 tail damping active (U*=${effectiveU.toFixed(2)})`;
        }
      } else {
        candidate = Math.min(candidate, Math.max(config.minBatchOps, 128));
        reason = `Observation warmup (${this.observationCount + 1}/${config.minObservationSamples})`;
      }

      admittedOps = candidate;
    }

    if (admittedOps > 0) {
      this.lastAdmittedBatch = admittedOps;
    }

    const decision: AdaptiveAdmissionDecision = {
      intervalIndex,
      availableBudgetNs,
      targetBudgetNs,
      admittedOps,
      ewmaRateOpsPerNs: +this.ewmaOpsPerNs.toFixed(6),
      queueDepth,
      backpressureActive,
      reason,
    };

    const recommendations = this.buildVerticalRecommendations(
      decision,
      utilScale,
      pressure,
      faults
    );
    this.latestRecommendations = recommendations;

    return {
      decision,
      recommendations,
      effectiveUtilizationU: effectiveU,
    };
  }

  /**
   * Updates throughput EWMA strictly from verified work with 2.5x outlier suppression.
   */
  public recordVerifiedExecution(
    completedOps: number,
    durationNs: number,
    alpha: number
  ): void {
    if (completedOps <= 0 || durationNs <= 0) return;
    const measuredRate = completedOps / durationNs;
    const boundedRate = Math.min(measuredRate, this.ewmaOpsPerNs * 2.5);
    this.ewmaOpsPerNs = alpha * boundedRate + (1 - alpha) * this.ewmaOpsPerNs;
    this.observationCount += 1;
  }

  private buildVerticalRecommendations(
    decision: AdaptiveAdmissionDecision,
    utilScale: number,
    pressure: TelemetryPressureSnapshot,
    faults: FaultInjectionConfig
  ): AdaptiveRecommendation[] {
    const recs: AdaptiveRecommendation[] = [];

    recs.push({
      id: `REC-SCH-${decision.intervalIndex}`,
      subsystem: 'SCHEDULER',
      action:
        decision.targetBudgetNs <= 0
          ? 'HOLD_BATCH_ADMISSION'
          : utilScale < 1.0
          ? `THROTTLE_UTILIZATION_${Math.round(utilScale * 100)}PCT`
          : 'NOMINAL_CADENCE_100US',
      reason:
        pressure.missedTicksThisInterval > 0
          ? `Skipped ${pressure.missedTicksThisInterval} base tick(s); anchor advanced cleanly`
          : `Safe budget ${decision.availableBudgetNs.toLocaleString()} ns (${decision.admittedOps} ops)`,
      severity:
        decision.targetBudgetNs <= 0
          ? 'CRITICAL'
          : pressure.missedTicksThisInterval > 0 || utilScale < 1.0
          ? 'WARNING'
          : 'INFO',
      targetUtilScale: utilScale,
      recommendedBatchOps: decision.admittedOps,
      applied: true,
    });

    recs.push({
      id: `REC-SLV-${decision.intervalIndex}`,
      subsystem: 'FOUR_LANE_SOLVER',
      action: pressure.lastBatchResidualOk
        ? 'MAINTAIN_FOUR_LANE_SYMMETRY'
        : 'REJECT_CORRUPTED_INVERSE_AND_QUARANTINE',
      reason: pressure.lastBatchResidualOk
        ? 'Inverse checks closed with residual = 0'
        : 'Non-zero inverse residual detected; excluded from throughput EWMA',
      severity: pressure.lastBatchResidualOk ? 'INFO' : 'CRITICAL',
      targetUtilScale: pressure.lastBatchResidualOk ? utilScale : 0.25,
      recommendedBatchOps: decision.admittedOps,
      applied: true,
    });

    recs.push({
      id: `REC-ARB-${decision.intervalIndex}`,
      subsystem: 'ARBITRAGE_PIPELINE',
      action: decision.backpressureActive
        ? 'ENABLE_ORDERFLOW_BACKPRESSURE'
        : 'DISPATCH_INTEROP_PIPELINE_DELTA',
      reason: decision.backpressureActive
        ? `Queue depth ${decision.queueDepth} reached capacity limit`
        : 'Stream verified execution cadence into WS workflow pipeline',
      severity: decision.backpressureActive ? 'WARNING' : 'INFO',
      targetUtilScale: utilScale,
      recommendedBatchOps: decision.admittedOps,
      applied: true,
    });

    recs.push({
      id: `REC-LGV-${decision.intervalIndex}`,
      subsystem: 'LGV_BRIDGE',
      action: pressure.syncDegraded
        ? 'MARK_UTC_ESTIMATES_UNSYNCED'
        : 'ANCHOR_SPATIAL_TIMESTAMPS',
      reason: pressure.syncDegraded
        ? 'External UTC uncertainty elevated; preserve Domain A ordering'
        : 'Correlate monotonic receipts with EPSG:4326 spatial nodes',
      severity: pressure.syncDegraded ? 'WARNING' : 'INFO',
      targetUtilScale: utilScale,
      recommendedBatchOps: decision.admittedOps,
      applied: true,
    });

    recs.push({
      id: `REC-CRY-${decision.intervalIndex}`,
      subsystem: 'CRYPTIC_MINING',
      action:
        faults.forceSolverOverrunNs > 0
          ? 'DEFER_NONCE_BURST_ON_SOLVER_OVERRUN'
          : 'SYNC_FNV_TETHER_CADENCE',
      reason:
        faults.forceSolverOverrunNs > 0
          ? `Solver overrun +${faults.forceSolverOverrunNs.toLocaleString()} ns constrained pool burst`
          : 'Align FNV-1a virtual mount commits with verified epoch cadence',
      severity: faults.forceSolverOverrunNs > 0 ? 'WARNING' : 'INFO',
      targetUtilScale: utilScale,
      recommendedBatchOps: decision.admittedOps,
      applied: true,
    });

    return recs;
  }
}

/**
 * Deterministic Sequential Trigger Pipeline
 * Applies independent root triggers in order and gates every dependent trigger
 * strictly on the completion status of its declared upstream prerequisite.
 */
export class SequentialTriggerPipeline<TCtx> {
  private readonly definitions: SequentialTriggerDefinition<TCtx>[] = [];

  constructor(initialDefinitions: readonly SequentialTriggerDefinition<TCtx>[] = []) {
    this.definitions.push(...initialDefinitions);
  }

  public registerTrigger(def: SequentialTriggerDefinition<TCtx>): void {
    this.definitions.push(def);
  }

  public executeSequential(
    runId: string,
    epochId: string,
    intervalIndex: number,
    readMonotonicNs: () => bigint,
    context: TCtx
  ): SequentialTriggerPipelineRun {
    const startWall = new Date().toISOString();
    const pipelineStartNs = readMonotonicNs();
    const completedById = new Map<string, { status: SequentialTriggerStage['status']; outcome: TriggerExecutionOutcome | null }>();
    const stages: SequentialTriggerStage[] = [];
    let allSucceeded = true;

    for (let i = 0; i < this.definitions.length; i++) {
      const def = this.definitions[i];
      const stageStartNs = readMonotonicNs();

      // Strict sequential dependency gate
      if (def.dependsOnTriggerId !== null) {
        const dep = completedById.get(def.dependsOnTriggerId);
        if (!dep || dep.status !== 'APPLIED') {
          allSucceeded = false;
          const skippedNs = readMonotonicNs();
          stages.push({
            sequenceOrder: i + 1,
            triggerId: def.triggerId,
            name: def.name,
            targetSubsystem: def.targetSubsystem,
            dependsOnTriggerId: def.dependsOnTriggerId,
            status: 'SKIPPED_DEPENDENCY_FAILED',
            startedNs: stageStartNs.toString(),
            completedNs: skippedNs.toString(),
            durationNs: Math.max(0, Number(skippedNs - stageStartNs)),
            inputSummary: `Blocked by upstream ${def.dependsOnTriggerId}`,
            outputSummary: 'Skipped due to unsatisfied sequential dependency',
          });
          completedById.set(def.triggerId, { status: 'SKIPPED_DEPENDENCY_FAILED', outcome: null });
          continue;
        }
      }

      const upstreamOutcome =
        def.dependsOnTriggerId !== null
          ? completedById.get(def.dependsOnTriggerId)?.outcome ?? null
          : null;

      try {
        const outcome = def.execute(context, upstreamOutcome);
        const stageEndNs = readMonotonicNs();
        const status: SequentialTriggerStage['status'] = outcome.ok ? 'APPLIED' : 'FAILED';
        if (!outcome.ok) {
          allSucceeded = false;
        }

        stages.push({
          sequenceOrder: i + 1,
          triggerId: def.triggerId,
          name: def.name,
          targetSubsystem: def.targetSubsystem,
          dependsOnTriggerId: def.dependsOnTriggerId,
          status,
          startedNs: stageStartNs.toString(),
          completedNs: stageEndNs.toString(),
          durationNs: Math.max(1, Number(stageEndNs - stageStartNs)),
          inputSummary: outcome.inputSummary,
          outputSummary: outcome.outputSummary,
        });
        completedById.set(def.triggerId, { status, outcome });
      } catch (err: any) {
        allSucceeded = false;
        const failEndNs = readMonotonicNs();
        const msg = err?.message || 'Unhandled trigger execution error';
        stages.push({
          sequenceOrder: i + 1,
          triggerId: def.triggerId,
          name: def.name,
          targetSubsystem: def.targetSubsystem,
          dependsOnTriggerId: def.dependsOnTriggerId,
          status: 'FAILED',
          startedNs: stageStartNs.toString(),
          completedNs: failEndNs.toString(),
          durationNs: Math.max(1, Number(failEndNs - stageStartNs)),
          inputSummary: 'Trigger invocation',
          outputSummary: msg,
        });
        completedById.set(def.triggerId, { status: 'FAILED', outcome: null });
      }
    }

    const pipelineEndNs = readMonotonicNs();
    return {
      runId,
      intervalIndex,
      epochId,
      executedAtUtc: startWall,
      allSucceeded,
      totalDurationNs: Math.max(1, Number(pipelineEndNs - pipelineStartNs)),
      stages,
    };
  }
}
