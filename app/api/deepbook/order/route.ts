/**
 * app/api/deepbook/order/route.ts
 * DeepBook order management endpoint — Session L.
 *
 * POST   /api/deepbook/order  — place (or simulate) an order
 * DELETE /api/deepbook/order  — cancel an order
 *
 * For dry-run orders: executes immediately and returns the order.
 * For live orders: builds and returns a PTB for the wallet to sign.
 * Every order (dry-run or live) is logged to Walrus.
 *
 * New file — does not touch any existing API route.
 */

import { NextRequest, NextResponse }       from 'next/server'
import { simulatePlaceOrder, buildPlaceOrderTx, buildCancelOrderTx } from '@/lib/deepbook/client'
import { logOrderPlaced }                  from '@/lib/walrus/activityLog'
import type { PlaceOrderRequest, CancelOrderRequest } from '@/lib/deepbook/types'
import type { SuiNetwork }                 from '@/lib/sui/client'
import { isValidSuiAddress }              from '@/lib/sui/client'

// ── POST: place order ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: Partial<PlaceOrderRequest>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    poolId,
    side,
    type       = 'limit',
    price,
    quantity,
    walletAddress,
    network    = 'testnet',
    dryRun     = true,
    agentReasoning,
    signalScore,
  } = body

  // Validate
  if (!poolId)                            return NextResponse.json({ error: 'poolId required' }, { status: 400 })
  if (!side || !['bid','ask'].includes(side))
                                          return NextResponse.json({ error: 'side must be bid or ask' }, { status: 400 })
  if (!price || price <= 0)              return NextResponse.json({ error: 'price must be > 0' }, { status: 400 })
  if (!quantity || quantity <= 0)        return NextResponse.json({ error: 'quantity must be > 0' }, { status: 400 })
  if (!walletAddress || !isValidSuiAddress(walletAddress))
                                          return NextResponse.json({ error: 'Invalid walletAddress' }, { status: 400 })

  const orderReq: PlaceOrderRequest = {
    poolId,
    side,
    type,
    price,
    quantity,
    walletAddress,
    network: network as SuiNetwork,
    dryRun: dryRun ?? true,
    agentReasoning,
    signalScore,
  }

  try {
    if (dryRun) {
      // Simulate + log to Walrus
      const result = await simulatePlaceOrder(orderReq)

      if (result.success && result.order) {
        const logResult = await logOrderPlaced(result.order, walletAddress)
        result.walrusBlobId = logResult.blobId
        if (result.order) result.order.walrusBlobId = logResult.blobId
      }

      return NextResponse.json(result)
    } else {
      // Build PTB for wallet signing
      const { ptb, rpcUrl } = buildPlaceOrderTx(orderReq)
      return NextResponse.json({
        success: true,
        ptb,
        rpcUrl,
        description: 'Sign and submit this PTB with your agent wallet to place the order on DeepBook.',
        network,
      })
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── DELETE: cancel order ──────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  let body: Partial<CancelOrderRequest>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { poolId, orderId, walletAddress, network = 'testnet' } = body

  if (!poolId || !orderId)        return NextResponse.json({ error: 'poolId and orderId required' }, { status: 400 })
  if (!walletAddress || !isValidSuiAddress(walletAddress))
                                   return NextResponse.json({ error: 'Invalid walletAddress' }, { status: 400 })

  try {
    const { ptb } = buildCancelOrderTx({
      poolId, orderId, walletAddress, network: network as SuiNetwork,
    })
    return NextResponse.json({
      success: true,
      ptb,
      description: 'Sign and submit this PTB to cancel the order on DeepBook.',
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
