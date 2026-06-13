# Session N1 — Mantle Foundation

## What this session adds

Part of: **The Turing Test Hackathon — AI Trading & Strategy track** ($100,000 prize pool).

This session lays the execution and data layer for the Mantle AI Trading Agent.
**All files are new — nothing in the existing repo is modified or removed.**
The BNB, Celo, and Sui agents are completely untouched.

---

## Files in this session (all NEW)

```
lib/mantle/config.ts       ← Chain config, token addresses, ERC-8004 registry,
                              Bybit pairs, DEX routers, agent guardrails
lib/mantle/client.ts       ← MantleClient: wallet, balances, transfers,
                              guardrails, portfolio valuation
lib/bybit.ts               ← Bybit V5 REST market data (tickers, candles,
                              order book, signal scoring)
lib/mantleAgentLoop.ts     ← Shared types: MantleTradeRecord, BenchmarkRecord,
                              MantleAgentSession, helpers
lib/mantleAgentStore.ts    ← Isolated Zustand store (persistence key:
                              'binalyst-mantle-agent', private key never persisted)
.env.mantle.example        ← New env vars only (additive — don't replace
                              your existing .env.local)
```

---

## How to apply

1. Copy `lib/mantle/` into your repo's `lib/` directory.
2. Copy `lib/bybit.ts` into `lib/`.
3. Copy `lib/mantleAgentLoop.ts` into `lib/`.
4. Copy `lib/mantleAgentStore.ts` into `lib/`.
5. Add the contents of `.env.mantle.example` to your `.env.local`.
6. Fill in `MANTLE_AGENT_PRIVATE_KEY` (generate with `generateMantleWallet()`).

**No existing files are modified. No existing imports change.**

---

## Zero-conflict guarantee

| Concern | How it's handled |
|---|---|
| Store isolation | Separate persistence key `'binalyst-mantle-agent'` |
| Private key safety | `partialize` explicitly excludes `privateKey` |
| Import isolation | No existing file imports from `lib/mantle/` or `lib/bybit.ts` |
| API route isolation | New routes go under `/api/mantle-agent/` (Session N2) |
| Tab isolation | New tab registered via PATCH instructions (Session N3) |

---

## Hackathon alignment

| Hackathon feature | Session N1 contribution |
|---|---|
| On-chain benchmarking | `BenchmarkRecord` type + `encodeBenchmarkRecord()` defined |
| ERC-8004 agent identity | Registry address in `config.ts`, store fields ready |
| AI Trading & Strategy | `MantleClient`, `BybitClient`, guardrails, signal scoring |
| Bybit API support | `lib/bybit.ts` — full V5 REST implementation |
| Mantle RWA tokens | mETH + USDY configured with addresses + portfolio valuation |

---

## What's next — Session N2

- `lib/mantle/erc8004.ts` — ERC-8004 identity registration on Mantle
- `lib/mantle/benchmark.ts` — on-chain decision logger
- `app/api/mantle-agent/loop/route.ts` — server-side agent loop
- `app/api/mantle-agent/register/route.ts` — ERC-8004 registration API
- `app/api/mantle-agent/benchmark/route.ts` — benchmark query API
- `hooks/useMantleAgentLoop.ts` — client hook driving the 2-min loop
