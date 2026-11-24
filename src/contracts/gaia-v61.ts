/**
 * =============================================================================
 * SPECIFICATION: GAIA / NEXUS v4.5 & CRYPTIC Universal Bridge v6.1.0
 * MODULE: Canonical Contracts for Save_Memory, A = B && C && V Convergence,
 *         4-Domain Math Pipeline, NUEF Polyglot Quine, Level-10 4-64 Lane Lattice,
 *         BLAKE2b Merkle Post-Quantum Receipts R, & Hygiene / Adapter States
 * =============================================================================
 */

export const GAIA_V61_VERSION = '6.1.0';
export const NEXUS_UI_VERSION = '4.5.0';
export const TDOC_ID = 'TDOC-GAIA-NEXUS-V4.5-CRYPTIC-V6.1.0';

// ============================================================================
// 1. ARCHITECT'S AUTHORIZATION INVARIANT: A = B && C && V
// ============================================================================

export type GateCheckStatus = 'PASS' | 'FAIL' | 'PENDING' | 'UNAVAILABLE';

export interface ConvergenceGateEvaluation {
  readonly evaluatedAtUtc: string;
  readonly monotonicNs: string;
  readonly B_boundaryValid: boolean;
  readonly B_reason: string;
  readonly C_capacityValid: boolean;
  readonly C_measuredOpsPerSec: number | null;
  readonly C_clockUncertaintyNs: number;
  readonly C_reason: string;
  readonly V_verificationValid: boolean;
  readonly V_reason: string;
  readonly A_accepted: boolean; // Strict: B && C && V
  readonly statusLabel: 'AUTHORIZED' | 'WITHHELD';
}

// ============================================================================
// 2. CANONICAL Save_Memory CONTRACT (gaia.memory.event.v1)
// ============================================================================

export interface MemoryAuthorizationContext {
  readonly userConsent: boolean;
  readonly actorRole: 'VIEWER' | 'OPERATOR' | 'ENGINEER' | 'ACCOUNTING' | 'ADMINISTRATOR';
  readonly actorId?: string;
  readonly source?: string;
  readonly project?: string;
  readonly deviceRole?: string;
  readonly deviceRuntime?: string;
  readonly idempotencyKey?: string;
  readonly tags?: readonly string[];
  readonly maxBudgetMs?: number;
  readonly recordLexicalIndex?: boolean;
}

export interface MemoryEventInput {
  readonly payload: string;
  readonly source?: string;
  readonly project?: string;
  readonly tags?: readonly string[];
  readonly idempotencyKey?: string;
  readonly eventType?:
    | 'USER_MEMORY'
    | 'LEXICAL_CORPUS'
    | 'QUANTUM_ROSE_SNAPSHOT'
    | 'MATH_CONVERGENCE'
    | 'QUINE_PROOF'
    | 'HYGIENE_AUDIT'
    | 'V7_COLOR_GOVERNOR'
    | 'V7_CLOCK_EPOCH'
    | 'V7_HAMILTONIAN_CHECKPOINT'
    | 'V7_GRIMOIRE_COMPOSITION'
    | 'V7_IMAGE_STUDIO_EXPORT'
    | 'V7_AUTH_DECISION'
    | 'V7_CIRCULAR_CHECKPOINT';
  readonly metadata?: Record<string, string | number | boolean>;
}

export interface GaiaMemoryEventRecord {
  readonly schema: 'gaia.memory.event.v1';
  readonly event_id: string;
  readonly sequence: number;
  readonly created_utc: string;
  readonly source: string;
  readonly project: string;
  readonly event_type: string;
  readonly device: {
    readonly role: string;
    readonly runtime: string;
  };
  readonly payload_encoding: 'UTF-8';
  readonly payload: string; // Verbatim original content unless secret redaction occurred
  readonly payload_sha256: string;
  readonly payload_blake2b512: string;
  readonly previous_hash: string;
  readonly event_hash: string;
  readonly redaction: {
    readonly redacted: boolean;
    readonly rulesTriggered: readonly string[];
  };
  readonly tags: readonly string[];
  readonly idempotency_key: string | null;
  readonly authorization: {
    readonly user_consent: boolean;
    readonly boundary: GateCheckStatus;
    readonly clock_capacity: GateCheckStatus;
    readonly verification: GateCheckStatus;
    readonly gate_a_accepted: boolean;
  };
  readonly trace_receipt_id: string;
  readonly status: 'committed' | 'rejected';
}

export interface MemorySaveReceipt {
  readonly ok: boolean;
  readonly deduplicated: boolean;
  readonly event: GaiaMemoryEventRecord;
  readonly verification: {
    readonly readBackConfirmed: boolean;
    readonly payloadSha256Matches: boolean;
    readonly chainLinkMatches: boolean;
    readonly eventHashMatches: boolean;
    readonly verified: boolean;
  };
  readonly convergence: ConvergenceGateEvaluation;
  readonly receiptR: TraceableExecutionReceiptR;
}

export interface MemoryChainVerificationReport {
  readonly verifiedAtUtc: string;
  readonly totalEvents: number;
  readonly chainValid: boolean;
  readonly brokenSequence: number | null;
  readonly brokenEventId: string | null;
  readonly reason: string;
  readonly headHash: string;
}

export interface LexicalCorpusIndexEntry {
  readonly indexId: string;
  readonly eventId: string;
  readonly tokenCount: number;
  readonly distinctTokens: readonly string[];
  readonly preservedVerbatim: true;
  readonly indexedAtUtc: string;
}

// ============================================================================
// 3. TRACEABLE EXECUTION RECEIPT R = {ID, T, M, H_in, H_out, V, A} & PQ MERKLE
// ============================================================================

export interface PostQuantumHybridSignature {
  readonly scheme: 'HYBRID_WOTS_BLAKE2B512_ED25519';
  readonly wotsKeyId: string;
  readonly wotsRootHex: string;
  readonly wotsSignatureCount: number;
  readonly ed25519PublicKeyPem: string;
  readonly ed25519SignatureHex: string;
  readonly verified: boolean;
}

export interface TraceableExecutionReceiptR {
  readonly ID: string;
  readonly T: {
    readonly utcIso: string;
    readonly monotonicNs: string;
    readonly epochId: string;
    readonly durationNs: string;
  };
  readonly M: {
    readonly subsystem: string;
    readonly operationId: string;
    readonly adapter: string;
    readonly algorithmVersion: string;
  };
  readonly H_input: {
    readonly sha256: string;
    readonly blake2b512: string;
  };
  readonly H_output: {
    readonly sha256: string;
    readonly blake2b512: string;
  };
  readonly V: {
    readonly outcome: 'VERIFIED' | 'VERIFIED_WITH_CORRECTION' | 'REJECTED' | 'FAILED' | 'UNAVAILABLE';
    readonly independentCheckPassed: boolean;
    readonly detail: string;
    readonly blake2bMerkleLeafHex: string;
    readonly blake2bMerkleRootHex: string;
    readonly pqSignature: PostQuantumHybridSignature;
  };
  readonly A: boolean;
}

export interface MerkleBatchRecord {
  readonly batchId: string;
  readonly rootBlake2bHex: string;
  readonly leafCount: number;
  readonly receiptIds: readonly string[];
  readonly pqSignature: PostQuantumHybridSignature;
  readonly createdAtUtc: string;
}

// ============================================================================
// 4. 4-DOMAIN UNIFIED MATHEMATICAL CONVERGENCE PIPELINE & MIR
// ============================================================================

export interface MathematicalIR {
  readonly irVersion: 'gaia.mir.v1';
  readonly operationId: string;
  readonly domain: 'LINEAR_ALGEBRA' | 'CODING_THEORY' | 'INFORMATION_THEORY' | 'CONTROL_THEORY' | 'UNIFIED_PIPELINE';
  readonly numericTypes: readonly string[];
  readonly tensorShape: readonly number[];
  readonly parameters: Record<string, number | string | boolean | readonly number[]>;
  readonly deadlineNs: number;
}

export interface DomainPipelineStageResult {
  readonly stage: '01_LINEAR_ALGEBRA' | '02_CODING_THEORY' | '03_INFORMATION_THEORY' | '04_CONTROL_THEORY';
  readonly title: string;
  readonly algorithmVersion: string;
  readonly inputDigestSha256: string;
  readonly outputDigestSha256: string;
  readonly unit: string;
  readonly datasetProvenance: string;
  readonly runtimeNs: string;
  readonly metrics: Record<string, number | string | boolean>;
  readonly verificationPassed: boolean;
  readonly verificationDetail: string;
}

export interface UnifiedMathConvergenceResult {
  readonly runId: string;
  readonly mir: MathematicalIR;
  readonly couplingMatrixL: readonly (readonly string[])[];
  readonly stages: readonly DomainPipelineStageResult[];
  readonly convergence: ConvergenceGateEvaluation;
  readonly receiptR: TraceableExecutionReceiptR;
  readonly qiskitAdapterStatus: {
    readonly available: boolean;
    readonly state: NetworkLifecycleState;
    readonly hardwareClaimed: false;
    readonly reason: string;
  };
  readonly wolframAdapterStatus: {
    readonly localCasAvailable: boolean;
    readonly wolframCloudConfigured: boolean;
    readonly wolframScriptAvailable: boolean;
    readonly reason: string;
  };
}

// ============================================================================
// 5. UNIVERSAL POLYGLOT QUINE & PACKAGE-MANAGER CAPABILITY REGISTRY
// ============================================================================

export type CapabilityKind = 'INTERPRETER' | 'OS_PACKAGE_MANAGER' | 'LANG_PACKAGE_MANAGER' | 'CRYPTO_TOOL';

export interface HostCapabilityEntry {
  readonly id: string;
  readonly name: string;
  readonly kind: CapabilityKind;
  readonly platformGroup: string;
  readonly binary: string;
  readonly available: boolean;
  readonly resolvedPath: string | null;
  readonly version: string | null;
  readonly status: 'AVAILABLE' | 'UNAVAILABLE';
  readonly autoInstallPermitted: false;
  readonly note: string;
}

export interface TypedCommandIR {
  readonly irVersion: 'nuef.ir.v1';
  readonly operationId: string;
  readonly targetRuntime: 'NODE_JS' | 'PYTHON3' | 'BASH' | 'POSIX_SH' | 'BUN';
  readonly inputTypes: readonly string[];
  readonly outputTypes: readonly string[];
  readonly requiredCapabilities: readonly string[];
  readonly resourceLimits: {
    readonly maxOutputBytes: number;
    readonly deadlineMs: number;
  };
  readonly shebangRequired: false;
  readonly authorizationRequired: boolean;
}

export interface PolyglotQuineExecutionResult {
  readonly runId: string;
  readonly runtimeId: TypedCommandIR['targetRuntime'];
  readonly commandIr: TypedCommandIR;
  readonly executedOnHost: boolean;
  readonly hostBinaryPath: string | null;
  readonly status: 'VERIFIED_QUINE' | 'FAILED_MISMATCH' | 'UNAVAILABLE' | 'DENIED_HYGIENE' | 'TIMEOUT';
  readonly sourceCode: string;
  readonly stdoutOutput: string | null;
  readonly inputSha256: string;
  readonly outputSha256: string | null;
  readonly inputBlake2b512: string;
  readonly outputBlake2b512: string | null;
  readonly exactSelfReproduction: boolean;
  readonly stateWrapperHashPreserved: boolean | null;
  readonly durationNs: string;
  readonly reason: string;
  readonly receiptR: TraceableExecutionReceiptR;
}

// ============================================================================
// 6. DYNAMIC LEVEL-10 DIAMOND LATTICE (4 TO 64 LANES)
// ============================================================================

export type SupportedLaneCount = 4 | 8 | 16 | 32 | 64;

export interface DiamondLaneNodeState {
  readonly laneId: number;
  readonly pairIndex: number;
  readonly sequenceOrder: '1234' | '4321';
  readonly role: 'automation' | 'shadow';
  readonly parityAttribute: 'LU' | 'RD';
  readonly activeOperand: number;
  readonly coordinateValue: number;
  readonly fractionalTimingIncrement: number;
  readonly wholeCycleIteration: number;
  readonly directionFactor: 1 | -1;
  readonly laneDigestSha256: string;
}

export interface DiamondPairCheck {
  readonly pairIndex: number;
  readonly automationLaneId: number;
  readonly shadowLaneId: number;
  readonly midpointDivergence: number;
  readonly fractionalMatched: boolean;
  readonly wholeCycleMatched: boolean;
  readonly ticketPolarityValid: boolean;
  readonly pairSymmetric: boolean;
}

export interface DiamondLatticeCycleResult {
  readonly cycleId: string;
  readonly latticeLevel: 10;
  readonly laneCount: SupportedLaneCount;
  readonly stepIndex: number;
  readonly previewOnly: boolean;
  readonly measuredComputeDurationNs: string;
  readonly lanes: readonly DiamondLaneNodeState[];
  readonly pairs: readonly DiamondPairCheck[];
  readonly convergence: ConvergenceGateEvaluation;
  readonly merkleRootBlake2b: string;
  readonly receiptR: TraceableExecutionReceiptR | null;
  readonly timestampUtc: string;
}

// ============================================================================
// 7. QUANTUM ROSE WAVEFUNCTION SNAPSHOT
// ============================================================================

export interface QuantumRoseSnapshotPayload {
  readonly modelVersion: string;
  readonly eigenstatesCount: number;
  readonly amplitudes: readonly { readonly re: number; readonly im: number; readonly energy: number }[];
  readonly phaseRad: number;
  readonly coherence: number;
  readonly timeSpeed: number;
  readonly simulationTime: number;
  readonly canvasConfig: {
    readonly width: number;
    readonly height: number;
    readonly palette: string;
  };
  readonly probeCoordinate?: {
    readonly r: number;
    readonly theta: number;
    readonly probabilityDensity: number;
  };
  readonly disclaimer: 'INTERACTIVE_NUMERICAL_VISUALIZATION_NOT_PHYSICAL_QUANTUM_HARDWARE';
  readonly capturedAtUtc: string;
}

// ============================================================================
// 8. NETWORK ADAPTER STATES, GITHUB, DRIVE & TROJAN/MALWARE HYGIENE
// ============================================================================

export type NetworkLifecycleState =
  | 'NOT_CONFIGURED'
  | 'CONFIGURED'
  | 'AUTHENTICATING'
  | 'AUTHENTICATED'
  | 'VERIFIED'
  | 'CONNECTED'
  | 'FAILED';

export interface AdapterConnectionStatus {
  readonly adapterId: 'TCP_STRATUM' | 'WEBSOCKET' | 'WEBRTC_ICE' | 'RTP_CLOCK' | 'GITHUB_REST' | 'GOOGLE_DRIVE_OAUTH' | 'WOLFRAM' | 'QISKIT' | 'SSH_TAILSCALE';
  readonly label: string;
  readonly state: NetworkLifecycleState;
  readonly configured: boolean;
  readonly lastCheckedUtc: string;
  readonly detail: string;
}

export interface HygieneFinding {
  readonly findingId: string;
  readonly severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFO';
  readonly category: 'OBFUSCATION_EVAL' | 'SHELL_INJECTION_RISK' | 'EXFILTRATION_URL' | 'CREDENTIAL_LEAK' | 'LEDGER_TAMPER' | 'CLEAN';
  readonly target: string;
  readonly lineNumber: number | null;
  readonly description: string;
}

export interface HygieneScanReport {
  readonly scanId: string;
  readonly scannedAtUtc: string;
  readonly durationNs: string;
  readonly filesScanned: number;
  readonly memoryEventsChecked: number;
  readonly receiptsChecked: number;
  readonly trojanOrMalwareDetected: boolean;
  readonly memoryChainValid: boolean;
  readonly findings: readonly HygieneFinding[];
  readonly manifestSha256: string;
  readonly receiptR: TraceableExecutionReceiptR;
}

export interface GitHubRepoInspectionResult {
  readonly owner: string;
  readonly repo: string;
  readonly ref: string;
  readonly state: NetworkLifecycleState;
  readonly authenticatedWithToken: boolean;
  readonly commitSha: string | null;
  readonly treeEntries: readonly {
    readonly path: string;
    readonly type: string;
    readonly sha: string;
    readonly size?: number;
  }[];
  readonly checkedAtUtc: string;
  readonly detail: string;
}
