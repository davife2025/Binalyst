# Binalyst — Session H: Final Integration & Bug Fixes

## What was built / fixed

### New / replacement files
```
lib/agentStore.ts          — FINAL: merges all patches (A-G), adds network field, SSR-safe storage
lib/store.ts               — FINAL: all tabs in ActiveTab union, SSR-safe storage
hooks/useAgentLoop.ts      — FINAL: passes network through loop calls, fixes stale closure deps
app/api/agent/status/route.ts — FINAL: network-aware (replaces Session A)
app/page.tsx               — FINAL: all 19 tabs wired (adds AgentPerformanceTab)
components/Sidebar.tsx     — FINAL: adds 'performance' tab to agent section
vercel.json                — CANONICAL: no rewrites, no headers array, fixes startup error
```

## Complete file replacement map

Replace these files with Session H versions:
| Old file | Session H replacement |
|---|---|
| `lib/agentStore.ts` (+ all PATCH files) | `lib/agentStore.ts` |
| `lib/store.ts` | `lib/store.ts` |
| `hooks/useAgentLoop.ts` | `hooks/useAgentLoop.ts` |
| `app/api/agent/status/route.ts` | `app/api/agent/status/route.ts` |
| `app/page.tsx` | `app/page.tsx` |
| `components/Sidebar.tsx` | `components/Sidebar.tsx` |
| `vercel.json` | `vercel.json` |

## Full file tree after all sessions

```
lib/
  store.ts                          ← H (final)
  agentStore.ts                     ← H (final)
  agentLoop.ts                      ← D
  signalEngine.ts                   ← B
  exportUtils.ts                    ← E
  twak/
    client.ts                       ← C (full 149-token list)
    networkClient.ts                ← F
    networks.ts                     ← F
  skills/
    cmc.ts                          ← A
    web3.ts                         ← original
    square.ts                       ← original
    index.ts                        ← original

hooks/
  useChat.ts                        ← original
  useTicker.ts                      ← original
  useSignals.ts                     ← B
  useAgentLoop.ts                   ← H (final)
  usePortfolio.ts                   ← G

app/
  page.tsx                          ← H (final)
  layout.tsx                        ← original
  login/page.tsx                    ← original
  api/
    ai/chat/route.ts                ← original
    binance/market/route.ts         ← original
    binance/account/route.ts        ← original
    binance/trade/route.ts          ← original
    events/scan/route.ts            ← original
    cmc/route.ts                    ← B
    agent/
      register/route.ts             ← F
      status/route.ts               ← H (final)
      loop/route.ts                 ← F
      strategy/route.ts             ← C
      execute/route.ts              ← C
      portfolio/route.ts            ← G
      alert/route.ts                ← G
      dorahacks/route.ts            ← E

components/
  Sidebar.tsx                       ← H (final)
  Header.tsx                        ← original
  BottomNav.tsx                     ← original
  MobileDrawer.tsx                  ← original
  Providers.tsx                     ← original
  ErrorBoundary.tsx                 ← original
  AuthBridge.tsx                    ← original
  agent/
    FearGreedGauge.tsx              ← B
    SignalCard.tsx                  ← B
    DrawdownGauge.tsx               ← D
    NetworkSwitcher.tsx             ← F
    PnLChart.tsx                    ← G
    PortfolioBreakdown.tsx          ← G
  tabs/
    DashboardTab.tsx                ← original
    ChatTab.tsx                     ← original
    MarketsTab.tsx                  ← original
    EventsTab.tsx                   ← original
    LearnTab.tsx                    ← original
    PortfolioTab.tsx                ← original
    TradeTab.tsx                    ← original
    AlertsTab.tsx                   ← original
    AgentTab.tsx                    ← original
    Web3Tab.tsx                     ← original
    SquareTab.tsx                   ← original
    MessagingTab.tsx                ← original
    SettingsTab.tsx                 ← original
    AgentWalletTab.tsx              ← F
    SignalDashboard.tsx             ← B
    StrategyBuilder.tsx             ← C
    CompetitionTab.tsx              ← D
    DorahacksTab.tsx                ← E
    AgentPerformanceTab.tsx         ← G

vercel.json                         ← H (canonical)
```

## Startup error fix (vercel.json)

The error:
```
`headers` field must be an array, invalid field: rewrites for route {"source":"/api/:path*"}
Error: Invalid header found
```

Fixed by: removing all `rewrites` and top-level `headers` from vercel.json.
Next.js 14 App Router handles all routing natively.

## npm run dev port conflict

The warning about ports 3000/3001/3002 being in use is normal —
Next.js auto-selects the next available port. Not an error.
To free port 3000: run `npx kill-port 3000` or restart your terminal.

## Competition readiness checklist

- [ ] BSC Testnet validated (swaps work, guardrails fire)
- [ ] Mainnet wallet funded (≥0.05 BNB + USDT capital)
- [ ] Registered on 0x212c...aed5 before deadline
- [ ] Strategy defined with ≥1 rule per day minimum
- [ ] Dry run disabled, autonomous mode ON
- [ ] Drawdown cap set to 25% (buffer below 30% disqualify)
- [ ] Agent running — min 1 trade/day enforced automatically
- [ ] Dorahacks submission generated and reviewed
- [ ] Trade CSV exported with BSCScan links
