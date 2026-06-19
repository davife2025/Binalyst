// lib/stellar/types.ts
//
// Shared TypeScript types for the Binalyst ZK layer.
// These mirror the Rust types in zk-guest/src/types.rs and the
// Soroban contract's ProofRecord in soroban-verifier/src/lib.rs.

import type { SignalSnapshot, StrategyRule } from '@/lib/signalEngine'
import type { LoopDecision }                 from '@/lib/agentLoop'

// ─────────────────────────────────────────────────────────────────────────────
// Input to the RISC Zero guest (mirrors TradeProofInput in types.rs)
// ─────────────────────────────────────────────────────────────────────────────

export interface ZKProofSignal {
  symbol:       string
  price:        number
  change_24h:   number
  fear_greed:   number
  signal_score: number
  rsi14:        number | null
  macd_hist:    number | null
  macd_cross:   'BULLISH' | 'BEARISH' | 'NONE' | null
  bb_pct:       number | null
  bb_width:     number | null
  adx:          number | null
  stoch_k:      number | null
  obv_trend:    'UP' | 'DOWN' | 'FLAT' | null
  ema_cross:    'BULLISH' | 'BEARISH' | 'MIXED' | null
  tech_score:   number | null
  regime:       string | null
  tags:         string[]
}

export interface ZKProofCondition {
  type: string
  // all optional — the union covers every condition variant
  value?:     number
  tag?:       string
  direction?: string
  regime?:    string
  trend?:     string
  cross?:     string
  threshold?: number
  left?:      ZKProofCondition
  right?:     ZKProofCondition
}

export interface ZKProofRule {
  id:       string
  name:     string
  symbol:   string
  action:   'BUY' | 'SELL'
  size_pct: number
  priority: number
  condition: ZKProofCondition
}

export interface ZKProofDecision {
  symbol:       string
  action:       'BUY' | 'SELL'
  amount_usdt:  number
  signal_score: number
  reasoning:    string
}

export interface ZKGuardrailConfig {
  max_drawdown_pct:  number
  max_per_trade_pct: number
  max_daily_trades:  number
  dry_run:           boolean
}

export interface TradeProofInput {
  signal:        ZKProofSignal
  rule:          ZKProofRule
  decision:      ZKProofDecision
  portfolio_usd: number
  peak_usd:      number
  start_usd:     number
  trades_today:  number
  total_trades:  number
  config:        ZKGuardrailConfig
  decided_at_ms: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Output from the RISC Zero guest (mirrors TradeProofOutput in types.rs)
// ─────────────────────────────────────────────────────────────────────────────

export interface TradeProofOutput {
  valid:            boolean
  symbol:           string
  action:           string
  amount_usdt:      number
  rule_id:          string
  rule_name:        string
  drawdown_pct:     number
  drawdown_ok:      boolean
  trade_size_pct:   number
  trade_size_ok:    boolean
  daily_trades_ok:  boolean
  condition_fired:  boolean
  decided_at_ms:    number
  dry_run:          boolean
  attestation:      string
}

// ─────────────────────────────────────────────────────────────────────────────
// On-chain proof record (mirrors ProofRecord in soroban-verifier/src/lib.rs)
// ─────────────────────────────────────────────────────────────────────────────

export interface StellarProofRecord {
  index:                number
  symbol:               string
  action:               string
  amount_usdt_cents:    number   // amount * 100 (integer storage)
  rule_id:              string
  rule_name:            string
  drawdown_bps:         number   // drawdown% * 100
  dry_run:              boolean
  decided_at_ms:        number
  verified_at_ledger:   number
  receipt_fingerprint:  string   // 8-byte hex
}

// ─────────────────────────────────────────────────────────────────────────────
// API request / response types
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/zk/prove
export interface ZKProveRequest {
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
}

export interface ZKProveResponse {
  success:     boolean
  proofId:     string          // uuid assigned by our API
  output:      TradeProofOutput
  receiptB64:  string          // base64-encoded RISC Zero receipt (seal + journal)
  sealHex:     string          // hex seal for the Soroban contract
  journalHex:  string          // hex journal for the Soroban contract
  elapsedMs:   number
  error?:      string
}

// POST /api/zk/verify
export interface ZKVerifyRequest {
  proofId:    string
  sealHex:    string
  journalHex: string
}

export interface ZKVerifyResponse {
  success:      boolean
  proofId:      string
  stellarTxId:  string | null   // Stellar transaction hash on success
  proofIndex:   number | null   // on-chain proof index
  explorerUrl:  string | null
  error?:       string
}

// ─────────────────────────────────────────────────────────────────────────────
// In-memory proof queue entry (used in ZK store slice)
// ─────────────────────────────────────────────────────────────────────────────

export type ZKProofStatus =
  | 'pending'      // queued, not started
  | 'proving'      // RISC Zero guest running
  | 'proved'       // receipt generated, not yet submitted
  | 'submitting'   // posting to Stellar
  | 'verified'     // on-chain verified ✓
  | 'failed'       // any step failed

export interface ZKProofEntry {
  proofId:      string
  status:       ZKProofStatus
  symbol:       string
  action:       'BUY' | 'SELL'
  amountUSDT:   number
  ruleName:     string
  decidedAt:    number
  output:       TradeProofOutput | null
  sealHex:      string | null
  journalHex:   string | null
  stellarTxId:  string | null
  proofIndex:   number | null
  explorerUrl:  string | null
  elapsedMs:    number | null
  error:        string | null
}
