# Binalyst — Session B: CMC Signal Engine

## What was built

### New files
```
lib/signalEngine.ts                    — Core signal computation: momentum + F&G + volume spike → scored snapshot
hooks/useSignals.ts                    — React hook: polls CMC every 60s, caches in agentStore
components/agent/FearGreedGauge.tsx    — Animated SVG arc gauge + mini inline variant + 30d history sparkline
components/agent/SignalCard.tsx        — Token signal card: score bar, direction badge, tags, reasoning
components/tabs/SignalDashboard.tsx    — Full dashboard: F&G gauge + signal grid + summary + filter/sort
app/api/cmc/route.ts                   — REPLACES Session A version: adds full SignalSnapshot computation
```

### Integration steps

1. **Replace** `app/api/cmc/route.ts` with the Session B version
2. **Add** to `app/page.tsx` TABS:
   ```tsx
   import SignalDashboard from '@/components/tabs/SignalDashboard'
   // in TABS:
   'signals': <SignalDashboard />,
   ```
3. **Add** to `Sidebar.tsx` NAV_MAIN:
   ```ts
   { id: 'signals', label: 'Signals', icon: '◈', dot: true }
   ```
4. **Add** `'signals'` to the `activeTab` union in `lib/store.ts`

## Signal scoring formula

```
signalScore = 50
  + momentum * 0.4          // price 1h/24h/7d weighted
  + fgBias                  // -25 to +25 based on Fear & Greed zone
  + trendBoost              // 0-10 if CMC trending top 20
  + volBoost                // 0-10 if volume spike ≥ 2x

BUY  if score ≥ 68
SELL if score ≤ 32
HOLD otherwise

HIGH confidence:   BUY ≥ 82 or SELL ≤ 18
MEDIUM confidence: BUY 68-81 or SELL 19-32
```

## Tags generated
- `extreme_fear` / `extreme_greed` — F&G zones
- `volume_spike` — 2.5x+ above avg 24h volume
- `strong_momentum` — abs(momentum) ≥ 50
- `dca_zone` — F&G ≤ 25 AND momentum positive
- `oversold` / `overbought` — 24h change ≤ -15% / ≥ +15%
- `trending_cmc` — in CMC trending top 10
- `reversal_watch` — big 24h move with opposing 1h

## What's next — Session C
- Natural-language strategy builder (AI parses "buy ETH when fear < 25")
- Strategy → structured StrategyRule[] via Kimi K2
- Backtester: replay signals against historical CMC data
- StrategyBuilder UI component
