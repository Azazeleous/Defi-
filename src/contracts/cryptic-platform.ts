/**
 * =============================================================================
 * SPECIFICATION: HCCGN.CRYPTIC.INSTANT.MINER v1.0.0
 * MODULE: Canonical Contracts, Provenance, 13-State Clearing & Chronosphere Types
 * =============================================================================
 */

export const CRYPTIC_SCHEMA_VERSION = '1.0.0';

export type CrypticViewId =
  | 'overview'
  | 'instant-miner'
  | 'instant-solver'
  | 'continuous'
  | 'federated'
  | 'registry'
  | 'four-lane'
  | 'live-graphing'
  | 'clock-timing'
  | 'receipt-ledger'
  | 'reward-accounting'
  | 'stripe-connect'
  | 'audit-diagnostics'
  | 'settings'
  | 'memory-convergence';

export type RbacRole =
  | 'VIEWER'
  | 'OPERATOR'
  | 'ENGINEER'
  | 'ACCOUNTING'
  | 'ADMINISTRATOR';

export interface RbacSession {
  readonly sessionId: string;
  readonly actorId: string;
  readonly role: RbacRole;
  readonly permissions: readonly string[];
  readonly issuedAtUtc: string;
}

export type TelemetryQuality =
  | 'MEASURED'
  | 'DERIVED'
  | 'HISTORICAL_IMPORTED'
  | 'ESTIMATED'
  | 'UNAVAILABLE';

export interface ProvenanceMetric<T = number> {
  readonly metricId: string;
  readonly label: string;
  readonly value: T | null;
  readonly unit: string;
  readonly quality: TelemetryQuality;
  readonly dataSource: string;
  readonly sampledAtMonotonicNs: string;
  readonly sampledAtUtc: string;
  readonly collectionIntervalMs: number;
  readonly missingReason?: string;
}

export type AlgorithmCategory =
  | 'CRYPTOGRAPHIC_COMPUTATION'
  | 'REVERSIBLE_ARITHMETIC'
  | 'ERROR_CORRECTION'
  | 'NUMERICAL_COMPUTING'
  | 'DISTRIBUTED_COMPUTATION'
  | 'VERIFICATION'
  | 'GRAPHING_AND_ANALYSIS';

export type SolverOperationType =
  | 'EXACT_INVERSE_RECONSTRUCTION'
  | 'CANDIDATE_SEARCH'
  | 'ERROR_CORRECTION'
  | 'STATISTICAL_ESTIMATION'
  | 'CRYPTOGRAPHIC_DIGEST_VERIFICATION'
  | 'CONSENSUS_TARGET_VALIDATION'
  | 'SYMBOLIC_ALGEBRAIC_VERIFICATION';

export interface AlgorithmRegistryEntry {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly category: AlgorithmCategory;
  readonly operationType: SolverOperationType;
  readonly isInvertible: boolean;
  readonly isOneWayHash: boolean;
  readonly isPowAlgorithm: boolean;
  readonly inputSchema: string;
  readonly outputSchema: string;
  readonly dependencies: readonly string[];
  readonly supportedEnvironments: readonly ('NODE_SERVER' | 'WEB_WORKER' | 'BROWSER_MAIN')[];
  readonly requiredPrecision: string;
  readonly knownLimitations: string;
  readonly capabilityRequirements: readonly string[];
}

export interface AlgorithmSelfTestResult {
  readonly algorithmId: string;
  readonly version: string;
  readonly passed: boolean;
  readonly vectorName: string;
  readonly expectedOutput: string;
  readonly actualOutput: string;
  readonly durationNs: string;
  readonly testedAtUtc: string;
}

export type JobExecutionState =
  | 'CREATED'
  | 'RUNNING'
  | 'PAUSED'
  | 'STOPPED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'VERIFIED'
  | 'FAILED';

export type VerificationOutcome =
  | 'VERIFIED'
  | 'VERIFIED_WITH_CORRECTION'
  | 'UNRESOLVED'
  | 'REJECTED'
  | 'INCOMPLETE'
  | 'LATE';

export interface InstantMinerJobConfig {
  readonly algorithmId: string;
  readonly networkId: string;
  readonly inputPayload: string;
  readonly targetLeadingZeroHexDigits: number;
  readonly maxIterations: number;
  readonly budgetNs: number;
  readonly startNonce: number;
}

export interface InstantMinerSession {
  readonly jobId: string;
  readonly schemaVersion: string;
  readonly config: InstantMinerJobConfig;
  readonly state: JobExecutionState;
  readonly completedOperations: number;
  readonly hashCalls: number;
  readonly candidateCount: number;
  readonly validCandidates: number;
  readonly bytesProcessed: number;
  readonly elapsedNs: string;
  readonly opsPerSec: number;
  readonly hashesPerSec: number;
  readonly avgLatencyNs: number;
  readonly p95LatencyNs: number;
  readonly bestDigestHex: string | null;
  readonly bestNonce: number | null;
  readonly verificationOutcome: VerificationOutcome;
  readonly receiptId: string | null;
  readonly createdAtUtc: string;
  readonly updatedAtUtc: string;
}

export interface InstantSolverRequest {
  readonly algorithmId: string;
  readonly mode: 'FORWARD' | 'INVERSE' | 'ROUNDTRIP_VERIFY' | 'ERROR_CORRECT' | 'SYMBOLIC_CHECK';
  readonly inputData: string;
  readonly injectedErrorPositions?: readonly number[];
  readonly parameters?: Record<string, string | number | boolean>;
  readonly executionBudgetMs?: number;
}

export interface InstantSolverResult {
  readonly solveId: string;
  readonly schemaVersion: string;
  readonly algorithmId: string;
  readonly algorithmVersion: string;
  readonly operationType: SolverOperationType;
  readonly mode: InstantSolverRequest['mode'];
  readonly forwardOutput: string;
  readonly inverseOutput: string | null;
  readonly roundtripMatched: boolean | null;
  readonly residual: number;
  readonly syndromeBefore: number | null;
  readonly syndromeAfter: number | null;
  readonly correctedErrorsCount: number;
  readonly verificationOutcome: VerificationOutcome;
  readonly elapsedNs: string;
  readonly monotonicStartNs: string;
  readonly monotonicEndNs: string;
  readonly utcTimestamp: string;
  readonly receiptId: string;
  readonly limitationNotice?: string;
}

export type ContinuousWorkerState =
  | 'INITIALIZING'
  | 'READY'
  | 'RUNNING'
  | 'PAUSED'
  | 'VERIFYING'
  | 'CHECKPOINTING'
  | 'DEGRADED'
  | 'RECOVERING'
  | 'STOPPED'
  | 'FAILED';

export interface ContinuousWorkerRecord {
  readonly workerId: string;
  readonly label: string;
  readonly epochId: string;
  readonly algorithmId: string;
  readonly networkId: string;
  readonly state: ContinuousWorkerState;
  readonly nonceRangeStart: number;
  readonly nonceRangeEnd: number;
  readonly currentCursor: number;
  readonly leaseId: string;
  readonly leaseExpiresAtMs: number;
  readonly heartbeatAtMs: number;
  readonly heartbeatAgeMs: number;
  readonly lastCheckpointAtMs: number | null;
  readonly completedOperations: number;
  readonly completedBytes: number;
  readonly hashCalls: number;
  readonly validCandidates: number;
  readonly verificationFailures: number;
  readonly missedDeadlines: number;
  readonly queueDepth: number;
  readonly backpressureActive: boolean;
  readonly measuredOpsPerSec: number;
  readonly cpuUserMicros: number | null;
  readonly memoryRssBytes: number | null;
  readonly lastVerifiedReceiptId: string | null;
  readonly failureReason: string | null;
  readonly updatedAtUtc: string;
}

export interface WorkerTransitionEvent {
  readonly id: string;
  readonly workerId: string;
  readonly fromState: ContinuousWorkerState | 'NONE';
  readonly toState: ContinuousWorkerState;
  readonly reason: string;
  readonly monotonicNs: string;
  readonly utcTimestamp: string;
}

export interface MiningNetworkProfile {
  readonly networkId: string;
  readonly name: string;
  readonly consensusType: 'POW' | 'POS_NON_MINABLE' | 'BENCHMARK_LOCAL';
  readonly powAlgorithmId: string | null;
  readonly targetFormat: string;
  readonly minableByCoordinator: boolean;
  readonly note: string;
}

export interface StratumJobRecord {
  readonly stratumJobId: string;
  readonly networkId: string;
  readonly algorithmId: string;
  readonly prevHashHex: string;
  readonly headerTemplateHex: string;
  readonly extranonce1Hex: string;
  readonly difficultyZeroNibbles: number;
  readonly cleanJobs: boolean;
  readonly createdAtUtc: string;
}

export interface StratumShareSubmissionRecord {
  readonly shareId: string;
  readonly workerId: string;
  readonly jobId: string;
  readonly extranonce2Hex: string;
  readonly ntimeHex: string;
  readonly nonceHex: string;
  readonly candidateDigestHex: string;
  readonly meetsTarget: boolean;
  readonly isDuplicate: boolean;
  readonly poolAccepted: boolean;
  readonly poolRejectReason: string | null;
  readonly poolRttNs: string;
  readonly receiptId: string;
  readonly submittedAtUtc: string;
}

export interface StratumTransportStatus {
  readonly serverListening: boolean;
  readonly serverHost: string;
  readonly serverPort: number;
  readonly serverActiveClients: number;
  readonly serverActiveJobId: string | null;
  readonly serverAcceptedShares: number;
  readonly serverRejectedShares: number;
  readonly clientConnected: boolean;
  readonly clientTargetHost: string | null;
  readonly clientTargetPort: number | null;
  readonly clientSubscribed: boolean;
  readonly clientAuthorizedWorker: string | null;
  readonly clientExtranonce1: string | null;
  readonly clientDifficulty: number;
  readonly lastClientRttMs: number | null;
  readonly lastClientError: string | null;
}

export interface WebRtcIceConfig {
  readonly stunUrls: readonly string[];
  readonly turnConfigured: boolean;
  readonly turnUrl: string | null;
  readonly turnUsername: string | null;
  readonly iceTransportPolicy: 'all' | 'relay';
}

export interface WebRtcPeerRecord {
  readonly peerId: string;
  readonly label: string;
  readonly connectionState: string;
  readonly dataChannelState: string;
  readonly selectedCandidateType: string;
  readonly roundTripTimeMs: number | null;
  readonly bytesTransferred: number;
  readonly lastSyncUtc: string;
}

export interface RtpClockSyncFrame {
  readonly ssrc: string;
  readonly sequenceNumber: number;
  readonly rtpTimestamp90k: number;
  readonly serverMonotonicNs: string;
  readonly serverUtcMs: number;
  readonly interarrivalJitterUs: number;
}

export type ReceiptLifecycleState =
  | 'CREATED'
  | 'COMPUTATION_COMPLETE'
  | 'LOCALLY_VERIFIED'
  | 'SUBMITTED'
  | 'POOL_ACKNOWLEDGED'
  | 'SHARE_ACCEPTED'
  | 'REWARD_PENDING'
  | 'REWARD_CONFIRMED'
  | 'SETTLEMENT_ELIGIBLE'
  | 'SETTLED'
  | 'REJECTED'
  | 'DISPUTED'
  | 'REVERSED';

export interface ReceiptTransitionLog {
  readonly transitionId: string;
  readonly receiptId: string;
  readonly fromState: ReceiptLifecycleState | 'NONE';
  readonly toState: ReceiptLifecycleState;
  readonly actorRole: RbacRole;
  readonly note: string;
  readonly monotonicNs: string;
  readonly utcTimestamp: string;
}

export interface ClearedReceiptRecord {
  readonly receiptId: string;
  readonly schemaVersion: string;
  readonly jobId: string;
  readonly workerId: string;
  readonly epochId: string;
  readonly algorithmId: string;
  readonly algorithmVersion: string;
  readonly inputDigestSha256: string;
  readonly outputDigestSha256: string;
  readonly targetSpec: string;
  readonly candidateResult: string;
  readonly sequenceNumber: number;
  readonly parentReceiptId: string | null;
  readonly parentReceiptDigest: string | null;
  readonly monotonicStartNs: string;
  readonly monotonicEndNs: string;
  readonly utcCorrelatedTimestamp: string;
  readonly clockUncertaintyNs: number;
  readonly actualOperationCount: number;
  readonly actualHashCount: number;
  readonly verificationOutcome: VerificationOutcome;
  readonly protocolSubmissionResponse: string | null;
  readonly poolAcknowledgement: string | null;
  readonly rewardAccountingRef: string | null;
  readonly lifecycleState: ReceiptLifecycleState;
  readonly canonicalDigestSha256: string;
  readonly createdAtUtc: string;
  readonly updatedAtUtc: string;
}

export interface RewardAccountingEntry {
  readonly entryId: string;
  readonly receiptId: string;
  readonly jobId: string;
  readonly workerId: string;
  readonly entryType: 'ESTIMATED' | 'CONFIRMED' | 'SETTLED_DEBIT' | 'REVERSED';
  readonly currency: string;
  readonly amount: number;
  readonly idempotencyKey: string;
  readonly feeAmount: number;
  readonly netAmount: number;
  readonly note: string;
  readonly createdAtUtc: string;
}

export interface RewardBalancesSummary {
  readonly estimatedPendingUsd: number;
  readonly confirmedAvailableUsd: number;
  readonly settledLifetimeUsd: number;
  readonly reversedTotalUsd: number;
  readonly confirmedEntryCount: number;
  readonly estimatedEntryCount: number;
}

export interface StripeCapabilitiesStatus {
  readonly configured: boolean;
  readonly mode: 'UNCONFIGURED' | 'TEST_MODE' | 'LIVE_DISABLED_COMPLIANCE';
  readonly liveMoneyDisabled: boolean;
  readonly missingCredentials: readonly string[];
  readonly connectedAccountId: string | null;
  readonly payoutsEnabled: boolean;
  readonly chargesEnabled: boolean;
  readonly defaultCurrency: string | null;
  readonly supportedFiatCurrencies: readonly string[];
  readonly eligibilityChecklist: {
    readonly adultOperatedEntityConfirmed: boolean;
    readonly stripeSecretConfigured: boolean;
    readonly webhookSecretConfigured: boolean;
    readonly connectedAccountEligible: boolean;
    readonly liveSettlementAuthorized: boolean;
  };
  readonly lastCheckedUtc: string;
  readonly diagnosticMessage: string;
}

export interface StripePayoutRecord {
  readonly payoutId: string;
  readonly stripePayoutId: string | null;
  readonly idempotencyKey: string;
  readonly actorRole: RbacRole;
  readonly rewardEntryId: string | null;
  readonly currency: string;
  readonly grossAmount: number;
  readonly feeAmount: number;
  readonly netAmount: number;
  readonly destinationSummary: string;
  readonly settlementRail: 'STRIPE_CONNECT_FIAT_TEST' | 'STRIPE_CONNECT_FIAT_LIVE';
  readonly status: 'PENDING_CONFIRMATION' | 'IN_TRANSIT' | 'PAID' | 'FAILED' | 'CANCELLED' | 'BLOCKED';
  readonly testMode: boolean;
  readonly webhookVerified: boolean;
  readonly failureMessage: string | null;
  readonly createdAtUtc: string;
  readonly updatedAtUtc: string;
}

export interface WolframAdapterResult {
  readonly queryId: string;
  readonly expression: string;
  readonly provider: 'LOCAL_EXACT_CAS' | 'WOLFRAM_CLOUD_API' | 'WOLFRAM_SCRIPT_CLI';
  readonly externalConfigured: boolean;
  readonly status: 'VERIFIED_LOCAL' | 'VERIFIED_WOLFRAM' | 'UNAVAILABLE';
  readonly localResult: string | null;
  readonly externalResult: string | null;
  readonly independentVerificationPassed: boolean;
  readonly durationNs: string;
  readonly diagnosticMessage: string;
  readonly timestampUtc: string;
}

export interface AuditEventRecord {
  readonly eventId: string;
  readonly actorRole: RbacRole;
  readonly action: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly outcome: 'ALLOW' | 'DENY' | 'ERROR';
  readonly detail: string;
  readonly monotonicNs: string;
  readonly utcTimestamp: string;
}

export interface AcceptanceGateTestResult {
  readonly testId: string;
  readonly gate: 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J';
  readonly title: string;
  readonly sourceVersion: string;
  readonly inputSummary: string;
  readonly expectedResult: string;
  readonly actualResult: string;
  readonly passed: boolean;
  readonly executionTimestampUtc: string;
  readonly diagnosticRef: string;
}

export interface TelemetryPoint {
  readonly seq: number;
  readonly utcTimestamp: string;
  readonly timeLabel: string;
  readonly monotonicNs: string;
  readonly instantOpsPerSec: number;
  readonly continuousWorkerOpsPerSec: number;
  readonly aggregateOpsPerSec: number;
  readonly fourLaneResidual: number;
  readonly solverConvergencePct: number;
  readonly hashLatencyUs: number;
  readonly clockJitterUs: number;
  readonly computeDurationUs: number;
  readonly validCandidates: number;
  readonly acceptedShares: number;
  readonly rejectedShares: number;
  readonly activeWorkers: number;
  readonly queueDepth: number;
  readonly verifiedReceiptsTotal: number;
  readonly confirmedRewardUsd: number;
}

export interface LiveAnalyticsBundle {
  readonly schemaVersion: string;
  readonly sampledAtUtc: string;
  readonly sampledAtMonotonicNs: string;
  readonly collectionIntervalMs: number;
  readonly series: readonly TelemetryPoint[];
  readonly provenances: Record<string, ProvenanceMetric<number | string>>;
}

export type DreamRealm = 'astral' | 'cyber' | 'abyss' | 'ethereal';

export interface DreamLogEntry {
  readonly logId: string;
  readonly dreamText: string;
  readonly archetypes: readonly string[];
  readonly lucidity: number;
  readonly intensity: number;
  readonly chaos: number;
  readonly realm: DreamRealm;
  readonly analysisText: string;
  readonly clockEpochId: string;
  readonly clockMonotonicNs: string;
  readonly createdAtUtc: string;
}

export interface DreamThemeDistributionItem {
  readonly archetype: string;
  readonly label: string;
  readonly observedCount: number;
  readonly observedPct: number;
  readonly referenceSurveyPct: number;
}

export interface CrypticPlatformSnapshot {
  readonly schemaVersion: string;
  readonly uptimeSeconds: number;
  readonly overview: {
    readonly clockState: string;
    readonly clockSource: string;
    readonly clockUncertaintyNs: number;
    readonly activeWorkers: number;
    readonly totalWorkers: number;
    readonly activeJobs: number;
    readonly aggregateOpsPerSec: number;
    readonly aggregateHashesPerSec: number;
    readonly solverStatus: VerificationOutcome | 'IDLE';
    readonly verifiedResultsCount: number;
    readonly pendingSharesCount: number;
    readonly acceptedSharesCount: number;
    readonly rejectedSharesCount: number;
    readonly balances: RewardBalancesSummary;
    readonly settlementState: StripeCapabilitiesStatus['mode'];
    readonly recentFaultsCount: number;
  };
  readonly workers: readonly ContinuousWorkerRecord[];
  readonly instantJobs: readonly InstantMinerSession[];
  readonly recentSolverResults: readonly InstantSolverResult[];
  readonly stratum: StratumTransportStatus;
  readonly recentShares: readonly StratumShareSubmissionRecord[];
  readonly receipts: readonly ClearedReceiptRecord[];
  readonly rewardEntries: readonly RewardAccountingEntry[];
  readonly stripeStatus: StripeCapabilitiesStatus;
  readonly payouts: readonly StripePayoutRecord[];
  readonly auditEvents: readonly AuditEventRecord[];
  readonly webrtcPeers: readonly WebRtcPeerRecord[];
  readonly latestRtpSync: RtpClockSyncFrame;
  readonly hostTelemetry: {
    readonly cpuUserMicros: number | null;
    readonly cpuSystemMicros: number | null;
    readonly memoryRssBytes: number;
    readonly heapUsedBytes: number;
    readonly eventLoopP99Ms: number | null;
    readonly hardwarePowerWatts: number | null;
  };
}
