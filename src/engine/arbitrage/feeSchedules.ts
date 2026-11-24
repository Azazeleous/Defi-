/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MarketProviderId, FeeSchedule } from '../../contracts/arbitrage';

export const CANONICAL_FEE_SCHEDULES: Record<MarketProviderId, FeeSchedule> = {
  UNISWAP_V3_MAINNET: {
    providerId: 'UNISWAP_V3_MAINNET',
    makerFeeBps: 5, // 0.05% pool fee tier
    takerFeeBps: 5, // 0.05% taker fee
    gasUnitsEstimated: 145000, // Standard V3 swap gas units
    gasPriceGwei: 16.5,
    networkTransferFeeUsd: 0,
    withdrawalFeeUsd: 0,
  },
  CURVE_STABLE_V2: {
    providerId: 'CURVE_STABLE_V2',
    makerFeeBps: 4, // 0.04% pool fee
    takerFeeBps: 4,
    gasUnitsEstimated: 185000, // Curve pool swap gas units
    gasPriceGwei: 16.5,
    networkTransferFeeUsd: 0,
    withdrawalFeeUsd: 0,
  },
  SUSHISWAP_V1: {
    providerId: 'SUSHISWAP_V1',
    makerFeeBps: 25, // 0.25% LP fee
    takerFeeBps: 30, // 0.30% standard taker
    gasUnitsEstimated: 120000,
    gasPriceGwei: 16.5,
    networkTransferFeeUsd: 0,
    withdrawalFeeUsd: 0,
  },
  BINANCE_PUBLIC: {
    providerId: 'BINANCE_PUBLIC',
    makerFeeBps: 7.5, // 0.075% with BNB discount
    takerFeeBps: 10,  // 0.10% standard tier
    gasUnitsEstimated: 0, // CEX off-chain matching
    gasPriceGwei: 0,
    networkTransferFeeUsd: 3.50, // Token withdrawal fee equivalent
    withdrawalFeeUsd: 2.00,
  },
  COINBASE_EXCHANGE: {
    providerId: 'COINBASE_EXCHANGE',
    makerFeeBps: 20, // 0.20% Advanced tier
    takerFeeBps: 40, // 0.40% Advanced tier
    gasUnitsEstimated: 0,
    gasPriceGwei: 0,
    networkTransferFeeUsd: 4.00,
    withdrawalFeeUsd: 1.50,
  },
  KRAKEN_SPOT: {
    providerId: 'KRAKEN_SPOT',
    makerFeeBps: 16, // 0.16%
    takerFeeBps: 26, // 0.26%
    gasUnitsEstimated: 0,
    gasPriceGwei: 0,
    networkTransferFeeUsd: 3.00,
    withdrawalFeeUsd: 1.00,
  },
  BALANCER_V2: {
    providerId: 'BALANCER_V2',
    makerFeeBps: 10,
    takerFeeBps: 10,
    gasUnitsEstimated: 155000,
    gasPriceGwei: 16.5,
    networkTransferFeeUsd: 0,
    withdrawalFeeUsd: 0,
  },
};

/**
 * Calculates network gas cost in USD based on ETH price in USD
 */
export function calculateGasCostUsd(gasUnits: number, gasPriceGwei: number, ethPriceUsd: number): number {
  if (gasUnits <= 0 || gasPriceGwei <= 0) return 0;
  // gasUnits * (Gwei * 1e-9 ETH) * ETH_USD
  const ethConsumed = (gasUnits * gasPriceGwei) / 1e9;
  return +(ethConsumed * ethPriceUsd).toFixed(4);
}
