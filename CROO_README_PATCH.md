# Binalyst — AI Trading Agent × CROO Agent Protocol

[![CROO CAP](https://img.shields.io/badge/CROO-CAP%20v1.0-f59e0b?style=flat-square&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMyIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg==)](https://croo.network)
[![Agent Store](https://img.shields.io/badge/CROO%20Agent%20Store-Listed-22c55e?style=flat-square)](https://agent.croo.network/agents/binalyst-trading-agent)
[![Chains](https://img.shields.io/badge/Chains-BSC%20%7C%20Celo%20%7C%20Mantle%20%7C%20Sui-3b82f6?style=flat-square)](https://github.com/davife2025/Binalyst)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![Claude AI](https://img.shields.io/badge/Claude-Sonnet%204.6-cc785c?style=flat-square)](https://anthropic.com)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![Vercel](https://img.shields.io/badge/Deployed-Vercel-black?style=flat-square&logo=vercel)](https://vercel.com)

---

## CROO CAP Integration

Binalyst is a **CAP-enabled AI trading agent** — any human or AI agent can hire it
for trading signals, backtests, portfolio scans, or autonomous on-chain execution,
paying in USDC, settled on BSC.

### CAP Services (4 priced services)

| Service | ID | Price | Track |
|---|---|---|---|
| Market Signal | `market_signal` | $0.10 USDC | Research & Intelligence |
| Strategy Backtest | `backtest_report` | $0.25 USDC | Research & Intelligence |
| Portfolio Risk Scan | `portfolio_scan` | $0.15 USDC | Data & Verification |
| Trade Execute | `trade_execute` | $0.50 USDC | DeFi / On-chain Ops |

### CAP Endpoints

| Endpoint | Description |
|---|---|
| `POST /api/cap/invoke` | Main A2A invocation endpoint |
| `GET /.well-known/cap-agent.json` | Agent discovery manifest |
| `GET /api/cap/manifest` | Agent manifest JSON |
| `GET /api/cap/status` | Live health + call metrics |
| `POST /api/cap/register` | Agent Store registration |
| `POST /api/cap/call` | Outbound A2A calls (Binalyst calls other agents) |
| `GET /api/cap/discover` | Discover agents on CROO Agent Store |
| `POST /api/cap/pay` | On-chain USDC payment rail |
| `POST /api/cap/submission` | AI-generated DoraHacks submission |

### A2A Call Flow

```
Caller Agent
  → GET /.well-known/cap-agent.json        (discover Binalyst)
  → send USDC to agent wallet on BSC       (on-chain payment)
  → POST /api/cap/invoke                   (CAP request with txHash)
     { serviceId, paymentTxHash, params }
  ← CAPResponse { success, result, settlementRef }
```

### Example CAP Request

```json
POST /api/cap/invoke
{
  "serviceId":      "market_signal",
  "callerId":       "your-agent-wallet",
  "paymentTxHash":  "0xabc...def",
  "paymentChain":   "bsc",
  "params":         { "symbol": "BTC", "interval": "1h" },
  "nonce":          "uuid-v4",
  "timestamp":      1718000000000
}
```

### Environment Variables (CROO additions)

```bash
# Required
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NEXT_PUBLIC_CROO_AGENT_ID=binalyst-trading-agent

# Optional
BSCSCAN_API_KEY=your_key          # on-chain payment verification
CAP_MAX_PAYMENT_USDC=5            # safety cap per auto-payment
```

### CROO CAP Sessions Built

| Session | Deliverable |
|---|---|
| S1 | Core CAP client, 4 API routes, `.well-known` discovery |
| S2 | CrooTab UI (Overview, Services, A2A, Submission) |
| S3 | Wiring: store, sidebar, drawer, page, next.config |
| S4 | Agent Store registration + pre-flight checklist |
| S5 | A2A Outbound: discover agents, call services, pipeline |
| S6 | USDC Payment Rail: balance check, gas estimate, on-chain send |
| S7 | Final submission: DoraHacks writeup + Twitter thread + badges |

---

## Hackathon Submission Checklist

- [x] Listed on CROO Agent Store
- [x] CAP integrated (`/api/cap/invoke` + manifest + status)
- [x] Open source — MIT @ github.com/davife2025/Binalyst
- [ ] Demo video — record 5-min walkthrough (CAP call → signal → trade)
- [ ] DoraHacks BUIDL filed

---

> Built for the **CROO Agent Protocol Hackathon** · [croo.network](https://croo.network) · [agent.croo.network](https://agent.croo.network)
