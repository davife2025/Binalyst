/**
 * lib/pokt/store.ts — Session P4 (new file)
 *
 * Zustand store for the POKT Agent tab.
 * Manages selected chain, NL query history, network metrics cache,
 * chain ping results, and RPC config panel state.
 *
 * PURELY ADDITIVE — completely independent of lib/store.ts,
 * lib/agentStore.ts, lib/celoAgentStore.ts, lib/mantleAgentStore.ts,
 * and lib/suiAgentStore.ts. Separate persistence key: 'binalyst-pokt-agent'.
 *
 * No private keys, wallet addresses, or sensitive data stored here.
 * This store is purely UI + query history state.
 *
 * Persistence: query history + selected chain survive page refresh.
 * Metrics cache is session-only (not persisted — always refreshed on mount).
 */

import { create }                     from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { POKT_AGENT_DEFAULTS }        from './config'
import type { POKTNetworkMetrics }    from './poktscan'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type POKTAgentPanel = 'health' | 'query' | 'chains' | 'rpc' | 'analytics'

export interface POKTQueryRecord {
  id:          string        // nanoid-style: `q_${Date.now()}`
  chainKey:    string
  userMessage: string
  aiResponse:  string
  timestamp:   number
  durationMs:  number        // round-trip time for the API call
  toolsUsed:   string[]      // which POKT tools the AI called
  error:       string | null
}

export interface POKTChainPingRecord {
  chainKey:     string
  ok:           boolean
  latencyMs:    number
  blockNumber?: number
  pinnedAt:     number
}

// ─────────────────────────────────────────────────────────────────────────────
// Store interface
// ─────────────────────────────────────────────────────────────────────────────

interface POKTAgentStore {
  // ── Panel navigation ──────────────────────────────────────────────────────
  activePanel:    POKTAgentPanel
  setActivePanel: (p: POKTAgentPanel) => void

  // ── Chain selection ───────────────────────────────────────────────────────
  selectedChain:    string
  setSelectedChain: (key: string) => void

  // ── RPC config panel — which chain the user is viewing setup for ─────────
  rpcConfigChain:    string
  setRPCConfigChain: (key: string) => void

  // ── Query history (persisted, capped at MAX_QUERY_HISTORY) ────────────────
  queryHistory:    POKTQueryRecord[]
  addQueryRecord:  (record: Omit<POKTQueryRecord, 'id'>) => void
  clearHistory:    () => void

  // ── Network metrics cache (session-only, not persisted) ───────────────────
  metricsCache:     POKTNetworkMetrics | null
  metricsFetchedAt: number
  setMetricsCache:  (m: POKTNetworkMetrics) => void
  clearMetrics:     () => void

  // ── Chain ping results (session-only) ─────────────────────────────────────
  pingResults:    Record<string, POKTChainPingRecord>
  setPingResult:  (result: POKTChainPingRecord) => void
  setPingResults: (results: POKTChainPingRecord[]) => void
  clearPings:     () => void

  // ── UI state ─────────────────────────────────────────────────────────────
  isPinging:          boolean
  setIsPinging:       (v: boolean) => void
  isQueryLoading:     boolean
  setIsQueryLoading:  (v: boolean) => void
  queryError:         string
  setQueryError:      (e: string) => void

  // ── Stats (derived from queryHistory) ─────────────────────────────────────
  totalQueries:   number
  successQueries: number

  // ── Reset ─────────────────────────────────────────────────────────────────
  resetAll: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Default state
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_STATE = {
  activePanel:      'health'   as POKTAgentPanel,
  selectedChain:    POKT_AGENT_DEFAULTS.DEFAULT_CHAIN,
  rpcConfigChain:   'ethereum',
  queryHistory:     [] as POKTQueryRecord[],
  metricsCache:     null as POKTNetworkMetrics | null,
  metricsFetchedAt: 0,
  pingResults:      {} as Record<string, POKTChainPingRecord>,
  isPinging:        false,
  isQueryLoading:   false,
  queryError:       '',
  totalQueries:     0,
  successQueries:   0,
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export const usePOKTAgentStore = create<POKTAgentStore>()(
  persist(
    (set, get) => ({
      ...DEFAULT_STATE,

      // ── Panel navigation ────────────────────────────────────────────────
      setActivePanel: (p) => set({ activePanel: p }),

      // ── Chain selection ─────────────────────────────────────────────────
      setSelectedChain:  (key) => set({ selectedChain: key }),
      setRPCConfigChain: (key) => set({ rpcConfigChain: key }),

      // ── Query history ───────────────────────────────────────────────────
      addQueryRecord: (record) => {
        const id = `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
        const newRecord: POKTQueryRecord = { ...record, id }
        const prev = get().queryHistory
        const updated = [newRecord, ...prev].slice(0, POKT_AGENT_DEFAULTS.MAX_QUERY_HISTORY)

        const total   = updated.length
        const success = updated.filter(r => !r.error).length

        set({
          queryHistory:   updated,
          totalQueries:   total,
          successQueries: success,
        })
      },

      clearHistory: () => set({
        queryHistory:   [],
        totalQueries:   0,
        successQueries: 0,
      }),

      // ── Metrics cache ───────────────────────────────────────────────────
      setMetricsCache: (m) => set({
        metricsCache:     m,
        metricsFetchedAt: Date.now(),
      }),
      clearMetrics: () => set({ metricsCache: null, metricsFetchedAt: 0 }),

      // ── Ping results ────────────────────────────────────────────────────
      setPingResult: (result) => set(state => ({
        pingResults: { ...state.pingResults, [result.chainKey]: result },
      })),

      setPingResults: (results) => {
        const map: Record<string, POKTChainPingRecord> = {}
        results.forEach(r => { map[r.chainKey] = r })
        set({ pingResults: map })
      },

      clearPings: () => set({ pingResults: {} }),

      // ── UI state ────────────────────────────────────────────────────────
      setIsPinging:      (v) => set({ isPinging: v }),
      setIsQueryLoading: (v) => set({ isQueryLoading: v }),
      setQueryError:     (e) => set({ queryError: e }),

      // ── Reset ────────────────────────────────────────────────────────────
      resetAll: () => set({
        ...DEFAULT_STATE,
        // keep selected chain preference
        selectedChain: get().selectedChain,
      }),
    }),

    {
      name:    'binalyst-pokt-agent',
      storage: createJSONStorage(() => {
        // SSR guard — localStorage not available on server (Next.js build/SSR pass)
        if (typeof window === 'undefined') {
          return {
            getItem:    () => null,
            setItem:    () => {},
            removeItem: () => {},
          }
        }
        return localStorage
      }),
      // Only persist non-sensitive, non-stale data
      partialize: (state) => ({
        selectedChain:   state.selectedChain,
        rpcConfigChain:  state.rpcConfigChain,
        activePanel:     state.activePanel,
        queryHistory:    state.queryHistory,
        totalQueries:    state.totalQueries,
        successQueries:  state.successQueries,
      }),
    },
  ),
)
