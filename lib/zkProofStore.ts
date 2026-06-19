// lib/zkProofStore.ts
//
// Zustand store for the ZK proof queue.
// Tracks every proof from 'pending' through 'verified' / 'failed'.
// Consumed by ZKProofTab and the agent loop hook.

import { create } from 'zustand'
import { randomUUID } from 'crypto'
import type {
  ZKProofEntry,
  ZKProofStatus,
  TradeProofOutput,
} from '@/lib/stellar/types'
import type { SignalSnapshot, StrategyRule } from '@/lib/signalEngine'
import type { LoopDecision }                from '@/lib/agentLoop'

// ─────────────────────────────────────────────────────────────────────────────
// Store interface
// ─────────────────────────────────────────────────────────────────────────────

interface ZKProofStore {
  proofs: ZKProofEntry[]

  // ── Mutations ─────────────────────────────────────────────────────────────

  /** Create a new pending proof entry and return its proofId */
  enqueue: (params: {
    symbol:     string
    action:     'BUY' | 'SELL'
    amountUSDT: number
    ruleName:   string
    decidedAt:  number
  }) => string

  /** Update status of an existing proof entry */
  setStatus: (proofId: string, status: ZKProofStatus) => void

  /** Set the prove result (output + receipt bytes) */
  setProveResult: (proofId: string, params: {
    output:     TradeProofOutput
    sealHex:    string
    journalHex: string
    elapsedMs:  number
  }) => void

  /** Set the Stellar verify result */
  setVerifyResult: (proofId: string, params: {
    stellarTxId: string
    proofIndex:  number
    explorerUrl: string
  }) => void

  /** Mark a proof as failed with an error message */
  setError: (proofId: string, error: string) => void

  /** Clear all proofs (UI button) */
  clearProofs: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Store implementation
// ─────────────────────────────────────────────────────────────────────────────

export const useZKProofStore = create<ZKProofStore>((set) => ({
  proofs: [],

  enqueue: ({ symbol, action, amountUSDT, ruleName, decidedAt }) => {
    const proofId = typeof crypto !== 'undefined'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)

    const entry: ZKProofEntry = {
      proofId,
      status:      'pending',
      symbol,
      action,
      amountUSDT,
      ruleName,
      decidedAt,
      output:      null,
      sealHex:     null,
      journalHex:  null,
      stellarTxId: null,
      proofIndex:  null,
      explorerUrl: null,
      elapsedMs:   null,
      error:       null,
    }

    set(s => ({ proofs: [entry, ...s.proofs].slice(0, 200) }))
    return proofId
  },

  setStatus: (proofId, status) =>
    set(s => ({
      proofs: s.proofs.map(p =>
        p.proofId === proofId ? { ...p, status } : p
      ),
    })),

  setProveResult: (proofId, { output, sealHex, journalHex, elapsedMs }) =>
    set(s => ({
      proofs: s.proofs.map(p =>
        p.proofId === proofId
          ? { ...p, status: 'proved', output, sealHex, journalHex, elapsedMs }
          : p
      ),
    })),

  setVerifyResult: (proofId, { stellarTxId, proofIndex, explorerUrl }) =>
    set(s => ({
      proofs: s.proofs.map(p =>
        p.proofId === proofId
          ? { ...p, status: 'verified', stellarTxId, proofIndex, explorerUrl }
          : p
      ),
    })),

  setError: (proofId, error) =>
    set(s => ({
      proofs: s.proofs.map(p =>
        p.proofId === proofId ? { ...p, status: 'failed', error } : p
      ),
    })),

  clearProofs: () => set({ proofs: [] }),
}))

// ─────────────────────────────────────────────────────────────────────────────
// Proof trigger — called by the agent loop after each executed trade
// ─────────────────────────────────────────────────────────────────────────────

/**
 * submitTradeProof
 *
 * Full prove → verify pipeline, non-blocking.
 * Call this after a trade decision has been executed (or in dry-run mode).
 *
 * Parameters match what the agent loop already has in scope,
 * so no extra data fetching is needed.
 */
export async function submitTradeProof(params: {
  signal:       SignalSnapshot
  rule:         StrategyRule
  decision:     LoopDecision
  portfolioUSD: number
  peakUSD:      number
  startUSD:     number
  tradesToday:  number
  totalTrades:  number
  config: {
    maxDrawdownPct:  number
    maxPerTradePct:  number
    maxDailyTrades:  number
    dryRun:          boolean
  }
}): Promise<void> {
  const store = useZKProofStore.getState()

  // 1. Enqueue
  const proofId = store.enqueue({
    symbol:     params.decision.symbol,
    action:     params.decision.action,
    amountUSDT: params.decision.amountUSDT,
    ruleName:   params.decision.ruleName ?? params.rule.id,
    decidedAt:  Date.now(),
  })

  // 2. Prove
  try {
    store.setStatus(proofId, 'proving')

    const proveRes = await fetch('/api/zk/prove', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        signal:       params.signal,
        rule:         params.rule,
        decision:     params.decision,
        portfolioUSD: params.portfolioUSD,
        peakUSD:      params.peakUSD,
        startUSD:     params.startUSD,
        tradesToday:  params.tradesToday,
        totalTrades:  params.totalTrades,
        config:       params.config,
      }),
    })

    const proveData = await proveRes.json()

    if (!proveData.success || !proveData.output?.valid) {
      store.setError(proofId, proveData.error ?? 'Proof invalid')
      return
    }

    store.setProveResult(proofId, {
      output:     proveData.output,
      sealHex:    proveData.sealHex,
      journalHex: proveData.journalHex,
      elapsedMs:  proveData.elapsedMs,
    })

    // 3. Submit to Stellar
    store.setStatus(proofId, 'submitting')

    const verifyRes = await fetch('/api/zk/verify', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        proofId,
        sealHex:    proveData.sealHex,
        journalHex: proveData.journalHex,
      }),
    })

    const verifyData = await verifyRes.json()

    if (!verifyData.success) {
      store.setError(proofId, verifyData.error ?? 'Stellar verification failed')
      return
    }

    store.setVerifyResult(proofId, {
      stellarTxId: verifyData.stellarTxId,
      proofIndex:  verifyData.proofIndex,
      explorerUrl: verifyData.explorerUrl,
    })

  } catch (err: any) {
    store.setError(proofId, err.message ?? 'Unknown error')
  }
}
