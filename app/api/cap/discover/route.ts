/**
 * app/api/cap/discover/route.ts
 * Session 5 — Agent Discovery API
 *
 * GET /api/cap/discover?track=research_intelligence&q=sentiment&limit=10
 *   → searches CROO Agent Store for agents matching track / keyword
 *   → falls back to curated demo list if API is unreachable
 *
 * GET /api/cap/discover?manifestUrl=https://...
 *   → fetches and validates a single agent's manifest from its discovery URL
 *
 * NEW FILE — zero modifications to existing routes.
 */

import { NextRequest, NextResponse } from 'next/server'
import { discoverAgents, fetchAgentManifest } from '@/lib/croo/capCaller'
import { rateLimit } from '@/lib/rateLimit'

export const dynamic     = 'force-dynamic'
export const maxDuration = 15

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'X-CAP-Version':               '1.0',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = rateLimit(`cap-discover:${ip}`, 'default')
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: CORS })
  }

  const { searchParams } = req.nextUrl
  const manifestUrl      = searchParams.get('manifestUrl')

  // ── Single manifest fetch ─────────────────────────────────────────────────
  if (manifestUrl) {
    const agent = await fetchAgentManifest(manifestUrl)
    if (!agent) {
      return NextResponse.json(
        { error: `Could not fetch manifest from ${manifestUrl}` },
        { status: 404, headers: CORS }
      )
    }
    return NextResponse.json({ agent }, { headers: CORS })
  }

  // ── Discover agents ───────────────────────────────────────────────────────
  const track   = searchParams.get('track')   ?? undefined
  const keyword = searchParams.get('q')       ?? undefined
  const limit   = parseInt(searchParams.get('limit') ?? '10', 10)

  const agents = await discoverAgents({ track, keyword, limit })

  return NextResponse.json(
    {
      agents,
      count:  agents.length,
      source: agents.length > 0 ? 'croo-store' : 'empty',
    },
    { headers: CORS }
  )
}
