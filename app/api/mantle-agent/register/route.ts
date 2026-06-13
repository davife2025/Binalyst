/**
 * app/api/mantle-agent/register/route.ts — Session N2 (new file)
 *
 * Registers the Mantle AI Trading Agent's wallet as an ERC-8004 identity
 * on Mantle Mainnet.
 * Part of: The Turing Test Hackathon — defining feature #2:
 * "Every participating AI agent is issued a unique identity NFT via ERC-8004."
 *
 * Fully independent of /api/celo-agent/register and /api/agent/* routes.
 * Rate-limit bucket: 'mantle-register' (separate from all existing buckets).
 */

import { NextRequest, NextResponse }  from 'next/server'
import { MantleClient }               from '@/lib/mantle/client'
import { registerMantleAgent }        from '@/lib/mantle/erc8004'
import type { MantleNetwork }         from '@/lib/mantle/config'
import { rateLimit }                  from '@/lib/rateLimit'

export const dynamic     = 'force-dynamic'
export const maxDuration = 55

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = rateLimit(`mantle-register:${ip}`, 'ai-chat')
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const {
      privateKey,
      network     = 'mainnet' as MantleNetwork,
      name        = 'Binalyst Mantle AI Trading Agent',
      description = 'Autonomous AI trading agent on Mantle Network — built for The Turing Test Hackathon (AI Trading & Strategy track). Executes AI-driven trades using Bybit market data, records every decision permanently on Mantle (on-chain benchmarking), and holds a verified ERC-8004 identity.',
    } = body as {
      privateKey:   string
      network:      MantleNetwork
      name?:        string
      description?: string
    }

    if (!privateKey) {
      return NextResponse.json({ error: 'privateKey required' }, { status: 400 })
    }

    // ERC-8004 registration only works on mainnet — guard enforced in
    // registerMantleAgent() too, but we give a clear error here for the UI.
    if (network !== 'mainnet') {
      return NextResponse.json(
        { error: 'ERC-8004 registration requires Mantle Mainnet. Switch network to mainnet first.' },
        { status: 400 },
      )
    }

    const client = new MantleClient(network, privateKey)
    const result = await registerMantleAgent(client, { name, description })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success:  true,
      agentId:  result.agentId,
      txHash:   result.txHash,
      agentURI: result.agentURI,
      scanUrl:  result.scanUrl,
      network,
      address:  client.getAddress(),
    })
  } catch (err: any) {
    console.error('[mantle-agent/register]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
