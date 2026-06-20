/**
 * app/api/cap/pay/route.ts
 * Session 6 — USDC Payment Rail API
 *
 * GET  /api/cap/pay?address=0x...&amount=0.10
 *   → estimates a USDC payment (balance check, gas estimate)
 *   → returns { canPay, usdcBalance, bnbBalance, estimatedGasETH }
 *
 * POST /api/cap/pay
 *   → sends USDC to a target agent wallet on BSC
 *   → body: { toAddress, amountUSDC, dryRun? }
 *   → private key comes from AGENT_PRIVATE_KEY env (never from client)
 *   → returns { success, txHash, bscScan, gasUsed }
 *
 * NEW FILE — zero modifications to existing routes.
 * The private key is ONLY read from env — it is never accepted from the request body.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  estimatePayment,
  sendUSDCPayment,
  getUSDCBalance,
  getBNBBalance,
} from '@/lib/croo/usdcPayment'
import { rateLimit } from '@/lib/rateLimit'

export const dynamic     = 'force-dynamic'
export const maxDuration = 30

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'X-CAP-Version':               '1.0',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

// ── GET — estimate / balance check ────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = rateLimit(`cap-pay-get:${ip}`, 'default')
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: CORS })
  }

  const { searchParams } = req.nextUrl
  const address    = searchParams.get('address')
  const toAddress  = searchParams.get('to')
  const amountStr  = searchParams.get('amount')

  // Just a balance check (no target required)
  if (address && !toAddress) {
    const [usdcBalance, bnbBalance] = await Promise.all([
      getUSDCBalance(address),
      getBNBBalance(address),
    ])
    return NextResponse.json(
      {
        address,
        usdcBalance:   usdcBalance.toFixed(4),
        bnbBalance:    bnbBalance.toFixed(6),
        hasUSDC:       usdcBalance > 0,
        hasBNBForGas:  bnbBalance > 0.001,
      },
      { headers: CORS }
    )
  }

  // Full estimate
  const agentWallet = process.env.AGENT_WALLET_ADDRESS ?? ''
  const fromAddress = address ?? agentWallet

  if (!fromAddress || !toAddress || !amountStr) {
    return NextResponse.json(
      { error: 'Provide address (or use AGENT_WALLET_ADDRESS), to, and amount params' },
      { status: 400, headers: CORS }
    )
  }

  const amountUSDC = parseFloat(amountStr)
  if (isNaN(amountUSDC) || amountUSDC <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400, headers: CORS })
  }

  const estimate = await estimatePayment({ fromAddress, toAddress, amountUSDC })

  return NextResponse.json(
    {
      fromAddress,
      toAddress,
      amountUSDC,
      ...estimate,
      estimatedGasETH: estimate.estimatedGasETH.toFixed(8),
      estimatedGasUSD: estimate.estimatedGasUSD.toFixed(4),
      usdcBalance:     estimate.usdcBalance.toFixed(4),
      bnbBalance:      estimate.bnbBalance.toFixed(6),
    },
    { headers: CORS }
  )
}

// ── POST — send USDC payment ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = rateLimit(`cap-pay-post:${ip}`, 'trade')  // 10/min — same as trade
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: CORS })
  }

  let body: {
    toAddress:   string
    amountUSDC:  number
    dryRun?:     boolean
    gasPriceBump?: number
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: CORS })
  }

  const { toAddress, amountUSDC, dryRun = true, gasPriceBump = 1.1 } = body

  if (!toAddress)  return NextResponse.json({ error: 'toAddress is required' },  { status: 400, headers: CORS })
  if (!amountUSDC) return NextResponse.json({ error: 'amountUSDC is required' }, { status: 400, headers: CORS })

  // ── Safety: max single payment $5 USDC unless explicitly unlocked ──────────
  const MAX_AUTO_USDC = parseFloat(process.env.CAP_MAX_PAYMENT_USDC ?? '5')
  if (amountUSDC > MAX_AUTO_USDC && !dryRun) {
    return NextResponse.json(
      { error: `Payment amount $${amountUSDC} exceeds CAP_MAX_PAYMENT_USDC limit ($${MAX_AUTO_USDC}). Set env var to increase.` },
      { status: 422, headers: CORS }
    )
  }

  // Private key comes ONLY from env — never from the request
  const privateKey = process.env.AGENT_PRIVATE_KEY ?? ''
  if (!privateKey && !dryRun) {
    return NextResponse.json(
      { error: 'AGENT_PRIVATE_KEY not set in environment — cannot send live payment' },
      { status: 500, headers: CORS }
    )
  }

  // For dry-run without a real key, use a dummy key to get estimates
  const keyToUse = privateKey || '0x' + '1'.repeat(64)

  const result = await sendUSDCPayment({
    privateKey:   keyToUse,
    toAddress,
    amountUSDC,
    dryRun,
    gasPriceBump,
  })

  return NextResponse.json(
    {
      ...result,
      toAddress,
      amountUSDC,
      dryRun,
    },
    { status: result.success ? 200 : 400, headers: CORS }
  )
}
