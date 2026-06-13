# Session J — Celo Agent Core (Foundations)

**Part of:** Onchain Agents Hackathon — Track 1 (Best Agent on Celo), feeds Track 2 (activity) and Track 3 (8004scan).

## What's in this zip

All files are **new** — nothing in the existing repo is modified or removed.
The BNB competition agent (`lib/twak/client.ts`, `lib/agentLoop.ts`, `lib/agentStore.ts`,
`hooks/useAgentLoop.ts`, etc.) is completely untouched.

```
lib/celo/config.ts      — Celo network config: chain IDs, RPCs, token addresses,
                           Mento Broker addresses, agent defaults/guardrails
lib/celo/client.ts       — CeloClient: wallet, balances, CELO/cUSD transfers
                           ("payments"), Mento swap quotes (mainnet only),
                           payment guardrails, wallet helper functions
.env.celo.example         — new env vars needed (additive — don't replace
                           your existing .env)
```

## How to apply

1. Copy `lib/celo/` into your repo's `lib/` directory.
2. Copy the contents of `.env.celo.example` into your `.env.local`
   (or keep as a separate file and load it) — fill in `CELO_AGENT_PRIVATE_KEY`.
3. To get a wallet + testnet funds:
   ```ts
   import { generateCeloWallet } from '@/lib/celo/client'
   const w = generateCeloWallet()
   console.log(w.address, w.privateKey)
   ```
   Then fund the address via the Alfajores faucet: https://faucet.celo.org/alfajores
4. No build/runtime changes yet — this session is the execution layer only.
   Session K wires this into an agent loop + store + API route.

## Design notes / what to verify before mainnet use

- **cUSD is treated as 1:1 USD** for portfolio valuation (it's a Mento
  stablecoin pegged to USD) — `getPortfolioValueUSD()`.
- **CELO price** comes from a live Mento quote (CELO → cUSD), mainnet only.
  On Alfajores this returns 0, so CELO holdings don't count toward portfolio
  value on testnet — by design, keeps payment caps conservative.
- **Mento swaps (`swapViaMento`, `getMentoQuote`)** are mainnet-only. The
  Broker/BiPoolManager addresses are taken from Mento's official docs
  (June 2026) but have NOT been transaction-tested yet — treat as
  experimental until a real testnet/mainnet swap has been verified.
  The core "payment" use case (`sendCUSD` / `sendToken` / `sendCELO`)
  doesn't depend on this at all.
- **Guardrails (`checkPaymentGuardrails`)** mirror the spirit of the BNB
  competition's guardrails (drawdown/eligibility checks) but are simpler:
  balance checks, gas reserve, per-payment cap (20% of balance), dust floor,
  and a daily payment count cap — tunable in `CELO_AGENT_RULES`
  (`lib/celo/config.ts`).

## Next session (K)

- `lib/celoAgentStore.ts`, `hooks/useCeloAgentLoop.ts`,
  `app/api/celo-agent/loop/route.ts` — parallel agent loop reusing
  `signalEngine` for decisions, executing via `CeloClient` from this session.
