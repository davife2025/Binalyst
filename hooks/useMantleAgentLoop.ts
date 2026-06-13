'use client'

/**
 * hooks/useMantleAgentLoop.ts — Session N2 (new file)
 *
 * Client-side hook driving the Mantle AI Trading Agent loop.
 * Part of: The Turing Test Hackathon — AI Trading & Strategy track.
 *
 * Fully parallel to hooks/useCeloAgentLoop.ts (Celo) and
 * hooks/useAgentLoop.ts (BNB) — shares no code with either.
 * Uses its own store (mantleAgentStore), its own API route
 * (/api/mantle-agent/loop), and its own interval/state.
 *
 * Loop cadence: every 2 minutes (MANTLE_LOOP_INTERVAL_MS = 120_000)
 * matching the BNB and Celo agents for consistency.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useMantleAgentStore }  from '@/lib/mantleAgentStore'
import {
  MANTLE_LOOP_INTERVAL_MS,
  computeDrawdown,
  computePnLPct,
  type MantleLoopStatus,
  type MantleLoopCycleResult,
} from '@/lib/mantleAgentLoop'

export function useMantleAgentLoop() {
  const {
    privateKey,
    agentAddress,
    isWalletLoaded,
    network,
    agentConfig,
    session,
    initSession,
    updateSession,
    trades,
    addTrade,
    benchmarks,
    addBenchmark,
    prices,
    setPrices,
    setBalances,
  } = useMantleAgentStore()

  const [loopStatus, setLoopStatus] = useState<MantleLoopStatus>('idle')
  const [lastCycle,  setLastCycle]  = useState<MantleLoopCycleResult | null>(null)
  const [nextRunIn,  setNextRunIn]  = useState<number>(0)
  const [isRunning,  setIsRunning]  = useState(false)
  const [cycleError, setCycleError] = useState<string>('')

  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastRunRef   = useRef<number>(0)

  // ── Helpers ────────────────────────────────────────────────────────────────

  const getTradesToday = useCallback((): number => {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    return trades.filter(t =>
      t.timestamp >= todayStart.getTime() &&
      (t.status === 'confirmed' || t.status === 'simulated')
    ).length
  }, [trades])

  // ── Core cycle ─────────────────────────────────────────────────────────────

  const runCycle = useCallback(async () => {
    if (!privateKey || !isWalletLoaded) return
    if (isRunning) return

    setIsRunning(true)
    setCycleError('')
    lastRunRef.current = Date.now()

    try {
      const res = await fetch('/api/mantle-agent/loop', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privateKey,
          network,
          config:      agentConfig,
          session,
          tradesToday: getTradesToday(),
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? 'Cycle failed')

      const newStatus = data.status as MantleLoopStatus

      // Update prices
      if (data.prices) setPrices(data.prices)

      // Update balances
      if (data.balances) {
        setBalances({
          mntBalance:  data.balances['MNT']  ?? 0,
          mEthBalance: data.balances['mETH'] ?? 0,
          usdyBalance: data.balances['USDY'] ?? 0,
          usdcBalance: data.balances['USDC'] ?? 0,
          usdtBalance: data.balances['USDT'] ?? 0,
        })
      }

      // Add trades to store
      for (const trade of data.trades ?? []) {
        addTrade(trade)
      }

      // Add benchmark records to store
      const rawBenchmarks: string[] = data.benchmarks ?? []
      for (const encoded of rawBenchmarks) {
        try {
          const parsed = JSON.parse(encoded)
          // Reconstruct BenchmarkRecord from compact form
          addBenchmark({
            v:        1,
            agent:    parsed.a ?? agentAddress,
            ts:       parsed.ts ?? Date.now(),
            symbol:   parsed.s ?? '',
            decision: parsed.d ?? 'HOLD',
            score:    parsed.sc ?? 50,
            price:    parsed.p  ?? 0,
            executed: parsed.ex ?? false,
            txHash:   parsed.tx || undefined,
            reason:   parsed.rs ?? '',
          })
        } catch {
          // malformed benchmark record — skip
        }
      }

      // Update session
      const currentUSD  = data.portfolioUSD ?? session?.currentValueUSD ?? 0
      const peakUSD     = Math.max(data.peakUSD ?? 0, currentUSD)
      const drawdownPct = computeDrawdown(currentUSD, peakUSD)

      updateSession({
        currentValueUSD: currentUSD,
        peakValueUSD:    peakUSD,
        drawdownPct,
        totalTrades:     (session?.totalTrades  ?? 0) + (data.executed ?? 0),
        todayTrades:     getTradesToday() + (data.executed ?? 0),
        lastRunAt:       Date.now(),
        status:          newStatus,
        benchmarkCount:  (session?.benchmarkCount ?? 0) + (data.benchmarkCount ?? 0),
      })

      const cycleResult: MantleLoopCycleResult = {
        cycleAt:        Date.now(),
        trades:         data.trades         ?? [],
        decisions:      data.decisions      ?? 0,
        executed:       data.executed       ?? 0,
        blocked:        data.blocked        ?? 0,
        errors:         data.errors         ?? [],
        portfolioUSD:   data.portfolioUSD   ?? 0,
        mntBalance:     data.mntBalance     ?? 0,
        mntPrice:       data.mntPrice       ?? 0,
        benchmarkCount: data.benchmarkCount ?? 0,
        status:         newStatus,
      }

      setLastCycle(cycleResult)
      setLoopStatus(newStatus)
      setNextRunIn(MANTLE_LOOP_INTERVAL_MS / 1000)

    } catch (e: any) {
      setCycleError(e.message)
      setLoopStatus('error')
    }

    setIsRunning(false)
  }, [
    privateKey, isWalletLoaded, network, agentConfig, session,
    isRunning, agentAddress,
    getTradesToday, setPrices, setBalances, addTrade, addBenchmark, updateSession,
  ])

  // ── Start / Stop ───────────────────────────────────────────────────────────

  const startLoop = useCallback(async () => {
    if (!privateKey || !isWalletLoaded) return
    if (!session) {
      // portfolioUSD will be fetched on first cycle — init with 0
      initSession(0)
    }
    setLoopStatus('running')
    await runCycle()

    if (timerRef.current)     clearInterval(timerRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)

    timerRef.current = setInterval(runCycle, MANTLE_LOOP_INTERVAL_MS)
    countdownRef.current = setInterval(() => {
      const elapsed = (Date.now() - lastRunRef.current) / 1000
      setNextRunIn(Math.max(0, Math.floor(MANTLE_LOOP_INTERVAL_MS / 1000 - elapsed)))
    }, 1000)
  }, [privateKey, isWalletLoaded, session, initSession, runCycle])

  const stopLoop = useCallback(() => {
    if (timerRef.current)     { clearInterval(timerRef.current);     timerRef.current = null }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
    setLoopStatus('idle')
    setNextRunIn(0)
  }, [])

  const pauseLoop  = useCallback(() => setLoopStatus('paused'),  [])
  const resumeLoop = useCallback(() => {
    setLoopStatus('running')
    // restart the timer
    if (!timerRef.current) {
      timerRef.current = setInterval(runCycle, MANTLE_LOOP_INTERVAL_MS)
    }
  }, [runCycle])

  // Register ERC-8004 on Mantle Mainnet
  const registerAgent = useCallback(async (
    name: string,
    description: string,
  ): Promise<{ success: boolean; agentId?: string; txHash?: string; scanUrl?: string; error?: string }> => {
    if (!privateKey) return { success: false, error: 'No wallet loaded.' }
    try {
      const res = await fetch('/api/mantle-agent/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ privateKey, network, name, description }),
      })
      const data = await res.json()
      if (data.success && data.agentId) {
        useMantleAgentStore.getState().setAgentIdentity(data.agentId, data.txHash)
      }
      return data
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  }, [privateKey, network])

  // Cleanup on unmount
  useEffect(() => () => {
    if (timerRef.current)     clearInterval(timerRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
  }, [])

  const isActive = timerRef.current !== null

  // Derived metrics
  const pnlPct = session
    ? computePnLPct(session.currentValueUSD, session.startValueUSD)
    : 0

  const pnlUSD = session
    ? session.currentValueUSD - session.startValueUSD
    : 0

  return {
    // Status
    loopStatus,
    lastCycle,
    nextRunIn,
    isRunning,
    cycleError,
    isActive,

    // Session metrics
    portfolioUSD:   session?.currentValueUSD ?? 0,
    startUSD:       session?.startValueUSD   ?? 0,
    peakUSD:        session?.peakValueUSD    ?? 0,
    drawdownPct:    session?.drawdownPct     ?? 0,
    pnlPct,
    pnlUSD,
    totalTrades:    session?.totalTrades     ?? 0,
    tradesToday:    getTradesToday(),
    benchmarkCount: session?.benchmarkCount  ?? 0,

    // Data
    trades,
    benchmarks,
    prices,
    network,
    session,

    // Actions
    startLoop,
    stopLoop,
    pauseLoop,
    resumeLoop,
    runCycle,
    registerAgent,
  }
}
