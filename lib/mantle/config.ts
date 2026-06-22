/**
 * lib/mantle/config.ts — Session N1 (new file)
 *
 * Mantle Network configuration for the Mantle AI Trading Agent.
 * Part of: The Turing Test Hackathon — AI Trading & Strategy track.
 *
 * This file is purely additive. It does not import from, modify, or
 * depend on any existing Binalyst file (lib/twak/, lib/celo/, lib/sui/,
 * lib/agentStore.ts, lib/store.ts, etc.). The BNB, Celo, and Sui agents
 * are completely untouched.
 *
 * Token addresses verified against Mantle Network official docs / explorer
 * (explorer.mantle.xyz) — June 2026:
 *  - MNT (native wrapped):  0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8
 *  - mETH:                  0xcDA86A272531e8640cD7F1a92c01839911B90bb0
 *  - USDY (Ondo):           0x5bE26527e817998A7206475496fDE1E68957c5A6
 *  - USDC:                  0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9
 *  - USDT:                  0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE
 *  - wETH:                  0xdEAddEaDdeadDEadDEADDEAddEADDEAddead1111
 *
 * Mantle Mainnet chainId: 5000
 * Mantle Sepolia (testnet) chainId: 5003
 */

export type MantleNetwork = 'mainnet' | 'testnet'

// ─────────────────────────────────────────────────────────────────────────────
// Chain IDs & RPC endpoints
// ─────────────────────────────────────────────────────────────────────────────

export const MANTLE_MAINNET_CHAIN_ID = 5000
export const MANTLE_TESTNET_CHAIN_ID = 5003

export const MANTLE_CHAIN_ID: Record<MantleNetwork, number> = {
  mainnet: MANTLE_MAINNET_CHAIN_ID,
  testnet: MANTLE_TESTNET_CHAIN_ID,
}

export const MANTLE_RPC: Record<MantleNetwork, string> = {
  mainnet: 'https://rpc.mantle.xyz',
  testnet: 'https://rpc.sepolia.mantle.xyz',
}

export const MANTLE_RPC_BACKUP: Record<MantleNetwork, string> = {
  mainnet: 'https://mantle-mainnet.public.blastapi.io',
  testnet: 'https://rpc.sepolia.mantle.xyz',
}

export const MANTLE_EXPLORER: Record<MantleNetwork, string> = {
  mainnet: 'https://explorer.mantle.xyz',
  testnet: 'https://explorer.sepolia.mantle.xyz',
}

export const MANTLE_EXPLORER_TX = (hash: string, network: MantleNetwork = 'mainnet') =>
  `${MANTLE_EXPLORER[network]}/tx/${hash}`

export const MANTLE_EXPLORER_ADDR = (addr: string, network: MantleNetwork = 'mainnet') =>
  `${MANTLE_EXPLORER[network]}/address/${addr}`

// ─────────────────────────────────────────────────────────────────────────────
// ERC-8004 Identity Registry — Mantle Mainnet
// The Turing Test Hackathon's second defining feature: every agent is issued
// a unique identity NFT via ERC-8004.
// ─────────────────────────────────────────────────────────────────────────────

export const ERC8004_REGISTRY_MANTLE: Record<MantleNetwork, string | null> = {
  mainnet: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432', // Mantle mainnet deployment
  testnet: null, // not deployed on Mantle Sepolia — registration is mainnet-only
}

export const EIGHT004SCAN_MANTLE_URL = (agentId: string | number) =>
  `https://8004scan.io/agents/mantle/${agentId}`

// ─────────────────────────────────────────────────────────────────────────────
// Token addresses
// ─────────────────────────────────────────────────────────────────────────────

export interface MantleTokenInfo {
  symbol:    string
  name:      string
  address:   string
  decimals:  number
  isNative?: boolean   // MNT is the native gas token
  isRWA?:    boolean   // Real World Assets — mETH, USDY
  isStable?: boolean   // stablecoins — USDC, USDT
}

export const MANTLE_TOKENS: Record<MantleNetwork, Record<string, MantleTokenInfo>> = {
  mainnet: {
    MNT: {
      symbol: 'MNT', name: 'Mantle',
      address: '0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8',
      decimals: 18, isNative: true,
    },
    mETH: {
      symbol: 'mETH', name: 'Mantle Staked ETH',
      address: '0xcDA86A272531e8640cD7F1a92c01839911B90bb0',
      decimals: 18, isRWA: true,
    },
    USDY: {
      symbol: 'USDY', name: 'Ondo US Dollar Yield',
      address: '0x5bE26527e817998A7206475496fDE1E68957c5A6',
      decimals: 18, isRWA: true, isStable: true,
    },
    USDC: {
      symbol: 'USDC', name: 'USD Coin',
      address: '0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9',
      decimals: 6, isStable: true,
    },
    USDT: {
      symbol: 'USDT', name: 'Tether USD',
      address: '0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE',
      decimals: 6, isStable: true,
    },
    wETH: {
      symbol: 'wETH', name: 'Wrapped Ether',
      address: '0xdEAddEaDdeadDEadDEADDEAddEADDEAddead1111',
      decimals: 18,
    },
  },
  testnet: {
    // Mantle Sepolia testnet token addresses (official faucet tokens)
    MNT: {
      symbol: 'MNT', name: 'Mantle (testnet)',
      address: '0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8',
      decimals: 18, isNative: true,
    },
    USDC: {
      symbol: 'USDC', name: 'USD Coin (testnet)',
      address: '0xAc98B49576B1C892ba6BFae08fE1BB0d80Cf599c',
      decimals: 6, isStable: true,
    },
    USDT: {
      symbol: 'USDT', name: 'Tether USD (testnet)',
      address: '0x0000000000000000000000000000000000000000', // placeholder — check faucet
      decimals: 6, isStable: true,
    },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Bybit trading pairs — used by lib/bybit.ts for price feeds
// These are the AI Trading & Strategy track's primary trading instruments.
// ─────────────────────────────────────────────────────────────────────────────

export const MANTLE_BYBIT_PAIRS: string[] = [
  'MNTUSDT',   // MNT/USDT — primary pair
  'ETHUSDT',   // ETH — mETH proxy signal
  'BTCUSDT',   // BTC — macro sentiment
  'BNBUSDT',   // cross-chain context
  'SOLUSDT',   // alt sentiment
  'USDCUSDT',  // stablecoin peg check
]

// ─────────────────────────────────────────────────────────────────────────────
// DEX: Merchant Moe (native Mantle DEX — LB AMM) + Agni Finance
// Used by MantleClient for swap routing.
// ─────────────────────────────────────────────────────────────────────────────

export const MERCHANT_MOE_ROUTER = '0xeaEE7EE68874218c3558b40063c42B82D3E7232a'
export const AGNI_SWAP_ROUTER    = '0x319B69888b0d11cEC22caA5034e25FfFBDc88421'

// ─────────────────────────────────────────────────────────────────────────────
// On-chain benchmarking — The Turing Test Hackathon defining feature #1
// Every agent decision is recorded on Mantle as a permanent, verifiable log.
// ─────────────────────────────────────────────────────────────────────────────

// Benchmark event format stored on-chain:
// Each decision is encoded as a JSON string emitted via a no-value transfer
// to a known sink address. This approach requires only MNT gas, no contract
// deployment — agents can start benchmarking immediately.
export const BENCHMARK_SINK_ADDRESS = '0x0000000000000000000000000000000000000001'

// ─────────────────────────────────────────────────────────────────────────────
// Agent defaults & guardrails
// ─────────────────────────────────────────────────────────────────────────────

export const MANTLE_AGENT_DEFAULTS = {
  DEFAULT_NETWORK:         'testnet' as MantleNetwork,
  LOOP_INTERVAL_MS:        120_000,     // 2 minutes — same cadence as BNB + Celo agents
  MIN_MNT_GAS_RESERVE:     0.05,        // keep at least 0.05 MNT for gas
  MAX_TRADE_PCT:           15,          // single trade <= 15% of portfolio
  MAX_DAILY_TRADES:        10,          // no more than 10 trades per day
  MIN_TRADE_USD:           1.0,         // minimum $1 trade size
  MAX_DRAWDOWN_PCT:        20,          // pause agent if drawdown exceeds 20%
  SIGNAL_SCORE_BUY:        65,          // signal score >= 65 → consider BUY
  SIGNAL_SCORE_SELL:       35,          // signal score <= 35 → consider SELL
}

export const MANTLE_AGENT_RULES = {
  ...MANTLE_AGENT_DEFAULTS,
}

export const MANTLE_NETWORK_LABELS: Record<MantleNetwork, string> = {
  mainnet: 'Mantle Mainnet',
  testnet: 'Mantle Sepolia Testnet',
}
