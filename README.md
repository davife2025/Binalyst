# Session N — Hackathon Polish + Submission Package

## What this session adds

**`lib/playbook.ts`** (new)
- `buildPlaybook()` — converts `StrategyRule[]` + `BacktestResult` → Bitget Playbook JSON
- `exportPlaybookJson()` — serialises to formatted JSON string
- `downloadPlaybook()` — triggers browser download of `binalyst-playbook.json`
- Full condition converter: all 20+ StrategyCondition types → Bitget Playbook condition format
- Auto-detects which indicators are used and generates the `indicators[]` block

**`components/tabs/CompetitionTab.tsx`** (edit)
- New **Submission** tab (4th tab, 📋 icon)
  - Track alignment checklist: Track 1/2/3, live completion bars, prize amounts
  - Bitget Playbook export button → downloads JSON, includes backtest metrics if run
  - CLI upload instructions inline
  - 5-step judge demo script with timestamps
  - $3,500 total prize banner
- Imports `buildPlaybook` + `downloadPlaybook` from `lib/playbook.ts`
- `handleExportPlaybook()` pulls last backtest from sessionStorage if available

**`SUBMISSION.md`** (new — repo root)
- Full track alignment table
- Architecture diagram
- Sessions delivered table
- Key technical decisions
- Running the demo instructions
- Bitget Playbook upload steps

## Files in this zip

```
lib/playbook.ts                      ← NEW
components/tabs/CompetitionTab.tsx   ← EDIT
SUBMISSION.md                        ← NEW (repo root)
README.md                            ← this file
```

## Apply instructions

1. Sessions J–M must be applied first
2. Copy `lib/playbook.ts` (new)
3. Replace `components/tabs/CompetitionTab.tsx`
4. Copy `SUBMISSION.md` to the repo root

## Saving backtest results for Playbook export

To include backtest metrics in the exported Playbook JSON, save the result
after a successful backtest run. Add this to `BacktestTab.tsx` after `setResult(data.result)`:

```typescript
sessionStorage.setItem('lastBacktestResult', JSON.stringify(data.result))
```

The Competition → Submission export button reads from `sessionStorage.lastBacktestResult`
automatically.

## Complete session summary

| Session | Files | Key deliverable |
|---|---|---|
| J | 4 files | Bitget technical-analysis skill, 23 indicators, regime detection |
| K | 4 files | Adaptive strategy engine, StrategyBuilder upgrade, /api/technicals |
| L | 7 files | Backtester, BacktestTab, /api/backtest, Sidebar/BottomNav |
| M | 5 files | RegimeIndicator, TechnicalSignalCard, AgentTab/SignalDashboard upgrades |
| N | 4 files | Playbook export, Submission tab, SUBMISSION.md |
| **Total** | **24 files** | **Complete Track 1 submission, $3,500 prize potential** |
