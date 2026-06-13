# Session N3 — UI Dashboard Tab + Sidebar Wiring

## What this session adds

The full user interface for the Mantle AI Trading Agent.
**1 new file + 4 patch instruction files. Zero existing files replaced.**

---

## Files in this session

### New file (drop in as-is)

```
components/tabs/MantleAgentTab.tsx    ← Full dashboard: wallet wizard,
                                        portfolio, Bybit prices, agent
                                        controls, ERC-8004, benchmark log,
                                        trade log
```

### Patch instruction files (FIND/REPLACE — 8 lines of actual changes total)

```
patches/store.PATCH-mantle.md         ← Add '| mantle-agent' to ActiveTab union
                                        in lib/store.ts (2 lines)

patches/Sidebar.PATCH-mantle.md       ← Add nav item + section + type union
                                        in components/Sidebar.tsx (3 operations)

patches/MobileDrawer.PATCH-mantle.md  ← Add Mantle section to mobile drawer
                                        in components/MobileDrawer.tsx (1 operation)

patches/page.PATCH-mantle.md          ← Add import + TABS entry
                                        in app/page.tsx (2 operations)
```

---

## How to apply

### Step 1 — Drop in the new file
Copy `components/tabs/MantleAgentTab.tsx` into `components/tabs/`.

### Step 2 — Apply patches (in order)

**lib/store.ts** — find `| 'backtest'` and add `| 'mantle-agent'` below it.

**components/Sidebar.tsx** — 3 operations:
1. Add `{ id: 'mantle-agent', label: 'Mantle Agent', icon: '⬡', badge: 'NEW', section: 'mantle' }` to NAV array
2. Add `{ id: 'mantle', label: 'Mantle Agent', color: '#61DAFB' }` to SECTIONS array
3. Add `| 'mantle'` to the section type union

**components/MobileDrawer.tsx** — 1 operation:
Add the Mantle section object to the SECTIONS array.

**app/page.tsx** — 2 operations:
1. Add `import MantleAgentTab from '@/components/tabs/MantleAgentTab'`
2. Add `'mantle-agent': <MantleAgentTab />` to the TABS map

Each patch file contains exact FIND/REPLACE strings — open the file, use
Ctrl+H (VS Code) or your editor's find-and-replace, paste the FIND text,
paste the REPLACE text, apply once.

---

## Zero-conflict guarantee

| File | Change type | Lines changed |
|---|---|---|
| `lib/store.ts` | Additive — new union member | 2 |
| `components/Sidebar.tsx` | Additive — new nav item + section | ~7 |
| `components/MobileDrawer.tsx` | Additive — new section | ~6 |
| `app/page.tsx` | Additive — new import + TABS entry | ~4 |

No existing entries are removed. No existing behaviour changes. All existing
tabs continue to work exactly as before.

---

## What the dashboard tab includes

| Section | Feature |
|---|---|
| Status strip | Wallet / Loop active / MNT funded / ERC-8004 |
| Setup wizard | Generate new wallet, import private key, unlock with password |
| Network selector | Testnet (Mantle Sepolia) ↔ Mainnet toggle |
| Portfolio | MNT, mETH (RWA), USDY (RWA), USDC, USD total, PnL % |
| Bybit live prices | MNT/USDT, ETH/USDT, BTC/USDT — updated each cycle |
| Agent config | Dry run, Autonomous mode, Benchmark toggle, Symbol picker |
| Loop controls | Start / Stop / Run Once · countdown · cycle stats |
| ERC-8004 card | Register Agent → 8004scan link (hackathon feature #2) |
| Benchmark panel | Decision count · Explorer link · Last 3 decisions (hackathon feature #1) |
| Trade log | Last 20 trades with side, score, USD size, status, tx link |

---

## What's next — Session N4

- `lib/skills/byreal.ts` — Byreal Skills CLI adapter (Agentic Wallets & Economy track)
- `app/api/skills/byreal/route.ts` — Byreal skill API endpoint
- `components/tabs/MantleSubmissionTab.tsx` — judge-ready submission writeup
- `docs/MANTLE_SUBMISSION.md` — hackathon submission document
