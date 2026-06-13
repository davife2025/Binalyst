/**
 * lib/agentLoop.ts — Hotfix 12 (complete rewrite, no stale types)
 */

import type { SignalSnapshot } from './signalEngine'
import type { StrategyRule }   from './signalEngine'
import { evaluateRules }       from './signalEngine'
import { COMPETITION_RULES, checkCompetitionGuardrails } from './twak/client'

// Re-export so DrawdownGauge can import from either path
export { COMPETITION_RULES } from './twak/client'

export const LOOP_INTERVAL_MS   = 120_000
export const DAILY_TRADE_HOUR   = 22
export const DRAWDOWN_WARN_PCT  = COMPETITION_RULES.MAX_DRAWDOWN_PCT * 0.8
export const DRAWDOWN_PAUSE_PCT = COMPETITION_RULES.MAX_DRAWDOWN_PCT * 0.93

// ── LoopStatus — ALL 5 variants required ────────────────────────────────────
export type LoopStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'disqualified'
  | 'error'

export interface LoopDecision {
  ruleId:       string
  ruleName:     string
  symbol:       string
  action:       'BUY' | 'SELL'
  amountUSDT:   number
  signalScore:  number
  reasoning:    string
  guardrail:    'passed' | 'blocked' | 'warning'
  blockReason?: string
  warning?:     string
}

export interface LoopCycleResult {
  cycleAt:      number
  decisions:    LoopDecision[]
  executed:     number
  blocked:      number
  errors:       string[]
  portfolioUSD: number
  drawdownPct:  number
  todayTrades:  number
  status:       LoopStatus
}

export interface AgentLoopCallbacks {
  getSignals:      () => Promise<SignalSnapshot[]>
  getRules:        () => StrategyRule[]
  getPortfolioUSD: () => Promise<number>
  getPeakUSD:      () => number
  getStartUSD:     () => number
  getTodayTrades:  () => number
  getTotalTrades:  () => number
  getDaysElapsed:  () => number
  getConfig: () => {
    maxDrawdownPct: number
    maxPerTradePct: number
    maxDailyTrades: number
    slippagePct:    number
    dryRun:         boolean
    autonomousMode: boolean
  }
  onDecision:      (d: LoopDecision) => void
  onCycleComplete: (r: LoopCycleResult) => void
  onStatusChange:  (s: LoopStatus) => void
  executeTradeViaAPI: (params: {
    symbol:         string
    action:         'BUY' | 'SELL'
    amountUSDT:     number
    dryRun:         boolean
    portfolioUSD:   number
    drawdownPct:    number
    tradesToday:    number
    totalTrades:    number
    daysElapsed:    number
    maxPerTradePct: number
    slippagePct:    number
  }) => Promise<{ success: boolean; txHash?: string; message?: string; reason?: string }>
}

export class AgentLoop {
  private timer:           ReturnType<typeof setInterval> | null = null
  private _status:         LoopStatus = 'idle'
  private callbacks:       AgentLoopCallbacks
  private peakUSD:         number = 0
  private lastFiredRuleAt: Record<string, number> = {}

  constructor(callbacks: AgentLoopCallbacks) {
    this.callbacks = callbacks
  }

  get currentStatus(): LoopStatus { return this._status }

  start() {
    if (this.timer) return
    this.setStatus('running')
    this.runCycle()
    this.timer = setInterval(() => this.runCycle(), LOOP_INTERVAL_MS)
  }

  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null }
    this.setStatus('idle')
  }

  pause()  { this.setStatus('paused')  }
  resume() { this.setStatus('running') }

  private async runCycle() {
    if (this._status === 'disqualified') return
    if (this._status === 'paused')       return

    const cb      = this.callbacks
    const config  = cb.getConfig()
    const errors: string[] = []

    // 1. Portfolio + drawdown
    let portfolioUSD = 0
    try {
      portfolioUSD = await cb.getPortfolioUSD()
      if (portfolioUSD > this.peakUSD) this.peakUSD = portfolioUSD
    } catch (e: any) {
      errors.push('Portfolio fetch failed: ' + e.message)
    }

    const startUSD    = cb.getStartUSD()
    const peakUSD     = Math.max(this.peakUSD, startUSD, portfolioUSD)
    const drawdownPct = peakUSD > 0
      ? Math.max(0, ((peakUSD - portfolioUSD) / peakUSD) * 100)
      : 0

    const todayTrades = cb.getTodayTrades()
    const totalTrades = cb.getTotalTrades()
    const daysElapsed = cb.getDaysElapsed()

    // 2. Disqualify check
    if (drawdownPct >= COMPETITION_RULES.MAX_DRAWDOWN_PCT) {
      this.setStatus('disqualified')
      cb.onCycleComplete({
        cycleAt: Date.now(), decisions: [], executed: 0, blocked: 0,
        errors: [`DISQUALIFIED: drawdown ${drawdownPct.toFixed(1)}% >= ${COMPETITION_RULES.MAX_DRAWDOWN_PCT}%`],
        portfolioUSD, drawdownPct, todayTrades, status: 'disqualified',
      })
      return
    }

    // 3. Auto-pause check — use _status not this.status to avoid type narrowing issues
    if (drawdownPct >= DRAWDOWN_PAUSE_PCT && this._status !== ('paused' as LoopStatus)) {
      this.setStatus('paused')
      errors.push(`AUTO-PAUSED: drawdown ${drawdownPct.toFixed(1)}% approaching ${COMPETITION_RULES.MAX_DRAWDOWN_PCT}% cap`)
      cb.onCycleComplete({
        cycleAt: Date.now(), decisions: [], executed: 0, blocked: 0,
        errors, portfolioUSD, drawdownPct, todayTrades, status: 'paused',
      })
      return
    }

    // 4. Signals
    let signals: SignalSnapshot[] = []
    try {
      signals = await cb.getSignals()
    } catch (e: any) {
      errors.push('Signal fetch failed: ' + e.message)
    }

    if (!signals.length) {
      cb.onCycleComplete({
        cycleAt: Date.now(), decisions: [], executed: 0, blocked: 0,
        errors: [...errors, 'No signals available'],
        portfolioUSD, drawdownPct, todayTrades, status: this._status,
      })
      return
    }

    // 5. Evaluate rules
    const rules = cb.getRules()
    const now   = Date.now()
    const fired = evaluateRules(rules, signals, now)

    // 6. Forced DCA if 0 trades today past hour 22
    const currentHour = new Date().getHours()
    if (todayTrades === 0 && currentHour >= DAILY_TRADE_HOUR && signals.length > 0) {
      const best = [...signals].sort((a, b) => b.signalScore - a.signalScore)[0]
      fired.unshift({
        rule: {
          id: 'forced-dca', symbol: best.symbol,
          condition: { type: 'signal_above' as const, value: 0 },
          action: 'BUY' as const, sizePct: 5, priority: 0, cooldownMs: 86400000,
        },
        signal: best,
      })
    }

    // 7. Execute decisions
    const decisions: LoopDecision[] = []
    let executed = 0, blocked = 0

    for (const { rule, signal } of fired) {
      const lastFired = this.lastFiredRuleAt[rule.id]
      if (lastFired && now - lastFired < rule.cooldownMs) continue
      if (todayTrades + executed >= config.maxDailyTrades) break

      const amountUSDT = (portfolioUSD * rule.sizePct) / 100

      const guardrail = checkCompetitionGuardrails({
        symbol:         rule.symbol,
        portfolioUSD,
        drawdownPct,
        tradesToday:    todayTrades + executed,
        totalTrades:    totalTrades + executed,
        daysElapsed,
        tradeAmountUSD: amountUSDT,
        maxPerTradePct: config.maxPerTradePct,
        slippagePct:    config.slippagePct,
      })

      const decision: LoopDecision = {
        ruleId:      rule.id,
        ruleName:    `${rule.symbol} ${rule.action}`,
        symbol:      rule.symbol,
        action:      rule.action as 'BUY' | 'SELL',
        amountUSDT,
        signalScore: signal.signalScore,
        reasoning:   signal.reasoning,
        guardrail:   guardrail.allowed ? (guardrail.warning ? 'warning' : 'passed') : 'blocked',
        blockReason: guardrail.reason,
        warning:     guardrail.warning,
      }

      cb.onDecision(decision)
      decisions.push(decision)

      if (!guardrail.allowed) { blocked++; continue }
      if (!config.autonomousMode) continue

      try {
        const result = await cb.executeTradeViaAPI({
          symbol:         rule.symbol,
          action:         rule.action as 'BUY' | 'SELL',
          amountUSDT,
          dryRun:         config.dryRun,
          portfolioUSD,
          drawdownPct,
          tradesToday:    todayTrades + executed,
          totalTrades:    totalTrades + executed,
          daysElapsed,
          maxPerTradePct: config.maxPerTradePct,
          slippagePct:    config.slippagePct,
        })
        if (result.success) {
          executed++
          this.lastFiredRuleAt[rule.id] = now
        } else {
          errors.push(`${rule.symbol} ${rule.action} failed: ${result.reason ?? result.message}`)
        }
      } catch (e: any) {
        errors.push(`Execute error: ${e.message}`)
      }
    }

    cb.onCycleComplete({
      cycleAt: now, decisions, executed, blocked, errors,
      portfolioUSD, drawdownPct, todayTrades: todayTrades + executed,
      status: this._status,
    })
  }

  private setStatus(s: LoopStatus) {
    this._status = s
    this.callbacks.onStatusChange(s)
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function computeDrawdown(startUSD: number, peakUSD: number, currentUSD: number): number {
  const peak = Math.max(peakUSD, startUSD)
  if (peak <= 0) return 0
  return Math.max(0, ((peak - currentUSD) / peak) * 100)
}

export function computePnLPct(startUSD: number, currentUSD: number): number {
  if (startUSD <= 0) return 0
  return ((currentUSD - startUSD) / startUSD) * 100
}

export function formatDrawdownColor(pct: number): string {
  if (pct >= DRAWDOWN_PAUSE_PCT) return 'var(--red)'
  if (pct >= DRAWDOWN_WARN_PCT)  return 'var(--yellow)'
  return 'var(--green)'
}

export function tradeCountStatus(
  today: number, total: number, daysElapsed: number
): { label: string; color: string; ok: boolean } {
  const minTotal = Math.min(daysElapsed + 1, COMPETITION_RULES.MIN_TRADES_TOTAL)
  if (today >= COMPETITION_RULES.MIN_TRADES_PER_DAY && total >= minTotal)
    return { label: 'On track', color: 'var(--green)', ok: true }
  if (total < minTotal * 0.5)
    return { label: 'At risk',  color: 'var(--red)',   ok: false }
  return   { label: 'Watch',    color: 'var(--yellow)', ok: false }
}
