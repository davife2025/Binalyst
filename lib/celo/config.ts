/**
 * lib/celo/config.ts — Session J (new file)
 *
 * Celo network configuration for the Celo Payments Agent
 * (Onchain Agents Hackathon — Real World Payments & Everyday Applications).
 *
 * This file is purely additive. It does not modify, replace, or depend on
 * lib/twak/client.ts or any BNB Chain config — the BNB competition agent
 * is completely untouched.
 *
 * Addresses verified against CeloScan / Mento Protocol docs (June 2026):
 *  - CELO mainnet token:  0x471EcE3750Da237f93B8E339c536989b8978a438
 *  - cUSD mainnet token:  0x765DE816845861e75A25fCA122bb6898B8B1282a
 *  - Mento Broker (mainnet): 0x777A8255cA72412f0d706dc03C9D1987306B4CaD
 *  - Alfajores CELO:      0xF194afDf50B03e69Bd7D057c1Aa9e10c9954E4C9
 *  - Alfajores cUSD:      0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1
 *
 * IMPORTANT: Mento swap support (Session K stretch goal) is mainnet-only —
 * the Broker/BiPoolManager addresses below have not been verified on
 * Alfajores. swapViaMento() will throw on testnet until that's confirmed.
 */

export type CeloNetwork = 'mainnet' | 'alfajores'

// ─────────────────────────────────────────────────────────────────────────────
// Chain IDs & RPC endpoints
// ─────────────────────────────────────────────────────────────────────────────

export const CELO_MAINNET_CHAIN_ID   = 42220
export const CELO_ALFAJORES_CHAIN_ID = 44787

export const CELO_CHAIN_ID: Record<CeloNetwork, number> = {
  mainnet:   CELO_MAINNET_CHAIN_ID,
  alfajores: CELO_ALFAJORES_CHAIN_ID,
}

export const CELO_RPC: Record<CeloNetwork, string> = {
  mainnet:   'https://forno.celo.org',
  alfajores: 'https://alfajores-forno.celo-testnet.org',
}

// Backup RPCs (public, no key required)
export const CELO_RPC_BACKUP: Record<CeloNetwork, string> = {
  mainnet:   'https://rpc.ankr.com/celo',
  alfajores: 'https://alfajores-forno.celo-testnet.org',
}

export const CELO_EXPLORER: Record<CeloNetwork, string> = {
  mainnet:   'https://celoscan.io',
  alfajores: 'https://alfajores.celoscan.io',
}

// ─────────────────────────────────────────────────────────────────────────────
// Token addresses
// ─────────────────────────────────────────────────────────────────────────────

export interface CeloTokenInfo {
  symbol:   string
  address:  string
  decimals: number
  isNative?: boolean   // CELO is also a first-class native gas token
}

export const CELO_TOKENS: Record<CeloNetwork, Record<string, CeloTokenInfo>> = {
  mainnet: {
    CELO: { symbol: 'CELO', address: '0x471EcE3750Da237f93B8E339c536989b8978a438', decimals: 18, isNative: true },
    cUSD: { symbol: 'cUSD', address: '0x765DE816845861e75A25fCA122bb6898B8B1282a', decimals: 18 },
  },
  alfajores: {
    CELO: { symbol: 'CELO', address: '0xF194afDf50B03e69Bd7D057c1Aa9e10c9954E4C9', decimals: 18, isNative: true },
    cUSD: { symbol: 'cUSD', address: '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1', decimals: 18 },
  },
}

// "USD" reference token for portfolio valuation — cUSD is a 1:1 USD-pegged
// Mento stablecoin, so we treat its balance as USD value directly.
export const USD_REFERENCE_TOKEN = 'cUSD'

// ─────────────────────────────────────────────────────────────────────────────
// Mento Protocol (DEX / stablecoin swaps) — mainnet only for now
// ─────────────────────────────────────────────────────────────────────────────

export const MENTO_BROKER_ADDRESS: Record<CeloNetwork, string | null> = {
  mainnet:   '0x777A8255cA72412f0d706dc03C9D1987306B4CaD',
  alfajores: null,   // not verified — swaps disabled on testnet
}

export const MENTO_BIPOOL_MANAGER_ADDRESS: Record<CeloNetwork, string | null> = {
  mainnet:   '0x22d9db95E6Ae61c104A7B6F6C78D7993B94ec901',
  alfajores: null,
}

// ─────────────────────────────────────────────────────────────────────────────
// Celo Payments Agent — defaults & guardrails
// (Mirrors the shape of COMPETITION_RULES in lib/twak/client.ts but
//  independent — these are NOT competition rules, just sane agent defaults.)
// ─────────────────────────────────────────────────────────────────────────────

export const CELO_AGENT_DEFAULTS = {
  DEFAULT_NETWORK:        'alfajores' as CeloNetwork,
  LOOP_INTERVAL_MS:        120_000,     // 2 minutes — same cadence as BNB agent
  MIN_NATIVE_GAS_RESERVE:  0.01,        // keep at least 0.01 CELO for gas
  MAX_PAYMENT_PCT:         20,          // a single payment <= 20% of cUSD balance
  MAX_DAILY_PAYMENTS:      10,
  MIN_PAYMENT_USD:         0.01,        // dust floor
}

export const CELO_AGENT_RULES = {
  ...CELO_AGENT_DEFAULTS,
}
