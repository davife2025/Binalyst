/**
 * app/api/sui/agent/route.ts
 * Sui agent status and control endpoint — Session K.
 *
 * GET  /api/sui/agent           — health check + config
 * POST /api/sui/agent           — update agent config
 *
 * New file — does not touch any existing API route.
 */

import { NextRequest, NextResponse } from 'next/server'
import { DEFAULT_SUI_AGENT_CONFIG }  from '@/lib/sui/types'

export async function GET() {
  return NextResponse.json({
    module:       'sui-agent',
    version:      'session-k',
    status:       'ready',
    defaultConfig: DEFAULT_SUI_AGENT_CONFIG,
    endpoints: {
      wallet: '/api/sui/wallet',
      policy: '/api/sui/policy',
      agent:  '/api/sui/agent',
    },
  })
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Validate key fields if present
  if (body.maxTradeUSD !== undefined && (typeof body.maxTradeUSD !== 'number' || body.maxTradeUSD <= 0)) {
    return NextResponse.json({ error: 'maxTradeUSD must be a positive number' }, { status: 400 })
  }
  if (body.minSignalScore !== undefined && (typeof body.minSignalScore !== 'number' || body.minSignalScore < 0 || body.minSignalScore > 100)) {
    return NextResponse.json({ error: 'minSignalScore must be 0–100' }, { status: 400 })
  }

  // Config is managed client-side in useSuiStore — this endpoint just validates + echoes
  return NextResponse.json({
    updated: true,
    config:  { ...DEFAULT_SUI_AGENT_CONFIG, ...body },
  })
}
