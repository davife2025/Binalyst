# Binalyst — Hackathon Submission

## Project Overview

**Binalyst** is an AI-driven quantitative trading platform built on BNB Chain.
It combines real-time market signals, natural-language strategy authoring, a
regime-aware adaptive engine, and automated on-chain execution into a single
unified agent loop.

---

## Track Alignment

### Track 1 — Best Trading Agent (Bitget) · $2,000

**Requirement:** Complete strategy loop (perception → decision → execution → risk
management), validated through backtest or sim trading.

| Component | Implementation |
|---|---|
| **Perception** | Bitget technical-analysis skill: 23 indicators (RSI, MACD, BB, ADX, EMA, OBV, Stoch, ATR, CCI, Williams%R, MFI, CMF, VWAP…) + CMC fear & greed + trending tokens |
| **Decision** | Adaptive strategy engine: TRENDING → trend-follow, RANGING → mean-reversion, FLAT → hold cash. NL strategy builder parses plain English → executable `StrategyRule[]` |
| **Execution** | TWAK/Binance execution layer: signs and submits swaps on BSC. Dry-run mode for safe testing |
| **Risk management** | Hard guardrails: max drawdown (< 30%), max per-trade %, daily trade cap, slippage limit, competition compliance checks |
| **Validation** | Full backtester on real Binance OHLCV candles — no lookahead bias (fills at next-bar open). Metrics: total return, Sharpe ratio, max drawdown, win rate, profit factor, equity curve |

**Demo:** Load BTC Adaptive template → Parse → Backtest (BTC/1h/90d/$10k) → see equity curve + metrics → start agent → live regime indicator updates every 2 minutes.

---

### Track 2 — Most Onchain Activity · $1,000

**Requirement:** Consistent onchain transactions over the competition period.

- Agent loop fires every **2 minutes** autonomously when started
- Forced DCA fallback logic ensures **≥1 trade per day** minimum, satisfying the 7-trade weekly threshold
- All trades are BEP-20 swaps on BSC — counted as onchain activity
- Competition wallet tracks daily trade count with live display

---

### Track 3 — ERC-8004 Agent Registry · $500

**Requirement:** Register agent with an ERC-8004 onchain identity.

- Agent wallet is generated with a stable keypair on first launch
- Public address displayed in Agent Wallet tab
- **Manual step:** Register the agent address on the ERC-8004 registry via Celo explorer (one transaction)
- No new agent logic required — the existing wallet IS the agent identity

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Binalyst Agent                     │
│                                                      │
│  PERCEPTION                                          │
│  ├── Bitget Skill Hub: technical-analysis (23 ind.)  │
│  ├── CMC: Fear & Greed, trending, momentum           │
│  └── Binance: OHLCV klines (public API)              │
│                                                      │
│  DECISION                                            │
│  ├── AdaptiveStrategy: regime → mode → StrategyRules │
│  ├── NL parser: plain English → StrategyRule[]       │
│  └── evaluateRules(): condition matching per bar     │
│                                                      │
│  EXECUTION                                           │
│  ├── agentLoop.ts: ticks every 2 minutes             │
│  ├── TWAK client: BSC swap execution                 │
│  └── dryRun mode: simulate without signing           │
│                                                      │
│  RISK MANAGEMENT                                     │
│  ├── maxDrawdownPct guard (hard stop < 30%)          │
│  ├── maxPerTradePct limit                            │
│  ├── maxDailyTrades cap                              │
│  └── Competition compliance checks                   │
│                                                      │
│  VALIDATION                                          │
│  ├── Backtester: real Binance OHLCV, 200-bar window  │
│  ├── Metrics: return, Sharpe, drawdown, win rate     │
│  └── Equity curve + full trade log                   │
└─────────────────────────────────────────────────────┘
```

---

## Sessions Delivered

| Session | Deliverable |
|---|---|
| J | Bitget technical-analysis skill, 23 indicators, regime detection, extended SignalSnapshot |
| K | AdaptiveStrategy engine, StrategyBuilder upgrade, RegimePanel, `/api/technicals` route |
| L | Full backtester, `/api/backtest` route, BacktestTab UI, Sidebar/BottomNav updates |
| M | RegimeIndicator component, TechnicalSignalCard (RSI gauge, MACD hist, BB bar), AgentTab + SignalDashboard upgrades |
| N | Playbook export, CompetitionTab Submission panel, SUBMISSION.md |

---

## Key Technical Decisions

**No lookahead bias in backtester:** Every rule is evaluated on bar `i`, but the fill price is `candles[i+1].open`. The strategy never "sees" future data.

**Regime-aware adaptation:** Rather than a fixed strategy, the engine detects market state from ADX + EMA stack + ATR and switches behaviour automatically. A ranging BTC market uses RSI/BB mean-reversion; a trending market uses EMA-cross + MACD trend-following; a flat market holds cash.

**Bitget skill fallback:** The `bitget-technicals.ts` skill computes all 23 indicators locally from Binance public klines. When a `BITGET_API_KEY` is set, it routes through the Bitget Skill Hub REST endpoint instead. Zero dependency on a paid API for the demo.

**NL-first strategy authoring:** Strategies are written in plain English and parsed server-side. Technical condition phrases ("when RSI drops below 30", "when MACD crosses bullish", "when trending up") are converted to typed `StrategyCondition` objects and validated before rules are activated.

---

## Running the Demo

```bash
# 1. Clone and install
git clone https://github.com/davife2025/Binalyst.git
cd Binalyst
npm install

# 2. Set env (only required for live trading)
cp .env.example .env.local
# BINANCE_API_KEY, BINANCE_SECRET_KEY — for execution
# ANTHROPIC_API_KEY — for NL strategy parsing
# BITGET_API_KEY    — optional, for Bitget Skill Hub routing

# 3. Run
npm run dev

# 4. Demo flow
# → Signals tab: live fear & greed + technical signals
# → Strategy Builder: load BTC Adaptive template, parse
# → Backtest tab: run BTC/1h/90d/$10k, see metrics
# → Agent tab: start agent, watch live regime + technicals
# → Competition → Submission: export Playbook JSON
```

---

## Bitget Playbook Integration

The **Playbook export** (Competition → Submission tab) converts parsed
`StrategyRule[]` + backtest results into Bitget Playbook JSON format.

Upload via CLI:
```bash
npx @bitget-ai/getagent-skill upload ./binalyst-playbook.json --key YOUR_PLAYBOOK_KEY
```

Or manually via [Bitget Playbook](https://www.bitget.com/activity/ai-get-agent/playbook?tab=explore).

---

*Built with Next.js 15, TypeScript, Tailwind CSS, Supabase, Ethers.js, Binance API, Bitget Agent Hub.*
