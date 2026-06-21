/**
 * app/api/cap/status/route.ts
 * Returns real-time agent health + CAP call metrics for the CROO Agent Store listing.
 */

import { NextResponse } from 'next/server'
import { BINALYST_SERVICES } from '@/lib/croo/capClient'
import { callCounts, revenueUSDC } from '@/lib/croo/capMetrics' 


export const dynamic = 'force-dynamic'

const CORS = { 'Access-Control-Allow-Origin': '*' }


export async function GET() {
  const totalCalls   = Object.values(callCounts).reduce((a, b) => a + b, 0)
  const totalRevenue = Object.values(revenueUSDC).reduce((a, b) => a + b, 0)

  return NextResponse.json({
    agentId:   'binalyst-trading-agent',
    status:    'online',
    version:   '2.0.0',
    uptime:    process.uptime(),
    timestamp: Date.now(),
    capVersion: '1.0',
    services: BINALYST_SERVICES.map(s => ({
      id:        s.id,
      name:      s.name,
      priceUSDC: s.priceUSDC,
      track:     s.track,
      calls:     callCounts[s.id] ?? 0,
      revenue:   revenueUSDC[s.id] ?? 0,
      status:    'available',
    })),
    aggregate: {
      totalCalls,
      totalRevenueUSDC: totalRevenue.toFixed(4),
      chains: ['bsc', 'celo', 'mantle', 'sui'],
    },
  }, { headers: CORS })
}
