/**
 * app/api/cmc/route.ts
 * CoinMarketCap AI Agent Hub proxy.
 * Actions: fear_greed, signals, trending, tokens
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getFearAndGreed,
  getFearAndGreedHistory,
  getTopTokens,
  getTrending,
  computeSignal,
  computeBatchSignals,
  COMPETITION_SYMBOLS,
} from '@/lib/skills/cmc'
import { rateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = rateLimit(`cmc:${ip}`, 'market')
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  try {
    switch (action) {
      case 'fear_greed': {
        const data = await getFearAndGreed()
        return NextResponse.json({ success: true, data })
      }

      case 'fear_greed_history': {
        const limit = parseInt(searchParams.get('limit') ?? '30')
        const data  = await getFearAndGreedHistory(limit)
        return NextResponse.json({ success: true, data })
      }

      case 'trending': {
        const limit = parseInt(searchParams.get('limit') ?? '20')
        const data  = await getTrending(limit)
        return NextResponse.json({ success: true, data })
      }

      case 'tokens': {
        const limit = parseInt(searchParams.get('limit') ?? '50')
        const data  = await getTopTokens(limit)
        return NextResponse.json({ success: true, data })
      }

      case 'signal': {
        const symbol = searchParams.get('symbol')?.toUpperCase()
        if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 })
        const data = await computeSignal(symbol)
        return NextResponse.json({ success: true, data })
      }

      case 'signals_batch': {
        const raw     = searchParams.get('symbols')
        const symbols = raw
          ? raw.split(',').map(s => s.trim().toUpperCase())
          : COMPETITION_SYMBOLS.slice(0, 10)
        const data = await computeBatchSignals(symbols)
        return NextResponse.json({ success: true, data })
      }

      case 'eligible': {
        return NextResponse.json({ success: true, data: COMPETITION_SYMBOLS })
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: fear_greed, fear_greed_history, trending, tokens, signal, signals_batch, eligible' },
          { status: 400 }
        )
    }
  } catch (err: any) {
    console.error('[cmc route]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
