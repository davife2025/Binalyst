/**
 * lib/signalEngine.ts
 * Signal aggregation engine — Session B.
 * Combines Fear & Greed, price momentum, volume, and trend data
 * into a single scored trade signal per token.
 *
 * Output feeds both the UI (SignalDashboard) and the agent decision loop (Session C+).
 */

import type { CMCSignal, FearAndGreed, CMCToken } from './skills/cmc'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SignalSnapshot {
  symbol:       string
  price:        number
  change1h:     number
  change24h:    number
  change7d:     number
  volume24h:    number
  marketCap:    number
  fearGreed:    number
  fgLabel:      string
  momentum:     number        // -100 to +100
  volumeSpike:  number        // ratio vs avg (1.0 = normal, 2.0 = 2x avg)
  trendScore:   number        // 0–100 directional strength
  signalScore:  number        // 0–100 composite buy signal
  signalDir:    'BUY' | 'SELL' | 'HOLD'
  confidence:   'HIGH' | 'MEDIUM' | 'LOW'
  reasoning:    string
  tags:         SignalTag[]
  updatedAt:    number
}

export type SignalTag =
  | 'extreme_fear'
  | 'extreme_greed'
  | 'volume_spike'
  | 'strong_momentum'
  | 'reversal_watch'
  | 'dca_zone'
  | 'overbought'
  | 'oversold'
  | 'breakout'
  | 'trending_cmc'

export interface SignalSummary {
  bullishCount:  number
  bearishCount:  number
  neutralCount:  number
  avgScore:      number
  topBuy:        SignalSnapshot | null
  topSell:       SignalSnapshot | null
  fearGreed:     FearAndGreed
  updatedAt:     number
}

// ─────────────────────────────────────────────────────────────────────────────
// Core signal computation
// ─────────────────────────────────────────────────────────────────────────────

export function computeSignalSnapshot(
  token: CMCToken,
  fg: FearAndGreed,
  avgVolume24h?: number,         // optional historical avg for volume spike detection
  trendingRank?: number,         // CMC trending rank (lower = more trending)
): SignalSnapshot {

  // 1. Momentum: weighted combo of 1h, 24h, 7d changes
  const momentum = clamp(
    token.change1h  * 3 +    // 1h is highest signal weight
    token.change24h * 1 +
    token.change7d  * 0.2,
    -100, 100
  )

  // 2. Volume spike ratio
  const volumeSpike = avgVolume24h && avgVolume24h > 0
    ? token.volume24h / avgVolume24h
    : 1.0

  // 3. Trend score (0–100): how directionally consistent the moves are
  const allSameDir =
    (token.change1h > 0 && token.change24h > 0 && token.change7d > 0) ||
    (token.change1h < 0 && token.change24h < 0 && token.change7d < 0)
  const trendScore = clamp(
    allSameDir
      ? 60 + Math.abs(token.change24h) * 2
      : 40 - Math.abs(token.change24h),
    0, 100
  )

  // 4. Fear & Greed bias
  // Extreme fear → contrarian buy signal boost
  // Extreme greed → sell pressure boost
  const fgBias =
    fg.value <= 20 ?  25 :
    fg.value <= 30 ?  15 :
    fg.value <= 44 ?   5 :
    fg.value <= 55 ?   0 :
    fg.value <= 70 ?  -5 :
    fg.value <= 80 ? -15 : -25

  // 5. Trending rank boost (if in CMC trending top 20)
  const trendBoost = trendingRank != null && trendingRank <= 20
    ? Math.max(0, 10 - trendingRank * 0.4)
    : 0

  // 6. Volume spike boost
  const volBoost = volumeSpike >= 3 ? 10 : volumeSpike >= 2 ? 5 : 0

  // 7. Composite signal score
  const rawScore =
    50 +
    momentum * 0.4 +
    fgBias +
    trendBoost +
    volBoost

  const signalScore = clamp(rawScore, 0, 100)

  // 8. Direction & confidence
  let signalDir: 'BUY' | 'SELL' | 'HOLD' = 'HOLD'
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW'

  if (signalScore >= 68) { signalDir = 'BUY';  confidence = signalScore >= 82 ? 'HIGH' : 'MEDIUM' }
  if (signalScore <= 32) { signalDir = 'SELL'; confidence = signalScore <= 18 ? 'HIGH' : 'MEDIUM' }

  // 9. Tags
  const tags: SignalTag[] = buildTags(token, fg, momentum, volumeSpike, trendingRank)

  // 10. Reasoning
  const reasoning = buildReasoning(token, fg, momentum, volumeSpike, signalDir, trendingRank)

  return {
    symbol:      token.symbol,
    price:       token.price,
    change1h:    token.change1h,
    change24h:   token.change24h,
    change7d:    token.change7d,
    volume24h:   token.volume24h,
    marketCap:   token.marketCap,
    fearGreed:   fg.value,
    fgLabel:     fg.label,
    momentum,
    volumeSpike,
    trendScore,
    signalScore,
    signalDir,
    confidence,
    reasoning,
    tags,
    updatedAt:   Date.now(),
  }
}

export function computeSummary(
  signals: SignalSnapshot[],
  fg: FearAndGreed,
): SignalSummary {
  const buys  = signals.filter(s => s.signalDir === 'BUY')
  const sells = signals.filter(s => s.signalDir === 'SELL')
  const holds = signals.filter(s => s.signalDir === 'HOLD')
  const avg   = signals.length
    ? signals.reduce((a, b) => a + b.signalScore, 0) / signals.length
    : 50

  const topBuy  = buys.sort((a, b) => b.signalScore - a.signalScore)[0]  ?? null
  const topSell = sells.sort((a, b) => a.signalScore - b.signalScore)[0] ?? null

  return {
    bullishCount: buys.length,
    bearishCount: sells.length,
    neutralCount: holds.length,
    avgScore:     avg,
    topBuy,
    topSell,
    fearGreed:    fg,
    updatedAt:    Date.now(),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Strategy rule evaluator (used by agent in Sessions C+)
// ─────────────────────────────────────────────────────────────────────────────

export interface StrategyRule {
  id:        string
  symbol:    string
  condition: StrategyCondition
  action:    'BUY' | 'SELL' | 'HOLD'
  sizePct:   number            // % of portfolio to deploy
  priority:  number
  cooldownMs: number           // min ms between triggers
  lastFiredAt?: number
}

export type StrategyCondition =
  | { type: 'fear_below';       value: number }
  | { type: 'fear_above';       value: number }
  | { type: 'signal_above';     value: number }
  | { type: 'signal_below';     value: number }
  | { type: 'change24h_above';  value: number }
  | { type: 'change24h_below';  value: number }
  | { type: 'price_above';      value: number }
  | { type: 'price_below';      value: number }
  | { type: 'tag_includes';     tag: SignalTag }
  | { type: 'and'; left: StrategyCondition; right: StrategyCondition }
  | { type: 'or';  left: StrategyCondition; right: StrategyCondition }

export function evaluateCondition(
  cond: StrategyCondition,
  signal: SignalSnapshot,
): boolean {
  switch (cond.type) {
    case 'fear_below':      return signal.fearGreed < cond.value
    case 'fear_above':      return signal.fearGreed > cond.value
    case 'signal_above':    return signal.signalScore > cond.value
    case 'signal_below':    return signal.signalScore < cond.value
    case 'change24h_above': return signal.change24h > cond.value
    case 'change24h_below': return signal.change24h < cond.value
    case 'price_above':     return signal.price > cond.value
    case 'price_below':     return signal.price < cond.value
    case 'tag_includes':    return signal.tags.includes(cond.tag)
    case 'and':             return evaluateCondition(cond.left, signal) && evaluateCondition(cond.right, signal)
    case 'or':              return evaluateCondition(cond.left, signal) || evaluateCondition(cond.right, signal)
    default:                return false
  }
}

export function evaluateRules(
  rules: StrategyRule[],
  signals: SignalSnapshot[],
  now = Date.now(),
): Array<{ rule: StrategyRule; signal: SignalSnapshot }> {
  const fired: Array<{ rule: StrategyRule; signal: SignalSnapshot }> = []

  for (const rule of rules.filter(r => r.action !== 'HOLD').sort((a, b) => b.priority - a.priority)) {
    // Cooldown check
    if (rule.lastFiredAt && now - rule.lastFiredAt < rule.cooldownMs) continue

    const signal = signals.find(s => s.symbol === rule.symbol)
    if (!signal) continue

    if (evaluateCondition(rule.condition, signal)) {
      fired.push({ rule, signal })
    }
  }

  return fired
}

// ─────────────────────────────────────────────────────────────────────────────
// Natural-language strategy parser (Session C uses full AI, this is the fast path)
// ─────────────────────────────────────────────────────────────────────────────

export function parseSimpleStrategy(text: string): StrategyRule[] {
  const rules: StrategyRule[] = []
  const lines = text.split('\n').filter(l => l.trim())

  for (const line of lines) {
    const l = line.toLowerCase()
    // e.g. "buy BTC when fear < 25"
    const buyMatch  = l.match(/buy\s+(\w+)\s+when\s+fear\s*[<≤]\s*(\d+)/)
    const sellMatch = l.match(/sell\s+(\w+)\s+when\s+fear\s*[>≥]\s*(\d+)/)
    const sigBuy    = l.match(/buy\s+(\w+)\s+when\s+signal\s*[>≥]\s*(\d+)/)
    const sigSell   = l.match(/sell\s+(\w+)\s+when\s+signal\s*[<≤]\s*(\d+)/)
    const sizeMatch = l.match(/(\d+)%/)

    const sizePct = sizeMatch ? parseInt(sizeMatch[1]) : 10

    if (buyMatch) {
      rules.push({
        id: crypto.randomUUID(), symbol: buyMatch[1].toUpperCase(),
        condition: { type: 'fear_below', value: parseInt(buyMatch[2]) },
        action: 'BUY', sizePct, priority: rules.length, cooldownMs: 3600000,
      })
    }
    if (sellMatch) {
      rules.push({
        id: crypto.randomUUID(), symbol: sellMatch[1].toUpperCase(),
        condition: { type: 'fear_above', value: parseInt(sellMatch[2]) },
        action: 'SELL', sizePct, priority: rules.length, cooldownMs: 3600000,
      })
    }
    if (sigBuy) {
      rules.push({
        id: crypto.randomUUID(), symbol: sigBuy[1].toUpperCase(),
        condition: { type: 'signal_above', value: parseInt(sigBuy[2]) },
        action: 'BUY', sizePct, priority: rules.length, cooldownMs: 3600000,
      })
    }
    if (sigSell) {
      rules.push({
        id: crypto.randomUUID(), symbol: sigSell[1].toUpperCase(),
        condition: { type: 'signal_below', value: parseInt(sigSell[2]) },
        action: 'SELL', sizePct, priority: rules.length, cooldownMs: 3600000,
      })
    }
  }

  return rules
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function buildTags(
  token: CMCToken,
  fg: FearAndGreed,
  momentum: number,
  volumeSpike: number,
  trendingRank?: number,
): SignalTag[] {
  const tags: SignalTag[] = []
  if (fg.value <= 20)                tags.push('extreme_fear')
  if (fg.value >= 80)                tags.push('extreme_greed')
  if (volumeSpike >= 2.5)            tags.push('volume_spike')
  if (Math.abs(momentum) >= 50)      tags.push('strong_momentum')
  if (token.change24h <= -15)        tags.push('oversold')
  if (token.change24h >= 15)         tags.push('overbought')
  if (fg.value <= 25 && momentum > 10) tags.push('dca_zone')
  if (trendingRank != null && trendingRank <= 10) tags.push('trending_cmc')
  // Reversal watch: big 24h move + opposing 1h
  if (Math.abs(token.change24h) > 10 &&
      Math.sign(token.change1h) !== Math.sign(token.change24h)) {
    tags.push('reversal_watch')
  }
  return tags
}

function buildReasoning(
  token: CMCToken,
  fg: FearAndGreed,
  momentum: number,
  volumeSpike: number,
  dir: string,
  trendingRank?: number,
): string {
  const parts: string[] = []
  parts.push(`${token.symbol}: ${dir}.`)
  parts.push(`24h ${token.change24h >= 0 ? '+' : ''}${token.change24h.toFixed(2)}%, 1h ${token.change1h >= 0 ? '+' : ''}${token.change1h.toFixed(2)}%.`)
  parts.push(`F&G ${fg.value} (${fg.label}).`)
  if (volumeSpike >= 2)  parts.push(`Volume spike ${volumeSpike.toFixed(1)}x.`)
  if (fg.value <= 25)    parts.push('Extreme fear = contrarian buy window.')
  if (fg.value >= 75)    parts.push('Extreme greed = elevated risk.')
  if (Math.abs(momentum) >= 50) parts.push(`Strong momentum (${momentum.toFixed(0)}).`)
  if (trendingRank != null && trendingRank <= 10) parts.push(`CMC trending #${trendingRank}.`)
  return parts.join(' ')
}
