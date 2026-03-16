/**
 * lib/skills/index.ts
 * Unified Binance Skills Hub client.
 * Wraps all 7 skills with typed requests/responses.
 * Web3 skills are public (no auth). CEX skills require API key.
 */

import axios from 'axios'
import crypto from 'crypto'

const WEB3_BASE  = 'https://web3.binance.com'
const ALPHA_BASE = 'https://www.binance.com'
const SQUARE_BASE = 'https://www.binance.com'

const web3Headers = {
  'Content-Type': 'application/json',
  'Accept-Encoding': 'identity',
  'clienttype': 'web',
  'clientversion': '1.2.0',
  'source': 'agent',
  'User-Agent': 'binance-web3/1.4 (Skill)',
}

// ── Chain IDs ──────────────────────────────────────────────────────────────────
export const CHAIN_IDS: Record<string, string> = {
  BSC:      '56',
  ETH:      '1',
  BASE:     '8453',
  SOLANA:   'CT_501',
  POLYGON:  '137',
  ARB:      '42161',
  OP:       '10',
}

// ── 1. Query Token Info ────────────────────────────────────────────────────────
export async function queryTokenInfo(keyword: string, chainIds = '56,1,8453,CT_501') {
  const url = `${WEB3_BASE}/bapi/defi/v5/public/wallet-direct/buw/wallet/market/token/search`
  const { data } = await axios.get(url, {
    params: { keyword, chainIds, orderBy: 'volume24h' },
    headers: web3Headers,
    timeout: 10000,
  })
  return data
}

export async function queryTokenMeta(contractAddress: string, chainId = '56') {
  const url = `${WEB3_BASE}/bapi/defi/v1/public/wallet-direct/buw/wallet/dex/market/token/meta/info`
  const { data } = await axios.get(url, {
    params: { chainId, contractAddress },
    headers: web3Headers,
    timeout: 10000,
  })
  return data
}

export async function queryTokenKlines(contractAddress: string, chainId = '56', interval = '1H') {
  const url = `${WEB3_BASE}/bapi/defi/v1/public/wallet-direct/buw/wallet/dex/market/token/kline`
  const { data } = await axios.get(url, {
    params: { chainId, contractAddress, interval, limit: 50 },
    headers: web3Headers,
    timeout: 10000,
  })
  return data
}

// ── 2. Query Token Audit ───────────────────────────────────────────────────────
export async function queryTokenAudit(contractAddress: string, binanceChainId = '56') {
  const url = `${WEB3_BASE}/bapi/defi/v1/public/wallet-direct/security/token/audit`
  const { data } = await axios.post(url, {
    binanceChainId,
    contractAddress,
    requestId: crypto.randomUUID(),
  }, {
    headers: web3Headers,
    timeout: 15000,
  })
  return data
}

// ── 3. Query Address Info ──────────────────────────────────────────────────────
export async function queryAddressInfo(address: string, chainId = '56', offset = 0) {
  const url = `${WEB3_BASE}/bapi/defi/v3/public/wallet-direct/buw/wallet/address/pnl/active-position-list`
  const { data } = await axios.get(url, {
    params: { address, chainId, offset },
    headers: web3Headers,
    timeout: 10000,
  })
  return data
}

export async function queryAddressTokens(address: string, chainId = '56') {
  const url = `${WEB3_BASE}/bapi/defi/v2/public/wallet-direct/buw/wallet/address/asset/token-list`
  const { data } = await axios.get(url, {
    params: { address, chainId },
    headers: web3Headers,
    timeout: 10000,
  })
  return data
}

// ── 4. Crypto Market Rank ──────────────────────────────────────────────────────
export async function queryMarketRank(type: 'trending' | 'top-searched' | 'alpha' | 'smart-money' | 'meme' | 'social' = 'trending') {
  const endpoints: Record<string, string> = {
    'trending':     `${WEB3_BASE}/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/trending`,
    'top-searched': `${WEB3_BASE}/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/search/rank`,
    'alpha':        `${ALPHA_BASE}/bapi/composite/v1/public/marketing/activity/cms/alpha-token-list`,
    'smart-money':  `${WEB3_BASE}/bapi/defi/v1/public/wallet-direct/buw/wallet/market/smart-money/token-inflow`,
    'meme':         `${WEB3_BASE}/bapi/defi/v1/public/wallet-direct/buw/wallet/market/meme/rank`,
    'social':       `${WEB3_BASE}/bapi/defi/v1/public/wallet-direct/buw/wallet/market/social/hype/rank`,
  }
  const url = endpoints[type] ?? endpoints['trending']
  const { data } = await axios.get(url, { headers: web3Headers, timeout: 10000 })
  return data
}

// ── 5. Meme Rush ──────────────────────────────────────────────────────────────
export async function queryMemeRush(stage: 'new' | 'finalizing' | 'migrated' = 'new', chainId = '56') {
  const url = `${WEB3_BASE}/bapi/defi/v1/public/wallet-direct/buw/wallet/market/meme/rush/list`
  const { data } = await axios.get(url, {
    params: { stage, chainId, limit: 20 },
    headers: web3Headers,
    timeout: 10000,
  })
  return data
}

// ── 6. Binance Alpha ──────────────────────────────────────────────────────────
export async function queryAlphaTokens() {
  const url = `${ALPHA_BASE}/bapi/composite/v1/public/marketing/activity/cms/alpha-token-list`
  const { data } = await axios.get(url, {
    headers: { ...web3Headers, 'clienttype': 'web' },
    timeout: 10000,
  })
  return data
}

export async function queryAlphaAirdrops(apiKey: string, apiSecret: string) {
  // Alpha airdrop eligibility requires authentication
  const timestamp = Date.now()
  const qs        = `timestamp=${timestamp}`
  const signature = crypto.createHmac('sha256', apiSecret).update(qs).digest('hex')

  const { data } = await axios.get(
    `${ALPHA_BASE}/bapi/asset/v1/private/asset-service/asset/get-user-asset`,
    {
      params: { timestamp, signature },
      headers: { 'X-MBX-APIKEY': apiKey, ...web3Headers },
      timeout: 10000,
    }
  )
  return data
}

// ── 7. Binance Square Post ────────────────────────────────────────────────────
export async function postToSquare(content: string, apiKey: string, apiSecret: string) {
  const timestamp = Date.now()
  const body      = JSON.stringify({ content, timestamp })
  const signature = crypto.createHmac('sha256', apiSecret).update(`content=${encodeURIComponent(content)}&timestamp=${timestamp}`).digest('hex')

  const { data } = await axios.post(
    `${SQUARE_BASE}/bapi/social/v1/private/square/post/create`,
    { content, signature, timestamp },
    {
      headers: { 'X-MBX-APIKEY': apiKey, 'Content-Type': 'application/json' },
      timeout: 10000,
    }
  )
  return data
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export function chainNameToId(chain: string): string {
  const map: Record<string, string> = {
    bsc: '56', bnb: '56', eth: '1', ethereum: '1',
    base: '8453', sol: 'CT_501', solana: 'CT_501',
    polygon: '137', matic: '137', arb: '42161', arbitrum: '42161',
    op: '10', optimism: '10',
  }
  return map[chain.toLowerCase()] ?? '56'
}

export function riskLevel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'High Risk',   color: '#F6465D' }
  if (score >= 50) return { label: 'Medium Risk',  color: '#F0B90B' }
  if (score >= 20) return { label: 'Low Risk',     color: '#0ECB81' }
  return              { label: 'Very Low Risk', color: '#0ECB81' }
}
