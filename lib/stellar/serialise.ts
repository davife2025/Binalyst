// lib/stellar/serialise.ts
//
// Converts Binalyst's TypeScript types (SignalSnapshot, StrategyRule,
// LoopDecision) into the JSON shape the RISC Zero guest expects
// (TradeProofInput with snake_case fields).

import type { SignalSnapshot, StrategyRule, StrategyCondition } from '@/lib/signalEngine'
import type { LoopDecision }  from '@/lib/agentLoop'
import type {
  TradeProofInput,
  ZKProofSignal,
  ZKProofRule,
  ZKProofDecision,
  ZKGuardrailConfig,
  ZKProofCondition,
} from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Build TradeProofInput from Binalyst runtime state
// ─────────────────────────────────────────────────────────────────────────────

export function buildTradeProofInput(params: {
  signal:       SignalSnapshot
  rule:         StrategyRule
  decision:     LoopDecision
  portfolioUSD: number
  peakUSD:      number
  startUSD:     number
  tradesToday:  number
  totalTrades:  number
  config: {
    maxDrawdownPct:  number
    maxPerTradePct:  number
    maxDailyTrades:  number
    dryRun:          boolean
  }
}): TradeProofInput {
  const { signal, rule, decision, portfolioUSD, peakUSD, startUSD,
          tradesToday, totalTrades, config } = params

  return {
    signal:        serialiseSignal(signal),
    rule:          serialiseRule(rule),
    decision:      serialiseDecision(decision),
    portfolio_usd: portfolioUSD,
    peak_usd:      peakUSD,
    start_usd:     startUSD,
    trades_today:  tradesToday,
    total_trades:  totalTrades,
    config:        serialiseConfig(config),
    decided_at_ms: Date.now(),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Signal serialisation
// ─────────────────────────────────────────────────────────────────────────────

function serialiseSignal(s: SignalSnapshot): ZKProofSignal {
  const t = s.technicals
  return {
    symbol:       s.symbol,
    price:        s.price,
    change_24h:   s.change24h,
    fear_greed:   s.fearGreed,
    signal_score: s.signalScore,

    // Technical fields — null when technicals not available
    rsi14:      t?.rsi14      ?? null,
    macd_hist:  t?.macdHist   ?? null,
    macd_cross: t?.macdCross  ?? null,
    bb_pct:     t?.bbPct      ?? null,
    bb_width:   t?.bbWidth    ?? null,
    adx:        t?.adx        ?? null,
    stoch_k:    t?.stochK     ?? null,
    obv_trend:  t?.obvTrend   ?? null,
    ema_cross:  t?.emaCross   ?? null,
    tech_score: t?.techScore  ?? null,
    regime:     t?.regime     ?? null,

    // Tags as plain strings (SignalTag is a string union)
    tags: s.tags as string[],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule serialisation
// ─────────────────────────────────────────────────────────────────────────────

function serialiseRule(r: StrategyRule): ZKProofRule {
  return {
    id:        r.id,
    name:      `${r.symbol} ${r.action}`,
    symbol:    r.symbol,
    action:    r.action as 'BUY' | 'SELL',
    size_pct:  r.sizePct,
    priority:  r.priority,
    condition: serialiseCondition(r.condition),
  }
}

function serialiseCondition(c: StrategyCondition): ZKProofCondition {
  // The StrategyCondition union uses camelCase; the Rust guest uses snake_case.
  // We pass the `type` field through directly (already snake_case in TS).
  switch (c.type) {
    case 'fear_below':
    case 'fear_above':
    case 'signal_above':
    case 'signal_below':
    case 'change24h_above':
    case 'change24h_below':
    case 'price_above':
    case 'price_below':
    case 'rsi_above':
    case 'rsi_below':
    case 'macd_hist_above':
    case 'macd_hist_below':
    case 'bb_pct_above':
    case 'bb_pct_below':
    case 'adx_above':
    case 'adx_below':
    case 'tech_score_above':
    case 'tech_score_below':
      return { type: c.type, value: c.value }

    case 'tag_includes':
      return { type: c.type, tag: c.tag as string }

    case 'macd_cross':
    case 'stoch_cross':
      return { type: c.type, direction: c.direction }

    case 'bb_squeeze':
      return { type: c.type, threshold: (c as any).threshold ?? (c as any).value }

    case 'bb_breakout':
    case 'near_support':
    case 'near_resistance':
      return { type: c.type }

    case 'regime_is':
      return { type: c.type, regime: (c as any).regime }

    case 'obv_trend':
      return { type: c.type, trend: (c as any).trend }

    case 'ema_cross':
      return { type: c.type, cross: (c as any).cross }

    case 'and':
      return {
        type:  'and',
        left:  serialiseCondition(c.left),
        right: serialiseCondition(c.right),
      }

    case 'or':
      return {
        type:  'or',
        left:  serialiseCondition(c.left),
        right: serialiseCondition(c.right),
      }

    default:
      // Passthrough for any future condition types
      return c as unknown as ZKProofCondition
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Decision serialisation
// ─────────────────────────────────────────────────────────────────────────────

function serialiseDecision(d: LoopDecision): ZKProofDecision {
  return {
    symbol:       d.symbol,
    action:       d.action,
    amount_usdt:  d.amountUSDT,
    signal_score: d.signalScore,
    reasoning:    d.reasoning,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Config serialisation
// ─────────────────────────────────────────────────────────────────────────────

function serialiseConfig(c: {
  maxDrawdownPct:  number
  maxPerTradePct:  number
  maxDailyTrades:  number
  dryRun:          boolean
}): ZKGuardrailConfig {
  return {
    max_drawdown_pct:  c.maxDrawdownPct,
    max_per_trade_pct: c.maxPerTradePct,
    max_daily_trades:  c.maxDailyTrades,
    dry_run:           c.dryRun,
  }
}
