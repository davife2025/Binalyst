/**
 * lib/suiAgent/agentLoop.ts
 * Sui autonomous agent loop — Session J.
 *
 * This is the parallel Sui agent. It runs independently from
 * the existing Binalyst agent (lib/agentLoop.ts) and does NOT
 * import from it or share any state with it.
 *
 * Architecture (mirrors Binalyst's AgentLoop interface pattern):
 *   1. Fetch signal snapshots (provided via callbacks — same signals, new consumer)
 *   2. Score signals against config thresholds
 *   3. For each qualifying signal → guardrail check → execute on Sui
 *   4. Log decision to Walrus memory (Session L: MemWal writes added here)
 *   5. Report cycle result via onCycleComplete callback
 *
 * ISOLATION GUARANTEE:
 *   - No import from lib/agentLoop.ts
 *   - No import from lib/store.ts
 *   - No import from lib/agentStore.ts
 *   - No import from lib/binance.ts or lib/twak/
 *   - Only imports: lib/sui/types.ts, lib/sui/client.ts
 */

import type {
  SuiAgentConfig,
  SuiAgentDecision,
  SuiAgentSession,
  SuiAgentStatus,
  SuiCycleResult,
  SuiSignalSnapshot,
} from '../sui/types'
import { DEFAULT_SUI_AGENT_CONFIG } from '../sui/types'

export { DEFAULT_SUI_AGENT_CONFIG }

// ─────────────────────────────────────────────────────────────────────────────
// Callback interface (dependency injection — keeps the loop testable)
// ─────────────────────────────────────────────────────────────────────────────

export interface SuiAgentCallbacks {
  /** Return current signal snapshots (can reuse the existing CMC signal feed) */
  getSignals: () => Promise<SuiSignalSnapshot[]>

  /** Return current agent config */
  getConfig: () => SuiAgentConfig

  /** Return agent wallet address (or null if not connected) */
  getWalletAddress: () => string | null

  /** Execute a trade on Sui (dry-run or live) */
  executeTrade: (params: {
    symbol:    string
    action:    'BUY' | 'SELL'
    amountUSD: number
    dryRun:    boolean
  }) => Promise<{ success: boolean; txDigest?: string; error?: string }>

  /** Called for each decision made in a cycle */
  onDecision: (d: SuiAgentDecision) => void

  /** Called at the end of each cycle with the full result */
  onCycleComplete: (r: SuiCycleResult) => void

  /** Called whenever agent status changes */
  onStatusChange: (s: SuiAgentStatus) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// SuiAgentLoop
// ─────────────────────────────────────────────────────────────────────────────

export class SuiAgentLoop {
  private timer:     ReturnType<typeof setInterval> | null = null
  private status:    SuiAgentStatus = 'idle'
  private callbacks: SuiAgentCallbacks
  private session:   Omit<SuiAgentSession, 'status' | 'walletAddress' | 'network'>

  constructor(callbacks: SuiAgentCallbacks) {
    this.callbacks = callbacks
    this.session = {
      startedAt:      null,
      lastCycleAt:    null,
      cycleCount:     0,
      tradesExecuted: 0,
      tradesBlocked:  0,
      errors:         [],
    }
  }

  get currentStatus(): SuiAgentStatus { return this.status }

  get sessionStats() { return { ...this.session, status: this.status } }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  start() {
    if (this.timer) return
    const config = this.callbacks.getConfig()

    this.session.startedAt = Date.now()
    this.session.errors    = []

    this.setStatus('running')
    this.runCycle()
    this.timer = setInterval(() => this.runCycle(), config.cycleIntervalMs)
  }

  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null }
    this.setStatus('stopped')
  }

  pause()  {
    if (this.status === 'running') this.setStatus('paused')
  }

  resume() {
    if (this.status === 'paused') {
      this.setStatus('running')
      this.runCycle()
    }
  }

  // ── Core cycle ──────────────────────────────────────────────────────────────

  private async runCycle() {
    if (this.status !== 'running') return

    const cb      = this.callbacks
    const config  = cb.getConfig()
    const errors: string[] = []

    this.session.cycleCount++
    this.session.lastCycleAt = Date.now()

    // ── 1. Wallet check ────────────────────────────────────────────────────
    const walletAddress = cb.getWalletAddress()
    if (!walletAddress && !config.dryRun) {
      const err = 'No Sui wallet connected — cycle skipped (set dryRun=true to run without wallet)'
      errors.push(err)
      this.session.errors = [...this.session.errors.slice(-19), err]
      cb.onCycleComplete({
        cycleAt: Date.now(), decisions: [], executed: 0, blocked: 0,
        errors, status: this.status,
      })
      return
    }

    // ── 2. Fetch signals ────────────────────────────────────────────────────
    let signals: SuiSignalSnapshot[] = []
    try {
      signals = await cb.getSignals()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`Signal fetch failed: ${msg}`)
    }

    // Filter to allowed symbols
    const allowed = signals.filter(s =>
      config.allowedSymbols.length === 0 ||
      config.allowedSymbols.includes(s.symbol)
    )

    // ── 3. Score and decide ─────────────────────────────────────────────────
    const decisions: SuiAgentDecision[] = []
    let executed = 0
    let blocked  = 0

    for (const signal of allowed) {
      // Skip if below threshold
      if (signal.signalScore < config.minSignalScore && signal.signalDir !== 'SELL') continue
      if (signal.signalDir === 'HOLD') continue

      const action: 'BUY' | 'SELL' = signal.signalDir === 'SELL' ? 'SELL' : 'BUY'
      const amountUSD = config.maxTradeUSD

      // Guardrail: don't exceed maxTradeUSD
      if (amountUSD <= 0) {
        const reason = 'Trade amount is zero — skipped'
        decisions.push({
          symbol: signal.symbol, action, amountUSD, signalScore: signal.signalScore,
          reasoning: signal.reasoning, blocked: true, blockReason: reason,
          timestamp: Date.now(),
        })
        blocked++
        cb.onDecision(decisions[decisions.length - 1])
        continue
      }

      const decision: SuiAgentDecision = {
        symbol:      signal.symbol,
        action,
        amountUSD,
        signalScore: signal.signalScore,
        reasoning:   signal.reasoning,
        blocked:     false,
        timestamp:   Date.now(),
      }

      if (!config.autonomousMode) {
        // Manual mode — decision logged, not executed
        decision.blocked     = true
        decision.blockReason = 'Autonomous mode off — logged only'
        blocked++
        cb.onDecision(decision)
        decisions.push(decision)
        continue
      }

      // ── 4. Execute ─────────────────────────────────────────────────────────
      try {
        const result = await cb.executeTrade({
          symbol: signal.symbol, action, amountUSD, dryRun: config.dryRun,
        })

        if (result.success) {
          decision.txDigest = result.txDigest
          executed++
          this.session.tradesExecuted++
        } else {
          decision.blocked     = true
          decision.blockReason = result.error ?? 'Execution failed'
          blocked++
          this.session.tradesBlocked++
          errors.push(`${signal.symbol} ${action} failed: ${result.error}`)
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        decision.blocked     = true
        decision.blockReason = msg
        blocked++
        errors.push(`Execute error: ${msg}`)
      }

      cb.onDecision(decision)
      decisions.push(decision)
    }

    // ── 5. Report ───────────────────────────────────────────────────────────
    if (errors.length) {
      this.session.errors = [...this.session.errors.slice(-(20 - errors.length)), ...errors]
    }

    cb.onCycleComplete({
      cycleAt: Date.now(),
      decisions,
      executed,
      blocked,
      errors,
      status: this.status,
    })
  }

  private setStatus(s: SuiAgentStatus) {
    this.status = s
    this.callbacks.onStatusChange(s)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Format a SUI balance for display */
export function formatSUI(amount: number): string {
  return `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} SUI`
}

/** Map Binalyst SignalSnapshot to SuiSignalSnapshot (used in Session K wiring) */
export function adaptSignalSnapshot(s: {
  symbol: string; price: number; change24h: number; change1h: number
  signalScore: number; signalDir: string; confidence: string; reasoning: string
  fearGreed: number; momentum: number; updatedAt: number
}): SuiSignalSnapshot {
  return {
    symbol:      s.symbol,
    price:       s.price,
    change24h:   s.change24h,
    change1h:    s.change1h,
    signalScore: s.signalScore,
    signalDir:   s.signalDir as 'BUY' | 'SELL' | 'HOLD',
    confidence:  s.confidence as 'HIGH' | 'MEDIUM' | 'LOW',
    reasoning:   s.reasoning,
    fearGreed:   s.fearGreed,
    momentum:    s.momentum,
    updatedAt:   s.updatedAt,
  }
}
