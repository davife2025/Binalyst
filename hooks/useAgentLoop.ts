'use client'

/**
 * hooks/useAgentLoop.ts — Session H (REPLACES Session D)
 * Fixes:
 * - Passes `network` from agentStore into every /api/agent/loop call
 * - SSR-safe localStorage access
 * - Correct dependency array to avoid stale closure on network switch
 * - todayTrades computed correctly from trade timestamps
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAgentStore }    from '@/lib/agentStore'
import {
  computeDrawdown,
  computePnLPct,
  tradeCountStatus,
  LOOP_INTERVAL_MS,
  type LoopStatus,
  type LoopCycleResult,
} from '@/lib/agentLoop'
import { submitTradeProof } from '@/lib/zkProofStore'   // ← Session R (Bug #2 fix)

export function useAgentLoop() {
  const {
    privateKey, agentAddress, isWalletLoaded,
    agentConfig, strategyParsed,
    session, initSession, updateSession,
    trades, addTrade,
  } = useAgentStore()

  // Network — cast because it was added in Session F patch
  const network = (useAgentStore() as any).network ?? 'testnet'

  const [loopStatus,  setLoopStatus]  = useState<LoopStatus>('idle')
  const [lastCycle,   setLastCycle]   = useState<LoopCycleResult | null>(null)
  const [nextRunIn,   setNextRunIn]   = useState<number>(0)
  const [isRunning,   setIsRunning]   = useState(false)
  const [cycleError,  setCycleError]  = useState<string>('')

  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastRunRef   = useRef<number>(0)

  // ── Helpers ──────────────────────────────────────────────────────────────
  const getDaysElapsed = useCallback((): number => {
    if (!session?.startedAt) return 0
    return Math.floor((Date.now() - session.startedAt) / 86400000)
  }, [session?.startedAt])

  const getTodayTrades = useCallback((): number => {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    return trades.filter(t => t.timestamp >= todayStart.getTime()).length
  }, [trades])

  // ── Core cycle ────────────────────────────────────────────────────────────
  const runCycle = useCallback(async () => {
    if (!privateKey || !isWalletLoaded) return
    if (loopStatus === 'disqualified')  return
    if (isRunning)                       return

    setIsRunning(true)
    setCycleError('')
    lastRunRef.current = Date.now()

    try {
      const symbols = agentConfig.allowedTokens.length
        ? agentConfig.allowedTokens
        : ['ETH', 'ADA', 'AVAX', 'LINK', 'CAKE', 'DOGE', 'DOT', 'BNB']

      const res = await fetch('/api/agent/loop', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privateKey,
          network,                                // ← Session F: pass network
          rules:       strategyParsed,
          symbols,
          startUSD:    session?.startValueUSDT  ?? 0,
          peakUSD:     session?.peakValueUSDT   ?? 0,
          tradesToday: getTodayTrades(),
          totalTrades: session?.totalTrades     ?? 0,
          daysElapsed: getDaysElapsed(),
          config:      agentConfig,
          dryRun:      agentConfig.dryRun,
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? 'Cycle failed')

      const portfolioUSD = data.portfolioUSD ?? 0
      const drawdownPct  = data.drawdownPct  ?? 0
      const newStatus    = data.status as LoopStatus

      updateSession({
        currentValueUSDT: portfolioUSD,
        peakValueUSDT:    Math.max(session?.peakValueUSDT ?? 0, portfolioUSD),
        drawdownPct,
        totalTrades:      (session?.totalTrades ?? 0) + (data.executed ?? 0),
        todayTrades:      getTodayTrades() + (data.executed ?? 0),
        lastRunAt:        Date.now(),
        status:           newStatus,
      })

      // Log trades + trigger ZK proofs for executed decisions
      for (const decision of data.decisions ?? []) {
        if (decision.guardrail === 'blocked') continue
        addTrade({
          id:          crypto.randomUUID(),
          timestamp:   decision.timestamp ?? Date.now(),
          symbol:      decision.symbol,
          side:        decision.action,
          amountUSDT:  decision.amountUSDT,
          price:       data.snapshots?.find((s: any) => s.symbol === decision.symbol)?.price ?? 0,
          txHash:      decision.txHash ?? '',
          dryRun:      agentConfig.dryRun,
          status:      decision.txHash ? 'confirmed' : agentConfig.dryRun ? 'confirmed' : 'pending',
          signalScore: decision.signalScore ?? 50,
          reasoning:   decision.reasoning  ?? '',
        })

        // ── Bug #2 fix: ZK proof triggered here (client side) ───────────────
        // Only prove decisions that actually executed (not just evaluated).
        // decision.executed is set by the API route when a swap succeeded
        // (or dryRun simulated success). Blocked decisions have no proof.
        if (decision.executed) {
          // Reconstruct a minimal ProofSignal from what the API returned.
          // Full technicals aren't returned by the API route — we use what we have.
          // The ZK guest proves guardrails + condition fired; signal fields that
          // aren't returned (technicals) are null, which the guest handles safely.
          const proofSignal = {
            symbol:       decision.symbol,
            price:        data.snapshots?.find((s: any) => s.symbol === decision.symbol)?.price ?? 0,
            change_24h:   data.snapshots?.find((s: any) => s.symbol === decision.symbol)?.change24h ?? 0,
            fear_greed:   data.fearGreed ?? 50,
            signal_score: decision.signalScore ?? 50,
            rsi14:        null,
            macd_hist:    null,
            macd_cross:   null,
            bb_pct:       null,
            bb_width:     null,
            adx:          null,
            stoch_k:      null,
            obv_trend:    null,
            ema_cross:    null,
            tech_score:   null,
            regime:       null,
            tags:         [],
          }

          // Find the rule that fired this decision
          const firedRule = strategyParsed.find(r => r.id === decision.ruleId)

          if (firedRule) {
            submitTradeProof({
              signal:       proofSignal as any,
              rule:         firedRule,
              decision: {
                symbol:       decision.symbol,
                action:       decision.action,
                amountUSDT:   decision.amountUSDT,
                signalScore:  decision.signalScore ?? 50,
                reasoning:    decision.reasoning ?? '',
                ruleName:     decision.ruleName ?? firedRule.id,
                ruleId:       decision.ruleId,
                guardrail:    decision.guardrail,
              },
              portfolioUSD: portfolioUSD,
              peakUSD:      Math.max(session?.peakValueUSDT ?? 0, portfolioUSD),
              startUSD:     session?.startValueUSDT ?? 0,
              tradesToday:  getTodayTrades(),
              totalTrades:  (session?.totalTrades ?? 0) + (data.executed ?? 0),
              config: {
                maxDrawdownPct:  agentConfig.maxDrawdownPct  ?? 30,
                maxPerTradePct:  agentConfig.maxPerTradePct  ?? 15,
                maxDailyTrades:  agentConfig.maxDailyTrades  ?? 8,
                dryRun:          agentConfig.dryRun          ?? true,
              },
            }).catch(err =>
              console.warn('[ZK] submitTradeProof failed (non-fatal):', err.message)
            )
          }
        }
        // ────────────────────────────────────────────────────────────────────
      }

      const cycleResult: LoopCycleResult = {
        cycleAt:      Date.now(),
        decisions:    data.decisions ?? [],
        executed:     data.executed  ?? 0,
        blocked:      data.blocked   ?? 0,
        errors:       data.errors    ?? [],
        portfolioUSD,
        drawdownPct,
        todayTrades:  getTodayTrades(),
        status:       newStatus,
      }

      setLastCycle(cycleResult)
      setLoopStatus(newStatus)
      setNextRunIn(LOOP_INTERVAL_MS / 1000)

    } catch (e: any) {
      setCycleError(e.message)
      setLoopStatus('error')
    }

    setIsRunning(false)
  }, [
    privateKey, isWalletLoaded, network, agentConfig,
    strategyParsed, session, loopStatus, isRunning,
    getDaysElapsed, getTodayTrades,
  ])

  // ── Start / Stop ──────────────────────────────────────────────────────────
  const startLoop = useCallback(async (startingUSDT?: number) => {
    if (!privateKey || !isWalletLoaded) return
    if (!session) initSession(startingUSDT ?? 100)
    setLoopStatus('running')
    await runCycle()
    if (timerRef.current)     clearInterval(timerRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
    timerRef.current = setInterval(runCycle, LOOP_INTERVAL_MS)
    countdownRef.current = setInterval(() => {
      const elapsed = (Date.now() - lastRunRef.current) / 1000
      setNextRunIn(Math.max(0, Math.floor(LOOP_INTERVAL_MS / 1000 - elapsed)))
    }, 1000)
  }, [privateKey, isWalletLoaded, session, initSession, runCycle])

  const stopLoop = useCallback(() => {
    if (timerRef.current)     { clearInterval(timerRef.current);    timerRef.current = null }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
    setLoopStatus('idle')
    setNextRunIn(0)
  }, [])

  const pauseLoop  = useCallback(() => setLoopStatus('paused'),  [])
  const resumeLoop = useCallback(() => setLoopStatus('running'), [])

  useEffect(() => () => {
    if (timerRef.current)     clearInterval(timerRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
  }, [])

  // Derived
  const pnlPct      = session ? computePnLPct(session.startValueUSDT, session.currentValueUSDT) : 0
  const tradeStatus = tradeCountStatus(getTodayTrades(), session?.totalTrades ?? 0, getDaysElapsed())
  const isActive    = timerRef.current !== null

  return {
    loopStatus, lastCycle, nextRunIn, isRunning, cycleError, isActive,
    pnlPct, tradeStatus,
    todayTrades:  getTodayTrades(),
    totalTrades:  session?.totalTrades    ?? 0,
    drawdownPct:  session?.drawdownPct    ?? 0,
    portfolioUSD: session?.currentValueUSDT ?? 0,
    startUSD:     session?.startValueUSDT   ?? 0,
    peakUSD:      session?.peakValueUSDT    ?? 0,
    daysElapsed:  getDaysElapsed(),
    isRegistered: session?.isRegistered ?? false,
    network,
    startLoop, stopLoop, pauseLoop, resumeLoop, runCycle,
  }
}
