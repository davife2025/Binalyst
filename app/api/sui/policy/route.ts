/**
 * app/api/sui/policy/route.ts
 * Move policy management endpoint — Session K.
 *
 * POST /api/sui/policy          — build a create-policy PTB
 * DELETE /api/sui/policy        — build a revoke-policy PTB
 * GET /api/sui/policy?id=0x...  — fetch policy object state from Sui
 *
 * The client (browser) receives the PTB, signs it with their wallet,
 * and submits it. This route never holds private keys.
 *
 * New file — does not touch any existing API route.
 */

import { NextRequest, NextResponse }           from 'next/server'
import { buildCreatePolicyTx, buildRevokePolicyTx } from '@/lib/movePolicy/client'
import type { PolicyCreateParams }              from '@/lib/movePolicy/client'
import type { SuiNetwork }                      from '@/lib/sui/client'
import { isValidSuiAddress }                    from '@/lib/sui/client'

// ── POST: build create-policy PTB ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: Partial<PolicyCreateParams>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    ownerAddress,
    agentAddress,
    budgetCapCents,
    perTradeLimitCents,
    allowedPools,
    expiryEpoch,
    network = 'testnet',
  } = body

  // Validate
  if (!ownerAddress || !isValidSuiAddress(ownerAddress)) {
    return NextResponse.json({ error: 'Invalid ownerAddress' }, { status: 400 })
  }
  if (!agentAddress || !isValidSuiAddress(agentAddress)) {
    return NextResponse.json({ error: 'Invalid agentAddress' }, { status: 400 })
  }
  if (!budgetCapCents || budgetCapCents <= 0) {
    return NextResponse.json({ error: 'budgetCapCents must be > 0' }, { status: 400 })
  }
  if (!perTradeLimitCents || perTradeLimitCents <= 0) {
    return NextResponse.json({ error: 'perTradeLimitCents must be > 0' }, { status: 400 })
  }
  if (perTradeLimitCents > budgetCapCents) {
    return NextResponse.json({ error: 'perTradeLimitCents cannot exceed budgetCapCents' }, { status: 400 })
  }

  const ptb = buildCreatePolicyTx({
    ownerAddress,
    agentAddress,
    budgetCapCents,
    perTradeLimitCents,
    allowedPools:      allowedPools ?? [],
    expiryEpoch,
    network:           network as SuiNetwork,
  })

  return NextResponse.json({
    ptb,
    description: 'Sign and submit this PTB with your owner wallet to create the agent policy on-chain.',
    packageId:   process.env.NEXT_PUBLIC_POLICY_PACKAGE_ID ?? 'not-deployed',
  })
}

// ── DELETE: build revoke-policy PTB ──────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const policyObjectId   = searchParams.get('policyId') ?? ''
  const network          = (searchParams.get('network') ?? 'testnet') as SuiNetwork

  if (!policyObjectId) {
    return NextResponse.json({ error: 'policyId is required' }, { status: 400 })
  }

  const ptb = buildRevokePolicyTx({ policyObjectId, network })

  return NextResponse.json({
    ptb,
    description: 'Sign and submit this PTB with your OWNER wallet to revoke the agent policy. This is irreversible.',
    policyObjectId,
    network,
  })
}

// ── GET: fetch policy object from Sui ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const id      = searchParams.get('id')      ?? ''
  const network = (searchParams.get('network') ?? 'testnet') as SuiNetwork

  if (!id) {
    return NextResponse.json({ error: 'id (policy object ID) is required' }, { status: 400 })
  }

  try {
    const rpcUrl = network === 'mainnet'
      ? 'https://fullnode.mainnet.sui.io'
      : 'https://fullnode.testnet.sui.io'

    const res = await fetch(rpcUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'sui_getObject',
        params: [id, { showContent: true, showOwner: true }],
      }),
    })

    const json = await res.json() as {
      result?: { data?: { content?: unknown; owner?: unknown } }
      error?:  { message: string }
    }

    if (json.error) {
      return NextResponse.json({ error: json.error.message }, { status: 400 })
    }

    return NextResponse.json({
      objectId: id,
      network,
      content:  json.result?.data?.content ?? null,
      owner:    json.result?.data?.owner   ?? null,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
