import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { rateLimit } from '@/lib/rateLimit'
import { getCredentialsFromHeaders } from '@/lib/binance'

export const dynamic    = 'force-dynamic'
export const maxDuration = 60

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const SYSTEM: Record<string, string> = {
  assistant: `You are Binalyst, an elite AI assistant for Binance users. You have access to live Binance market data. Be concise, data-driven, and helpful. Use **bold** for prices and key metrics.`,
  analyst:   `You are Binalyst's market analyst. Provide structured analysis: price → trend → signals → bull/bear cases.`,
  trader:    `You are Binalyst's trading assistant. Help execute trades efficiently and safely. Always warn about risks.`,
  educator:  `You are Binalyst Academy. Teach crypto concepts clearly with real examples and practical tips.`,
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = rateLimit(`ai:${ip}`, 'ai')
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

  try {
    const body = await req.json()
    const { messages = [], mode = 'assistant' } = body

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: SYSTEM[mode] ?? SYSTEM.assistant,
    })

    // Convert messages to Gemini format
    const history = messages.slice(0, -1).map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
    }))

    const lastMsg = messages[messages.length - 1]
    const userText = typeof lastMsg?.content === 'string' ? lastMsg.content : JSON.stringify(lastMsg?.content ?? '')

    const chat   = model.startChat({ history })
    const result = await chat.sendMessage(userText)
    const text   = result.response.text()

    // Stream as SSE
    const encoder = new TextEncoder()
    const stream  = new ReadableStream({
      start(controller) {
        // Send text in chunks
        const chunkSize = 20
        for (let i = 0; i < text.length; i += chunkSize) {
          const chunk = text.slice(i, i + chunkSize)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', text: chunk })}\n\n`))
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', toolsUsed: [] })}\n\n`))
        controller.close()
      },
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection':    'keep-alive',
      },
    })
  } catch (err: any) {
    console.error('[ai/chat]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
