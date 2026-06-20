/**
 * app/api/cap/manifest/route.ts
 * Returns the Binalyst CAP agent manifest.
 * Also served at app/.well-known/cap-agent.json via next.config.js rewrite.
 *
 * CROO Agent Store uses this for discovery and listing.
 */

import { NextResponse } from 'next/server'
import { buildCAPManifest } from '@/lib/croo/capClient'

export const dynamic = 'force-dynamic'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
  'X-CAP-Version': '1.0',
}

export async function GET() {
  const agentWallet = process.env.AGENT_WALLET_ADDRESS ?? '0x0000000000000000000000000000000000000000'
  const manifest = buildCAPManifest(agentWallet)
  return NextResponse.json(manifest, { headers: CORS })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}
