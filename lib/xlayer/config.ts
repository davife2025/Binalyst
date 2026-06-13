/**
 * lib/xlayer/config.ts
 * Session 1: X Layer chain configuration.
 *
 * SAFE: This file is entirely new. Nothing in the existing BSC/BNB build
 * references it. It lives in its own folder (lib/xlayer/) and exports
 * constants that are only imported by new X Layer files.
 */

// ─────────────────────────────────────────────────────────────────────────────
// X Layer (OKX EVM chain) — chainId 196
// ─────────────────────────────────────────────────────────────────────────────

export const XLAYER_CHAIN_ID      = 196
export const XLAYER_CHAIN_ID_HEX  = '0xC4'          // 196 in hex — used by MetaMask/wallet_switchEthereumChain
export const XLAYER_CHAIN_NAME    = 'X Layer Mainnet'

export const XLAYER_RPC_PRIMARY   = 'https://rpc.xlayer.tech'
export const XLAYER_RPC_BACKUP    = 'https://xlayerrpc.okx.com'

export const XLAYER_EXPLORER      = 'https://www.oklink.com/xlayer'
export const XLAYER_EXPLORER_TX   = (hash: string) => `${XLAYER_EXPLORER}/tx/${hash}`
export const XLAYER_EXPLORER_ADDR = (addr: string) => `${XLAYER_EXPLORER}/address/${addr}`

// Native token
export const XLAYER_NATIVE_SYMBOL   = 'OKB'
export const XLAYER_NATIVE_DECIMALS = 18

// Uniswap V4 on X Layer
export const UNISWAP_V4_POOL_MANAGER = '0x9a13510627fe66e71cA1FF0c0e4cE13E5A5b64d7'  // replace with verified address post-deploy
export const UNISWAP_V4_ROUTER       = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'  // replace with verified address post-deploy

// Eulr.fun launchpad (Method 2 deployment)
export const EULR_LAUNCHPAD_URL = 'https://eulr.fun'

// Competition submission
export const XLAYER_COMPETITION_FORM    = 'https://forms.gle/worldcuphooks'   // replace with actual Google Form URL
export const XLAYER_COMPETITION_DEADLINE = new Date('2025-07-12T23:59:00Z').getTime()
export const XLAYER_COMPETITION_X_TAG   = '@XLayerOfficial'

// ─────────────────────────────────────────────────────────────────────────────
// ERC-20 tokens on X Layer (World Cup country tokens + stables)
// Add more as the Hook ecosystem grows
// ─────────────────────────────────────────────────────────────────────────────

export const XLAYER_TOKENS: Record<string, {
  symbol:   string
  name:     string
  address:  string
  decimals: number
  country?: string   // ISO country code — used for World Cup theming
  flag?:    string
}> = {
  // Stablecoins (core liquidity)
  USDT: {
    symbol:   'USDT',
    name:     'Tether USD',
    address:  '0x1E4a5963aBFD975d8c9021ce480b42188849D41d',
    decimals: 6,
  },
  USDC: {
    symbol:   'USDC',
    name:     'USD Coin',
    address:  '0x74b7F16337b8972027F6196A17a631aC6dE26d22',
    decimals: 6,
  },
  OKB: {
    symbol:   'OKB',
    name:     'OKB',
    address:  '0xe538905cf8410324e03A5A23C1c177a474D59b2b',
    decimals: 18,
  },
  WETH: {
    symbol:   'WETH',
    name:     'Wrapped Ether',
    address:  '0x5A77f1443D16ee5761d310e38b62f77f726bC71c',
    decimals: 18,
  },

  // World Cup country tokens — deployed via Hook/launchpad
  // Addresses below are placeholders — update after deploy
  BRA: { symbol: 'BRA', name: 'Brazil Token',    address: '', decimals: 18, country: 'BR', flag: '🇧🇷' },
  ARG: { symbol: 'ARG', name: 'Argentina Token', address: '', decimals: 18, country: 'AR', flag: '🇦🇷' },
  FRA: { symbol: 'FRA', name: 'France Token',    address: '', decimals: 18, country: 'FR', flag: '🇫🇷' },
  GER: { symbol: 'GER', name: 'Germany Token',   address: '', decimals: 18, country: 'DE', flag: '🇩🇪' },
  ENG: { symbol: 'ENG', name: 'England Token',   address: '', decimals: 18, country: 'GB', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  ESP: { symbol: 'ESP', name: 'Spain Token',     address: '', decimals: 18, country: 'ES', flag: '🇪🇸' },
  POR: { symbol: 'POR', name: 'Portugal Token',  address: '', decimals: 18, country: 'PT', flag: '🇵🇹' },
  NED: { symbol: 'NED', name: 'Netherlands Token', address: '', decimals: 18, country: 'NL', flag: '🇳🇱' },
}

// ─────────────────────────────────────────────────────────────────────────────
// Wallet switch helpers — used in AgentWalletTab chain selector
// ─────────────────────────────────────────────────────────────────────────────

export const XLAYER_NETWORK_PARAMS = {
  chainId:           XLAYER_CHAIN_ID_HEX,
  chainName:         XLAYER_CHAIN_NAME,
  nativeCurrency: {
    name:     'OKB',
    symbol:   'OKB',
    decimals: 18,
  },
  rpcUrls:         [XLAYER_RPC_PRIMARY, XLAYER_RPC_BACKUP],
  blockExplorerUrls: [XLAYER_EXPLORER],
}

export const BSC_NETWORK_PARAMS = {
  chainId:           '0x38',   // 56
  chainName:         'BNB Smart Chain',
  nativeCurrency: {
    name:     'BNB',
    symbol:   'BNB',
    decimals: 18,
  },
  rpcUrls:           ['https://bsc-dataseed1.binance.org'],
  blockExplorerUrls: ['https://bscscan.com'],
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook fee tiers — dynamic based on World Cup match state
// These are the default fee values baked into WorldCupHook.sol
// ─────────────────────────────────────────────────────────────────────────────

export const HOOK_FEE_TIERS = {
  PRE_MATCH:  500,    // 0.05% — low activity before kick-off
  LIVE:       3000,   // 0.30% — match in progress
  GOAL:       8000,   // 0.80% — spike on goal event
  POST_MATCH: 1000,   // 0.10% — cooling off period
} as const

export type HookFeeState = keyof typeof HOOK_FEE_TIERS

export function feeStateToPct(state: HookFeeState): string {
  return (HOOK_FEE_TIERS[state] / 10000).toFixed(2) + '%'
}

export function bipsToDisplay(bips: number): string {
  return (bips / 10000 * 100).toFixed(2) + '%'
}
