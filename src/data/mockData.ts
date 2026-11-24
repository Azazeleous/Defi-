import { TradeExecution, NetworkName, ArbitrageOpportunity } from '../types/arbitrage';

export const NETWORKS: NetworkName[] = [
  'Ethereum',
  'Arbitrum',
  'Solana',
  'Base',
  'Polygon',
  'Optimism',
  'Avalanche',
];

export const NETWORK_CONFIG: Record<
  NetworkName,
  { color: string; badgeBg: string; borderColor: string; short: string; iconColor: string }
> = {
  Ethereum: {
    color: 'text-blue-400',
    badgeBg: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
    borderColor: 'border-blue-500/40',
    short: 'ETH',
    iconColor: '#627EEA',
  },
  Arbitrum: {
    color: 'text-cyan-400',
    badgeBg: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
    borderColor: 'border-cyan-500/40',
    short: 'ARB',
    iconColor: '#28A0F0',
  },
  Solana: {
    color: 'text-purple-400',
    badgeBg: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
    borderColor: 'border-purple-500/40',
    short: 'SOL',
    iconColor: '#14F195',
  },
  Base: {
    color: 'text-indigo-400',
    badgeBg: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
    borderColor: 'border-indigo-500/40',
    short: 'BASE',
    iconColor: '#0052FF',
  },
  Polygon: {
    color: 'text-violet-400',
    badgeBg: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
    borderColor: 'border-violet-500/40',
    short: 'POL',
    iconColor: '#8247E5',
  },
  Optimism: {
    color: 'text-red-400',
    badgeBg: 'bg-red-500/10 text-red-300 border-red-500/30',
    borderColor: 'border-red-500/40',
    short: 'OP',
    iconColor: '#FF0420',
  },
  Avalanche: {
    color: 'text-rose-400',
    badgeBg: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
    borderColor: 'border-rose-500/40',
    short: 'AVAX',
    iconColor: '#E84142',
  },
};

const DEX_LIST: Record<NetworkName, string[]> = {
  Ethereum: ['Uniswap v3', 'Curve Finance', 'SushiSwap', 'Balancer v2', '1inch Fusion'],
  Arbitrum: ['Camelot DEX', 'Uniswap v3', 'GMX v2', 'Trader Joe', 'Curve'],
  Solana: ['Raydium CPMM', 'Orca Whirlpools', 'Meteora DLMM', 'Phoenix Orderbook', 'Lifinity'],
  Base: ['Aerodrome SlipStream', 'Uniswap v3', 'BaseSwap', 'Maverick AMM'],
  Polygon: ['QuickSwap V3', 'Uniswap v3', 'Balancer', 'Dystopia'],
  Optimism: ['Velodrome V2', 'Uniswap v3', 'Curve', 'Beethoven X'],
  Avalanche: ['Trader Joe v2.1', 'Pangolin', 'Platypus Finance', 'Dexalot'],
};

const TOKEN_PAIRS: Record<NetworkName, { path: string; inBase: string; tokenUnit: string }[]> = {
  Ethereum: [
    { path: 'ETH → USDC → WBTC → ETH', inBase: '8.40', tokenUnit: 'ETH' },
    { path: 'stETH → WETH → DAI → stETH', inBase: '15.0', tokenUnit: 'stETH' },
    { path: 'USDC → USDT → DAI → USDC', inBase: '45,000', tokenUnit: 'USDC' },
    { path: 'ETH → LINK → UNI → ETH', inBase: '5.20', tokenUnit: 'ETH' },
  ],
  Arbitrum: [
    { path: 'ARB → ETH → USDC → ARB', inBase: '18,500', tokenUnit: 'ARB' },
    { path: 'ETH → GMX → USDC → ETH', inBase: '6.75', tokenUnit: 'ETH' },
    { path: 'USDC.e → USDT → ARB → USDC.e', inBase: '28,000', tokenUnit: 'USDC' },
  ],
  Solana: [
    { path: 'SOL → JUP → USDC → SOL', inBase: '84.0', tokenUnit: 'SOL' },
    { path: 'SOL → RAY → BONK → SOL', inBase: '110.5', tokenUnit: 'SOL' },
    { path: 'USDC → USDT → PYTH → USDC', inBase: '24,000', tokenUnit: 'USDC' },
    { path: 'mSOL → SOL → bSOL → mSOL', inBase: '45.0', tokenUnit: 'mSOL' },
  ],
  Base: [
    { path: 'WETH → AERO → USDC → WETH', inBase: '4.80', tokenUnit: 'ETH' },
    { path: 'BRETT → WETH → USDC → BRETT', inBase: '120,000', tokenUnit: 'BRETT' },
    { path: 'USDC → DAI → cbETH → USDC', inBase: '16,500', tokenUnit: 'USDC' },
  ],
  Polygon: [
    { path: 'POL → USDC → WETH → POL', inBase: '32,000', tokenUnit: 'POL' },
    { path: 'WETH → QUICK → USDT → WETH', inBase: '3.10', tokenUnit: 'ETH' },
  ],
  Optimism: [
    { path: 'OP → WETH → USDC → OP', inBase: '14,200', tokenUnit: 'OP' },
    { path: 'ETH → VELO → USDC → ETH', inBase: '5.60', tokenUnit: 'ETH' },
  ],
  Avalanche: [
    { path: 'AVAX → JOE → USDC → AVAX', inBase: '340.0', tokenUnit: 'AVAX' },
    { path: 'WAVAX → BTC.b → USDT → WAVAX', inBase: '280.0', tokenUnit: 'AVAX' },
  ],
};

function formatTime(d: Date): string {
  const pad = (n: number, z = 2) => ('00' + n).slice(-z);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

/**
 * Live aggregated network integration calculating 0.1ms precision time across 24hr cycle.
 */
export function getCurrentAggregatedPrecisionTime(): {
  isoString: string;
  formatted24h: string;
  fractionalMs: number;
  submillisecond01: number;
  utcEpoch: number;
} {
  const now = Date.now();
  const date = new Date(now);
  const ms = date.getMilliseconds();
  const sub01 = Math.floor((performance.now() % 1) * 10); // 0.1ms precision ticker

  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();

  const formatted24h = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(ms).padStart(3, '0')}.${sub01}`;

  return {
    isoString: date.toISOString(),
    formatted24h,
    fractionalMs: ms,
    submillisecond01: sub01,
    utcEpoch: now,
  };
}

function randomHex(length: number): string {
  let s = '';
  const hex = '0123456789abcdef';
  for (let i = 0; i < length; i++) {
    s += hex.charAt(Math.floor(Math.random() * hex.length));
  }
  return s;
}

export function generateSingleTrade(targetTimestamp?: number): TradeExecution {
  const network = NETWORKS[Math.floor(Math.random() * NETWORKS.length)];
  const pairs = TOKEN_PAIRS[network];
  const pairChoice = pairs[Math.floor(Math.random() * pairs.length)];
  
  const dexs = DEX_LIST[network];
  // pick 2 or 3 distinct dexes
  const shuffledDex = [...dexs].sort(() => 0.5 - Math.random());
  const routeDexes = shuffledDex.slice(0, Math.random() > 0.4 ? 3 : 2);

  const now = targetTimestamp || Date.now();
  const dateObj = new Date(now);

  // Slippage: realistic low slippage for algorithmic HFT (0.01% to 0.18%, occasional 0.35%)
  const slippageSeed = Math.random();
  const slippagePct = slippageSeed < 0.7 
    ? +(0.01 + Math.random() * 0.05).toFixed(3) // tight: 0.01% - 0.06%
    : slippageSeed < 0.95
    ? +(0.06 + Math.random() * 0.12).toFixed(3) // moderate: 0.06% - 0.18%
    : +(0.18 + Math.random() * 0.22).toFixed(3); // volatile: 0.18% - 0.40%

  const slippageThreshold = +(slippagePct + 0.08 + Math.random() * 0.1).toFixed(2);

  // Profit
  const profitPct = +(0.12 + Math.random() * 0.85).toFixed(3);
  const netProfitUsd = +(18.5 + Math.random() * 320.0).toFixed(2);
  const latency = Math.floor(8 + Math.random() * 45); // 8ms - 53ms
  const gasFee = +(1.2 + Math.random() * 6.5).toFixed(2);

  const statuses: ('Confirmed' | 'Settled' | 'ZK-Verified')[] = [
    'Confirmed',
    'Settled',
    'ZK-Verified',
  ];
  const status = statuses[Math.floor(Math.random() * statuses.length)];

  const hashPrefix = network === 'Solana' ? '' : '0x';
  const txHash = `${hashPrefix}${randomHex(network === 'Solana' ? 44 : 40)}`;

  const inAmountNum = parseFloat(pairChoice.inBase.replace(/,/g, ''));
  const outAmountNum = (inAmountNum * (1 + profitPct / 100)).toFixed(pairChoice.tokenUnit === 'ETH' || pairChoice.tokenUnit === 'SOL' ? 4 : 2);

  return {
    id: `trade-${now}-${Math.random().toString(36).slice(2, 7)}`,
    txHash,
    timestamp: formatTime(dateObj),
    rawTimestamp: now,
    network,
    tokenPair: pairChoice.path,
    routeDEXs: routeDexes,
    amountIn: `${pairChoice.inBase} ${pairChoice.tokenUnit}`,
    amountOut: `${outAmountNum} ${pairChoice.tokenUnit}`,
    slippagePct,
    slippageThreshold,
    netProfitUsd,
    netProfitPct: profitPct,
    executionLatencyMs: latency,
    gasFeeUsd: gasFee,
    status,
    algorithm: Math.random() > 0.3 ? 'Bellman-Ford Cyclic' : 'Multi-Hop Flash',
    blockNumber: 19842000 + Math.floor(Math.random() * 5000),
  };
}

export function getInitialTradeHistory(count = 14): TradeExecution[] {
  const list: TradeExecution[] = [];
  const baseTime = Date.now();
  for (let i = count - 1; i >= 0; i--) {
    const t = baseTime - i * (2800 + Math.floor(Math.random() * 3200));
    list.push(generateSingleTrade(t));
  }
  return list.sort((a, b) => b.rawTimestamp - a.rawTimestamp);
}

export const INITIAL_OPPORTUNITIES: ArbitrageOpportunity[] = [
  {
    id: 'opp-1',
    network: 'Arbitrum',
    path: ['ETH', 'USDC', 'ARB', 'ETH'],
    dexes: ['Camelot DEX', 'Uniswap v3', 'Trader Joe'],
    expectedProfitPct: 0.42,
    expectedProfitUsd: 184.20,
    estSlippagePct: 0.032,
    gasCostUsd: 0.85,
    liquidityDepthUsd: '$840,000',
    timeRemainingSec: 14,
    riskScore: 'Low',
  },
  {
    id: 'opp-2',
    network: 'Ethereum',
    path: ['stETH', 'WETH', 'DAI', 'stETH'],
    dexes: ['Curve Finance', 'Uniswap v3', 'Balancer v2'],
    expectedProfitPct: 0.28,
    expectedProfitUsd: 312.50,
    estSlippagePct: 0.021,
    gasCostUsd: 4.80,
    liquidityDepthUsd: '$2,150,000',
    timeRemainingSec: 22,
    riskScore: 'Low',
  },
  {
    id: 'opp-3',
    network: 'Solana',
    path: ['SOL', 'JUP', 'USDC', 'SOL'],
    dexes: ['Orca Whirlpools', 'Raydium CPMM', 'Meteora DLMM'],
    expectedProfitPct: 0.68,
    expectedProfitUsd: 215.40,
    estSlippagePct: 0.045,
    gasCostUsd: 0.04,
    liquidityDepthUsd: '$490,000',
    timeRemainingSec: 7,
    riskScore: 'Medium',
  },
  {
    id: 'opp-4',
    network: 'Base',
    path: ['WETH', 'AERO', 'USDC', 'WETH'],
    dexes: ['Aerodrome SlipStream', 'Uniswap v3'],
    expectedProfitPct: 0.39,
    expectedProfitUsd: 96.15,
    estSlippagePct: 0.028,
    gasCostUsd: 0.22,
    liquidityDepthUsd: '$340,000',
    timeRemainingSec: 19,
    riskScore: 'Low',
  },
];
