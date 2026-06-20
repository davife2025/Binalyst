/**
 * app/api/pokt-agent/ping/route.ts — Session P2 (new file)
 *
 * Chain health ping endpoint.
 * Checks whether a specific chain's POKT RPC endpoint is reachable
 * and returns latency + latest block number.
 *
 * PURELY ADDITIVE — zero changes to existing routes.
 *
 * GET /api/pokt-agent/ping?chain=ethereum
 *   → { chainKey, ok, latencyMs, blockNumber }
 *
 * GET /api/pokt-agent/ping?chain=all
 *   → pings all chains in parallel and returns an array of results
 */

import { NextRequest, NextResponse } from 'next/server'
import { poktClient }                from '@/lib/pokt/client'
import { POKT_CHAIN_LIST }           from '@/lib/pokt/config'

export const dynamic     = 'force-dynamic'
export const maxDuration = 20

export async function GET(req: NextRequest) {
  const chainParam = req.nextUrl.searchParams.get('chain') ?? 'ethereum'

  try {
    if (chainParam === 'all') {
      // Ping all chains in parallel — cap timeout at 15s total
      const results = await Promise.all(
        POKT_CHAIN_LIST.map(c => poktClient.pingChain(c.id))
      )
      return NextResponse.json({ results })
    }

    const result = await poktClient.pingChain(chainParam)
    return NextResponse.json(result)

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[pokt-agent/ping]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
