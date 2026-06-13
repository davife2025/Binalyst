/**
 * app/api/agent/dorahacks/route.ts
 * Generates the Dorahacks competition submission writeup.
 * Uses Kimi K2 to produce a structured, judge-ready submission
 * based on the agent's actual strategy, trades, and PnL.
 */

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { rateLimit } from '@/lib/rateLimit'

export const dynamic     = 'force-dynamic'
export const maxDuration = 40

const kimi = new OpenAI({
  apiKey:  process.env.HUGGINGFACE_API_KEY ?? 'placeholder',
  baseURL: 'https://router.huggingface.co/v1',
})

const SUBMISSION_SYSTEM = `You are writing a competition submission for the OpenClaw AI Hackathon on Dorahacks.
The submission is for the "Best Use of Trust Wallet Agent Kit (Track 1)" prize.

Write a compelling, technically precise submission that judges will score on:
1. TWAK integration depth (30pts) - TWAK as sole execution layer, multiple surfaces
2. Self-custody integrity (25pts) - keys stay with user, local signing throughout
3. Autonomous execution & guardrails (20pts) - hands-off, within user-defined rules
4. Native x402 usage (10pts) - pay-per-request for data/inference in trade loop
5. Originality & real-world relevance (10pts) - novel approach, real users
6. Demo & presentation (5pts) - shows self-custody + autonomous signing end-to-end

Format the output as a structured Dorahacks submission with these sections:
## Project Overview
## Technical Architecture  
## TWAK Integration
## Self-Custody Design
## Autonomous Execution & Guardrails
## x402 Integration
## Strategy & Results
## On-Chain Proof
## How to Run the Demo

Be specific, technical, and reference actual implementation details provided.
Use concrete numbers where available. Max 1200 words total.`

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = rateLimit(`dorahacks:${ip}`, 'ai-chat')
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

  try {
    const {
      agentAddress,
      strategyText,
      strategyRules,
      trades,
      session,
      agentConfig,
      registrationTx,
      topTrades,
    } = await req.json()

    // Build context for the AI
    const totalTrades  = trades?.length ?? 0
    const liveTrades   = trades?.filter((t: any) => !t.dryRun) ?? []
    const pnlPct       = session?.startValueUSDT > 0
      ? (((session.currentValueUSDT - session.startValueUSDT) / session.startValueUSDT) * 100).toFixed(2)
      : '0.00'
    const drawdownPct  = session?.drawdownPct?.toFixed(1) ?? '0.0'
    const startUSD     = session?.startValueUSDT?.toFixed(2) ?? '0'
    const currentUSD   = session?.currentValueUSDT?.toFixed(2) ?? '0'

    const context = `
AGENT DETAILS:
- Agent wallet address: ${agentAddress ?? 'not set'}
- Registration tx: ${registrationTx ?? 'pending'}
- Competition contract: 0x212c61b9b72c95d95bf29cf032f5e5635629aed5 (BSC)

STRATEGY:
${strategyText ?? 'Sentiment-aware DCA agent using CMC Fear & Greed + signal scoring'}

STRATEGY RULES (${strategyRules?.length ?? 0} rules):
${(strategyRules ?? []).slice(0, 5).map((r: any) =>
  `- ${r.action} ${r.symbol} (${r.sizePct}% portfolio) when ${JSON.stringify(r.condition)}`
).join('\n')}

PERFORMANCE:
- Starting capital: $${startUSD} USDT
- Current value: $${currentUSD} USDT  
- Total return: ${pnlPct}%
- Max drawdown: ${drawdownPct}% (limit: 30%)
- Total trades: ${totalTrades} (${liveTrades.length} live on-chain)
- Trades per day target: ≥1 (7 minimum over competition week)

GUARDRAILS:
- Max drawdown: ${agentConfig?.maxDrawdownPct ?? 25}% (auto-pause at ${((agentConfig?.maxDrawdownPct ?? 25) * 0.93).toFixed(0)}%)
- Max per-trade: ${agentConfig?.maxPerTradePct ?? 15}% of portfolio
- Slippage: ${agentConfig?.slippagePct ?? 1.0}%
- All 149 eligible BEP-20 tokens enforced at execution layer
- $1 portfolio floor guard active

TOP TRADES:
${(topTrades ?? []).slice(0, 5).map((t: any) =>
  `- ${t.side} ${t.symbol} $${t.amountUSDT?.toFixed(2)} (signal: ${t.signalScore}/100)${t.txHash ? ` tx: ${t.txHash.slice(0, 12)}...` : ' [dry-run]'}`
).join('\n')}

TECH STACK:
- Frontend: Next.js 14 + TypeScript + Tailwind
- AI: Kimi K2 via HuggingFace router (strategy parsing + market analysis)
- Wallet: ethers.js v6 + local AES-256 encrypted keystore (TWAK self-custody pattern)
- Execution: PancakeSwap V2 router on BSC via TWAK signing
- Data: CoinMarketCap AI Agent Hub (Fear & Greed + signal scoring) + x402 pay-per-request
- Chain: BSC mainnet, chain ID 56
- Autonomous loop: 2-minute polling cycle (client + Vercel cron backup)
- Registration: on-chain via competition contract at 0x212c...aed5`

    const response = await kimi.chat.completions.create({
      model: 'moonshotai/Kimi-K2-Instruct',
      messages: [
        { role: 'system', content: SUBMISSION_SYSTEM },
        { role: 'user',   content: `Generate the Dorahacks submission for Binalyst.\n\n${context}` },
      ],
      temperature: 0.4,
    })

    const submission = response.choices[0]?.message?.content ?? ''

    return NextResponse.json({ success: true, submission, context })
  } catch (err: any) {
    console.error('[dorahacks]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
