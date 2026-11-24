export type NetworkName = 
  | 'Ethereum' 
  | 'Arbitrum' 
  | 'Solana' 
  | 'Base' 
  | 'Polygon' 
  | 'Optimism' 
  | 'Avalanche';

export type ExecutionStatus = 'Confirmed' | 'Settled' | 'ZK-Verified' | 'Pending';

export interface TradeExecution {
  id: string;
  txHash: string;
  timestamp: string; // ISO or formatted HH:mm:ss.SSS
  rawTimestamp: number;
  network: NetworkName;
  tokenPair: string; // e.g. "ETH → USDC → WBTC → ETH"
  routeDEXs: string[]; // e.g. ["Uniswap v3", "Curve Finance", "SushiSwap"]
  amountIn: string; // e.g. "12.5 ETH"
  amountOut: string; // e.g. "12.548 ETH"
  slippagePct: number; // e.g. 0.04 (%)
  slippageThreshold: number; // e.g. 0.15 (%)
  netProfitUsd: number; // e.g. 142.80
  netProfitPct: number; // e.g. 0.38
  executionLatencyMs: number; // e.g. 18ms
  gasFeeUsd: number; // e.g. 3.25
  status: ExecutionStatus;
  algorithm: 'Bellman-Ford Cyclic' | 'Multi-Hop Flash' | 'Cross-DEX Spatial';
  blockNumber: number;
}

export interface ArbitrageOpportunity {
  id: string;
  network: NetworkName;
  path: string[];
  dexes: string[];
  expectedProfitPct: number;
  expectedProfitUsd: number;
  estSlippagePct: number;
  gasCostUsd: number;
  liquidityDepthUsd: string;
  timeRemainingSec: number;
  riskScore: 'Low' | 'Medium' | 'High';
}

export interface EngineStats {
  throughput: number;
  activeOpportunities: number;
  totalProfit24h: number;
  avgSlippagePct: number;
  avgLatencyMs: number;
  solvedCyclesCount: number;
}
