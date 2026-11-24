/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert';
import {
  BellmanFordArbitrageDetector,
  type BellmanFordCycleOpportunity,
  type BellmanFordHopDetail,
} from './arbitrage/bellmanFordDetector';

test('Bellman-Ford liquidity graph construction creates valid directed edges with log weights', () => {
  const detector = BellmanFordArbitrageDetector.getInstance();
  const { vertices, edges } = detector.buildLiquidityGraph();

  assert.ok(vertices.length >= 4, 'Liquidity graph must include at least 4 canonical asset vertices');
  assert.ok(edges.length >= 10, 'Liquidity graph must include bidirectional venue edges');

  for (const edge of edges) {
    assert.ok(edge.rate > 0 && Number.isFinite(edge.rate), 'Edge conversion rate must be positive');
    assert.ok(Number.isFinite(edge.weight), 'Log-space weight must be finite');
    const expectedWeight = -Math.log(edge.rate * (1 - edge.feeBps / 10000));
    assert.ok(
      Math.abs(edge.weight - expectedWeight) < 1e-9,
      'Edge weight must equal -ln(rate * (1 - feeBps / 10000))'
    );
  }
});

test('Bellman-Ford negative-cycle scan detects closed loops, deducts costs, and ranks by netProfitUsd', () => {
  const detector = BellmanFordArbitrageDetector.getInstance();
  const scan = detector.scanForNegativeCycles({
    referenceCapitalUsd: 25000,
    refreshObservations: true,
  });

  assert.ok(scan.vertexCount >= 4);
  assert.ok(scan.edgeCount >= 10);
  assert.ok(scan.scanDurationUs > 0);
  assert.ok(scan.opportunities.length > 0, 'Scan should yield tracked cyclic paths');

  for (let i = 0; i < scan.opportunities.length; i++) {
    const opp: BellmanFordCycleOpportunity = scan.opportunities[i];
    // Path must form a closed cycle (first asset equals last asset)
    assert.strictEqual(
      opp.pathAssets[0],
      opp.pathAssets[opp.pathAssets.length - 1],
      'Arbitrage cycle path must start and end at the same asset'
    );
    assert.strictEqual(opp.hops.length, opp.pathAssets.length - 1);

    // Sum of hop weights must match reported cycleWeightSum
    const hopSum = opp.hops.reduce((sum: number, h: BellmanFordHopDetail) => sum + h.edgeWeight, 0);
    assert.ok(Math.abs(hopSum - opp.cycleWeightSum) < 1e-4);

    // Gross multiplier exp(-cycleWeightSum)
    const expectedMult = Math.exp(-opp.cycleWeightSum);
    assert.ok(Math.abs(expectedMult - opp.grossMultiplier) < 1e-4);

    // Verification digest should be a 64-char SHA-256 hex string
    assert.match(opp.verificationDigest, /^[a-f0-9]{64}$/);

    // Sorted descending by netProfitUsd
    if (i > 0) {
      assert.ok(
        scan.opportunities[i - 1].netProfitUsd >= opp.netProfitUsd,
        'Opportunities must be ranked descending by netProfitUsd'
      );
    }
  }
});
