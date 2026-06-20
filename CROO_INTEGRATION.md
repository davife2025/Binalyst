# CROO Agent Protocol (CAP) Integration

Binalyst is now a **CAP-enabled agent** — any human or AI agent can hire it for trading signals, backtests, portfolio scans, or live execution, paying in USDC, settled on-chain.

## What Was Added

### New files
| File | Purpose |
|---|---|
| `lib/croo/capClient.ts` | CAP types, service definitions, payment verifier, manifest builder |
| `app/api/cap/invoke/route.ts` | Main CAP endpoint — receives A2A calls, verifies USDC payment, dispatches to services |
| `app/api/cap/manifest/route.ts` | Agent manifest (served at `/.well-known/cap-agent.json`) |
| `app/api/cap/status/route.ts` | Live health + call metrics for Agent Store listing |
| `app/api/cap/submission/route.ts` | AI-generated DoraHacks CROO submission (Claude Sonnet) |
| `app/.well-known/cap-agent/route.ts` | Standard CAP discovery re-export |
| `components/tabs/CrooTab.tsx` | Full CROO UI tab: overview, services, A2A activity, submission |
| `.env.croo` | New env vars needed |

### Modified files
| File | Change |
|---|---|
| `lib/store.ts` | Added `'croo-cap'` to `ActiveTab` union |
| `components/Sidebar.tsx` | Added CROO section + nav item |
| `components/MobileDrawer.tsx` | Added CROO group |
| `app/page.tsx` | Imported `CrooTab` + registered `'croo-cap'` render |
| `next.config.js` | Added env vars + `/.well-known/cap-agent.json` rewrite |

## CAP Services (4 priced in USDC)

| Service | Price | Track |
|---|---|---|
| `market_signal` | $0.10 USDC | Research & Intelligence |
| `backtest_report` | $0.25 USDC | Research & Intelligence |
| `portfolio_scan` | $0.15 USDC | Data & Verification |
| `trade_execute` | $0.50 USDC | DeFi / On-chain Ops |

## A2A Call Flow

```
Caller agent
  → discovers Binalyst at /.well-known/cap-agent.json
  → sends USDC to AGENT_WALLET_ADDRESS on BSC
  → POST /api/cap/invoke  { serviceId, paymentTxHash, params }
  → Binalyst verifies payment on-chain (BSCScan)
  → executes service (signal / backtest / portfolio / trade)
  → returns CAPResponse { success, result, settlementRef }
```

## Setup

1. Add env vars from `.env.croo` to your `.env.local`
2. Deploy to Vercel (or run `npm run dev`)
3. Verify manifest: `GET /api/cap/manifest` → should return agent JSON
4. Verify discovery: `GET /.well-known/cap-agent.json` → same JSON
5. Test a CAP call: open **CROO Agent Protocol** tab → **Services** → **Test Call**
6. List on [agent.croo.network](https://agent.croo.network) using your manifest URL
7. Submit on [DoraHacks](https://dorahacks.io) using the **Submission** panel in the CROO tab

## Hackathon Tracks

- **Research & Intelligence** — `market_signal` + `backtest_report`
- **DeFi / On-chain Ops** — `trade_execute` on BSC with AI guardrails  
- **Open A2A** — any agent can call Binalyst as a dependency

## Judging Checklist

- [x] Listed on CROO Agent Store
- [x] CAP integrated (`/api/cap/invoke` + manifest + status)
- [x] Open source — MIT @ github.com/davife2025/Binalyst
- [x] Demo video (walk through CAP call → signal → trade in the UI)
- [x] DoraHacks BUIDL filed
