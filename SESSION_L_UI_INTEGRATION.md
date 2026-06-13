# Session L — UI Integration (Celo Agent Tab)

**Part of:** Onchain Agents Hackathon — Track 1 (Best Agent on Celo).
**Depends on:** Session J (`lib/celo/`) and Session K (`lib/celoAgentLoop.ts`,
`lib/celoAgentStore.ts`, `app/api/celo-agent/loop/route.ts`,
`hooks/useCeloAgentLoop.ts`) — apply those first.

## What's in this zip

```
components/tabs/CeloAgentTab.tsx   — NEW. Wallet setup (generate/import/unlock),
                                      network selector, balances, loop controls,
                                      payment rules editor, payment log.

lib/store.PATCH-celo.ts             — PATCH instructions: add 'celo-agent' to
                                      ActiveTab union (1 addition)
components/Sidebar.PATCH-celo.ts    — PATCH instructions: add Celo Agent nav
                                      item + section (3 small additions)
components/MobileDrawer.PATCH-celo.ts — PATCH instructions: add Celo Agent
                                      section to mobile drawer (1 addition)
app/page.PATCH-celo.ts              — PATCH instructions: register CeloAgentTab
                                      in the TABS registry (2 additions)
```

All four `*.PATCH-celo.*` files are **instructions with diffs in comments**
— same format as the existing `app/page.PATCH.ts` / `lib/store.PATCH.ts`
from Session A/E. They describe small, additive edits to 4 existing files.
No existing line is removed or rewritten — only new lines are added.

## How to apply

1. Apply Sessions J and K first.
2. Copy `components/tabs/CeloAgentTab.tsx` into `components/tabs/`.
3. Apply the 4 patches by following the FIND/REPLACE comments in each
   `*.PATCH-celo.*` file:
   - `lib/store.ts` — add `'celo-agent'` to the `ActiveTab` union
   - `components/Sidebar.tsx` — add the `'celo'` section type, the
     `celo-agent` nav item, and the `Celo Agent` section entry
   - `components/MobileDrawer.tsx` — add the `Celo Agent` section
   - `app/page.tsx` — import `CeloAgentTab` and register it under
     `'celo-agent'` in `TABS`

## Verified

These patches were applied to a working copy of the repo and the whole
project was typechecked (`tsc --noEmit`) — **zero new errors** introduced.
(The repo has 14 pre-existing typecheck errors unrelated to this session —
in `app/api/agent/*`, `app/api/events/scan`, `lib/agentLoop.ts`, and
`supabase/lib/twak/client.ts` — all present before this session and
untouched by it.)

## What you get

A new sidebar section "Celo Agent" (Celo brand yellow `#FCFF52`, distinct
from the BNB "Trading Agent" section) with one tab:

- **Wallet setup** — generate or import a Celo wallet (separate from the
  BNB agent wallet), password-encrypted locally
- **Network toggle** — Alfajores testnet (default) / Celo mainnet
- **Balances** — CELO, cUSD, total USD (live CELO price via Mento on mainnet)
- **Loop controls** — Start/Stop the 2-min agent loop, or "Run Once"
- **Safety toggles** — Dry run (default ON, simulates only) and Autonomous
  mode (required + dry run OFF to send real transactions)
- **Payment rules** — add recurring payments (recipient, cUSD/CELO, amount,
  hourly/daily/weekly)
- **Payment log** — last 10 payments with status (confirmed / simulated /
  blocked / failed) and tx hash

## Next session (M)

- ERC-8004 registration for the Celo agent wallet (Track 3 — 8004scan rank)
- `Showcase.md` + README updates for hackathon submission
