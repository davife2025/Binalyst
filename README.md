# Binalyst

**AI-powered Binance assistant** — live markets, on-chain analytics, automated trading, and a conversational AI agent, all in one app.

---

## What is Binalyst?

Binalyst is a full-stack Next.js application that gives Binance users an intelligent co-pilot. It combines live Binance market data, Web3 on-chain intelligence, price alerts, automated agent rules, and an AI chat interface powered by Kimi K2 — all accessible from a single, clean dashboard.

Users can interact via the web app or connect through Telegram using the OpenClaw gateway.

---

## Features

### AI Assistant
Chat with Kimi K2 (via Hugging Face) using natural language. Ask for live prices, market analysis, trading ideas, or crypto education. The AI has access to live Binance data through function calling tools.

### Live Markets
Real-time Binance price streaming via WebSocket. View 24h movers, gainers, losers, and volume data across all USDT pairs.

### Portfolio Tracker
Track your Binance holdings manually or connect your API key. View allocation breakdown, PnL, and total portfolio value in USD.

### Trade
Place market and limit orders directly on Binance from the app. Includes a test order mode (dry-run) before committing real funds.

### Web3 Intelligence
Powered by Binance Web3 Skills Hub:
- **Token search** — find any token by name or contract address
- **Contract audit** — check for rug pull risk, honeypot, ownership renouncement, and liquidity lock
- **Wallet analysis** — view any wallet's holdings, PnL, and transaction history
- **Market rankings** — trending, smart money, social hype, meme tokens
- **Meme Rush** — discover new meme token launches on BSC

### Events Scanner
AI scans upcoming Binance exchange events — new listings, trading pairs, HODLer airdrops, Launchpool projects, Launchpad IDOs, TGEs, and futures launches.

### Price Alerts
Set above/below price alerts on any coin. Get notified when your target is hit.

### Auto Agent
Create conditional trading rules that execute automatically:
- `IF BTC > $105,000 → BUY ETH`
- `IF RSI > 80 → SEND ALERT`
- `DAILY 9AM → POST to Square`

### Binance Square
Write and publish AI-generated posts to your Binance Square profile directly from the app.

### Messaging (OpenClaw)
Connect Telegram (and other messaging apps) via the OpenClaw gateway. Send commands like `/price BTC` or `/movers` and get live responses in your chat app.

### Learn
Ask Binalyst to explain any crypto concept — DeFi, tokenomics, technical analysis, order types — with real examples.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Auth | NextAuth.js + Supabase Auth |
| Database | Supabase (PostgreSQL) |
| State | Zustand (persisted to localStorage) |
| AI Model | Kimi K2 via Hugging Face Inference API |
| Market Data | Binance REST API + WebSocket |
| Web3 Data | Binance Web3 Skills Hub (public endpoints) |
| Messaging | OpenClaw gateway (Telegram, WhatsApp, Discord) |
| Styling | Tailwind CSS + CSS variables |
| Deployment | Vercel |

---

## Getting Started

### Prerequisites

- Node.js 22+
- npm or pnpm
- A Supabase project
- A Hugging Face account (free)
- Optionally: Binance API key, Google OAuth credentials, OpenClaw account

### Installation

```bash
# Clone the repo
git clone https://github.com/yourusername/binalyst.git
cd binalyst

# Install dependencies
npm install --ignore-scripts

# Copy environment variables
cp .env.example .env.local
```

### Environment Variables

Create a `.env.local` file with the following:

```env
# Auth
NEXTAUTH_SECRET=your_random_secret_here
NEXTAUTH_URL=http://localhost:3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI (Hugging Face)
HUGGINGFACE_API_KEY=hf_your_token_here

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# OpenClaw messaging gateway (optional)
OPENCLAW_SECRET=your_shared_secret

# Encryption for stored API keys
ENCRYPTION_SECRET=your_32_char_secret_here!!

# Cron job auth
CRON_SECRET=your_cron_secret
```

### Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Supabase Setup

Run the following SQL in your Supabase project to create the required tables:

```sql
-- User settings (Binance API keys, preferences)
create table user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null unique,
  binance_key_enc text,
  binance_sec_enc text,
  auto_trade boolean default false,
  chat_mode text default 'assistant',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Price alerts
create table alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  symbol text not null,
  condition text check (condition in ('above','below')) not null,
  target numeric not null,
  note text,
  active boolean default true,
  triggered_at timestamptz,
  created_at timestamptz default now()
);

-- Agent automation rules
create table agent_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  symbol text not null,
  trigger_type text not null,
  trigger_value numeric not null,
  action_type text not null,
  active boolean default true,
  last_triggered timestamptz,
  created_at timestamptz default now()
);

-- Binance Square posts
create table square_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  content text not null,
  tags text[] default '{}',
  status text check (status in ('draft','published')) default 'draft',
  square_id text,
  published_at timestamptz,
  created_at timestamptz default now()
);
```

---

## Connecting Telegram via OpenClaw

1. Install OpenClaw: `npm install -g openclaw`
2. Upgrade Node.js to 22+: `nvm install 22 && nvm use 22`
3. Run onboarding: `openclaw onboard --install-daemon`
4. In the OpenClaw dashboard, set the gateway URL to: `https://your-app.vercel.app/api/openclaw/message`
5. Set the shared secret to match your `OPENCLAW_SECRET` env variable
6. Set the Telegram webhook: `curl.exe -X POST "https://api.telegram.org/botYOUR_TOKEN/setWebhook" -H "Content-Type: application/json" -d "{\"url\": \"https://your-app.vercel.app/api/openclaw/message\"}"`

Once connected, users can message your Telegram bot with commands like:
- `/price BTC` — get current price
- `/movers` — top 24h gainers and losers
- `/audit 0x...` — contract security audit
- `/help` — show all commands
- Or ask anything naturally in plain language

---

## API Routes

| Route | Method | Description |
|---|---|---|
| `/api/ai/chat` | POST | Streaming AI chat with Kimi K2 |
| `/api/skills` | GET | Binance Web3 Skills Hub proxy |
| `/api/events/scan` | POST/GET | AI-powered Binance events scanner |
| `/api/openclaw/message` | POST | OpenClaw messaging gateway webhook |
| `/api/openclaw/price` | GET | Quick price lookup endpoint |

---

## Project Structure

```
binalyst/
├── app/
│   ├── api/
│   │   ├── ai/chat/          # Streaming AI endpoint
│   │   ├── events/scan/      # Events scanner
│   │   ├── openclaw/         # Messaging gateway
│   │   └── skills/           # Web3 Skills Hub proxy
│   ├── login/                # Auth page
│   └── page.tsx              # Main app shell
├── components/
│   ├── tabs/                 # All tab views
│   │   ├── DashboardTab.tsx  # Landing page after login
│   │   ├── ChatTab.tsx
│   │   ├── MarketsTab.tsx
│   │   └── ...
│   ├── Sidebar.tsx           # Slim icon sidebar (expands on hover)
│   ├── BottomNav.tsx         # Mobile bottom navigation
│   └── ...
├── lib/
│   ├── auth.ts               # NextAuth config
│   ├── binance.ts            # Binance REST + WebSocket client
│   ├── claude.ts             # AI agent with tool calling
│   ├── store.ts              # Zustand global state
│   ├── supabase.ts           # Supabase client + helpers
│   ├── rateLimit.ts          # In-memory rate limiter
│   └── skills/
│       ├── web3.ts           # Binance Web3 Skills Hub
│       └── square.ts         # Binance Square posting
└── middleware.ts             # Auth protection
```

---

## Security Notes

- Binance API keys are **never stored in plaintext** — encrypted with AES before being stored in Supabase
- API keys are stored in `sessionStorage` on the client — cleared automatically when the tab closes
- The OpenClaw gateway verifies every request using a shared secret (`x-openclaw-token` header)
- Auto-trade mode is disabled by default and requires explicit user activation

---

## Demo Credentials

For quick testing without a real account:

```
Email:    demo@binalyst.com
Password: demo1234
```

---

## Deployment

The app is optimised for Vercel. Push to your connected GitHub repo and Vercel will build automatically.

Make sure all environment variables are set in **Vercel → Project → Settings → Environment Variables** before deploying.

---

## License

MIT — feel free to fork and build on it.

---

## Acknowledgements

- [Binance API](https://binance-docs.github.io/apidocs/) — market data and trading
- [OpenClaw](https://openclaw.ai) — messaging gateway
- [Kimi K2](https://huggingface.co/moonshotai/Kimi-K2-Instruct) — AI model via Hugging Face
- [Supabase](https://supabase.com) — auth and database
- [Vercel](https://vercel.com) — deployment
<img width="1340" height="705" alt="opopop" src="https://github.com/user-attachments/assets/e19debc9-0743-4389-a192-77089deca5a8" />
