import { NextRequest, NextResponse } from 'next/server'
import { runAgent, type AgentMessage, type AgentMode } from '@/lib/claude'
import { getCredentialsFromHeaders } from '@/lib/binance'
import { rateLimit } from '@/lib/rateLimit'

export const dynamic   = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  // Rate limit by IP
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = rateLimit(`ai:${ip}`, 'ai-chat')
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment.' },
      { status: 429, headers: { 'X-RateLimit-Reset': String(rl.resetAt) } }
    )
  }

  const body = await req.json()
  const { messages, mode = 'assistant', autoTradeEnabled = false } = body as {
    messages: AgentMessage[]; mode: AgentMode; autoTradeEnabled: boolean
  }

  if (!messages?.length) {
    return NextResponse.json({ error: 'messages array required' }, { status: 400 })
  }

  const credentials = getCredentialsFromHeaders(req.headers) || undefined

  const encoder = new TextEncoder()
  const stream  = new ReadableStream({
    async start(controller) {
      try {
        const { text, toolsUsed } = await runAgent({
          messages, mode, credentials, autoTradeEnabled,
          onChunk: (chunk) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', text: chunk })}\n\n`))
          },
        })
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', toolsUsed, hasCredentials: !!credentials })}\n\n`))
      } catch (err: any) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`))
      } finally {
        controller.close()
      }
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-RateLimit-Remaining': String(rl.remaining),
    },
  })
}
