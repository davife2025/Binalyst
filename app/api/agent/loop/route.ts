/**
 * app/api/agent/loop/route.ts — Session I (Bug Fix Release)
 *
 * Fix: Instant disqualification on start.
 *
 * Root cause: getPortfolioValueUSD() can return 0 for several reasons:
 *   - RPC timeout or error (caught, portfolioUSD stays 0)
 *   - Wallet has no tokens yet (legitimate 0 balance)
 *   - Testnet with no liquidity
 *
 * When portfolioUSD=0 but peakUSD/startUSD are non-zero (any session after
 * the first cycle), computeDrawdown returns (peak - 0) / peak = 100%, which
 * immediately fires the disqualification block.
 *
 * Fix: if portfolioUSD comes back as 0 (or below a $0.01 dust threshold),
 * fall back to startUSD for BOTH mainnet and testnet — not just testnet.
 * This means a failed portfolio fetch is treated as "no change" rather than
 * "total loss", which is the correct safe default.
 *
 * Secondary fix: the disqualification and pause blocks now also guard against
 * portfolioUSD=0 so a bad fetch can never trigger safety rails.
 */

import { NextRequest, NextResponse }   from 'next/server'
import { ethers }                      from 'ethers'
import { NetworkTWAKClient }           from '@/lib/twak/networkClient'
import { NETWORKS, type Network }      from '@/lib/twak/networks'
import { ELIGIBLE_TOKENS, ALL_ELIGIBLE_SYMBOLS, checkCompetitionGuardrails } from '@/lib/twak/client'
import { getTokensBySymbols, getFearAndGreed } from '@/lib/skills/cmc'
import { computeSignalSnapshot }       from '@/lib/signalEngine'
import { computeDrawdown, computePnLPct, DRAWDOWN_PAUSE_PCT } from '@/lib/agentLoop'
import { COMPETITION_RULES }           from '@/lib/twak/client'
import { rateLimit }                   from '@/lib/rateLimit'

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
      network     = 'testnet' as Network,
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

    const net    = NETWORKS[network as Network] ?? NETWORKS.testnet
    const client = new NetworkTWAKClient(privateKey, network as Network)

    // ── 1. Portfolio value ────────────────────────────────────────────────────
    const holdingSymbols = symbols.length
      ? symbols.filter((s: string) => ALL_ELIGIBLE_SYMBOLS.includes(s))
      : ['USDT', 'FDUSD', 'ETH', 'BNB']

    const holdings = holdingSymbols
      .map((sym: string) => ELIGIBLE_TOKENS[sym])
      .filter(Boolean)

    let portfolioUSD   = 0
    let portfolioFetchOk = false
    let portfolioItems: any[] = []

    try {
      const pv       = await client.getPortfolioValueUSD(holdings)
      portfolioUSD   = pv.totalUSD
      portfolioItems = pv.items
      portfolioFetchOk = true
    } catch {
      // fetch failed — portfolioUSD stays 0, handled below
    }

    // ── Portfolio fallback ────────────────────────────────────────────────────
    // If the fetch failed OR returned dust (< $0.01), use the best available
    // estimate so drawdown is not computed against a false zero.
    //
    // Priority:
    //   1. Actual fetched value (if > $0.01)
    //   2. startUSD from the session (safe — means "no change since start")
    //   3. 100 as a last resort so a brand-new session doesn't disqualify
    //
    // This applies to BOTH mainnet and testnet — the original code only had
    // the testnet guard, leaving mainnet exposed to the 100% drawdown bug.
    const portfolioFallback = startUSD > 0 ? startUSD : 100
    if (!portfolioFetchOk || portfolioUSD < 0.01) {
      portfolioUSD = portfolioFallback
    }

    // ── 2. Drawdown ────────────────────────────────────────────────────────────
    const peak        = Math.max(peakUSD, startUSD, portfolioUSD)
    const drawdownPct = computeDrawdown(startUSD, peak, portfolioUSD)
    const pnlPct      = computePnLPct(startUSD, portfolioUSD)

    // ── 3. Safety checks ───────────────────────────────────────────────────────
    // Guard: only fire safety rails when we have a real portfolio reading.
    // portfolioFetchOk=false means we're working from an estimate — don't
    // disqualify or pause based on estimated values.
    if (portfolioFetchOk) {
      if (drawdownPct >= COMPETITION_RULES.MAX_DRAWDOWN_PCT) {
        return NextResponse.json({
          success: true, status: 'disqualified', network,
          portfolioUSD, drawdownPct, pnlPct,
          decisions: [], executed: 0, blocked: 0,
          errors: [`DISQUALIFIED: drawdown ${drawdownPct.toFixed(1)}% ≥ ${COMPETITION_RULES.MAX_DRAWDOWN_PCT}%`],
          peakUSD: peak,
        })
      }

      if (drawdownPct >= DRAWDOWN_PAUSE_PCT) {
        return NextResponse.json({
          success: true, status: 'paused', network,
          portfolioUSD, drawdownPct, pnlPct,
          decisions: [], executed: 0, blocked: 0,
          errors: [`AUTO-PAUSED: drawdown ${drawdownPct.toFixed(1)}% approaching ${COMPETITION_RULES.MAX_DRAWDOWN_PCT}%`],
          peakUSD: peak,
        })
      }
    }

    // ── 4. Signals ─────────────────────────────────────────────────────────────
    const scanSymbols = symbols.length
      ? symbols.filter((s: string) => ALL_ELIGIBLE_SYMBOLS.includes(s))
      : ALL_ELIGIBLE_SYMBOLS.slice(0, 12)

    const [tokens, fg] = await Promise.all([
      getTokensBySymbols(scanSymbols),
      getFearAndGreed(),
    ])

    const avgVol  = tokens.length
      ? tokens.reduce((s: number, t: any) => s + t.volume24h, 0) / tokens.length
      : undefined
    const snapshots = tokens.map((t: any) => computeSignalSnapshot(t, fg, avgVol))

    // ── 5. Evaluate rules ──────────────────────────────────────────────────────
    const { evaluateRules } = await import('@/lib/signalEngine')
    const fired = evaluateRules(rules, snapshots, Date.now())

    // Forced DCA if 0 trades today and past 22:00
    const currentHour = new Date().getHours()
    if (tradesToday === 0 && currentHour >= 22 && snapshots.length > 0) {
      const best = [...snapshots].sort((a, b) => b.signalScore - a.signalScore)[0]
      fired.unshift({
        rule: {
          id: 'forced-dca', symbol: best.symbol,
          condition: { type: 'signal_above' as const, value: 0 },
          action: 'BUY' as const, sizePct: 5, priority: 0, cooldownMs: 86400000,
        },
        signal: best,
      })
    }

    // ── 6. Execute ─────────────────────────────────────────────────────────────
    const decisions: any[] = []
    let executed = 0, blocked = 0
    const errors: string[] = []

    for (const { rule, signal } of fired) {
      if (tradesToday + executed >= maxDailyTrades) break

      const amountUSDT = (portfolioUSD * rule.sizePct) / 100

      const guardrail = checkCompetitionGuardrails({
        symbol: rule.symbol, portfolioUSD, drawdownPct,
        tradesToday: tradesToday + executed,
        totalTrades: totalTrades + executed,
        daysElapsed, tradeAmountUSD: amountUSDT,
        maxPerTradePct, slippagePct,
      })

      const decision: any = {
        ruleId: rule.id, symbol: rule.symbol, action: rule.action,
        ruleName: `${rule.symbol} ${rule.action}`,
        amountUSDT, signalScore: signal.signalScore, reasoning: signal.reasoning,
        fearGreed: fg.value,
        guardrail: guardrail.allowed ? (guardrail.warning ? 'warning' : 'passed') : 'blocked',
        blockReason: guardrail.reason, warning: guardrail.warning,
        txHash: null, dryRun, network, timestamp: Date.now(),
        executed: false,
      }
      decisions.push(decision)

      if (!guardrail.allowed) { blocked++; continue }
      if (!autonomousMode)    { continue }

      // Live execution
      try {
        const token = ELIGIBLE_TOKENS[rule.symbol]
        if (!token) { errors.push(`No address for ${rule.symbol}`); continue }

        const usdtAddr = net.usdt
        const path     = rule.action === 'BUY'
          ? [usdtAddr, token.address]
          : [token.address, usdtAddr]

        const amountInWei = rule.action === 'BUY'
          ? ethers.parseUnits(amountUSDT.toFixed(6), 18)
          : ethers.parseUnits(
              (amountUSDT / Math.max(signal.price, 0.000001)).toFixed(token.decimals),
              token.decimals
            )

        if (!dryRun) {
          const amounts    = await client.getAmountsOut(amountInWei, path)
          const expected   = amounts[amounts.length - 1]
          const slip       = slippagePct / 100
          const outMin     = BigInt(Math.floor(Number(expected) * (1 - slip)))

          await client.approveToken(path[0], net.pancakeRouter, amountInWei * BigInt(2))
          const result = await client.swapExactTokensForTokens({
            amountIn: amountInWei, amountOutMin: outMin, path,
          })
          decision.txHash        = result.txHash
          decision.success       = result.success
          decision.explorerLink  = result.txHash ? client.explorerTx(result.txHash) : null
          if (result.success) {
            executed++
            decision.executed = true
          } else {
            errors.push(`Swap failed: ${rule.symbol} on ${network}`)
          }
        } else {
          // Dry run — simulate success
          decision.success  = true
          decision.dryRun   = true
          decision.executed = true
          executed++
        }
      } catch (e: any) {
        errors.push(`${rule.symbol}: ${e.message}`)
      }
    }

    return NextResponse.json({
      success: true, status: 'running', network,
      isTestnet: net.isTestnet,
      portfolioUSD, drawdownPct, pnlPct, peakUSD: peak,
      fearGreed: fg.value, fgLabel: fg.label,
      decisions, executed, blocked, errors,
      snapshots: snapshots.map(s => ({
        symbol: s.symbol, signalScore: s.signalScore,
        signalDir: s.signalDir, price: s.price, change24h: s.change24h,
        fearGreed:  fg.value,
        technicals: s.technicals ?? null,
        tags:       s.tags ?? [],
      })),
      portfolioItems, cycleAt: Date.now(),
    })
  } catch (err: any) {
    console.error('[agent/loop]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}