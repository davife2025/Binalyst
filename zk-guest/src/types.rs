// zk-guest/src/types.rs
//
// Shared types for the RISC Zero guest program.
// These mirror the TypeScript types in:
//   lib/signalEngine.ts  — StrategyCondition, StrategyRule, SignalSnapshot
//   lib/agentLoop.ts     — LoopDecision, guardrail config
//   lib/twak/client.ts   — COMPETITION_RULES
//
// The host (Next.js API) serialises these to JSON and writes them to the
// guest's stdin via risc0_zkvm::serde.  The guest reads, evaluates, and
// commits the TradeProofOutput to the journal.

use serde::{Deserialize, Serialize};

// ─────────────────────────────────────────────────────────────────────────────
// Market / signal snapshot (subset of SignalSnapshot we actually prove)
// ─────────────────────────────────────────────────────────────────────────────

/// Reduced signal snapshot — only the fields referenced by StrategyCondition.
/// Keeping it minimal limits the proof size and guest cycle count.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProofSignal {
    pub symbol:       String,
    pub price:        f64,
    pub change_24h:   f64,
    pub fear_greed:   f64,   // 0–100
    pub signal_score: f64,   // 0–100 composite

    // Technical fields (present when technicals were computed)
    pub rsi14:        Option<f64>,
    pub macd_hist:    Option<f64>,
    pub macd_cross:   Option<String>,  // "BULLISH" | "BEARISH" | "NONE"
    pub bb_pct:       Option<f64>,     // 0 = lower band, 1 = upper band
    pub bb_width:     Option<f64>,     // squeeze indicator
    pub adx:          Option<f64>,
    pub stoch_k:      Option<f64>,
    pub obv_trend:    Option<String>,  // "UP" | "DOWN" | "FLAT"
    pub ema_cross:    Option<String>,  // "BULLISH" | "BEARISH" | "MIXED"
    pub tech_score:   Option<f64>,
    pub regime:       Option<String>,  // "TRENDING_UP" | "TRENDING_DOWN" | "RANGING" | "FLAT"
    pub tags:         Vec<String>,     // e.g. ["near_support", "volume_spike"]
}

// ─────────────────────────────────────────────────────────────────────────────
// Strategy condition (mirrors StrategyCondition union in signalEngine.ts)
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Condition {
    // ── Sentiment / CMC ───────────────────────────────────────────────────
    FearBelow      { value: f64 },
    FearAbove      { value: f64 },
    SignalAbove    { value: f64 },
    SignalBelow    { value: f64 },
    Change24hAbove { value: f64 },
    Change24hBelow { value: f64 },
    PriceAbove     { value: f64 },
    PriceBelow     { value: f64 },
    TagIncludes    { tag: String },

    // ── Technical ─────────────────────────────────────────────────────────
    RsiAbove       { value: f64 },
    RsiBelow       { value: f64 },
    MacdCross      { direction: String },   // "BULLISH" | "BEARISH"
    MacdHistAbove  { value: f64 },
    MacdHistBelow  { value: f64 },
    BbPctAbove     { value: f64 },
    BbPctBelow     { value: f64 },
    BbSqueeze      { threshold: f64 },
    BbBreakout,
    RegimeIs       { regime: String },
    AdxAbove       { value: f64 },
    AdxBelow       { value: f64 },
    StochCross     { direction: String },
    ObvTrend       { trend: String },
    EmaCross       { cross: String },
    TechScoreAbove { value: f64 },
    TechScoreBelow { value: f64 },
    NearSupport,
    NearResistance,

    // ── Logical combinators ───────────────────────────────────────────────
    And { left: Box<Condition>, right: Box<Condition> },
    Or  { left: Box<Condition>, right: Box<Condition> },
}

// ─────────────────────────────────────────────────────────────────────────────
// Strategy rule
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProofRule {
    pub id:          String,
    pub name:        String,
    pub symbol:      String,
    pub action:      String,    // "BUY" | "SELL" | "HOLD"
    pub size_pct:    f64,       // % of portfolio per trade
    pub priority:    i32,
    pub condition:   Condition,
}

// ─────────────────────────────────────────────────────────────────────────────
// Risk guardrail config (mirrors COMPETITION_RULES + AgentLoopCallbacks config)
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuardrailConfig {
    pub max_drawdown_pct:  f64,   // disqualify if exceeded  (default: 30.0)
    pub max_per_trade_pct: f64,   // max trade size as % of portfolio (default: 15.0)
    pub max_daily_trades:  u32,   // hard cap per day (default: 8)
    pub dry_run:           bool,  // true = simulation, no real funds
}

impl Default for GuardrailConfig {
    fn default() -> Self {
        Self {
            max_drawdown_pct:  30.0,
            max_per_trade_pct: 15.0,
            max_daily_trades:  8,
            dry_run:           true,
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Guest INPUT — everything the prover needs
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradeProofInput {
    /// The live signal snapshot for the symbol being traded.
    pub signal: ProofSignal,

    /// The strategy rule that fired and produced this decision.
    pub rule: ProofRule,

    /// The trade decision produced by the agent loop.
    pub decision: ProofDecision,

    /// Portfolio state at the moment of decision.
    pub portfolio_usd:   f64,
    pub peak_usd:        f64,   // all-time high this session (for drawdown calc)
    pub start_usd:       f64,   // starting portfolio value
    pub trades_today:    u32,
    pub total_trades:    u32,

    /// Risk configuration in force at decision time.
    pub config: GuardrailConfig,

    /// Wall-clock timestamp (Unix ms) — committed to journal for audit.
    pub decided_at_ms: u64,
}

/// The trade decision the agent loop produced — what we're proving was valid.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProofDecision {
    pub symbol:       String,
    pub action:       String,   // "BUY" | "SELL"
    pub amount_usdt:  f64,
    pub signal_score: f64,
    pub reasoning:    String,
}

// ─────────────────────────────────────────────────────────────────────────────
// Guest OUTPUT — committed to the journal and read by the Soroban verifier
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradeProofOutput {
    /// true = every check passed; false = at least one guardrail failed.
    pub valid: bool,

    // ── Decision summary (public inputs for the verifier) ─────────────────
    pub symbol:       String,
    pub action:       String,
    pub amount_usdt:  f64,
    pub rule_id:      String,
    pub rule_name:    String,

    // ── Guardrail results ─────────────────────────────────────────────────
    pub drawdown_pct:        f64,
    pub drawdown_ok:         bool,   // drawdown_pct < max_drawdown_pct
    pub trade_size_pct:      f64,    // amount_usdt / portfolio_usd * 100
    pub trade_size_ok:       bool,   // trade_size_pct <= max_per_trade_pct
    pub daily_trades_ok:     bool,   // trades_today < max_daily_trades
    pub condition_fired:     bool,   // the rule's condition evaluated to true

    // ── Audit ─────────────────────────────────────────────────────────────
    pub decided_at_ms:  u64,
    pub dry_run:        bool,

    /// Human-readable summary of what the proof attests.
    pub attestation: String,
}
