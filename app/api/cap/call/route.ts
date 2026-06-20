/**
 * app/api/cap/call/route.ts
 * Session 6 UPDATE — adds auto USDC payment before live A2A calls.
 *
 * New behaviour when dryRun=false and autoPayment=true:
 *   1. sendUSDCPayment → target agent wallet on BSC
 *   2. Wait for on-chain confirmation → get txHash
 *   3. Include txHash in the outbound CAP request
 *
 * DEMO / dry-run paths unchanged from S5.
 * REPLACES app/api/cap/call/route.ts (S5 version).
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  callExternalAgent,
  dryRunExternalAgent,
  runA2APipeline,
  type PipelineStep,
  type A2ACallRecord,
} from '@/lib/croo/capCaller'
import { payAndGetTxHash } from '@/lib/croo/usdcPayment'
import { rateLimit } from '@/lib/rateLimit'

export const dynamic     = 'force-dynamic'
export const maxDuration = 60

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'X-CAP-Version':               '1.0',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

const callLog: A2ACallRecord[] = []
const MAX_LOG = 100
function logCall(r: A2ACallRecord) { callLog.unshift(r); if (callLog.length > MAX_LOG) callLog.length = MAX_LOG }

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = rateLimit(`cap-call:${ip}`, 'default')
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: CORS })

  let body: {
    targetEndpoint: string; targetAgentId?: string; targetName?: string
    targetWallet?:  string; serviceId: string; serviceName?: string
    priceUSDC?:     number; params: Record<string,unknown>
    paymentTxHash?: string; paymentChain?: string; dryRun?: boolean
    autoPayment?:   boolean; pipeline?: PipelineStep[]
  }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: CORS }) }

  // Pipeline mode
  if (body.pipeline && Array.isArray(body.pipeline)) {
    const prl = rateLimit(`cap-pipeline:${ip}`, 'ai-chat')
    if (!prl.allowed) return NextResponse.json({ error: 'Pipeline rate limit exceeded' }, { status: 429, headers: CORS })
    try {
      const result = await runA2APipeline(body.pipeline)
      return NextResponse.json({ success: true, pipeline: result }, { headers: CORS })
    } catch (err: any) {
      return NextResponse.json({ success: false, error: err.message }, { status: 500, headers: CORS })
    }
  }

  const { targetEndpoint, serviceId, params, paymentTxHash, paymentChain, dryRun, autoPayment, targetWallet, priceUSDC } = body

  if (!targetEndpoint || !serviceId)
    return NextResponse.json({ error: 'targetEndpoint and serviceId are required' }, { status: 400, headers: CORS })

  const callId = crypto.randomUUID()
  const record: A2ACallRecord = {
    id: callId, timestamp: Date.now(),
    targetAgentId: body.targetAgentId ?? 'unknown',
    targetName:    body.targetName    ?? targetEndpoint,
    serviceId, serviceName: body.serviceName ?? serviceId,
    priceUSDC: priceUSDC ?? 0, paymentTxHash, status: 'pending',
  }

  try {
    let resolvedTxHash = paymentTxHash
    let paymentInfo: Record<string,unknown> = {}

    // S6: Auto USDC payment before live call
    if (autoPayment && !dryRun && targetWallet && priceUSDC) {
      const pk = process.env.AGENT_PRIVATE_KEY ?? ''
      if (!pk) {
        return NextResponse.json({ error: 'AGENT_PRIVATE_KEY not set' }, { status: 500, headers: CORS })
      }
      record.status = 'paid'
      const payment = await payAndGetTxHash({ privateKey: pk, toAddress: targetWallet, amountUSDC: priceUSDC, dryRun: false })
      if (!payment.success) {
        record.status = 'failed'; record.error = `Payment failed: ${payment.error}`
        logCall(record)
        return NextResponse.json({ success: false, callId, callRecord: record, error: record.error }, { status: 402, headers: CORS })
      }
      resolvedTxHash = payment.txHash; record.paymentTxHash = payment.txHash
      paymentInfo    = { autoPayment: true, paymentTxHash: payment.txHash }
    }

    // Execute CAP call
    const isDemoCall = dryRun || !resolvedTxHash || resolvedTxHash === 'DEMO'
    const response = isDemoCall
      ? await dryRunExternalAgent({ targetEndpoint, serviceId, params })
      : await callExternalAgent({ targetEndpoint, serviceId, params, paymentTxHash: resolvedTxHash!, paymentChain: paymentChain ?? 'bsc' })

    record.status = response.success ? 'completed' : 'failed'
    record.result = response.result; record.error = response.error; record.processingMs = response.processingMs
    logCall(record)
    return NextResponse.json({ success: response.success, callId, callRecord: record, response, ...paymentInfo }, { headers: CORS })

  } catch (err: any) {
    record.status = 'failed'; record.error = err.message; logCall(record)
    return NextResponse.json({ success: false, callId, callRecord: record, error: err.message }, { status: 502, headers: CORS })
  }
}

export async function GET(req: NextRequest) {
  const limit  = parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10)
  const recent = callLog.slice(0, Math.min(limit, MAX_LOG))
  const stats  = {
    totalCalls:     callLog.length,
    completed:      callLog.filter(c => c.status === 'completed').length,
    failed:         callLog.filter(c => c.status === 'failed').length,
    paid:           callLog.filter(c => c.status === 'paid').length,
    totalSpentUSDC: callLog.reduce((s,c) => s + (c.priceUSDC ?? 0), 0).toFixed(4),
    agentsUsed:     [...new Set(callLog.map(c => c.targetAgentId))].length,
    servicesUsed:   [...new Set(callLog.map(c => c.serviceId))].length,
  }
  return NextResponse.json({ stats, calls: recent }, { headers: CORS })
}
