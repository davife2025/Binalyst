/**
 * app/api/mantle-agent/benchmark/route.ts — Session N2 (new file)
 *
 * Benchmark API — serves the on-chain decision log for the Mantle agent.
 * Part of: The Turing Test Hackathon — defining feature #1:
 * "Every agent decision and outcome is recorded on Mantle."
 *
 * GET  /api/mantle-agent/benchmark?address=0x...&network=mainnet&limit=20
 *   → Returns on-chain benchmark records for the given agent address.
 *     (Currently served from the client store; chain indexing in N4 stretch.)
 *
 * POST /api/mantle-agent/benchmark
 *   → Writes a single benchmark record on-chain (called server-side by
 *     the loop route, but exposed here for direct testing / judging demos).
 *
 * Fully independent of all existing /api/* routes.
 * Rate-limit bucket: 'mantle-benchmark' (separate from all buckets).
 */

import { NextRequest, NextResponse }  from 'next/server'
import { MantleClient }               from '@/lib/mantle/client'
import {
  writeBenchmarkRecord,
  benchmarkSinkUrl,
  estimateBenchmarkGasCost,
} from '@/lib/mantle/benchmark'
import type { MantleNetwork }         from '@/lib/mantle/config'
import type { BenchmarkRecord }       from '@/lib/mantleAgentLoop'
import { rateLimit }                  from '@/lib/rateLimit'

export const dynamic     = 'force-dynamic'
export const maxDuration = 30

// ─────────────────────────────────────────────────────────────────────────────
// GET — benchmark info for a given agent address
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = rateLimit(`mantle-benchmark-get:${ip}`, 'market')
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const { searchParams } = new URL(req.url)
  const address = searchParams.get('address') ?? ''
  const network = (searchParams.get('network') ?? 'mainnet') as MantleNetwork
  const limit   = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100)

  if (!address) {
    return NextResponse.json({ error: 'address query param required' }, { status: 400 })
  }

  // Provide benchmark metadata: sink URL, explorer link, gas estimate
  // Record retrieval from on-chain is stubbed (see lib/mantle/benchmark.ts)
  // — the UI reads records from the local store (mantleAgentStore.ts).
  const sinkUrl         = benchmarkSinkUrl(network)
  const gasEstimateUSD  = estimateBenchmarkGasCost(0.72)  // approx MNT price

  return NextResponse.json({
    success: true,
    address,
    network,
    limit,
    sinkUrl,
    gasEstimateUSD,
    note: 'Records are indexed in the client store. On-chain retrieval via Mantle Explorer API is available at the sinkUrl.',
    explorerApiDocs: 'https://explorer.mantle.xyz/api-docs',
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — write a benchmark record on-chain
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = rateLimit(`mantle-benchmark-post:${ip}`, 'trade')
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const {
      privateKey,
      network = 'mainnet' as MantleNetwork,
      record,
      dryRun  = true,
    } = body as {
      privateKey: string
      network:    MantleNetwork
      record:     BenchmarkRecord
      dryRun:     boolean
    }

    if (!privateKey) {
      return NextResponse.json({ error: 'privateKey required' }, { status: 400 })
    }
    if (!record) {
      return NextResponse.json({ error: 'record required' }, { status: 400 })
    }

    const client = new MantleClient(network, privateKey)
    const result = await writeBenchmarkRecord(client, record, dryRun)

    return NextResponse.json({
      success:     result.success,
      txHash:      result.txHash,
      explorerUrl: result.explorerUrl,
      gasUsed:     result.gasUsed,
      skipped:     result.skipped,
      error:       result.error,
      network,
      dryRun,
    })
  } catch (err: any) {
    console.error('[mantle-agent/benchmark]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
