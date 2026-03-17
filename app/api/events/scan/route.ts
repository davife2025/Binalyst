import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const dynamic     = 'force-dynamic'
export const maxDuration = 60

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

async function scanEvents() {
  const today = new Date().toISOString().split('T')[0]
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const result = await model.generateContent(
    `Today is ${today}. List upcoming Binance exchange events in the next 30 days.
Include: new coin listings, new trading pairs, HODLer airdrops, Binance Alpha events, Launchpool projects, Launchpad IDOs, TGEs, futures launches.

Return ONLY a valid JSON array. No markdown, no explanation.
Each item: { id, title, datetime (ISO UTC), type (listing|trading|airdrop|launchpool|other), description, url }
Up to 15 events sorted by datetime. Return [] if nothing found.`
  )

  const text  = result.response.text().replace(/```json|```/g, '').trim()
  const start = text.indexOf('[')
  const end   = text.lastIndexOf(']')
  if (start === -1 || end === -1) return []

  const events = JSON.parse(text.slice(start, end + 1))
  const scannedAt = new Date().toISOString()
  return events.filter((e: any) => e.title && e.datetime).map((e: any) => ({ ...e, scannedAt }))
}

export async function POST(req: NextRequest) {
  try {
    let cached = null
    try { const { kv } = await import('@vercel/kv'); cached = await kv.get('binalyst:events') } catch {}
    const force = (await req.json().catch(() => ({}))).force === true
    if (cached && !force) return NextResponse.json({ success: true, data: cached, cached: true })
    const events = await scanEvents()
    try { const { kv } = await import('@vercel/kv'); await kv.set('binalyst:events', events, { ex: 1800 }) } catch {}
    return NextResponse.json({ success: true, data: events, cached: false })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const events = await scanEvents()
    try { const { kv } = await import('@vercel/kv'); await kv.set('binalyst:events', events, { ex: 3600 }) } catch {}
    return NextResponse.json({ success: true, count: events.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
