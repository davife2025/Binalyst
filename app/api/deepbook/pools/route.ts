/**
 * app/api/deepbook/pools/route.ts
 * DeepBook pools and order book endpoint — Session L.
 *
 * GET /api/deepbook/pools?network=testnet          — list all pools
 * GET /api/deepbook/pools?poolId=0x...&pair=SUI/USDC — fetch order book
 *
 * New file — does not touch any existing API route.
 */

import { NextRequest, NextResponse } from 'next/server'
import { fetchPools, fetchOrderBook } from '@/lib/deepbook/client'
import type { SuiNetwork }           from '@/lib/sui/client'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const network  = (searchParams.get('network') ?? 'testnet') as SuiNetwork
  const poolId   = searchParams.get('poolId')
  const pair     = searchParams.get('pair')

  try {
    // Order book request
    if (poolId && pair) {
      const book = await fetchOrderBook(poolId, pair, network)
      return NextResponse.json(book)
    }

    // Pool list request
    const pools = await fetchPools(network)
    return NextResponse.json({ pools, network, updatedAt: Date.now() })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
