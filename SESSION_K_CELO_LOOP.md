# Session K — Celo Agent Loop, Store & API Route

**Part of:** Onchain Agents Hackathon — Track 1 (Best Agent on Celo), feeds Track 2 (activity).
**Depends on:** Session J (`lib/celo/config.ts`, `lib/celo/client.ts`) — apply that first.

## What's in this zip

All files are **new** — nothing in the existing repo is modified.
The BNB competition agent (`lib/agentStore.ts`, `lib/agentLoop.ts`,
`hooks/useAgentLoop.ts`, `app/api/agent/loop/route.ts`, etc.) is completely
untouched — this is a fully parallel module.

```
lib/celoAgentLoop.ts              — shared types: PaymentRule, PaymentRecord,
                                     CeloLoopCycleResult, isPaymentDue(), etc.
lib/celoAgentStore.ts              — zustand store (separate persistence key
                                     'binalyst-celo-agent', private key never
                                     persisted)
app/api/celo-agent/loop/route.ts   — server loop: evaluates due payment
                                     rules, runs guardrails, executes via
                                     CeloClient
hooks/useCeloAgentLoop.ts          — client hook: start/stop loop, runs
                                     every 2 min, updates store
```

## How it works

The Celo agent is framed around the hackathon's "Real World Payments &
Everyday Applications" track: instead of speculative trading, it manages a
small list of **payment rules** — e.g. "send 1 cUSD to 0xAbc... every day."

Each loop cycle (every 2 minutes, same cadence as the BNB agent):

1. Fetches the wallet's CELO + cUSD balances and CELO/USD price (via Mento,
   mainnet only — see Session J notes)
2. Checks which payment rules are "due" (`isPaymentDue` — never run, or
   their frequency window elapsed)
3. Runs `checkPaymentGuardrails` from Session J (balance, gas reserve,
   per-payment cap, dust floor, daily cap)
4. Depending on `agentConfig`:
   - **`dryRun: true`** (default) — simulates the payment, advances the
     schedule, records a `'simulated'` entry. Nothing is sent on-chain.
   - **`dryRun: false, autonomousMode: false`** — due payments are evaluated
     but recorded as `'blocked'` with reason "Autonomous mode disabled."
     Schedule does NOT advance, so it stays due.
   - **`dryRun: false, autonomousMode: true`** — sends a real `sendCUSD` /
     `sendCELO` transaction. On success, records `'confirmed'` with `txHash`
     and advances the schedule. On failure, records `'failed'` and the
     schedule does NOT advance (will retry next cycle).

This gives a safe default (dry-run simulation) for development/demo, and a
single config flip (`autonomousMode: true` + `dryRun: false`) to go live —
which is when this starts generating real Track 2 activity.

## How to apply

1. Make sure Session J's `lib/celo/` is already in place.
2. Copy `lib/celoAgentLoop.ts` and `lib/celoAgentStore.ts` into `lib/`.
3. Copy `app/api/celo-agent/loop/route.ts` into `app/api/celo-agent/loop/`.
4. Copy `hooks/useCeloAgentLoop.ts` into `hooks/`.
5. No existing files touched — builds standalone. UI wiring (a tab/page to
   actually use `useCeloAgentLoop`, set up a wallet, and add payment rules)
   is Session L.

## Next session (L)

- `components/tabs/CeloAgentTab.tsx` — new tab: wallet setup/import, network
  selector, payment rule editor (recipient, token, amount, frequency),
  live status (balances, next run, payment log)
- Small PATCH additions to `Sidebar.tsx` / `MobileDrawer.tsx` / `BottomNav.tsx`
  to surface the new tab
