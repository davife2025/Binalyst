# Binalyst — Celo Payments Agent
### Onchain Agents Hackathon: Build for Real World Payments & Everyday Applications

## One-line description

An autonomous agent that manages recurring CELO/cUSD payments on Celo —
allowances, subscriptions, and DCA-style transfers — with onchain identity
via ERC-8004.

## Tracks targeted

- **Track 1 — Best Agent on Celo**: the agent runs a continuous decision
  loop (every 2 minutes) that evaluates a set of user-defined payment
  rules, checks guardrails, and executes real CELO/cUSD transfers
  autonomously and self-custodially.
- **Track 2 — Most Activity (Onchain Transactions)**: each due payment rule
  generates a real onchain transaction on its configured schedule (hourly /
  daily / weekly), so the agent produces a steady stream of verifiable
  transactions once running in autonomous mode.
- **Track 3 — Highest Rank in 8004scan for Celo**: the agent's wallet is
  registered as an ERC-8004 agent identity (an ERC-721 NFT) on Celo
  Mainnet's Identity Registry, making it discoverable at
  `https://8004scan.io/agents/celo/<agentId>`.

## What it does

Binalyst is a BNB Chain AI trading platform. This module adds a fully
independent **Celo Payments Agent** alongside the existing BNB trading
agent — same dashboard, new sidebar section ("Celo Agent", Celo brand
yellow).

The agent holds its own self-custodial Celo wallet (password-encrypted
locally, private key never leaves the browser/server pair it's generated
in) and manages a list of **payment rules**:

```
1 cUSD → 0xRecipient... · Daily
0.5 CELO → 0xRecipient... · Weekly
```

Every 2 minutes, the agent loop:
1. Reads the wallet's live CELO + cUSD balances (and CELO/USD price via
   Mento, on mainnet)
2. Checks which rules are due
3. Runs guardrails — balance checks, gas reserve, a 20%-of-balance
   per-payment cap, a dust floor, and a daily payment cap
4. Sends the payment (or simulates it in dry-run mode) and logs the result

## Architecture

```
lib/celo/config.ts        — Celo chain config: RPCs, token addresses (CELO, cUSD),
                             Mento Broker addresses (CeloScan-verified)
lib/celo/client.ts         — CeloClient: balances, CELO/cUSD transfers, Mento
                             swap quotes, payment guardrails
lib/celo/erc8004.ts         — ERC-8004 Identity Registry integration (Track 3)
lib/celoAgentLoop.ts        — Payment rule types & scheduling helpers
lib/celoAgentStore.ts       — Independent zustand store (own persistence key,
                             private key never persisted)
app/api/celo-agent/loop/route.ts     — Server loop: evaluate rules → guardrails → execute
app/api/celo-agent/register/route.ts — ERC-8004 registration
hooks/useCeloAgentLoop.ts            — Client hook driving the loop
components/tabs/CeloAgentTab.tsx     — Dashboard: wallet, balances, rules, log, identity
```

This is a **fully parallel module** — it shares no code with, and makes no
changes to, the existing BNB Chain trading agent (`lib/twak/`,
`lib/agentLoop.ts`, `lib/agentStore.ts`). Both agents run side-by-side in
the same app.

## Safety model

The agent defaults to **dry-run mode**: it evaluates rules, simulates
payments, and advances the schedule, but sends nothing onchain. A single
config flip (`dryRun: false` + `autonomousMode: true`) switches it to
sending real transactions — this is the mode used to generate Track 2
activity.

## Onchain proof

- **Agent wallet address**: `<fill in after first run>`
- **ERC-8004 agent identity**: `<fill in agentId after registration>`
  → `https://8004scan.io/agents/celo/<agentId>`
- **Sample payment transactions**: `<fill in CeloScan tx links after
  autonomous mode has been enabled and the loop has run>`

## ERC-8004 registry

- Identity Registry (Celo Mainnet): `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- Registration file is stored fully onchain as a `data:application/json;
  base64,...` URI (no IPFS dependency) — see `lib/celo/erc8004.ts`.

## How to run it

1. Apply Sessions J–M (see each session's README for file lists).
2. Open the "Celo Agent" tab in the sidebar.
3. Generate or import a wallet, fund it (Alfajores: faucet.celo.org/alfajores,
   Mainnet: bridge/buy CELO + cUSD).
4. Add payment rules (recipient, token, amount, frequency).
5. Switch to Celo Mainnet, register the agent identity (ERC-8004 card).
6. Toggle off dry-run + on autonomous mode, and start the agent.
