/**
 * lib/celoAgentStore.ts — Session K (new file)
 *
 * Zustand store for the Celo Payments Agent. Parallel to lib/agentStore.ts
 * (the BNB competition agent's store) — completely independent: separate
 * persistence key, separate wallet, separate trade/payment log. Nothing
 * here is imported by, or imports from, lib/agentStore.ts.
 *
 * CRITICAL: like agentStore.ts, the private key is NEVER persisted.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { CeloNetwork } from './celo/config'
import { CELO_AGENT_DEFAULTS } from './celo/config'
import type { PaymentRule, PaymentRecord, CeloLoopStatus } from './celoAgentLoop'

export const CELO_NETWORK_LABELS: Record<CeloNetwork, string> = {
  mainnet:   'Celo Mainnet',
  alfajores: 'Celo Alfajores Testnet',
}

export interface CeloAgentSession {
  startedAt:      number
  totalUSDSent:   number
  totalPayments:  number
  lastRunAt:      number | null
  status:         CeloLoopStatus
}

export interface CeloAgentConfig {
  dryRun:          boolean   // simulate payments without sending txs (default true)
  autonomousMode:  boolean   // if false, due payments are evaluated but not executed
}

export const DEFAULT_CELO_AGENT_CONFIG: CeloAgentConfig = {
  dryRun:         true,
  autonomousMode: false,
}

const DEFAULT_CELO_SESSION: CeloAgentSession = {
  startedAt:     Date.now(),
  totalUSDSent:  0,
  totalPayments: 0,
  lastRunAt:     null,
  status:        'idle',
}

interface CeloAgentStore {
  // ── Network ────────────────────────────────────────────────────────────
  network:    CeloNetwork
  setNetwork: (n: CeloNetwork) => void

  // ── Wallet (session-only — never persisted) ───────────────────────────────
  agentAddress:   string
  privateKey:     string
  encryptedKey:   string
  isWalletLoaded: boolean
  celoBalance:    number
  cusdBalance:    number

  setWallet:       (address: string, privateKey: string) => void
  setEncryptedKey: (enc: string) => void
  clearWallet:     () => void
  setCeloBalance:  (bal: number) => void
  setCusdBalance:  (bal: number) => void

  // ── Agent config ──────────────────────────────────────────────────────────
  agentConfig:    CeloAgentConfig
  setAgentConfig: (cfg: Partial<CeloAgentConfig>) => void

  // ── Session ───────────────────────────────────────────────────────────────
  session:       CeloAgentSession | null
  initSession:   () => void
  updateSession: (updates: Partial<CeloAgentSession>) => void
  resetSession:  () => void

  // ── Payment rules ────────────────────────────────────────────────────────
  paymentRules:    PaymentRule[]
  addPaymentRule:  (rule: PaymentRule) => void
  updatePaymentRule: (id: string, updates: Partial<PaymentRule>) => void
  removePaymentRule: (id: string) => void
  setPaymentRules: (rules: PaymentRule[]) => void

  // ── Payment log ──────────────────────────────────────────────────────────
  payments:      PaymentRecord[]
  addPayment:    (p: PaymentRecord) => void
  clearPayments: () => void
}

export const useCeloAgentStore = create<CeloAgentStore>()(
  persist(
    (set, get) => ({
      // ── Network ────────────────────────────────────────────────────────
      network:    CELO_AGENT_DEFAULTS.DEFAULT_NETWORK,
      setNetwork: (n) => set({ network: n }),

      // ── Wallet ─────────────────────────────────────────────────────────
      agentAddress:   '',
      privateKey:     '',
      encryptedKey:   '',
      isWalletLoaded: false,
      celoBalance:    0,
      cusdBalance:    0,

      setWallet:       (address, privateKey) =>
        set({ agentAddress: address, privateKey, isWalletLoaded: true }),
      setEncryptedKey: (enc) => set({ encryptedKey: enc }),
      clearWallet:     () =>
        set({ agentAddress: '', privateKey: '', isWalletLoaded: false, celoBalance: 0, cusdBalance: 0 }),
      setCeloBalance:  (bal) => set({ celoBalance: bal }),
      setCusdBalance:  (bal) => set({ cusdBalance: bal }),

      // ── Agent config ────────────────────────────────────────────────────
      agentConfig: DEFAULT_CELO_AGENT_CONFIG,
      setAgentConfig: (cfg) =>
        set(s => ({ agentConfig: { ...s.agentConfig, ...cfg } })),

      // ── Session ─────────────────────────────────────────────────────────
      session: null,

      initSession: () =>
        set({ session: { ...DEFAULT_CELO_SESSION, startedAt: Date.now() } }),

      updateSession: (updates) =>
        set(s => ({
          session: s.session ? { ...s.session, ...updates } : null,
        })),

      resetSession: () => set({ session: null, payments: [] }),

      // ── Payment rules ────────────────────────────────────────────────────
      paymentRules: [],

      addPaymentRule: (rule) =>
        set(s => ({ paymentRules: [...s.paymentRules, rule] })),

      updatePaymentRule: (id, updates) =>
        set(s => ({
          paymentRules: s.paymentRules.map(r => r.id === id ? { ...r, ...updates } : r),
        })),

      removePaymentRule: (id) =>
        set(s => ({ paymentRules: s.paymentRules.filter(r => r.id !== id) })),

      setPaymentRules: (rules) => set({ paymentRules: rules }),

      // ── Payment log ──────────────────────────────────────────────────────
      payments: [],

      addPayment: (p) =>
        set(s => ({ payments: [p, ...s.payments].slice(0, 500) })),

      clearPayments: () => set({ payments: [] }),
    }),
    {
      name:    'binalyst-celo-agent',
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
        paymentRules:   s.paymentRules,
        payments:       s.payments.slice(0, 100),
      }),
    }
  )
)
