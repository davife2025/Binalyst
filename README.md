# Binalyst — Session D: Autonomous Agent Loop + Competition Tab

## What was built

### New files
```
lib/agentLoop.ts                        — Core loop engine: cycle logic, drawdown safety, forced DCA, rule evaluation
app/api/agent/loop/route.ts             — POST: server-side cycle (signals → rules → guardrails → TWAK execute)
hooks/useAgentLoop.ts                   — React hook: drives the loop from browser, syncs to agentStore
components/agent/DrawdownGauge.tsx      — Animated SVG drawdown risk meter + inline bar variant
components/tabs/CompetitionTab.tsx      — Full competition dashboard: PnL · drawdown · trade log · decisions
vercel.json                             — REPLACES existing: adds /api/agent/loop cron every 2 min
```

### Integration steps

1. **Drop** new files into the repo

2. **Replace** `vercel.json` with Session D version

3. **Add** to `app/page.tsx`:
   ```tsx
   import CompetitionTab from '@/components/tabs/CompetitionTab'
   // in TABS:
   'competition': <CompetitionTab />,
   ```

4. **Add** to `Sidebar.tsx` NAV_MAIN:
   ```ts
   { id: 'competition', label: 'Competition', icon: '🏆', dot: true }
   ```

5. **Add** `'competition'` to `activeTab` union in `lib/store.ts`

## Agent loop flow (every 2 minutes)

```
Browser timer / Vercel cron
  ↓
POST /api/agent/loop
  ↓
1. Get portfolio value via TWAK (BSC on-chain)
2. Compute drawdown vs peak
   ├─ ≥ 30% → return status: 'disqualified'
   └─ ≥ 27.9% → return status: 'paused'
3. Fetch CMC signals (batch)
4. Evaluate StrategyRules against snapshots
5. Forced DCA if 0 trades today & hour ≥ 22
6. For each fired rule:
   ├─ checkCompetitionGuardrails()
   ├─ if blocked → log, skip
   └─ if passed → (dryRun? simulate : TWAK approve + swap)
7. Return cycle result → agentStore → UI update
```

## Safety layers (4 levels)

| Level | Trigger | Effect |
|---|---|---|
| Symbol check | Token not in 149 eligible list | Trade blocked |
| Portfolio floor | Portfolio ≤ $1 | Trade blocked |
| Warning zone | Drawdown ≥ 24% | Trade allowed + warning |
| Auto-pause | Drawdown ≥ 27.9% | Loop paused, no trades |
| Disqualify cap | Drawdown ≥ 30% | Loop stopped, disqualified |

## Competition minimum trades

- Forced DCA fires at 22:00 if 0 trades that day
- Picks highest-signal eligible token at 5% portfolio size
- Ensures minimum 1 trade/day (7 total) to qualify

## What's next — Session E
- Dorahacks submission generator (strategy writeup)
- End-to-end demo mode (guided walkthrough)
- Performance export (CSV trade log + PnL chart)
- Final guardrail audit
