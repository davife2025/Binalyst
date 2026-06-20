/**
 * app/api/pokt-agent/query/route.ts — REVISED in review pass (post-P5)
 *
 * POKT Agent natural-language query endpoint.
 *
 * BUGFIX: The original P2 version imported '@anthropic-ai/sdk' and used
 * ANTHROPIC_API_KEY. Neither exists in this project — Binalyst's AI layer
 * (lib/claude.ts) actually runs on Kimi K2 via Hugging Face's OpenAI-compatible
 * router, using the 'openai' package already in package.json. The old version
 * would have failed `npm run build` with "Module not found: @anthropic-ai/sdk".
 *
 * This version mirrors lib/claude.ts's runAgent() pattern exactly:
 *   - Same model: moonshotai/Kimi-K2-Instruct
 *   - Same client construction: new OpenAI({ baseURL: huggingface router })
 *   - Same tool-loop shape (max 8 rounds, OpenAI tool_calls format)
 *
 * POKT_TOOLS (lib/pokt/skills.ts) was already written in OpenAI tool format
 * ({ type: 'function', function: {...} }), so it works here unchanged.
 *
 * Zero changes to lib/claude.ts or any BNB-chain file — this route owns its
 * own OpenAI client instance, scoped entirely to the POKT agent.
 */

import { NextRequest, NextResponse } from 'next/server'
import OpenAI                        from 'openai'
import { rateLimit }                 from '@/lib/rateLimit'
import { POKT_TOOLS, executePOKTTool, POKT_AGENT_SYSTEM } from '@/lib/pokt/skills'

export const dynamic     = 'force-dynamic'
export const maxDuration = 55

// Lazy client — same Kimi K2 / Hugging Face router as lib/claude.ts
let _kimi: OpenAI | null = null
function getKimi(): OpenAI {
  if (!_kimi) {
    _kimi = new OpenAI({
      apiKey:  process.env.HUGGINGFACE_API_KEY!,
      baseURL: 'https://router.huggingface.co/v1',
    })
  }
  return _kimi
}

const MODEL = 'moonshotai/Kimi-K2-Instruct'
const MAX_TOOL_ROUNDS = 8   // matches lib/claude.ts runAgent()

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = rateLimit(`pokt-query:${ip}`, 'ai-chat')
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  if (!process.env.HUGGINGFACE_API_KEY) {
    return NextResponse.json(
      { error: 'HUGGINGFACE_API_KEY not set.' },
      { status: 500 },
    )
  }

  try {
    const body = await req.json() as {
      messages: { role: 'user' | 'assistant'; content: string }[]
      chainKey?: string
    }

    const { messages = [], chainKey = 'ethereum' } = body

    if (!messages.length) {
      return NextResponse.json({ error: 'messages array is required' }, { status: 400 })
    }

    const kimi = getKimi()

    const systemPrompt = `${POKT_AGENT_SYSTEM}

Current default chain: ${chainKey}. If the user doesn't specify a chain, use "${chainKey}" as the default for tool calls.`

    const history: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ]

    const toolsUsed: string[] = []

    for (let i = 0; i < MAX_TOOL_ROUNDS; i++) {
      const response = await kimi.chat.completions.create({
        model:       MODEL,
        messages:    history,
        tools:       POKT_TOOLS,
        tool_choice: 'auto',
      })

      const msg = response.choices[0].message
      history.push(msg as OpenAI.ChatCompletionMessageParam)

      const text = msg.content ?? ''

      if (!msg.tool_calls?.length) {
        return new Response(text, {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      }

      // Execute all tool calls for this round
      for (const tc of msg.tool_calls) {
        if (tc.type !== 'function') continue
        toolsUsed.push(tc.function.name)
        try {
          const args   = JSON.parse(tc.function.arguments)
          const result = await executePOKTTool(tc.function.name, args)
          history.push({
            role:         'tool',
            tool_call_id: tc.id,
            content:      JSON.stringify(result),
          })
        } catch (err: unknown) {
          const msg2 = err instanceof Error ? err.message : String(err)
          history.push({
            role:         'tool',
            tool_call_id: tc.id,
            content:      JSON.stringify({ error: msg2 }),
          })
        }
      }
    }

    // Exceeded max rounds — collect whatever assistant text we have
    const finalText = history
      .filter(m => m.role === 'assistant')
      .map(m => (m as { content?: string }).content ?? '')
      .join('')

    return new Response(finalText || 'Query complete.', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[pokt-agent/query]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
