# Binalyst — Autonomous Agent Wallet
## Sui Overflow 2026 · Agentic Web Track · Sub-track 2

---

### What it is

Binalyst is an autonomous AI trading agent that executes strategies on Sui's
DeepBook order book under a hard on-chain budget constraint enforced by a Move
policy object — without requiring a human signature for every trade.

The agent cannot spend beyond its ceiling. The owner can revoke at any time.
Every trade is logged as an on-chain event. All of this is enforced in Move,
not just client-side.

---

### Sub-track 2 requirements — how we meet each one

| Requirement | How Binalyst meets it |
|---|---|
| Real DeepBook orders | Agent places limit/market orders on DeepBook testnet pools via PTB calls |
| Self-enforced budget ceiling | `check_and_spend` in `agent_policy.move` aborts with `EBudgetExceeded` if cap exceeded — enforced on-chain |
| On-chain activity log | Every trade emits a `TradeExecuted` event on-chain; queryable via Sui RPC `suix_queryEvents` |
| Owner revocation demo | `revoke_policy` entry fn sets `revoked = true`; any subsequent agent call aborts with `EPolicyRevoked` |

---

### Architecture

```
Owner wallet
  │ deploys
  ▼
AgentPolicy (Move object, shared)
  ├── budget_cap_cents: 50000        ($500 hard ceiling)
  ├── per_trade_limit_cents: 5000    ($50 max per trade)
  ├── agent: 0x1234…                 (only address that can spend)
  ├── owner: 0xABCD…                 (only address that can revoke)
  └── revoked: false

AI Signal Engine (existing Binalyst)
  │ produces signal snapshots
  ▼
SuiAgentLoop (lib/suiAgent/agentLoop.ts)
  │ reads signals → scores → decides
  ▼
check_and_spend (on-chain, atomic)
  │ passes → agent places DeepBook order
  │ fails  → trade blocked, error logged
  ▼
TradeExecuted event (on-chain activity log)
  │
  ▼
DeepBook pool (SUI/USDC testnet)
```

---

### Codebase structure (Sui module — all new files, no existing code modified)

```
lib/
  sui/
    client.ts          Sui RPC helpers, balance, tx status
    types.ts           Shared types across the Sui module
  suiAgent/
    agentLoop.ts       Parallel agent loop (isolated from Binalyst's BNB agent)
    types.ts           Re-exports
  movePolicy/
    client.ts          Policy type, PTB builders, enforcement helpers
  store.sui.ts         Isolated Zustand store (separate from store.ts)

move/
  Move.toml            Package manifest
  sources/
    agent_policy.move  Core Move contract
  tests/
    agent_policy_tests.move  8 test cases covering all constraints

app/api/
  sui/
    wallet/route.ts    Balance endpoint
    policy/route.ts    Create/fetch policy
    agent/route.ts     Agent health + config
    revoke/route.ts    Revocation PTB builder

components/tabs/
  SuiAgentTab.tsx      Main agent UI (wallet, policy, agent, activity log)
  DeepBookTab.tsx      Order book, order placement, order history
  RevocationDemo.tsx   Owner kill switch demo panel
```

---

### Move contract — key design decisions

**Why a shared object?**
The policy must be accessible by both the owner (to revoke) and the agent
(to spend). Sui's shared objects allow this without a capability pattern
that the agent could forge.

**Why `check_and_spend` as an entry function?**
The agent calls it as part of the same PTB that places the DeepBook order.
If `check_and_spend` aborts, the entire PTB rolls back — the DeepBook order
is never placed. This makes the budget ceiling truly atomic and unbypassable.

**Why events for the activity log?**
Sui events are permanently indexed on-chain and queryable via
`suix_queryEvents` by `MoveEventType`. Judges can independently verify
every trade the agent ever made without trusting Binalyst's UI.

---

### Demo walkthrough (for judges)

**Step 1 — Deploy the Move package**
```bash
cd move/
sui client publish --gas-budget 100000000
# Note the package ID → set NEXT_PUBLIC_POLICY_PACKAGE_ID in .env.local
```

**Step 2 — Create a policy**
- Open the app → Sui Agent tab → Policy sub-tab
- Enter agent wallet address, budget cap ($500), per-trade limit ($50)
- Click "Deploy policy on Sui testnet"
- Sign the PTB with your owner wallet
- Note the policy object ID from the transaction

**Step 3 — Start the agent**
- Sui Agent tab → Agent sub-tab
- Confirm dry-run is ON (no real funds for the demo)
- Click "Start Sui agent"
- Watch the Activity sub-tab fill with decisions

**Step 4 — See the order book**
- DeepBook tab → Order Book view
- Place a manual dry-run order
- Check Order History — each entry shows its Walrus blob ID

**Step 5 — Query on-chain events (independent verification)**
```bash
sui client events \
  --query '{"MoveEventType": "binalyst_policy::agent_policy::TradeExecuted"}' \
  --limit 10
```
Every trade the agent made appears here. This is the on-chain activity log.

**Step 6 — Demonstrate revocation**
- Sui Agent tab → Policy sub-tab → "Revoke policy (owner kill switch)"
- Confirm — sign PTB with owner wallet
- Or open RevocationDemo tab for the narrated demo flow
- Agent loop now blocked: next cycle attempt → `EPolicyRevoked` abort

**Step 7 — Verify revocation on-chain**
```bash
sui client events \
  --query '{"MoveEventType": "binalyst_policy::agent_policy::PolicyRevoked"}' \
  --limit 1
```

---

### Running the Move tests

```bash
cd move/
sui move test
```

Expected output:
```
Running Move unit tests
[ PASS ] binalyst_policy::agent_policy_tests::test_create_policy
[ PASS ] binalyst_policy::agent_policy_tests::test_check_and_spend_success
[ PASS ] binalyst_policy::agent_policy_tests::test_per_trade_limit_exceeded
[ PASS ] binalyst_policy::agent_policy_tests::test_budget_cap_exceeded
[ PASS ] binalyst_policy::agent_policy_tests::test_only_agent_can_spend
[ PASS ] binalyst_policy::agent_policy_tests::test_revocation_flow
[ PASS ] binalyst_policy::agent_policy_tests::test_trade_after_revocation_fails
[ PASS ] binalyst_policy::agent_policy_tests::test_only_owner_can_revoke
[ PASS ] binalyst_policy::agent_policy_tests::test_can_trade_view
Test result: OK. Total tests: 9; passed: 9; failed: 0
```

---

### Running the app

```bash
npm install
cp .env.example .env.local
# Fill in: NEXT_PUBLIC_POLICY_PACKAGE_ID (after Move deploy)
npm run dev
```

Open http://localhost:3000 → navigate to the Sui Agent tab.

---

### Why Sui specifically?

This project is not a generic LLM wrapper that happens to touch a blockchain.
Sui's primitives are load-bearing:

- **Move shared objects** — the policy is on-chain state both parties access
- **PTBs** — `check_and_spend` + DeepBook order placement are atomic in one tx
- **Move abort codes** — budget enforcement is a hard revert, not a soft check
- **Sui events** — the activity log is permanently indexed, not a database
- **DeepBook** — real on-chain order book, not a wrapped CEX

Remove Sui and none of the enforcement properties hold.

---

### Team

Built for Sui Overflow 2026 on top of the Binalyst trading agent foundation.
