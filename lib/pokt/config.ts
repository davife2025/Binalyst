/**
 * lib/pokt/config.ts — Session P1 (new file)
 *
 * Pocket Network (POKT) configuration for the Binalyst POKT Agent.
 *
 * PURELY ADDITIVE — does not import from, modify, or depend on any
 * existing Binalyst file (lib/agentStore.ts, lib/store.ts, lib/twak/,
 * lib/binance.ts, lib/celo/, lib/mantle/, lib/sui/, lib/claude.ts, etc.).
 * The BNB, Celo, Mantle, and Sui agents are completely untouched.
 *
 * Pocket Network (POKT) is a decentralised RPC infrastructure protocol.
 * Instead of a single centralised provider (Infura / Alchemy), POKT routes
 * requests through 5,000+ independent node operators across 60+ countries,
 * eliminating censorship, downtime, and single-points-of-failure.
 *
 * Shannon upgrade (launched June 3 2025) expanded POKT beyond blockchain RPC
 * to AI models, climate datasets, IoT feeds and other open APIs — making it
 * the world's first permissionless Open API network.
 *
 * Public POKT RPC endpoints used here require no API key for basic usage.
 * When POKT_GATEWAY_KEY is set in env, requests are routed through the
 * authenticated Grove/Nodies gateway for higher rate limits.
 *
 * RPC base URLs verified June 2026:
 *   ETH mainnet : https://eth.api.pocket.network
 *   BSC         : https://bsc.api.pocket.network
 *   Polygon     : https://poly.api.pocket.network
 *   Solana      : https://solana.api.pocket.network  (JSON-RPC)
 *   Avalanche   : https://avax.api.pocket.network
 *   Arbitrum    : https://arbitrum-one.api.pocket.network
 *   Optimism    : https://optimism.api.pocket.network
 *   Base        : https://base.api.pocket.network
 *   Gnosis      : https://gnosischain-mainnet.api.pocket.network
 *   Harmony     : https://harmony-0.api.pocket.network
 *
 * POKTscan API: https://poktscan.com  (public, no key needed for read metrics)
 * Official staking: https://staking.pocket.network
 * Explorer: https://explorer.pocket.network/pocket-mainnet
 */

// ─────────────────────────────────────────────────────────────────────────────
// Supported chains via POKT RPC
// ─────────────────────────────────────────────────────────────────────────────

export interface POKTChain {
  id:           string        // internal key, e.g. 'ethereum'
  name:         string        // human label, e.g. 'Ethereum'
  symbol:       string        // native token, e.g. 'ETH'
  chainId:      number | null // EVM chain ID (null for non-EVM like Solana)
  rpcUrl:       string        // POKT public RPC endpoint
  rpcUrlKeyed:  string        // POKT gateway URL when API key is present
  explorer:     string        // block explorer URL
  isEVM:        boolean
  isTestnet:    boolean
  category:     'L1' | 'L2' | 'Sidechain' | 'Non-EVM'
  nativeDenom:  string        // human-readable native token name
  icon:         string        // emoji icon for UI
}

export const POKT_CHAINS: Record<string, POKTChain> = {
  ethereum: {
    id: 'ethereum', name: 'Ethereum', symbol: 'ETH', chainId: 1,
    rpcUrl:      'https://eth.api.pocket.network',
    rpcUrlKeyed: 'https://eth-mainnet.gateway.pokt.network/v1/lb/',
    explorer:    'https://etherscan.io',
    isEVM: true, isTestnet: false, category: 'L1',
    nativeDenom: 'Ether', icon: '⟠',
  },
  bsc: {
    id: 'bsc', name: 'BNB Chain', symbol: 'BNB', chainId: 56,
    rpcUrl:      'https://bsc.api.pocket.network',
    rpcUrlKeyed: 'https://bsc-mainnet.gateway.pokt.network/v1/lb/',
    explorer:    'https://bscscan.com',
    isEVM: true, isTestnet: false, category: 'L1',
    nativeDenom: 'BNB', icon: '🟡',
  },
  polygon: {
    id: 'polygon', name: 'Polygon', symbol: 'MATIC', chainId: 137,
    rpcUrl:      'https://poly.api.pocket.network',
    rpcUrlKeyed: 'https://poly-mainnet.gateway.pokt.network/v1/lb/',
    explorer:    'https://polygonscan.com',
    isEVM: true, isTestnet: false, category: 'Sidechain',
    nativeDenom: 'MATIC', icon: '🟣',
  },
  avalanche: {
    id: 'avalanche', name: 'Avalanche C-Chain', symbol: 'AVAX', chainId: 43114,
    rpcUrl:      'https://avax.api.pocket.network',
    rpcUrlKeyed: 'https://avax-mainnet.gateway.pokt.network/v1/lb/',
    explorer:    'https://snowtrace.io',
    isEVM: true, isTestnet: false, category: 'L1',
    nativeDenom: 'AVAX', icon: '🔺',
  },
  arbitrum: {
    id: 'arbitrum', name: 'Arbitrum One', symbol: 'ETH', chainId: 42161,
    rpcUrl:      'https://arbitrum-one.api.pocket.network',
    rpcUrlKeyed: 'https://arbitrum-one.gateway.pokt.network/v1/lb/',
    explorer:    'https://arbiscan.io',
    isEVM: true, isTestnet: false, category: 'L2',
    nativeDenom: 'ETH', icon: '🔵',
  },
  optimism: {
    id: 'optimism', name: 'Optimism', symbol: 'ETH', chainId: 10,
    rpcUrl:      'https://optimism.api.pocket.network',
    rpcUrlKeyed: 'https://optimism-mainnet.gateway.pokt.network/v1/lb/',
    explorer:    'https://optimistic.etherscan.io',
    isEVM: true, isTestnet: false, category: 'L2',
    nativeDenom: 'ETH', icon: '🔴',
  },
  base: {
    id: 'base', name: 'Base', symbol: 'ETH', chainId: 8453,
    rpcUrl:      'https://base.api.pocket.network',
    rpcUrlKeyed: 'https://base-mainnet.gateway.pokt.network/v1/lb/',
    explorer:    'https://basescan.org',
    isEVM: true, isTestnet: false, category: 'L2',
    nativeDenom: 'ETH', icon: '🔷',
  },
  gnosis: {
    id: 'gnosis', name: 'Gnosis Chain', symbol: 'xDAI', chainId: 100,
    rpcUrl:      'https://gnosischain-mainnet.api.pocket.network',
    rpcUrlKeyed: 'https://gnosis-mainnet.gateway.pokt.network/v1/lb/',
    explorer:    'https://gnosisscan.io',
    isEVM: true, isTestnet: false, category: 'Sidechain',
    nativeDenom: 'xDAI', icon: '🦉',
  },
  solana: {
    id: 'solana', name: 'Solana', symbol: 'SOL', chainId: null,
    rpcUrl:      'https://solana.api.pocket.network',
    rpcUrlKeyed: 'https://solana-mainnet.gateway.pokt.network/v1/lb/',
    explorer:    'https://explorer.solana.com',
    isEVM: false, isTestnet: false, category: 'Non-EVM',
    nativeDenom: 'SOL', icon: '◎',
  },
  harmony: {
    id: 'harmony', name: 'Harmony One', symbol: 'ONE', chainId: 1666600000,
    rpcUrl:      'https://harmony-0.api.pocket.network',
    rpcUrlKeyed: 'https://harmony-0.gateway.pokt.network/v1/lb/',
    explorer:    'https://explorer.harmony.one',
    isEVM: true, isTestnet: false, category: 'L1',
    nativeDenom: 'ONE', icon: '💙',
  },
}

// Ordered list for UI display
export const POKT_CHAIN_LIST: POKTChain[] = [
  POKT_CHAINS.ethereum,
  POKT_CHAINS.bsc,
  POKT_CHAINS.polygon,
  POKT_CHAINS.arbitrum,
  POKT_CHAINS.optimism,
  POKT_CHAINS.base,
  POKT_CHAINS.avalanche,
  POKT_CHAINS.gnosis,
  POKT_CHAINS.solana,
  POKT_CHAINS.harmony,
]

// ─────────────────────────────────────────────────────────────────────────────
// POKT Network own chain (Cosmos / Shannon)
// ─────────────────────────────────────────────────────────────────────────────

export const POKT_NETWORK_CHAIN = {
  name:         'Pocket Network',
  cosmosChainId:'pocket-mainnet',
  rpcUrl:       'https://pocket-rpc.lavenderfive.com',
  restUrl:      'https://pocket-api.lavenderfive.com',
  explorer:     'https://explorer.pocket.network/pocket-mainnet',
  poktscan:     'https://poktscan.com',
  staking:      'https://staking.pocket.network',
  wallet:       'https://wallet.pocket.network',
  faucet:       'https://faucet.celo.org/alfajores', // no POKT testnet faucet needed
  keplrChainId: 'pocket-mainnet',
}

// ─────────────────────────────────────────────────────────────────────────────
// POKTscan API — public read endpoints, no key required
// ─────────────────────────────────────────────────────────────────────────────

export const POKTSCAN_API = {
  base:       'https://poktscan.com/api',
  graphql:    'https://poktscan.com/graphql',
  metrics:    'https://poktscan.com/api/metrics',      // network-level stats
  validators: 'https://poktscan.com/validators',
  suppliers:  'https://poktscan.com/suppliers',
  params:     'https://poktscan.com/params',
}

// ─────────────────────────────────────────────────────────────────────────────
// POKT tokenomics (PIP-41, January 2026)
// ─────────────────────────────────────────────────────────────────────────────

export const POKT_TOKENOMICS = {
  // PIP-41 mint ratio: for every 100 POKT burned, 97.5 is minted back
  // The 2.5 difference is permanently removed — deflationary by design
  MINT_RATIO:                0.975,
  BURN_DEFLATION_PCT:        2.5,

  // PIP-41 distribution of minted POKT
  SUPPLIER_SHARE_PCT:        79,     // node runners (Suppliers)
  VALIDATOR_SHARE_PCT:       14,     // block proposers
  DAO_SHARE_PCT:             4.5,    // DAO treasury
  SOURCE_OWNER_SHARE_PCT:    2.5,    // source owners

  // Staking minimums
  SUPPLIER_MIN_STAKE:        60_000, // POKT tokens to run a supplier node
  VALIDATOR_MIN_STAKE:       1_000_001, // approx — active pool is top-X by stake
  DELEGATOR_MIN_STAKE:       1,      // delegate to validator via Keplr (1 POKT min)
  APP_MIN_STAKE:             1_000,  // applications staking for relay access

  // Unstaking unbonding period
  UNBONDING_DAYS:            21,

  CIRCULATING_SUPPLY:        2_300_000_000, // ~2.3B POKT as of mid-2026
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent defaults & guardrails (for the POKT Agent tab)
// ─────────────────────────────────────────────────────────────────────────────

export const POKT_AGENT_DEFAULTS = {
  DEFAULT_CHAIN:          'ethereum',
  MAX_QUERY_HISTORY:      50,          // keep last 50 NL queries in memory
  METRICS_CACHE_TTL_MS:   30_000,      // refresh POKTscan metrics every 30s
  RPC_TIMEOUT_MS:         8_000,       // abort RPC call after 8 seconds
  MAX_BLOCK_RANGE:        100,         // max blocks to scan in a log query
}

// ─────────────────────────────────────────────────────────────────────────────
// Supported NL query categories for the AI agent
// ─────────────────────────────────────────────────────────────────────────────

export type POKTQueryCategory =
  | 'balance'        // "what is the ETH balance of 0x..."
  | 'block'          // "what is the latest block on BSC?"
  | 'tx'             // "check transaction 0x..."
  | 'contract'       // "is 0x... a contract?"
  | 'network_health' // "how is the POKT network doing?"
  | 'gas'            // "what are current gas prices on Ethereum?"
  | 'token'          // "what is the USDC balance of 0x..."
  | 'general'        // anything else

export const POKT_QUERY_EXAMPLES: Record<POKTQueryCategory, string[]> = {
  balance:       [
    'What is the ETH balance of 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045?',
    'How much BNB does vitalik.eth hold?',
  ],
  block:         [
    'What is the latest block on Ethereum?',
    'Get block 19000000 on BSC',
  ],
  tx:            [
    'Check transaction 0xabc... on Polygon',
    'What happened in tx 0xdef on Arbitrum?',
  ],
  contract:      [
    'Is 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 a smart contract?',
    'What is the bytecode size of the USDC contract?',
  ],
  network_health: [
    'How is the POKT network doing right now?',
    'How many relays per day on POKT?',
    'How many nodes are on Pocket Network?',
  ],
  gas:           [
    'What are current gas prices on Ethereum?',
    'Base fee on Arbitrum right now?',
  ],
  token:         [
    'What is the USDC balance of 0x...?',
    'Check USDT holdings at 0x...',
  ],
  general:       [
    'Explain how POKT Network works',
    'What chains does Pocket Network support?',
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// MetaMask / Wallet RPC config guide — used in UI
// ─────────────────────────────────────────────────────────────────────────────

export interface WalletRPCConfig {
  chainName:   string
  rpcUrl:      string
  chainId:     string    // hex string for MetaMask
  symbol:      string
  explorerUrl: string
}

export function getPOKTWalletConfig(chainKey: string): WalletRPCConfig | null {
  const chain = POKT_CHAINS[chainKey]
  if (!chain || !chain.isEVM || chain.chainId === null) return null
  return {
    chainName:   `${chain.name} (via POKT)`,
    rpcUrl:      chain.rpcUrl,
    chainId:     '0x' + chain.chainId.toString(16),
    symbol:      chain.symbol,
    explorerUrl: chain.explorer,
  }
}
