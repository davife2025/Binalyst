/**
 * lib/croo/capCaller.ts
 * Session 5 — A2A Outbound Caller
 *
 * Allows Binalyst to act as a BUYER in the CAP ecosystem — discovering other
 * agents on the CROO Agent Store, paying them in USDC, and consuming their
 * services as dependencies in its own strategy pipeline.
 *
 * Use cases:
 *  - Enrich market signals with a sentiment agent
 *  - Cross-check signals with an on-chain analytics agent
 *  - Pipe backtest results into a risk-scoring agent
 *  - Compose a multi-agent trading workflow
 *
 * This file is NEW — zero modifications to existing files.
 * Used by: app/api/cap/call/route.ts     (S5 new)
 *          app/api/cap/discover/route.ts  (S5 new)
 *          components/tabs/CrooTab.tsx    (S5 patch — adds A2A Outbound section)
 */

import { CAP_BASE_URL, AGENT_STORE_URL, type CAPRequest, type CAPResponse } from './capClient'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExternalAgent {
  agentId:      string
  name:         string
  description:  string
  endpoint:     string
  wallet:       string
  chains:       string[]
  services:     ExternalService[]
  storeUrl:     string
  verified:     boolean
  tags:         string[]
}

export interface ExternalService {
  id:          string
  name:        string
  description: string
  priceUSDC:   number
  track:       string
}

export interface A2ACallRecord {
  id:           string
  timestamp:    number
  targetAgentId: string
  targetName:   string
  serviceId:    string
  serviceName:  string
  priceUSDC:    number
  paymentTxHash?: string
  status:       'pending' | 'paid' | 'completed' | 'failed'
  result?:      Record<string, unknown>
  error?:       string
  processingMs?: number
}

export interface OutboundCallOpts {
  targetEndpoint: string
  serviceId:      string
  params:         Record<string, unknown>
  paymentTxHash:  string   // caller must send USDC first, then pass tx hash
  paymentChain?:  string
  callerAgentId?: string
}

// ── Agent Discovery ───────────────────────────────────────────────────────────

/**
 * Discover agents on the CROO Agent Store by track or keyword.
 * Falls back to a curated demo list if the API is unreachable.
 */
export async function discoverAgents(opts: {
  track?:   string
  keyword?: string
  limit?:   number
}): Promise<ExternalAgent[]> {
  const { track, keyword, limit = 10 } = opts

  try {
    const params = new URLSearchParams()
    if (track)   params.set('track',   track)
    if (keyword) params.set('q',       keyword)
    params.set('limit', String(limit))

    const res = await fetch(`${CAP_BASE_URL}/v1/agents?${params}`, {
      headers: { 'X-CAP-Version': '1.0' },
      signal:  AbortSignal.timeout(8_000),
    })

    if (res.ok) {
      const data = await res.json()
      return (data.agents ?? []) as ExternalAgent[]
    }
  } catch {
    // API unreachable — fall through to demo data
  }

  // ── Demo agents (shown during hackathon when API is not yet live) ──────────
  return DEMO_AGENTS.filter(a => {
    if (track   && !a.tags.includes(track))   return false
    if (keyword && !a.name.toLowerCase().includes(keyword.toLowerCase()) &&
                   !a.description.toLowerCase().includes(keyword.toLowerCase())) return false
    return true
  }).slice(0, limit)
}

/**
 * Fetch a single agent's manifest from its discovery URL.
 * This is how Binalyst inspects what another agent offers before calling it.
 */
export async function fetchAgentManifest(discoveryUrl: string): Promise<ExternalAgent | null> {
  try {
    const res  = await fetch(discoveryUrl, {
      headers: { 'X-CAP-Version': '1.0' },
      signal:  AbortSignal.timeout(8_000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return {
      agentId:     data.agentId,
      name:        data.name,
      description: data.description,
      endpoint:    data.endpoint,
      wallet:      data.wallet,
      chains:      data.chains ?? [],
      services:    data.services ?? [],
      storeUrl:    data.store ?? `${AGENT_STORE_URL}/agents/${data.agentId}`,
      verified:    data.verified ?? false,
      tags:        data.tags ?? [],
    }
  } catch {
    return null
  }
}

// ── Outbound A2A Call ─────────────────────────────────────────────────────────

/**
 * Send a CAP request to another agent's invoke endpoint.
 * Caller is responsible for:
 *  1. Sending USDC to the target agent's wallet on-chain
 *  2. Passing the resulting txHash here
 */
export async function callExternalAgent(opts: OutboundCallOpts): Promise<CAPResponse> {
  const {
    targetEndpoint,
    serviceId,
    params,
    paymentTxHash,
    paymentChain  = 'bsc',
    callerAgentId = 'binalyst-trading-agent',
  } = opts

  const capRequest: CAPRequest = {
    serviceId,
    callerId:      callerAgentId,
    paymentTxHash,
    paymentChain,
    params,
    nonce:         crypto.randomUUID(),
    timestamp:     Date.now(),
  }

  const res = await fetch(targetEndpoint, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CAP-Version': '1.0',
      'X-Caller-Agent': callerAgentId,
    },
    body:   JSON.stringify(capRequest),
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => 'no body')
    throw new Error(`Target agent responded ${res.status}: ${text.slice(0, 200)}`)
  }

  return await res.json() as CAPResponse
}

// ── Dry-run (no payment required) ────────────────────────────────────────────

/**
 * Call an external agent's service in DEMO mode — no real USDC payment.
 * Most CAP agents accept paymentTxHash = 'DEMO' during the hackathon window.
 */
export async function dryRunExternalAgent(opts: {
  targetEndpoint: string
  serviceId:      string
  params:         Record<string, unknown>
}): Promise<CAPResponse> {
  return callExternalAgent({
    ...opts,
    paymentTxHash: 'DEMO',
    paymentChain:  'bsc',
  })
}

// ── Compose multi-agent workflow ──────────────────────────────────────────────

/**
 * Sequential multi-agent pipeline:
 *  Step 1 result → feeds into Step 2 params → feeds into Step 3 …
 *
 * Each step can reference the previous result via `paramMapper`.
 */
export interface PipelineStep {
  agentId:      string
  endpoint:     string
  serviceId:    string
  priceUSDC:    number
  paramMapper:  (prevResult: Record<string, unknown> | null) => Record<string, unknown>
  paymentTxHash?: string   // 'DEMO' for dry-run
}

export interface PipelineResult {
  success:  boolean
  steps:    Array<{
    agentId:   string
    serviceId: string
    success:   boolean
    result?:   Record<string, unknown>
    error?:    string
    ms:        number
  }>
  finalResult?: Record<string, unknown>
  totalMs:      number
}

export async function runA2APipeline(steps: PipelineStep[]): Promise<PipelineResult> {
  const start   = Date.now()
  const results: PipelineResult['steps'] = []
  let prevResult: Record<string, unknown> | null = null

  for (const step of steps) {
    const stepStart = Date.now()
    try {
      const params = step.paramMapper(prevResult)
      const res    = await callExternalAgent({
        targetEndpoint: step.endpoint,
        serviceId:      step.serviceId,
        params,
        paymentTxHash:  step.paymentTxHash ?? 'DEMO',
      })

      const stepResult = res.result ?? {}
      results.push({
        agentId:   step.agentId,
        serviceId: step.serviceId,
        success:   res.success,
        result:    stepResult,
        ms:        Date.now() - stepStart,
      })

      if (!res.success) {
        return { success: false, steps: results, totalMs: Date.now() - start }
      }

      prevResult = stepResult

    } catch (err: any) {
      results.push({
        agentId:   step.agentId,
        serviceId: step.serviceId,
        success:   false,
        error:     err.message,
        ms:        Date.now() - stepStart,
      })
      return { success: false, steps: results, totalMs: Date.now() - start }
    }
  }

  return {
    success:     true,
    steps:       results,
    finalResult: prevResult ?? undefined,
    totalMs:     Date.now() - start,
  }
}

// ── Demo agents ───────────────────────────────────────────────────────────────
// Shown in the UI when the CROO API is not yet live.
// Replace with real discovered agents post-launch.

export const DEMO_AGENTS: ExternalAgent[] = [
  {
    agentId:     'sentiment-oracle',
    name:        'Sentiment Oracle',
    description: 'Real-time crypto sentiment scores from Twitter, Reddit, and Telegram. Returns fear/greed index and token-specific sentiment.',
    endpoint:    'https://sentiment-oracle.vercel.app/api/cap/invoke',
    wallet:      '0xSENTIMENT000000000000000000000000000001',
    chains:      ['bsc', 'base'],
    storeUrl:    `${AGENT_STORE_URL}/agents/sentiment-oracle`,
    verified:    false,
    tags:        ['research_intelligence', 'sentiment', 'ai'],
    services: [
      { id: 'token_sentiment', name: 'Token Sentiment', description: 'Sentiment score for a token', priceUSDC: 0.05, track: 'research_intelligence' },
      { id: 'fear_greed',      name: 'Fear & Greed',    description: 'Global crypto fear/greed index', priceUSDC: 0.02, track: 'research_intelligence' },
    ],
  },
  {
    agentId:     'onchain-analytics',
    name:        'On-Chain Analytics',
    description: 'Whale wallet tracking, large transfer alerts, DEX volume spikes, and smart money flow analysis on BSC.',
    endpoint:    'https://onchain-analytics.vercel.app/api/cap/invoke',
    wallet:      '0xONCHAIN00000000000000000000000000000002',
    chains:      ['bsc'],
    storeUrl:    `${AGENT_STORE_URL}/agents/onchain-analytics`,
    verified:    false,
    tags:        ['data_verification', 'onchain', 'bsc'],
    services: [
      { id: 'whale_alert',    name: 'Whale Alert',     description: 'Recent large transfers for a token', priceUSDC: 0.08, track: 'data_verification' },
      { id: 'smart_money',    name: 'Smart Money Flow', description: 'Net smart money inflow/outflow',     priceUSDC: 0.12, track: 'data_verification' },
    ],
  },
  {
    agentId:     'risk-guardian',
    name:        'Risk Guardian',
    description: 'Portfolio risk scoring, position concentration analysis, VaR estimation, and automated de-risking recommendations.',
    endpoint:    'https://risk-guardian.vercel.app/api/cap/invoke',
    wallet:      '0xRISKGUARD0000000000000000000000000000003',
    chains:      ['bsc', 'polygon'],
    storeUrl:    `${AGENT_STORE_URL}/agents/risk-guardian`,
    verified:    false,
    tags:        ['defi_onchain_ops', 'risk', 'portfolio'],
    services: [
      { id: 'portfolio_var',  name: 'Portfolio VaR',   description: 'Value-at-risk for a set of positions', priceUSDC: 0.20, track: 'defi_onchain_ops' },
      { id: 'risk_score',     name: 'Risk Score',       description: 'Single risk score 0-100 for a wallet', priceUSDC: 0.10, track: 'defi_onchain_ops' },
    ],
  },
  {
    agentId:     'news-scanner',
    name:        'News Scanner',
    description: 'Real-time crypto news aggregation with AI-powered relevance scoring and market impact prediction.',
    endpoint:    'https://news-scanner.vercel.app/api/cap/invoke',
    wallet:      '0xNEWSSCAN00000000000000000000000000000004',
    chains:      ['bsc', 'base', 'polygon'],
    storeUrl:    `${AGENT_STORE_URL}/agents/news-scanner`,
    verified:    false,
    tags:        ['research_intelligence', 'news', 'ai'],
    services: [
      { id: 'token_news',     name: 'Token News',      description: 'Latest news and impact score for a token', priceUSDC: 0.06, track: 'research_intelligence' },
      { id: 'market_brief',   name: 'Market Brief',    description: 'AI-written 5-minute market summary',       priceUSDC: 0.15, track: 'research_intelligence' },
    ],
  },
]
