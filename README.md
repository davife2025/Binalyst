# OpenClaw — Binance AI Assistant Platform

> Built for the OpenClaw AI Hackathon. The ultimate Binance co-pilot.

---

## Stack
- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **AI:** Anthropic Claude (claude-sonnet-4) with tool use + web search
- **Binance:** Official REST API (signed requests) + WebSocket streams
- **State:** Zustand (credentials in session only — never persisted)
- **Cache:** Vercel KV (Redis-compatible)
- **Hosting:** Vercel

---

## Features
| Module | What it does |
|--------|-------------|
| **AI Assistant** | Multi-mode chat (Trader, Analyst, Educator, News). Claude calls Binance APIs as tools in real-time |
| **Events Radar** | Scans Binance announcements hourly via cron. Exports to calendar (.ics) with 10/5 min alerts |
| **Live Markets** | Real-time prices, order book, klines, top movers via Binance REST + WebSocket |
| **Portfolio** | Connect API key → live balances + P&L + AI portfolio advisor |
| **Auto-Trade** | Place/cancel orders via Claude tool calls. Dry-run validation before any execution |

---

## Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/your-org/openclaw
cd openclaw
npm install
```

### 2. Environment Variables
```bash
cp .env.example .env.local
```

Fill in:
```
ANTHROPIC_API_KEY=sk-ant-...
ENCRYPTION_SECRET=any_32_char_random_string_here!!
```

For Vercel KV (optional, for event caching):
- Go to Vercel dashboard → Storage → Create KV store → Link to project
- Environment variables are auto-populated

### 3. Run locally
```bash
npm run dev
# → http://localhost:3000
```

### 4. Deploy to Vercel
```bash
npx vercel --prod
```

Or push to GitHub and connect via Vercel dashboard.

---

## Connecting Your Binance API Key

1. Go to Binance → Account → API Management
2. Create a new API key
3. **Enable:** Reading, Spot Trading
4. **Disable:** Withdrawals (never needed)
5. Restrict to your IP for extra security
6. Enter in OpenClaw Settings tab

> Your keys are **never stored server-side**. They're held in sessionStorage and sent via request headers — cleared when you close the browser.

---

## Auto-Trade Safety

Auto-trade is **off by default**. When enabled:
- Every trade is validated (dry-run) before execution
- Claude always shows order details and asks for confirmation
- You can set maximum order sizes in Settings
- Use Binance Testnet to trial without real funds

---

## Project Structure

```
openclaw/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Dashboard
│   └── api/
│       ├── ai/chat/route.ts    # AI agent (streaming)
│       ├── binance/
│       │   ├── market/route.ts # Public market data
│       │   ├── account/route.ts# Authenticated account
│       │   └── trade/route.ts  # Order execution
│       └── events/scan/route.ts# Events scanner + cron
├── lib/
│   ├── binance.ts              # Binance API client
│   ├── claude.ts               # AI agent with tools
│   └── store.ts                # Zustand global state
├── components/                 # UI components (next phase)
├── vercel.json                 # Cron + function config
└── .env.example
```

---

## Roadmap

### Phase 1 (Current) — Foundation ✅
- [x] Next.js project scaffold
- [x] Binance API client (market + account + trading)
- [x] Claude agent with Binance tool calls
- [x] Events scanner with Vercel cron
- [x] API routes (market, account, trade, chat, events)
- [x] Global state (Zustand)

### Phase 2 — UI Integration (Next)
- [ ] Connect landing page components to real API routes
- [ ] Live WebSocket price feed in UI
- [ ] Portfolio live sync with Binance account
- [ ] Order confirmation modal
- [ ] API key setup flow

### Phase 3 — Autonomous Agent
- [ ] Configurable price alerts
- [ ] Auto-event calendar sync
- [ ] Rule-based auto-trading (if BTC > X, buy Y)
- [ ] Multi-asset portfolio rebalancing

---

## License
MIT — built for OpenClaw Hackathon
