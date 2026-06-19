// app/api/zk/verify/route.ts
//
// POST /api/zk/verify
//
// Submits a RISC Zero receipt to the Soroban verifier contract on Stellar.
//
// Flow:
//   1. Receive ZKVerifyRequest (proofId + sealHex + journalHex)
//   2. Call StellarVerifierClient.verifyTradeProof(sealHex, journalHex)
//   3. Poll Stellar RPC until tx confirmed
//   4. Return ZKVerifyResponse with Stellar tx hash + on-chain proof index
//
// In mock mode (STELLAR_MOCK=true), skips the Stellar call and returns
// a deterministic mock response — use this until the contract is deployed.

import { NextRequest, NextResponse }  from 'next/server'
import { rateLimit }                  from '@/lib/rateLimit'
import { getStellarClient, STELLAR_CONFIG } from '@/lib/stellar/client'
import type { ZKVerifyRequest, ZKVerifyResponse } from '@/lib/stellar/types'

export const dynamic     = 'force-dynamic'
export const maxDuration = 120   // Stellar confirmation takes ~5-30s

const STELLAR_MOCK = process.env.STELLAR_MOCK === 'true'

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = rateLimit(`zk-verify:${ip}`, 'ai-chat')
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  // P4 FIX: parse body once before try/catch — req.json() can only be called once
  let body: ZKVerifyRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const { proofId, sealHex, journalHex } = body

    if (!proofId || !sealHex || !journalHex) {
      return NextResponse.json(
        { error: 'proofId, sealHex, and journalHex are required' },
        { status: 400 }
      )
    }

    if (STELLAR_MOCK) {
      return NextResponse.json<ZKVerifyResponse>(buildMockVerifyResponse(proofId))
    }

    // ── Real Stellar submission ─────────────────────────────────────────────
    const client = getStellarClient()
    const result = await client.verifyTradeProof(sealHex, journalHex)

    return NextResponse.json<ZKVerifyResponse>({
      success:     true,
      proofId,
      stellarTxId: result.txHash,
      proofIndex:  result.proofIndex,
      explorerUrl: result.explorerUrl,
    })

  } catch (err: any) {
    console.error('[zk/verify]', err.message)
    return NextResponse.json<ZKVerifyResponse>({
      success:     false,
      proofId:     body?.proofId ?? '',
      stellarTxId: null,
      proofIndex:  null,
      explorerUrl: null,
      error:       err.message,
    }, { status: 500 })
  }
}

// ── GET /api/zk/verify — config + proof count (for UI health check) ─────────

export async function GET(): Promise<NextResponse> {
  try {
    const config = STELLAR_CONFIG

    if (STELLAR_MOCK) {
      return NextResponse.json({
        mock:       true,
        network:    config.network,
        contractId: config.contractId,
        proofCount: 3,   // mock count
        explorerUrl: config.explorerUrl,
      })
    }

    const client     = getStellarClient()
    const proofCount = await client.proofCount()

    return NextResponse.json({
      mock:        false,
      network:     config.network,
      contractId:  config.contractId,
      proofCount,
      explorerUrl: config.explorerUrl,
      contractExplorer: client.explorerContract(),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock verify response — for development before contract is deployed
// ─────────────────────────────────────────────────────────────────────────────

let mockProofCounter = 0

function buildMockVerifyResponse(proofId: string): ZKVerifyResponse {
  mockProofCounter++
  const mockTxId  = `mock_tx_${proofId.replace(/-/g, '').slice(0, 16)}`
  const mockIndex = mockProofCounter

  return {
    success:     true,
    proofId,
    stellarTxId: mockTxId,
    proofIndex:  mockIndex,
    explorerUrl: `https://stellar.expert/explorer/testnet/tx/${mockTxId}`,
  }
}
