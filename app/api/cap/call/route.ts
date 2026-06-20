/**
 * app/api/cap/call/route.ts
 * Session 5 — A2A Outbound Caller API
 *
 * POST /api/cap/call
 *   → Binalyst calls another CAP agent's service as a dependency
 *   → Accepts { targetEndpoint, serviceId, params, paymentTxHash?, dryRun? }
 *   → Returns the external agent's CAPResponse + call record
 *
 * POST /api/cap/call/pipeline
 *   → Runs a sequential multi-agent pipeline
 *   → Each step's result feeds into the next step's params
 *
 * NEW FILE — zero modifications to existing routes.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  callExternalAgent,
  dryRunExternalAgent,
  runA2APipeline,
  type PipelineStep,
  type A2ACallRecord,
} from '@/lib/croo/capCaller'
import { rateLimit } from '@/lib/rateLimit'

export const dynamic     = 'force-dynamic'
export const maxDuration = 45

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'X-CAP-Version':               '1.0',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

// ── In-memory call log (upgrade to KV/DB in production) ──────────────────────

const callLog: A2ACallRecord[] = []
const MAX_LOG = 100

function logCall(record: A2ACallRecord) {
  callLog.unshift(record)
  if (callLog.length > MAX_LOG) callLog.length = MAX_LOG
}

// ── POST — single A2A call ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = rateLimit(`cap-call:${ip}`, 'default')
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: CORS })
  }

  let body: {
    targetEndpoint:  string
    targetAgentId?:  string
    targetName?:     string
    serviceId:       string
    serviceName?:    string
    priceUSDC?:      number
    params:          Record<string, unknown>
    paymentTxHash?:  string
    paymentChain?:   string
    dryRun?:         boolean
    pipeline?:       PipelineStep[]
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: CORS })
  }

  // ── Pipeline mode ─────────────────────────────────────────────────────────
  if (body.pipeline && Array.isArray(body.pipeline)) {
    const pipelineRl = rateLimit(`cap-pipeline:${ip}`, 'ai-chat')
    if (!pipelineRl.allowed) {
      return NextResponse.json({ error: 'Pipeline rate limit exceeded' }, { status: 429, headers: CORS })
    }

    try {
      const result = await runA2APipeline(body.pipeline)
      return NextResponse.json({ success: true, pipeline: result }, { headers: CORS })
    } catch (err: any) {
      return NextResponse.json({ success: false, error: err.message }, { status: 500, headers: CORS })
    }
  }

  // ── Single call mode ──────────────────────────────────────────────────────
  const { targetEndpoint, serviceId, params, paymentTxHash, paymentChain, dryRun } = body

  if (!targetEndpoint || !serviceId) {
    return NextResponse.json(
      { error: 'targetEndpoint and serviceId are required' },
      { status: 400, headers: CORS }
    )
  }

  const callId    = crypto.randomUUID()
  const startedAt = Date.now()

  // Create pending record
  const record: A2ACallRecord = {
    id:             callId,
    timestamp:      startedAt,
    targetAgentId:  body.targetAgentId ?? 'unknown',
    targetName:     body.targetName    ?? targetEndpoint,
    serviceId,
    serviceName:    body.serviceName   ?? serviceId,
    priceUSDC:      body.priceUSDC     ?? 0,
    paymentTxHash:  paymentTxHash,
    status:         'pending',
  }

  try {
    let response

    if (dryRun || !paymentTxHash || paymentTxHash === 'DEMO') {
      // DEMO mode — no real payment required
      response = await dryRunExternalAgent({ targetEndpoint, serviceId, params })
    } else {
      // Live mode — caller must have already sent USDC
      response = await callExternalAgent({
        targetEndpoint,
        serviceId,
        params,
        paymentTxHash,
        paymentChain: paymentChain ?? 'bsc',
      })
    }

    record.status       = response.success ? 'completed' : 'failed'
    record.result       = response.result
    record.error        = response.error
    record.processingMs = response.processingMs

    logCall(record)

    return NextResponse.json(
      {
        success:    response.success,
        callId,
        callRecord: record,
        response,
      },
      { headers: CORS }
    )

  } catch (err: any) {
    record.status = 'failed'
    record.error  = err.message
    logCall(record)

    return NextResponse.json(
      { success: false, callId, callRecord: record, error: err.message },
      { status: 502, headers: CORS }
    )
  }
}

// ── GET — call history ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const limit  = parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10)
  const recent = callLog.slice(0, Math.min(limit, MAX_LOG))

  const stats = {
    totalCalls:       callLog.length,
    completed:        callLog.filter(c => c.status === 'completed').length,
    failed:           callLog.filter(c => c.status === 'failed').length,
    totalSpentUSDC:   callLog.reduce((s, c) => s + (c.priceUSDC ?? 0), 0).toFixed(4),
    agentsUsed:       [...new Set(callLog.map(c => c.targetAgentId))].length,
    servicesUsed:     [...new Set(callLog.map(c => c.serviceId))].length,
  }

  return NextResponse.json({ stats, calls: recent }, { headers: CORS })
}
