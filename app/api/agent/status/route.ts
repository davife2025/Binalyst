/**
 * app/api/agent/status/route.ts
 * Returns agent wallet status: BNB balance, USDT balance, registration state.
 */

import { NextRequest, NextResponse } from 'next/server'
import { TWAKClient, ELIGIBLE_TOKENS } from '@/lib/twak/client'
import { rateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = rateLimit(`agent-status:${ip}`, 'market')
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

  try {
    const { privateKey, tokens = ['USDT', 'FDUSD'] } = await req.json()
    if (!privateKey) return NextResponse.json({ error: 'privateKey required' }, { status: 400 })

    const client = new TWAKClient(privateKey)

    const [bnbBalance, isRegistered, ...tokenBalances] = await Promise.allSettled([
      client.getBNBBalance(),
      client.isRegistered(),
      ...tokens.map((sym: string) => {
        const token = ELIGIBLE_TOKENS[sym]
        return token ? client.getTokenBalance(token.address) : Promise.resolve(0)
      }),
    ])

    const balances: Record<string, number> = {}
    tokens.forEach((sym: string, i: number) => {
      const r = tokenBalances[i]
      balances[sym] = r?.status === 'fulfilled' ? r.value : 0
    })

    return NextResponse.json({
      success:      true,
      address:      client.address,
      bnbBalance:   bnbBalance.status === 'fulfilled' ? bnbBalance.value : 0,
      isRegistered: isRegistered.status === 'fulfilled' ? isRegistered.value : false,
      tokenBalances: balances,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
