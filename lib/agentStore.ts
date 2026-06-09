/**
 * lib/agentStore.ts — Session H: FINAL complete version
 * Merges all patches from Sessions A-G into one canonical file.
 * REPLACES all previous agentStore.ts and agentStore.PATCH.ts files.
 */

import { create }                 from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { AgentConfig }       from './twak/client'
import { DEFAULT_AGENT_CONFIG }   from './twak/client'

export type AgentNetwork = 'mainnet' | 'testnet'

export const NETWORK_LABELS: Record<AgentNetwork, string> = {
  mainnet: 'BSC Mainnet',
  testnet: 'BSC Testnet',
}

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
  startedAt:        number
  startValueUSDT:   number
  currentValueUSDT: number
  peakValueUSDT:    number
  drawdownPct:      number
  totalTrades:      number
  todayTrades:      number
  isRegistered:     boolean
  registrationTx:   string
  lastRunAt:        number | null
  status:           'idle' | 'running' | 'paused' | 'error' | 'disqualified'
}

export interface StrategyRule {
  id:           string
  symbol:       string
  condition:    any
  action:       'BUY' | 'SELL' | 'HOLD'
  sizePct:      number
  priority:     number
  cooldownMs:   number
  lastFiredAt?: number
  reasoning?:   string
}

interface AgentStore {
  // ── Network ───────────────────────────────────────────────────────────────
  network:    AgentNetwork
  setNetwork: (n: AgentNetwork) => void

  // ── Wallet (session-only — never persisted) ───────────────────────────────
  agentAddress:    string
  privateKey:      string
  encryptedKey:    string
  isWalletLoaded:  boolean
  bnbBalance:      number
  usdtBalance:     number

  setWallet:       (address: string, privateKey: string) => void
  setEncryptedKey: (enc: string) => void
  clearWallet:     () => void
  setBNBBalance:   (bal: number) => void
  setUSDTBalance:  (bal: number) => void

  // ── Agent config ──────────────────────────────────────────────────────────
  agentConfig:    AgentConfig
  setAgentConfig: (cfg: Partial<AgentConfig>) => void

  // ── Session ───────────────────────────────────────────────────────────────
  session:       AgentSession | null
  initSession:   (startUSDT: number) => void
  updateSession: (updates: Partial<AgentSession>) => void
  resetSession:  () => void

  // ── Trade log ─────────────────────────────────────────────────────────────
  trades:      TradeRecord[]
  addTrade:    (trade: TradeRecord) => void
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
  setStrategy:    (text: string, rules: StrategyRule[]) => void
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
      // ── Network ────────────────────────────────────────────────────────
      network:    'testnet',
      setNetwork: (n) => set({ network: n }),

      // ── Wallet ─────────────────────────────────────────────────────────
      agentAddress:   '',
      privateKey:     '',
      encryptedKey:   '',
      isWalletLoaded: false,
      bnbBalance:     0,
      usdtBalance:    0,

      setWallet:       (address, privateKey) =>
        set({ agentAddress: address, privateKey, isWalletLoaded: true }),
      setEncryptedKey: (enc) => set({ encryptedKey: enc }),
      clearWallet:     () =>
        set({ agentAddress: '', privateKey: '', isWalletLoaded: false, bnbBalance: 0, usdtBalance: 0 }),
      setBNBBalance:   (bal) => set({ bnbBalance: bal }),
      setUSDTBalance:  (bal) => set({ usdtBalance: bal }),

      // ── Agent config ────────────────────────────────────────────────────
      agentConfig: DEFAULT_AGENT_CONFIG,
      setAgentConfig: (cfg) =>
        set(s => ({ agentConfig: { ...s.agentConfig, ...cfg } })),

      // ── Session ─────────────────────────────────────────────────────────
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
      setStrategy:    (text, rules) => set({ strategyText: text, strategyParsed: rules }),
    }),
    {
      name:    'binalyst-agent',
      storage: createJSONStorage(() => {
        // SSR guard — localStorage not available on server
        if (typeof window === 'undefined') {
          return {
            getItem:    () => null,
            setItem:    () => {},
            removeItem: () => {},
          }
        }
        return localStorage
      }),
      // CRITICAL: never persist privateKey
      partialize: (s) => ({
        network:        s.network,
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
