/**
 * app/api/celo-agent/register/route.ts — Session M (new file)
 *
 * Registers the Celo Payments Agent's wallet as an ERC-8004 agent identity
 * on Celo Mainnet (Onchain Agents Hackathon Track 3 — 8004scan rank).
 * Independent of /api/celo-agent/loop and /api/agent/loop.
 */

import { NextRequest, NextResponse } from 'next/server'
import { CeloClient } from '@/lib/celo/client'
import { registerAgent } from '@/lib/celo/erc8004'
import type { CeloNetwork } from '@/lib/celo/config'
import { rateLimit } from '@/lib/rateLimit'

export const dynamic     = 'force-dynamic'
export const maxDuration = 55

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = rateLimit(`celo-register:${ip}`, 'ai-chat')
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

  try {
    const body = await req.json()
    const {
      privateKey,
      network     = 'mainnet',
      name        = 'Binalyst Celo Payments Agent',
      description = 'Autonomous agent for recurring CELO/cUSD payments — built for the Onchain Agents Hackathon (Real World Payments & Everyday Applications).',
    } = body as {
      privateKey: string
      network: CeloNetwork
      name?: string
      description?: string
    }

    if (!privateKey) return NextResponse.json({ error: 'privateKey required' }, { status: 400 })

    const client = new CeloClient(privateKey, network)
    const result = await registerAgent(client, { name, description })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[celo-agent/register]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
