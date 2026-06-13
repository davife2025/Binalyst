/**
 * lib/mantleAgentStore.ts — Session N1 (new file)
 *
 * Zustand store for the Mantle AI Trading Agent.
 * Part of: The Turing Test Hackathon — AI Trading & Strategy track.
 *
 * FULLY ISOLATED from all existing Binalyst stores:
 *  - lib/store.ts         (main app store) — untouched
 *  - lib/agentStore.ts    (BNB trading agent) — untouched
 *  - lib/celoAgentStore.ts (Celo payments agent) — untouched
 *  - lib/store.sui.ts     (Sui trading agent) — untouched
 *
 * Separate persistence key: 'binalyst-mantle-agent'
 * CRITICAL: private key is NEVER persisted (same rule as all other stores).
 */

import { create }                     from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { MantleNetwork }         from './mantle/config'
import { MANTLE_NETWORK_LABELS }      from './mantle/config'
import type {
  MantleTradeRecord,
  MantleAgentSession,
  MantleAgentConfig,
  MantleLoopStatus,
  BenchmarkRecord,
} from './mantleAgentLoop'
import { DEFAULT_MANTLE_AGENT_CONFIG } from './mantleAgentLoop'

// Re-export for convenience
export { MANTLE_NETWORK_LABELS }

// ─────────────────────────────────────────────────────────────────────────────
// Default session
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_MANTLE_SESSION: MantleAgentSession = {
  startedAt:       Date.now(),
  startValueUSD:   0,
  currentValueUSD: 0,
  peakValueUSD:    0,
  drawdownPct:     0,
  totalTrades:     0,
  todayTrades:     0,
  totalPnlUSD:     0,
  lastRunAt:       null,
  status:          'idle',
  benchmarkCount:  0,
}

// ─────────────────────────────────────────────────────────────────────────────
// Store interface
// ─────────────────────────────────────────────────────────────────────────────

interface MantleAgentStore {
  // ── Network ────────────────────────────────────────────────────────────────
  network:    MantleNetwork
  setNetwork: (n: MantleNetwork) => void

  // ── Wallet (session-only — NEVER persisted) ───────────────────────────────
  agentAddress:    string
  privateKey:      string
  encryptedKey:    string
  isWalletLoaded:  boolean

  // Live balances (updated each loop cycle)
  mntBalance:   number
  mEthBalance:  number
  usdyBalance:  number
  usdcBalance:  number
  usdtBalance:  number

  setWallet:       (address: string, privateKey: string) => void
  setEncryptedKey: (enc: string) => void
  clearWallet:     () => void
  setBalances:     (b: Partial<{
    mntBalance: number; mEthBalance: number
    usdyBalance: number; usdcBalance: number; usdtBalance: number
  }>) => void

  // ── ERC-8004 identity (Hackathon feature #2) ───────────────────────────────
  agentId:            string | null   // ERC-8004 tokenId on Mantle Mainnet
  registrationTxHash: string | null
  setAgentIdentity:   (agentId: string, txHash: string) => void

  // ── Agent config ──────────────────────────────────────────────────────────
  agentConfig:    MantleAgentConfig
  setAgentConfig: (cfg: Partial<MantleAgentConfig>) => void

  // ── Session ───────────────────────────────────────────────────────────────
  session:       MantleAgentSession | null
  initSession:   (startValueUSD: number) => void
  updateSession: (updates: Partial<MantleAgentSession>) => void
  resetSession:  () => void

  // ── Trade log ─────────────────────────────────────────────────────────────
  trades:       MantleTradeRecord[]
  addTrade:     (t: MantleTradeRecord) => void
  clearTrades:  () => void

  // ── On-chain benchmark log (Hackathon feature #1) ─────────────────────────
  benchmarks:      BenchmarkRecord[]
  addBenchmark:    (b: BenchmarkRecord) => void
  clearBenchmarks: () => void

  // ── Live prices (updated each loop cycle) ─────────────────────────────────
  prices:     Record<string, number>
  setPrices:  (p: Record<string, number>) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Store implementation
// ─────────────────────────────────────────────────────────────────────────────

export const useMantleAgentStore = create<MantleAgentStore>()(
  persist(
    (set, get) => ({
      // ── Network ──────────────────────────────────────────────────────────
      network:    'testnet',
      setNetwork: (n) => set({ network: n }),

      // ── Wallet ───────────────────────────────────────────────────────────
      agentAddress:   '',
      privateKey:     '',
      encryptedKey:   '',
      isWalletLoaded: false,
      mntBalance:     0,
      mEthBalance:    0,
      usdyBalance:    0,
      usdcBalance:    0,
      usdtBalance:    0,

      setWallet: (address, privateKey) =>
        set({ agentAddress: address, privateKey, isWalletLoaded: true }),

      setEncryptedKey: (enc) => set({ encryptedKey: enc }),

      clearWallet: () => set({
        agentAddress: '', privateKey: '', isWalletLoaded: false,
        mntBalance: 0, mEthBalance: 0, usdyBalance: 0,
        usdcBalance: 0, usdtBalance: 0,
      }),

      setBalances: (b) => set((s) => ({ ...s, ...b })),

      // ── ERC-8004 identity ─────────────────────────────────────────────────
      agentId:            null,
      registrationTxHash: null,
      setAgentIdentity: (agentId, txHash) =>
        set({ agentId, registrationTxHash: txHash }),

      // ── Agent config ──────────────────────────────────────────────────────
      agentConfig: DEFAULT_MANTLE_AGENT_CONFIG,
      setAgentConfig: (cfg) =>
        set((s) => ({ agentConfig: { ...s.agentConfig, ...cfg } })),

      // ── Session ───────────────────────────────────────────────────────────
      session: null,

      initSession: (startValueUSD) =>
        set({
          session: {
            ...DEFAULT_MANTLE_SESSION,
            startedAt:       Date.now(),
            startValueUSD,
            currentValueUSD: startValueUSD,
            peakValueUSD:    startValueUSD,
          },
        }),

      updateSession: (updates) =>
        set((s) => ({
          session: s.session ? { ...s.session, ...updates } : null,
        })),

      resetSession: () => set({ session: null, trades: [], benchmarks: [] }),

      // ── Trade log ─────────────────────────────────────────────────────────
      trades: [],

      addTrade: (t) =>
        set((s) => ({ trades: [t, ...s.trades].slice(0, 500) })),

      clearTrades: () => set({ trades: [] }),

      // ── Benchmark log ─────────────────────────────────────────────────────
      benchmarks: [],

      addBenchmark: (b) =>
        set((s) => ({ benchmarks: [b, ...s.benchmarks].slice(0, 1000) })),

      clearBenchmarks: () => set({ benchmarks: [] }),

      // ── Prices ────────────────────────────────────────────────────────────
      prices: {},
      setPrices: (p) => set({ prices: p }),
    }),
    {
      name: 'binalyst-mantle-agent',   // isolated localStorage key
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') {
          return {
            getItem:    () => null,
            setItem:    () => {},
            removeItem: () => {},
          }
        }
        return localStorage
      }),
      // CRITICAL: privateKey is NOT included — never persisted
      partialize: (s) => ({
        network:            s.network,
        agentAddress:       s.agentAddress,
        encryptedKey:       s.encryptedKey,
        agentConfig:        s.agentConfig,
        session:            s.session,
        trades:             s.trades.slice(0, 100),      // persist last 100 trades
        benchmarks:         s.benchmarks.slice(0, 200),  // persist last 200 benchmarks
        agentId:            s.agentId,
        registrationTxHash: s.registrationTxHash,
        prices:             s.prices,
      }),
    }
  )
)
