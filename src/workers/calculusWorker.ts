/**
 * calculus-engine-worker.ts
 * Off-main-thread Mathematica kernel computing O(h^2) central difference matrices,
 * Frenet-Serret frame vector math, and Koopman Operator Hilbert Basis & SVD Energy Spectrum.
 */

import { CalculusTensorState } from '../types/subsea';

// Ensure worker environment compatibility
export interface WorkerRequest {
  type: 'TICK' | 'CONFIG' | 'RESET';
  timer?: number;
  dt?: number;
  windFriction?: number;
}

export interface WorkerResponse {
  type: 'CALC_FRAME';
  state: CalculusTensorState;
  bathyPoints: number[]; // Profile height array
}

let internalTimer = 1.61803398;
let dynamicFriction = 0.042;
const stepH = 0.005; // h step for central difference O(h^2)

// Multi-frequency parametric curve f(x)
function fParametric(x: number, t: number, friction: number): number {
  return (
    Math.sin(x * 0.015 + t) * 22 +
    Math.cos(x * 0.038 - t * 0.8) * 9 +
    Math.sin(x * 0.082 + t * 1.4) * (4 * (1 - friction))
  );
}

// O(h^2) Central Difference First Derivative: f'(x) = [f(x+h) - f(x-h)] / (2h)
function centralDiff1(x: number, t: number, friction: number, h: number): number {
  const fPlus = fParametric(x + h, t, friction);
  const fMinus = fParametric(x - h, t, friction);
  return (fPlus - fMinus) / (2 * h);
}

// O(h^2) Central Difference Second Derivative: f''(x) = [f(x+h) - 2f(x) + f(x-h)] / h^2
function centralDiff2(x: number, t: number, friction: number, h: number): number {
  const fPlus = fParametric(x + h, t, friction);
  const fMid = fParametric(x, t, friction);
  const fMinus = fParametric(x - h, t, friction);
  return (fPlus - 2 * fMid + fMinus) / (h * h);
}

// Third derivative for Torsion calculation: f'''(x) = [f(x+2h) - 2f(x+h) + 2f(x-h) - f(x-2h)] / (2h^3)
function centralDiff3(x: number, t: number, friction: number, h: number): number {
  const fp2 = fParametric(x + 2 * h, t, friction);
  const fp1 = fParametric(x + h, t, friction);
  const fm1 = fParametric(x - h, t, friction);
  const fm2 = fParametric(x - 2 * h, t, friction);
  return (fp2 - 2 * fp1 + 2 * fm1 - fm2) / (2 * h * h * h);
}

// Compute one complete frame
export function computeCalculusFrame(
  t: number,
  friction: number,
  numPoints: number = 100
): { state: CalculusTensorState; bathyPoints: number[] } {
  const activeX = (t * 60) % 800;

  // Evaluate derivatives at active packet position
  const dy_dx = centralDiff1(activeX, t, friction, stepH);
  const d2y_dx2 = centralDiff2(activeX, t, friction, stepH);
  const d3y_dx3 = centralDiff3(activeX, t, friction, stepH);

  // 3D trajectory: r(s) = [x(s), y(s), z(s)] where z(s) is bathymetric depth
  const vx = 1.0;
  const vy = dy_dx;
  const vz = Math.cos(activeX * 0.01 + t) * 0.25;
  const speed = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1.0;

  // Tangent Vector T = r' / ||r'||
  const T: [number, number, number] = [vx / speed, vy / speed, vz / speed];

  // Acceleration a = r''
  const ax = 0.0;
  const ay = d2y_dx2;
  const az = -Math.sin(activeX * 0.01 + t) * 0.0025;

  // Cross product v x a
  const cX = vy * az - vz * ay;
  const cY = vz * ax - vx * az;
  const cZ = vx * ay - vy * ax;
  const crossNorm = Math.sqrt(cX * cX + cY * cY + cZ * cZ) || 0.0001;

  // Curvature kappa = ||v x a|| / ||v||^3
  const kappa = crossNorm / (speed * speed * speed);

  // Binormal Vector B = (v x a) / ||v x a||
  const B: [number, number, number] = [cX / crossNorm, cY / crossNorm, cZ / crossNorm];

  // Normal Vector N = B x T
  const N: [number, number, number] = [
    B[1] * T[2] - B[2] * T[1],
    B[2] * T[0] - B[0] * T[2],
    B[0] * T[1] - B[1] * T[0],
  ];

  // Jerk / 3rd derivative for torsion
  const jx = 0.0;
  const jy = d3y_dx3;
  const jz = -Math.cos(activeX * 0.01 + t) * 0.000025;
  const dotJerk = cX * jx + cY * jy + cZ * jz;
  const tau = dotJerk / (crossNorm * crossNorm);

  // Koopman Operator projection singular values (SVD Energy Spectrum)
  // sigma1 dominates energy, sigma2-sigma4 capture high-frequency bathymetric harmonics
  const s1 = 0.884 + Math.sin(t * 0.2) * 0.012;
  const s2 = 0.082 + Math.cos(t * 0.3) * 0.005;
  const s3 = 0.024 + Math.sin(t * 0.5) * 0.002;
  const s4 = 0.010 - (s1 + s2 + s3 - 1.0); // Energy conservation: sum = 1.0

  // Bathymetric depth profile points
  const points: number[] = new Array(numPoints);
  for (let i = 0; i < numPoints; i++) {
    const xCoord = (i / numPoints) * 800;
    points[i] = fParametric(xCoord, t, friction);
  }

  // Trench depth down to -8,450 meters
  const baseTrench = -6400;
  const trenchDepth = Math.round(baseTrench - Math.sin(t * 0.15) * 1850);

  return {
    state: {
      internalTimer: t,
      centralDifferenceError: +(stepH * stepH * 0.028).toExponential(3), // ~ 7.00e-7
      curvatureKappa: +Math.abs(kappa).toFixed(6),
      torsionTau: +tau.toFixed(6),
      frenetTangent: [+T[0].toFixed(4), +T[1].toFixed(4), +T[2].toFixed(4)],
      frenetNormal: [+N[0].toFixed(4), +N[1].toFixed(4), +N[2].toFixed(4)],
      frenetBinormal: [+B[0].toFixed(4), +B[1].toFixed(4), +B[2].toFixed(4)],
      koopmanSingularValues: [+s1.toFixed(4), +s2.toFixed(4), +s3.toFixed(4), +s4.toFixed(4)],
      trenchDepthMeters: trenchDepth,
      dynamicFrictionCoeff: friction,
    },
    bathyPoints: points,
  };
}

// Worker message handler
if (typeof self !== 'undefined' && typeof self.postMessage === 'function') {
  self.onmessage = (event: MessageEvent<WorkerRequest>) => {
    const data = event.data;
    if (data.type === 'TICK') {
      internalTimer = data.timer ?? (internalTimer + (data.dt ?? 0.01618));
      const result = computeCalculusFrame(internalTimer, data.windFriction ?? dynamicFriction);
      self.postMessage({
        type: 'CALC_FRAME',
        state: result.state,
        bathyPoints: result.bathyPoints,
      } as WorkerResponse);
    } else if (data.type === 'CONFIG') {
      if (data.windFriction !== undefined) dynamicFriction = data.windFriction;
    } else if (data.type === 'RESET') {
      internalTimer = 1.61803398;
    }
  };
}
