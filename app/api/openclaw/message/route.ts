/**
 * app/api/openclaw/message/route.ts
 * Receives messages from OpenClaw gateway (Telegram, WhatsApp, Discord)
 * Routes them through Binalyst AI and returns a response.
 */

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { publicMarket } from '@/lib/binance'

export const dynamic     = 'force-dynamic'
export const maxDuration = 30

const kimi = new OpenAI({ apiKey: process.env.MOONSHOT_API_KEY!, baseURL: 'https://api.moonshot.ai/v1' })

// Verify request comes from our OpenClaw gateway
function verifyAuth(req: NextRequest) {
  const token = req.headers.get('x-openclaw-token') ?? req.headers.get('authorization')?.replace('Bearer ', '')
  return token === process.env.OPENCLAW_SECRET
}

// Parse natural language commands
function parseCommand(text: string): { cmd: string; args: string } {
  const t = text.trim().toLowerCase()
  if (t.startsWith('/price') || t.includes('price of') || t.includes('how much is')) return { cmd: 'price', args: text.replace(/\/price/i, '').trim() }
  if (t.startsWith('/audit') || t.includes('audit') || t.includes('rug')) return { cmd: 'audit', args: text.replace(/\/audit/i, '').trim() }
  if (t.startsWith('/movers') || t.includes('top movers') || t.includes('gainers')) return { cmd: 'movers', args: '' }
  if (t.startsWith('/events') || t.includes('events') || t.includes('listing')) return { cmd: 'events', args: '' }
  if (t.startsWith('/help')) return { cmd: 'help', args: '' }
  return { cmd: 'ai', args: text }
}

async function handleCommand(cmd: string, args: string): Promise<string> {
  switch (cmd) {
    case 'price': {
      const symbol = args.toUpperCase().replace(/[^A-Z]/g, '') || 'BTC'
      const pair   = symbol.endsWith('USDT') ? symbol : `${symbol}USDT`
      try {
        const prices = await publicMarket.getPrices([pair])
        const price  = prices[pair]
        if (!price) return `❌ Could not find price for ${symbol}.`
        return `💰 *${symbol}* price\n$${parseFloat(price).toLocaleString('en', { maximumFractionDigits: 4 })}\n\n_via Binalyst · binalyst.vercel.app_`
      } catch {
        return `❌ Failed to fetch ${symbol} price. Try again.`
      }
    }

    case 'movers': {
      try {
        const data = await publicMarket.getTopMovers(5)
        const g = data.gainers?.slice(0,3).map((m: any) => `🟢 ${m.symbol?.replace('USDT','')} +${parseFloat(m.priceChangePercent).toFixed(2)}%`).join('\n') ?? ''
        const l = data.losers?.slice(0,3).map((m: any) => `🔴 ${m.symbol?.replace('USDT','')} ${parseFloat(m.priceChangePercent).toFixed(2)}%`).join('\n') ?? ''
        return `📊 *Top Movers (24h)*\n\n*Gainers*\n${g}\n\n*Losers*\n${l}\n\n_via Binalyst · binalyst.vercel.app_`
      } catch {
        return `❌ Failed to fetch movers.`
      }
    }

    case 'help': {
      return `🤖 *Binalyst Commands*\n\n/price BTC — get price\n/movers — top gainers & losers\n/events — upcoming Binance events\n/audit 0x... — contract security audit\n\nOr just ask anything naturally!\n\n_Binalyst · binalyst.vercel.app_`
    }

    case 'ai':
    default: {
      try {
        const response = await kimi.chat.completions.create({
          model: 'kimi-k2.5',
          messages: [
            { role: 'system', content: 'You are Binalyst, an AI assistant for Binance users. Keep responses concise and under 300 characters for messaging apps. Use plain text — no markdown headers, minimal formatting. Include key numbers and be direct.' },
            { role: 'user', content: args },
          ],
        })
        const text = response.choices[0].message.content ?? ''
        return `${text}\n\n_via Binalyst · binalyst.vercel.app_`
      } catch {
        return `❌ AI response failed. Try /help for commands.`
      }
    }
  }
}

export async function POST(req: NextRequest) {
  if (!verifyAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { message, channel, sender } = body

    if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 })

    const { cmd, args } = parseCommand(message)
    const reply = await handleCommand(cmd, args)

    console.log(`[openclaw] ${channel} from ${sender}: "${message.slice(0,50)}" → ${cmd}`)

    return NextResponse.json({ success: true, reply, cmd })
  } catch (err: any) {
    console.error('[openclaw/message]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
