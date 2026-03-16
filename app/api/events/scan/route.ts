/**
 * app/api/events/scan/route.ts
 * Binance events scanner — listings, airdrops, launchpool, trading opens.
 * Supports on-demand scan (POST) and Vercel Cron (GET with Authorization).
 * Results cached in Vercel KV for 30 minutes.
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface BinanceEvent {
  id: string
  title: string
  datetime: string        // ISO 8601 UTC
  type: 'listing' | 'trading' | 'airdrop' | 'launchpool' | 'other'
  description: string
  url: string
  source: string
  scannedAt: string
}

async function scanBinanceEvents(): Promise<BinanceEvent[]> {
  const today = new Date().toISOString().split('T')[0]

  const prompt = `Today is ${today}. Search Binance announcements (https://www.binance.com/en/support/announcement/new-cryptocurrency-listing) and Binance news for upcoming events in the next 30 days.

Find: new coin listings, new trading pairs, HODLer airdrops, Binance Alpha claiming events, Launchpool projects, Launchpad IDOs, token generation events (TGEs), futures launches.

Return ONLY a valid JSON array. No markdown, no explanation, just the array.

Each object must have:
- id: unique string (slug of title)
- title: concise event name
- datetime: ISO 8601 UTC string (use T12:00:00Z if time unknown)  
- type: exactly one of listing | trading | airdrop | launchpool | other
- description: 1-2 sentences max
- url: Binance announcement URL or empty string
- source: "binance_announcements"

Up to 20 events, sorted ascending by datetime. Return [] if nothing found.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
 tools: [{ type: 'web_search_20250305', name: 'web_search' }] as any,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content
    .filter(b => b.type === 'text')
    .map((b: any) => b.text)
    .join('')

  // Extract JSON array from response
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end === -1) return []

  const events: BinanceEvent[] = JSON.parse(text.slice(start, end + 1))
  const scannedAt = new Date().toISOString()

  return events
    .filter(e => e.title && e.datetime && e.type)
    .map(e => ({ ...e, scannedAt }))
}

// ── On-demand scan ───────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    // Try cache first (Vercel KV if available)
    let cached: BinanceEvent[] | null = null
    try {
      const { kv } = await import('@vercel/kv')
      cached = await kv.get<BinanceEvent[]>('openclaw:events')
    } catch {}

    const force = (await req.json().catch(() => ({}))).force === true
    if (cached && !force) {
      return NextResponse.json({ success: true, data: cached, cached: true })
    }

    const events = await scanBinanceEvents()

    // Cache for 30 minutes
    try {
      const { kv } = await import('@vercel/kv')
      await kv.set('openclaw:events', events, { ex: 1800 })
    } catch {}

    return NextResponse.json({ success: true, data: events, cached: false })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── Vercel Cron (runs every hour via vercel.json config) ─────────────────────
export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const events = await scanBinanceEvents()

    try {
      const { kv } = await import('@vercel/kv')
      await kv.set('openclaw:events', events, { ex: 3600 })
    } catch {}

    return NextResponse.json({ success: true, count: events.length, ran: new Date().toISOString() })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
