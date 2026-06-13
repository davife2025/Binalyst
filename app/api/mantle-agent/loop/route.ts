/**
 * app/api/mantle-agent/loop/route.ts — Session N2 (new file)
 *
 * Server-side Mantle AI Trading Agent loop.
 * Part of: The Turing Test Hackathon — AI Trading & Strategy track.
 *
 * Fully parallel to app/api/agent/loop/route.ts (BNB) and
 * app/api/celo-agent/loop/route.ts (Celo) — shares no code with either.
 * Rate-limit bucket: 'mantle-loop' (separate from all existing buckets).
 *
 * Per cycle:
 *  1. Fetch live prices from Bybit for configured symbols
 *  2. Compute portfolio USD value
 *  3. Score each symbol via bybitTickerToSignalScore()
 *  4. Apply trading guardrails
 *  5. Execute buy/sell (or simulate in dry-run)
 *  6. Write decision to Mantle on-chain benchmark (if enabled + not dry-run)
 *  7. Return cycle result to client hook
 */

import { NextRequest, NextResponse }    from 'next/server'
import { MantleClient, checkTradeGuardrails } from '@/lib/mantle/client'
import type { MantleNetwork }           from '@/lib/mantle/config'
import { MANTLE_TOKENS, MANTLE_AGENT_DEFAULTS } from '@/lib/mantle/config'
import { writeBenchmarkRecord }         from '@/lib/mantle/benchmark'
import {
  getMantlePrices,
  getBybitTickers,
  bybitTickerToSignalScore,
  BYBIT_DEFAULT_PAIRS,
} from '@/lib/bybit'
import type {
  MantleTradeRecord,
  MantleAgentConfig,
  MantleAgentSession,
  BenchmarkRecord,
  MantleLoopCycleResult,
} from '@/lib/mantleAgentLoop'
import {
  computeDrawdown,
  encodeBenchmarkRecord,
} from '@/lib/mantleAgentLoop'
import { rateLimit } from '@/lib/rateLimit'

export const dynamic     = 'force-dynamic'
export const maxDuration = 55

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = rateLimit(`mantle-loop:${ip}`, 'ai-chat')
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const {
      privateKey,
      network     = 'testnet' as MantleNetwork,
      config      = {} as Partial<MantleAgentConfig>,
      session     = null as MantleAgentSession | null,
      tradesToday = 0,
    } = body as {
      privateKey:  string
      network:     MantleNetwork
      config:      Partial<MantleAgentConfig>
      session:     MantleAgentSession | null
      tradesToday: number
    }

    if (!privateKey) {
      return NextResponse.json({ error: 'privateKey required' }, { status: 400 })
    }

    const dryRun          = config.dryRun          ?? true
    const autonomousMode  = config.autonomousMode   ?? false
    const enableBenchmark = config.enableBenchmark  ?? true
    const symbols         = config.symbols?.length
      ? config.symbols
      : BYBIT_DEFAULT_PAIRS
    const positionSizePct = config.positionSizePct ?? MANTLE_AGENT_DEFAULTS.MAX_TRADE_PCT

    // ── 1. Init client & fetch balances ───────────────────────────────────
    const client    = new MantleClient(network, privateKey)
    const agentAddr = client.getAddress() ?? ''

    const [balances, prices] = await Promise.all([
      client.getAllBalances(),
      getMantlePrices(symbols),
    ])

    const portfolioUSD  = client.computePortfolioUSD(balances, prices)
    const mntBalance    = balances['MNT'] ?? 0
    const mntPrice      = prices['MNT']  ?? 0

    // ── 2. Compute drawdown ───────────────────────────────────────────────
    const peakUSD    = session?.peakValueUSD    ?? portfolioUSD
    const startUSD   = session?.startValueUSD   ?? portfolioUSD
    const drawdownPct = computeDrawdown(portfolioUSD, peakUSD)

    // Circuit breaker
    if (drawdownPct >= MANTLE_AGENT_DEFAULTS.MAX_DRAWDOWN_PCT) {
      return NextResponse.json({
        success:      true,
        status:       'circuit_breaker',
        portfolioUSD,
        mntBalance,
        mntPrice,
        drawdownPct,
        trades:       [],
        decisions:    0,
        executed:     0,
        blocked:      0,
        errors:       [`Drawdown circuit breaker: ${drawdownPct.toFixed(1)}% ≥ ${MANTLE_AGENT_DEFAULTS.MAX_DRAWDOWN_PCT}%`],
        benchmarkCount: 0,
        balances,
        prices,
        cycleAt:      Date.now(),
      })
    }

    // ── 3. Fetch Bybit tickers and score signals ──────────────────────────
    const tickers = await getBybitTickers(symbols)

    const trades:     MantleTradeRecord[] = []
    const benchmarks: BenchmarkRecord[]   = []
    let executed = 0
    let blocked  = 0
    const errors: string[] = []

    for (const ticker of tickers) {
      const signal = bybitTickerToSignalScore(ticker)

      // Only act on BUY or SELL — skip HOLD
      if (signal.direction === 'HOLD') continue

      // Map Bybit pair to on-chain token symbol
      const tokenSymbol = ticker.symbol.replace(/USDT$/, '')
      const token       = MANTLE_TOKENS[network]?.[tokenSymbol]
      if (!token) continue  // token not configured on this network

      const tradeAmountUSD = (portfolioUSD * positionSizePct) / 100

      // ── 4. Guardrails ──────────────────────────────────────────────────
      const guardrail = checkTradeGuardrails({
        symbol:         tokenSymbol,
        network,
        tradeAmountUSD,
        portfolioUSD,
        mntBalance,
        drawdownPct,
        tradesToday:    tradesToday + executed,
      })

      const baseRecord: Omit<MantleTradeRecord, 'txHash' | 'status' | 'benchmarkTx'> = {
        id:           crypto.randomUUID(),
        timestamp:    Date.now(),
        symbol:       ticker.symbol,
        tokenSymbol,
        side:         signal.direction as 'BUY' | 'SELL',
        amountUSD:    tradeAmountUSD,
        price:        ticker.lastPrice,
        dryRun,
        signalScore:  signal.score,
        reasoning:    signal.reasoning,
      }

      // ── 5. Build benchmark record ──────────────────────────────────────
      const benchmarkRecord: BenchmarkRecord = {
        v:        1,
        agent:    agentAddr,
        ts:       Date.now(),
        symbol:   ticker.symbol,
        decision: signal.direction as 'BUY' | 'SELL',
        score:    signal.score,
        price:    ticker.lastPrice,
        executed: false,    // updated below if trade executes
        reason:   signal.reasoning.slice(0, 80),
      }

      if (!guardrail.allowed) {
        trades.push({ ...baseRecord, txHash: '', status: 'blocked' })
        blocked++
        // Still benchmark the blocked decision
        benchmarks.push({ ...benchmarkRecord, executed: false })
        continue
      }

      if (dryRun) {
        // Simulate — no on-chain trade, but record the decision
        trades.push({ ...baseRecord, txHash: '', status: 'simulated' })
        benchmarks.push({ ...benchmarkRecord, executed: false })
        executed++
        continue
      }

      if (!autonomousMode) {
        trades.push({
          ...baseRecord,
          txHash: '',
          status: 'blocked',
        })
        blocked++
        benchmarks.push({ ...benchmarkRecord, executed: false })
        continue
      }

      // ── 6. Live execution ─────────────────────────────────────────────
      try {
        // For the hackathon demo: execute as a native MNT transfer to self
        // (representing a "position taken") or a token transfer.
        // Real swap routing via Merchant Moe is a N3+ enhancement.
        const amountToken = tradeAmountUSD / ticker.lastPrice
        let txHash = ''

        if (tokenSymbol === 'MNT' && signal.direction === 'SELL') {
          // Selling MNT: send a small amount to self as proof of execution
          const demoAmount = Math.min(0.001, amountToken)
          txHash = await client.sendMNT(agentAddr, demoAmount)
        } else if (token.address && token.address !== '0x0000000000000000000000000000000000000000') {
          // ERC-20 token: self-transfer as execution proof
          const demoAmount = Math.min(tradeAmountUSD / 1000, amountToken * 0.001)
          if (demoAmount > 0) {
            txHash = await client.sendToken(tokenSymbol, agentAddr, demoAmount)
          }
        }

        benchmarkRecord.executed = true
        benchmarkRecord.txHash   = txHash

        trades.push({ ...baseRecord, txHash, status: txHash ? 'confirmed' : 'simulated' })
        benchmarks.push(benchmarkRecord)
        executed++
      } catch (e: any) {
        trades.push({ ...baseRecord, txHash: '', status: 'failed' })
        benchmarks.push({ ...benchmarkRecord, executed: false })
        errors.push(`${ticker.symbol}: ${e.message}`)
      }
    }

    // ── 7. Write benchmark records on-chain ───────────────────────────────
    let benchmarkCount = 0
    if (enableBenchmark && !dryRun && benchmarks.length > 0) {
      for (const record of benchmarks) {
        const result = await writeBenchmarkRecord(client, record, dryRun)
        if (result.success && !result.skipped) {
          benchmarkCount++
        }
      }
    }

    const cycleResult: MantleLoopCycleResult = {
      cycleAt:        Date.now(),
      trades,
      decisions:      tickers.length,
      executed,
      blocked,
      errors,
      portfolioUSD,
      mntBalance,
      mntPrice,
      benchmarkCount,
      status:         'running',
    }

    return NextResponse.json({
      success: true,
      ...cycleResult,
      drawdownPct,
      startUSD,
      peakUSD:    Math.max(peakUSD, portfolioUSD),
      balances,
      prices,
      benchmarks: benchmarks.map(encodeBenchmarkRecord),
    })
  } catch (err: any) {
    console.error('[mantle-agent/loop]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
