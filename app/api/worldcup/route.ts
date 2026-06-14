/**
 * app/api/worldcup/route.ts
 * Session 3 — World Cup data API route.
 *
 * Endpoints:
 *   GET /api/worldcup              → WorldCupSignal (active match + hook state)
 *   GET /api/worldcup?matches=true → all today's matches
 *   POST /api/worldcup             → oracle push (secured by ORACLE_SECRET)
 *
 * SAFE: New file in a new folder. Zero overlap with existing API routes.
 * The existing /api/agent, /api/binance, /api/cmc etc. are untouched.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  buildWorldCupSignal,
  fetchTodayMatches,
  type WorldCupSignal,
} from '@/lib/xlayer/worldcup'

// ─────────────────────────────────────────────────────────────────────────────
// Simple in-memory cache — avoids hammering football-data.org
// Server restarts reset the cache (acceptable for this use case)
// ─────────────────────────────────────────────────────────────────────────────

let signalCache: { data: WorldCupSignal; ts: number } | null = null
const CACHE_TTL = 60_000  // 60 seconds

// ─────────────────────────────────────────────────────────────────────────────
// GET — fetch signal or match list
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    // ?matches=true → return raw match list for the Match Signals tab
    if (searchParams.get('matches') === 'true') {
      const matches = await fetchTodayMatches()
      return NextResponse.json({ matches, updatedAt: Date.now() })
    }

    // Default → return WorldCupSignal (cached)
    const now = Date.now()
    if (signalCache && now - signalCache.ts < CACHE_TTL) {
      return NextResponse.json(signalCache.data, {
        headers: {
          'X-Cache':         'HIT',
          'X-Cache-Age-Ms':  String(now - signalCache.ts),
          'Cache-Control':   'public, max-age=60',
        },
      })
    }

    const signal     = await buildWorldCupSignal()
    signalCache      = { data: signal, ts: now }

    return NextResponse.json(signal, {
      headers: {
        'X-Cache':       'MISS',
        'Cache-Control': 'public, max-age=60',
      },
    })
  } catch (err: any) {
    console.error('[/api/worldcup GET]', err)
    return NextResponse.json(
      { error: 'Failed to fetch World Cup signal', detail: err?.message },
      { status: 500 }
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — oracle manual push (for testing or manual override)
// Body: { secret: string, action: 'invalidate_cache' | 'set_phase', phase?: string }
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json()
    const secret = process.env.ORACLE_SECRET

    // Validate oracle secret
    if (!secret || body.secret !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (body.action === 'invalidate_cache') {
      signalCache = null
      return NextResponse.json({ ok: true, message: 'Cache invalidated' })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: any) {
    console.error('[/api/worldcup POST]', err)
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
