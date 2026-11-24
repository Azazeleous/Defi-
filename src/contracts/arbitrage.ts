/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * =============================================================================
 * SPECIFICATION: GAIA / NEXUS — Arbitrage Engine & Market Data Contracts
 * MODULE: Versioned Interfaces for Observations, Orderbooks, Opportunities & Receipts
 * ARCHITECTURE DOCTRINE:
 *   - Boundary: Nothing executes beyond its time (Freshness TTL enforcement).
 *   - Capacity: Nothing claims capacity without measurement (Depth-integrated sizing).
 *   - Correctness: Nothing claims correctness without verification (Evaluation receipts).
 * =============================================================================
 */

export type MarketProviderId =
  | 'UNISWAP_V3_MAINNET'
  | 'CURVE_STABLE_V2'
  | 'SUSHISWAP_V1'
  | 'BINANCE_PUBLIC'
  | 'COINBASE_EXCHANGE'
  | 'KRAKEN_SPOT'
  | 'BALANCER_V2';

export type StandardTradingPair =
  | 'ETH/USDC'
  | 'BTC/USDT'
  | 'SOL/USDC'
  | 'WBTC/ETH'
  | 'ETH/USDT'
  | 'ARB/USDC';

export type OpportunityStatus =
  | 'VIABLE'
  | 'MARGINAL'
  | 'UNPROFITABLE'
  | 'STALE'
  | 'INSUFFICIENT_LIQUIDITY';

export interface CurrencyConversionIndex {
  readonly timestampUtc: string;
  readonly baseToUsd: Record<string, number>;
  readonly source: string;
  readonly confidenceScore: number; // 0.0 - 1.0
}

export interface MarketObservation {
  readonly observationId: string;
  readonly providerId: MarketProviderId;
  readonly pair: StandardTradingPair;
  readonly baseAsset: string;
  readonly quoteAsset: string;
  readonly bidPrice: number;
  readonly askPrice: number;
  readonly bidVolume: number;
  readonly askVolume: number;
  readonly timestampUtc: string;
  readonly monotonicNs: string;
  readonly sequenceNumber: number;
  readonly latencyMs: number;
  readonly isStale: boolean;
}

export interface OrderBookDepthLevel {
  readonly price: number;
  readonly size: number;
  readonly cumulativeVolume: number;
  readonly effectiveWeightedPrice: number;
}

export interface OrderBookSnapshot {
  readonly snapshotId: string;
  readonly providerId: MarketProviderId;
  readonly pair: StandardTradingPair;
  readonly bids: readonly OrderBookDepthLevel[];
  readonly asks: readonly OrderBookDepthLevel[];
  readonly timestampUtc: string;
  readonly monotonicNs: string;
  readonly maxDepthLevels: number;
  readonly spreadAbsolute: number;
  readonly spreadBps: number;
}

export interface FeeSchedule {
  readonly providerId: MarketProviderId;
  readonly makerFeeBps: number; // e.g. 5 bps = 0.05%
  readonly takerFeeBps: number; // e.g. 15 bps = 0.15%
  readonly gasUnitsEstimated: number; // e.g. 145,000 for DEX swap
  readonly gasPriceGwei: number; // e.g. 18 Gwei
  readonly networkTransferFeeUsd: number; // Fixed bridge or transfer cost
  readonly withdrawalFeeUsd: number;
}

export interface SlippageCalculationDetail {
  readonly tradeSizeBase: number;
  readonly tradeSizeUsd: number;
  readonly marginalPrice: number;
  readonly effectiveExecutionPrice: number;
  readonly slippageBps: number;
  readonly slippageLossUsd: number;
  readonly liquidityExhausted: boolean;
}

export interface CostBreakdown {
  readonly buyTakerFeeUsd: number;
  readonly sellTakerFeeUsd: number;
  readonly buySlippageLossUsd: number;
  readonly sellSlippageLossUsd: number;
  readonly networkGasCostUsd: number;
  readonly transferFeeUsd: number;
  readonly totalCostsUsd: number;
}

export interface ExplainableCalculationStep {
  readonly stepIndex: number;
  readonly stepName: string;
  readonly formula: string;
  readonly inputs: Record<string, number | string>;
  readonly outputName: string;
  readonly outputValue: number | string;
}

export interface ArbitrageOpportunityEvaluation {
  readonly opportunityId: string;
  readonly schemaVersion: 'v1.0.0-gaia-arbitrage';
  readonly evaluatedAtUtc: string;
  readonly evaluatedAtMonotonicNs: string;
  readonly pair: StandardTradingPair;
  readonly buyMarket: MarketProviderId;
  readonly sellMarket: MarketProviderId;
  readonly buyObservationId: string;
  readonly sellObservationId: string;
  readonly observationAgeMs: number;
  readonly maxFreshnessTtlMs: number;
  readonly isStale: boolean;

  // Pricing & Spreads
  readonly bestAskPriceBuyMarket: number;
  readonly bestBidPriceSellMarket: number;
  readonly grossSpreadAbsolute: number;
  readonly grossSpreadBps: number;

  // Sizing & Execution Simulation
  readonly evaluatedQuantityBase: number;
  readonly evaluatedQuantityUsd: number;
  readonly buyExecutionDetail: SlippageCalculationDetail;
  readonly sellExecutionDetail: SlippageCalculationDetail;

  // Itemized Cost Schedule
  readonly costs: CostBreakdown;

  // Net Profitability
  readonly grossProfitUsd: number;
  readonly netProfitUsd: number;
  readonly netReturnBps: number;
  readonly status: OpportunityStatus;

  // Step-by-Step Explainable Audit Trail
  readonly calculationSteps: readonly ExplainableCalculationStep[];

  // Deterministic Cryptographic Evaluation Receipt
  readonly evaluationReceiptHash: string;
  readonly inputObservationHash: string;
}

export interface PaperEvaluationReceipt {
  readonly receiptId: string;
  readonly opportunityId: string;
  readonly evaluatedAtUtc: string;
  readonly pair: StandardTradingPair;
  readonly buyMarket: MarketProviderId;
  readonly sellMarket: MarketProviderId;
  readonly quantityBase: number;
  readonly grossProfitUsd: number;
  readonly totalCostsUsd: number;
  readonly netProfitUsd: number;
  readonly netReturnPct: number;
  readonly executionStatus: 'PAPER_VERIFIED' | 'REJECTED_UNPROFITABLE' | 'REJECTED_STALE';
  readonly deterministicVerificationDigest: string;
  readonly signerEnclaveId: string;
}
