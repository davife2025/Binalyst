'use client'

/**
 * hooks/useAgentLoop.ts — Session K (REPLACES all previous versions)
 *
 * TRUE SELF-CUSTODY IMPLEMENTATION:
 * - Private key NEVER sent to server
 * - Server returns unsigned transactions
 * - Browser signs locally via ethers.Wallet
 * - Browser broadcasts signed tx via /api/agent/tx
 * - x402 payment proof signed locally for premium signals
 *
 * This is the correct TWAK autonomous-mode pattern.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { ethers }               from 'ethers'
import { useAgentStore }        from '@/lib/agentStore'
import {
  computeDrawdown,
  computePnLPct,
  tradeCountStatus,
  LOOP_INTERVAL_MS,
  type LoopStatus,
  type LoopCycleResult,
} from '@/lib/agentLoop'
import { NETWORKS, type Network } from '@/lib/twak/networks'

// x402 config
const X402_AMOUNT   = '0.001'
const X402_CURRENCY = 'USDT'
const X402_PAYTO    = process.env.NEXT_PUBLIC_X402_ADDRESS ?? '0x0000000000000000000000000000000000000000'

export function useAgentLoop() {
  const {
    privateKey, agentAddress, isWalletLoaded,
    agentConfig, strategyParsed,
    session, initSession, updateSession,
    trades, addTrade,
  } = useAgentStore()

  const network = (useAgentStore() as any).network ?? 'testnet' as Network

  const [loopStatus,  setLoopStatus]  = useState<LoopStatus>('idle')
  const [lastCycle,   setLastCycle]   = useState<LoopCycleResult | null>(null)
  const [nextRunIn,   setNextRunIn]   = useState<number>(0)
  const [isRunning,   setIsRunning]   = useState(false)
  const [cycleError,  setCycleError]  = useState<string>('')
  const [signingTx,   setSigningTx]   = useState(false)

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

  // ── x402: sign payment proof locally ─────────────────────────────────────
  const signX402Proof = useCallback(async (symbol: string): Promise<string | null> => {
    if (!privateKey) return null
    try {
      const wallet  = new ethers.Wallet(privateKey)
      const message = `x402:pay:${X402_AMOUNT}:${X402_CURRENCY}:${X402_PAYTO}:${symbol}:${Date.now()}`
      return await wallet.signMessage(message)
    } catch { return null }
  }, [privateKey])

  // ── Sign unsigned transactions locally ────────────────────────────────────
  const signAndBroadcast = useCallback(async (
    unsignedTxs: any[],
    network: Network
  ): Promise<Array<{ txHash: string; success: boolean; symbol: string; action: string }>> => {
    if (!privateKey || !unsignedTxs.length) return []

    setSigningTx(true)
    const results = []
    const net     = NETWORKS[network]

    try {
      const provider = new ethers.JsonRpcProvider(net.rpc)
      const wallet   = new ethers.Wallet(privateKey, provider)

      for (const utx of unsignedTxs) {
        try {
          // 1. Sign + broadcast approval (if needed)
          if (utx.approvalTx) {
            const approvalNonce = await provider.getTransactionCount(wallet.address, 'latest')
            const approvalTxReq = {
              to:       utx.approvalTx.to,
              data:     utx.approvalTx.data,
              gasLimit: BigInt(utx.approvalTx.gasLimit),
              nonce:    approvalNonce,
              chainId:  net.chainId,
            }
            // Sign locally
            const signedApproval = await wallet.signTransaction(approvalTxReq)
            // Broadcast via relay endpoint (no private key sent)
            await fetch('/api/agent/tx', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                signedTxHex: signedApproval,
                network,
                symbol: utx.symbol,
                action: 'APPROVE',
              }),
            })
          }

          // 2. Sign + broadcast swap
          const swapNonce = await provider.getTransactionCount(wallet.address, 'pending')
          const swapTxReq = {
            to:       utx.swapTx.to,
            data:     utx.swapTx.data,
            value:    BigInt(utx.swapTx.value ?? '0'),
            gasLimit: BigInt(utx.swapTx.gasLimit),
            nonce:    swapNonce,
            chainId:  net.chainId,
          }

          // Sign locally — private key never leaves browser
          const signedSwap = await wallet.signTransaction(swapTxReq)

          // Broadcast via relay (server only broadcasts, doesn't see the key)
          const broadcastRes = await fetch('/api/agent/tx', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              signedTxHex: signedSwap,
              network,
              symbol:      utx.symbol,
              action:      utx.action,
              amountUSDT:  utx.amountUSDT,
            }),
          })

          const broadcastData = await broadcastRes.json()
          results.push({
            txHash:  broadcastData.txHash ?? '',
            success: broadcastData.success ?? false,
            symbol:  utx.symbol,
            action:  utx.action,
          })
        } catch (e: any) {
          results.push({ txHash: '', success: false, symbol: utx.symbol, action: utx.action })
        }
      }
    } finally {
      setSigningTx(false)
    }

    return results
  }, [privateKey])

  // ── Core cycle ────────────────────────────────────────────────────────────
  const runCycle = useCallback(async () => {
    if (!agentAddress || !isWalletLoaded) return
    if (loopStatus === 'disqualified') return
    if (isRunning) return

    setIsRunning(true)
    setCycleError('')
    lastRunRef.current = Date.now()

    try {
      const symbols = agentConfig.allowedTokens.length
        ? agentConfig.allowedTokens
        : ['ETH', 'ADA', 'AVAX', 'LINK', 'CAKE', 'DOGE', 'DOT', 'BNB']

      // Sign x402 proof for the first symbol (demonstrates pay-per-request)
      const x402Sig = agentConfig.autonomousMode && !agentConfig.dryRun
        ? await signX402Proof(symbols[0])
        : null

      // Call loop API — sends WALLET ADDRESS only, NOT private key
      const res = await fetch('/api/agent/loop', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: agentAddress,      // ← address only
          network,
          rules:         strategyParsed,
          symbols,
          startUSD:      session?.startValueUSDT  ?? 0,
          peakUSD:       session?.peakValueUSDT   ?? 0,
          portfolioUSD:  session?.currentValueUSDT ?? 0,
          tradesToday:   getTodayTrades(),
          totalTrades:   session?.totalTrades      ?? 0,
          daysElapsed:   getDaysElapsed(),
          config:        agentConfig,
          x402Signature: x402Sig,           // ← signed payment proof
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? 'Cycle failed')

      const portfolioUSD = data.portfolioUSD ?? session?.currentValueUSDT ?? 0
      const drawdownPct  = data.drawdownPct  ?? 0
      const newStatus    = data.status as LoopStatus

      // ── Sign and broadcast unsigned transactions locally ─────────────────
      let txResults: Array<{ txHash: string; success: boolean; symbol: string; action: string }> = []

      if (data.unsignedTxs?.length && agentConfig.autonomousMode && !agentConfig.dryRun) {
        // THIS is where true self-custody happens:
        // private key signs transactions in the browser
        txResults = await signAndBroadcast(data.unsignedTxs, network as Network)
      }

      // ── Update session ───────────────────────────────────────────────────
      const executed = txResults.filter(r => r.success).length

      updateSession({
        currentValueUSDT: portfolioUSD,
        peakValueUSDT:    Math.max(session?.peakValueUSDT ?? 0, portfolioUSD),
        drawdownPct,
        totalTrades:      (session?.totalTrades ?? 0) + executed,
        todayTrades:      getTodayTrades() + executed,
        lastRunAt:        Date.now(),
        status:           newStatus,
      })

      // ── Log trades ───────────────────────────────────────────────────────
      for (const decision of data.decisions ?? []) {
        if (decision.guardrail === 'blocked') continue

        // Match with tx result if live
        const txResult = txResults.find(
          r => r.symbol === decision.symbol && r.action === decision.action
        )

        addTrade({
          id:          crypto.randomUUID(),
          timestamp:   decision.timestamp ?? Date.now(),
          symbol:      decision.symbol,
          side:        decision.action,
          amountUSDT:  decision.amountUSDT,
          price:       data.snapshots?.find((s: any) => s.symbol === decision.symbol)?.price ?? 0,
          txHash:      txResult?.txHash ?? '',
          dryRun:      agentConfig.dryRun || !agentConfig.autonomousMode,
          status:      txResult?.success ? 'confirmed' : agentConfig.dryRun ? 'confirmed' : 'pending',
          signalScore: decision.signalScore ?? 50,
          reasoning:   decision.reasoning  ?? '',
        })
      }

      const cycleResult: LoopCycleResult = {
        cycleAt:      Date.now(),
        decisions:    data.decisions ?? [],
        executed,
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
    agentAddress, isWalletLoaded, network, agentConfig,
    strategyParsed, session, loopStatus, isRunning,
    getDaysElapsed, getTodayTrades, signX402Proof, signAndBroadcast,
  ])

  // ── Start / Stop ──────────────────────────────────────────────────────────
  const startLoop = useCallback(async (startingUSDT?: number) => {
    if (!agentAddress || !isWalletLoaded) return
    if (!session) initSession(startingUSDT ?? 100)
    setLoopStatus('running')
    await runCycle()
    if (timerRef.current)     clearInterval(timerRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
    timerRef.current     = setInterval(runCycle, LOOP_INTERVAL_MS)
    countdownRef.current = setInterval(() => {
      const elapsed = (Date.now() - lastRunRef.current) / 1000
      setNextRunIn(Math.max(0, Math.floor(LOOP_INTERVAL_MS / 1000 - elapsed)))
    }, 1000)
  }, [agentAddress, isWalletLoaded, session, initSession, runCycle])

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

  const pnlPct      = session ? computePnLPct(session.startValueUSDT, session.currentValueUSDT) : 0
  const tradeStatus = tradeCountStatus(getTodayTrades(), session?.totalTrades ?? 0, getDaysElapsed())
  const isActive    = timerRef.current !== null

  return {
    loopStatus, lastCycle, nextRunIn, isRunning, cycleError, isActive, signingTx,
    pnlPct, tradeStatus,
    todayTrades:  getTodayTrades(),
    totalTrades:  session?.totalTrades      ?? 0,
    drawdownPct:  session?.drawdownPct      ?? 0,
    portfolioUSD: session?.currentValueUSDT ?? 0,
    startUSD:     session?.startValueUSDT   ?? 0,
    peakUSD:      session?.peakValueUSDT    ?? 0,
    daysElapsed:  getDaysElapsed(),
    isRegistered: session?.isRegistered ?? false,
    network,
    startLoop, stopLoop, pauseLoop, resumeLoop, runCycle,
  }
}
