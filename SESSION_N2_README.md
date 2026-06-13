# Session N2 — Agent Loop, API Routes & On-Chain Benchmarking

## What this session adds

The intelligence and execution layer for the Mantle AI Trading Agent.
**All 6 files are new — no existing file is modified or removed.**

---

## Files in this session (all NEW)

```
lib/mantle/erc8004.ts                       ← ERC-8004 identity registration
                                              on Mantle Mainnet (hackathon feature #2)

lib/mantle/benchmark.ts                     ← On-chain decision logger via
                                              zero-value data transactions (hackathon feature #1)

app/api/mantle-agent/loop/route.ts          ← Server-side agent loop:
                                              Bybit prices → signal score →
                                              guardrails → trade → benchmark

app/api/mantle-agent/register/route.ts      ← ERC-8004 agent identity
                                              registration API

app/api/mantle-agent/benchmark/route.ts     ← Benchmark GET (metadata + sink URL)
                                              and POST (write record on-chain)

hooks/useMantleAgentLoop.ts                 ← Client-side hook: 2-min loop,
                                              session tracking, store sync,
                                              registerAgent()
```

---

## How to apply

1. Copy `lib/mantle/erc8004.ts` → `lib/mantle/erc8004.ts`
2. Copy `lib/mantle/benchmark.ts` → `lib/mantle/benchmark.ts`
3. Copy `app/api/mantle-agent/loop/route.ts` → `app/api/mantle-agent/loop/route.ts`
4. Copy `app/api/mantle-agent/register/route.ts` → `app/api/mantle-agent/register/route.ts`
5. Copy `app/api/mantle-agent/benchmark/route.ts` → `app/api/mantle-agent/benchmark/route.ts`
6. Copy `hooks/useMantleAgentLoop.ts` → `hooks/useMantleAgentLoop.ts`

**No existing files are modified.**

---

## Zero-conflict guarantee

| Concern | How it's handled |
|---|---|
| API route isolation | All routes under `/api/mantle-agent/` — no overlap with `/api/agent/` or `/api/celo-agent/` |
| Rate limit buckets | `mantle-loop`, `mantle-register`, `mantle-benchmark-get`, `mantle-benchmark-post` — all new keys |
| Hook isolation | `useMantleAgentLoop` imports only from N1 store/types + N2 files |
| Store writes | Only calls `useMantleAgentStore` — never touches `useAgentStore`, `useCeloAgentStore`, `useSuiStore` |

---

## Hackathon feature coverage after N2

| Feature | Status |
|---|---|
| **#1 On-chain benchmarking** | ✅ `lib/mantle/benchmark.ts` + loop route writes decisions to Mantle |
| **#2 ERC-8004 agent identity** | ✅ `lib/mantle/erc8004.ts` + register route |
| **#3 Radical transparency** | 🔜 N3 — live dashboard with real-time decision display |
| Bybit API support | ✅ `lib/bybit.ts` (N1) consumed by loop route |
| AI Trading & Strategy | ✅ Signal scoring → guardrails → execution in loop route |
| Mantle RWA (mETH, USDY) | ✅ Configured in N1, balanced in loop route |

---

## What's next — Session N3

- `components/tabs/MantleAgentTab.tsx` — full dashboard UI
- `lib/store.PATCH-mantle.md` — add `'mantle-agent'` to ActiveTab union (2-line patch)
- `components/Sidebar.PATCH-mantle.md` — add Mantle section (3-line patch)
- `components/MobileDrawer.PATCH-mantle.md` — add section to drawer (1-line patch)
- `app/page.PATCH-mantle.md` — register tab in TABS map (2-line patch)
