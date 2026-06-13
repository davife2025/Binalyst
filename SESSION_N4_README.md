# Session N4 — Byreal Skills + Submission

## What this session adds

The submission layer for the Turing Test Hackathon — covering the
Agentic Wallets & Economy track (Byreal Skills) and the judge-ready
submission experience.
**All files are new. Zero existing files replaced.**

---

## Files in this session (all NEW)

```
lib/skills/byreal.ts                          ← Byreal Skills CLI adapter
                                                5 skills: get_price, signal_score,
                                                run_cycle, benchmark_info, agent_identity
                                                Skill manifest + ByrealSkillHub

app/api/skills/byreal/route.ts                ← GET manifest · POST execute
                                                Full input validation + rate limiting

app/api/mantle-agent/submission/route.ts      ← Claude AI-generated submission
                                                writeup (POST) — parallel to
                                                /api/agent/dorahacks/route.ts

components/tabs/MantleSubmissionTab.tsx       ← Judge-ready submission tab:
                                                readiness checklist, AI writeup,
                                                Byreal skills viewer, hackathon links

docs/MANTLE_SUBMISSION.md                     ← Complete hackathon submission doc
                                                (copy-paste ready for DoraHacks)
```

## Patch instruction files

```
patches/skills-index.PATCH-byreal.md         ← Add Byreal exports to lib/skills/index.ts
                                                (1 operation — append to end of file)

patches/page-sidebar.PATCH-submission.md     ← Wire MantleSubmissionTab into:
                                                app/page.tsx (import + TABS entry)
                                                lib/store.ts (ActiveTab union)
                                                components/Sidebar.tsx (nav item)
                                                (4 operations total)
```

---

## How to apply

### Step 1 — Drop in new files

```
lib/skills/byreal.ts                    → lib/skills/byreal.ts
app/api/skills/byreal/route.ts          → app/api/skills/byreal/route.ts
app/api/mantle-agent/submission/route.ts → app/api/mantle-agent/submission/route.ts
components/tabs/MantleSubmissionTab.tsx → components/tabs/MantleSubmissionTab.tsx
docs/MANTLE_SUBMISSION.md               → docs/MANTLE_SUBMISSION.md
```

### Step 2 — Apply patches (in order)

1. **lib/skills/index.ts** — append Byreal exports (1 operation)
2. **app/page.tsx** — add import + TABS entry (2 operations)
3. **lib/store.ts** — add `| 'mantle-submission'` (1 operation)
4. **components/Sidebar.tsx** — add 🏆 nav item (1 operation)

---

## Zero-conflict guarantee

| File | Change type |
|---|---|
| `lib/skills/index.ts` | Additive — new exports appended after last line |
| `app/page.tsx` | Additive — new import + one TABS entry |
| `lib/store.ts` | Additive — one new union member |
| `components/Sidebar.tsx` | Additive — one new nav item |

No existing exports removed. No existing behaviour changed.

---

## Byreal Skills summary

| Skill | Input | Use case |
|---|---|---|
| `mantle_get_price` | symbol | Price feed for any agent or orchestrator |
| `mantle_signal_score` | symbol | AI signal evaluation callable from any agent |
| `mantle_run_cycle` | privateKey, network, dryRun, symbols | Full cycle trigger from orchestrator |
| `mantle_benchmark_info` | agentAddress, network | Get benchmark stats + Explorer URL |
| `mantle_agent_identity` | agentId | Resolve 8004scan URL for any agentId |

**Register with Byreal CLI:**
```bash
byreal skills register --url https://YOUR_DOMAIN/api/skills/byreal
```

---

## Full build summary — Sessions N1 → N4

| Session | Files | Purpose |
|---|---|---|
| N1 | 6 new | Foundation: config, client, Bybit data, types, store, env |
| N2 | 6 new | Intelligence: ERC-8004, benchmark, loop route, register route, benchmark route, hook |
| N3 | 1 new + 4 patches | UI: MantleAgentTab dashboard + sidebar wiring |
| N4 | 5 new + 2 patches | Submission: Byreal skills, submission route, tab, docs |

**Total: 18 new files · 0 existing files replaced · ~25 lines patched across 5 files**

---

## Hackathon tracks covered

| Track | Coverage |
|---|---|
| **AI Trading & Strategy** | Bybit API, signal engine, on-chain trades, Mantle RWA (mETH/USDY), benchmarking |
| **Agentic Wallets & Economy** | Byreal Skills (5 skills), `/api/skills/byreal`, `ByrealSkillHub` |
| **Bonus: AI x RWA** | mETH + USDY configured, portfolio valuation, yield token support |

**Three Turing Test defining features:**
- ✅ #1 On-chain benchmarking — zero-value data txs on Mantle, permanent record
- ✅ #2 ERC-8004 agent identity — registered on Mantle Mainnet, linked to 8004scan
- ✅ #3 Radical transparency — live dashboard, all decisions visible + verifiable
