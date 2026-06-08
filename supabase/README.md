# Binalyst — Session A: Foundation & Integration Setup

## What was built

### New files
```
lib/twak/client.ts          — Trust Wallet Agent Kit: local signing, BSC swaps, competition registration
lib/skills/cmc.ts           — CoinMarketCap AI Agent Hub: Fear & Greed, signals, trending, x402
lib/agentStore.ts           — Zustand store for agent wallet, session, trades, signals, strategy
app/api/agent/register/route.ts  — POST: register agent wallet in competition contract on BSC
app/api/agent/status/route.ts    — POST: fetch BNB + token balances, registration state
app/api/cmc/route.ts             — GET: CMC proxy (fear_greed, signals, trending, tokens, eligible)
components/tabs/AgentWalletTab.tsx — Full wallet setup UI (generate/import/unlock/register)
.env.example                — Updated with CMC_API_KEY, TWAK_API_KEY, BNB_AGENT_RPC
package.additions.json      — ethers@^6.13.4 dependency
```

### Patch files (manual edits needed)
```
lib/store.PATCH.ts    — Add 'agent-wallet' to activeTab union type
app/page.PATCH.ts     — Import AgentWalletTab, add to TABS, add to Sidebar nav
```

## Integration steps

### 1. Install dependency
```bash
npm install ethers@^6.13.4
```

### 2. Environment variables
Copy new vars from `.env.example` into your `.env.local`:
```
CMC_API_KEY=your_cmc_pro_api_key
TWAK_API_KEY=your_twak_api_key
TWAK_PROJECT_ID=your_twak_project_id
NEXT_PUBLIC_COMPETITION_CONTRACT=0x212c61b9b72c95d95bf29cf032f5e5635629aed5
```

Get CMC key: https://coinmarketcap.com/api/
Get TWAK key: https://portal.trustwallet.com

### 3. Apply store patch
In `lib/store.ts`, add `'agent-wallet'` to the `activeTab` union type.

### 4. Apply page patch
In `app/page.tsx`:
- Import `AgentWalletTab`
- Add `'agent-wallet': <AgentWalletTab />` to TABS
- Add to `Sidebar.tsx` NAV_MAIN: `{ id: 'agent-wallet', label: 'Agent Wallet', icon: '🔐' }`

### 5. Test
```
GET  /api/cmc?action=fear_greed       → Fear & Greed index
GET  /api/cmc?action=signal&symbol=BTC → Signal for BTC
POST /api/agent/status                 → Wallet balances (body: { privateKey })
POST /api/agent/register               → Register on BSC (body: { privateKey })
```

## Architecture decisions

| Concern | Decision |
|---|---|
| Key security | Private key held in-memory only, never persisted. Encrypted keystore (ethers.Wallet.encrypt) in localStorage. |
| Signing | All signing via ethers.Wallet — fully local, self-custodial |
| CMC signals | Free tier + fallback to alternative.me for F&G. x402 pay-per-request wired for premium signals |
| Competition | Writes to 0x212c...aed5 on BSC mainnet |

## What's next — Session B
- CMC signal engine: live F&G feed in UI, batch signal scoring for eligible tokens
- SignalDashboard component: real-time signal cards with confidence meters
- x402 loop integration: pay per signal request in the trade loop
- Signal history chart: F&G over time + correlation with price
