/**
 * app/api/pokt-agent/metrics/route.ts — Session P2 (new file)
 *
 * Live Pocket Network metrics endpoint.
 * Proxies POKTscan GraphQL data to the frontend with 30s server-side caching.
 *
 * PURELY ADDITIVE — zero changes to existing routes.
 *
 * GET /api/pokt-agent/metrics
 *   → { metrics: POKTNetworkMetrics, health: { score, label, color } }
 *
 * GET /api/pokt-agent/metrics?force=1
 *   → bypasses cache, fetches fresh data
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPOKTNetworkMetrics, computeNetworkHealthScore } from '@/lib/pokt/poktscan'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const force   = req.nextUrl.searchParams.get('force') === '1'
    const metrics = await getPOKTNetworkMetrics(force)
    const health  = computeNetworkHealthScore(metrics)

    return NextResponse.json(
      { metrics, health },
      {
        headers: {
          // Allow browser to cache for 30s (matches server cache TTL)
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      },
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[pokt-agent/metrics]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
