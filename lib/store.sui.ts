/**
 * lib/store.sui.ts
 * Isolated Zustand store for the Sui agent module — Session K.
 *
 * This is COMPLETELY SEPARATE from lib/store.ts and lib/agentStore.ts.
 * It shares zero state, zero imports, and zero side-effects with them.
 *
 * Contains:
 *   - Sui wallet connection state
 *   - Move policy state
 *   - Sui agent session state
 *   - Sui trade history
 *   - UI state for SuiAgentTab
 */

import { create }                     from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

import type { SuiNetwork }      from './sui/client'
import type { AgentPolicy }     from './movePolicy/client'
import type {
  SuiAgentConfig,
  SuiAgentDecision,
  SuiAgentStatus,
  SuiCycleResult,
  SuiTradeRecord,
} from './sui/types'
import { DEFAULT_SUI_AGENT_CONFIG } from './sui/types'

// ─────────────────────────────────────────────────────────────────────────────
// Store shape
// ─────────────────────────────────────────────────────────────────────────────

interface SuiStore {
  // ── Wallet ────────────────────────────────────────────────────────────────
  walletAddress:   string | null
  network:         SuiNetwork
  balanceSUI:      number
  walletConnected: boolean
  walletError:     string | null

  setWallet: (address: string, network: SuiNetwork, balance: number) => void
  clearWallet: () => void
  setWalletError: (err: string | null) => void
  setBalance: (balance: number) => void

  // ── Policy ────────────────────────────────────────────────────────────────
  policy: AgentPolicy | null
  policyLoading: boolean

  setPolicy: (policy: AgentPolicy) => void
  clearPolicy: () => void
  setPolicyLoading: (v: boolean) => void
  markPolicyRevoked: () => void
  recordPolicySpend: (cents: number) => void

  // ── Agent session ─────────────────────────────────────────────────────────
  agentStatus:     SuiAgentStatus
  agentConfig:     SuiAgentConfig
  cycleCount:      number
  tradesExecuted:  number
  lastCycleAt:     number | null
  agentErrors:     string[]

  setAgentStatus:  (s: SuiAgentStatus) => void
  setAgentConfig:  (cfg: Partial<SuiAgentConfig>) => void
  onCycleComplete: (r: SuiCycleResult) => void

  // ── Decisions log ─────────────────────────────────────────────────────────
  decisions:    SuiAgentDecision[]
  addDecision:  (d: SuiAgentDecision) => void
  clearDecisions: () => void

  // ── Trade history ─────────────────────────────────────────────────────────
  trades:       SuiTradeRecord[]
  addTrade:     (t: SuiTradeRecord) => void
  clearTrades:  () => void

  // ── UI ────────────────────────────────────────────────────────────────────
  activeSubTab: 'wallet' | 'policy' | 'agent' | 'log'
  setActiveSubTab: (t: SuiStore['activeSubTab']) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Store implementation
// ─────────────────────────────────────────────────────────────────────────────

export const useSuiStore = create<SuiStore>()(
  persist(
    (set, get) => ({
      // ── Wallet ─────────────────────────────────────────────────────────────
      walletAddress:   null,
      network:         'testnet',
      balanceSUI:      0,
      walletConnected: false,
      walletError:     null,

      setWallet: (address, network, balance) => set({
        walletAddress:   address,
        network,
        balanceSUI:      balance,
        walletConnected: true,
        walletError:     null,
      }),
      clearWallet: () => set({
        walletAddress:   null,
        balanceSUI:      0,
        walletConnected: false,
      }),
      setWalletError: (err) => set({ walletError: err }),
      setBalance:     (balance) => set({ balanceSUI: balance }),

      // ── Policy ─────────────────────────────────────────────────────────────
      policy:        null,
      policyLoading: false,

      setPolicy:   (policy) => set({ policy }),
      clearPolicy: ()       => set({ policy: null }),
      setPolicyLoading: (v) => set({ policyLoading: v }),

      markPolicyRevoked: () => set(s => ({
        policy: s.policy ? { ...s.policy, revoked: true } : null,
      })),

      recordPolicySpend: (cents) => set(s => ({
        policy: s.policy
          ? { ...s.policy, spentCents: s.policy.spentCents + cents }
          : null,
      })),

      // ── Agent session ───────────────────────────────────────────────────────
      agentStatus:    'idle',
      agentConfig:    DEFAULT_SUI_AGENT_CONFIG,
      cycleCount:     0,
      tradesExecuted: 0,
      lastCycleAt:    null,
      agentErrors:    [],

      setAgentStatus: (s) => set({ agentStatus: s }),

      setAgentConfig: (cfg) => set(s => ({
        agentConfig: { ...s.agentConfig, ...cfg },
      })),

      onCycleComplete: (r) => set(s => ({
        cycleCount:     s.cycleCount + 1,
        tradesExecuted: s.tradesExecuted + r.executed,
        lastCycleAt:    r.cycleAt,
        agentErrors:    r.errors.length
          ? [...s.agentErrors.slice(-19), ...r.errors]
          : s.agentErrors,
      })),

      // ── Decisions log ───────────────────────────────────────────────────────
      decisions: [],
      addDecision: (d) => set(s => ({
        decisions: [d, ...s.decisions].slice(0, 100),
      })),
      clearDecisions: () => set({ decisions: [] }),

      // ── Trade history ───────────────────────────────────────────────────────
      trades: [],
      addTrade: (t) => set(s => ({
        trades: [t, ...s.trades].slice(0, 200),
      })),
      clearTrades: () => set({ trades: [] }),

      // ── UI ──────────────────────────────────────────────────────────────────
      activeSubTab:    'wallet',
      setActiveSubTab: (t) => set({ activeSubTab: t }),
    }),
    {
      name:    'binalyst-sui-store',     // separate localStorage key from main store
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        // Only persist config + wallet address + policy across reloads
        walletAddress: s.walletAddress,
        network:       s.network,
        agentConfig:   s.agentConfig,
        policy:        s.policy,
      }),
    },
  ),
)
