/**
 * app/api/sui/wallet/route.ts
 * Sui wallet balance endpoint — Session K.
 *
 * GET /api/sui/wallet?address=0x...&network=testnet
 * Returns SUI balance for the given address.
 *
 * New file — does not touch any existing API route.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSuiBalance, isValidSuiAddress } from '@/lib/sui/client'
import type { SuiNetwork } from '@/lib/sui/client'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const address = searchParams.get('address') ?? ''
  const network = (searchParams.get('network') ?? 'testnet') as SuiNetwork

  if (!address) {
    return NextResponse.json({ error: 'address is required' }, { status: 400 })
  }

  if (!isValidSuiAddress(address)) {
    return NextResponse.json({ error: 'Invalid Sui address format' }, { status: 400 })
  }

  if (!['mainnet', 'testnet', 'devnet'].includes(network)) {
    return NextResponse.json({ error: 'Invalid network' }, { status: 400 })
  }

  try {
    const { balanceSUI, balanceMIST } = await getSuiBalance(address, network)

    return NextResponse.json({
      address,
      network,
      balanceSUI,
      balanceMIST: balanceMIST.toString(),
      updatedAt: Date.now(),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
