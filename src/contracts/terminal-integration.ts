/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * =============================================================================
 * SPECIFICATION: GAIA / NEXUS — Multiplexed Accessibility Terminal Integration Contracts
 * MODULE: System Boundary Interfaces & Typed Event Envelopes
 * =============================================================================
 */

import {
  StandardTradingPair,
  MarketObservation,
  OrderBookSnapshot,
  ArbitrageOpportunityEvaluation,
  PaperEvaluationReceipt,
  MarketProviderId,
} from './arbitrage';

import {
  UnifiedMiningProfileId,
  MiningTelemetryReceipt,
  MiningProviderStatus,
} from './mining-profiles';

import { MfaUserAccountSecurity } from '../services/mfaAuthService';

/**
 * Standardized Terminal Event Envelope
 * Designed for reliable IPC, WebSocket dispatch, and accessibility screen-reader streaming.
 */
export interface TerminalEventEnvelope<T = unknown> {
  readonly eventId: string;
  readonly schemaVersion: 'v1.0.0-terminal-ipc';
  readonly topic:
    | 'telemetry:mining:receipt'
    | 'telemetry:mining:status'
    | 'market:observation:tick'
    | 'market:orderbook:update'
    | 'arbitrage:opportunity:evaluated'
    | 'arbitrage:paper:executed'
    | 'security:mfa:challenge'
    | 'ledger:checkpoint:saved';
  readonly sourceSubsystem:
    | 'MINING_ENGINE'
    | 'MARKET_DATA_ROUTER'
    | 'ARBITRAGE_EVALUATOR'
    | 'SECURITY_MFA_ENCLAVE'
    | 'SQLITE_LEDGER_PERSISTENCE';
  readonly monotonicNs: string;
  readonly timestampUtc: string;
  readonly payload: T;
  readonly verificationSignatureSha256: string;
}

export interface MiningMiningJobConfig {
  readonly profileId: UnifiedMiningProfileId;
  readonly targetLeadingZeroNibbles: number;
  readonly maxIterations: number;
  readonly workerCount: number;
}

export interface IMiningService {
  startMining(config: MiningMiningJobConfig): Promise<{ success: boolean; workerId: string }>;
  stopMining(): Promise<{ success: boolean }>;
  getStatus(): { status: MiningProviderStatus; activeProfile: UnifiedMiningProfileId | null; workerCount: number };
  getLatestReceipt(): MiningTelemetryReceipt | null;
  subscribeReceipts(listener: (receipt: MiningTelemetryReceipt) => void): () => void;
}

export interface IMarketDataService {
  getLatestObservations(pair?: StandardTradingPair): MarketObservation[];
  getOrderBook(providerId: MarketProviderId, pair: StandardTradingPair): OrderBookSnapshot | null;
  registerProvider(providerId: MarketProviderId): void;
  getProviderHealth(): Record<MarketProviderId, { available: boolean; latencyMs: number; lastSeenUtc: string }>;
  subscribeObservations(listener: (obs: MarketObservation) => void): () => void;
}

export interface IArbitrageEvaluationService {
  evaluatePair(pair: StandardTradingPair, tradeSizeBase: number): ArbitrageOpportunityEvaluation[];
  evaluateAllOpportunities(defaultSizeBase?: number): ArbitrageOpportunityEvaluation[];
  executePaperTrade(opportunityId: string): Promise<PaperEvaluationReceipt>;
  getOpportunityHistory(limit?: number): ArbitrageOpportunityEvaluation[];
  getPaperReceipts(limit?: number): PaperEvaluationReceipt[];
}

export interface IAnalyticsService {
  getMiningThroughputTimeSeries(range: '1H' | '24H' | '7D' | '30D'): Array<{ timestamp: string; hashesPerSecond: number; attempts: number; verified: number }>;
  getArbitrageSpreadTimeSeries(pair: StandardTradingPair, range: '1H' | '24H' | '7D' | '30D'): Array<{ timestamp: string; grossSpreadBps: number; netReturnBps: number; costsUsd: number }>;
  generateExportableAuditReport(category: 'MINING' | 'ARBITRAGE' | 'FULL_COMPLIANCE'): Promise<{ jsonDump: string; csvDump: string; hashDigest: string }>;
}

export interface IAuthenticationService {
  getSecurityStatus(): MfaUserAccountSecurity;
  verifyMfaChallenge(token: string, method: 'APP' | 'SMS' | 'BACKUP'): { success: boolean; method: string; error?: string };
}

export interface IPersistenceService {
  saveMiningReceipt(receipt: MiningTelemetryReceipt): void;
  saveArbitrageEvaluation(evalResult: ArbitrageOpportunityEvaluation): void;
  savePaperReceipt(paperReceipt: PaperEvaluationReceipt): void;
  verifyLedgerIntegrity(): { isValid: boolean; uncorruptedRowsCount: number; lastHash: string };
}
