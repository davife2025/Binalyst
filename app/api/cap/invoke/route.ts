/**
 * app/api/cap/invoke/route.ts
 * CROO Agent Protocol — Service Invocation Endpoint
 *
 * Any agent (human or AI) that has paid USDC on-chain can call this endpoint
 * to consume one of Binalyst's four CAP services:
 *   market_signal | backtest_report | portfolio_scan | trade_execute
 *
 * Flow:
 *  POST /api/cap/invoke
 *   → verify on-chain USDC payment
 *   → dispatch to internal service handler
 *   → return CAPResponse JSON
 *
 * CROO docs: docs.croo.network
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  BINALYST_SERVICES,
  verifyPayment,
  type CAPRequest,
  type CAPResponse,
} from '@/lib/croo/capClient'
import { rateLimit } from '@/lib/rateLimit'

export const dynamic     = 'force-dynamic'
export const maxDuration = 45

// Agent wallet that receives USDC payments (set in env)
const AGENT_WALLET = process.env.AGENT_WALLET_ADDRESS ?? ''

// ── CORS headers for A2A calls ────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-CAP-Version',
  'X-CAP-Version':                '1.0',
  'X-Agent-ID':                   'binalyst-trading-agent',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(req: NextRequest) {
  const start = Date.now()
  const ip    = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl    = rateLimit(`cap:${ip}`, 'default')
  if (!rl.allowed) {
    return NextResponse.json({ success: false, error: 'Rate limit exceeded' }, { status: 429, headers: CORS })
  }

  let capReq: CAPRequest
  try {
    capReq = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400, headers: CORS })
  }

  const { serviceId, callerId, paymentTxHash, paymentChain, params, nonce, timestamp } = capReq

  // ── Basic validation ──────────────────────────────────────────────────────

  if (!serviceId || !nonce) {
    return NextResponse.json({ success: false, error: 'serviceId and nonce are required' }, { status: 400, headers: CORS })
  }

  const service = BINALYST_SERVICES.find(s => s.id === serviceId)
  if (!service) {
    return NextResponse.json({ success: false, error: `Unknown serviceId: ${serviceId}. Valid: ${BINALYST_SERVICES.map(s => s.id).join(', ')}` }, { status: 404, headers: CORS })
  }

  // ── Payment verification ──────────────────────────────────────────────────
  // Skip verification if tx hash is 'DEMO' (for hackathon demos)

  if (paymentTxHash && paymentTxHash !== 'DEMO' && AGENT_WALLET) {
    const payment = await verifyPayment({
      txHash:       paymentTxHash,
      chain:        paymentChain ?? 'bsc',
      expectedUSDC: service.priceUSDC,
      toAddress:    AGENT_WALLET,
    })

    if (!payment.valid) {
      return NextResponse.json(
        { success: false, error: `Payment verification failed: ${payment.error}`, nonce, serviceId, agentId: 'binalyst-trading-agent', processingMs: Date.now() - start },
        { status: 402, headers: CORS }
      )
    }
  }

  // ── Dispatch to service handler ───────────────────────────────────────────

  try {
    let result: Record<string, unknown>

    switch (serviceId) {
      case 'market_signal':
        result = await handleMarketSignal(params)
        break
      case 'backtest_report':
        result = await handleBacktest(params)
        break
      case 'portfolio_scan':
        result = await handlePortfolioScan(params)
        break
      case 'trade_execute':
        result = await handleTradeExecute(params)
        break
      default:
        result = { error: 'handler not implemented' }
    }

    const response: CAPResponse = {
      success:       true,
      nonce,
      serviceId,
      result,
      agentId:       'binalyst-trading-agent',
      processingMs:  Date.now() - start,
      settlementRef: paymentTxHash ?? 'DEMO',
    }

    return NextResponse.json(response, { headers: CORS })

  } catch (err: any) {
    console.error('[cap/invoke]', err.message)
    const errorResponse: CAPResponse = {
      success:      false,
      nonce,
      serviceId,
      error:        err.message,
      agentId:      'binalyst-trading-agent',
      processingMs: Date.now() - start,
    }
    return NextResponse.json(errorResponse, { status: 500, headers: CORS })
  }
}

// ── Service Handlers ──────────────────────────────────────────────────────────

async function handleMarketSignal(params: Record<string, unknown>) {
  const symbol   = (params.symbol as string) ?? 'BTC'
  const interval = (params.interval as string) ?? '1h'

  // Call internal technicals API
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const techRes = await fetch(`${baseUrl}/api/technicals`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ symbol, interval }),
  })

  if (!techRes.ok) throw new Error('Technical analysis service unavailable')
  const techData = await techRes.json()

  // Call internal signals API
  const sigRes = await fetch(`${baseUrl}/api/agent/strategy`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ symbol, technicals: techData }),
  })
  const sigData = sigRes.ok ? await sigRes.json() : {}

  return {
    symbol,
    interval,
    signal:     sigData.signal ?? techData.signal ?? 'HOLD',
    confidence: sigData.confidence ?? 60,
    score:      sigData.score ?? 50,
    regime:     techData.regime ?? 'RANGING',
    indicators: techData.indicators ?? {},
    reasoning:  sigData.reasoning ?? 'Technical signal computed from RSI, MACD, BB, ADX, EMA, VWAP.',
    timestamp:  Date.now(),
  }
}

async function handleBacktest(params: Record<string, unknown>) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/backtest`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      strategy:  params.strategy ?? 'RSI mean-reversion',
      symbols:   params.symbols ?? ['BTC', 'ETH'],
      startDate: params.startDate,
      endDate:   params.endDate,
      startUSDT: params.startUSDT ?? 1000,
    }),
  })
  if (!res.ok) throw new Error('Backtest service unavailable')
  return await res.json()
}

async function handlePortfolioScan(params: Record<string, unknown>) {
  const walletAddress = params.walletAddress as string
  if (!walletAddress) throw new Error('walletAddress is required')

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/agent/portfolio`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ walletAddress }),
  })
  if (!res.ok) throw new Error('Portfolio scan service unavailable')
  return await res.json()
}

async function handleTradeExecute(params: Record<string, unknown>) {
  // For security, trade_execute always uses the agent's own wallet
  // (external callers cannot pass a private key)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/agent/execute`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      privateKey:   process.env.AGENT_PRIVATE_KEY ?? '',
      symbol:       params.symbol ?? 'BTC',
      action:       params.action ?? 'BUY',
      amountUSDT:   params.amountUSDT ?? 10,
      slippagePct:  params.slippagePct ?? 1.0,
      dryRun:       params.dryRun !== false,  // default to dry-run for safety
    }),
  })
  if (!res.ok) throw new Error('Trade execution service unavailable')
  return await res.json()
}
