# Session M — Live Performance Dashboard + Agent Upgrade

## What this session adds

### New components (2 new files)

**`components/agent/RegimeIndicator.tsx`**
- Full mode: regime pill (colour-coded), confidence bar, ADX reading, mode label, 4-indicator row (RSI / MACD / BB%B / EMA Cross), active rules count, reasoning text
- Compact mode (`compact` prop): single-line pill for embedding in headers
- Auto-refreshes every 2 minutes from `/api/technicals`

**`components/agent/TechnicalSignalCard.tsx`**
- Full mode: RSI semicircle gauge (SVG), MACD histogram bar (SVG), Stochastic K/D bars, BB%B position slider with squeeze indicator, OBV trend arrow, MFI14 circle badge, signal pills from TechnicalSummary, support/resistance footer
- Minimal mode (`minimal` prop): single-row RSI · MACD · BB%B · TechScore for list views
- Accepts a full `TechnicalSnapshot` — works with live `/api/technicals` data or synthesised snapshots from `SignalSnapshot.technicals`

### Edited components (2 files)

**`components/tabs/AgentTab.tsx`**
- Imports `RegimeIndicator` + `TechnicalSignalCard`
- Adds `techSnap` state, fetches BTC technicals on mount
- Injects a 2-column panel (RegimeIndicator left, TechnicalSignalCard right) above the existing stats row
- All existing AgentTab logic unchanged

**`components/tabs/SignalDashboard.tsx`**
- Imports `RegimeIndicator` + `TechnicalSignalCard`
- Adds `techSnaps` cache (Record<symbol, TechnicalSnapshot>)
- Fetches technicals on-demand when a signal is selected (click to detail)
- Detail panel: RegimeIndicator + TechnicalSignalCard appear below SignalCard
- List view: `TechnicalSignalCard minimal` row shows RSI/MACD/BB/%B/TechScore inline under each row when `signal.technicals` is populated (from Session J SignalSnapshot)

## Files in this zip

```
components/agent/RegimeIndicator.tsx      ← NEW
components/agent/TechnicalSignalCard.tsx  ← NEW
components/tabs/AgentTab.tsx              ← EDIT
components/tabs/SignalDashboard.tsx       ← EDIT
README.md
```

## Apply instructions

1. Sessions J, K, L must be applied first
2. Copy `components/agent/RegimeIndicator.tsx` (new — create dir if needed)
3. Copy `components/agent/TechnicalSignalCard.tsx` (new)
4. Replace `components/tabs/AgentTab.tsx`
5. Replace `components/tabs/SignalDashboard.tsx`
6. No store changes, no route changes, no new API routes

## What judges see after Session M

Opening the **Agent tab**:
- Live BTC regime badge (TRENDING UP / RANGING / FLAT) with confidence bar
- RSI semicircle gauge, MACD histogram, Stochastic bars, BB position slider, OBV arrow
- All existing agent stats, wallet, log below

Opening **Signals** → clicking any token:
- Existing signal card (score, direction, tags, reasoning)
- Live regime indicator for that token
- Full technical card (RSI gauge, MACD, BB, OBV, MFI, support/resistance)

In **list view** (toggle grid/list):
- Each row shows a mini technical strip: RSI · MACD · BB%B · TechScore

## What's next — Session N (final)

Session N delivers the hackathon submission package:
- `lib/playbook.ts` — export strategy as Bitget Playbook-compatible JSON
- `components/tabs/CompetitionTab.tsx` — Playbook export button, submission checklist
- `components/tabs/DashboardTab.tsx` — backtest summary + regime on main dashboard
- `SUBMISSION.md` — track alignment writeup, demo script, judge notes
