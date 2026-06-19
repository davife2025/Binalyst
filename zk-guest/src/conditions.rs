// zk-guest/src/conditions.rs
//
// Mirrors evaluateCondition() from lib/signalEngine.ts — line-for-line logic.
//
// Every condition type in the TypeScript union has a 1-to-1 counterpart here.
// The match arms are commented with the TS equivalent for traceability.
// This runs inside the zkVM — no I/O, no allocator beyond std.

use crate::types::{Condition, ProofSignal};

/// Evaluate a strategy condition against a signal snapshot.
/// Returns true if the condition is satisfied.
pub fn evaluate(cond: &Condition, signal: &ProofSignal) -> bool {
    match cond {
        // ── Sentiment / CMC (Session B conditions) ────────────────────────
        // TS: case 'fear_below': return signal.fearGreed < cond.value
        Condition::FearBelow { value } => signal.fear_greed < *value,

        // TS: case 'fear_above': return signal.fearGreed > cond.value
        Condition::FearAbove { value } => signal.fear_greed > *value,

        // TS: case 'signal_above': return signal.signalScore > cond.value
        Condition::SignalAbove { value } => signal.signal_score > *value,

        // TS: case 'signal_below': return signal.signalScore < cond.value
        Condition::SignalBelow { value } => signal.signal_score < *value,

        // TS: case 'change24h_above': return signal.change24h > cond.value
        Condition::Change24hAbove { value } => signal.change_24h > *value,

        // TS: case 'change24h_below': return signal.change24h < cond.value
        Condition::Change24hBelow { value } => signal.change_24h < *value,

        // TS: case 'price_above': return signal.price > cond.value
        Condition::PriceAbove { value } => signal.price > *value,

        // TS: case 'price_below': return signal.price < cond.value
        Condition::PriceBelow { value } => signal.price < *value,

        // TS: case 'tag_includes': return signal.tags.includes(cond.tag)
        Condition::TagIncludes { tag } => signal.tags.contains(tag),

        // ── Technical (Session J conditions) ──────────────────────────────
        // TS: case 'rsi_above': return t ? t.rsi14 > cond.value : false
        Condition::RsiAbove { value } => {
            signal.rsi14.map_or(false, |v| v > *value)
        }

        // TS: case 'rsi_below': return t ? t.rsi14 < cond.value : false
        Condition::RsiBelow { value } => {
            signal.rsi14.map_or(false, |v| v < *value)
        }

        // TS: case 'macd_cross': return t ? t.macdCross === cond.direction : false
        Condition::MacdCross { direction } => {
            signal.macd_cross.as_deref().map_or(false, |v| v == direction)
        }

        // TS: case 'macd_hist_above': return t ? t.macdHist > cond.value : false
        Condition::MacdHistAbove { value } => {
            signal.macd_hist.map_or(false, |v| v > *value)
        }

        // TS: case 'macd_hist_below': return t ? t.macdHist < cond.value : false
        Condition::MacdHistBelow { value } => {
            signal.macd_hist.map_or(false, |v| v < *value)
        }

        // TS: case 'bb_pct_above': return t ? t.bbPct > cond.value : false
        Condition::BbPctAbove { value } => {
            signal.bb_pct.map_or(false, |v| v > *value)
        }

        // TS: case 'bb_pct_below': return t ? t.bbPct < cond.value : false
        Condition::BbPctBelow { value } => {
            signal.bb_pct.map_or(false, |v| v < *value)
        }

        // TS: case 'bb_squeeze': return t ? t.bbWidth < cond.threshold : false
        Condition::BbSqueeze { threshold } => {
            signal.bb_width.map_or(false, |v| v < *threshold)
        }

        // TS: case 'bb_breakout': return t ? (t.bbPct > 1 || t.bbPct < 0) : false
        Condition::BbBreakout => {
            signal.bb_pct.map_or(false, |v| v > 1.0 || v < 0.0)
        }

        // TS: case 'regime_is': return t ? t.regime === cond.regime : false
        Condition::RegimeIs { regime } => {
            signal.regime.as_deref().map_or(false, |v| v == regime)
        }

        // TS: case 'adx_above': return t ? t.adx > cond.value : false
        Condition::AdxAbove { value } => {
            signal.adx.map_or(false, |v| v > *value)
        }

        // TS: case 'adx_below': return t ? t.adx < cond.value : false
        Condition::AdxBelow { value } => {
            signal.adx.map_or(false, |v| v < *value)
        }

        // TS: case 'stoch_cross':
        //   return t ? (cond.direction === 'BULLISH'
        //     ? t.stochK > 20 && t.stochK < 80
        //     : t.stochK > 80) : false
        Condition::StochCross { direction } => {
            signal.stoch_k.map_or(false, |k| {
                if direction == "BULLISH" {
                    k > 20.0 && k < 80.0
                } else {
                    k > 80.0
                }
            })
        }

        // TS: case 'obv_trend': return t ? t.obvTrend === cond.trend : false
        Condition::ObvTrend { trend } => {
            signal.obv_trend.as_deref().map_or(false, |v| v == trend)
        }

        // TS: case 'ema_cross': return t ? t.emaCross === cond.cross : false
        Condition::EmaCross { cross } => {
            signal.ema_cross.as_deref().map_or(false, |v| v == cross)
        }

        // TS: case 'tech_score_above': return t ? t.techScore > cond.value : false
        Condition::TechScoreAbove { value } => {
            signal.tech_score.map_or(false, |v| v > *value)
        }

        // TS: case 'tech_score_below': return t ? t.techScore < cond.value : false
        Condition::TechScoreBelow { value } => {
            signal.tech_score.map_or(false, |v| v < *value)
        }

        // TS: case 'near_support': return !!signal.tags.includes('near_support')
        Condition::NearSupport => signal.tags.contains(&"near_support".to_string()),

        // TS: case 'near_resistance': return !!signal.tags.includes('near_resistance')
        Condition::NearResistance => signal.tags.contains(&"near_resistance".to_string()),

        // ── Logical combinators ────────────────────────────────────────────
        // TS: case 'and': return evaluateCondition(cond.left, signal) && evaluateCondition(cond.right, signal)
        Condition::And { left, right } => {
            evaluate(left, signal) && evaluate(right, signal)
        }

        // TS: case 'or': return evaluateCondition(cond.left, signal) || evaluateCondition(cond.right, signal)
        Condition::Or { left, right } => {
            evaluate(left, signal) || evaluate(right, signal)
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests — run with: cargo test (outside zkVM, for fast iteration)
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::ProofSignal;

    fn base_signal() -> ProofSignal {
        ProofSignal {
            symbol:       "BTC".to_string(),
            price:        65_000.0,
            change_24h:   2.5,
            fear_greed:   35.0,
            signal_score: 72.0,
            rsi14:        Some(28.5),
            macd_hist:    Some(120.0),
            macd_cross:   Some("BULLISH".to_string()),
            bb_pct:       Some(0.15),
            bb_width:     Some(0.04),
            adx:          Some(38.0),
            stoch_k:      Some(25.0),
            obv_trend:    Some("UP".to_string()),
            ema_cross:    Some("BULLISH".to_string()),
            tech_score:   Some(76.0),
            regime:       Some("TRENDING_UP".to_string()),
            tags:         vec!["near_support".to_string(), "volume_spike".to_string()],
        }
    }

    #[test]
    fn fear_below_true()  { assert!(evaluate(&Condition::FearBelow { value: 50.0 }, &base_signal())) }
    #[test]
    fn fear_below_false() { assert!(!evaluate(&Condition::FearBelow { value: 30.0 }, &base_signal())) }

    #[test]
    fn rsi_below_true()  { assert!(evaluate(&Condition::RsiBelow { value: 30.0 }, &base_signal())) }
    #[test]
    fn rsi_below_false() { assert!(!evaluate(&Condition::RsiBelow { value: 20.0 }, &base_signal())) }

    #[test]
    fn macd_cross_bullish() {
        assert!(evaluate(
            &Condition::MacdCross { direction: "BULLISH".to_string() },
            &base_signal(),
        ))
    }

    #[test]
    fn bb_pct_below_true()  { assert!(evaluate(&Condition::BbPctBelow { value: 0.2 }, &base_signal())) }
    #[test]
    fn bb_breakout_false()  { assert!(!evaluate(&Condition::BbBreakout, &base_signal())) }

    #[test]
    fn regime_is_trending_up() {
        assert!(evaluate(
            &Condition::RegimeIs { regime: "TRENDING_UP".to_string() },
            &base_signal(),
        ))
    }

    #[test]
    fn and_both_true() {
        let cond = Condition::And {
            left:  Box::new(Condition::FearBelow { value: 50.0 }),
            right: Box::new(Condition::RsiBelow  { value: 30.0 }),
        };
        assert!(evaluate(&cond, &base_signal()))
    }

    #[test]
    fn and_one_false() {
        let cond = Condition::And {
            left:  Box::new(Condition::FearBelow { value: 50.0 }),
            right: Box::new(Condition::RsiAbove  { value: 70.0 }),  // rsi=28.5, fails
        };
        assert!(!evaluate(&cond, &base_signal()))
    }

    #[test]
    fn or_one_true() {
        let cond = Condition::Or {
            left:  Box::new(Condition::FearBelow { value: 50.0 }),  // passes
            right: Box::new(Condition::RsiAbove  { value: 70.0 }),  // fails
        };
        assert!(evaluate(&cond, &base_signal()))
    }

    #[test]
    fn tag_includes_true()  { assert!(evaluate(&Condition::TagIncludes { tag: "near_support".to_string() }, &base_signal())) }
    #[test]
    fn tag_includes_false() { assert!(!evaluate(&Condition::TagIncludes { tag: "near_resistance".to_string() }, &base_signal())) }

    #[test]
    fn no_technicals_returns_false() {
        let mut sig = base_signal();
        sig.rsi14 = None;
        assert!(!evaluate(&Condition::RsiBelow { value: 30.0 }, &sig))
    }

    #[test]
    fn stoch_cross_bullish_in_range() {
        // stoch_k = 25, which is > 20 && < 80 → BULLISH
        assert!(evaluate(
            &Condition::StochCross { direction: "BULLISH".to_string() },
            &base_signal(),
        ))
    }
}
