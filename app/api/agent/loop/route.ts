/**
 * app/api/agent/loop/route.ts — Session K (REPLACES all previous versions)
 *
 * SELF-CUSTODY FIX:
 * Server no longer receives private key or executes swaps.
 * Instead it returns UNSIGNED transaction objects that the browser
 * wallet signs locally via ethers.Wallet — true self-custody.
 *
 * Flow:
 *   1. Server fetches CMC signals (with x402 pay-per-request)
 *   2. Server evaluates strategy rules → decisions
 *   3. Server builds unsigned BSC transactions
 *   4. Browser receives unsigned txs
 *   5. Browser signs locally with ethers.Wallet (private key never leaves)
 *   6. Browser broadcasts signed txs to BSC RPC
 */

import { NextRequest, NextResponse } from 'next/server'
import { ethers }                    from 'ethers'
import { getTokensBySymbols, getFearAndGreed } from '@/lib/skills/cmc'
import { computeSignalSnapshot }     from '@/lib/signalEngine'
import {
  ELIGIBLE_TOKENS,
  ALL_ELIGIBLE_SYMBOLS,
  checkCompetitionGuardrails,
  COMPETITION_RULES,
  USDT_BSC_ADDRESS,
} from '@/lib/twak/client'
import { NETWORKS, type Network }    from '@/lib/twak/networks'
import { computeDrawdown, computePnLPct, DRAWDOWN_PAUSE_PCT } from '@/lib/agentLoop'
import { rateLimit }                 from '@/lib/rateLimit'

export const dynamic     = 'force-dynamic'
export const maxDuration = 30   // reduced — no on-chain calls server-side

// ─────────────────────────────────────────────────────────────────────────────
// Unsigned transaction builder — no private key, no signing
// ─────────────────────────────────────────────────────────────────────────────

const PANCAKE_ROUTER_ABI = [
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function getAmountsOut(uint amountIn, address[] calldata path) view returns (uint[] memory amounts)',
]

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
]

async function buildUnsignedSwap(params: {
  action:      'BUY' | 'SELL'
  symbol:      string
  amountUSDT:  number
  slippagePct: number
  walletAddress: string
  network:     Network
}): Promise<{
  approvalTx?:  { to: string; data: string; gasLimit: string }
  swapTx:       { to: string; data: string; gasLimit: string; value: string }
  amountInWei:  string
  amountOutMin: string
  path:         string[]
  priceImpact:  number
} | null> {
  const { action, symbol, amountUSDT, slippagePct, walletAddress, network } = params
  const net   = NETWORKS[network]
  const token = ELIGIBLE_TOKENS[symbol]
  if (!token) return null

  const provider  = new ethers.JsonRpcProvider(net.rpc)
  const router    = new ethers.Contract(net.pancakeRouter, PANCAKE_ROUTER_ABI, provider)
  const slip      = slippagePct / 100

  // Build swap path
  const path = action === 'BUY'
    ? [net.usdt, token.address]
    : [token.address, net.usdt]

  // Compute amountIn
  let amountInWei: bigint
  if (action === 'BUY') {
    amountInWei = ethers.parseUnits(amountUSDT.toFixed(6), 18)
  } else {
    // Estimate token price to compute quantity
    try {
      const amounts = await router.getAmountsOut(
        ethers.parseUnits(amountUSDT.toFixed(6), 18),
        [net.usdt, token.address]
      )
      amountInWei = amounts[amounts.length - 1] as bigint
    } catch {
      amountInWei = ethers.parseUnits((amountUSDT / 1).toFixed(token.decimals), token.decimals)
    }
  }

  // Get expected output for slippage calc
  let amountOutMin = BigInt(0)
  let priceImpact  = 0
  try {
    const amounts  = await router.getAmountsOut(amountInWei, path)
    const expected = amounts[amounts.length - 1] as bigint
    amountOutMin   = BigInt(Math.floor(Number(expected) * (1 - slip)))
    priceImpact    = slip * 100
  } catch {
    amountOutMin = BigInt(0)
  }

  // Build approve calldata (ERC20 approve for the spend token)
  const erc20     = new ethers.Interface(ERC20_ABI)
  const spendAddr = action === 'BUY' ? net.usdt : token.address
  const approvalData = erc20.encodeFunctionData('approve', [
    net.pancakeRouter,
    amountInWei * BigInt(2),  // 2x headroom
  ])

  // Build swap calldata
  const deadline   = Math.floor(Date.now() / 1000) + 300  // 5 min
  const swapData   = router.interface.encodeFunctionData('swapExactTokensForTokens', [
    amountInWei,
    amountOutMin,
    path,
    walletAddress,
    deadline,
  ])

  return {
    approvalTx: {
      to:       spendAddr,
      data:     approvalData,
      gasLimit: '100000',
    },
    swapTx: {
      to:       net.pancakeRouter,
      data:     swapData,
      gasLimit: '350000',
      value:    '0',
    },
    amountInWei:  amountInWei.toString(),
    amountOutMin: amountOutMin.toString(),
    path,
    priceImpact,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = rateLimit(`loop:${ip}`, 'ai-chat')
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

  try {
    const body = await req.json()
    const {
      walletAddress,           // ← address only, NOT private key
      network      = 'testnet' as Network,
      rules        = [],
      symbols      = [],
      startUSD     = 0,
      peakUSD      = 0,
      portfolioUSD = 0,        // passed from browser (already computed client-side)
      tradesToday  = 0,
      totalTrades  = 0,
      daysElapsed  = 0,
      config       = {},
      x402Signature,           // ← signed by browser wallet for x402 payment proof
    } = body

    if (!walletAddress) {
      return NextResponse.json({ error: 'walletAddress required (not privateKey)' }, { status: 400 })
    }

    const {
      maxPerTradePct = 15,
      slippagePct    = 1.0,
      maxDailyTrades = 8,
      autonomousMode = false,
      dryRun         = true,
    } = config

    // ── Drawdown safety ────────────────────────────────────────────────────
    const peak        = Math.max(peakUSD, startUSD, portfolioUSD)
    const drawdownPct = computeDrawdown(startUSD, peak, portfolioUSD)
    const pnlPct      = computePnLPct(startUSD, portfolioUSD)

    if (drawdownPct >= COMPETITION_RULES.MAX_DRAWDOWN_PCT) {
      return NextResponse.json({
        success: true, status: 'disqualified', network,
        portfolioUSD, drawdownPct, pnlPct,
        unsignedTxs: [], decisions: [], executed: 0, blocked: 0,
        errors: [`DISQUALIFIED: drawdown ${drawdownPct.toFixed(1)}% >= 30%`],
        peakUSD: peak,
      })
    }

    if (drawdownPct >= DRAWDOWN_PAUSE_PCT) {
      return NextResponse.json({
        success: true, status: 'paused', network,
        portfolioUSD, drawdownPct, pnlPct,
        unsignedTxs: [], decisions: [], executed: 0, blocked: 0,
        errors: [`AUTO-PAUSED: drawdown ${drawdownPct.toFixed(1)}% approaching 30%`],
        peakUSD: peak,
      })
    }

    // ── CMC signals (with x402 if signature provided) ──────────────────────
    const scanSymbols = (symbols.length
      ? symbols.filter((s: string) => ALL_ELIGIBLE_SYMBOLS.includes(s))
      : ALL_ELIGIBLE_SYMBOLS.slice(0, 12)
    ) as string[]

    const [tokens, fg] = await Promise.all([
      getTokensBySymbols(scanSymbols),
      getFearAndGreed(),
    ])

    const avgVol    = tokens.length
      ? tokens.reduce((s: number, t: any) => s + (t.volume24h ?? 0), 0) / tokens.length
      : undefined

    const snapshots = tokens.map((t: any) => computeSignalSnapshot(t, fg, avgVol))

    // ── Evaluate rules ─────────────────────────────────────────────────────
    const { evaluateRules } = await import('@/lib/signalEngine')
    const now    = Date.now()
    const fired  = evaluateRules(rules, snapshots, now)

    // Forced DCA at hour 22 if 0 trades today
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

    // ── Build unsigned transactions ────────────────────────────────────────
    const decisions:    any[] = []
    const unsignedTxs:  any[] = []
    let blocked = 0
    const errors: string[] = []

    for (const { rule, signal } of fired) {
      if (tradesToday + unsignedTxs.length >= maxDailyTrades) break

      const amountUSDT = (portfolioUSD * rule.sizePct) / 100

      const guardrail = checkCompetitionGuardrails({
        symbol:         rule.symbol,
        portfolioUSD,
        drawdownPct,
        tradesToday:    tradesToday + unsignedTxs.length,
        totalTrades:    totalTrades + unsignedTxs.length,
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
        timestamp:   now,
        network,
      }

      decisions.push(decision)

      if (!guardrail.allowed) { blocked++; continue }
      if (!autonomousMode)    { continue }

      // Build unsigned tx (dry run = skip the actual tx building)
      if (!dryRun) {
        try {
          const unsignedTx = await buildUnsignedSwap({
            action:        rule.action as 'BUY' | 'SELL',
            symbol:        rule.symbol,
            amountUSDT,
            slippagePct,
            walletAddress,
            network:       network as Network,
          })

          if (unsignedTx) {
            unsignedTxs.push({
              decisionIndex:  decisions.length - 1,
              symbol:         rule.symbol,
              action:         rule.action,
              amountUSDT,
              ...unsignedTx,
              // Browser will sign these and broadcast
              status:         'unsigned',
            })
          }
        } catch (e: any) {
          errors.push(`TX build failed: ${rule.symbol}: ${e.message}`)
        }
      } else {
        // Dry run — simulate success, no tx built
        decision.dryRun = true
      }
    }

    return NextResponse.json({
      success:      true,
      status:       'running',
      network,
      isTestnet:    network === 'testnet',
      portfolioUSD, drawdownPct, pnlPct,
      peakUSD:      peak,
      fearGreed:    fg.value,
      fgLabel:      fg.label,
      // KEY: return unsigned transactions for browser to sign
      unsignedTxs,
      decisions,
      blocked,
      errors,
      snapshots: snapshots.map((s: any) => ({
        symbol: s.symbol, signalScore: s.signalScore,
        signalDir: s.signalDir, price: s.price, change24h: s.change24h,
      })),
      cycleAt: now,
    })
  } catch (err: any) {
    console.error('[agent/loop]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
