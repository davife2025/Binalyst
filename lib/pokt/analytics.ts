/**
 * lib/pokt/analytics.ts — Session P5 (new file)
 *
 * POKT Token Analytics data fetchers.
 * Aggregates price history, PIP-41 burn/mint economics, computed-unit
 * trends, and relay volume series into a single cached response.
 *
 * PURELY ADDITIVE — imports only from lib/pokt/config.ts and lib/pokt/poktscan.ts.
 *
 * Data sources:
 *   CoinGecko public API  — price + market cap history (no key, rate-limited)
 *   POKTscan GraphQL      — CU + relay time-series (public)
 *   Derived calculation   — burn/mint delta from PIP-41 parameters
 *
 * All fetches are best-effort; on failure the affected series returns []
 * so the UI degrades gracefully rather than hard-crashing.
 */

import { POKT_TOKENOMICS, POKTSCAN_API } from './config'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PricePoint {
  ts:       number   // unix ms
  price:    number   // USD
  mcap:     number   // USD market cap
  volume:   number   // 24h volume USD
}

export interface BurnMintPoint {
  ts:       number
  burned:   number   // POKT burned in this period
  minted:   number   // POKT minted back (burned × 0.975)
  netDelta: number   // minted − burned (always negative = deflationary)
}

export interface CUPoint {
  ts:    number
  cus:   number   // computed units in this period
  relays: number
}

export interface SupplySnapshot {
  circulatingSupply:  number
  stakedSupply:       number
  burnedAllTime:      number   // estimated from relay history
  mintRatio:          number   // 0.975
  burnDeflationPct:   number   // 2.5
  supplierSharePct:   number   // 79
  validatorSharePct:  number   // 14
  daoSharePct:        number   // 4.5
  sourceOwnerSharePct: number  // 2.5
}

export interface POKTAnalyticsData {
  priceHistory:   PricePoint[]
  burnMintSeries: BurnMintPoint[]
  cuSeries:       CUPoint[]
  supply:         SupplySnapshot
  currentPrice:   number | null
  priceChange24h: number | null   // percentage
  priceChange7d:  number | null
  fetchedAt:      number
  dataSource:     { price: string; metrics: string }
}

// ─────────────────────────────────────────────────────────────────────────────
// CoinGecko — price history
// ─────────────────────────────────────────────────────────────────────────────

async function fetchPriceHistory(days: number): Promise<PricePoint[]> {
  try {
    const url = `https://api.coingecko.com/api/v3/coins/pocket-network/market_chart?vs_currency=usd&days=${days}&interval=${days <= 7 ? 'hourly' : 'daily'}`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return []

    const data = await res.json() as {
      prices:        [number, number][]
      market_caps:   [number, number][]
      total_volumes: [number, number][]
    }

    return data.prices.map(([ts, price], i) => ({
      ts,
      price,
      mcap:   data.market_caps[i]?.[1]   ?? 0,
      volume: data.total_volumes[i]?.[1] ?? 0,
    }))
  } catch {
    return []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CoinGecko — current price + 24h/7d change
// ─────────────────────────────────────────────────────────────────────────────

interface CoinGeckoCurrent {
  currentPrice:   number | null
  priceChange24h: number | null
  priceChange7d:  number | null
}

async function fetchCurrentPrice(): Promise<CoinGeckoCurrent> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/coins/pocket-network?localization=false&tickers=false&community_data=false&developer_data=false',
      { signal: AbortSignal.timeout(6000) },
    )
    if (!res.ok) return { currentPrice: null, priceChange24h: null, priceChange7d: null }

    const data = await res.json() as {
      market_data?: {
        current_price?: { usd?: number }
        price_change_percentage_24h?: number
        price_change_percentage_7d?:  number
      }
    }
    const md = data.market_data
    return {
      currentPrice:   md?.current_price?.usd           ?? null,
      priceChange24h: md?.price_change_percentage_24h  ?? null,
      priceChange7d:  md?.price_change_percentage_7d   ?? null,
    }
  } catch {
    return { currentPrice: null, priceChange24h: null, priceChange7d: null }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POKTscan GraphQL — daily CU + relay time-series (last 30 days)
// ─────────────────────────────────────────────────────────────────────────────

const CU_TIMESERIES_QUERY = `
  query {
    getDailyMetrics(days: 30) {
      date
      total_compute_units
      total_relays
    }
  }
`

interface DailyMetric {
  date:                 string
  total_compute_units:  number
  total_relays:         number
}

async function fetchCUSeries(): Promise<CUPoint[]> {
  try {
    const res = await fetch(POKTSCAN_API.graphql, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ query: CU_TIMESERIES_QUERY }),
      signal:  AbortSignal.timeout(8000),
    })
    if (!res.ok) return []

    const data = await res.json() as {
      data?: { getDailyMetrics?: DailyMetric[] }
    }
    const metrics = data?.data?.getDailyMetrics ?? []

    return metrics.map(m => ({
      ts:     new Date(m.date).getTime(),
      cus:    m.total_compute_units ?? 0,
      relays: m.total_relays        ?? 0,
    })).sort((a, b) => a.ts - b.ts)
  } catch {
    return []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Derive burn/mint series from CU series
// Under PIP-41: for every relay batch, compute units burned → 97.5% minted
// We approximate: 1 CU ≈ 1 POKT burn event (simplified model)
// Real burn = CUs × per-CU cost (varies); we use relative proportions
// ─────────────────────────────────────────────────────────────────────────────

function deriveBurnMintSeries(cuSeries: CUPoint[]): BurnMintPoint[] {
  if (!cuSeries.length) return []

  // Scale factor: normalise to show meaningful numbers
  // We use CUs as a proxy for burn activity (higher CU = more burn)
  const maxCU = Math.max(...cuSeries.map(p => p.cus))
  const scale  = maxCU > 0 ? 1_000_000 / maxCU : 1  // scale to ~1M POKT range

  return cuSeries.map(p => {
    const burned   = p.cus * scale
    const minted   = burned * POKT_TOKENOMICS.MINT_RATIO   // 97.5%
    const netDelta = minted - burned                          // always negative

    return { ts: p.ts, burned, minted, netDelta }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Supply snapshot — from tokenomics constants + POKTscan staked supply
// ─────────────────────────────────────────────────────────────────────────────

async function fetchSupplySnapshot(): Promise<SupplySnapshot> {
  let stakedSupply = 330_800_000  // fallback from docs

  try {
    const res = await fetch(POKTSCAN_API.graphql, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ query: '{ getSummary { staked_tokens } }' }),
      signal:  AbortSignal.timeout(5000),
    })
    if (res.ok) {
      const d = await res.json() as { data?: { getSummary?: { staked_tokens?: string } } }
      const raw = parseFloat(d?.data?.getSummary?.staked_tokens ?? '0')
      if (raw > 0) stakedSupply = raw
    }
  } catch { /* use fallback */ }

  return {
    circulatingSupply:   POKT_TOKENOMICS.CIRCULATING_SUPPLY,
    stakedSupply,
    burnedAllTime:       0,    // not directly available from public API
    mintRatio:           POKT_TOKENOMICS.MINT_RATIO,
    burnDeflationPct:    POKT_TOKENOMICS.BURN_DEFLATION_PCT,
    supplierSharePct:    POKT_TOKENOMICS.SUPPLIER_SHARE_PCT,
    validatorSharePct:   POKT_TOKENOMICS.VALIDATOR_SHARE_PCT,
    daoSharePct:         POKT_TOKENOMICS.DAO_SHARE_PCT,
    sourceOwnerSharePct: POKT_TOKENOMICS.SOURCE_OWNER_SHARE_PCT,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main aggregator
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchPOKTAnalytics(days = 30): Promise<POKTAnalyticsData> {
  // Fire all fetches in parallel
  const [priceHistory, currentPriceData, cuSeries, supply] = await Promise.all([
    fetchPriceHistory(days),
    fetchCurrentPrice(),
    fetchCUSeries(),
    fetchSupplySnapshot(),
  ])

  const burnMintSeries = deriveBurnMintSeries(cuSeries)

  return {
    priceHistory,
    burnMintSeries,
    cuSeries,
    supply,
    currentPrice:   currentPriceData.currentPrice,
    priceChange24h: currentPriceData.priceChange24h,
    priceChange7d:  currentPriceData.priceChange7d,
    fetchedAt:      Date.now(),
    dataSource: {
      price:   priceHistory.length ? 'coingecko' : 'unavailable',
      metrics: cuSeries.length     ? 'poktscan'  : 'unavailable',
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Server-side cache (60s TTL)
// ─────────────────────────────────────────────────────────────────────────────

let _analyticsCache: POKTAnalyticsData | null = null
let _analyticsCacheAt = 0
const ANALYTICS_CACHE_TTL = 60_000

export async function getPOKTAnalytics(force = false): Promise<POKTAnalyticsData> {
  if (!force && _analyticsCache && Date.now() - _analyticsCacheAt < ANALYTICS_CACHE_TTL) {
    return _analyticsCache
  }
  const data = await fetchPOKTAnalytics()
  _analyticsCache   = data
  _analyticsCacheAt = Date.now()
  return data
}
