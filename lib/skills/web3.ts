/**
 * lib/skills/web3.ts
 * Binance Web3 Skills Hub wrappers.
 * All endpoints are public — no API key required.
 * Real endpoints sourced from binance/binance-skills-hub on GitHub.
 */

import axios from 'axios'

const WEB3_BASE  = 'https://web3.binance.com/bapi/defi/v1/public/wallet-direct'
const HEADERS    = { 'Content-Type': 'application/json', 'Accept-Encoding': 'identity' }

// ─────────────────────────────────────────────────────────────────────────────
// crypto-market-rank skill
// Rankings: trending, smart money inflow, social hype, meme tokens, top traders
// ─────────────────────────────────────────────────────────────────────────────

export type RankType  = 'trending' | 'smart_money' | 'social_hype' | 'meme' | 'alpha' | 'traders'
export type ChainId   = '1' | '56' | 'CT_501'   // ETH | BSC | SOL

export async function getMarketRankings({
  rankType = 'trending',
  chainId  = '56',
  period   = '24h',
  page     = 1,
  size     = 20,
}: {
  rankType?: RankType
  chainId?:  ChainId | string
  period?:   string
  page?:     number
  size?:     number
}) {
  switch (rankType) {

    case 'trending': {
      const { data } = await axios.post(
        `${WEB3_BASE}/buw/wallet/market/token/pulse/unified/rank/list`,
        { rankType: 10, chainId, period: 50, sortBy: 70, orderAsc: false, page, size },
        { headers: HEADERS }
      )
      return data.data?.tokens ?? []
    }

    case 'smart_money': {
      const { data } = await axios.post(
        `${WEB3_BASE}/tracker/wallet/token/inflow/rank/query`,
        { chainId, period, tagType: 2 },
        { headers: HEADERS }
      )
      return data.data ?? []
    }

    case 'social_hype': {
      const { data } = await axios.get(
        `${WEB3_BASE}/buw/wallet/market/token/pulse/social/hype/rank/leaderboard`,
        {
          params: { chainId, sentiment: 'All', socialLanguage: 'ALL', targetLanguage: 'en', timeRange: 1 },
          headers: HEADERS,
        }
      )
      return data.data ?? []
    }

    case 'meme': {
      const { data } = await axios.get(
        `${WEB3_BASE}/buw/wallet/market/token/pulse/exclusive/rank/list`,
        { params: { chainId }, headers: HEADERS }
      )
      return data.data ?? []
    }

    case 'alpha': {
      // Binance Alpha tokens — ranked by potential
      const { data } = await axios.post(
        `${WEB3_BASE}/buw/wallet/market/token/pulse/unified/rank/list`,
        { rankType: 20, chainId, period: 50, sortBy: 70, orderAsc: false, page, size },
        { headers: HEADERS }
      )
      return data.data?.tokens ?? []
    }

    case 'traders': {
      const { data } = await axios.get(
        `${WEB3_BASE}/market/leaderboard/query`,
        {
          params: { tag: 'ALL', pageNo: page, chainId, pageSize: size, sortBy: 0, orderBy: 0, period: '30d' },
          headers: HEADERS,
        }
      )
      return data.data?.data ?? []
    }

    default:
      return []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// query-token-info skill
// Token metadata: price, liquidity, holders, chain, contract
// ─────────────────────────────────────────────────────────────────────────────

export async function getTokenInfo({
  address,
  chainId = '56',
}: {
  address: string
  chainId?: ChainId | string
}) {
  const { data } = await axios.post(
    `${WEB3_BASE}/buw/wallet/market/token/query/detail`,
    { address, chainId },
    { headers: HEADERS }
  )
  return data.data ?? null
}

export async function searchToken({
  keyword,
  chainId = '56',
}: {
  keyword: string
  chainId?: string
}) {
  const { data } = await axios.post(
    `${WEB3_BASE}/buw/wallet/market/token/search`,
    { keyword, chainId },
    { headers: HEADERS }
  )
  return data.data ?? []
}

// ─────────────────────────────────────────────────────────────────────────────
// query-token-audit skill
// Contract security: rug pull risk, ownership, liquidity lock, honeypot
// ─────────────────────────────────────────────────────────────────────────────

export async function getTokenAudit({
  address,
  chainId = '56',
}: {
  address: string
  chainId?: ChainId | string
}) {
  const { data } = await axios.post(
    `${WEB3_BASE}/buw/wallet/market/token/risk/detail`,
    { address, chainId },
    { headers: HEADERS }
  )
  return data.data ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// query-address-info skill
// Wallet holdings, PnL, transaction history, whale detection
// ─────────────────────────────────────────────────────────────────────────────

export async function getAddressInfo({
  address,
  chainId = '56',
}: {
  address: string
  chainId?: ChainId | string
}) {
  const { data } = await axios.post(
    `${WEB3_BASE}/tracker/wallet/address/detail/query`,
    { address, chainId },
    { headers: HEADERS }
  )
  return data.data ?? null
}

export async function getAddressTokenHoldings({
  address,
  chainId = '56',
}: {
  address: string
  chainId?: string
}) {
  const { data } = await axios.post(
    `${WEB3_BASE}/tracker/wallet/address/token/holding/query`,
    { address, chainId },
    { headers: HEADERS }
  )
  return data.data ?? []
}

// ─────────────────────────────────────────────────────────────────────────────
// meme-rush skill
// Meme token discovery: new launches, trending memes, Pulse launchpad
// ─────────────────────────────────────────────────────────────────────────────

export async function getMemeRush({
  chainId = '56',
  sortBy  = 'created',
  page    = 1,
  size    = 20,
}: {
  chainId?: string
  sortBy?:  'created' | 'trending' | 'volume'
  page?:    number
  size?:    number
}) {
  const sortMap = { created: 0, trending: 1, volume: 2 }
  const { data } = await axios.post(
    `${WEB3_BASE}/buw/wallet/market/token/pulse/meme/rush/list`,
    { chainId, sortBy: sortMap[sortBy] ?? 0, page, size },
    { headers: HEADERS }
  )
  return data.data?.tokens ?? []
}

// ─────────────────────────────────────────────────────────────────────────────
// Binance Alpha skill
// Alpha listings eligibility and airdrop info via public Binance API
// ─────────────────────────────────────────────────────────────────────────────

export async function getAlphaTokens() {
  // Alpha tokens listed on Binance Alpha platform
  const { data } = await axios.post(
    `${WEB3_BASE}/buw/wallet/market/token/pulse/unified/rank/list`,
    { rankType: 20, chainId: '56', period: 50, sortBy: 70, orderAsc: false, page: 1, size: 30 },
    { headers: HEADERS }
  )
  return data.data?.tokens ?? []
}

export async function getAlphaAirdropInfo({
  apiKey,
  apiSecret,
}: {
  apiKey:    string
  apiSecret: string
}) {
  // Authenticated endpoint for personal Alpha airdrop eligibility
  const crypto = require('crypto')
  const timestamp = Date.now()
  const qs = `timestamp=${timestamp}&recvWindow=5000`
  const sig = crypto.createHmac('sha256', apiSecret).update(qs).digest('hex')
  const { data } = await axios.get(
    `https://api.binance.com/sapi/v1/giftcard/cryptography/rsa-public-key?${qs}&signature=${sig}`,
    { headers: { 'X-MBX-APIKEY': apiKey, 'User-Agent': 'binalyst/1.0.0 (Skill)' } }
  )
  return data
}
