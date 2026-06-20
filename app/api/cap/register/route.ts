/**
 * app/api/cap/register/route.ts
 * Session 4 — CROO Agent Store Registration API
 *
 * POST /api/cap/register
 *   → builds registration payload
 *   → validates required env vars
 *   → submits to CROO Agent Store
 *   → returns { success, listingId, storeUrl, validationErrors }
 *
 * GET /api/cap/register?listingId=xxx
 *   → polls CROO Agent Store for listing status
 *
 * NEW FILE — does not modify any existing route.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  buildRegistrationPayload,
  submitToAgentStore,
  fetchListingStatus,
  validatePayload,
} from '@/lib/croo/capRegister'
import { rateLimit } from '@/lib/rateLimit'

export const dynamic     = 'force-dynamic'
export const maxDuration = 20

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'X-CAP-Version': '1.0',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

// ── POST — submit listing ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = rateLimit(`cap-register:${ip}`, 'default')
  if (!rl.allowed) {
    return NextResponse.json({ success: false, error: 'Rate limit exceeded' }, { status: 429, headers: CORS })
  }

  let body: {
    demoVideoUrl?: string
    contactEmail?: string
  } = {}

  try {
    body = await req.json()
  } catch {
    // body is optional — use defaults
  }

  const agentWallet = process.env.AGENT_WALLET_ADDRESS ?? ''
  const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? ''

  const payload = buildRegistrationPayload({
    agentWallet,
    appUrl,
    demoVideoUrl: body.demoVideoUrl,
    contactEmail: body.contactEmail,
  })

  // Validate before submitting
  const validationErrors = validatePayload(payload)

  if (validationErrors.length > 0) {
    return NextResponse.json(
      {
        success:          false,
        validationErrors,
        payload,          // return so UI can show what would be submitted
        error:            'Validation failed — fix env vars before submitting',
      },
      { status: 422, headers: CORS }
    )
  }

  // Submit to CROO Agent Store
  const result = await submitToAgentStore(payload)

  return NextResponse.json(
    {
      success:          result.success,
      listingId:        result.listingId,
      storeUrl:         result.storeUrl,
      validationErrors: [],
      warning:          result.error,   // soft warning if API was unreachable
      payload,
    },
    { status: result.success ? 200 : 500, headers: CORS }
  )
}

// ── GET — poll listing status ──────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const listingId = req.nextUrl.searchParams.get('listingId')

  if (!listingId) {
    // No listingId — return current env config
    const agentWallet = process.env.AGENT_WALLET_ADDRESS ?? ''
    const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const payload     = buildRegistrationPayload({ agentWallet, appUrl })
    const errors      = validatePayload(payload)

    return NextResponse.json(
      {
        ready:            errors.length === 0,
        validationErrors: errors,
        agentWallet:      agentWallet ? agentWallet.slice(0, 6) + '…' + agentWallet.slice(-4) : 'not set',
        appUrl:           appUrl || 'not set',
        servicesCount:    payload.services.length,
        chainsCount:      payload.chains.length,
      },
      { headers: CORS }
    )
  }

  const status = await fetchListingStatus(listingId)
  return NextResponse.json(status, { headers: CORS })
}
