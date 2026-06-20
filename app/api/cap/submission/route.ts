/**
 * app/api/cap/submission/route.ts
 * Generates the CROO Hackathon DoraHacks submission writeup using Claude.
 * Replaces the OpenClaw/TWAK submission with a CROO-specific one.
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { rateLimit } from '@/lib/rateLimit'
import { BINALYST_SERVICES } from '@/lib/croo/capClient'

export const dynamic     = 'force-dynamic'
export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })

const SUBMISSION_SYSTEM = `You are writing a hackathon submission for the CROO Agent Protocol (CAP) Hackathon on DoraHacks.

CROO is building the decentralized commerce infrastructure for the AI Agent economy.
CAP (CROO Agent Protocol) is the A2A standard: every agent has a wallet, every service is priced, every job is an on-chain USDC transaction.

Write a compelling, technically precise submission. Format it exactly as follows:

## Project Overview
## The Problem We Solve
## CAP Integration (Technical)
## Services & Pricing
## A2A Composability
## Multi-Chain Architecture
## On-Chain Commerce (USDC Settlement)
## Strategy & Performance
## Demo Walkthrough
## Track Alignment
## Open Source

Rules:
- Be specific and technical. Reference actual implementation details.
- Include concrete numbers and code snippets where relevant.
- Max 1,400 words total.
- Highlight A2A composability — how other agents can hire Binalyst.
- Emphasize USDC on-chain settlement via CAP.
- Show why this qualifies for DeFi/On-chain Ops AND Research & Intelligence tracks.`

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = rateLimit(`croo-submission:${ip}`, 'ai-chat')
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

  try {
    const {
      agentAddress,
      strategyText,
      trades,
      session,
      capCalls,
      capRevenue,
      registeredOnStore,
    } = await req.json()

    const totalTrades = trades?.length ?? 0
    const liveTrades  = trades?.filter((t: any) => !t.dryRun) ?? []
    const pnlPct      = session?.startValueUSDT > 0
      ? (((session.currentValueUSDT - session.startValueUSDT) / session.startValueUSDT) * 100).toFixed(2)
      : '0.00'

    const servicesContext = BINALYST_SERVICES.map(s =>
      `- **${s.name}** (${s.id}): $${s.priceUSDC} USDC/call — ${s.description}`
    ).join('\n')

    const context = `
AGENT DETAILS:
- Agent wallet: ${agentAddress ?? 'pending setup'}
- Listed on CROO Agent Store: ${registeredOnStore ? 'YES ✓' : 'pending'}
- GitHub: https://github.com/davife2025/Binalyst (MIT license)

CAP SERVICES EXPOSED (4 services):
${servicesContext}

A2A CALL METRICS (since integration):
- Total CAP calls received: ${capCalls ?? 0}
- Total USDC earned: $${capRevenue ?? '0.00'}
- Unique caller agents: tracked on-chain

CURRENT STRATEGY:
${strategyText ?? 'Multi-indicator momentum + sentiment agent: RSI, MACD, Bollinger Bands, ADX, EMA, VWAP, ATR, OBV across 149 BEP-20 tokens on BSC.'}

PERFORMANCE:
- Starting capital: $${session?.startValueUSDT?.toFixed(2) ?? '0'} USDT
- Current value: $${session?.currentValueUSDT?.toFixed(2) ?? '0'} USDT
- Total return: ${pnlPct}%
- Max drawdown: ${session?.drawdownPct?.toFixed(1) ?? '0'}% (limit: 25%)
- Total trades: ${totalTrades} (${liveTrades.length} live on-chain)

TECH STACK:
- Frontend: Next.js 15 + TypeScript + Tailwind CSS
- AI: Claude Sonnet (strategy parsing, signal reasoning, submission generation)
- Wallet: ethers.js v6 + AES-256 encrypted local keystore
- Execution: PancakeSwap V2 on BSC mainnet (chain 56)
- CAP Endpoint: /api/cap/invoke (standard CAP invocation)
- CAP Manifest: /.well-known/cap-agent.json (A2A discovery)
- Settlement: USDC on BSC, Celo, Mantle
- Multi-chain agents: BSC (TWAK), Celo (recurring payments, ERC-8004), Mantle (AI benchmarking), Sui (Move policy-gated)
- Backtester: bias-free historical simulation with Sharpe, drawdown, equity curve
- Deployment: Vercel (serverless) + Vercel Cron

TRACKS TARGETED:
1. Research & Intelligence — market_signal + backtest_report services
2. DeFi / On-chain Ops — trade_execute with AI guardrails on BSC
3. Open A2A — any agent can hire Binalyst via CAP for signals or execution

HACKATHON REQUIREMENTS:
- Listed on CROO Agent Store: ${registeredOnStore ? 'YES' : 'pending'}
- CAP integrated: YES (invoke + manifest + status endpoints)
- Open source: MIT @ github.com/davife2025/Binalyst
- Demo video: max 5 min (walkthrough of CAP call → signal → trade)
- DoraHacks BUIDL: filed`

    const message = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 2000,
      system:     SUBMISSION_SYSTEM,
      messages: [{
        role:    'user',
        content: `Generate the CROO Hackathon DoraHacks submission for Binalyst.\n\n${context}`,
      }],
    })

    const submission = message.content
      .filter(b => b.type === 'text')
      .map(b => (b as any).text)
      .join('')

    return NextResponse.json({ success: true, submission, context })

  } catch (err: any) {
    console.error('[cap/submission]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
