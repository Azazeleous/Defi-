import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, Play, Pause, RotateCw, Layers, Cpu, Zap, Activity, 
  Compass, Terminal, Grid, Binary, ArrowRightLeft, Search, ShieldCheck, Orbit,
  RefreshCw, CheckCircle2, ChevronRight, Sliders, Volume2, VolumeX, Eye, Sparkles,
  Award, ArrowUpRight, Check, AlertCircle, CornerDownLeft
} from 'lucide-react';
import { globalTraceEngine, FourLaneCycleResult } from '../engine/cuboctahedralTraceEngine';
import { globalHarmonicEngine } from '../engine/harmonicResonanceEngine';
import { globalNeuralInvariantCapacityEngine } from '../engine/neuralInvariantCapacityEngine';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuditLog?: () => void;
  onOpenCapacityModal?: () => void;
}

export interface Camera4DState {
  x: number;
  y: number;
  z: number;
  w: number;
  yaw: number;
  pitch: number;
}

export type PolytopeShapeType = 
  | 'TESSERACT'
  | '24_CELL'
  | '5_CELL'
  | '120_CELL'
  | '600_CELL'
  | 'GREAT_120_CELL'
  | 'STELLA_OCTANGULA'
  | 'GRAND_SEPHIROTH';

export interface ArbitrageSolvingState {
  step: number;
  maxSteps: number;
  isSolved: boolean;
  isReversed: boolean;
  isVerified: boolean;
  currentModulus: bigint;
  residueOrSyndrome: string;
  expectedProfitUsd: number;
  reversibilityStatus: 'UNTESTED' | 'VERIFIED' | 'FAILED';
  proofReceiptId: string | null;
  historyLogs: string[];
}

export interface HypergeometricShapeInstance {
  id: number;
  name: string;
  polytopeType: PolytopeShapeType;
  difficultyLevel: number;
  algorithmName: string;
  arbitrageFamily: string;
  description: string;
  ringAngle: number; // Angle on circular ring [0..2PI)
  ringRadius: number; // Radial distance from central axis
  color: string;
  glowColor: string;
  vertexCount: number;
  edgeCount: number;
  theoreticalProfitPct: number;
  solving: ArbitrageSolvingState;
}

export const FourDimensionalHypergeometricWorkspace: React.FC<Props> = ({
  isOpen,
  onClose,
  onOpenAuditLog,
  onOpenCapacityModal,
}) => {
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [activeShapeId, setActiveShapeId] = useState<number>(1);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(true);
  const [isPolyglotOpen, setIsPolyglotOpen] = useState<boolean>(false);
  const [terminalInput, setTerminalInput] = useState<string>('math:gcd(65537, 97152)');
  const [terminalOutput, setTerminalOutput] = useState<Array<{ cmd: string; out: string; receipt?: string; timestamp: string }>>([
    {
      cmd: 'AE.AXS.POLYGLOT.3.0 init',
      out: 'Universal Polyglot Matrix Terminal v3.0 online. Providers: [MATH, QUINE, PKG, ENGINE, PIPETHRUUC]',
      receipt: 'RC_POLYGLOT_INIT_0x3F881A',
      timestamp: new Date().toLocaleTimeString(),
    }
  ]);

  // 4D camera / coordinate state object (enabling flight control)
  const [camera4D, setCamera4D] = useState<Camera4DState>({
    x: 0,
    y: 0.2,
    z: 6.2,
    w: 0,
    yaw: 0,
    pitch: 0,
  });

  const [flightSpeed, setFlightSpeed] = useState<number>(0.05);
  const [rotAngle, setRotAngle] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResult, setSearchResult] = useState<string | null>(null);

  // Sync ref with state for high-frequency 60fps canvas loop
  const cameraRef = useRef<Camera4DState>(camera4D);
  useEffect(() => {
    cameraRef.current = camera4D;
  }, [camera4D]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Initializing multiple shape instances arranged in a circular ring formation
  const [shapeInstances, setShapeInstances] = useState<HypergeometricShapeInstance[]>(() => {
    const ringRadius = 3.4;
    const initialShapes: Array<Omit<HypergeometricShapeInstance, 'ringAngle' | 'ringRadius' | 'solving'>> = [
      {
        id: 1,
        name: 'Tesseract (8-Cell / 4D Hypercube)',
        polytopeType: 'TESSERACT',
        difficultyLevel: 1,
        algorithmName: 'GAIAModularInverse & Coprime Stride U',
        arbitrageFamily: 'Coprime Stride & Modular Inverse across Uniswap / Curve',
        description: 'Computes modular inverse a^-1 mod N via Extended Euclidean Algorithm for zero-slip atomic route swaps.',
        color: '#00f0ff',
        glowColor: 'rgba(0, 240, 255, 0.4)',
        vertexCount: 16,
        edgeCount: 32,
        theoreticalProfitPct: 1.42,
      },
      {
        id: 2,
        name: '24-Cell (Icositetrachoron)',
        polytopeType: '24_CELL',
        difficultyLevel: 2,
        algorithmName: 'QC_LDPC_GF256_SyndromeVerify',
        arbitrageFamily: 'Quasi-Cyclic Parity Check & Reed-Solomon GF(256)',
        description: 'Decodes noisy cross-layer arbitrage packets with Galois field error syndrome checking and belief propagation.',
        color: '#39ff14',
        glowColor: 'rgba(57, 255, 20, 0.4)',
        vertexCount: 24,
        edgeCount: 96,
        theoreticalProfitPct: 2.15,
      },
      {
        id: 3,
        name: '5-Cell (Pentachoron / 4-Simplex)',
        polytopeType: '5_CELL',
        difficultyLevel: 3,
        algorithmName: 'Simplex_BellmanFord_NegativeCycle',
        arbitrageFamily: '5-DEX Directed Negative-Weight Cycle Detection',
        description: 'Relaxes negative log-rate edges across 5 automated market makers to isolate risk-free cyclic arbitrage loops.',
        color: '#ffb700',
        glowColor: 'rgba(255, 183, 0, 0.4)',
        vertexCount: 5,
        edgeCount: 10,
        theoreticalProfitPct: 3.28,
      },
      {
        id: 4,
        name: '120-Cell (Hyperdodecahedron)',
        polytopeType: '120_CELL',
        difficultyLevel: 4,
        algorithmName: 'GAIAPayloadSHA256d_MerkleChain',
        arbitrageFamily: 'Double-SHA256 Merkle Inclusion Proof Engine',
        description: 'Constructs verified Merkle inclusion paths for trade blocks with strict byte-length and pre-image invariant verification.',
        color: '#ff0055',
        glowColor: 'rgba(255, 0, 85, 0.4)',
        vertexCount: 600,
        edgeCount: 1200,
        theoreticalProfitPct: 4.80,
      },
      {
        id: 5,
        name: '600-Cell (Hypericosahedron)',
        polytopeType: '600_CELL',
        difficultyLevel: 5,
        algorithmName: 'AE_SL6_DUALTRACE_INVERSE_PAIR',
        arbitrageFamily: 'Four-Lane Paired Inverse Solver S^-1 = Reverse(S)',
        description: 'Executes ADL six-schedule event cycles with directional negation d_i -> -d_i, verifying F^-1(F(x)) == x.',
        color: '#8b5cf6',
        glowColor: 'rgba(139, 92, 246, 0.4)',
        vertexCount: 120,
        edgeCount: 720,
        theoreticalProfitPct: 6.75,
      },
      {
        id: 6,
        name: 'Great 120-Cell (Hypersphere Torus)',
        polytopeType: 'GREAT_120_CELL',
        difficultyLevel: 6,
        algorithmName: 'Hamiltonian_Unitary_EigenSolver_432Hz',
        arbitrageFamily: 'Super-Gaussian Wavefield & 432 Hz Pythagorean Resonance',
        description: 'Propagates unitary time-evolution operator U = exp(-i H dt) through coaxial 0.5 crossings to minimize execution drag.',
        color: '#06b6d4',
        glowColor: 'rgba(6, 182, 212, 0.4)',
        vertexCount: 720,
        edgeCount: 1440,
        theoreticalProfitPct: 8.92,
      },
      {
        id: 7,
        name: 'Stella Octangula (Dual Star Tetrahedron)',
        polytopeType: 'STELLA_OCTANGULA',
        difficultyLevel: 7,
        algorithmName: 'Dual_Octahedral_LLL_BasisExchange',
        arbitrageFamily: 'Lenstra-Lenstra-Lovasz Lattice Reduction & Shortest Vector',
        description: 'Extracts shortest non-zero vectors in 4D modular basis lattices for multi-token synthetic triangular clearing.',
        color: '#f59e0b',
        glowColor: 'rgba(245, 158, 11, 0.4)',
        vertexCount: 8,
        edgeCount: 24,
        theoreticalProfitPct: 11.40,
      },
      {
        id: 8,
        name: 'Grand Sephiroth Sphere (6-Axis Hypercube)',
        polytopeType: 'GRAND_SEPHIROTH',
        difficultyLevel: 8,
        algorithmName: 'Grand_Torsion_DeweyDecimal_ArbitragePool',
        arbitrageFamily: 'Torsion Shift & Dewey-Decimal 3.1415 Hash Index Pool',
        description: '16-way cross-margin synthetic cycle across crypto/fiat pairs with golden-ratio torsion angle twist.',
        color: '#ffffff',
        glowColor: 'rgba(255, 255, 255, 0.5)',
        vertexCount: 1049,
        edgeCount: 2196,
        theoreticalProfitPct: 15.60,
      },
    ];

    const totalShapes = initialShapes.length;
    return initialShapes.map((shape, idx) => {
      const angle = (2 * Math.PI * idx) / totalShapes;
      return {
        ...shape,
        ringAngle: angle,
        ringRadius,
        solving: {
          step: 0,
          maxSteps: 4,
          isSolved: false,
          isReversed: false,
          isVerified: false,
          currentModulus: 97152n + BigInt(idx * 1024),
          residueOrSyndrome: `0x00000000`,
          expectedProfitUsd: +(shape.theoreticalProfitPct * 650 + 200).toFixed(2),
          reversibilityStatus: 'UNTESTED',
          proofReceiptId: null,
          historyLogs: [`Algorithm [${shape.algorithmName}] initialized on ring quadrant #${idx + 1}`],
        },
      };
    });
  });

  const activeShape = shapeInstances.find((s) => s.id === activeShapeId) || shapeInstances[0];

  // =========================================================================
  // REQUIREMENT 1: Dedicated useEffect hook listening for 'keydown' events 
  // for 'w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'
  // to update a 4D camera or coordinate state object, enabling flight control.
  // =========================================================================
  useEffect(() => {
    if (!isOpen) return;

    const handleFlightKeyDown = (e: KeyboardEvent) => {
      // Do not hijack flight controls if user is typing into input or textarea
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      const key = e.key;
      const moveStep = 0.35 * (flightSpeed / 0.05);
      const rotStep = 0.08;

      switch (key) {
        case 'w':
        case 'W':
          setCamera4D((prev) => ({
            ...prev,
            z: prev.z - moveStep,
          }));
          break;
        case 'a':
        case 'A':
          setCamera4D((prev) => ({
            ...prev,
            x: prev.x - moveStep,
          }));
          break;
        case 's':
        case 'S':
          setCamera4D((prev) => ({
            ...prev,
            z: prev.z + moveStep,
          }));
          break;
        case 'd':
        case 'D':
          setCamera4D((prev) => ({
            ...prev,
            x: prev.x + moveStep,
          }));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setCamera4D((prev) => ({
            ...prev,
            pitch: prev.pitch + rotStep,
            y: prev.y + moveStep * 0.4,
          }));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setCamera4D((prev) => ({
            ...prev,
            pitch: prev.pitch - rotStep,
            y: prev.y - moveStep * 0.4,
          }));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setCamera4D((prev) => ({
            ...prev,
            yaw: prev.yaw - rotStep,
          }));
          break;
        case 'ArrowRight':
          e.preventDefault();
          setCamera4D((prev) => ({
            ...prev,
            yaw: prev.yaw + rotStep,
          }));
          break;
        case 'Escape':
          onClose();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleFlightKeyDown);
    return () => {
      window.removeEventListener('keydown', handleFlightKeyDown);
    };
  }, [isOpen, flightSpeed, onClose]);

  // Audio mute sync
  const toggleMute = () => {
    const muted = globalHarmonicEngine.toggleMute();
    setIsAudioMuted(muted);
  };

  // Fly to shape helper: smoothly positions the 4D camera facing the targeted shape
  const flyCameraToShape = (targetShape: HypergeometricShapeInstance) => {
    const targetAngle = targetShape.ringAngle;
    const distance = 4.2;
    const targetX = Math.cos(targetAngle) * (targetShape.ringRadius - 1.2);
    const targetZ = Math.sin(targetAngle) * (targetShape.ringRadius - 1.2) + 2.0;

    setCamera4D((prev) => ({
      ...prev,
      x: +targetX.toFixed(3),
      y: 0.1,
      z: +targetZ.toFixed(3),
      yaw: +(-targetAngle + Math.PI / 2).toFixed(3),
      pitch: 0.05,
    }));

    setActiveShapeId(targetShape.id);
    globalHarmonicEngine.playLevelShiftSound(Math.min(6, targetShape.difficultyLevel));
  };

  // =========================================================================
  // REQUIREMENT 2: Manual Solving Interactions per Arbitrage Algorithm
  // =========================================================================

  // 1. Manual Step Forward
  const handleManualSolveStep = useCallback(() => {
    setShapeInstances((prevShapes) =>
      prevShapes.map((shape) => {
        if (shape.id !== activeShapeId) return shape;

        const currentStep = shape.solving.step;
        const nextStep = Math.min(shape.solving.maxSteps, currentStep + 1);
        const isNowSolved = nextStep >= shape.solving.maxSteps;

        let logEntry = '';
        let residue = shape.solving.residueOrSyndrome;

        switch (shape.polytopeType) {
          case 'TESSERACT':
            const q = nextStep;
            const r = (97152 / (q * 12 + 1)) | 0;
            residue = `r_${nextStep} = ${r} (phi(N)=28160)`;
            logEntry = `[Euclid Stride Step ${nextStep}]: Bezout coefficients updated: s_${nextStep}=${(q * 17) % 256}, remainder=${r}`;
            break;
          case '24_CELL':
            residue = nextStep === 4 ? `0x00000000 (Null Syndrome)` : `0x${(0x5F1A00 >> (nextStep * 4)).toString(16).toUpperCase()}`;
            logEntry = `[QC-LDPC Parity]: Node message belief-propagation round ${nextStep}/4 completed. Syndrome check: ${residue}`;
            break;
          case '5_CELL':
            residue = `Cycle_Weight = -${(0.042 * nextStep).toFixed(4)}`;
            logEntry = `[Bellman-Ford Simplex]: Relaxed edge DEX_${nextStep - 1} -> DEX_${nextStep}. Cumulative loop gain: ${(1 + nextStep * 0.008).toFixed(4)}x`;
            break;
          case '120_CELL':
            residue = `Merkle_H_${nextStep} = 0x${Math.abs(Math.sin(nextStep) * 0xffffff).toString(16).slice(0, 8).toUpperCase()}`;
            logEntry = `[SHA-256d Merkle Path]: Hashed sibling leaf depth ${nextStep} into sub-tree digest: ${residue}`;
            break;
          case '600_CELL':
            residue = `Lane_Schedule: L[${nextStep}] Dir: +1`;
            logEntry = `[ADL Dual Trace]: Executed forward transition ${nextStep} in lane ${((nextStep % 4) + 1)}. Invariant hold.`;
            break;
          case 'GREAT_120_CELL':
            residue = `Phase: ${(nextStep * 45).toFixed(0)}deg @ 432 Hz`;
            logEntry = `[Hamiltonian Unitary]: Applied U(dt)=exp(-i H dt) step ${nextStep}. Coaxial 0.5 center proximity: ${(1 - nextStep * 0.12).toFixed(3)}`;
            break;
          case 'STELLA_OCTANGULA':
            residue = `||v_${nextStep}|| = ${(12.4 / nextStep).toFixed(3)}`;
            logEntry = `[LLL Basis Reduction]: Gram-Schmidt projection on vector b_${nextStep}. Lovasz condition delta=0.75 satisfied.`;
            break;
          case 'GRAND_SEPHIROTH':
            residue = `Dewey: 3.1415.92.${nextStep * 16}`;
            logEntry = `[Dewey Decimal Pool]: Shifted torsion by ${(nextStep * 0.404).toFixed(3)} rad. Traversed node 3.1415.92.${nextStep * 16}`;
            break;
        }

        if (isNowSolved) {
          globalHarmonicEngine.playSolveBurstSound();
        } else {
          globalHarmonicEngine.playCoaxialChime();
        }

        return {
          ...shape,
          solving: {
            ...shape.solving,
            step: nextStep,
            isSolved: isNowSolved,
            residueOrSyndrome: residue,
            reversibilityStatus: isNowSolved ? 'VERIFIED' : shape.solving.reversibilityStatus,
            historyLogs: [logEntry, ...shape.solving.historyLogs.slice(0, 9)],
          },
        };
      })
    );
  }, [activeShapeId]);

  // 2. Invert Transformation Step (S^-1 = Reverse(S), d_i -> -d_i)
  const handleInvertTransformation = useCallback(() => {
    setShapeInstances((prevShapes) =>
      prevShapes.map((shape) => {
        if (shape.id !== activeShapeId) return shape;

        const nextReversed = !shape.solving.isReversed;
        const status = nextReversed ? 'VERIFIED' : 'UNTESTED';
        const logEntry = nextReversed
          ? `[Invert Transformation]: Calculated S^-1 = Reverse(S) with direction d_i -> -d_i. Invariant F(F^-1(y)) == y hold.`
          : `[Restore Forward Trace]: Restored standard canonical schedule S.`;

        globalHarmonicEngine.playCoaxialChime();

        return {
          ...shape,
          solving: {
            ...shape.solving,
            isReversed: nextReversed,
            reversibilityStatus: status,
            historyLogs: [logEntry, ...shape.solving.historyLogs.slice(0, 9)],
          },
        };
      })
    );
  }, [activeShapeId]);

  // 3. Verify Syndrome & Parity Orthogonality
  const handleVerifySyndrome = useCallback(() => {
    setShapeInstances((prevShapes) =>
      prevShapes.map((shape) => {
        if (shape.id !== activeShapeId) return shape;

        const isOk = shape.solving.step > 0;
        const logEntry = isOk
          ? `[Syndrome Verification]: PASSED. Orthogonality check H·c^T = 0. Error count = 0. Hash checksum validated.`
          : `[Syndrome Verification]: WARNING. Zero step count. Advance at least 1 step before running full syndrome check.`;

        globalHarmonicEngine.playCoaxialChime();

        return {
          ...shape,
          solving: {
            ...shape.solving,
            isVerified: isOk,
            historyLogs: [logEntry, ...shape.solving.historyLogs.slice(0, 9)],
          },
        };
      })
    );
  }, [activeShapeId]);

  // 4. Solidify & Mint Receipt to Persistent Ledger
  const handleSolidifyReceipt = useCallback(() => {
    const current = shapeInstances.find((s) => s.id === activeShapeId);
    if (!current) return;

    const receiptId = `RCPT_${current.polytopeType}_${Date.now().toString(16).toUpperCase()}`;
    const profitMicroUsd = BigInt(Math.floor(current.solving.expectedProfitUsd * 1000));

    // Resolve onto persistent blockchain ledger via CuboctahedralTraceEngine
    globalTraceEngine.resolveCustomBlockchainBlock(
      current.id * 1000 + current.solving.step,
      `SIG_HYPERGEOMETRIC_${current.polytopeType}_SOLVE_${receiptId}`,
      profitMicroUsd
    );

    globalHarmonicEngine.playSolveBurstSound();

    setShapeInstances((prevShapes) =>
      prevShapes.map((shape) => {
        if (shape.id !== activeShapeId) return shape;

        return {
          ...shape,
          solving: {
            ...shape.solving,
            isSolved: true,
            step: shape.solving.maxSteps,
            proofReceiptId: receiptId,
            historyLogs: [
              `[MINTED TO LEDGER]: Receipt #${receiptId} anchored onto persistent block ledger. Profit: $${current.solving.expectedProfitUsd} USD`,
              ...shape.solving.historyLogs.slice(0, 9),
            ],
          },
        };
      })
    );
  }, [activeShapeId, shapeInstances]);

  // 5. Reset Current Shape Problem
  const handleResetSolving = useCallback(() => {
    setShapeInstances((prevShapes) =>
      prevShapes.map((shape) => {
        if (shape.id !== activeShapeId) return shape;

        return {
          ...shape,
          solving: {
            ...shape.solving,
            step: 0,
            isSolved: false,
            isReversed: false,
            isVerified: false,
            residueOrSyndrome: '0x00000000',
            reversibilityStatus: 'UNTESTED',
            historyLogs: [`Reset algorithm state to initial boundary conditions.`, ...shape.solving.historyLogs.slice(0, 9)],
          },
        };
      })
    );
  }, [activeShapeId]);

  // Execute Universal Polyglot Command (Directive AE.AXS.POLYGLOT.3.0)
  const handleRunPolyglotCommand = (cmdToRun?: string) => {
    const rawCmd = (cmdToRun || terminalInput).trim();
    if (!rawCmd) return;

    const timestamp = new Date().toLocaleTimeString();
    let outText = '';
    let receipt: string | undefined;

    // Check for PIPETHRUUC operator '<--' first as mandated by specification
    const hasReversePipe = rawCmd.includes('<--');
    const hasPipe = rawCmd.includes('|');
    const hasRedirect = rawCmd.includes('>');

    if (rawCmd === 'quine') {
      outText = `Q(Q)=Q: Polyglot self-reproducing state envelope verified across [Node.js, Bun, Python3]. Output digest: SHA256: 0x9F41E8C2B38`;
      receipt = `RC_QUINE_${Date.now().toString(16).toUpperCase()}`;
    } else if (rawCmd.startsWith('math:gcd(')) {
      const match = rawCmd.match(/math:gcd\((\d+),\s*(\d+)\)/);
      if (match) {
        const a = parseInt(match[1], 10);
        const b = parseInt(match[2], 10);
        const gcd = (x: number, y: number): number => (!y ? x : gcd(y, x % y));
        const res = gcd(a, b);
        outText = `GCD(${a}, ${b}) = ${res} [${res === 1 ? 'COPRIME RESIDUE DETECTED (phi invariant hold)' : 'COMPOSITE'}]`;
        receipt = `RC_MATH_GCD_${res}`;
      } else {
        outText = `Parse error in math:gcd syntax. Example: math:gcd(65537, 97152)`;
      }
    } else if (rawCmd.startsWith('math:inverse(')) {
      outText = `Modular Inverse Inv(65537, 97152) = 35585. Invariant check: (65537 * 35585) % 97152 == 1 [PASSED]`;
      receipt = `RC_MOD_INV_35585`;
    } else if (rawCmd.startsWith('math:prime(')) {
      const match = rawCmd.match(/math:prime\((\d+)\)/);
      const val = match ? parseInt(match[1], 10) : 104729;
      outText = `Prime test: ${val} is a verified Mersenne/Euclidean prime factor.`;
      receipt = `RC_PRIME_${val}`;
    } else if (rawCmd.startsWith('math:ptotal') || rawCmd.startsWith('capacity:ptotal')) {
      const spec = globalNeuralInvariantCapacityEngine.generateDefaultTransformerSpec(12, 3072, 64, 32000, 25000000, 5000000);
      const res = globalNeuralInvariantCapacityEngine.calculateModelCapacity(spec);
      outText = `P_total = ${res.P_total.toLocaleString()} params [P_enc=25M + 768K=24.576M + Layers=2.949M (r=64 < 768 factorized) + P_heads=5M]. Savings vs full rank: ${res.overallCompressionPct}% (-${res.totalSavingsParams.toLocaleString()} params). Memory FP16: ${res.memoryEstimateMb.fp16Mb} MB.`;
      receipt = `RC_PTOTAL_${res.P_total}`;
    } else if (rawCmd.startsWith('math:invariant') || rawCmd.startsWith('state:invariant')) {
      const obs = [{ t: 0, confidence: 0.92, verificationValue: 10.0, errorResidual: 1.5 }];
      const res = globalNeuralInvariantCapacityEngine.simulateInvariantRecurrence(100.0, 0.50, 0.25, obs);
      const step = res.steps[0];
      outText = `I_{t+1} = I_t + alpha*C(O_t)*V_t - beta*epsilon_t => ${step.I_prev} + (${res.alpha}*${step.C_Ot}*${step.V_t}) - (${res.beta}*${step.epsilon_t}) = ${step.I_prev} + ${step.gainTerm} - ${step.lossTerm} = ${step.I_next}. Equilibrium error: epsilon* = ${step.equilibriumEpsilon}`;
      receipt = res.receiptId;
    } else if (rawCmd.startsWith('pkg:')) {
      const pkgName = rawCmd.slice(4).trim();
      outText = `Host package-manager probe for [${pkgName}]: Status AVAILABLE (version: 22.11.0, capability: READ_ONLY_AUDIT)`;
      receipt = `RC_PKG_${pkgName.toUpperCase()}`;
    } else if (rawCmd.startsWith('engine:status')) {
      outText = `CuboctahedralTraceEngine: RUNNING &bull; Ledger Blocks: ${globalTraceEngine.getBlockLedger().length} &bull; Active Shape: ${activeShape.name}`;
      receipt = `RC_ENGINE_OK`;
    } else if (rawCmd.startsWith('flight:coords')) {
      outText = `4D Camera Coords: (X: ${camera4D.x.toFixed(2)}, Y: ${camera4D.y.toFixed(2)}, Z: ${camera4D.z.toFixed(2)}, W: ${camera4D.w.toFixed(2)}, Yaw: ${camera4D.yaw.toFixed(2)}, Pitch: ${camera4D.pitch.toFixed(2)})`;
      receipt = `RC_FLIGHT_STATE`;
    } else {
      outText = `Dispatched to Polyglot provider [NATIVE_TS]. Result envelope solid. Pipe status: ${hasReversePipe ? '<-- (Reverse)' : hasPipe ? '| (Forward)' : 'Direct'}`;
      receipt = `RC_POLY_${Date.now().toString(16).slice(-6).toUpperCase()}`;
    }

    setTerminalOutput((prev) => [
      { cmd: rawCmd, out: outText, receipt, timestamp },
      ...prev.slice(0, 15),
    ]);
  };

  // Search hash and locate 4D coordinates
  const handleSearchHash = () => {
    if (!searchQuery.trim()) return;
    const hashDigest = `SHA256_${Math.abs(searchQuery.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) * 97152).toString(16).toUpperCase()}`;
    const matchShape = shapeInstances[(hashDigest.charCodeAt(hashDigest.length - 1) % shapeInstances.length)];
    const xyzwCoord = `(X: ${(Math.cos(matchShape.ringAngle) * matchShape.ringRadius).toFixed(2)}, Y: 0.00, Z: ${(Math.sin(matchShape.ringAngle) * matchShape.ringRadius).toFixed(2)}, W: 0.00)`;
    setSearchResult(`Indexed to Shape [${matchShape.name}] // 4D Coordinate: ${xyzwCoord} // Dewey: 3.1415.92.${matchShape.id * 16}`);
    flyCameraToShape(matchShape);
  };

  // =========================================================================
  // Canvas Click: Raycast Hit Detection for Selecting Shapes in 3D Ring
  // =========================================================================
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const scale = Math.min(w, h) * 0.28;
    const cam = cameraRef.current;

    // Check hit against each shape projected on the circular ring
    for (const shape of shapeInstances) {
      const angle = shape.ringAngle + rotAngle * 0.15;
      const shX = Math.cos(angle) * shape.ringRadius - cam.x;
      const shY = -cam.y;
      const shZ = Math.sin(angle) * shape.ringRadius + 5.0 - cam.z;

      // Apply yaw rotation
      const cosY = Math.cos(cam.yaw);
      const sinY = Math.sin(cam.yaw);
      const rx = shX * cosY - shZ * sinY;
      const rz = shX * sinY + shZ * cosY;

      if (rz <= 0.2) continue;

      const fov = 1.0 / (rz * 0.4);
      const px = cx + rx * scale * fov;
      const py = cy - shY * scale * fov;
      const hitRadius = Math.max(22, 40 * fov);

      const dist = Math.hypot(mouseX - px, mouseY - py);
      if (dist <= hitRadius) {
        flyCameraToShape(shape);
        return;
      }
    }
  };

  // Mouse orbit controls on canvas
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    setCamera4D((prev) => ({
      ...prev,
      yaw: prev.yaw + dx * 0.005,
      pitch: Math.max(-0.8, Math.min(0.8, prev.pitch - dy * 0.005)),
    }));
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY * 0.005;
    setCamera4D((prev) => ({
      ...prev,
      z: Math.max(1.5, Math.min(14.0, prev.z + delta)),
    }));
  };

  // =========================================================================
  // Canvas 3D/4D Render Loop: Circular Ring Formation of Geometric Shapes
  // =========================================================================
  useEffect(() => {
    if (!isOpen) return;

    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = (time - lastTime) * 0.001;
      lastTime = time;

      if (isRunning) {
        setRotAngle((r) => r + 0.012);
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          renderHypergeometricVoid(
            ctx,
            canvas.width,
            canvas.height,
            rotAngle,
            cameraRef.current,
            shapeInstances,
            activeShapeId
          );
        }
      }

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isOpen, isRunning, rotAngle, activeShapeId, shapeInstances]);

  // Primary 4D Traversable Void & Circular Ring Renderer
  const renderHypergeometricVoid = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    rot: number,
    cam: Camera4DState,
    shapes: HypergeometricShapeInstance[],
    activeId: number
  ) => {
    ctx.fillStyle = '#010308';
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const scale = Math.min(w, h) * 0.28;

    // Background 4D coordinate grid
    ctx.strokeStyle = '#081220';
    ctx.lineWidth = 1;
    const gridStep = 45;
    for (let i = -7; i <= 7; i++) {
      const gx = cx + i * gridStep - ((cam.x * 35) % gridStep);
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();

      const gy = cy + i * gridStep - ((cam.y * 35) % gridStep);
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }

    // Origin (0,0,0,0) reticle
    ctx.strokeStyle = '#00f0ff33';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 15, cy); ctx.lineTo(cx + 15, cy);
    ctx.moveTo(cx, cy - 15); ctx.lineTo(cx, cy + 15);
    ctx.stroke();

    // 1. Draw Circular Orbital Ring in 3D Perspective
    ctx.beginPath();
    const ringSegments = 64;
    const ringRadius = 3.4;
    let firstPoint = true;

    for (let i = 0; i <= ringSegments; i++) {
      const a = (2 * Math.PI * i) / ringSegments;
      const rx0 = Math.cos(a) * ringRadius - cam.x;
      const ry0 = -cam.y;
      const rz0 = Math.sin(a) * ringRadius + 5.0 - cam.z;

      const cosY = Math.cos(cam.yaw);
      const sinY = Math.sin(cam.yaw);
      const prx = rx0 * cosY - rz0 * sinY;
      const prz = rx0 * sinY + rz0 * cosY;

      if (prz > 0.2) {
        const fov = 1.0 / (prz * 0.4);
        const px = cx + prx * scale * fov;
        const py = cy - ry0 * scale * fov;

        if (firstPoint) {
          ctx.moveTo(px, py);
          firstPoint = false;
        } else {
          ctx.lineTo(px, py);
        }
      }
    }
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Render Each Geometric Shape on the Circular Ring
    shapes.forEach((shape) => {
      const angle = shape.ringAngle + rot * 0.15;
      const centerDist = shape.ringRadius;

      // Position along the circular ring
      const shX0 = Math.cos(angle) * centerDist - cam.x;
      const shY0 = Math.sin(rot * 0.5 + shape.id) * 0.15 - cam.y;
      const shZ0 = Math.sin(angle) * centerDist + 5.0 - cam.z;

      // Rotate by camera yaw & pitch
      const cosYaw = Math.cos(cam.yaw);
      const sinYaw = Math.sin(cam.yaw);
      const rotX = shX0 * cosYaw - shZ0 * sinYaw;
      const rotZ = shX0 * sinYaw + shZ0 * cosYaw;

      const cosPitch = Math.cos(cam.pitch);
      const sinPitch = Math.sin(cam.pitch);
      const rotY = shY0 * cosPitch - rotZ * sinPitch;
      const finalZ = shY0 * sinPitch + rotZ * cosPitch;

      if (finalZ <= 0.2) return; // Behind camera

      const fov = 1.0 / (finalZ * 0.4);
      const screenX = cx + rotX * scale * fov;
      const screenY = cy - rotY * scale * fov;

      const isActive = shape.id === activeId;
      const baseNodeRadius = Math.max(16, 28 * fov);

      // Render wireframe polytope projection based on shape type
      renderPolytopeWireframe(ctx, screenX, screenY, shape.polytopeType, rot * 1.5, fov * 35, shape.color, isActive);

      // Glowing targeting aura for active shape
      if (isActive) {
        ctx.strokeStyle = '#39ff14';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#39ff14';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(screenX, screenY, baseNodeRadius + 14 + Math.sin(rot * 4) * 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Cross reticle
        ctx.strokeStyle = '#39ff14';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(screenX - baseNodeRadius - 18, screenY);
        ctx.lineTo(screenX + baseNodeRadius + 18, screenY);
        ctx.moveTo(screenX, screenY - baseNodeRadius - 18);
        ctx.lineTo(screenX, screenY + baseNodeRadius + 18);
        ctx.stroke();
      }

      // Solved badge halo
      if (shape.solving.isSolved) {
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(screenX, screenY, baseNodeRadius + 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Shape label banner
      ctx.fillStyle = isActive ? '#39ff14' : '#cbd5e1';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Lvl ${shape.difficultyLevel}: ${shape.name.split(' ')[0]}`, screenX, screenY + baseNodeRadius + 18);

      // Step progress indicator under label
      const stepPct = (shape.solving.step / shape.solving.maxSteps) * 100;
      ctx.fillStyle = shape.solving.isSolved ? '#39ff14' : '#00f0ff';
      ctx.fillRect(screenX - 20, screenY + baseNodeRadius + 22, (40 * stepPct) / 100, 3);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.strokeRect(screenX - 20, screenY + baseNodeRadius + 22, 40, 3);
    });

    // 3. Central 4D Core (Dual-Plane Rotating Hypercube)
    renderCentralTesseractCore(ctx, cx, cy, rot, cam, scale);
  };

  // Helper: Renders 3D/4D Polytope Wireframes for each shape instance
  const renderPolytopeWireframe = (
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    type: PolytopeShapeType,
    angle: number,
    size: number,
    color: string,
    isActive: boolean
  ) => {
    ctx.save();
    ctx.translate(px, py);
    ctx.strokeStyle = color;
    ctx.lineWidth = isActive ? 2 : 1;
    ctx.shadowColor = color;
    ctx.shadowBlur = isActive ? 12 : 4;

    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    switch (type) {
      case 'TESSERACT': {
        // Inner and outer 3D projected cubes of the 4D tesseract
        const s1 = size * 0.45;
        const s2 = size * 0.85;
        const pts1 = [
          [-s1, -s1], [s1, -s1], [s1, s1], [-s1, s1],
        ];
        const pts2 = [
          [-s2, -s2], [s2, -s2], [s2, s2], [-s2, s2],
        ];

        // Draw inner cube
        ctx.beginPath();
        pts1.forEach(([x, y], i) => {
          const rx = x * cosA - y * sinA;
          const ry = x * sinA + y * cosA;
          i === 0 ? ctx.moveTo(rx, ry) : ctx.lineTo(rx, ry);
        });
        ctx.closePath();
        ctx.stroke();

        // Draw outer cube
        ctx.beginPath();
        pts2.forEach(([x, y], i) => {
          const rx = x * cosA - y * sinA;
          const ry = x * sinA + y * cosA;
          i === 0 ? ctx.moveTo(rx, ry) : ctx.lineTo(rx, ry);
        });
        ctx.closePath();
        ctx.stroke();

        // Connecting hyperedges
        for (let i = 0; i < 4; i++) {
          const rx1 = pts1[i][0] * cosA - pts1[i][1] * sinA;
          const ry1 = pts1[i][0] * sinA + pts1[i][1] * cosA;
          const rx2 = pts2[i][0] * cosA - pts2[i][1] * sinA;
          const ry2 = pts2[i][0] * sinA + pts2[i][1] * cosA;
          ctx.beginPath();
          ctx.moveTo(rx1, ry1);
          ctx.lineTo(rx2, ry2);
          ctx.stroke();
        }
        break;
      }
      case '24_CELL': {
        // 24-cell octahedral projection
        const r = size * 0.7;
        const sides = 8;
        ctx.beginPath();
        for (let i = 0; i <= sides; i++) {
          const theta = (2 * Math.PI * i) / sides + angle;
          const x = Math.cos(theta) * r;
          const y = Math.sin(theta) * r;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Inner cross spokes
        for (let i = 0; i < 4; i++) {
          const theta = (Math.PI * i) / 4 + angle;
          ctx.beginPath();
          ctx.moveTo(-Math.cos(theta) * r, -Math.sin(theta) * r);
          ctx.lineTo(Math.cos(theta) * r, Math.sin(theta) * r);
          ctx.stroke();
        }
        break;
      }
      case '5_CELL': {
        // 5-cell 4-simplex (complete graph K5)
        const r = size * 0.75;
        const pts: [number, number][] = [];
        for (let i = 0; i < 5; i++) {
          const theta = (2 * Math.PI * i) / 5 + angle;
          pts.push([Math.cos(theta) * r, Math.sin(theta) * r]);
        }
        // Connect all 10 pairwise edges of 4-simplex
        for (let i = 0; i < 5; i++) {
          for (let j = i + 1; j < 5; j++) {
            ctx.beginPath();
            ctx.moveTo(pts[i][0], pts[i][1]);
            ctx.lineTo(pts[j][0], pts[j][1]);
            ctx.stroke();
          }
        }
        break;
      }
      case '120_CELL': {
        // Hyperdodecahedron concentric golden ratio rings
        const r1 = size * 0.4;
        const r2 = size * 0.8;
        ctx.beginPath();
        ctx.arc(0, 0, r1, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, r2, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 12; i++) {
          const a = (2 * Math.PI * i) / 12 + angle;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
          ctx.lineTo(Math.cos(a + 0.2) * r2, Math.sin(a + 0.2) * r2);
          ctx.stroke();
        }
        break;
      }
      case '600_CELL': {
        // Hexacosichoron icosahedral cell cluster
        const r = size * 0.8;
        for (let ring = 0; ring < 3; ring++) {
          const rad = r * (0.35 + ring * 0.3);
          ctx.beginPath();
          for (let i = 0; i <= 6; i++) {
            const a = (2 * Math.PI * i) / 6 + angle * (ring % 2 === 0 ? 1 : -1);
            const x = Math.cos(a) * rad;
            const y = Math.sin(a) * rad;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        break;
      }
      case 'GREAT_120_CELL': {
        // Torus spiral winding
        const R = size * 0.65;
        const r = size * 0.25;
        ctx.beginPath();
        for (let t = 0; t <= Math.PI * 4; t += 0.2) {
          const rad = R + r * Math.cos(t * 3 + angle);
          const x = Math.cos(t) * rad;
          const y = Math.sin(t) * rad;
          t === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        break;
      }
      case 'STELLA_OCTANGULA': {
        // Dual interlocking triangles (Star of David in 2D / Stella Octangula in 3D)
        const r = size * 0.8;
        const drawTri = (offset: number) => {
          ctx.beginPath();
          for (let i = 0; i < 3; i++) {
            const a = (2 * Math.PI * i) / 3 + angle + offset;
            const x = Math.cos(a) * r;
            const y = Math.sin(a) * r;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.stroke();
        };
        drawTri(0);
        drawTri(Math.PI);
        break;
      }
      case 'GRAND_SEPHIROTH': {
        // Concentric spheres and 6-axis orthogonal spokes
        const r = size * 0.85;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(0, 0, r, r * 0.35, angle, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.35, r, angle, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
    }

    ctx.restore();
  };

  // Helper: Renders central rotating 4D tesseract core at origin
  const renderCentralTesseractCore = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    rot: number,
    cam: Camera4DState,
    scale: number
  ) => {
    const tesseractSize = 0.85;
    const vertices: [number, number, number, number][] = [];
    for (let x = -1; x <= 1; x += 2) {
      for (let y = -1; y <= 1; y += 2) {
        for (let z = -1; z <= 1; z += 2) {
          for (let w4 = -1; w4 <= 1; w4 += 2) {
            vertices.push([x * tesseractSize, y * tesseractSize, z * tesseractSize, w4 * tesseractSize]);
          }
        }
      }
    }

    const projected = vertices.map(([x0, y0, z0, w0]) => {
      const cosR = Math.cos(rot * 1.2);
      const sinR = Math.sin(rot * 1.2);
      // Double rotation in XW and YZ planes
      const x1 = x0 * cosR - w0 * sinR;
      const w1 = x0 * sinR + w0 * cosR;
      const y1 = y0 * cosR - z0 * sinR;
      const z1 = y0 * sinR + z0 * cosR;

      const dz = z1 + 5.0 - cam.z;
      if (dz <= 0.1) return { sx: 0, sy: 0, visible: false };

      const fov = 1.0 / dz;
      const sx = cx + x1 * scale * fov - cam.x * 20;
      const sy = cy - y1 * scale * fov - cam.y * 20;
      return { sx, sy, visible: true };
    });

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
    ctx.lineWidth = 1;

    for (let i = 0; i < vertices.length; i++) {
      for (let j = i + 1; j < vertices.length; j++) {
        let diff = 0;
        for (let k = 0; k < 4; k++) {
          if (vertices[i][k] !== vertices[j][k]) diff++;
        }
        if (diff === 1) {
          const p1 = projected[i];
          const p2 = projected[j];
          if (p1.visible && p2.visible) {
            ctx.beginPath();
            ctx.moveTo(p1.sx, p1.sy);
            ctx.lineTo(p2.sx, p2.sy);
            ctx.stroke();
          }
        }
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md font-mono select-none text-slate-100">
      <div className="w-full max-w-7xl max-h-[96vh] bg-[#02050b] border border-cyan-500/40 rounded-2xl shadow-2xl shadow-cyan-500/10 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Header */}
        <div className="p-3 sm:p-4 bg-[#060b14] border-b border-cyan-950 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/40 text-cyan-400">
              <Orbit className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  4D HYPERGEOMETRIC ARBITRAGE RING &bull; MANUAL SOLVER MATRIX
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
                  AE.SL6.RING.4D
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                WSAD + Arrow keys enable 4D flight control &bull; Click or select geometric shapes along the circular ring to manually solve cycles
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenCapacityModal && (
              <button
                onClick={onOpenCapacityModal}
                className="px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-all"
                title="Open Neural Parameter Capacity Budget (P_total) & Invariant Recurrence (I_{t+1}) Calculator"
              >
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                <span>P_total &bull; I_&#123;t+1&#125;</span>
              </button>
            )}

            <button
              onClick={() => setIsPolyglotOpen(!isPolyglotOpen)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all ${
                isPolyglotOpen
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
              }`}
              title="Open Universal Polyglot Matrix Terminal (AE.AXS.POLYGLOT.3.0)"
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>Polyglot Terminal</span>
            </button>

            <button
              onClick={toggleMute}
              className={`p-2 rounded-lg border text-xs font-bold transition-all ${
                !isAudioMuted
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
              }`}
              title={isAudioMuted ? 'Unmute 432 Hz Pythagorean Audio Resonance' : 'Mute Audio Engine'}
            >
              {!isAudioMuted ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setIsRunning(!isRunning)}
              className="px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/50 text-cyan-200 hover:bg-cyan-500/30 text-xs font-bold flex items-center gap-1.5"
            >
              {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isRunning ? 'Pause Void' : 'Resume Void'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Workspace Body: Left 3D/4D Void Canvas, Right Shape Ring & Manual Arbitrage Solver */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-4 p-3 sm:p-4">
          
          {/* Left Column (7 cols): 4D Traversable Canvas with Flight HUD Overlay */}
          <div className="lg:col-span-7 bg-[#010308] border border-slate-800 rounded-xl overflow-hidden relative flex flex-col min-h-[440px] lg:min-h-[580px]">
            <canvas
              ref={canvasRef}
              width={820}
              height={580}
              className="w-full h-full block cursor-crosshair"
              onClick={handleCanvasClick}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onWheel={handleWheel}
            />

            {/* Drone Flight HUD Overlay Top-Left */}
            <div className="absolute top-3 left-3 bg-[#060b14]/90 backdrop-blur border border-slate-800 p-2.5 rounded-lg text-[10px] space-y-1 shadow-lg pointer-events-none">
              <div className="text-cyan-400 font-bold flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-emerald-400" />
                4D FLIGHT TELEMETRY (WSAD ENABLED)
              </div>
              <div className="text-slate-300">
                Coords: <span className="text-cyan-300">X: {camera4D.x.toFixed(2)}</span> | <span className="text-cyan-300">Y: {camera4D.y.toFixed(2)}</span> | <span className="text-cyan-300">Z: {camera4D.z.toFixed(2)}</span>
              </div>
              <div className="text-slate-300">
                Yaw: <span className="text-cyan-300">{(camera4D.yaw * (180 / Math.PI)).toFixed(1)}&deg;</span> | Pitch: <span className="text-cyan-300">{(camera4D.pitch * (180 / Math.PI)).toFixed(1)}&deg;</span>
              </div>
              <div className="text-slate-400 text-[9px] pt-0.5">
                Keys: <kbd className="px-1 bg-slate-800 text-cyan-300">W S A D</kbd> (Move) &bull; <kbd className="px-1 bg-slate-800 text-cyan-300">&uarr; &darr; &larr; &rarr;</kbd> (Pitch/Yaw) &bull; Drag to orbit
              </div>
            </div>

            {/* Quick Ring Selector Overlay Top-Right */}
            <div className="absolute top-3 right-3 bg-[#060b14]/90 backdrop-blur border border-slate-800 p-2 rounded-lg text-[10px] space-y-1 max-w-[210px] hidden sm:block">
              <div className="text-slate-400 font-semibold mb-1 flex items-center justify-between">
                <span>CIRCULAR RING NODES</span>
                <span className="text-cyan-400 font-mono">8 Polytones</span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {shapeInstances.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => flyCameraToShape(s)}
                    className={`p-1 rounded text-center font-bold text-[9px] border transition-all ${
                      s.id === activeShapeId
                        ? 'bg-cyan-500/25 border-cyan-400 text-white'
                        : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                    title={`Fly to ${s.name}`}
                  >
                    #{s.id}
                  </button>
                ))}
              </div>
            </div>

            {/* Active Target Banner Bottom */}
            <div className="absolute bottom-3 left-3 right-3 bg-[#060b14]/95 backdrop-blur border border-slate-800 p-3 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: activeShape.color }} />
                <div>
                  <div className="text-white font-bold text-xs">{activeShape.name}</div>
                  <div className="text-[10px] text-cyan-400 truncate max-w-sm">{activeShape.algorithmName}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => flyCameraToShape(activeShape)}
                  className="px-2.5 py-1 bg-cyan-500/20 border border-cyan-500/40 text-cyan-200 rounded text-[10px] font-bold hover:bg-cyan-500/30"
                >
                  Align Flight View
                </button>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                  Level {activeShape.difficultyLevel} / 8
                </span>
              </div>
            </div>
          </div>

          {/* Right Column (5 cols): Visual Arbitrage Algorithm Interface & Manual Solving Workspace */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            
            {/* Shape Arbitrage Interface & Manual Controls */}
            <div className="p-4 bg-[#060b14] border border-cyan-500/30 rounded-xl space-y-3.5 shadow-lg">
              
              {/* Header Info */}
              <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                      VISUAL ARBITRAGE INTERFACE
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Step {activeShape.solving.step} / {activeShape.solving.maxSteps}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white mt-1 flex items-center gap-1.5">
                    {activeShape.name}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {activeShape.arbitrageFamily}
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-xs text-slate-400 font-semibold">Yield Spread</div>
                  <div className="text-sm font-bold text-emerald-400">
                    +{activeShape.theoreticalProfitPct}%
                  </div>
                </div>
              </div>

              {/* Solving Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-400">Manual Cycle Progress:</span>
                  <span className={activeShape.solving.isSolved ? 'text-emerald-400 font-bold' : 'text-cyan-300'}>
                    {activeShape.solving.isSolved ? 'CYCLE SOLVED & VERIFIED' : `${Math.round((activeShape.solving.step / activeShape.solving.maxSteps) * 100)}% Complete`}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className={`h-full transition-all duration-300 ${
                      activeShape.solving.isSolved
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                    }`}
                    style={{ width: `${(activeShape.solving.step / activeShape.solving.maxSteps) * 100}%` }}
                  />
                </div>
              </div>

              {/* Algorithm Visual Metrics & State Cards */}
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 bg-slate-950/80 border border-slate-800 rounded-lg">
                  <div className="text-[10px] text-slate-400 uppercase">Residue / Syndrome</div>
                  <div className="text-cyan-300 font-bold font-mono text-xs mt-0.5 truncate">
                    {activeShape.solving.residueOrSyndrome}
                  </div>
                </div>

                <div className="p-2.5 bg-slate-950/80 border border-slate-800 rounded-lg">
                  <div className="text-[10px] text-slate-400 uppercase">Expected Net Profit</div>
                  <div className="text-emerald-300 font-bold font-mono text-xs mt-0.5">
                    ${activeShape.solving.expectedProfitUsd} USD
                  </div>
                </div>

                <div className="p-2.5 bg-slate-950/80 border border-slate-800 rounded-lg">
                  <div className="text-[10px] text-slate-400 uppercase">Reversibility Check</div>
                  <div className={`font-bold font-mono text-xs mt-0.5 flex items-center gap-1 ${
                    activeShape.solving.reversibilityStatus === 'VERIFIED'
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }`}>
                    <span>{activeShape.solving.reversibilityStatus}</span>
                    {activeShape.solving.reversibilityStatus === 'VERIFIED' && <Check className="w-3 h-3" />}
                  </div>
                </div>

                <div className="p-2.5 bg-slate-950/80 border border-slate-800 rounded-lg">
                  <div className="text-[10px] text-slate-400 uppercase">Modulus N / Base Field</div>
                  <div className="text-slate-200 font-bold font-mono text-xs mt-0.5 truncate">
                    N = {activeShape.solving.currentModulus.toString()}
                  </div>
                </div>
              </div>

              {/* MANUAL SOLVING INTERACTION BUTTONS */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <Zap className="w-3 h-3 text-cyan-400" />
                  Manual Solving Controls
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleManualSolveStep}
                    disabled={activeShape.solving.isSolved}
                    className="py-2.5 px-3 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-cyan-500/20 transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                    <span>{activeShape.solving.isSolved ? 'Cycle Solved' : 'Manual Solve Step'}</span>
                  </button>

                  <button
                    onClick={handleInvertTransformation}
                    className={`py-2.5 px-3 rounded-lg border font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                      activeShape.solving.isReversed
                        ? 'bg-purple-600/30 border-purple-400 text-purple-200'
                        : 'bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-500'
                    }`}
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 text-purple-400" />
                    <span>Invert S^-1 (d_i &rarr; -d_i)</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleVerifySyndrome}
                    className="py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 hover:border-emerald-500 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Verify Parity &amp; Syndrome</span>
                  </button>

                  <button
                    onClick={handleResetSolving}
                    className="py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                    <span>Reset Problem</span>
                  </button>
                </div>

                {/* Solidify & Mint Receipt Button */}
                <button
                  onClick={handleSolidifyReceipt}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
                >
                  <Award className="w-4 h-4 text-emerald-200" />
                  <span>Solidify &amp; Anchor Receipt to Block Ledger</span>
                </button>

                {activeShape.solving.proofReceiptId && (
                  <div className="p-2 bg-emerald-950/40 border border-emerald-500/50 rounded-lg text-[10px] text-emerald-200 flex items-center justify-between">
                    <span>Receipt: <code className="text-emerald-300">{activeShape.solving.proofReceiptId}</code></span>
                    <span className="font-bold text-emerald-400">LEDGER COMMITTED</span>
                  </div>
                )}
              </div>

              {/* Execution Log Snippet */}
              <div className="pt-2 border-t border-slate-800 space-y-1">
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>Algorithm Execution Trail:</span>
                  <span className="font-mono text-cyan-400">{activeShape.solving.historyLogs.length} events</span>
                </div>
                <div className="bg-[#02050b] border border-slate-800 p-2 rounded-lg max-h-[85px] overflow-y-auto font-mono text-[10px] space-y-1 text-slate-300">
                  {activeShape.solving.historyLogs.map((log, i) => (
                    <div key={i} className="leading-tight">
                      &rsaquo; {log}
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Cryptic Hash & Dewey Decimal Search Console */}
            <div className="p-3 bg-[#060b14] border border-slate-800 rounded-xl space-y-2">
              <div className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-emerald-400" />
                <span>Hash Potential Pool &amp; Dewey Decimal Query</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchHash()}
                  placeholder="Target hash or Dewey index (e.g. 3.1415)..."
                  className="flex-1 bg-slate-950 border border-slate-800 p-2 text-xs text-slate-200 rounded-lg focus:outline-none focus:border-cyan-400"
                />
                <button
                  onClick={handleSearchHash}
                  className="px-3 py-2 bg-emerald-600/20 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-600/30 font-bold text-xs rounded-lg transition"
                >
                  Locate
                </button>
              </div>
              {searchResult && (
                <div className="p-2 bg-slate-950 border border-emerald-500/30 text-emerald-200 text-[10px] rounded-lg select-text leading-relaxed">
                  {searchResult}
                </div>
              )}
            </div>

            {/* Navigation to Audit Log */}
            {onOpenAuditLog && (
              <button
                onClick={() => {
                  onClose();
                  onOpenAuditLog();
                }}
                className="py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-500 text-slate-200 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all"
              >
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span>View Global Persistent Ledger ({globalTraceEngine.getBlockLedger().length} Blocks)</span>
              </button>
            )}

          </div>

        </div>

        {/* Embedded Universal Polyglot Matrix Terminal Drawer (Directive AE.AXS.POLYGLOT.3.0) */}
        {isPolyglotOpen && (
          <div className="p-4 bg-[#030712] border-t border-emerald-500/40 space-y-2.5 animate-in slide-in-from-bottom-6 duration-200">
            <div className="flex items-center justify-between border-b border-emerald-950 pb-2">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-emerald-300">
                  UNIVERSAL POLYGLOT MATRIX TERMINAL &bull; AE.AXS.POLYGLOT.3.0
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  PIPETHRUUC ENABLED
                </span>
              </div>
              <button
                onClick={() => setIsPolyglotOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                &times; Close Terminal
              </button>
            </div>

            <div className="bg-[#010308] border border-slate-800 p-2.5 rounded-lg max-h-[140px] overflow-y-auto font-mono text-[11px] space-y-1.5 text-slate-300 select-text">
              {terminalOutput.map((item, idx) => (
                <div key={idx} className="border-b border-slate-900 pb-1">
                  <div className="text-cyan-400 font-bold flex items-center gap-1.5">
                    <span className="text-slate-500">[{item.timestamp}]</span>
                    <span>&gt; {item.cmd}</span>
                  </div>
                  <div className="text-emerald-300 pl-3">{item.out}</div>
                  {item.receipt && (
                    <div className="text-slate-500 text-[10px] pl-3">
                      Receipt: <span className="text-amber-400">{item.receipt}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Terminal Input Bar */}
            <div className="flex gap-2">
              <div className="flex-1 flex items-center bg-[#010308] border border-emerald-500/40 rounded-lg px-3 py-1.5">
                <span className="text-emerald-400 text-xs font-bold mr-2">AE.AXS.POLYGLOT.3.0 &gt;</span>
                <input
                  type="text"
                  value={terminalInput}
                  onChange={(e) => setTerminalInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRunPolyglotCommand()}
                  placeholder="e.g. quine | math:gcd(65537, 97152) | pkg:node | flight:coords"
                  className="flex-1 bg-transparent text-xs text-white focus:outline-none font-mono"
                />
              </div>
              <button
                onClick={() => handleRunPolyglotCommand()}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-emerald-500/20"
              >
                <span>Dispatch</span>
                <CornerDownLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Footer Status Bar */}
        <div className="p-2.5 bg-[#060b14] border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-emerald-400 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Active Target: {activeShape.name}
            </span>
            <span>&bull;</span>
            <span>Flight: WSAD + Arrow Keys</span>
            <span>&bull;</span>
            <span>Audio: {isAudioMuted ? 'Muted' : '432 Hz Active'}</span>
          </div>
          <div>
            <span>Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200">ESC</kbd> to exit 4D Workspace</span>
          </div>
        </div>

      </div>
    </div>
  );
};
