# Binalyst — Mantle AI Trading Agent
## The Turing Test Hackathon — Phase 2: AI Awakening
### AI Trading & Strategy Track + Agentic Wallets & Economy Track

> Submitted to: [DoraHacks — Mantle Turing Test Hackathon 2026](https://dorahacks.io/hackathon/mantleturingtesthackathon2026/detail)
> Prize pool: $100,000 · Phase 2: AI Awakening
> Team: Binalyst

---

## Project Overview

Binalyst Mantle AI Trading Agent is an autonomous on-chain trading agent that:

1. **Fetches live market data from Bybit** (V5 REST API — MNTUSDT, ETHUSDT, BTCUSDT and more)
2. **Scores each signal 0–100** using a momentum + range-position model and executes BUY/SELL/HOLD decisions
3. **Executes trades on Mantle Network** (MNT native + mETH RWA + USDY RWA + USDC)
4. **Records every decision permanently on Mantle** via zero-value data transactions — The Turing Test's defining feature #1
5. **Holds a verified ERC-8004 identity NFT** on Mantle Mainnet — defining feature #2
6. **Exposes 5 Byreal Skills** for the Agentic Wallets & Economy track
7. **Streams every decision live** to the Binalyst dashboard — defining feature #3 (radical transparency)

The agent runs every 2 minutes, evaluates configured Bybit pairs, applies on-chain guardrails, and produces a verifiable, permanently indexed decision log on Mantle.

---

## The Three Defining Features

### Feature #1 — On-Chain Benchmarking

Every agent decision (BUY/SELL/HOLD, signal score, price, reasoning) is encoded as compact JSON and written to Mantle as a **zero-value data transaction** sent to a known benchmark sink address:

```
Sink: 0x0000000000000000000000000000000000000001
```

This requires no smart contract deployment — only MNT gas (~0.02 gwei typical on Mantle). Records are permanently indexed on the Mantle explorer and queryable via `eth_getLogs` on the sink address.

Each record encodes:
- Agent wallet address (truncated)
- Unix timestamp
- Symbol (e.g. `MNTUSDT`)
- Decision: `BUY | SELL | HOLD`
- Signal score: `0–100`
- Price at decision time
- Whether the trade was executed on-chain
- Trade tx hash (if executed)
- Reasoning string (80 chars)

**Result:** A permanent, decentralised, cryptographically verifiable performance record — the first of its kind in Web3.

### Feature #2 — ERC-8004 Agent Identity

The agent's wallet is registered as an ERC-8004 (Trustless Agents) identity NFT on **Mantle Mainnet** via the official registry contract. The registration file is encoded entirely on-chain as a `data:application/json;base64,...` URI — no IPFS or external hosting.

The minted `agentId` links the agent's on-chain decisions, trade history, and identity in one verifiable record on 8004scan.io.

### Feature #3 — Radical Transparency

The Binalyst dashboard streams every agent cycle in real time:
- Live Bybit prices (updated every 2 minutes)
- Signal scores for each evaluated pair
- Guardrail outcomes (blocked / simulated / executed)
- On-chain benchmark count with direct Explorer link
- Full trade log with tx hashes

All decisions are verifiable independently — anyone can inspect the benchmark sink address on the Mantle explorer.

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Binalyst Frontend (Next.js 15)               │
│   MantleAgentTab.tsx ←→ useMantleAgentLoop.ts ←→ mantleAgentStore.ts │
└────────────────────────┬────────────────────────────────────────┘
                         │ POST every 2 min
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              /api/mantle-agent/loop (Next.js API route)         │
│  1. Bybit V5 REST → live prices for MNTUSDT, ETHUSDT, BTCUSDT  │
│  2. bybitTickerToSignalScore() → score 0-100, BUY/SELL/HOLD    │
│  3. checkTradeGuardrails() → enforce all 6 guardrails           │
│  4. Execute trade (dry-run OR live via MantleClient)            │
│  5. writeBenchmarkRecord() → zero-value data tx on Mantle       │
└────────────────────────┬────────────────────────────────────────┘
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
   ┌──────────────────┐   ┌──────────────────────┐
   │ Mantle Network   │   │ Bybit V5 REST API     │
   │ chainId: 5000    │   │ (no auth for market)  │
   │ MNT, mETH, USDY  │   │ MNTUSDT, ETHUSDT,    │
   │ USDC, USDT, wETH │   │ BTCUSDT, BNBUSDT...  │
   └──────────────────┘   └──────────────────────┘
```

**Stack:**
- Next.js 15, TypeScript, Tailwind CSS
- Zustand (isolated store: `'binalyst-mantle-agent'`)
- ethers.js v5 (wallet, balances, transfers, benchmark writes)
- Bybit V5 REST (public — no API key required for market data)
- Anthropic Claude (submission writeup generation)
- Byreal Skills CLI (5 skills, `/api/skills/byreal`)

---

## Mantle Network Integration

**Tokens configured:**

| Symbol | Address | Type |
|--------|---------|------|
| MNT    | 0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8 | Native gas token |
| mETH   | 0xcDA86A272531e8640cD7F1a92c01839911B90bb0 | RWA — Mantle Staked ETH |
| USDY   | 0x5bE26527e817998A7206475496fDE1E68957c5A6 | RWA — Ondo US Dollar Yield |
| USDC   | 0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9 | Stablecoin |
| USDT   | 0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE | Stablecoin |
| wETH   | 0xdEAddEaDdeadDEadDEADDEAddEADDEAddead1111 | Wrapped ETH |

**DEX routing:** Merchant Moe (`0xeaEE7EE68874218c3558b40063c42B82D3E7232a`) + Agni Finance (`0x319B69888b0d11cEC22caA5034e25FfFBDc88421`)

**Networks:** Mantle Mainnet (5000) + Mantle Sepolia testnet (5003)

---

## AI Decision Engine & Guardrails

**Signal scoring** (`bybitTickerToSignalScore`):
- Momentum component: 24h price change → ±20 points
- Range position: price vs 24h high/low → ±15 points  
- Spread penalty: wide spread → −5 points
- Score ≥ 65 → BUY · Score ≤ 35 → SELL · Otherwise → HOLD

**Six on-chain guardrails** (enforced server-side, not bypassable by UI):
1. Token must exist on the configured network
2. MNT gas reserve: always keep ≥ 0.05 MNT
3. Per-trade cap: single trade ≤ 15% of portfolio
4. Dust floor: minimum $1.00 trade value
5. Drawdown circuit breaker: auto-pause if drawdown ≥ 20%
6. Daily trade cap: ≤ 10 trades per day

**Modes:**
- **Dry-run** (default): signals evaluated, no on-chain transactions, benchmark records still written
- **Autonomous**: full on-chain execution via `MantleClient`

---

## Byreal Skills Integration

Five skills registered at `/api/skills/byreal` (Agentic Wallets & Economy track):

| Skill | Description |
|-------|-------------|
| `mantle_get_price` | Fetch Bybit spot price for any USDT pair |
| `mantle_signal_score` | Score a symbol 0–100 with BUY/SELL/HOLD direction |
| `mantle_run_cycle` | Trigger one full agent decision cycle |
| `mantle_benchmark_info` | Get on-chain benchmark stats for an agent |
| `mantle_agent_identity` | Get ERC-8004 identity info for an agent |

**Registration:**
```bash
byreal skills register --url https://YOUR_DOMAIN/api/skills/byreal
```

**Test:**
```bash
curl -X POST https://YOUR_DOMAIN/api/skills/byreal \
  -H "Content-Type: application/json" \
  -d '{"skill":"mantle_signal_score","input":{"symbol":"MNTUSDT"}}'
```

---

## Self-Custody Design

- Agent wallet is generated client-side (`generateMantleWallet()` using `ethers.Wallet.createRandom()`)
- Private key is encrypted with the user's password via `ethers.Wallet.encrypt()` (AES-256)
- Encrypted keystore is stored in `localStorage` — private key is explicitly excluded from Zustand persist (`partialize`)
- Private key is sent to the API loop route per-request (over HTTPS) and used transiently — never logged, never stored server-side
- ERC-8004 registration and benchmark writes are signed client-side via the loaded wallet

---

## How to Run the Demo

### 1. Apply Session N1–N4 files
Follow the README in each session zip (N1 → N2 → N3 → N4).
Apply the 4 patches from Session N3 (store.ts, Sidebar.tsx, MobileDrawer.tsx, page.tsx).
Apply the 1 patch from Session N4 (lib/skills/index.ts).

### 2. Configure environment
```bash
# Add to .env.local (do not replace existing vars)
MANTLE_AGENT_NETWORK=testnet
MANTLE_AGENT_PRIVATE_KEY=   # generate in the UI or with generateMantleWallet()
```

### 3. Start the app
```bash
npm install   # ethers should already be installed
npm run dev
```

### 4. Navigate to Mantle Agent tab
- Sidebar → ⬡ Mantle Agent
- Set up wallet (Generate New or Import)
- Fund with testnet MNT: https://faucet.sepolia.mantle.xyz
- Click **Run Once** to trigger a cycle
- Observe: Bybit prices → signal scores → trade decisions → benchmark records

### 5. Register ERC-8004 identity
- Switch to Mantle Mainnet
- Fund with real MNT (bridge via bridge.mantle.xyz)
- Click **Register Agent (ERC-8004)**
- View on 8004scan.io

### 6. View on-chain benchmark log
- Every live (non-dry-run) decision is written to Mantle
- View at: https://explorer.mantle.xyz/address/0x0000000000000000000000000000000000000001

### 7. Navigate to Mantle Submission tab (Sidebar → 🏆)
- Run checklist
- Click **Generate Submission** for AI-written writeup
- Download Byreal manifest
- Submit on DoraHacks

---

## Platform Context

Binalyst is a multi-chain AI trading + payments platform. The Mantle module (Sessions N1–N4) is fully additive — zero existing files were modified or removed. Other chains remain fully functional:

| Chain | Agent | Status |
|-------|-------|--------|
| BNB Chain | AI Trading Agent (Sessions A–G) | Unchanged |
| Celo | Payments Agent + ERC-8004 (Sessions J–M) | Unchanged |
| Sui | Move policy contract (Sessions J–M) | Unchanged |
| **Mantle** | **AI Trading Agent (Sessions N1–N4)** | **New** |

---

*Built for The Turing Test Hackathon Phase 2: AI Awakening — Mantle Network — 2026*
