/**
 * =============================================================================
 * SPECIFICATION: AE.SL6.DUALTRACE.4P
 * MODULE: Four-Lane Execution Ticket Lifecycle & Paired Inverse Verification
 * =============================================================================
 * 
 * Governing Axioms:
 * 1. "Every automation lane has an opposing shadow."
 * 2. "Every shadow retains its source ticket."
 * 3. "Every inverse is continuously verified."
 * 4. "Original inputs and tickets are immutable."
 * 5. "Midpoint (t = 0.5) is the primary checkpoint for paired divergence."
 */

export type Polarity = 1 | -1;
export type LaneId = 1 | 2 | 3 | 4;
export type SequenceOrder = "1234" | "4321";
export type LaneRole = "automation" | "shadow";
export type PairId = "A" | "B";

export interface ExecutionTicket {
  readonly ticketId?: string;
  readonly originalSequenceId: string;
  readonly initialOrderIndex: number;
  readonly directionFactor: Polarity;
  readonly hashChecksum: string;
  readonly timestamp?: string; // UTC ISO-8601
  readonly status?: 'PENDING' | 'DISPATCHED' | 'VERIFIED' | 'COMPLETED' | 'FAULT';
}

export interface PairedLaneState {
  readonly laneId: LaneId;
  readonly sequenceOrder: SequenceOrder;
  readonly role: LaneRole;
  readonly activeOperand: number;
  readonly parityAttribute: "LU" | "RD";
  readonly coordinateValue: number;
  readonly fractionalTimingIncrement: number; // {t} within [0.0, 1.0)
  readonly wholeCycleIteration: number;       // (n) integer cycle count
  readonly mirroredTicket: ExecutionTicket;
  readonly executionHash: string;
}

export interface PairVerification {
  readonly pairId: PairId;
  readonly primaryLaneId: LaneId;
  readonly shadowLaneId: LaneId;
  readonly isSymmetric: boolean;
  readonly midpointDivergence: number; // Delta at t = 0.5
  readonly verifiedChecksumMatch: boolean;
  readonly fractionalCheckPassed: boolean;
  readonly wholeCycleMatched: boolean;
  readonly verifiedAt: string; // UTC ISO-8601
  readonly verificationSignature: string;
}

export interface CheckpointRecord {
  readonly checkpointId: string;
  readonly cycleStep: number;
  readonly timestamp: string;
  readonly pairAVerification: PairVerification;
  readonly pairBVerification: PairVerification;
  readonly overallIntegrity: 'PASS' | 'DEGRADED' | 'HALT';
  readonly reversibleStateSnapshotHash: string;
}

export interface ReversibleState<T = unknown> {
  readonly stateId: string;
  readonly sequenceStep: number;
  readonly forwardState: T;
  readonly backwardInverseState: T;
  readonly isReversible: boolean;
  readonly entropyDelta: number;
  rollback(): T;
  advance(input: unknown): ReversibleState<T>;
}

export interface AdaptiveControllerMetrics {
  readonly sampleWindowMs: number;
  readonly driftMs: number;
  readonly dampingCoefficient: number;
  readonly targetSubMillisecondSync: boolean;
  readonly feedbackAdjustmentOhm: number;
}

export interface AdaptiveController {
  readonly controllerId: string;
  evaluateDrift(actualDeltaMs: number, targetDeltaMs: number): AdaptiveControllerMetrics;
  applyFeedbackCoupling(currentCharge: number, driftMetrics: AdaptiveControllerMetrics): number;
  reset(): void;
}
