'use client'

/**
 * hooks/usePOKTAgent.ts — Session P4 (new file)
 *
 * React hook for the POKT Agent tab.
 * Wires together the Zustand store (lib/pokt/store.ts) and the three
 * API routes built in P2 (/query, /metrics, /ping).
 *
 * PURELY ADDITIVE — no imports from any existing hook or agent file.
 * Parallel to useCeloAgentLoop, useMantleAgentLoop, useSuiAgentLoop.
 *
 * Provides:
 *   sendQuery(text)        — NL → on-chain via /api/pokt-agent/query
 *   refreshMetrics(force?) — fetch POKTscan metrics via /api/pokt-agent/metrics
 *   pingChain(key)         — single chain health check
 *   pingAllChains()        — ping all 10 chains in parallel
 *   clearHistory()         — wipe query history from store
 *
 * Auto-behaviour on mount:
 *   - Fetches network metrics immediately (if cache is stale > 30s)
 *   - Sets up 30s metrics refresh interval
 *   - Does NOT auto-ping chains (too heavy for background)
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePOKTAgentStore }                        from '@/lib/pokt/store'
import type { POKTNetworkMetrics }                  from '@/lib/pokt/poktscan'
import { POKT_AGENT_DEFAULTS }                      from '@/lib/pokt/config'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role:    'user' | 'assistant'
  content: string
  ts:      number
}

export interface HealthData {
  metrics: POKTNetworkMetrics
  health:  { score: number; label: string; color: string }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function usePOKTAgent() {
  const {
    selectedChain, setSelectedChain,
    activePanel,   setActivePanel,
    rpcConfigChain, setRPCConfigChain,
    queryHistory, addQueryRecord, clearHistory,
    metricsCache, metricsFetchedAt, setMetricsCache,
    pingResults, setPingResult, setPingResults,
    isPinging,    setIsPinging,
    isQueryLoading, setIsQueryLoading,
    queryError, setQueryError,
    totalQueries, successQueries,
  } = usePOKTAgentStore()

  // ── Local UI state (not persisted) ────────────────────────────────────────
  const [messages,    setMessages]    = useState<ChatMessage[]>([])
  const [healthData,  setHealthData]  = useState<HealthData | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(false)

  const metricsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const abortRef           = useRef<AbortController | null>(null)

  // ─────────────────────────────────────────────────────────────────────────
  // Metrics — fetch + auto-refresh
  // ─────────────────────────────────────────────────────────────────────────

  const refreshMetrics = useCallback(async (force = false) => {
    const stale = Date.now() - metricsFetchedAt > POKT_AGENT_DEFAULTS.METRICS_CACHE_TTL_MS
    if (!force && !stale && metricsCache) {
      // Use cached data — don't hit the API
      return
    }

    setMetricsLoading(true)
    try {
      const res  = await fetch(`/api/pokt-agent/metrics${force ? '?force=1' : ''}`)
      if (!res.ok) throw new Error(`Metrics fetch failed: ${res.status}`)
      const data = await res.json() as HealthData
      setMetricsCache(data.metrics)
      setHealthData(data)
    } catch (e) {
      // Silent — keep last known data, don't crash the tab
      console.warn('[usePOKTAgent] metrics fetch error:', e)
    } finally {
      setMetricsLoading(false)
    }
  }, [metricsFetchedAt, metricsCache, setMetricsCache])

  // Mount: initial fetch + 30s interval
  useEffect(() => {
    refreshMetrics()

    metricsIntervalRef.current = setInterval(() => {
      refreshMetrics()
    }, POKT_AGENT_DEFAULTS.METRICS_CACHE_TTL_MS)

    return () => {
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // ↑ intentionally empty deps — we want this to run once on mount

  // Hydrate healthData from cache on first render (if cache exists)
  useEffect(() => {
    if (metricsCache && !healthData) {
      // We have cached metrics but no healthData — rebuild it
      refreshMetrics(false)
    }
  }, [metricsCache]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────────────────────────────────
  // Query — NL to on-chain via /api/pokt-agent/query
  // ─────────────────────────────────────────────────────────────────────────

  const sendQuery = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isQueryLoading) return

    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()

    const userMsg: ChatMessage = { role: 'user', content: trimmed, ts: Date.now() }
    const nextMessages = [...messages, userMsg]

    setMessages(nextMessages)
    setIsQueryLoading(true)
    setQueryError('')

    const t0 = Date.now()

    try {
      const res = await fetch('/api/pokt-agent/query', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        signal:  abortRef.current.signal,
        body:    JSON.stringify({
          messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
          chainKey: selectedChain,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string }
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }

      const aiText = await res.text()
      const durationMs = Date.now() - t0

      const assistantMsg: ChatMessage = {
        role:    'assistant',
        content: aiText,
        ts:      Date.now(),
      }

      setMessages(prev => [...prev, assistantMsg])

      // Persist to query history
      addQueryRecord({
        chainKey:    selectedChain,
        userMessage: trimmed,
        aiResponse:  aiText,
        timestamp:   Date.now(),
        durationMs,
        toolsUsed:   [],   // Tool names aren't surfaced from the API yet (P4 enhancement)
        error:       null,
      })

    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return  // user navigated away

      const msg = e instanceof Error ? e.message : 'Unknown error'
      setQueryError(msg)

      addQueryRecord({
        chainKey:    selectedChain,
        userMessage: trimmed,
        aiResponse:  '',
        timestamp:   Date.now(),
        durationMs:  Date.now() - t0,
        toolsUsed:   [],
        error:       msg,
      })
    } finally {
      setIsQueryLoading(false)
    }
  }, [messages, isQueryLoading, selectedChain, setIsQueryLoading, setQueryError, addQueryRecord])

  // ─────────────────────────────────────────────────────────────────────────
  // Ping — single chain
  // ─────────────────────────────────────────────────────────────────────────

  const pingChain = useCallback(async (chainKey: string) => {
    try {
      const res  = await fetch(`/api/pokt-agent/ping?chain=${chainKey}`)
      const data = await res.json() as {
        chainKey: string; ok: boolean; latencyMs: number; blockNumber?: number
      }
      setPingResult({ ...data, pinnedAt: Date.now() })
    } catch {
      setPingResult({ chainKey, ok: false, latencyMs: 0, blockNumber: undefined, pinnedAt: Date.now() })
    }
  }, [setPingResult])

  // ─────────────────────────────────────────────────────────────────────────
  // Ping — all chains
  // ─────────────────────────────────────────────────────────────────────────

  const pingAllChains = useCallback(async () => {
    if (isPinging) return
    setIsPinging(true)

    try {
      const res  = await fetch('/api/pokt-agent/ping?chain=all')
      const data = await res.json() as {
        results: { chainKey: string; ok: boolean; latencyMs: number; blockNumber?: number }[]
      }
      setPingResults(data.results.map(r => ({ ...r, pinnedAt: Date.now() })))
    } catch {
      // Silent — keep last known results
    } finally {
      setIsPinging(false)
    }
  }, [isPinging, setIsPinging, setPingResults])

  // ─────────────────────────────────────────────────────────────────────────
  // Clear chat (keeps history in store, resets visible messages)
  // ─────────────────────────────────────────────────────────────────────────

  const clearChat = useCallback(() => {
    setMessages([])
    setQueryError('')
  }, [setQueryError])

  // ─────────────────────────────────────────────────────────────────────────
  // Cleanup on unmount
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      if (metricsIntervalRef.current) clearInterval(metricsIntervalRef.current)
    }
  }, [])

  // ─────────────────────────────────────────────────────────────────────────
  // Derived stats
  // ─────────────────────────────────────────────────────────────────────────

  const onlineChainCount = Object.values(pingResults).filter(r => r.ok).length
  const totalChainCount  = Object.keys(pingResults).length
  const avgLatencyMs     = totalChainCount
    ? Math.round(
        Object.values(pingResults).reduce((acc, r) => acc + r.latencyMs, 0) / totalChainCount
      )
    : null

  return {
    // State from store
    selectedChain, setSelectedChain,
    activePanel,   setActivePanel,
    rpcConfigChain, setRPCConfigChain,
    queryHistory,
    clearHistory,
    pingResults,
    isPinging,
    isQueryLoading,
    queryError,
    totalQueries,
    successQueries,

    // Local state
    messages,
    healthData,
    metricsLoading,

    // Actions
    sendQuery,
    refreshMetrics,
    pingChain,
    pingAllChains,
    clearChat,

    // Derived
    onlineChainCount,
    totalChainCount,
    avgLatencyMs,
  }
}
