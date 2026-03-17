import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const SYSTEM: Record<string, string> = {
  assistant: 'You are Binalyst, an elite AI assistant for Binance users. You have live access to Binance market data. Be concise, data-driven, and helpful.',
  analyst:   'You are Binalyst market analyst. Provide structured analysis: price, trend, signals, bull/bear cases.',
  trader:    'You are Binalyst trading assistant. Help execute trades efficiently and safely.',
  educator:  'You are Binalyst Academy. Teach crypto concepts clearly with real examples.',
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { messages = [], mode = 'assistant' } = body

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: SYSTEM[mode] ?? SYSTEM.assistant,
    })

    const history = messages.slice(0, -1).map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
    }))

    const lastMsg  = messages[messages.length - 1]
    const userText = typeof lastMsg?.content === 'string' ? lastMsg.content : JSON.stringify(lastMsg?.content ?? '')

    const chat   = model.startChat({ history })
    const result = await chat.sendMessage(userText)
    const text   = result.response.text()

    const encoder = new TextEncoder()
    const stream  = new ReadableStream({
      start(controller) {
        const size = 30
        for (let i = 0; i < text.length; i += size) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'text', text: text.slice(i, i + size) })}\n\n`)
          )
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