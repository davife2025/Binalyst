'use client'

/**
 * hooks/useSuiAgentLoop.ts — Session N (new file)
 *
 * Client-side hook for the Sui Autonomous Agent Wallet.
 * Parallel to hooks/useCeloAgentLoop.ts and hooks/useMantleAgentLoop.ts
 * but fully independent — own store (store.sui), own loop (SuiAgentLoop),
 * own interval/state. Nothing here imports from any other agent hook.
 *
 * Manages:
 *   - Start / stop / pause / resume the Sui agent loop
 *   - Countdown timer to next cycle
 *   - Decision + cycle result surfacing to the UI
 *   - Policy enforcement pre-check before each cycle
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSuiStore }                               from '@/lib/store.sui'
import { SuiAgentLoop, adaptSignalSnapshot }         from '@/lib/suiAgent/agentLoop'
import type { SuiAgentCallbacks }                    from '@/lib/suiAgent/agentLoop'
import type { SuiCycleResult, SuiAgentStatus }       from '@/lib/sui/types'

const LOOP_INTERVAL_MS = 120_000   // 2 minutes — matches Binalyst agent cadence

export function useSuiAgentLoop() {
  const {
    walletAddress, network, policy,
    agentConfig, agentStatus,
    setAgentStatus, setAgentConfig,
    onCycleComplete, addDecision,
    cycleCount, tradesExecuted, lastCycleAt, agentErrors,
  } = useSuiStore()

  const [isRunning,  setIsRunning]  = useState(false)
  const [lastCycle,  setLastCycle]  = useState<SuiCycleResult | null>(null)
  const [nextRunIn,  setNextRunIn]  = useState(0)
  const [cycleError, setCycleError] = useState('')

  const loopRef      = useRef<SuiAgentLoop | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastRunRef   = useRef(0)

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => () => {
    loopRef.current?.stop()
    if (countdownRef.current) clearInterval(countdownRef.current)
  }, [])

  // ── Build callbacks ───────────────────────────────────────────────────────
  const buildCallbacks = useCallback((): SuiAgentCallbacks => ({

    getSignals: async () => {
      try {
        const res  = await fetch('/api/cmc?action=signals_batch')
        const data = await res.json() as { data?: unknown[] }
        return (data.data ?? []).map(
          (s: unknown) => adaptSignalSnapshot(s as Parameters<typeof adaptSignalSnapshot>[0])
        )
      } catch {
        return []
      }
    },

    getConfig:        () => agentConfig,
    getWalletAddress: () => walletAddress,

    executeTrade: async (params) => {
      // Pre-flight policy check
      if (policy?.revoked) {
        return { success: false, error: 'Policy revoked — agent blocked' }
      }

      try {
        // Fetch pool for this symbol
        const poolRes  = await fetch(`/api/deepbook/pools?network=${agentConfig.network}`)
        const poolData = await poolRes.json() as {
          pools?: Array<{ poolId: string; pair: string; bestAsk?: number; bestBid?: number; tickSize?: number }>
        }
        const pool = poolData.pools?.find(p => p.pair.startsWith(params.symbol))
                  ?? poolData.pools?.[0]
        if (!pool) return { success: false, error: `No DeepBook pool for ${params.symbol}` }

        const mid = ((pool.bestAsk ?? 1) + (pool.bestBid ?? 1)) / 2 || 1
        const qty = Math.max(params.amountUSD / mid, pool.tickSize ?? 0.1)

        const res  = await fetch('/api/deepbook/order', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            poolId:        pool.poolId,
            side:          params.action === 'BUY' ? 'bid' : 'ask',
            type:          'market',
            price:         mid,
            quantity:      qty,
            walletAddress: walletAddress ?? '0x' + '0'.repeat(64),
            network:       agentConfig.network,
            dryRun:        params.dryRun,
            agentReasoning: `Signal-driven ${params.action}`,
          }),
        })
        const data = await res.json() as {
          success?: boolean
          order?:   { clientOrderId: string }
          error?:   string
        }
        return data.success
          ? { success: true, txDigest: data.order?.clientOrderId }
          : { success: false, error: data.error ?? 'Order failed' }

      } catch (e: unknown) {
        return { success: false, error: e instanceof Error ? e.message : 'Execute failed' }
      }
    },

    onDecision: (d) => {
      addDecision(d)
    },

    onCycleComplete: (r: SuiCycleResult) => {
      lastRunRef.current = Date.now()
      setLastCycle(r)
      setNextRunIn(LOOP_INTERVAL_MS / 1000)
      onCycleComplete(r)
      if (r.errors.length) setCycleError(r.errors[r.errors.length - 1])
    },

    onStatusChange: (s: SuiAgentStatus) => {
      setAgentStatus(s)
      if (s === 'running') setIsRunning(true)
      if (s === 'stopped' || s === 'paused') setIsRunning(false)
    },
  }), [agentConfig, walletAddress, policy, addDecision, onCycleComplete, setAgentStatus])

  // ── Start ─────────────────────────────────────────────────────────────────
  const startLoop = useCallback(() => {
    if (loopRef.current) return
    if (!walletAddress && !agentConfig.dryRun) return
    setCycleError('')

    loopRef.current = new SuiAgentLoop(buildCallbacks())
    loopRef.current.start()
    setIsRunning(true)

    // Countdown ticker
    if (countdownRef.current) clearInterval(countdownRef.current)
    lastRunRef.current = Date.now()
    countdownRef.current = setInterval(() => {
      const elapsed = (Date.now() - lastRunRef.current) / 1000
      setNextRunIn(Math.max(0, Math.floor(LOOP_INTERVAL_MS / 1000 - elapsed)))
    }, 1000)
  }, [walletAddress, agentConfig.dryRun, buildCallbacks])

  // ── Stop ──────────────────────────────────────────────────────────────────
  const stopLoop = useCallback(() => {
    loopRef.current?.stop()
    loopRef.current = null
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
    setIsRunning(false)
    setNextRunIn(0)
  }, [])

  // ── Pause / resume ────────────────────────────────────────────────────────
  const pauseLoop  = useCallback(() => { loopRef.current?.pause()  }, [])
  const resumeLoop = useCallback(() => { loopRef.current?.resume() }, [])

  const isActive = loopRef.current !== null

  return {
    // Status
    agentStatus,
    isRunning,
    isActive,
    lastCycle,
    nextRunIn,
    cycleError,

    // Stats
    cycleCount,
    tradesExecuted,
    lastCycleAt,
    agentErrors,

    // Controls
    startLoop,
    stopLoop,
    pauseLoop,
    resumeLoop,

    // Config
    agentConfig,
    setAgentConfig,
  }
}
