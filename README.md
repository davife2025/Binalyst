# Session J — Bitget Technical-Analysis Skill + Extended Signals

## What this session adds

- **23 technical indicators** computed from Binance public klines (no API key needed)
- **Market regime detection**: TRENDING_UP / TRENDING_DOWN / RANGING / FLAT
- **Extended `SignalSnapshot`** with a `technicals` sub-object (fully backward compatible)
- **11 new `StrategyCondition` types** for technical rules in `StrategyBuilder`
- **Natural-language parser** extended: "buy BTC when RSI drops below 30", "buy BTC when MACD crosses bullish", "buy BTC when trending up"

## Indicators by category

| Category | Indicators |
|---|---|
| Trend | EMA20, EMA50, EMA200, SMA20, VWAP, EMA cross signal |
| Momentum | RSI14, MACD (line/signal/hist/cross), Stochastic K/D, ROC10 |
| Volatility | Bollinger Bands (upper/mid/lower/%B/width), ATR14, ATR% |
| Volume | OBV + trend, VWMA20, Chaikin Money Flow, MFI14 |
| Oscillators | CCI20, Williams %R, Ultimate Oscillator |
| Structure | Support 1&2, Resistance 1&2, Pivot Point, near-support/resistance flags |

## Files in this zip

```
lib/skills/bitget-technicals.ts   ← NEW — full technical indicator engine
lib/skills/index.binance.ts       ← RENAME of old lib/skills/index.ts
lib/skills/index.ts               ← NEW — unified re-export hub
lib/signalEngine.ts               ← EDIT — extended with technical fields
```

## Apply instructions (in order)

1. **Rename** `lib/skills/index.ts` → `lib/skills/index.binance.ts`
   _(or just copy `index.binance.ts` from this zip — it's the same content)_

2. **Copy** `lib/skills/bitget-technicals.ts` → `lib/skills/bitget-technicals.ts` (new file)

3. **Replace** `lib/skills/index.ts` with the new version from this zip

4. **Replace** `lib/signalEngine.ts` with the new version from this zip

5. **No other files change** — all existing imports still work

## Environment variables (optional)

```env
# Only needed if you want to route through Bitget Skill Hub REST endpoint.
# If not set, all indicators are computed locally from Binance klines.
BITGET_API_KEY=your-key
BITGET_SECRET_KEY=your-secret
BITGET_PASSPHRASE=your-passphrase
```

## How to use in existing code

```typescript
// Get a full technical snapshot for BTC (1h candles)
import { getTechnicalSnapshot } from '@/lib/skills/bitget-technicals'
const snap = await getTechnicalSnapshot('BTC', '1h')
console.log(snap.regime)          // 'TRENDING_UP'
console.log(snap.momentum.rsi14)  // 58.3
console.log(snap.summary.overallScore) // 67

// Pass to computeSignalSnapshot for a merged signal
import { computeSignalSnapshot } from '@/lib/signalEngine'
const signal = computeSignalSnapshot(token, fg, avgVol, rank, snap)
console.log(signal.technicals?.regime) // 'TRENDING_UP'
console.log(signal.tags) // [..., 'trending_up', 'macd_bull_cross']

// Use technical conditions in strategy rules
const rule: StrategyRule = {
  id: crypto.randomUUID(), symbol: 'BTC',
  condition: { type: 'and',
    left:  { type: 'rsi_below', value: 35 },
    right: { type: 'regime_is', regime: 'TRENDING_UP' },
  },
  action: 'BUY', sizePct: 10, priority: 1, cooldownMs: 3_600_000,
}
```

## What's next — Session K

Session K builds the adaptive strategy engine on top of these technicals:
- `lib/adaptiveStrategy.ts` — regime-aware decision logic (trend-follow vs mean-reversion vs flat)
- Extended `StrategyBuilder` UI — regime badge, technical condition picker, new templates
- BTC adaptive strategy template wired end-to-end
