/**
 * app/api/agent/agentos/route.ts
 *
 * Read-only proxy to Binance's official Agent OS MCP server
 * (https://agent.binance.com/mcp/agentic). Used to show a live,
 * verifiable connection to Agent OS from the Binalyst dashboard —
 * see lib/agentOS.ts for the MCP client itself.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAgentOSSnapshot }        from '@/lib/agentOS'
import { rateLimit }                 from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = rateLimit(`agent-agentos:${ip}`, 'market')
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

  const symbol = req.nextUrl.searchParams.get('symbol') ?? 'BTCUSDT'

  const snapshot = await getAgentOSSnapshot(symbol)
  return NextResponse.json(snapshot, { status: snapshot.connected ? 200 : 502 })
}
