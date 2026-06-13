# Session K — Adaptive Strategy Engine

## What this session adds

- **`lib/adaptiveStrategy.ts`** (new) — regime-aware decision engine
  - `TRENDING_UP/DOWN` → trend-following rules (EMA cross + MACD confirm + ADX filter)
  - `RANGING` → mean-reversion rules (RSI + BB%B oversold/overbought)
  - `FLAT` → hold cash, DCA-only with 24h cooldown
  - `btcAdaptiveStrategy` — pre-configured BTC instance matching the hackathon brief
  - `BTC_ADAPTIVE_TEMPLATE_TEXT` — natural-language template loaded into StrategyBuilder

- **`components/tabs/StrategyBuilder.tsx`** (edit) — 4 additions
  - **BTC Adaptive** and **Mean Reversion** templates (marked NEW)
  - **RegimePanel** — live BTC regime badge + RSI/MACD/BB/TechScore row + reasoning
  - **Adaptive tab** — sliders for trend/MR sizing, RSI levels, ADX min, MACD confirm toggle
  - Technical condition "📊 Technical" badge on rules that use Session J conditions
  - Condition cheatsheet showing NL → condition mappings

- **`app/api/technicals/route.ts`** (new) — GET `/api/technicals`
  - `?symbol=BTC&interval=1h` → single TechnicalSnapshot
  - `?batch=BTC,ETH,BNB` → multiple snapshots in one call
  - 60-second in-memory cache to protect Binance rate limits

## Files in this zip

```
lib/adaptiveStrategy.ts                ← NEW
components/tabs/StrategyBuilder.tsx    ← EDIT (Session C → K)
app/api/technicals/route.ts            ← NEW
README.md                              ← this file
```

## Apply instructions (in order)

1. Apply **Session J** first if you haven't (signalEngine + bitget-technicals)
2. **Copy** `lib/adaptiveStrategy.ts` → `lib/adaptiveStrategy.ts` (new)
3. **Replace** `components/tabs/StrategyBuilder.tsx`
4. **Copy** `app/api/technicals/route.ts` → `app/api/technicals/route.ts` (new)
5. No other files change

## How it all connects

```
StrategyBuilder (write tab)
  └─ RegimePanel
       └─ GET /api/technicals?symbol=BTC
            └─ getTechnicalSnapshot() [Session J]
                 └─ fetchCandles() → Binance klines

StrategyBuilder (adaptive tab)
  └─ AdaptiveStrategy.getDecision(snap)
       ├─ TRENDING_UP/DOWN → trendFollowDecision() → StrategyRule[]
       ├─ RANGING          → meanReversionDecision() → StrategyRule[]
       └─ FLAT             → flatDecision() → StrategyRule[]

These StrategyRule[] objects plug directly into existing:
  evaluateRules(rules, signals) in lib/signalEngine.ts [Session B]
```

## What's next — Session L

Session L builds the backtester:
- `lib/backtester.ts` — replay historical candles, evaluate rules, compute PnL/Sharpe/drawdown/win rate
- `app/api/backtest/route.ts` — POST strategy → BacktestResult
- `components/tabs/BacktestTab.tsx` — UI with PnL chart, metrics table, trade log
- Sidebar + BottomNav updates to add the Backtest entry point
