/**
 * lib/pokt/poktscan.ts — Session P1 (new file)
 *
 * POKTscan metrics fetcher.
 * Pulls live Pocket Network health data from the public POKTscan API
 * (poktscan.com) — no API key required for read metrics.
 *
 * PURELY ADDITIVE — does not import from or modify any existing Binalyst file.
 *
 * Data fetched:
 *   - 24h relay count (how many RPC requests the network served today)
 *   - 24h computed units (compute resources consumed — key health metric)
 *   - Total staked POKT (TVS)
 *   - Active supplier node count
 *   - Active validator count
 *   - Latest block height on the Pocket chain
 *   - Token circulating supply & price (via CoinGecko public endpoint)
 *
 * POKTscan exposes data primarily via its GraphQL endpoint.
 * We use a small fixed set of queries that cover the metrics displayed
 * in the POKTAgentTab network health dashboard.
 *
 * NOTE: POKTscan does not have a versioned public REST API — the queries
 * below target the GraphQL endpoint. If POKTscan updates their schema,
 * update the query strings here. Fallback values are returned on error
 * so the UI never hard-crashes.
 */

import { POKTSCAN_API, POKT_TOKENOMICS } from './config'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface POKTNetworkMetrics {
  // Relay & compute activity
  relays24h:            number    // total relays in last 24h
  computedUnits24h:     number    // total compute units in last 24h (raw)
  computedUnitsLabel:   string    // human label, e.g. "568.5B"

  // Node counts
  supplierCount:        number    // staked supplier nodes
  validatorCount:       number    // active validators (max 20)

  // Staking
  stakedSupplyPOKT:     number    // total POKT staked by suppliers (raw)
  stakedSupplyLabel:    string    // e.g. "330.8M POKT"

  // Chain state
  latestBlock:          number    // latest block on Pocket Network chain
  latestBlockTime:      string    // ISO timestamp of latest block

  // Token price (from CoinGecko — best-effort, may be null)
  priceUSD:             number | null
  circulatingSupply:    number

  // Metadata
  fetchedAt:            number    // unix ms
  dataSource:           'poktscan' | 'fallback'
}

// Raw GraphQL response shapes (partial — only fields we consume)
interface GQLSummaryResponse {
  data?: {
    getSummary?: {
      total_relays_24h?:   number
      total_compute_24h?:  number
      staked_nodes?:       number
      total_validators?:   number
      staked_tokens?:      string   // large number as string
      height?:             number
      last_block_time?:    string
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatLargeNumber(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T'
  if (n >= 1e9)  return (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6)  return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3)  return (n / 1e3).toFixed(1) + 'K'
  return String(n)
}

// ─────────────────────────────────────────────────────────────────────────────
// GraphQL queries
// ─────────────────────────────────────────────────────────────────────────────

const SUMMARY_QUERY = `
  query {
    getSummary {
      total_relays_24h
      total_compute_24h
      staked_nodes
      total_validators
      staked_tokens
      height
      last_block_time
    }
  }
`

// ─────────────────────────────────────────────────────────────────────────────
// POKT token price — CoinGecko public (no key, rate limited)
// ─────────────────────────────────────────────────────────────────────────────

async function fetchPOKTPrice(): Promise<number | null> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=pocket-network&vs_currencies=usd',
      { signal: AbortSignal.timeout(5000) },
    )
    if (!res.ok) return null
    const data = await res.json() as { 'pocket-network'?: { usd?: number } }
    return data['pocket-network']?.usd ?? null
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main fetch function
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchPOKTNetworkMetrics(): Promise<POKTNetworkMetrics> {
  const FALLBACK: POKTNetworkMetrics = {
    relays24h:           0,
    computedUnits24h:    0,
    computedUnitsLabel:  'N/A',
    supplierCount:       5508,  // last known value from docs
    validatorCount:      20,
    stakedSupplyPOKT:    330_800_000,
    stakedSupplyLabel:   '330.8M POKT',
    latestBlock:         0,
    latestBlockTime:     new Date().toISOString(),
    priceUSD:            null,
    circulatingSupply:   POKT_TOKENOMICS.CIRCULATING_SUPPLY,
    fetchedAt:           Date.now(),
    dataSource:          'fallback',
  }

  try {
    // Fire GraphQL + price fetch in parallel
    const [gqlRes, price] = await Promise.all([
      fetch(POKTSCAN_API.graphql, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ query: SUMMARY_QUERY }),
        signal:  AbortSignal.timeout(8000),
      }),
      fetchPOKTPrice(),
    ])

    if (!gqlRes.ok) {
      return { ...FALLBACK, priceUSD: price }
    }

    const gqlData = await gqlRes.json() as GQLSummaryResponse
    const s = gqlData?.data?.getSummary

    if (!s) {
      return { ...FALLBACK, priceUSD: price }
    }

    const relays24h         = s.total_relays_24h   ?? 0
    const computedUnits24h  = s.total_compute_24h  ?? 0
    const supplierCount     = s.staked_nodes        ?? FALLBACK.supplierCount
    const validatorCount    = s.total_validators    ?? FALLBACK.validatorCount
    const stakedSupplyPOKT  = parseFloat(s.staked_tokens ?? '0') || FALLBACK.stakedSupplyPOKT
    const latestBlock       = s.height              ?? 0
    const latestBlockTime   = s.last_block_time     ?? new Date().toISOString()

    return {
      relays24h,
      computedUnits24h,
      computedUnitsLabel:  formatLargeNumber(computedUnits24h),
      supplierCount,
      validatorCount,
      stakedSupplyPOKT,
      stakedSupplyLabel:   formatLargeNumber(stakedSupplyPOKT) + ' POKT',
      latestBlock,
      latestBlockTime,
      priceUSD:            price,
      circulatingSupply:   POKT_TOKENOMICS.CIRCULATING_SUPPLY,
      fetchedAt:           Date.now(),
      dataSource:          'poktscan',
    }
  } catch {
    // Network error — return fallback silently so UI never crashes
    const price = await fetchPOKTPrice().catch(() => null)
    return { ...FALLBACK, priceUSD: price }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// In-memory cache (server-side, 30s TTL)
// ─────────────────────────────────────────────────────────────────────────────

let _metricsCache: POKTNetworkMetrics | null = null
let _metricsCacheAt = 0
const CACHE_TTL_MS = 30_000

export async function getPOKTNetworkMetrics(force = false): Promise<POKTNetworkMetrics> {
  if (!force && _metricsCache && Date.now() - _metricsCacheAt < CACHE_TTL_MS) {
    return _metricsCache
  }
  const metrics = await fetchPOKTNetworkMetrics()
  _metricsCache  = metrics
  _metricsCacheAt = Date.now()
  return metrics
}

// ─────────────────────────────────────────────────────────────────────────────
// Derived health score (0–100) for the UI health gauge
// ─────────────────────────────────────────────────────────────────────────────

export function computeNetworkHealthScore(metrics: POKTNetworkMetrics): {
  score:  number
  label:  'Excellent' | 'Good' | 'Degraded' | 'Unknown'
  color:  string
} {
  if (metrics.dataSource === 'fallback') {
    return { score: 0, label: 'Unknown', color: 'var(--text3)' }
  }

  let score = 0

  // Relay activity — 219M relays/24h is a healthy baseline
  if (metrics.relays24h > 100_000_000) score += 40
  else if (metrics.relays24h > 10_000_000) score += 25
  else if (metrics.relays24h > 1_000_000)  score += 10

  // Node count — 5000+ is healthy
  if (metrics.supplierCount > 4000) score += 30
  else if (metrics.supplierCount > 2000) score += 20
  else if (metrics.supplierCount > 500)  score += 10

  // Validators active
  if (metrics.validatorCount >= 15) score += 20
  else if (metrics.validatorCount >= 10) score += 10

  // Latest block — if > 0 chain is producing
  if (metrics.latestBlock > 0) score += 10

  const label = score >= 80 ? 'Excellent' : score >= 55 ? 'Good' : 'Degraded'
  const color  = score >= 80 ? 'var(--green)' : score >= 55 ? 'var(--yellow)' : 'var(--red)'
  return { score, label, color }
}
