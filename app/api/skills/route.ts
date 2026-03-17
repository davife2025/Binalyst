import { NextRequest, NextResponse } from 'next/server'
import {
  getMarketRankings, getTokenInfo, searchToken,
  getTokenAudit, getAddressInfo, getAddressTokenHoldings,
  getMemeRush, getAlphaTokens,
} from '@/lib/skills/web3'

export const dynamic = 'force-dynamic'

const CM: Record<string, string> = {
  bsc: '56', eth: '1', base: '8453', solana: 'CT_501', polygon: '137',
  '56': '56', '1': '1', CT_501: 'CT_501',
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const skill = searchParams.get('skill') ?? ''
  const chain = CM[searchParams.get('chain') ?? 'bsc'] ?? '56'

  try {
    switch (skill) {
      case 'token-search': {
        const kw = searchParams.get('keyword') ?? ''
        const data = kw.startsWith('0x') || kw.length > 30
          ? await getTokenInfo({ address: kw, chainId: chain })
          : await searchToken({ keyword: kw, chainId: chain })
        return NextResponse.json({ success: true, data })
      }
      case 'token-audit': {
        const contract = searchParams.get('contract') ?? ''
        if (!contract) return NextResponse.json({ error: 'contract required' }, { status: 400 })
        const data = await getTokenAudit({ address: contract, chainId: chain })
        return NextResponse.json({ success: true, data })
      }
      case 'address-tokens': {
        const address = searchParams.get('address') ?? ''
        if (!address) return NextResponse.json({ error: 'address required' }, { status: 400 })
        const [info, holdings] = await Promise.allSettled([
          getAddressInfo({ address, chainId: chain }),
          getAddressTokenHoldings({ address, chainId: chain }),
        ])
        return NextResponse.json({
          success: true,
          data: {
            info:   info.status === 'fulfilled' ? info.value : null,
            list:   holdings.status === 'fulfilled' ? holdings.value : [],
            tokens: holdings.status === 'fulfilled' ? holdings.value : [],
          },
        })
      }
      case 'market-rank': {
        const type = searchParams.get('type') ?? 'trending'
        const rm: Record<string, any> = {
          trending: 'trending', 'top-searched': 'trending',
          alpha: 'alpha', 'smart-money': 'smart_money',
          meme: 'meme', social: 'social_hype',
        }
        const data = await getMarketRankings({ rankType: rm[type] ?? 'trending', chainId: chain, size: 20 })
        return NextResponse.json({ success: true, data: { list: Array.isArray(data) ? data : [] } })
      }
      case 'meme-rush': {
        const stage = searchParams.get('stage') ?? 'new'
        const sm: Record<string, any> = { new: 'created', finalizing: 'trending', migrated: 'volume' }
        const data = await getMemeRush({ chainId: chain, sortBy: sm[stage] ?? 'created', size: 20 })
        return NextResponse.json({ success: true, data: { list: Array.isArray(data) ? data : [] } })
      }
      case 'alpha-tokens': {
        const data = await getAlphaTokens()
        return NextResponse.json({ success: true, data: Array.isArray(data) ? data : [] })
      }
      default:
        return NextResponse.json({ error: `Unknown skill: ${skill}` }, { status: 400 })
    }
  } catch (err: any) {
    console.error(`[skills] ${skill}:`, err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
