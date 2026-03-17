/**
 * lib/store.ts
 * Global state — Zustand store.
 * Manages: Binance credentials, chat history, portfolio, events, settings.
 * API keys stored in sessionStorage (cleared on tab close) — never in localStorage.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface BinanceEvent {
  id: string
  title: string
  datetime: string
  type: 'listing' | 'trading' | 'airdrop' | 'launchpool' | 'other'
  description: string
  url: string
  scannedAt: string
}
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  toolsUsed?: string[]
  timestamp: number
}

export interface Holding {
  coin: string
  qty: number
  avgBuy: number
  color: string
}

interface OpenClawStore {
  // ── Credentials ────────────────────────────────────────────────────────────
  apiKey: string
  apiSecret: string
  isConnected: boolean
  autoTradeEnabled: boolean
  setCredentials: (key: string, secret: string) => void
  clearCredentials: () => void
  setAutoTrade: (enabled: boolean) => void
  

  // ── Chat ───────────────────────────────────────────────────────────────────
  chatMessages: ChatMessage[]
  chatMode: 'assistant' | 'analyst' | 'trader' | 'educator'
  addChatMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void
  clearChat: () => void
  setChatMode: (mode: OpenClawStore['chatMode']) => void

  // ── Events ─────────────────────────────────────────────────────────────────
  events: BinanceEvent[]
  eventsLastScanned: string | null
  setEvents: (events: BinanceEvent[]) => void

  // ── Portfolio (manual) ─────────────────────────────────────────────────────
  holdings: Holding[]
  addHolding: (h: Holding) => void
  removeHolding: (coin: string) => void
  clearHoldings: () => void

  // ── Settings ───────────────────────────────────────────────────────────────
  theme: 'dark' | 'light'
  activeTab: 'home' | 'messaging' | 'chat' | 'markets' | 'events' | 'learn' | 'portfolio' | 'trading' | 'alerts' | 'agent' | 'web3' | 'square' | 'settings'
  setActiveTab: (tab: OpenClawStore['activeTab']) => void
}

const COLORS = ['#F0B90B','#0ECB81','#3498db','#9b59b6','#e67e22','#F6465D','#1abc9c']

export const useStore = create<OpenClawStore>()(
  persist(
    (set, get) => ({
      // ── Credentials ──────────────────────────────────────────────────────
      apiKey: '',
      apiSecret: '',
      isConnected: false,
      autoTradeEnabled: false,

      setCredentials: (key, secret) => {
        set({ apiKey: key, apiSecret: secret, isConnected: !!(key && secret) })
      },
      clearCredentials: () => {
        set({ apiKey: '', apiSecret: '', isConnected: false, autoTradeEnabled: false })
      },
      setAutoTrade: (enabled) => set({ autoTradeEnabled: enabled }),

      // ── Chat ─────────────────────────────────────────────────────────────
      chatMessages: [],
      chatMode: 'assistant',

      addChatMessage: (msg) => {
        const message: ChatMessage = {
          ...msg,
          id: crypto.randomUUID(),
          timestamp: Date.now(),
        }
        set(s => ({ chatMessages: [...s.chatMessages, message] }))
      },
      clearChat: () => set({ chatMessages: [] }),
      setChatMode: (mode) => set({ chatMode: mode }),

      // ── Events ───────────────────────────────────────────────────────────
      events: [],
      eventsLastScanned: null,

      setEvents: (events) => set({ events, eventsLastScanned: new Date().toISOString() }),

      // ── Portfolio ─────────────────────────────────────────────────────────
      holdings: [],

      addHolding: (h) => {
        const holdings = get().holdings
        const color = COLORS[holdings.length % COLORS.length]
        set(s => ({ holdings: [...s.holdings, { ...h, color }] }))
      },
      removeHolding: (coin) => {
        set(s => ({
          holdings: s.holdings
            .filter(h => h.coin !== coin)
            .map((h, i) => ({ ...h, color: COLORS[i % COLORS.length] })),
        }))
      },
      clearHoldings: () => set({ holdings: [] }),

      // ── Settings ──────────────────────────────────────────────────────────
      theme: 'dark',
      activeTab: 'chat',
      setActiveTab: (tab) => set({ activeTab: tab }),
    }),
    {
      name: 'openclaw-store',
      storage: createJSONStorage(() => localStorage),
      // Never persist API keys to localStorage — session only
      partialize: (state) => ({
        chatMode: state.chatMode,
        events: state.events,
        eventsLastScanned: state.eventsLastScanned,
        holdings: state.holdings,
        theme: state.theme,
        activeTab: state.activeTab,
        // chatMessages: intentionally excluded (privacy)
      }),
    }
  )
)
