# Session L — Backtester + Sim Trading

## What this session adds

- **`lib/backtester.ts`** (new) — full backtest engine
  - Fetches real Binance OHLCV candles (public API, no auth)
  - Walks bars chronologically, recomputes 8 technical indicators per bar (RSI, MACD, BB, ADX, EMA, OBV, Stoch, ATR)
  - Evaluates all Session C + Session J StrategyRule conditions at each bar
  - Fills at next-bar open — no lookahead bias
  - Metrics: total return, Sharpe ratio, max drawdown, win rate, profit factor, avg hold

- **`app/api/backtest/route.ts`** (new) — POST `/api/backtest`
  - Accepts `{ rules[], symbol, interval, lookbackDays, initialCapital, mockFearGreed }`
  - Or raw `strategyText` (parses it server-side)
  - Returns full `BacktestResult` with equity curve + trade log

- **`components/tabs/BacktestTab.tsx`** (new) — backtest UI
  - Symbol picker (BTC/ETH/BNB/SOL + 6 more)
  - Interval picker (15m / 1h / 4h / 1d)
  - Lookback: 1 month / 3 months / 6 months / 1 year
  - Initial capital slider ($1k–$100k)
  - Mock Fear & Greed slider (for sentiment-based rules)
  - 6 metric cards: return, Sharpe, max drawdown, win rate, trades, profit factor
  - Inline SVG equity curve (no recharts dep)
  - Paginated trade log with PnL colouring

- **`lib/store.ts`** (edit) — `'backtest'` added to `ActiveTab` union

- **`components/Sidebar.tsx`** (edit) — Backtest entry added after Strategy (📈 dot)

- **`components/BottomNav.tsx`** (edit) — mobile Backtest shortcut replaces Agent tab

## Files in this zip

```
lib/backtester.ts                   ← NEW
lib/store.ts                        ← EDIT (add 'backtest' to ActiveTab)
app/api/backtest/route.ts           ← NEW
components/tabs/BacktestTab.tsx     ← NEW
components/Sidebar.tsx              ← EDIT
components/BottomNav.tsx            ← EDIT
README.md
```

## Apply instructions (in order)

1. Sessions J and K must be applied first
2. Copy  `lib/backtester.ts` (new)
3. Copy  `app/api/backtest/route.ts` (new — create the directory if needed)
4. Copy  `components/tabs/BacktestTab.tsx` (new)
5. Replace `lib/store.ts`
6. Replace `components/Sidebar.tsx`
7. Replace `components/BottomNav.tsx`
8. Register BacktestTab in your tab router (wherever StrategyBuilder is rendered):
   ```tsx
   import BacktestTab from '@/components/tabs/BacktestTab'
   // ...
   {activeTab === 'backtest' && <BacktestTab />}
   ```

## Hackathon validation criteria ✓

Track 1 requirement: *"validated through backtest or sim trading"*

After Session L:
- Load the BTC Adaptive template in StrategyBuilder → Parse
- Switch to Backtest tab → choose BTC / 1h / 3 months / $10k
- Click Run Backtest
- See: equity curve, Sharpe ratio, max drawdown, win rate, trade log
- This IS the runnable demo the judges want

## What's next — Session M

Session M adds live visual overlays:
- `components/agent/RegimeIndicator.tsx` — live trend/range/flat pill with confidence bar
- `components/agent/TechnicalSignalCard.tsx` — RSI gauge, MACD histogram, BB position
- AgentTab and SignalDashboard updated to show live technicals alongside existing signals
