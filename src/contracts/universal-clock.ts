/**
 * =============================================================================
 * SPECIFICATION: HCCGN.UCLK.DUAL.ADAPTIVE v1.0
 * MODULE: Universal Clock, Adaptive Controller, 5-Tick Solver & LGV Contracts
 * =============================================================================
 */

export const HCCGN_TIMING_CONSTANTS = {
  DESIGNATION: 'HCCGN.UCLK.DUAL.ADAPTIVE',
  VERSION: '1.0.0',
  OPERATOR_VERSION: 'hccgn-arx-invert-v1.0',
  SCHEMA_VERSION: 'uclk.event.v1',
  BASE_INTERVAL_T_NS: 100_000,
  SOLVER_INTERVAL_S_NS: 500_000,
  BASE_INTERVALS_PER_SOLVER: 5,
  EPOCH_DURATION_E_NS: 1_000_000_000,
  NOMINAL_BASE_INTERVALS_PER_EPOCH: 10_000,
  NOMINAL_SOLVER_WINDOWS_PER_EPOCH: 2_000,
  EPOCH_CONTINUATION_POLICY: 'FRESH_MONOTONIC_ORIGIN_PER_EPOCH',
} as const;

export type ClockDomain =
  | 'DOMAIN_A_MONOTONIC'
  | 'DOMAIN_B_EXTERNAL_UTC'
  | 'DOMAIN_C_DEVICE_HW';

export type ClockStateMachineStatus =
  | 'INITIALIZING'
  | 'CLOCK_UNSYNCED'
  | 'CLOCK_READY'
  | 'RUNNING'
  | 'DEGRADED'
  | 'DEADLINE_MISSED'
  | 'SOLVER_PENDING'
  | 'SOLVER_LATE'
  | 'EPOCH_CLOSING'
  | 'EPOCH_COMPLETE'
  | 'FAULTED';

export interface StateTransitionRecord {
  readonly id: string;
  readonly from: ClockStateMachineStatus;
  readonly to: ClockStateMachineStatus;
  readonly reason: string;
  readonly monotonicNs: string;
  readonly utcIso: string;
}

export interface ClockSyncSource {
  readonly sourceId: string;
  readonly protocol: 'SYSTEM_WALL_CORRELATION' | 'NTP' | 'PTP' | 'GNSS';
  readonly lastSyncUtc: string;
  readonly estimatedOffsetNs: string;
  readonly uncertaintyNs: number;
  readonly driftPpm: number;
  readonly validity: 'VALID' | 'DEGRADED' | 'UNSYNCED';
}

export interface ClockCorrelationModel {
  readonly monotonicSource: string;
  readonly hardwareTimestampSupported: boolean;
  readonly aRate: number;
  readonly bOffsetNs: string;
  readonly uncertaintyNs: number;
  readonly syncSource: ClockSyncSource;
}

export interface AdaptiveControllerConfig {
  readonly targetUtilizationU: number; // e.g., 0.72
  readonly safetyMarginNsG: number;    // e.g., 15_000 ns
  readonly alpha: number;              // EWMA alpha (0..1)
  readonly minBatchOps: number;
  readonly maxBatchOps: number;
  readonly maxExecutionBudgetNs: number;
  readonly maxRateOfChangePct: number; // e.g., 0.25 (25% step limit)
  readonly minObservationSamples: number;
  readonly queueCapacityLimit: number;
}

export interface AdaptiveAdmissionDecision {
  readonly intervalIndex: number;
  readonly availableBudgetNs: number;
  readonly targetBudgetNs: number;
  readonly admittedOps: number;
  readonly ewmaRateOpsPerNs: number;
  readonly queueDepth: number;
  readonly backpressureActive: boolean;
  readonly reason: string;
}

export type ExecutionLaneId = 1 | 2 | 3 | 4;
export type ExecutionLaneRole = 'AUTOMATION' | 'SHADOW';
export type ExecutionLaneDirection = 'FORWARD' | 'REVERSE';

export interface FourLaneExecutionSnapshot {
  readonly laneId: ExecutionLaneId;
  readonly role: ExecutionLaneRole;
  readonly direction: ExecutionLaneDirection;
  readonly sequenceNumber: number;
  readonly executionCursor: string;
  readonly sourceTicketId: string;
  readonly opposingTicketId: string;
  readonly operationsCompleted: number;
  readonly bytesCompleted: number;
  readonly residualError: number;
  readonly lastExecutionDurationNs: number;
  readonly laneStateDigest: string;
}

export interface SolverWindowReceipt {
  readonly solverWindowIndex: number;
  readonly epochId: string;
  readonly scheduledBoundaryNs: string;
  readonly actualStartNs: string;
  readonly actualCompletionNs: string;
  readonly solverDurationNs: number;
  readonly solverLatenessNs: number;
  readonly isLate: boolean;
  readonly snapshotCompleteness: 'COMPLETE' | 'PARTIAL' | 'LATE';
  readonly pairAClosureResidual: number;
  readonly pairBClosureResidual: number;
  readonly sequenceContinuityOk: boolean;
  readonly converged: boolean;
  readonly laneSnapshots: readonly FourLaneExecutionSnapshot[];
  readonly solverReceiptDigest: string;
}

export type DeadlineStatus = 'ON_TIME' | 'MISSED' | 'LATE_COMPLETION';
export type VerificationStatus = 'VERIFIED' | 'FAILED' | 'UNVERIFIED' | 'TAMPERED';

export interface TemporalEventReceipt {
  readonly event_id: string;
  readonly schema_version: string;
  readonly epoch_id: string;
  readonly sequence_number: number;
  readonly parent_event_id: string | null;
  readonly parent_receipt_digest: string | null;
  readonly lane_id: ExecutionLaneId;
  readonly scheduled_deadline_ns: string;
  readonly actual_dispatch_ns: string;
  readonly actual_completion_ns: string;
  readonly clock_domain: ClockDomain;
  readonly clock_source: string;
  readonly clock_uncertainty_ns: number;
  readonly jitter_ns: number;
  readonly execution_duration_ns: number;
  readonly admitted_operations: number;
  readonly completed_operations: number;
  readonly completed_bytes: number;
  readonly verification_status: VerificationStatus;
  readonly deadline_status: DeadlineStatus;
  readonly operator_version: string;
  readonly source_ticket_id: string;
  readonly receipt_digest: string;
}

export interface EpochSummaryRecord {
  readonly epochId: string;
  readonly epochPolicy: typeof HCCGN_TIMING_CONSTANTS.EPOCH_CONTINUATION_POLICY;
  readonly originMonotonicNs: string;
  readonly deadlineMonotonicNs: string;
  readonly closedMonotonicNs: string | null;
  readonly measuredElapsedSec: number;
  readonly baseIntervalsScheduled: number;
  readonly missedIntervals: number;
  readonly lateSolvers: number;
  readonly admittedOperations: number;
  readonly completedOperations: number;
  readonly completedBytes: number;
  readonly opsPerSec: number;
  readonly bytesPerSec: number;
  readonly deduplicatedOpsPerSec: number;
  readonly verificationRate: number;
  readonly incompleteWorkOps: number;
  readonly epochState: 'ACTIVE' | 'CLOSING' | 'COMPLETE' | 'PARTIAL';
  readonly epochReceiptDigest: string | null;
}

export interface FaultInjectionConfig {
  readonly delaySpikeNs: number;
  readonly forceSolverOverrunNs: number;
  readonly degradeClockSync: boolean;
  readonly simulatedQueueDepth: number;
  readonly injectInverseCorruption: boolean;
}

export interface LaneBenchmarkStats {
  readonly laneId: ExecutionLaneId;
  readonly role: ExecutionLaneRole;
  readonly direction: ExecutionLaneDirection;
  readonly completedOps: number;
  readonly completedBytes: number;
  readonly opsPerSec: number;
  readonly verificationRate: number;
}

export interface BenchmarkSamplePoint {
  readonly intervalIndex: number;
  readonly jitterNs: number;
  readonly batchDurationNs: number;
  readonly admittedOps: number;
  readonly completedOps: number;
  readonly missed: boolean;
}

export interface BenchmarkReport {
  readonly benchmarkId: string;
  readonly executedAtUtc: string;
  readonly clockSource: string;
  readonly epochPolicy: typeof HCCGN_TIMING_CONSTANTS.EPOCH_CONTINUATION_POLICY;
  readonly durationSec: number;
  readonly baseIntervalsMeasured: number;
  readonly missedIntervals: number;
  readonly lateSolverWindows: number;
  readonly p50LatencyNs: number;
  readonly p95LatencyNs: number;
  readonly p99LatencyNs: number;
  readonly meanJitterNs: number;
  readonly maxJitterNs: number;
  readonly meanBatchDurationNs: number;
  readonly meanSolverDurationNs: number;
  readonly aggregateOpsPerSec: number;
  readonly deduplicatedOpsPerSec: number;
  readonly bytesPerSec: number;
  readonly verificationRate: number;
  readonly perLaneStats: readonly LaneBenchmarkStats[];
  readonly samples: readonly BenchmarkSamplePoint[];
}

export type TimePrecisionClassification = 'MEASURED' | 'ESTIMATED' | 'INTERPOLATED';

export interface LgvSpatialTemporalEvent {
  readonly eventId: string;
  readonly spatialId: string;
  readonly nodeLabel: string;
  readonly crs: 'EPSG:4326';
  readonly lon: number;
  readonly lat: number;
  readonly altitudeMeters: number;
  readonly monotonicNs: string;
  readonly correlatedUtcIso: string;
  readonly clockUncertaintyNs: number;
  readonly sourceIdentity: string;
  readonly provenance: string;
  readonly verificationStatus: VerificationStatus;
  readonly timeClassification: TimePrecisionClassification;
}

export interface AcceptanceTestResult {
  readonly id: string;
  readonly category:
    | 'Clock Correctness'
    | 'Timing Correctness'
    | 'Adaptive Controller'
    | 'Solver Correctness'
    | 'Receipt Correctness'
    | 'Cross-Device Correctness';
  readonly criterion: string;
  readonly passed: boolean;
  readonly measuredEvidence: string;
  readonly executedAtUtc: string;
}

export interface SchedulerAnchorRecord {
  readonly epochId: string;
  readonly epochOriginNs: string;
  readonly epochDeadlineNs: string;
  readonly currentSlotIndex: number;
  readonly nextDeadlineNs: string;
  readonly lastScheduledDeadlineNs: string;
  readonly lastActualDispatchNs: string;
  readonly lastLatenessNs: number;
  readonly missedTicksThisInterval: number;
  readonly cumulativeMissedTicks: number;
  readonly catchUpPolicy: 'ADVANCE_WITHOUT_BURST';
  readonly solverBoundaryDue: boolean;
  readonly clockSource: string;
}

export type InteropSubsystemId =
  | 'SCHEDULER'
  | 'FOUR_LANE_SOLVER'
  | 'ARBITRAGE_PIPELINE'
  | 'CRYPTO_RECEIPT'
  | 'LGV_BRIDGE'
  | 'CRYPTIC_MINING'
  | 'CEC_GATEWAY';

export interface AdaptiveRecommendation {
  readonly id: string;
  readonly subsystem: InteropSubsystemId;
  readonly action: string;
  readonly reason: string;
  readonly severity: 'INFO' | 'WARNING' | 'CRITICAL';
  readonly targetUtilScale: number;
  readonly recommendedBatchOps: number;
  readonly applied: boolean;
}

export interface SequentialTriggerStage {
  readonly sequenceOrder: number;
  readonly triggerId: string;
  readonly name: string;
  readonly targetSubsystem: string;
  readonly dependsOnTriggerId: string | null;
  readonly status: 'PENDING' | 'EXECUTING' | 'APPLIED' | 'SKIPPED_DEPENDENCY_FAILED' | 'FAILED';
  readonly startedNs: string;
  readonly completedNs: string;
  readonly durationNs: number;
  readonly inputSummary: string;
  readonly outputSummary: string;
}

export interface SequentialTriggerPipelineRun {
  readonly runId: string;
  readonly intervalIndex: number;
  readonly epochId: string;
  readonly executedAtUtc: string;
  readonly allSucceeded: boolean;
  readonly totalDurationNs: number;
  readonly stages: readonly SequentialTriggerStage[];
}

export interface UniversalClockSnapshot {
  readonly state: ClockStateMachineStatus;
  readonly isRunning: boolean;
  readonly currentMonotonicNs: string;
  readonly currentUtcIso: string;
  readonly correlation: ClockCorrelationModel;
  readonly config: AdaptiveControllerConfig;
  readonly faults: FaultInjectionConfig;
  readonly schedulerAnchor: SchedulerAnchorRecord;
  readonly adaptiveRecommendations: readonly AdaptiveRecommendation[];
  readonly latestTriggerRun: SequentialTriggerPipelineRun | null;
  readonly recentTriggerRuns: readonly SequentialTriggerPipelineRun[];
  readonly activeEpoch: EpochSummaryRecord;
  readonly recentEpochs: readonly EpochSummaryRecord[];
  readonly latestDecision: AdaptiveAdmissionDecision | null;
  readonly latestLanes: readonly FourLaneExecutionSnapshot[];
  readonly latestSolvers: readonly SolverWindowReceipt[];
  readonly recentReceipts: readonly TemporalEventReceipt[];
  readonly recentTransitions: readonly StateTransitionRecord[];
  readonly lgvEvents: readonly LgvSpatialTemporalEvent[];
  readonly latestBenchmark: BenchmarkReport | null;
  readonly telemetrySummary: {
    readonly p50JitterNs: number;
    readonly p95JitterNs: number;
    readonly p99JitterNs: number;
    readonly meanJitterNs: number;
    readonly ewmaThroughputOpsPerSec: number;
    readonly verificationRate: number;
  };
}
