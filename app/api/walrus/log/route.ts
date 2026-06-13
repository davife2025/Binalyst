/**
 * app/api/walrus/log/route.ts
 * Walrus activity log read endpoint — Session L.
 *
 * GET /api/walrus/log?blobId=...  — retrieve a single log entry
 * POST /api/walrus/log            — write a custom log entry
 *
 * New file — does not touch any existing API route.
 */

import { NextRequest, NextResponse } from 'next/server'
import { readLogEntry, logCycleSummary } from '@/lib/walrus/activityLog'
import { walrusBlobUrl }             from '@/lib/walrus/client'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const blobId = searchParams.get('blobId')

  if (!blobId) {
    return NextResponse.json({ error: 'blobId is required' }, { status: 400 })
  }

  try {
    const entry = await readLogEntry(blobId)
    if (!entry) {
      return NextResponse.json({ error: 'Log entry not found', blobId }, { status: 404 })
    }
    return NextResponse.json({
      blobId,
      blobUrl: walrusBlobUrl(blobId),
      entry,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let body: {
    cycleAt?: number
    cycleCount?: number
    executed?: number
    blocked?: number
    errors?: string[]
    agentAddress?: string
    network?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    const result = await logCycleSummary({
      cycleAt:      body.cycleAt      ?? Date.now(),
      cycleCount:   body.cycleCount   ?? 0,
      executed:     body.executed     ?? 0,
      blocked:      body.blocked      ?? 0,
      errors:       body.errors       ?? [],
      agentAddress: body.agentAddress ?? null,
      network:      body.network      ?? 'testnet',
    })

    return NextResponse.json({
      success:  result.success,
      blobId:   result.blobId,
      blobUrl:  result.blobUrl,
      error:    result.error,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
