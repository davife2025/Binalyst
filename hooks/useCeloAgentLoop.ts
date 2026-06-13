'use client'

/**
 * hooks/useCeloAgentLoop.ts — Session K (new file)
 *
 * Client-side hook for the Celo Payments Agent. Parallel to
 * hooks/useAgentLoop.ts (BNB competition agent) but fully independent —
 * separate store (celoAgentStore), separate API route
 * (/api/celo-agent/loop), separate interval/state. Nothing here is
 * imported by, or imports from, hooks/useAgentLoop.ts.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useCeloAgentStore } from '@/lib/celoAgentStore'
import {
  CELO_LOOP_INTERVAL_MS,
  type CeloLoopStatus,
  type CeloLoopCycleResult,
} from '@/lib/celoAgentLoop'

export function useCeloAgentLoop() {
  const {
    privateKey, agentAddress, isWalletLoaded, network,
    agentConfig, paymentRules, setPaymentRules,
    session, initSession, updateSession,
    payments, addPayment,
    setCeloBalance, setCusdBalance,
  } = useCeloAgentStore()

  const [loopStatus, setLoopStatus] = useState<CeloLoopStatus>('idle')
  const [lastCycle,  setLastCycle]  = useState<CeloLoopCycleResult | null>(null)
  const [nextRunIn,  setNextRunIn]  = useState<number>(0)
  const [isRunning,  setIsRunning]  = useState(false)
  const [cycleError, setCycleError] = useState<string>('')

  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastRunRef   = useRef<number>(0)

  // ── Helpers ──────────────────────────────────────────────────────────────
  const getPaymentsToday = useCallback((): number => {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    return payments.filter(p =>
      p.timestamp >= todayStart.getTime() &&
      (p.status === 'confirmed' || p.status === 'simulated')
    ).length
  }, [payments])

  // ── Core cycle ────────────────────────────────────────────────────────────
  const runCycle = useCallback(async () => {
    if (!privateKey || !isWalletLoaded) return
    if (isRunning) return

    setIsRunning(true)
    setCycleError('')
    lastRunRef.current = Date.now()

    try {
      const res = await fetch('/api/celo-agent/loop', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privateKey,
          network,
          rules:         paymentRules,
          paymentsToday: getPaymentsToday(),
          config:        agentConfig,
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? 'Cycle failed')

      const newStatus = data.status as CeloLoopStatus

      setCeloBalance(data.celoBalance ?? 0)
      setCusdBalance(data.cusdBalance ?? 0)
      setPaymentRules(data.updatedRules ?? paymentRules)

      updateSession({
        totalUSDSent:  (session?.totalUSDSent  ?? 0) + (data.totalUSDSentThisCycle ?? 0),
        totalPayments: (session?.totalPayments ?? 0) + (data.executed ?? 0),
        lastRunAt:     Date.now(),
        status:        newStatus,
      })

      for (const p of data.payments ?? []) {
        addPayment(p)
      }

      const cycleResult: CeloLoopCycleResult = {
        cycleAt:      Date.now(),
        payments:     data.payments ?? [],
        executed:     data.executed ?? 0,
        blocked:      data.blocked  ?? 0,
        errors:       data.errors   ?? [],
        totalUSD:     data.totalUSD ?? 0,
        celoBalance:  data.celoBalance ?? 0,
        cusdBalance:  data.cusdBalance ?? 0,
        celoPriceUSD: data.celoPriceUSD ?? 0,
        updatedRules: data.updatedRules ?? paymentRules,
        status:       newStatus,
      }

      setLastCycle(cycleResult)
      setLoopStatus(newStatus)
      setNextRunIn(CELO_LOOP_INTERVAL_MS / 1000)

    } catch (e: any) {
      setCycleError(e.message)
      setLoopStatus('error')
    }

    setIsRunning(false)
  }, [
    privateKey, isWalletLoaded, network, agentConfig,
    paymentRules, session, isRunning,
    getPaymentsToday, setPaymentRules, setCeloBalance, setCusdBalance,
    updateSession, addPayment,
  ])

  // ── Start / Stop ──────────────────────────────────────────────────────────
  const startLoop = useCallback(async () => {
    if (!privateKey || !isWalletLoaded) return
    if (!session) initSession()
    setLoopStatus('running')
    await runCycle()
    if (timerRef.current)     clearInterval(timerRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
    timerRef.current = setInterval(runCycle, CELO_LOOP_INTERVAL_MS)
    countdownRef.current = setInterval(() => {
      const elapsed = (Date.now() - lastRunRef.current) / 1000
      setNextRunIn(Math.max(0, Math.floor(CELO_LOOP_INTERVAL_MS / 1000 - elapsed)))
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

  const isActive = timerRef.current !== null

  return {
    loopStatus, lastCycle, nextRunIn, isRunning, cycleError, isActive,
    paymentsToday:  getPaymentsToday(),
    totalPayments:  session?.totalPayments ?? 0,
    totalUSDSent:   session?.totalUSDSent  ?? 0,
    network,
    startLoop, stopLoop, pauseLoop, resumeLoop, runCycle,
  }
}
