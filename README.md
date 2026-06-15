# Session O — Bitget Connect + Bitget Tools Tabs

## What this session adds

### New files (4)

**`lib/bitgetClient.ts`**
- `BitgetClient` class with full API coverage: account, spot, futures, positions, market data, trading, Skill Hub
- `BITGET_SKILLS` — metadata for all 5 skills (technical-analysis, sentiment-analyst, market-intel, news-briefing, macro-analyst)
- `BITGET_TRADING_APIS` — 58 APIs organised by category for the Tools UI
- `bitgetClientFromEnv()` — builds client from env vars server-side
- `validateCredentials()` — tests API key without exposing it to browser

**`app/api/bitget/route.ts`**
- `POST /api/bitget` — unified proxy: `{ action, params, credentials? }` → calls BitgetClient method
- `GET /api/bitget` — health check + reports whether env creds are set

**`components/tabs/BitgetConnectTab.tsx`**
- Tab 1: API key / secret / passphrase / Playbook key form
- Credentials stored in `sessionStorage` only — never logged server-side
- Validates credentials via `/api/bitget → validateCredentials()`
- Tab 2: Account overview — UID, spot balance, futures balance, positions count
- Permissions panel: Read / Trade / Withdraw status
- Tab 3: Step-by-step setup guide + `.env.local` instructions
- Env creds detected automatically and shown as a notice

**`components/tabs/BitgetToolsTab.tsx`**
- Section 1: Skill Hub — 5 expandable skill panels
  - Each has param inputs (symbol, keyword) + Run button
  - `technical-analysis` routes to `/api/technicals` (Session J) for rich output with regime, RSI, MACD, BB, OBV, signal pills
  - Others call `/api/bitget` and display raw JSON (ready for rich rendering)
- Section 2: Trading API Launcher — browse 58 APIs by category, click to run, results in right pane
  - Account, Market, Trading, Strategy categories
  - Symbol input for market/trading calls
  - Common APIs wired to `API_MAP`; others labelled "soon"

### Edited files (4)

| File | Change |
|---|---|
| `lib/store.ts` | `'bitget-connect'` and `'bitget-tools'` added to `ActiveTab` union |
| `app/page.tsx` | `BitgetConnectTab` + `BitgetToolsTab` imported and registered in `TABS` |
| `components/Sidebar.tsx` | Bitget Connect (🔗) + Bitget Tools (⚡ dot) added under Trading Agent section |
| `components/BottomNav.tsx` | Bitget shortcut added to mobile nav |

## Files in this zip

```
lib/bitgetClient.ts
lib/store.ts
app/api/bitget/route.ts
app/page.tsx
components/tabs/BitgetConnectTab.tsx
components/tabs/BitgetToolsTab.tsx
components/Sidebar.tsx
components/BottomNav.tsx
README.md
```

## Apply instructions

1. Sessions J–N + session-fix must be applied first
2. Copy `lib/bitgetClient.ts` (new)
3. Copy `app/api/bitget/route.ts` (new — create dir if needed)
4. Copy `components/tabs/BitgetConnectTab.tsx` (new)
5. Copy `components/tabs/BitgetToolsTab.tsx` (new)
6. Replace `lib/store.ts`
7. Replace `app/page.tsx`
8. Replace `components/Sidebar.tsx`
9. Replace `components/BottomNav.tsx`

## Demo flow for the new tabs

1. Open **Bitget Connect** → paste API key + secret + passphrase → Connect
2. See UID, spot balance, futures balance, permissions panel
3. Switch to **Bitget Tools → Skill Hub**
4. Expand **Technical Analysis** → select BTCUSDT → Run → see regime, RSI, MACD, BB, signal pills
5. Expand **Sentiment Analyst** → Run → see funding rates, long/short ratios
6. Switch to **Trading APIs** → Market category → Get Ticker → select BTCUSDT → click → see live price data

## Environment variables

```env
# .env.local — server-side, never exposed to browser
BITGET_API_KEY=bg_your_key
BITGET_SECRET_KEY=your_secret
BITGET_PASSPHRASE=your_passphrase
```

When set, all server-side Skill Hub calls (including `/api/technicals` Bitget routing in Session J) use these automatically. The browser Connect tab is for users who want to enter keys in-session without touching `.env.local`.
