/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  MarketProviderId,
  StandardTradingPair,
  MarketObservation,
  OrderBookSnapshot,
  OrderBookDepthLevel,
} from '../../contracts/arbitrage';

export interface ProviderHealthRecord {
  readonly providerId: MarketProviderId;
  readonly isOnline: boolean;
  readonly lastHeartbeatUtc: string;
  readonly latencyMs: number;
  readonly successRatePct: number;
}

export class MarketDataRouter {
  private static instance: MarketDataRouter;
  private observations = new Map<string, MarketObservation>();
  private orderBooks = new Map<string, OrderBookSnapshot>();
  private providerHealth = new Map<MarketProviderId, ProviderHealthRecord>();
  private subscribers = new Set<(obs: MarketObservation) => void>();
  private sequenceCounter = 0;

  // Canonical base prices in USD
  private readonly baselinePrices: Record<StandardTradingPair, number> = {
    'ETH/USDC': 3420.50,
    'BTC/USDT': 96800.00,
    'SOL/USDC': 214.75,
    'WBTC/ETH': 28.29,
    'ETH/USDT': 3421.10,
    'ARB/USDC': 1.185,
  };

  // Provider relative pricing offsets (realistic cross-market spread)
  private readonly providerOffsetsBps: Record<MarketProviderId, number> = {
    UNISWAP_V3_MAINNET: -12, // Lower ask in pool
    CURVE_STABLE_V2: -8,
    SUSHISWAP_V1: 15,
    BINANCE_PUBLIC: 22,   // Higher bid on CEX
    COINBASE_EXCHANGE: 18,
    KRAKEN_SPOT: 5,
    BALANCER_V2: -4,
  };

  private constructor() {
    this.initializeProviders();
    this.refreshAllObservations();
  }

  public static getInstance(): MarketDataRouter {
    if (!MarketDataRouter.instance) {
      MarketDataRouter.instance = new MarketDataRouter();
    }
    return MarketDataRouter.instance;
  }

  private initializeProviders(): void {
    const providers: MarketProviderId[] = [
      'UNISWAP_V3_MAINNET',
      'CURVE_STABLE_V2',
      'SUSHISWAP_V1',
      'BINANCE_PUBLIC',
      'COINBASE_EXCHANGE',
      'KRAKEN_SPOT',
      'BALANCER_V2',
    ];

    for (const p of providers) {
      this.providerHealth.set(p, {
        providerId: p,
        isOnline: true,
        lastHeartbeatUtc: new Date().toISOString(),
        latencyMs: Math.floor(12 + Math.random() * 25),
        successRatePct: 99.9,
      });
    }
  }

  private buildKey(providerId: MarketProviderId, pair: StandardTradingPair): string {
    return `${providerId}::${pair}`;
  }

  /**
   * Refreshes market observation and multi-tier orderbook for a given provider and pair.
   */
  public generateObservation(
    providerId: MarketProviderId,
    pair: StandardTradingPair,
    jitterMultiplier: number = 1.0
  ): { observation: MarketObservation; orderBook: OrderBookSnapshot } {
    this.sequenceCounter++;
    const basePrice = this.baselinePrices[pair];
    const offsetBps = (this.providerOffsetsBps[providerId] || 0) * jitterMultiplier;
    const centerPrice = +(basePrice * (1 + offsetBps / 10000)).toFixed(4);

    // Spread width (typically 4 - 12 bps)
    const halfSpread = +(centerPrice * 0.0004).toFixed(4);
    const bidPrice = +(centerPrice - halfSpread).toFixed(4);
    const askPrice = +(centerPrice + halfSpread).toFixed(4);

    const now = Date.now();
    const monotonicNs = (typeof process !== 'undefined' && process.hrtime)
      ? process.hrtime.bigint().toString()
      : (now * 1000000).toString();

    const parts = pair.split('/');
    const baseAsset = parts[0] || 'ETH';
    const quoteAsset = parts[1] || 'USDC';

    const observation: MarketObservation = {
      observationId: `obs_${providerId.toLowerCase()}_${pair.replace('/', '_')}_${now}`,
      providerId,
      pair,
      baseAsset,
      quoteAsset,
      bidPrice,
      askPrice,
      bidVolume: +(45.0 + Math.random() * 80).toFixed(2),
      askVolume: +(40.0 + Math.random() * 80).toFixed(2),
      timestampUtc: new Date(now).toISOString(),
      monotonicNs,
      sequenceNumber: this.sequenceCounter,
      latencyMs: Math.floor(8 + Math.random() * 18),
      isStale: false,
    };

    // Construct 10-level deep order-book
    const bids: OrderBookDepthLevel[] = [];
    const asks: OrderBookDepthLevel[] = [];

    let cumBidVol = 0;
    let cumBidCost = 0;
    for (let level = 1; level <= 10; level++) {
      // Bids step downwards by 3 - 6 bps per level
      const p = +(bidPrice * (1 - (level - 1) * 0.0004)).toFixed(4);
      const size = +(12.0 * Math.sqrt(level) + Math.random() * 5).toFixed(3);
      cumBidVol += size;
      cumBidCost += p * size;
      bids.push({
        price: p,
        size,
        cumulativeVolume: +cumBidVol.toFixed(3),
        effectiveWeightedPrice: +(cumBidCost / cumBidVol).toFixed(4),
      });
    }

    let cumAskVol = 0;
    let cumAskCost = 0;
    for (let level = 1; level <= 10; level++) {
      // Asks step upwards by 3 - 6 bps per level
      const p = +(askPrice * (1 + (level - 1) * 0.0004)).toFixed(4);
      const size = +(12.0 * Math.sqrt(level) + Math.random() * 5).toFixed(3);
      cumAskVol += size;
      cumAskCost += p * size;
      asks.push({
        price: p,
        size,
        cumulativeVolume: +cumAskVol.toFixed(3),
        effectiveWeightedPrice: +(cumAskCost / cumAskVol).toFixed(4),
      });
    }

    const orderBook: OrderBookSnapshot = {
      snapshotId: `ob_${providerId.toLowerCase()}_${pair.replace('/', '_')}_${now}`,
      providerId,
      pair,
      bids,
      asks,
      timestampUtc: new Date(now).toISOString(),
      monotonicNs,
      maxDepthLevels: 10,
      spreadAbsolute: +(askPrice - bidPrice).toFixed(4),
      spreadBps: +(((askPrice - bidPrice) / askPrice) * 10000).toFixed(2),
    };

    const key = this.buildKey(providerId, pair);
    this.observations.set(key, observation);
    this.orderBooks.set(key, orderBook);

    this.notifySubscribers(observation);
    return { observation, orderBook };
  }

  public refreshAllObservations(): void {
    const pairs: StandardTradingPair[] = ['ETH/USDC', 'BTC/USDT', 'SOL/USDC', 'WBTC/ETH'];
    const providers: MarketProviderId[] = [
      'UNISWAP_V3_MAINNET',
      'CURVE_STABLE_V2',
      'BINANCE_PUBLIC',
      'COINBASE_EXCHANGE',
      'KRAKEN_SPOT',
    ];

    for (const pair of pairs) {
      for (const p of providers) {
        this.generateObservation(p, pair);
      }
    }
  }

  public getObservation(providerId: MarketProviderId, pair: StandardTradingPair, maxAgeMs: number = 5000): MarketObservation | null {
    const key = this.buildKey(providerId, pair);
    const obs = this.observations.get(key);
    if (!obs) return null;

    const ageMs = Date.now() - new Date(obs.timestampUtc).getTime();
    if (ageMs > maxAgeMs) {
      return { ...obs, isStale: true };
    }
    return obs;
  }

  public getAllObservations(pair?: StandardTradingPair): MarketObservation[] {
    const list = Array.from(this.observations.values());
    if (!pair) return list;
    return list.filter((o) => o.pair === pair);
  }

  public getOrderBook(providerId: MarketProviderId, pair: StandardTradingPair): OrderBookSnapshot | null {
    const key = this.buildKey(providerId, pair);
    return this.orderBooks.get(key) || null;
  }

  public getProviderHealth(): Record<MarketProviderId, ProviderHealthRecord> {
    const result: Partial<Record<MarketProviderId, ProviderHealthRecord>> = {};
    for (const [p, h] of this.providerHealth.entries()) {
      result[p] = h;
    }
    return result as Record<MarketProviderId, ProviderHealthRecord>;
  }

  public subscribe(listener: (obs: MarketObservation) => void): () => void {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  private notifySubscribers(obs: MarketObservation): void {
    for (const listener of this.subscribers) {
      try {
        listener(obs);
      } catch {
        // Safe subscriber isolation
      }
    }
  }
}

export const globalMarketDataRouter = MarketDataRouter.getInstance();
