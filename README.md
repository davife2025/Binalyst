# Binalyst — Session C: Strategy Engine & AI Decision Layer

## What was built

### New files
```
lib/twak/client.ts                    — REPLACES Session A: full 149-token list + competition guardrail checker
app/api/agent/strategy/route.ts       — POST: AI parses natural language → StrategyRule[] JSON
app/api/agent/execute/route.ts        — POST: guardrail check → dry-run quote → live TWAK swap on BSC
components/tabs/StrategyBuilder.tsx   — Full strategy builder UI: templates, write, parse, rules editor, config
```

### Integration steps

1. **Replace** `lib/twak/client.ts` with Session C version (adds full 149-token list + guardrails)

2. **Add** new API routes (new files, no conflicts):
   ```
   app/api/agent/strategy/route.ts
   app/api/agent/execute/route.ts
   ```

3. **Add** to `app/page.tsx`:
   ```tsx
   import StrategyBuilder from '@/components/tabs/StrategyBuilder'
   // in TABS:
   'strategy': <StrategyBuilder />,
   ```

4. **Add** to `Sidebar.tsx` NAV_MAIN:
   ```ts
   { id: 'strategy', label: 'Strategy', icon: '⚡' }
   ```

5. **Add** `'strategy'` to `activeTab` union in `lib/store.ts`

## Competition rules enforced (Session C additions)

All 149 eligible symbols from the competition spec are now in `ALL_ELIGIBLE_SYMBOLS[]`.

`checkCompetitionGuardrails()` enforces:
- Token must be in eligible list → trade blocked if not
- Portfolio ≤ $1 → blocked (sub-$1 = 0% for that hour)  
- Drawdown ≥ 30% → blocked + DISQUALIFIED flag
- Drawdown ≥ 24% (80% of cap) → WARNING emitted
- Per-trade size limit → blocked if exceeds config
- Slippage > 5% → blocked

## Strategy parsing

POST `/api/agent/strategy` with `{ strategyText: "..." }`:
- AI (Kimi K2) parses to StrategyRule[] JSON
- Validates all symbols against eligible list
- Caps sizePct at 25% max
- Returns summary, riskLevel, warnings
- Falls back to fast regex parser if AI JSON is malformed

## Trade execution

POST `/api/agent/execute` with:
```json
{
  "privateKey": "0x...",
  "symbol": "ETH",
  "action": "BUY",
  "amountUSDT": 50,
  "portfolioUSD": 500,
  "drawdownPct": 5.2,
  "tradesToday": 1,
  "dryRun": true
}
```

Always defaults to `dryRun: true` — set `dryRun: false` explicitly for live execution.

## What's next — Session D
- Full autonomous agent loop: signal → rule eval → decision → TWAK execute
- 2-minute polling cycle with rule evaluation
- CompetitionTab: live PnL, drawdown gauge, trade log with BSCScan links
- Auto-pause when drawdown approaches 30% threshold
- Daily trade count tracker (ensures 1/day minimum)
