/**
 * app/api/pokt-agent/query/route.ts — Session P2 (new file)
 *
 * POKT Agent natural-language query endpoint.
 * Accepts a user message and conversation history, runs a Claude tool-use
 * loop, executes on-chain RPC calls via Pocket Network, and streams the
 * final answer back to the client.
 *
 * PURELY ADDITIVE — shares no code with BNB, Celo, Mantle, or Sui agents.
 * Rate-limit bucket: 'pokt-query' (independent of all existing buckets).
 *
 * Request body:
 *   { messages: [{role, content}][], chainKey?: string }
 *
 * Response: streaming text/plain (SSE-style newline-delimited chunks)
 *
 * Tool-use flow:
 *   1. Send user message + history + POKT_TOOLS to Claude
 *   2. Claude calls tools (query_balance, query_block, get_network_metrics…)
 *   3. We execute each tool via executePOKTTool()
 *   4. Feed results back to Claude as tool_result messages
 *   5. Claude produces a final natural-language response
 *   6. Stream response tokens to client
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic                     from '@anthropic-ai/sdk'
import { rateLimit }                 from '@/lib/rateLimit'
import { POKT_TOOLS, executePOKTTool, POKT_AGENT_SYSTEM } from '@/lib/pokt/skills'

export const dynamic     = 'force-dynamic'
export const maxDuration = 55

// Lazy Anthropic client — key checked per request
let _anthropic: Anthropic | null = null
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  }
  return _anthropic
}

// ─────────────────────────────────────────────────────────────────────────────
// Max tool-use iterations per request (prevents runaway loops)
// ─────────────────────────────────────────────────────────────────────────────
const MAX_TOOL_ROUNDS = 4

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = rateLimit(`pokt-query:${ip}`, 'ai-chat')
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not set.' },
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

    const anthropic = getAnthropic()

    // Build Anthropic message history
    // Inject active chain context into the last user message
    const systemPrompt = `${POKT_AGENT_SYSTEM}

Current default chain: ${chainKey}. If the user doesn't specify a chain, use "${chainKey}" as the default for tool calls.`

    // Convert to Anthropic message format
    const anthropicMessages: Anthropic.MessageParam[] = messages.map(m => ({
      role:    m.role,
      content: m.content,
    }))

    // ── Tool-use loop ─────────────────────────────────────────────────────
    let round  = 0
    let currentMessages = [...anthropicMessages]

    while (round < MAX_TOOL_ROUNDS) {
      round++

      const response = await anthropic.messages.create({
        model:      'claude-sonnet-4-6',
        max_tokens: 1024,
        system:     systemPrompt,
        tools:      POKT_TOOLS as Anthropic.Tool[],
        messages:   currentMessages,
      })

      // Check stop reason
      if (response.stop_reason === 'end_turn') {
        // No more tool calls — extract text and stream it
        const textBlock = response.content.find(b => b.type === 'text')
        const text = textBlock && textBlock.type === 'text' ? textBlock.text : ''

        return new Response(text, {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      }

      if (response.stop_reason !== 'tool_use') {
        // Unexpected stop — return whatever text we have
        const textBlock = response.content.find(b => b.type === 'text')
        const text = textBlock && textBlock.type === 'text' ? textBlock.text : 'No response generated.'
        return new Response(text, {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      }

      // ── Execute tool calls ───────────────────────────────────────────────
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      )

      // Add the assistant's tool-use response to history
      currentMessages.push({ role: 'assistant', content: response.content })

      // Execute all tool calls in parallel
      const toolResults = await Promise.all(
        toolUseBlocks.map(async (block) => {
          try {
            const result = await executePOKTTool(
              block.name,
              block.input as Record<string, unknown>,
            )
            return {
              type:        'tool_result' as const,
              tool_use_id: block.id,
              content:     JSON.stringify(result),
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err)
            return {
              type:        'tool_result' as const,
              tool_use_id: block.id,
              content:     JSON.stringify({ error: msg }),
              is_error:    true,
            }
          }
        })
      )

      // Feed tool results back
      currentMessages.push({ role: 'user', content: toolResults })
    }

    // Exceeded max rounds — ask Claude to summarise what it found
    const finalResponse = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 512,
      system:     systemPrompt,
      messages:   [
        ...currentMessages,
        {
          role:    'user',
          content: 'Please summarise the data you retrieved in a concise response.',
        },
      ],
    })

    const textBlock = finalResponse.content.find(b => b.type === 'text')
    const text = textBlock && textBlock.type === 'text' ? textBlock.text : 'Query complete.'

    return new Response(text, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[pokt-agent/query]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
