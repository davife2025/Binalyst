/**
 * app/api/mantle-agent/submission/route.ts — Session N4 · POLISHED
 *
 * CHANGE: Replaced @anthropic-ai/sdk with Kimi K2 via HuggingFace Inference
 * router — consistent with app/api/agent/dorahacks/route.ts pattern.
 *
 * Uses:
 *   import OpenAI from 'openai'
 *   const kimi = new OpenAI({ apiKey: process.env.HUGGINGFACE_API_KEY, baseURL: 'https://router.huggingface.co/v1' })
 *   model: 'moonshotai/Kimi-K2-Instruct'
 *
 * No new dependencies — openai SDK already installed for dorahacks route.
 * HUGGINGFACE_API_KEY already in .env.local from existing sessions.
 */

import { NextRequest, NextResponse } from 'next/server'
import OpenAI                        from 'openai'
import { rateLimit }                 from '@/lib/rateLimit'

export const dynamic     = 'force-dynamic'
export const maxDuration = 55

const kimi = new OpenAI({
  apiKey:  process.env.HUGGINGFACE_API_KEY!,
  baseURL: 'https://router.huggingface.co/v1',
})

const SUBMISSION_SYSTEM = `You are writing a competition submission for The Turing Test Hackathon Phase 2 (AI Awakening) on Mantle Network — a $100,000 prize pool hackathon judged by Allora Network, Nansen, Animoca Brands, Virtuals Protocol, and others.

The submission is for the "AI Trading & Strategy" track (primary) and "Agentic Wallets & Economy" track (secondary).

Write a compelling, technically precise submission that covers:

1. The Turing Test Hackathon's THREE defining features:
   - On-chain benchmarking: every agent decision recorded on Mantle permanently
   - ERC-8004 agent identity: unique on-chain NFT identity for the agent
   - Radical transparency: all decisions visible and verifiable on-chain

2. Technical architecture of the Mantle AI Trading Agent

3. Bybit API integration (market data, signal scoring)

4. Mantle Network integration (chain config, token support: MNT, mETH RWA, USDY RWA, USDC)

5. AI decision engine (signal scoring, guardrails, autonomous execution)

6. Byreal Skills CLI integration (Agentic Wallets & Economy track)

7. Agent performance and results

Format as a structured submission with these sections:
## Project Overview
## The Three Defining Features
## Technical Architecture
## Bybit Integration
## Mantle Network Integration (RWA: mETH, USDY)
## AI Decision Engine & Guardrails
## On-Chain Benchmarking
## ERC-8004 Agent Identity
## Byreal Skills Integration
## Performance & Results
## How to Run

Be specific, technical, and reference actual implementation details provided.
Use concrete numbers and on-chain hashes where available.
Max 1400 words total. Write as the Binalyst team.`

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = rateLimit(`mantle-submission:${ip}`, 'ai-chat')
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  try {
    const {
      agentAddress,
      network,
      agentId,
      registrationTxHash,
      totalTrades,
      benchmarkCount,
      portfolioUSD,
      startUSD,
      pnlPct,
      trades,
      session,
      agentConfig,
    } = await req.json()

    const context = `
AGENT DATA:
- Address: ${agentAddress || 'not set'}
- Network: ${network || 'testnet'}
- ERC-8004 Agent ID: ${agentId || 'not yet registered'}
- Registration tx: ${registrationTxHash || 'n/a'}

SESSION:
- Portfolio (current): $${portfolioUSD?.toFixed(2) ?? '0.00'}
- Portfolio (start): $${startUSD?.toFixed(2) ?? '0.00'}
- PnL: ${pnlPct >= 0 ? '+' : ''}${pnlPct?.toFixed(2) ?? '0.00'}%
- Total trades: ${totalTrades ?? 0}
- On-chain benchmark records: ${benchmarkCount ?? 0}
- Mode: ${agentConfig?.dryRun ? 'Dry-run (simulation)' : agentConfig?.autonomousMode ? 'Autonomous (live)' : 'Manual'}

RECENT TRADES (last 5):
${(trades ?? []).slice(0, 5).map((t: any) =>
  `- ${t.symbol} ${t.side} | score ${t.signalScore} | $${t.amountUSD?.toFixed(2)} | ${t.status} | ${t.dryRun ? 'simulated' : 'on-chain'}`
).join('\n') || 'No trades yet'}

TECH STACK:
- Chain: Mantle Network (chainId 5000 mainnet / 5003 testnet)
- Market data: Bybit V5 REST API (MNTUSDT, ETHUSDT, BTCUSDT)
- Tokens: MNT (native), mETH (RWA staked ETH), USDY (Ondo RWA), USDC
- DEX: Merchant Moe router, Agni Finance
- Benchmarking: zero-value data transactions to sink address on Mantle
- ERC-8004: Mantle Mainnet identity registry
- Skills: Byreal Skills CLI (5 skills: get_price, signal_score, run_cycle, benchmark_info, agent_identity)
- Frontend: Next.js 15, TypeScript, Tailwind, Zustand (isolated store: 'binalyst-mantle-agent')
- Wallet: ethers.js, self-custodial (private key encrypted locally, never sent to server)
- Guardrails: max 15% per trade, 10 trades/day, 0.05 MNT gas reserve, 20% drawdown circuit breaker
- AI: Kimi K2 via HuggingFace Inference (submission generation)

BYREAL SKILLS MANIFEST:
- mantle_get_price: fetch Bybit spot price for any pair
- mantle_signal_score: score a symbol 0-100 with BUY/SELL/HOLD direction
- mantle_run_cycle: trigger one full agent decision cycle
- mantle_benchmark_info: get on-chain benchmark stats for an agent
- mantle_agent_identity: get ERC-8004 identity info

PLATFORM CONTEXT:
Binalyst is a multi-chain AI trading + payments platform previously submitted to:
- OpenClaw / DoraHacks AI Hackathon (BNB Chain, TWAK integration)
- Onchain Agents Hackathon (Celo ERC-8004 payments agent)
- Sui Overflow 2026 (Sui Move trading policy contract)
The Mantle module is a new, fully isolated addition — no existing code was modified.
`

    const response = await kimi.chat.completions.create({
      model: 'moonshotai/Kimi-K2-Instruct',
      messages: [
        { role: 'system', content: SUBMISSION_SYSTEM },
        { role: 'user',   content: `Generate the Turing Test Hackathon submission for Binalyst.\n\n${context}` },
      ],
      temperature: 0.4,
    })

    const submission = response.choices[0]?.message?.content ?? ''

    return NextResponse.json({ success: true, submission })
  } catch (err: any) {
    console.error('[mantle-agent/submission]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
