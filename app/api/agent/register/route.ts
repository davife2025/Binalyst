/**
 * app/api/agent/register/route.ts
 * Registers the agent wallet in the BSC competition contract.
 * Private key is passed in the request body — never logged or stored.
 */

import { NextRequest, NextResponse } from 'next/server'
import { TWAKClient } from '@/lib/twak/client'
import { rateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = rateLimit(`agent-reg:${ip}`, 'default')
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

  try {
    const { privateKey } = await req.json()
    if (!privateKey) return NextResponse.json({ error: 'privateKey required' }, { status: 400 })

    const client = new TWAKClient(privateKey)
    const already = await client.isRegistered()

    if (already) {
      return NextResponse.json({
        success: true,
        already: true,
        address: client.address,
        message: 'Agent already registered for competition.',
      })
    }

    const result = await client.registerForCompetition()
    return NextResponse.json({
      success:  result.success,
      address:  client.address,
      txHash:   result.txHash,
      message:  result.message,
      bscScan:  result.txHash
        ? `https://bscscan.com/tx/${result.txHash}`
        : null,
    })
  } catch (err: any) {
    console.error('[agent/register]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
