'use client'

/**
 * hooks/useAgentLoop.ts — Session I (Bug Fix Release)
 *
 * Fixes applied:
 *
 * Bug 2 — Transactions never reaching the chain:
 *   Root cause: startLoop() captured agentConfig in the runCycle closure at call
 *   time. Any dryRun / autonomousMode toggle after startLoop() was invisible to
 *   the running loop. Fixed by keeping an agentConfigRef that is always current.
 *   runCycle reads agentConfigRef.current so it sees the latest config on every
 *   tick, not the snapshot from when the loop was started.
 *
 * Bug 3 — setInterval runs stale runCycle / manual refresh broken:
 *   Root cause: setInterval(runCycle, ...) in startLoop captured the runCycle
 *   function ref at mount time. useCallback recreates runCycle whenever its deps
 *   change (including isRunning, which flips every cycle), so the interval was
 *   perpetually calling an outdated version that saw stale state.
 *   Fixed by:
 *     a) Storing runCycle in runCycleRef and having the interval call
 *        runCycleRef.current() so it always invokes the latest version.
 *     b) Moving the isRunning guard to isRunningRef (a ref) so it is NOT in
 *        runCycle's dependency array — this prevents the needless recreation of
 *        runCycle on every cycle start/end.
 *
 * Session H functionality (network pass-through, SSR-safe localStorage,
 * todayTrades computation, ZK proof submission) is fully preserved.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAgentStore }    from '@/lib/agentStore'
import {
  computePnLPct,
  tradeCountStatus,
  LOOP_INTERVAL_MS,
  type LoopStatus,
  type LoopCycleResult,
} from '@/lib/agentLoop'
import { submitTradeProof } from '@/lib/zkProofStore'

export function useAgentLoop() {
  const {
    privateKey, agentAddress, isWalletLoaded,
    agentConfig, strategyParsed,
    session, initSession, updateSession,
    trades, addTrade,
  } = useAgentStore()

  const network = (useAgentStore() as any).network ?? 'testnet'

  const [loopStatus,  setLoopStatus]  = useState<LoopStatus>('idle')
  const [lastCycle,   setLastCycle]   = useState<LoopCycleResult | null>(null)
  const [nextRunIn,   setNextRunIn]   = useState<number>(0)
  // Bug 3 fix: isRunning is now tracked both as state (for UI rendering) and as
  // a ref (so runCycle can guard re-entrancy without being in the dep array).
  const [isRunning,   setIsRunning]   = useState(false)
  const [cycleError,  setCycleError]  = useState<string>('')

  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastRunRef    = useRef<number>(0)

  // Bug 3 fix: re-entrancy guard as a ref — not state — so it doesn't appear in
  // runCycle's dependency array and doesn't cause needless recreation.
  const isRunningRef  = useRef(false)

  // Bug 3 fix: always-current ref to the latest runCycle function so the
  // setInterval callback never calls a stale closure.
  const runCycleRef   = useRef<() => Promise<void>>()

  // Bug 2 fix: always-current ref to agentConfig so mid-loop toggles of dryRun
  // and autonomousMode are picked up immediately without restarting the loop.
  const agentConfigRef = useRef(agentConfig)
  useEffect(() => {
    agentConfigRef.current = agentConfig
  }, [agentConfig])

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
  // Bug 3 fix: isRunningRef replaces isRunning in the guard and dep array.
  // Bug 2 fix: every config read goes through agentConfigRef.current.
  const runCycle = useCallback(async () => {
    if (!privateKey || !isWalletLoaded)  return
    if (loopStatus === 'disqualified')   return
    if (isRunningRef.current)            return   // Bug 3 fix: ref guard, not state

    isRunningRef.current = true
    setIsRunning(true)
    setCycleError('')
    lastRunRef.current = Date.now()

    // Bug 2 fix: read live config from ref — not the closure snapshot
    const cfg = agentConfigRef.current

    try {
      const symbols = cfg.allowedTokens?.length
        ? cfg.allowedTokens
        : ['ETH', 'ADA', 'AVAX', 'LINK', 'CAKE', 'DOGE', 'DOT', 'BNB']

      const res = await fetch('/api/agent/loop', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privateKey,
          network,
          rules:       strategyParsed,
          symbols,
          startUSD:    session?.startValueUSDT  ?? 0,
          peakUSD:     session?.peakValueUSDT   ?? 0,
          tradesToday: getTodayTrades(),
          totalTrades: session?.totalTrades     ?? 0,
          daysElapsed: getDaysElapsed(),
          // Bug 2 fix: these two fields now come from the live ref, so toggling
          // dryRun or autonomousMode while the loop is running takes effect on
          // the very next cycle — not only after a stop+restart.
          dryRun:      cfg.dryRun,
          config:      cfg,
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
          dryRun:      cfg.dryRun,                         // Bug 2 fix: from live ref
          status:      decision.txHash ? 'confirmed' : cfg.dryRun ? 'confirmed' : 'pending',
          signalScore: decision.signalScore ?? 50,
          reasoning:   decision.reasoning  ?? '',
        })

        if (decision.executed) {
          const snap = data.snapshots?.find((s: any) => s.symbol === decision.symbol)
          const t    = snap?.technicals ?? null
          const proofSignal = {
            symbol:       decision.symbol,
            price:        snap?.price        ?? 0,
            change_24h:   snap?.change24h    ?? 0,
            fear_greed:   snap?.fearGreed    ?? data.fearGreed ?? 50,
            signal_score: decision.signalScore ?? 50,
            rsi14:      t?.rsi14      ?? null,
            macd_hist:  t?.macdHist   ?? null,
            macd_cross: t?.macdCross  ?? null,
            bb_pct:     t?.bbPct      ?? null,
            bb_width:   t?.bbWidth    ?? null,
            adx:        t?.adx        ?? null,
            stoch_k:    t?.stochK     ?? null,
            obv_trend:  t?.obvTrend   ?? null,
            ema_cross:  t?.emaCross   ?? null,
            tech_score: t?.techScore  ?? null,
            regime:     t?.regime     ?? null,
            tags:       snap?.tags    ?? [],
          }

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
                maxDrawdownPct:  cfg.maxDrawdownPct  ?? 30,
                maxPerTradePct:  cfg.maxPerTradePct  ?? 15,
                maxDailyTrades:  cfg.maxDailyTrades  ?? 8,
                dryRun:          cfg.dryRun          ?? true,
              },
            }).catch(err =>
              console.warn('[ZK] submitTradeProof failed (non-fatal):', err.message)
            )
          }
        }
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

    isRunningRef.current = false
    setIsRunning(false)
  }, [
    // Bug 3 fix: isRunning removed — guard is now the ref.
    // Bug 2 fix: agentConfig removed — reads are through agentConfigRef.current.
    // This dramatically reduces how often runCycle is recreated.
    privateKey, isWalletLoaded, network,
    strategyParsed, session, loopStatus,
    getDaysElapsed, getTodayTrades,
    updateSession, addTrade,
  ])

  // Bug 3 fix: keep runCycleRef up to date every time runCycle is recreated.
  // The setInterval callback calls runCycleRef.current() — never a stale copy.
  useEffect(() => {
    runCycleRef.current = runCycle
  }, [runCycle])

  // ── Start / Stop ──────────────────────────────────────────────────────────
  const startLoop = useCallback(async (startingUSDT?: number) => {
    if (!privateKey || !isWalletLoaded) return
    if (!session) initSession(startingUSDT ?? 100)
    setLoopStatus('running')

    // Run the first cycle immediately using the ref so we get the latest version
    await runCycleRef.current?.()

    if (timerRef.current)     clearInterval(timerRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)

    // Bug 3 fix: interval calls runCycleRef.current() — always the latest runCycle
    timerRef.current = setInterval(() => {
      runCycleRef.current?.()
    }, LOOP_INTERVAL_MS)

    countdownRef.current = setInterval(() => {
      const elapsed = (Date.now() - lastRunRef.current) / 1000
      setNextRunIn(Math.max(0, Math.floor(LOOP_INTERVAL_MS / 1000 - elapsed)))
    }, 1000)
  }, [privateKey, isWalletLoaded, session, initSession])
  // Note: runCycle intentionally NOT in this dep array — we use the ref.

  const stopLoop = useCallback(() => {
    if (timerRef.current)     { clearInterval(timerRef.current);    timerRef.current = null }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
    setLoopStatus('idle')
    setNextRunIn(0)
  }, [])

  const pauseLoop  = useCallback(() => setLoopStatus('paused'),  [])
  const resumeLoop = useCallback(() => setLoopStatus('running'), [])

  // Expose runCycle for the "Run cycle now" button — reads through the ref
  // so the manual trigger is also always fresh.
  const triggerManualCycle = useCallback(() => {
    runCycleRef.current?.()
  }, [])

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
    startLoop, stopLoop, pauseLoop, resumeLoop,
    // Bug 3 fix: expose the ref-based trigger instead of raw runCycle
    runCycle: triggerManualCycle,
  }
}