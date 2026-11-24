/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * =============================================================================
 * SPECIFICATION: GAIA / NEXUS — Modular Arbitrage Engine & Exchange Adapter Pattern
 * MODULE: Standardized Input Adapters, Orderbook Depth Processing & Evaluation
 * =============================================================================
 */

import crypto from 'node:crypto';
import {
  StandardTradingPair,
  MarketProviderId,
  ArbitrageOpportunityEvaluation,
  PaperEvaluationReceipt,
  ExplainableCalculationStep,
  CostBreakdown,
  SlippageCalculationDetail,
  OpportunityStatus,
  OrderBookSnapshot,
  OrderBookDepthLevel,
  MarketObservation,
} from '../../contracts/arbitrage';
import { globalMarketDataRouter } from './marketDataProviders';
import { CANONICAL_FEE_SCHEDULES, calculateGasCostUsd } from './feeSchedules';
import { globalSqliteLedger } from '../sqliteLedgerStore';

// ============================================================================
// 1. MODULAR EXCHANGE ADAPTER PATTERN INTERFACES & CLASSES
// ============================================================================

export interface IExchangeAdapter {
  getProviderId(): MarketProviderId;
  fetchNormalizedObservation(pair: StandardTradingPair): MarketObservation | null;
  fetchNormalizedOrderBook(pair: StandardTradingPair): OrderBookSnapshot | null;
  isHealthy(): boolean;
}

export abstract class BaseExchangeAdapter implements IExchangeAdapter {
  protected providerId: MarketProviderId;

  constructor(providerId: MarketProviderId) {
    this.providerId = providerId;
  }

  public getProviderId(): MarketProviderId {
    return this.providerId;
  }

  public fetchNormalizedObservation(pair: StandardTradingPair): MarketObservation | null {
    try {
      const obs = globalMarketDataRouter.getObservation(this.providerId, pair, 5000);
      if (!obs || obs.isStale) return null;
      return obs;
    } catch {
      return null;
    }
  }

  public fetchNormalizedOrderBook(pair: StandardTradingPair): OrderBookSnapshot | null {
    try {
      const book = globalMarketDataRouter.getOrderBook(this.providerId, pair);
      return book || null;
    } catch {
      return null;
    }
  }

  public isHealthy(): boolean {
    const health = globalMarketDataRouter.getProviderHealth()[this.providerId];
    return health ? health.isOnline && health.successRatePct > 95 : true;
  }
}

export class UniswapV3ExchangeAdapter extends BaseExchangeAdapter {
  constructor() { super('UNISWAP_V3_MAINNET'); }
}

export class CurveExchangeAdapter extends BaseExchangeAdapter {
  constructor() { super('CURVE_STABLE_V2'); }
}

export class SushiSwapExchangeAdapter extends BaseExchangeAdapter {
  constructor() { super('SUSHISWAP_V1'); }
}

export class BinanceExchangeAdapter extends BaseExchangeAdapter {
  constructor() { super('BINANCE_PUBLIC'); }
}

export class CoinbaseExchangeAdapter extends BaseExchangeAdapter {
  constructor() { super('COINBASE_EXCHANGE'); }
}

export class KrakenExchangeAdapter extends BaseExchangeAdapter {
  constructor() { super('KRAKEN_SPOT'); }
}

export class BalancerExchangeAdapter extends BaseExchangeAdapter {
  constructor() { super('BALANCER_V2'); }
}

export class ExchangeAdapterRegistry {
  private static instance: ExchangeAdapterRegistry;
  private adapters = new Map<MarketProviderId, IExchangeAdapter>();

  private constructor() {
    this.registerDefaults();
  }

  public static getInstance(): ExchangeAdapterRegistry {
    if (!ExchangeAdapterRegistry.instance) {
      ExchangeAdapterRegistry.instance = new ExchangeAdapterRegistry();
    }
    return ExchangeAdapterRegistry.instance;
  }

  private registerDefaults(): void {
    this.register(new UniswapV3ExchangeAdapter());
    this.register(new CurveExchangeAdapter());
    this.register(new SushiSwapExchangeAdapter());
    this.register(new BinanceExchangeAdapter());
    this.register(new CoinbaseExchangeAdapter());
    this.register(new KrakenExchangeAdapter());
    this.register(new BalancerExchangeAdapter());
  }

  public register(adapter: IExchangeAdapter): void {
    this.adapters.set(adapter.getProviderId(), adapter);
  }

  public getAdapter(providerId: MarketProviderId): IExchangeAdapter | undefined {
    return this.adapters.get(providerId);
  }

  public getAllProviders(): MarketProviderId[] {
    return Array.from(this.adapters.keys());
  }
}

export const globalExchangeRegistry = ExchangeAdapterRegistry.getInstance();

// ============================================================================
// 2. MODULAR ARBITRAGE ENGINE
// ============================================================================

export class ModularArbitrageEngine {
  private static instance: ModularArbitrageEngine;
  private opportunityHistory: ArbitrageOpportunityEvaluation[] = [];
  private paperReceipts: PaperEvaluationReceipt[] = [];
  private readonly maxFreshnessTtlMs = 5000;
  private ethUsdPrice = 3420.50;

  private constructor() {}

  public static getInstance(): ModularArbitrageEngine {
    if (!ModularArbitrageEngine.instance) {
      ModularArbitrageEngine.instance = new ModularArbitrageEngine();
    }
    return ModularArbitrageEngine.instance;
  }

  /**
   * Computes effective execution price and slippage loss by integrating order-book depth levels.
   */
  public calculateEffectiveExecution(
    bookLevels: readonly OrderBookDepthLevel[],
    targetQuantityBase: number,
    side: 'BUY' | 'SELL'
  ): SlippageCalculationDetail {
    if (!bookLevels || bookLevels.length === 0) {
      return {
        tradeSizeBase: targetQuantityBase,
        tradeSizeUsd: 0,
        marginalPrice: 0,
        effectiveExecutionPrice: 0,
        slippageBps: 0,
        slippageLossUsd: 0,
        liquidityExhausted: true,
      };
    }

    let remainingQty = targetQuantityBase;
    let totalCostUsd = 0;
    const topOfBookPrice = bookLevels[0].price;

    for (const level of bookLevels) {
      const takeQty = Math.min(remainingQty, level.size);
      totalCostUsd += takeQty * level.price;
      remainingQty -= takeQty;
      if (remainingQty <= 1e-9) break;
    }

    const liquidityExhausted = remainingQty > 1e-9;
    const fulfilledQty = targetQuantityBase - remainingQty;
    const effectivePrice = fulfilledQty > 0 ? totalCostUsd / fulfilledQty : topOfBookPrice;

    let slippageBps = 0;
    let slippageLossUsd = 0;

    if (side === 'BUY') {
      slippageBps = Math.max(0, +(((effectivePrice - topOfBookPrice) / topOfBookPrice) * 10000).toFixed(2));
      slippageLossUsd = Math.max(0, +(fulfilledQty * (effectivePrice - topOfBookPrice)).toFixed(4));
    } else {
      slippageBps = Math.max(0, +(((topOfBookPrice - effectivePrice) / topOfBookPrice) * 10000).toFixed(2));
      slippageLossUsd = Math.max(0, +(fulfilledQty * (topOfBookPrice - effectivePrice)).toFixed(4));
    }

    return {
      tradeSizeBase: targetQuantityBase,
      tradeSizeUsd: +(targetQuantityBase * effectivePrice).toFixed(2),
      marginalPrice: topOfBookPrice,
      effectiveExecutionPrice: +effectivePrice.toFixed(4),
      slippageBps,
      slippageLossUsd,
      liquidityExhausted,
    };
  }

  /**
   * Evaluates arbitrage across two exchange adapters for a given pair.
   */
  public evaluatePairCrossMarket(
    pair: StandardTradingPair,
    buyMarket: MarketProviderId,
    sellMarket: MarketProviderId,
    quantityBase: number = 2.5
  ): ArbitrageOpportunityEvaluation | null {
    if (buyMarket === sellMarket) return null;

    const registry = globalExchangeRegistry;
    const buyAdapter = registry.getAdapter(buyMarket);
    const sellAdapter = registry.getAdapter(sellMarket);

    if (!buyAdapter || !sellAdapter) return null;
    if (!buyAdapter.isHealthy() || !sellAdapter.isHealthy()) return null;

    const buyObs = buyAdapter.fetchNormalizedObservation(pair);
    const sellObs = sellAdapter.fetchNormalizedObservation(pair);

    if (!buyObs || !sellObs) return null;

    const buyBook = buyAdapter.fetchNormalizedOrderBook(pair);
    const sellBook = sellAdapter.fetchNormalizedOrderBook(pair);

    if (!buyBook || !sellBook) return null;

    const now = Date.now();
    const evaluatedAtUtc = new Date(now).toISOString();
    const evaluatedAtMonotonicNs = (typeof process !== 'undefined' && process.hrtime)
      ? process.hrtime.bigint().toString()
      : (now * 1000000).toString();

    const buyAgeMs = now - new Date(buyObs.timestampUtc).getTime();
    const sellAgeMs = now - new Date(sellObs.timestampUtc).getTime();
    const observationAgeMs = Math.max(buyAgeMs, sellAgeMs);
    const isStale = observationAgeMs > this.maxFreshnessTtlMs || buyObs.isStale || sellObs.isStale;

    const bestAskBuy = buyObs.askPrice;
    const bestBidSell = sellObs.bidPrice;
    const grossSpreadAbsolute = +(bestBidSell - bestAskBuy).toFixed(4);
    const grossSpreadBps = +(((bestBidSell - bestAskBuy) / bestAskBuy) * 10000).toFixed(2);

    const buyExec = this.calculateEffectiveExecution(buyBook.asks, quantityBase, 'BUY');
    const sellExec = this.calculateEffectiveExecution(sellBook.bids, quantityBase, 'SELL');

    const buyFeeSched = CANONICAL_FEE_SCHEDULES[buyMarket];
    const sellFeeSched = CANONICAL_FEE_SCHEDULES[sellMarket];

    const capitalRequiredUsd = +(quantityBase * buyExec.effectiveExecutionPrice).toFixed(2);
    const proceedsUsd = +(quantityBase * sellExec.effectiveExecutionPrice).toFixed(2);

    const buyTakerFeeUsd = +((capitalRequiredUsd * buyFeeSched.takerFeeBps) / 10000).toFixed(4);
    const sellTakerFeeUsd = +((proceedsUsd * sellFeeSched.takerFeeBps) / 10000).toFixed(4);

    const buyGasUsd = calculateGasCostUsd(buyFeeSched.gasUnitsEstimated, buyFeeSched.gasPriceGwei, this.ethUsdPrice);
    const sellGasUsd = calculateGasCostUsd(sellFeeSched.gasUnitsEstimated, sellFeeSched.gasPriceGwei, this.ethUsdPrice);
    const networkGasCostUsd = +(buyGasUsd + sellGasUsd).toFixed(4);

    const transferFeeUsd = +(buyFeeSched.networkTransferFeeUsd + sellFeeSched.withdrawalFeeUsd).toFixed(4);

    const costs: CostBreakdown = {
      buyTakerFeeUsd,
      sellTakerFeeUsd,
      buySlippageLossUsd: buyExec.slippageLossUsd,
      sellSlippageLossUsd: sellExec.slippageLossUsd,
      networkGasCostUsd,
      transferFeeUsd,
      totalCostsUsd: +(
        buyTakerFeeUsd +
        sellTakerFeeUsd +
        buyExec.slippageLossUsd +
        sellExec.slippageLossUsd +
        networkGasCostUsd +
        transferFeeUsd
      ).toFixed(4),
    };

    const grossProfitUsd = +(quantityBase * grossSpreadAbsolute).toFixed(4);
    const netProfitUsd = +(proceedsUsd - capitalRequiredUsd - costs.totalCostsUsd).toFixed(4);
    const netReturnBps = capitalRequiredUsd > 0
      ? +((netProfitUsd / capitalRequiredUsd) * 10000).toFixed(2)
      : 0;

    let status: OpportunityStatus = 'UNPROFITABLE';
    if (isStale) {
      status = 'STALE';
    } else if (buyExec.liquidityExhausted || sellExec.liquidityExhausted) {
      status = 'INSUFFICIENT_LIQUIDITY';
    } else if (netProfitUsd > 10.0 && netReturnBps >= 15) {
      status = 'VIABLE';
    } else if (netProfitUsd > 0) {
      status = 'MARGINAL';
    }

    const calculationSteps: ExplainableCalculationStep[] = [
      {
        stepIndex: 1,
        stepName: 'Adapter Observation Normalization & Match',
        formula: 'Spread_Gross = Bid_Sell - Ask_Buy',
        inputs: { Ask_Buy: bestAskBuy, Bid_Sell: bestBidSell, BuyAdapter: buyMarket, SellAdapter: sellMarket },
        outputName: 'Spread_Gross_Absolute',
        outputValue: grossSpreadAbsolute,
      },
      {
        stepIndex: 2,
        stepName: 'Order Book Depth Integration',
        formula: 'P_effective = sum(P_i * Q_i) / Q_total',
        inputs: { Quantity: quantityBase, BuyEffectivePrice: buyExec.effectiveExecutionPrice, SellEffectivePrice: sellExec.effectiveExecutionPrice },
        outputName: 'EffectiveSpread',
        outputValue: +(sellExec.effectiveExecutionPrice - buyExec.effectiveExecutionPrice).toFixed(4),
      },
      {
        stepIndex: 3,
        stepName: 'Cost Itemization Schedule',
        formula: 'TotalCosts = Fees + Slippage + Gas + Transfer',
        inputs: { TakerFeesUsd: +(buyTakerFeeUsd + sellTakerFeeUsd).toFixed(2), GasCostUsd: networkGasCostUsd },
        outputName: 'TotalCostsUsd',
        outputValue: costs.totalCostsUsd,
      },
      {
        stepIndex: 4,
        stepName: 'Net Profit & Capital Return Evaluation',
        formula: 'NetProfit = Proceeds - Capital - Costs',
        inputs: { CapitalUsd: capitalRequiredUsd, ProceedsUsd: proceedsUsd, CostsUsd: costs.totalCostsUsd },
        outputName: 'NetProfitUsd',
        outputValue: netProfitUsd,
      },
    ];

    const inputObservationHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ buyObsId: buyObs.observationId, sellObsId: sellObs.observationId, quantityBase }))
      .digest('hex');

    const evaluationReceiptHash = crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          inputObservationHash,
          pair,
          buyMarket,
          sellMarket,
          netProfitUsd,
          evaluatedAtMonotonicNs,
        })
      )
      .digest('hex');

    const opportunityId = `opp_${pair.replace('/', '_')}_${buyMarket}_${sellMarket}_${now.toString(36)}`;

    const opportunity: ArbitrageOpportunityEvaluation = {
      opportunityId,
      schemaVersion: 'v1.0.0-gaia-arbitrage',
      evaluatedAtUtc,
      evaluatedAtMonotonicNs,
      pair,
      buyMarket,
      sellMarket,
      buyObservationId: buyObs.observationId,
      sellObservationId: sellObs.observationId,
      observationAgeMs,
      maxFreshnessTtlMs: this.maxFreshnessTtlMs,
      isStale,
      bestAskPriceBuyMarket: bestAskBuy,
      bestBidPriceSellMarket: bestBidSell,
      grossSpreadAbsolute,
      grossSpreadBps,
      evaluatedQuantityBase: quantityBase,
      evaluatedQuantityUsd: capitalRequiredUsd,
      buyExecutionDetail: buyExec,
      sellExecutionDetail: sellExec,
      costs,
      grossProfitUsd,
      netProfitUsd,
      netReturnBps,
      status,
      calculationSteps,
      evaluationReceiptHash,
      inputObservationHash,
    };

    this.opportunityHistory.unshift(opportunity);
    if (this.opportunityHistory.length > 200) {
      this.opportunityHistory.pop();
    }

    try {
      globalSqliteLedger.saveArbitrageEvaluation(opportunity);
    } catch {
      // Safe fallback
    }

    return opportunity;
  }

  public evaluateAllOpportunities(defaultQuantityBase: number = 2.0): ArbitrageOpportunityEvaluation[] {
    const pairs: StandardTradingPair[] = ['ETH/USDC', 'BTC/USDT', 'SOL/USDC', 'WBTC/ETH'];
    const providers = globalExchangeRegistry.getAllProviders();

    const results: ArbitrageOpportunityEvaluation[] = [];

    for (const pair of pairs) {
      for (let i = 0; i < providers.length; i++) {
        for (let j = 0; j < providers.length; j++) {
          if (i === j) continue;
          const opp = this.evaluatePairCrossMarket(pair, providers[i], providers[j], defaultQuantityBase);
          if (opp) {
            results.push(opp);
          }
        }
      }
    }

    results.sort((a, b) => {
      if (a.status === 'VIABLE' && b.status !== 'VIABLE') return -1;
      if (a.status !== 'VIABLE' && b.status === 'VIABLE') return 1;
      return b.netProfitUsd - a.netProfitUsd;
    });

    return results;
  }

  public executePaperTrade(opportunityId: string): PaperEvaluationReceipt {
    const opp = this.opportunityHistory.find((o) => o.opportunityId === opportunityId);
    if (!opp) {
      throw new Error(`Opportunity ID not found: ${opportunityId}`);
    }

    const receiptId = `rcpt_paper_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
    const digest = crypto
      .createHash('sha256')
      .update(JSON.stringify({ receiptId, oppHash: opp.evaluationReceiptHash, netProfit: opp.netProfitUsd }))
      .digest('hex');

    const executionStatus =
      opp.status === 'VIABLE' || opp.status === 'MARGINAL'
        ? 'PAPER_VERIFIED'
        : opp.status === 'STALE'
        ? 'REJECTED_STALE'
        : 'REJECTED_UNPROFITABLE';

    const receipt: PaperEvaluationReceipt = {
      receiptId,
      opportunityId: opp.opportunityId,
      evaluatedAtUtc: new Date().toISOString(),
      pair: opp.pair,
      buyMarket: opp.buyMarket,
      sellMarket: opp.sellMarket,
      quantityBase: opp.evaluatedQuantityBase,
      grossProfitUsd: opp.grossProfitUsd,
      totalCostsUsd: opp.costs.totalCostsUsd,
      netProfitUsd: opp.netProfitUsd,
      netReturnPct: +(opp.netReturnBps / 100).toFixed(2),
      executionStatus,
      deterministicVerificationDigest: digest,
      signerEnclaveId: 'gaia-nexus-eval-signer-v1',
    };

    this.paperReceipts.unshift(receipt);
    if (this.paperReceipts.length > 100) {
      this.paperReceipts.pop();
    }

    try {
      globalSqliteLedger.savePaperArbitrageReceipt(receipt);
    } catch {
      // Safe fallback
    }

    return receipt;
  }

  public getOpportunityHistory(limit: number = 50): ArbitrageOpportunityEvaluation[] {
    return this.opportunityHistory.slice(0, limit);
  }

  public getPaperReceipts(limit: number = 50): PaperEvaluationReceipt[] {
    return this.paperReceipts.slice(0, limit);
  }
}

export const globalArbitrageEngine = ModularArbitrageEngine.getInstance();
