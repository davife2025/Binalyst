import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const dynamic    = 'force-dynamic'
export const maxDuration = 60

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export interface BinanceEvent {
  id: string; title: string; datetime: string
  type: 'listing' | 'trading' | 'airdrop' | 'launchpool' | 'other'
  description: string; url: string; scannedAt: string
}

async function scanBinanceEvents(): Promise<BinanceEvent[]> {
  const today = new Date().toISOString().split('T')[0]

  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const prompt = `Today is ${today}. Search your knowledge for upcoming Binance exchange events in the next 30 days. Include: new coin listings, new trading pairs, HODLer airdrops, Binance Alpha claiming events, Launchpool projects, Launchpad IDOs, token generation events (TGEs), futures launches.

Return ONLY a valid JSON array. No markdown, no explanation, just the array.

Each object:
- id: slug of title
- title: concise event name
- datetime: ISO 8601 UTC (use T12:00:00Z if time unknown)
- type: listing | trading | airdrop | launchpool | other
- description: 1-2 sentences max
- url: Binance URL or empty string
- source: "binance_announcements"

Up to 15 events sorted by datetime. Return [] if nothing found.`

  const result = await model.generateContent(prompt)
  const text   = result.response.text().replace(/```json|```/g, '').trim()

  const start = text.indexOf('[')
  const end   = text.lastIndexOf(']')
  if (start === -1 || end === -1) return []

  const events: BinanceEvent[] = JSON.parse(text.slice(start, end + 1))
  const scannedAt = new Date().toISOString()

  return events
    .filter(e => e.title && e.datetime && e.type)
    .map(e => ({ ...e, scannedAt }))
}

export async function POST(req: NextRequest) {
  try {
    let cached: BinanceEvent[] | null = null
    try { const { kv } = await import('@vercel/kv'); cached = await kv.get<BinanceEvent[]>('binalyst:events') } catch {}

    const force = (await req.json().catch(() => ({}))).force === true
    if (cached && !force) return NextResponse.json({ success: true, data: cached, cached: true })

    const events = await scanBinanceEvents()

    try { const { kv } = await import('@vercel/kv'); await kv.set('binalyst:events', events, { ex: 1800 }) } catch {}

    return NextResponse.json({ success: true, data: events, cached: false })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const events = await scanBinanceEvents()
    try { const { kv } = await import('@vercel/kv'); await kv.set('binalyst:events', events, { ex: 3600 }) } catch {}
    return NextResponse.json({ success: true, count: events.length, ran: new Date().toISOString() })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
