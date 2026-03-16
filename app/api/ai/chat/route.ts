/**
 * app/api/ai/chat/route.ts
 * OpenClaw AI chat endpoint.
 * Supports streaming, multi-turn conversations, and live Binance tool calls.
 */

import { NextRequest, NextResponse } from 'next/server'
import { runAgent, type AgentMessage, type AgentMode } from '@/lib/claude'
import { getCredentialsFromHeaders } from '@/lib/binance'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Vercel max for Pro plan

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    messages,
    mode = 'assistant',
    autoTradeEnabled = false,
  }: {
    messages: AgentMessage[]
    mode: AgentMode
    autoTradeEnabled: boolean
  } = body

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages array required' }, { status: 400 })
  }

  // Extract Binance credentials from headers if provided
  const credentials = getCredentialsFromHeaders(req.headers) || undefined

  // ── Streaming response ───────────────────────────────────────────────────
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const { text, toolsUsed } = await runAgent({
          messages,
          mode: mode as AgentMode,
          credentials,
          autoTradeEnabled,
          onChunk: (chunk) => {
            // Stream each text chunk as SSE
            const payload = JSON.stringify({ type: 'text', text: chunk })
            controller.enqueue(encoder.encode(`data: ${payload}\n\n`))
          },
        })

        // Send completion event with metadata
        const done = JSON.stringify({
          type: 'done',
          toolsUsed,
          hasCredentials: !!credentials,
        })
        controller.enqueue(encoder.encode(`data: ${done}\n\n`))
      } catch (err: any) {
        const error = JSON.stringify({ type: 'error', message: err.message })
        controller.enqueue(encoder.encode(`data: ${error}\n\n`))
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
    },
  })
}

// ── Non-streaming fallback (for simpler integrations) ────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')
  if (!query) return NextResponse.json({ error: 'q param required' }, { status: 400 })

  const credentials = getCredentialsFromHeaders(req.headers) || undefined

  try {
    const { text, toolsUsed } = await runAgent({
      messages: [{ role: 'user', content: query }],
      mode: 'assistant',
      credentials,
    })
    return NextResponse.json({ success: true, text, toolsUsed })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
