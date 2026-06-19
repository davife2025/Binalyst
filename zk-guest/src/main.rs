// zk-guest/src/main.rs
//
// RISC Zero guest program for Binalyst ZK trade proofs.
//
// What this proves (inside the zkVM — verifiably):
//   1. The strategy rule's condition evaluated to TRUE on the provided signal.
//   2. The trade decision (symbol, action, amount) is consistent with the rule.
//   3. All risk guardrails were respected at decision time:
//        • Portfolio drawdown < max_drawdown_pct
//        • Per-trade size  <= max_per_trade_pct of portfolio
//        • Daily trade count < max_daily_trades
//
// The output (TradeProofOutput) is committed to the RISC Zero journal.
// The Soroban verifier contract (Session P) reads the journal and checks it.
//
// Build:
//   cargo risczero build          # produces ELF + image_id
//
// The host (lib/stellar/prover.ts in Session Q) spawns this binary,
// feeds TradeProofInput via stdin (JSON), and reads the receipt from stdout.

#![no_main]

use risc0_zkvm::guest::env;

mod conditions;
mod types;

use types::{GuardrailConfig, TradeProofInput, TradeProofOutput};

risc0_zkvm::guest::entry!(main);

fn main() {
    // ── Read input from the host ──────────────────────────────────────────────
    // The host writes a JSON-encoded TradeProofInput to the guest's stdin.
    let input_bytes: Vec<u8> = env::read();
    let input: TradeProofInput =
        serde_json::from_slice(&input_bytes).expect("Failed to deserialise TradeProofInput");

    // ── Evaluate ──────────────────────────────────────────────────────────────
    let output = evaluate(input);

    // ── Commit output to the journal ──────────────────────────────────────────
    // The journal is the public output of the proof — it gets included in the
    // RISC Zero receipt that the Soroban verifier contract reads on-chain.
    let output_bytes = serde_json::to_vec(&output).expect("Failed to serialise TradeProofOutput");
    env::commit_slice(&output_bytes);
}

// ─────────────────────────────────────────────────────────────────────────────
// Core evaluation — all logic runs inside the zkVM
// ─────────────────────────────────────────────────────────────────────────────

fn evaluate(input: TradeProofInput) -> TradeProofOutput {
    let cfg = &input.config;

    // ── 1. Did the rule's condition actually fire? ─────────────────────────────
    let condition_fired = conditions::evaluate(&input.rule.condition, &input.signal);

    // ── 2. Drawdown check ─────────────────────────────────────────────────────
    // drawdown = (peak - current) / peak * 100
    let drawdown_pct = if input.peak_usd > 0.0 {
        ((input.peak_usd - input.portfolio_usd) / input.peak_usd) * 100.0
    } else {
        0.0
    };
    let drawdown_ok = drawdown_pct < cfg.max_drawdown_pct;

    // ── 3. Per-trade size check ────────────────────────────────────────────────
    let trade_size_pct = if input.portfolio_usd > 0.0 {
        (input.decision.amount_usdt / input.portfolio_usd) * 100.0
    } else {
        0.0
    };
    let trade_size_ok = trade_size_pct <= cfg.max_per_trade_pct;

    // ── 4. Daily trade count check ────────────────────────────────────────────
    // trades_today counts trades already executed today BEFORE this one.
    let daily_trades_ok = input.trades_today < cfg.max_daily_trades;

    // ── 5. Decision consistency check ─────────────────────────────────────────
    // The decision's symbol and action must match the rule that fired.
    let decision_matches_rule =
        input.decision.symbol == input.rule.symbol
        && input.decision.action == input.rule.action;

    // ── 6. Overall validity ───────────────────────────────────────────────────
    let valid = condition_fired
        && drawdown_ok
        && trade_size_ok
        && daily_trades_ok
        && decision_matches_rule;

    // ── 7. Build attestation string ───────────────────────────────────────────
    let attestation = build_attestation(
        &input,
        condition_fired,
        drawdown_pct,
        drawdown_ok,
        trade_size_pct,
        trade_size_ok,
        daily_trades_ok,
        decision_matches_rule,
        valid,
    );

    TradeProofOutput {
        valid,
        symbol:          input.decision.symbol.clone(),
        action:          input.decision.action.clone(),
        amount_usdt:     input.decision.amount_usdt,
        rule_id:         input.rule.id.clone(),
        rule_name:       input.rule.name.clone(),
        drawdown_pct,
        drawdown_ok,
        trade_size_pct,
        trade_size_ok,
        daily_trades_ok,
        condition_fired,
        decided_at_ms:   input.decided_at_ms,
        dry_run:         cfg.dry_run,
        attestation,
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Attestation string builder
// ─────────────────────────────────────────────────────────────────────────────

fn build_attestation(
    input:              &TradeProofInput,
    condition_fired:    bool,
    drawdown_pct:       f64,
    drawdown_ok:        bool,
    trade_size_pct:     f64,
    trade_size_ok:      bool,
    daily_trades_ok:    bool,
    decision_matches:   bool,
    valid:              bool,
) -> String {
    let cfg = &input.config;
    let status = if valid { "VALID" } else { "INVALID" };

    let mut parts: Vec<String> = vec![
        format!(
            "[Binalyst ZK v1] {} | {} {} {:.2} USDT | rule: \"{}\" | ts: {}",
            status,
            input.decision.action,
            input.decision.symbol,
            input.decision.amount_usdt,
            input.rule.name,
            input.decided_at_ms,
        ),
        format!(
            "condition_fired={} | drawdown={:.2}%/{:.0}%_ok={} | size={:.2}%/{:.0}%_ok={} | daily_trades={}/{}_ok={} | rule_match={}",
            condition_fired,
            drawdown_pct, cfg.max_drawdown_pct, drawdown_ok,
            trade_size_pct, cfg.max_per_trade_pct, trade_size_ok,
            input.trades_today, cfg.max_daily_trades, daily_trades_ok,
            decision_matches,
        ),
    ];

    if !valid {
        let mut failures: Vec<&str> = vec![];
        if !condition_fired    { failures.push("condition did not fire") }
        if !drawdown_ok        { failures.push("drawdown limit exceeded") }
        if !trade_size_ok      { failures.push("trade size exceeds limit") }
        if !daily_trades_ok    { failures.push("daily trade cap reached") }
        if !decision_matches   { failures.push("decision does not match rule") }
        parts.push(format!("FAILURES: {}", failures.join("; ")));
    }

    if cfg.dry_run {
        parts.push("DRY_RUN=true (simulation — no real funds moved)".to_string());
    }

    parts.join(" | ")
}
