/**
 * lib/pokt/rpcRouter.ts — Session P4 (new file)
 *
 * POKT RPC Router.
 * A drop-in helper that maps common chain identifiers used elsewhere in
 * Binalyst (BNB, Ethereum, etc.) to their corresponding Pocket Network
 * RPC endpoints. This lets any part of the app optionally route its
 * ethers.js provider through POKT instead of a centralised endpoint —
 * without modifying the existing BNB/Celo/Mantle/Sui agent files.
 *
 * PURELY ADDITIVE — this file only exports functions and constants.
 * Nothing here imports from or modifies any existing Binalyst file.
 *
 * Usage (from any new code — never forced on existing agents):
 *
 *   import { getPOKTProvider, hasPOKTEndpoint } from '@/lib/pokt/rpcRouter'
 *
 *   // Instead of: new ethers.JsonRpcProvider('https://bsc-dataseed.binance.org')
 *   // Optionally:
 *   if (hasPOKTEndpoint('bsc')) {
 *     const provider = getPOKTProvider('bsc')
 *   }
 *
 * Chain key mapping:
 *   The router accepts both POKT chain keys ('ethereum', 'bsc', 'polygon'…)
 *   and common aliases used in the wild ('eth', 'bnb', 'matic', 'arb'…).
 *
 * Fallback behaviour:
 *   If POKT is unavailable (timeout, node error), callers can catch and
 *   fall back to their original provider. The router itself never throws
 *   silently — all errors propagate so the caller decides what to do.
 */

import { ethers }       from 'ethers'
import { POKT_CHAINS }  from './config'

// ─────────────────────────────────────────────────────────────────────────────
// Alias map — common names → POKT chain keys
// ─────────────────────────────────────────────────────────────────────────────

const ALIAS_MAP: Record<string, string> = {
  // Ethereum
  'eth':       'ethereum',
  'ethereum':  'ethereum',
  'mainnet':   'ethereum',
  '1':         'ethereum',

  // BNB / BSC
  'bnb':       'bsc',
  'bsc':       'bsc',
  'binance':   'bsc',
  '56':        'bsc',

  // Polygon
  'matic':     'polygon',
  'polygon':   'polygon',
  '137':       'polygon',

  // Arbitrum
  'arb':       'arbitrum',
  'arbitrum':  'arbitrum',
  '42161':     'arbitrum',

  // Optimism
  'op':        'optimism',
  'optimism':  'optimism',
  '10':        'optimism',

  // Base
  'base':      'base',
  '8453':      'base',

  // Avalanche
  'avax':      'avalanche',
  'avalanche': 'avalanche',
  '43114':     'avalanche',

  // Gnosis
  'gnosis':    'gnosis',
  'xdai':      'gnosis',
  '100':       'gnosis',

  // Solana (non-EVM)
  'sol':       'solana',
  'solana':    'solana',

  // Harmony
  'one':       'harmony',
  'harmony':   'harmony',
  '1666600000':'harmony',
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolve alias → POKT chain key
// ─────────────────────────────────────────────────────────────────────────────

export function resolvePOKTChainKey(alias: string): string | null {
  const lower = alias.toLowerCase().trim()
  const key   = ALIAS_MAP[lower]
  if (!key) return null
  if (!POKT_CHAINS[key]) return null
  return key
}

// ─────────────────────────────────────────────────────────────────────────────
// Check if a POKT endpoint exists for a given alias
// ─────────────────────────────────────────────────────────────────────────────

export function hasPOKTEndpoint(alias: string): boolean {
  return resolvePOKTChainKey(alias) !== null
}

// ─────────────────────────────────────────────────────────────────────────────
// Get POKT RPC URL for a chain alias
// ─────────────────────────────────────────────────────────────────────────────

export function getPOKTRpcUrl(alias: string): string | null {
  const key = resolvePOKTChainKey(alias)
  if (!key) return null
  const chain     = POKT_CHAINS[key]
  const gatewayKey = process.env.POKT_GATEWAY_KEY
  if (gatewayKey && chain.rpcUrlKeyed) {
    return chain.rpcUrlKeyed + gatewayKey
  }
  return chain.rpcUrl
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider cache
// ─────────────────────────────────────────────────────────────────────────────

const _routerProviderCache: Map<string, ethers.JsonRpcProvider> = new Map()

// ─────────────────────────────────────────────────────────────────────────────
// Get an ethers.js provider pointing at a POKT endpoint
// ─────────────────────────────────────────────────────────────────────────────

export function getPOKTProvider(alias: string): ethers.JsonRpcProvider {
  const key = resolvePOKTChainKey(alias)
  if (!key) throw new Error(`No POKT endpoint for chain alias: "${alias}"`)

  const chain = POKT_CHAINS[key]
  if (!chain.isEVM) {
    throw new Error(`Chain "${key}" is non-EVM — use POKTClient.solanaCall() instead`)
  }

  if (!_routerProviderCache.has(key)) {
    const rpcUrl   = getPOKTRpcUrl(alias)!
    const provider = new ethers.JsonRpcProvider(rpcUrl, chain.chainId ?? undefined)
    _routerProviderCache.set(key, provider)
  }

  return _routerProviderCache.get(key)!
}

// ─────────────────────────────────────────────────────────────────────────────
// getProviderWithFallback
// Try POKT first; on failure, fall back to a provided backup URL
// ─────────────────────────────────────────────────────────────────────────────

export async function getProviderWithFallback(
  alias:       string,
  fallbackUrl: string,
  chainId?:    number,
): Promise<{ provider: ethers.JsonRpcProvider; via: 'pokt' | 'fallback' }> {
  const poktUrl = getPOKTRpcUrl(alias)

  if (poktUrl) {
    try {
      const chain    = POKT_CHAINS[resolvePOKTChainKey(alias)!]
      const provider = new ethers.JsonRpcProvider(poktUrl, chain.chainId ?? chainId)

      // Quick liveness check — get block number with 5s timeout
      await Promise.race([
        provider.getBlockNumber(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('POKT timeout')), 5000)
        ),
      ])

      return { provider, via: 'pokt' }
    } catch {
      // POKT unavailable — fall through to backup
    }
  }

  // Fallback
  const provider = new ethers.JsonRpcProvider(fallbackUrl, chainId)
  return { provider, via: 'fallback' }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: list all supported POKT chain aliases
// ─────────────────────────────────────────────────────────────────────────────

export function listPOKTAliases(): { alias: string; chainKey: string; rpcUrl: string }[] {
  const seen = new Set<string>()
  const result: { alias: string; chainKey: string; rpcUrl: string }[] = []

  for (const [alias, key] of Object.entries(ALIAS_MAP)) {
    if (seen.has(key)) continue
    seen.add(key)
    const chain  = POKT_CHAINS[key]
    if (!chain) continue
    result.push({ alias, chainKey: key, rpcUrl: chain.rpcUrl })
  }

  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// BNB Chain convenience — returns POKT BSC provider
// This is the most likely integration point with the existing BNB agent,
// but is NEVER called automatically — it must be explicitly opted in to.
// ─────────────────────────────────────────────────────────────────────────────

export function getPOKTBSCProvider(): ethers.JsonRpcProvider {
  return getPOKTProvider('bsc')
}

export function getPOKTEthProvider(): ethers.JsonRpcProvider {
  return getPOKTProvider('ethereum')
}
