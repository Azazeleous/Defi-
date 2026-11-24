/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert';
import { ModularArbitrageEngine } from './arbitrage/arbitrageEngine';
import { MarketDataRouter } from './arbitrage/marketDataProviders';
import { CANONICAL_FEE_SCHEDULES, calculateGasCostUsd } from './arbitrage/feeSchedules';

test('Spread Arithmetic & Fee Calculations', () => {
  const engine = ModularArbitrageEngine.getInstance();
  assert.ok(engine, 'ModularArbitrageEngine instance must exist');

  // Test gas cost calculation
  // 145,000 gas * 16.5 Gwei (16.5e-9 ETH) * $3,420.50 ETH price
  const gasUsd = calculateGasCostUsd(145000, 16.5, 3420.50);
  assert.ok(gasUsd > 0, 'Gas cost in USD must be positive');
  assert.strictEqual(typeof gasUsd, 'number');

  // Test fee schedules exist
  const uniFee = CANONICAL_FEE_SCHEDULES.UNISWAP_V3_MAINNET;
  assert.strictEqual(uniFee.takerFeeBps, 5);

  const binanceFee = CANONICAL_FEE_SCHEDULES.BINANCE_PUBLIC;
  assert.strictEqual(binanceFee.takerFeeBps, 10);
});

test('Order Book Depth & Slippage Calculations', () => {
  const engine = ModularArbitrageEngine.getInstance();

  const mockLevels = [
    { price: 3400.0, size: 1.0, cumulativeVolume: 1.0, effectiveWeightedPrice: 3400.0 },
    { price: 3405.0, size: 2.0, cumulativeVolume: 3.0, effectiveWeightedPrice: 3403.33 },
    { price: 3412.0, size: 5.0, cumulativeVolume: 8.0, effectiveWeightedPrice: 3407.75 },
  ];

  // Buying 2.5 units should take 1.0 @ 3400 and 1.5 @ 3405
  // Total cost = (1 * 3400) + (1.5 * 3405) = 3400 + 5107.5 = 8507.5
  // Effective price = 8507.5 / 2.5 = 3403.0
  const slippageDetail = engine.calculateEffectiveExecution(mockLevels, 2.5, 'BUY');

  assert.strictEqual(slippageDetail.tradeSizeBase, 2.5);
  assert.strictEqual(slippageDetail.effectiveExecutionPrice, 3403.0);
  assert.strictEqual(slippageDetail.liquidityExhausted, false);
  assert.ok(slippageDetail.slippageBps >= 0);
});

test('Market Data Router & Stale Data Detection', () => {
  const router = MarketDataRouter.getInstance();
  assert.ok(router, 'MarketDataRouter instance must exist');

  const obs = router.getObservation('UNISWAP_V3_MAINNET', 'ETH/USDC');
  assert.ok(obs, 'Observation for ETH/USDC on Uniswap V3 must be generated');
  assert.strictEqual(obs.pair, 'ETH/USDC');
  assert.strictEqual(obs.isStale, false);

  const orderBook = router.getOrderBook('UNISWAP_V3_MAINNET', 'ETH/USDC');
  assert.ok(orderBook, 'Order book snapshot must exist');
  assert.strictEqual(orderBook.bids.length, 10);
  assert.strictEqual(orderBook.asks.length, 10);
});

test('Cross-Market Arbitrage Evaluation', () => {
  const engine = ModularArbitrageEngine.getInstance();
  const router = MarketDataRouter.getInstance();

  // Ensure observations are fresh
  router.refreshAllObservations();

  const evaluations = engine.evaluateAllOpportunities(2.0);
  assert.ok(Array.isArray(evaluations), 'Evaluations must return an array');

  if (evaluations.length > 0) {
    const topOpp = evaluations[0];
    assert.ok(topOpp.opportunityId, 'Opportunity must have an ID');
    assert.ok(topOpp.evaluationReceiptHash, 'Opportunity must have a cryptographic verification receipt hash');
    assert.ok(topOpp.calculationSteps.length >= 4, 'Opportunity must include explainable calculation steps');
  }
});
