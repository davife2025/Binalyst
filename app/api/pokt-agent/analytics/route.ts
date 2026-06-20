/**
 * app/api/pokt-agent/analytics/route.ts — Session P5 (new file)
 *
 * POKT Token Analytics endpoint.
 * Aggregates CoinGecko price history + POKTscan CU/relay series into
 * a single cached response for the Analytics panel.
 *
 * PURELY ADDITIVE — zero changes to existing routes.
 *
 * GET /api/pokt-agent/analytics?days=30
 *   → POKTAnalyticsData (price, burn/mint series, CU trend, supply)
 *
 * GET /api/pokt-agent/analytics?days=7&force=1
 *   → bypass 60s cache, fetch fresh data
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPOKTAnalytics }          from '@/lib/pokt/analytics'

export const dynamic     = 'force-dynamic'
export const maxDuration = 30

export async function GET(req: NextRequest) {
  try {
    const force = req.nextUrl.searchParams.get('force') === '1'
    const data  = await getPOKTAnalytics(force)

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[pokt-agent/analytics]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
