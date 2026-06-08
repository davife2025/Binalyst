/**
 * lib/agentStore.ts
 * Zustand store for the autonomous agent wallet.
 * Private key is NEVER persisted — held in memory only for the session.
 * Encrypted keystore (password-protected) is stored in localStorage.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { AgentConfig } from './twak/client'
import { DEFAULT_AGENT_CONFIG } from './twak/client'

export interface TradeRecord {
  id:          string
  timestamp:   number
  symbol:      string
  side:        'BUY' | 'SELL'
  amountUSDT:  number
  price:       number
  txHash:      string
  pnlUSDT?:    number
  dryRun:      boolean
  status:      'pending' | 'confirmed' | 'failed'
  signalScore: number
  reasoning:   string
}

export interface AgentSession {
  startedAt:     number
  startValueUSDT: number
  currentValueUSDT: number
  peakValueUSDT:  number
  drawdownPct:    number
  totalTrades:    number
  todayTrades:    number
  isRegistered:   boolean
  registrationTx: string
  lastRunAt:      number | null
  status:         'idle' | 'running' | 'paused' | 'error' | 'disqualified'
}

interface AgentStore {
  // ── Wallet (session-only — never persisted) ───────────────────────────────
  agentAddress:    string
  privateKey:      string   // in-memory only
  encryptedKey:    string   // persisted (password-protected JSON)
  isWalletLoaded:  boolean
  bnbBalance:      number
  usdtBalance:     number

  setWallet: (address: string, privateKey: string) => void
  setEncryptedKey: (enc: string) => void
  clearWallet: () => void
  setBNBBalance: (bal: number) => void
  setUSDTBalance: (bal: number) => void

  // ── Agent config ──────────────────────────────────────────────────────────
  agentConfig: AgentConfig
  setAgentConfig: (cfg: Partial<AgentConfig>) => void

  // ── Session ───────────────────────────────────────────────────────────────
  session: AgentSession | null
  initSession: (startUSDT: number) => void
  updateSession: (updates: Partial<AgentSession>) => void
  resetSession: () => void

  // ── Trade log ─────────────────────────────────────────────────────────────
  trades: TradeRecord[]
  addTrade: (trade: TradeRecord) => void
  updateTrade: (id: string, updates: Partial<TradeRecord>) => void
  clearTrades: () => void

  // ── Signal cache ──────────────────────────────────────────────────────────
  lastSignals: Record<string, {
    score: number; dir: 'BUY' | 'SELL' | 'HOLD'; reasoning: string; ts: number
  }>
  setSignal: (symbol: string, score: number, dir: 'BUY'|'SELL'|'HOLD', reasoning: string) => void

  // ── Strategy ──────────────────────────────────────────────────────────────
  strategyText:   string
  strategyParsed: StrategyRule[]
  setStrategy: (text: string, rules: StrategyRule[]) => void
}

export interface StrategyRule {
  id:        string
  condition: string          // e.g. "fear_and_greed < 30"
  action:    'BUY' | 'SELL' | 'HOLD'
  symbol:    string
  sizePct:   number          // % of portfolio
  priority:  number
}

const DEFAULT_SESSION: AgentSession = {
  startedAt:        Date.now(),
  startValueUSDT:   0,
  currentValueUSDT: 0,
  peakValueUSDT:    0,
  drawdownPct:      0,
  totalTrades:      0,
  todayTrades:      0,
  isRegistered:     false,
  registrationTx:   '',
  lastRunAt:        null,
  status:           'idle',
}

export const useAgentStore = create<AgentStore>()(
  persist(
    (set, get) => ({
      // ── Wallet ──────────────────────────────────────────────────────────
      agentAddress:   '',
      privateKey:     '',       // NEVER persisted
      encryptedKey:   '',
      isWalletLoaded: false,
      bnbBalance:     0,
      usdtBalance:    0,

      setWallet: (address, privateKey) =>
        set({ agentAddress: address, privateKey, isWalletLoaded: true }),

      setEncryptedKey: (enc) => set({ encryptedKey: enc }),

      clearWallet: () =>
        set({ agentAddress: '', privateKey: '', isWalletLoaded: false, bnbBalance: 0, usdtBalance: 0 }),

      setBNBBalance:  (bal) => set({ bnbBalance: bal }),
      setUSDTBalance: (bal) => set({ usdtBalance: bal }),

      // ── Agent config ─────────────────────────────────────────────────────
      agentConfig: DEFAULT_AGENT_CONFIG,
      setAgentConfig: (cfg) =>
        set(s => ({ agentConfig: { ...s.agentConfig, ...cfg } })),

      // ── Session ──────────────────────────────────────────────────────────
      session: null,

      initSession: (startUSDT) =>
        set({
          session: {
            ...DEFAULT_SESSION,
            startedAt:        Date.now(),
            startValueUSDT:   startUSDT,
            currentValueUSDT: startUSDT,
            peakValueUSDT:    startUSDT,
          },
        }),

      updateSession: (updates) =>
        set(s => ({
          session: s.session ? { ...s.session, ...updates } : null,
        })),

      resetSession: () => set({ session: null, trades: [] }),

      // ── Trade log ────────────────────────────────────────────────────────
      trades: [],

      addTrade: (trade) =>
        set(s => ({ trades: [trade, ...s.trades].slice(0, 500) })),

      updateTrade: (id, updates) =>
        set(s => ({
          trades: s.trades.map(t => t.id === id ? { ...t, ...updates } : t),
        })),

      clearTrades: () => set({ trades: [] }),

      // ── Signal cache ─────────────────────────────────────────────────────
      lastSignals: {},
      setSignal: (symbol, score, dir, reasoning) =>
        set(s => ({
          lastSignals: {
            ...s.lastSignals,
            [symbol]: { score, dir, reasoning, ts: Date.now() },
          },
        })),

      // ── Strategy ─────────────────────────────────────────────────────────
      strategyText:   '',
      strategyParsed: [],
      setStrategy: (text, rules) => set({ strategyText: text, strategyParsed: rules }),
    }),
    {
      name: 'binalyst-agent',
      storage: createJSONStorage(() => localStorage),
      // CRITICAL: never persist privateKey
      partialize: (s) => ({
        agentAddress:   s.agentAddress,
        encryptedKey:   s.encryptedKey,
        agentConfig:    s.agentConfig,
        session:        s.session,
        trades:         s.trades.slice(0, 100),
        lastSignals:    s.lastSignals,
        strategyText:   s.strategyText,
        strategyParsed: s.strategyParsed,
      }),
    }
  )
)
