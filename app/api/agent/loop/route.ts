/**
 * app/api/agent/loop/route.ts
 * Server-side agent loop trigger.
 * Called by the client every 2 min (or by Vercel cron).
 * Fetches signals, evaluates rules, executes trades, returns cycle result.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getTokensBySymbols, getFearAndGreed } from '@/lib/skills/cmc'
import { computeSignalSnapshot }               from '@/lib/signalEngine'
import { TWAKClient, ELIGIBLE_TOKENS, checkCompetitionGuardrails, ALL_ELIGIBLE_SYMBOLS } from '@/lib/twak/client'
import { computeDrawdown, computePnLPct, DRAWDOWN_PAUSE_PCT } from '@/lib/agentLoop'
import { COMPETITION_RULES }                   from '@/lib/twak/client'
import { rateLimit }                           from '@/lib/rateLimit'
import { ethers }                              from 'ethers'

export const dynamic     = 'force-dynamic'
export const maxDuration = 55

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = rateLimit(`loop:${ip}`, 'ai-chat')
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

  try {
    const body = await req.json()
    const {
      privateKey,
      rules       = [],
      symbols     = [],
      startUSD    = 0,
      peakUSD     = 0,
      tradesToday = 0,
      totalTrades = 0,
      daysElapsed = 0,
      config      = {},
      dryRun      = true,
    } = body

    if (!privateKey) return NextResponse.json({ error: 'privateKey required' }, { status: 400 })

    const {
      maxPerTradePct = 15,
      slippagePct    = 1.0,
      maxDailyTrades = 8,
      autonomousMode = false,
    } = config

    // ── 1. Get wallet portfolio value ────────────────────────────────────────
    const client    = new TWAKClient(privateKey)
    const holdings  = Object.values(ELIGIBLE_TOKENS).filter(t =>
      symbols.includes(t.symbol) || ['USDT', 'FDUSD'].includes(t.symbol)
    )

    let portfolioUSD = 0
    let portfolioItems: any[] = []

    try {
      const pv = await client.getPortfolioValueUSD(holdings)
      portfolioUSD   = pv.totalUSD
      portfolioItems = pv.items
    } catch {
      portfolioUSD = startUSD // fallback
    }

    // ── 2. Compute drawdown ──────────────────────────────────────────────────
    const peak        = Math.max(peakUSD, startUSD, portfolioUSD)
    const drawdownPct = computeDrawdown(startUSD, peak, portfolioUSD)
    const pnlPct      = computePnLPct(startUSD, portfolioUSD)

    // ── 3. Safety: disqualify / pause ────────────────────────────────────────
    if (drawdownPct >= COMPETITION_RULES.MAX_DRAWDOWN_PCT) {
      return NextResponse.json({
        success:      true,
        status:       'disqualified',
        portfolioUSD, drawdownPct, pnlPct,
        decisions:    [],
        executed:     0,
        blocked:      0,
        errors:       [`DISQUALIFIED: drawdown ${drawdownPct.toFixed(1)}% ≥ 30%`],
        peakUSD:      peak,
      })
    }

    if (drawdownPct >= DRAWDOWN_PAUSE_PCT) {
      return NextResponse.json({
        success:      true,
        status:       'paused',
        portfolioUSD, drawdownPct, pnlPct,
        decisions:    [],
        executed:     0,
        blocked:      0,
        errors:       [`AUTO-PAUSED: drawdown ${drawdownPct.toFixed(1)}% approaching 30% cap`],
        peakUSD:      peak,
      })
    }

    // ── 4. Fetch signals ─────────────────────────────────────────────────────
    const scanSymbols = symbols.length
      ? symbols.filter((s: string) => ALL_ELIGIBLE_SYMBOLS.includes(s))
      : ALL_ELIGIBLE_SYMBOLS.slice(0, 12)

    const [tokens, fg] = await Promise.all([
      getTokensBySymbols(scanSymbols),
      getFearAndGreed(),
    ])

    const avgVol    = tokens.length
      ? tokens.reduce((s: number, t: any) => s + t.volume24h, 0) / tokens.length
      : undefined

    const snapshots = tokens.map((t: any) => computeSignalSnapshot(t, fg, avgVol))

    // ── 5. Evaluate rules ─────────────────────────────────────────────────────
    const { evaluateRules } = await import('@/lib/signalEngine')
    const fired = evaluateRules(rules, snapshots, Date.now())

    // Forced DCA if no trades today and past hour 22
    const currentHour = new Date().getHours()
    if (tradesToday === 0 && currentHour >= 22 && snapshots.length > 0) {
      const best = [...snapshots].sort((a, b) => b.signalScore - a.signalScore)[0]
      fired.unshift({
        rule: {
          id: 'forced-dca', symbol: best.symbol,
          condition: { type: 'signal_above' as const, value: 0 },
          action: 'BUY' as const, sizePct: 5, priority: 0,
          cooldownMs: 86400000,
        },
        signal: best,
      })
    }

    // ── 6. Execute decisions ──────────────────────────────────────────────────
    const decisions: any[] = []
    let executed = 0, blocked = 0
    const errors: string[] = []

    for (const { rule, signal } of fired) {
      if (tradesToday + executed >= maxDailyTrades) break

      const amountUSDT = (portfolioUSD * rule.sizePct) / 100

      const guardrail = checkCompetitionGuardrails({
        symbol:         rule.symbol,
        portfolioUSD,
        drawdownPct,
        tradesToday:    tradesToday + executed,
        totalTrades:    totalTrades + executed,
        daysElapsed,
        tradeAmountUSD: amountUSDT,
        maxPerTradePct,
        slippagePct,
      })

      const decision: any = {
        ruleId:      rule.id,
        symbol:      rule.symbol,
        action:      rule.action,
        amountUSDT,
        signalScore: signal.signalScore,
        reasoning:   signal.reasoning,
        fearGreed:   fg.value,
        guardrail:   guardrail.allowed ? (guardrail.warning ? 'warning' : 'passed') : 'blocked',
        blockReason: guardrail.reason,
        warning:     guardrail.warning,
        txHash:      null,
        dryRun,
        timestamp:   Date.now(),
      }

      decisions.push(decision)

      if (!guardrail.allowed) { blocked++; continue }
      if (!autonomousMode)    { continue }

      // Live execution
      try {
        const token = ELIGIBLE_TOKENS[rule.symbol]
        if (!token) { errors.push(`No BSC address for ${rule.symbol}`); continue }

        const path = rule.action === 'BUY'
          ? ['0x55d398326f99059fF775485246999027B3197955', token.address]   // USDT → token
          : [token.address, '0x55d398326f99059fF775485246999027B3197955']   // token → USDT

        const amountInWei = rule.action === 'BUY'
          ? ethers.parseUnits(amountUSDT.toFixed(6), 18)
          : ethers.parseUnits((amountUSDT / (signal.price || 1)).toFixed(token.decimals), token.decimals)

        const slip          = slippagePct / 100
        const amountOutMin  = BigInt(Math.floor(Number(amountInWei) * (1 - slip)))

        if (!dryRun) {
          await client.approveToken(path[0], '0x10ED43C718714eb63d5aA57B78B54704E256024E', amountInWei * 2n)
          const result = await client.swapExactTokensForTokens({
            amountIn: amountInWei, amountOutMin, path,
          })
          decision.txHash  = result.txHash
          decision.success = result.success
          if (result.success) executed++
          else errors.push(`Swap failed: ${rule.symbol}`)
        } else {
          decision.success = true
          executed++
        }
      } catch (e: any) {
        errors.push(`${rule.symbol}: ${e.message}`)
      }
    }

    return NextResponse.json({
      success:      true,
      status:       'running',
      portfolioUSD, drawdownPct, pnlPct,
      peakUSD:      peak,
      fearGreed:    fg.value,
      fgLabel:      fg.label,
      decisions,
      executed,
      blocked,
      errors,
      snapshots:    snapshots.map(s => ({
        symbol: s.symbol, signalScore: s.signalScore,
        signalDir: s.signalDir, price: s.price, change24h: s.change24h,
      })),
      portfolioItems,
      cycleAt:      Date.now(),
    })
  } catch (err: any) {
    console.error('[agent/loop]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
