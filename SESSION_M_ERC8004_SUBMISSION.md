# Session M — ERC-8004 Registration (Track 3) + Submission Writeup

**Part of:** Onchain Agents Hackathon — Track 3 (Highest Rank in 8004scan for Celo).
**Depends on:** Sessions J, K, L.

## What's in this zip

```
lib/celo/erc8004.ts                  — NEW. ERC-8004 Identity Registry helper:
                                        registration file builder, on-chain
                                        data: URI encoder, register() call,
                                        8004scan link
lib/celo/client.ts                    — UPDATED (1 addition): getWallet()
                                        accessor, used by erc8004.ts
app/api/celo-agent/register/route.ts  — NEW. Registration API route
lib/celoAgentStore.ts                  — UPDATED: agentId / registrationTxHash
                                        fields + setAgentIdentity()
lib/celoAgentStore.PATCH-celo.ts       — diff reference for the above, if you've
                                        customized your Session K copy
components/tabs/CeloAgentTab.tsx       — UPDATED: new "Agent Identity · ERC-8004"
                                        card with Register button + 8004scan link
Showcase.md                            — Hackathon submission writeup
```

`lib/celo/client.ts` and `lib/celoAgentStore.ts` and
`components/tabs/CeloAgentTab.tsx` are **full updated files** (Session
J/K/L + this session's additions) — safe to drop in directly over your
existing copies. Diffs are documented in `lib/celoAgentStore.PATCH-celo.ts`
if you'd rather apply them by hand.

## What it does

Registers the Celo Payments Agent's wallet as an **ERC-8004 agent
identity** — an ERC-721 NFT minted on Celo Mainnet's Identity Registry
(`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`, verified against
docs.celo.org, June 2026). This makes the agent discoverable at
`https://8004scan.io/agents/celo/<agentId>`.

The registration file (name, description, wallet address + chainId,
`supportedTrust: ["reputation"]`) is encoded as a `data:application/json;
base64,...` URI and stored fully on-chain via the `agentURI` parameter —
**no IPFS or external hosting required**.

### Important: Mainnet only

ERC-8004 is deployed on **Celo Mainnet** (chainId 42220) and on a separate
"Celo Sepolia" testnet (a different chain from Alfajores). Since this
agent's `CeloNetwork` type only covers `mainnet` and `alfajores`,
registration is **mainnet-only** — the UI shows a clear message and
disables the Register button on Alfajores.

## How to apply

1. Apply Sessions J, K, L first.
2. Drop in `lib/celo/erc8004.ts` (new file).
3. Replace `lib/celo/client.ts` with the updated version (adds `getWallet()`).
4. Copy `app/api/celo-agent/register/route.ts` into `app/api/celo-agent/register/`.
5. Replace `lib/celoAgentStore.ts` and `components/tabs/CeloAgentTab.tsx`
   with the updated versions.
6. Copy `Showcase.md` to the repo root (overwrites the empty placeholder).

## Verified

Applied to a working copy of the full repo (Sessions J–M combined) and
typechecked (`tsc --noEmit`) — **zero new errors**. `next build` was also
run; it fails only on 2 pre-existing errors unrelated to this work
(`app/api/agent/portfolio` and `app/api/agent/status` reference a missing
`@/lib/twak/networkClient` — present in the original repo before any of
these sessions).

## Submission checklist (from the hackathon brief)

- [ ] Quote-tweet the @CeloDevs/@Celo announcement with your ERC-8004
      registry link (`https://8004scan.io/agents/celo/<agentId>`) — do this
      AFTER running the Register Agent button on Celo Mainnet.
- [ ] Fill in `Showcase.md`'s "Onchain proof" section with the real wallet
      address, agentId, and a few sample CeloScan transaction links once
      autonomous mode has run.
- [ ] Install the Celo Builders skill and run the submission flow:
      `npx skills add https://celobuilders.xyz`, then ask your agent to
      "Help me submit my project to the Celo Onchain Agents Hackathon"
      (choose `celo-onchain-agents`).
- [ ] Optional Self Agent ID verification (Track 1 FAQ) — if Self isn't
      available in your region, attach a screenshot of that message instead.

## This completes the planned build (Sessions J–M)

Recap:
- **J** — Celo execution core (wallet, balances, CELO/cUSD transfers, Mento quotes)
- **K** — Agent loop, store, API route (payment rules, guardrails, dry-run/autonomous)
- **L** — UI integration (new sidebar section + dashboard tab)
- **M** — ERC-8004 identity (Track 3) + submission writeup

All four sessions are purely additive — the existing BNB Chain trading
agent is untouched throughout.
