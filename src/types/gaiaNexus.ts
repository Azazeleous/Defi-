/**
 * gaiaNexus.ts
 * Types for AE.SL6.INVPAIR: Æ Strange Loop · Inverse-Paired Six-Plane Operator
 * Inside GAIA EYES Computational Substrate
 */

export type StageDimension = '1D' | '2D' | '3D' | '4D' | '5D' | '6D';

export type EvolutionDirection = 'FORWARD_POS' | 'INVERSE_NEG' | 'ORIGIN_BOUNDARY';

export interface SymplecticMatrix {
  dimension: 2 | 4 | 6;
  data: number[][];
  inverseData: number[][]; // J_{2m}^{-1} = -J_{2m}
}

export interface MetricTensorPair {
  dimension: number;
  K: number[][]; // K_n > 0 (Positive definite)
  P: number[][]; // P_n = K_n^{-1} (Positive metric inverse)
  conditionNumber: number;
  lambdaRegularizer: number;
}

export interface HamiltonianState {
  z: [number, number, number, number, number, number]; // 6D state: (x1, y1, x2, y2, x3, y3)
  energyH: number; // H(z) = 0.5 * z^T G z
  energyDelta: number; // dH/dt ~ 0
  dz_dt: [number, number, number, number, number, number]; // dot(z) = J_6 grad H
}

export interface BezierControlPoints {
  P0: [number, number, number];
  P1: [number, number, number];
  P2: [number, number, number];
  P3: [number, number, number];
}

export interface TriClockState {
  sampleClockMs01: number; // 0.1 ms target computational sampling clock
  frameClockHz: number; // 1 frame presentation event (~60 Hz / 16.6ms)
  wallClockSec: number; // 1 second wall-clock heartbeat
  epochSec: string;
}

export interface GaiaVaultEntry {
  cycleIndex: number;
  timestamp: number;
  sequenceId: string;
  beucRootId: string;
  fnvFingerprint: string;
  eulerCharacteristic: number; // chi = 2
  forwardConverged: boolean;
  reverseConverged: boolean;
  originResidual: number; // || z(+) - z(-) || at origin
  commitSignature: string;
  status: 'COMMITTED' | 'VERIFIED' | 'LOCKED';
}

export interface OperatorTelemetry {
  operatorId: string; // 'AE.SL6.INVPAIR'
  version: string; // '0.1.0'
  rootMarker: string; // 'BEUC'
  originState: '0.0 · 0.0';
  direction: EvolutionDirection;
  activeDimension: StageDimension;
  parityDualState: number; // computed pi coordinate
  hamiltonian: HamiltonianState;
  metric: MetricTensorPair;
  symplectic: SymplecticMatrix;
  bezier: BezierControlPoints;
  angularTheta: number; // theta in [0, 2pi)
  quantizedHue: number; // 0 - 360 (1% increments)
  eulerCharacteristic: number; // chi = 2
  stageSequence: number;
  bootStepName: string;
  isHalted: boolean;
  clocks: TriClockState;
}
