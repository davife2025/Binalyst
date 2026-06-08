'use client'

/**
 * hooks/useAgentLoop.ts
 * React hook that drives the autonomous agent loop from the browser.
 * Polls /api/agent/loop every 2 minutes when autonomousMode is on.
 * Syncs all results back into agentStore.
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

export function useAgentLoop() {
  const {
    privateKey, agentAddress, isWalletLoaded,
    agentConfig, strategyParsed,
    session, initSession, updateSession,
    trades, addTrade, updateTrade,
    lastSignals,
  } = useAgentStore()

  const [loopStatus,   setLoopStatus]   = useState<LoopStatus>('idle')
  const [lastCycle,    setLastCycle]    = useState<LoopCycleResult | null>(null)
  const [nextRunIn,    setNextRunIn]    = useState<number>(0)
  const [isRunning,    setIsRunning]    = useState(false)
  const [cycleError,   setCycleError]   = useState<string>('')

  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastRunRef   = useRef<number>(0)

  // ── Helpers ──────────────────────────────────────────────────────────────
  const getDaysElapsed = useCallback(() => {
    if (!session?.startedAt) return 0
    return Math.floor((Date.now() - session.startedAt) / 86400000)
  }, [session])

  const getTodayTrades = useCallback(() => {
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
        : ['ETH', 'BNB', 'ADA', 'AVAX', 'LINK', 'CAKE', 'DOGE', 'DOT']

      const res = await fetch('/api/agent/loop', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privateKey,
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

      // ── Update session ───────────────────────────────────────────────────
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

      // ── Log trades ───────────────────────────────────────────────────────
      for (const decision of data.decisions ?? []) {
        if (decision.guardrail === 'blocked') continue
        const tradeId = crypto.randomUUID()
        addTrade({
          id:          tradeId,
          timestamp:   decision.timestamp ?? Date.now(),
          symbol:      decision.symbol,
          side:        decision.action,
          amountUSDT:  decision.amountUSDT,
          price:       data.snapshots?.find((s: any) => s.symbol === decision.symbol)?.price ?? 0,
          txHash:      decision.txHash ?? '',
          dryRun:      agentConfig.dryRun,
          status:      decision.txHash ? 'confirmed' : (agentConfig.dryRun ? 'confirmed' : 'pending'),
          signalScore: decision.signalScore,
          reasoning:   decision.reasoning,
        })
      }

      // ── Build cycle result ───────────────────────────────────────────────
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
    privateKey, isWalletLoaded, agentConfig, strategyParsed,
    session, loopStatus, isRunning, getDaysElapsed, getTodayTrades,
  ])

  // ── Start / Stop ──────────────────────────────────────────────────────────
  const startLoop = useCallback(async (startingUSDT?: number) => {
    if (!privateKey || !isWalletLoaded) return
    if (!session) {
      initSession(startingUSDT ?? 100)
    }
    setLoopStatus('running')
    await runCycle()
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(runCycle, LOOP_INTERVAL_MS)

    // Countdown ticker
    if (countdownRef.current) clearInterval(countdownRef.current)
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

  const pauseLoop = useCallback(() => {
    setLoopStatus('paused')
  }, [])

  const resumeLoop = useCallback(() => {
    setLoopStatus('running')
  }, [])

  // Cleanup on unmount
  useEffect(() => () => {
    if (timerRef.current)     clearInterval(timerRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
  }, [])

  // Derived stats
  const pnlPct = session
    ? computePnLPct(session.startValueUSDT, session.currentValueUSDT)
    : 0

  const tradeStatus = tradeCountStatus(
    getTodayTrades(),
    session?.totalTrades ?? 0,
    getDaysElapsed(),
  )

  const isActive = timerRef.current !== null

  return {
    // State
    loopStatus, lastCycle, nextRunIn, isRunning, cycleError, isActive,
    // Stats
    pnlPct, tradeStatus,
    todayTrades:  getTodayTrades(),
    totalTrades:  session?.totalTrades   ?? 0,
    drawdownPct:  session?.drawdownPct   ?? 0,
    portfolioUSD: session?.currentValueUSDT ?? 0,
    startUSD:     session?.startValueUSDT   ?? 0,
    peakUSD:      session?.peakValueUSDT    ?? 0,
    daysElapsed:  getDaysElapsed(),
    isRegistered: session?.isRegistered ?? false,
    // Controls
    startLoop, stopLoop, pauseLoop, resumeLoop, runCycle,
  }
}
