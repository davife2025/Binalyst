/**
 * app/api/sui/revoke/route.ts
 * Policy revocation endpoint — Session M.
 *
 * POST /api/sui/revoke
 * Builds the revoke_policy PTB and logs the revocation event to Walrus.
 * The owner wallet signs and submits the PTB client-side.
 *
 * New file — does not touch any existing API route.
 */

import { NextRequest, NextResponse } from 'next/server'
import { buildRevokePolicyTx }       from '@/lib/movePolicy/client'
import { logPolicyEvent }            from '@/lib/walrus/activityLog'
import { isValidSuiAddress }         from '@/lib/sui/client'
import type { SuiNetwork }           from '@/lib/sui/client'

export async function POST(req: NextRequest) {
  let body: {
    policyObjectId?: string
    ownerAddress?:   string
    agentAddress?:   string
    network?:        string
    txDigest?:       string   // provided after on-chain revoke confirmed
    budgetCapCents?: number
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    policyObjectId,
    ownerAddress,
    agentAddress  = '',
    network       = 'testnet',
    txDigest,
    budgetCapCents,
  } = body

  if (!policyObjectId) {
    return NextResponse.json({ error: 'policyObjectId is required' }, { status: 400 })
  }
  if (!ownerAddress || !isValidSuiAddress(ownerAddress)) {
    return NextResponse.json({ error: 'Invalid ownerAddress' }, { status: 400 })
  }

  try {
    // Build the revoke PTB
    const ptb = buildRevokePolicyTx({
      policyObjectId,
      network: network as SuiNetwork,
    })

    // If txDigest provided, the revoke already happened on-chain — log it to Walrus
    let walrusBlobId: string | undefined
    let walrusBlobUrl: string | undefined

    if (txDigest) {
      const logResult = await logPolicyEvent({
        type:           'policy_revoked',
        policyObjectId,
        ownerAddress,
        agentAddress,
        network,
        txDigest,
        budgetCapCents,
      })
      walrusBlobId  = logResult.blobId  || undefined
      walrusBlobUrl = logResult.blobUrl || undefined
    }

    return NextResponse.json({
      success:        true,
      ptb:            ptb,
      policyObjectId,
      network,
      description:    'Sign and submit this PTB with your OWNER wallet to revoke the agent policy on-chain. This is permanent.',
      walrusBlobId,
      walrusBlobUrl,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
