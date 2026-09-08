# Binalyst

**AI-powered quantitative trading platform with multi-chain autonomous agents.**

Binalyst combines real-time market signals, natural-language strategy authoring, a regime-aware adaptive engine, and on-chain execution into a unified agent dashboard — running live on multi chain.

---

## What It Does

- **AI Trading Agent** — autonomous loop that perceives market conditions, decides on a strategy, and executes trades on BNB Chain every 2 minutes
- **Natural Language Strategy Builder** — write strategies in plain English ("when RSI drops below 30 and MACD crosses bullish, buy 5%") and the engine converts them to executable rules
- **Regime-Aware Adaptation** — detects TRENDING / RANGING / FLAT market states and switches strategy mode automatically
- **Full Backtester** — validates strategies on real Binance OHLCV candles with no lookahead bias; returns Sharpe ratio, max drawdown, win rate, equity curve
- **Sui Agent** — Move-policy-gated agent wallet on Sui with Walrus activity logging and DeepBook order support
- **ERC-8004 Identity** — every agent mints an onchain identity NFT on Celo and Mantle via the ERC-8004 registry

---

## Tech Stack

| Layer | Tools |
|---|---|
| Framework | Next.js 15, TypeScript, Tailwind CSS |
| AI | Claude (Anthropic) via `claude.ts` |
| Blockchain | Ethers.js v6 (BNB SDK) |
| Market Data | Binance public API, Bybit, CMC Fear & Greed, Bitget Skill Hub |
| State | Zustand (independent stores per chain) |
| Auth / DB | Supabase, NextAuth |
| On-chain storage | Walrus (Sui activity logs) |
| Deployment | Vercel |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Binalyst Agent                     │
│                                                      │
│  PERCEPTION                                          │
│  ├── Bitget Skill Hub: 23 technical indicators       │
│  │   (RSI, MACD, BB, ADX, EMA, OBV, ATR, VWAP…)    │
│  ├── CMC: Fear & Greed index, trending tokens        │
│  └── Binance: OHLCV klines (public API)              │
│                                                      │
│  DECISION                                            │
│  ├── AdaptiveStrategy: regime → mode → StrategyRules │
│  ├── NL parser: plain English → StrategyRule[]       │
│  └── evaluateRules(): condition matching per bar     │
│                                                      │
│  EXECUTION                                           │
│  ├── agentLoop.ts: ticks every 2 minutes             │
│  ├── TWAK client: BEP-20 swap execution on BSC       │
│  └── dryRun mode: simulate without signing           │
│                                                      │
│  RISK MANAGEMENT                                     │
│  ├── maxDrawdownPct guard (hard stop < 30%)          │
│  ├── maxPerTradePct limit                            │
│  ├── maxDailyTrades cap                              │
│  └── slippage + competition compliance checks        │
│                                                      │
│  VALIDATION                                          │
│  ├── Backtester: real Binance OHLCV, 200-bar window  │
│  ├── Metrics: return, Sharpe, drawdown, win rate     │
│  └── Equity curve + full trade log                   │
└─────────────────────────────────────────────────────┘
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A funded wallet for whichever chains you want to use
- API keys (see Environment Variables below)

### Install & Run

```bash
git clone https://github.com/davife2025/Binalyst.git
cd Binalyst
npm install
cp .env.celo.example .env.local   # or .env.mantle.example — see below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

The `.env.celo.example` and `.env.mantle.example` files in the repo root document every variable. Key ones:

| Variable | Purpose | Required |
|---|---|---|
| `ANTHROPIC_API_KEY` | NL strategy parsing, AI chat | Yes |
| `BITGET_API_KEY` | Bitget Skill Hub routing (optional) | No — falls back to local computation |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Auth & persistence | For auth features |

> **Never commit private keys.** All agent wallets are self-custodial; keys stay in your environment and are never sent to any third party.

---

## Binance Agent OS Integration

*Built for the Binance Agent OS Mini Hackathon — Track A.*

Binalyst connects directly to Binance's official **Agent OS MCP server** (`https://agent.binance.com/mcp/agentic`) as a live, read-only data source alongside its existing direct Binance REST integration:

- `lib/agentOS.ts` — a minimal MCP client that performs the `initialize` → `tools/list` → `tools/call` handshake over Agent OS's Streamable HTTP transport, using only the **public, no-auth market-data scope**.
- `app/api/agent/agentos/route.ts` — exposes that connection as `/api/agent/agentos`.
- The **Agent OS** badge in the Agent tab polls this route every 30s and shows the live tool count / ticker pulled straight from Binance's MCP endpoint — you can verify it's real by checking `agent.binance.com` in the network tab.

Account, trade, and transfer scopes on the Agent OS MCP server require a per-user browser OAuth flow (see Binance's [docs](https://developers.binance.com/en/docs/agent-native/mcp-server/agentic)) and are out of scope for this integration; Binalyst's own trading agent continues to execute through its existing signed BEP-20 flow via `lib/binance.ts` / TWAK.

---

## Chain Modules

### BNB Chain (Core Trading Agent)
- 23-indicator technical analysis via `lib/skills/bitget-technicals.ts`
- TWAK client for BEP-20 swap execution
- Adaptive strategy engine with TRENDING / RANGING / FLAT regimes
- Full backtester at `/api/backtest`


---

## Demo Flow

1. **Signals tab** — live Fear & Greed index + 23 technical signals for any pair
2. **Strategy Builder** — load the _BTC Adaptive_ template, click Parse
3. **Backtest tab** — run BTC/1h/90d/$10k starting capital → see equity curve and metrics
4. **Agent tab** — start the agent, watch live regime detection update every 2 minutes


---

## Key Technical Decisions

**No lookahead bias in the backtester.** Rules are evaluated on bar `i` but fill at `candles[i+1].open`. The strategy never sees future data.

**Regime-aware adaptation.** Rather than a fixed strategy, the engine reads ADX + EMA stack + ATR to detect market state and switches behaviour automatically. Ranging markets use RSI/BB mean-reversion; trending markets use EMA-cross + MACD; flat markets hold cash.

**Bitget skill fallback.** All 23 indicators are computed locally from Binance public klines. When `BITGET_API_KEY` is set, routing switches to the Bitget Skill Hub REST endpoint. Zero dependency on a paid API for the demo.

**Fully parallel chain modules.** The Celo and Mantle agents share no code with the BNB trading agent. Each chain has its own store, client, loop, and API routes — all run side-by-side without interference.

**On-chain-only agent identity.** ERC-8004 registration files are stored as `data:application/json;base64,...` URIs — no IPFS or external hosting dependency.

---

## Project Structure

```
app/
  api/
    agent/          # BNB agent endpoints (loop, execute, strategy, portfolio)
  
    backtest/       # Backtester route
    ai/chat/        # Claude chat route
components/
  tabs/             # AgentTab, BacktestTab, CeloAgentTab, MantleAgentTab, etc.
  agent/            # PnLChart, PortfolioBreakdown, FearGreedGauge, DrawdownGauge
lib/
  skills/           # bitget-technicals, cmc, byreal, web3, square
  signalEngine.ts   # Regime detection + technical signal evaluation
  playbook.ts       # Bitget Playbook JSON export
move/
  sources/agent_policy.move   # Sui Move contract
```

---

## License

MIT
