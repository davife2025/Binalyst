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

---

# Binalyst — Autonomous Agent Wallet
### Sui Overflow 2026: Agentic Web Track · Sub-track 2

## One-line description

An autonomous AI trading agent that executes strategies on Sui's DeepBook order book under a hard on-chain budget ceiling enforced by a Move policy object — without requiring a human signature for every trade.

## Tracks targeted

- **Agentic Web — Sub-track 2 (Autonomous Agent Wallet)**: the agent holds a capped budget enforced in Move (`check_and_spend` aborts with `EBudgetExceeded` if the ceiling is hit), executes real DeepBook orders autonomously, emits `TradeExecuted` events as a permanent on-chain activity log, and supports owner revocation via `revoke_policy` — all five sub-track requirements met.

## What it does

Binalyst is a BNB Chain AI trading platform. This module adds a fully independent **Sui Agent Wallet** alongside the existing BNB, Celo, and Mantle agents — same dashboard, new sidebar section ("Sui Agent", Sui blue).

The agent:
1. Reads live signal snapshots from the existing CMC signal engine
2. Scores signals against a configurable threshold
3. For each qualifying signal, calls `check_and_spend` on-chain to enforce the budget ceiling atomically
4. Places a market order on DeepBook (SUI/USDC pool)
5. Emits a `TradeExecuted` event — the permanent on-chain activity log
6. Owner can revoke the policy at any time — `revoke_policy` blocks all future agent trades

## Architecture

```
lib/sui/client.ts              Sui RPC helpers, balance, tx status
lib/sui/types.ts               Shared types across the Sui module
lib/suiAgent/agentLoop.ts      Parallel agent loop (isolated from BNB agent)
lib/movePolicy/client.ts       Policy type, PTB builders, enforcement helpers
lib/deepbook/client.ts         DeepBook order book, order placement
lib/deepbook/types.ts          Pool, Order, Fill, OrderBook types
lib/walrus/activityLog.ts      Walrus blob activity log (supplemental)
lib/store.sui.ts               Isolated Zustand store (own persistence key)
hooks/useSuiAgentLoop.ts       Client hook driving the loop
move/sources/agent_policy.move Core Move contract — 5 constraints enforced
move/tests/agent_policy_tests  9 test cases covering all constraints
app/api/sui/wallet/route.ts    Balance endpoint
app/api/sui/policy/route.ts    Create/fetch policy
app/api/sui/agent/route.ts     Agent health + config
app/api/sui/revoke/route.ts    Revocation PTB builder
app/api/deepbook/order/route.ts Place/cancel orders + Walrus log
app/api/deepbook/pools/route.ts Pool list + order book
components/tabs/SuiAgentTab.tsx Main agent UI (wallet, policy, agent, activity)
components/tabs/DeepBookTab.tsx Order book, order placement, Walrus log viewer
components/tabs/RevocationDemo  Owner kill switch demo panel
```

## Why Sui specifically

- **Move shared objects** — the policy is on-chain state both owner and agent access
- **PTBs** — `check_and_spend` + DeepBook order placement are atomic in one transaction
- **Move abort codes** — budget enforcement is a hard revert, not a soft check
- **Sui events** — the activity log is permanently indexed, not a database
- **DeepBook** — real on-chain order book, not a wrapped CEX

Remove Sui and none of the enforcement properties hold.

## Sub-track 2 requirements — met

| Requirement | Implementation |
|---|---|
| Real DeepBook orders | `POST /api/deepbook/order` → DeepBook testnet pool |
| Self-enforced budget ceiling | `check_and_spend` in Move — aborts with `EBudgetExceeded` |
| On-chain activity log | `TradeExecuted` event emitted per trade — queryable via `suix_queryEvents` |
| Owner revocation demo | `revoke_policy` entry fn — `EPolicyRevoked` blocks all future agent calls |

## Safety model

Agent defaults to **dry-run mode** — evaluates signals and simulates orders but sends nothing on-chain. `autonomousMode: true` + `dryRun: false` switches to live execution. The Move policy enforces the budget ceiling even in live mode.

## Onchain proof

- **Policy object ID**: `<fill in after deploy>`
- **Package ID**: `<fill in after: bash scripts/deploy-sui.sh>`
- **Sample TradeExecuted events**:
  ```
  sui client events \
    --query '{"MoveEventType": "<PACKAGE_ID>::agent_policy::TradeExecuted"}' \
    --limit 10
  ```

## How to run it

1. Deploy the Move package: `bash scripts/deploy-sui.sh`
2. Set `NEXT_PUBLIC_POLICY_PACKAGE_ID` in `.env.local` (script does this automatically)
3. Open the **Sui Agent** tab in the sidebar
4. Connect a Sui wallet address (testnet)
5. Deploy a policy (budget cap + per-trade limit)
6. Start the agent — it reads CMC signals and places DeepBook orders
7. Open **Revocation** tab to demonstrate the owner kill switch
