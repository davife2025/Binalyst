'use client'

import { useEffect, useState } from 'react'

interface AgentOSSnapshot {
  connected: boolean
  toolCount?: number
  ticker?: { symbol: string; price?: string; changePct?: string; tool: string }
  error?: string
}

const POLL_MS = 30_000

/**
 * Live status pill for Binance's Agent OS MCP server (agent.binance.com/mcp/agentic).
 * Confirms Binalyst is actually talking to the official Agent OS endpoint —
 * see lib/agentOS.ts + app/api/agent/agentos/route.ts.
 */
export default function AgentOSBadge() {
  const [snap, setSnap] = useState<AgentOSSnapshot | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function poll() {
      try {
        const res = await fetch('/api/agent/agentos?symbol=BTCUSDT')
        const data = await res.json()
        if (!cancelled) setSnap(data)
      } catch {
        if (!cancelled) setSnap({ connected: false, error: 'network error' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    poll()
    const id = setInterval(poll, POLL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  const connected = !!snap?.connected
  const color = loading ? 'var(--text3)' : connected ? 'var(--green)' : 'var(--red)'

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-3"
      style={{ background: `${color}0f`, border: `1px solid ${color}30` }}
      title="agent.binance.com/mcp/agentic">
      <span style={{ fontSize: 14 }}>🟡</span>
      <div className="min-w-0">
        <div className="mono text-[10px] font-bold" style={{ color }}>
          {loading ? 'Agent OS — checking…' : connected ? 'Agent OS Connected' : 'Agent OS Unreachable'}
        </div>
        <div className="mono text-[9px] truncate" style={{ color: 'var(--text3)' }}>
          {connected
            ? snap?.ticker?.price
              ? `${snap.ticker.symbol} $${snap.ticker.price}${snap.ticker.changePct ? ` (${snap.ticker.changePct}%)` : ''} via ${snap.ticker.tool}`
              : `${snap?.toolCount ?? 0} MCP tools live`
            : snap?.error ?? 'agent.binance.com/mcp/agentic'}
        </div>
      </div>
    </div>
  )
}
