'use client'

/**
 * components/tabs/POKTAgentTab.tsx — Session P3 (new file)
 *
 * Pocket Network (POKT) Agent Tab.
 * Decentralised RPC queries via natural language, powered by Claude +
 * Pocket Network's 5,000+ node infrastructure.
 *
 * PURELY ADDITIVE — zero changes to any BNB, Celo, Mantle, or Sui files.
 *
 * Panels:
 *   1. Network Health   — live POKTscan metrics (relays, CUs, nodes, price)
 *   2. Chain Query      — NL chat → on-chain RPC via POKT (AI agent)
 *   3. Chain Grid       — all 10 supported chains with ping status
 *   4. RPC Config Guide — step-by-step MetaMask setup via POKT endpoints
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  POKT_CHAIN_LIST,
  POKT_CHAINS,
  POKT_QUERY_EXAMPLES,
  POKT_TOKENOMICS,
  getPOKTWalletConfig,
  type POKTChain,
  type POKTQueryCategory,
} from '@/lib/pokt/config'
import type { POKTNetworkMetrics } from '@/lib/pokt/poktscan'

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI primitives
// ─────────────────────────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl overflow-hidden ${className}`}
      style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
      {children}
    </div>
  )
}

function CardHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="px-4 py-2.5 flex items-center justify-between"
      style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
      <span className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
        {title}
      </span>
      {sub && <span className="mono text-[9px]" style={{ color: 'var(--text3)' }}>{sub}</span>}
    </div>
  )
}

function MetricTile({
  label, value, sub, color = 'var(--text)',
}: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl p-3 flex flex-col gap-1"
      style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
      <div className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
        {label}
      </div>
      <div className="mono text-base font-extrabold leading-tight" style={{ color }}>
        {value}
      </div>
      {sub && <div className="mono text-[9px]" style={{ color: 'var(--text3)' }}>{sub}</div>}
    </div>
  )
}

function Spinner() {
  return (
    <span className="w-4 h-4 rounded-full border-2 inline-block animate-spin"
      style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--yellow)' }} />
  )
}

function StatusDot({ ok, pulse }: { ok: boolean; pulse?: boolean }) {
  return (
    <span className="w-2 h-2 rounded-full shrink-0 inline-block"
      style={{
        background: ok ? 'var(--green)' : 'var(--text3)',
        animation: ok && pulse ? 'blink 2s infinite' : 'none',
      }} />
  )
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className="mono text-[9px] px-2 py-0.5 rounded-full font-bold"
      style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
      {label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel 1 — Network Health Dashboard
// ─────────────────────────────────────────────────────────────────────────────

function NetworkHealthPanel() {
  const [metrics,  setMetrics]  = useState<POKTNetworkMetrics | null>(null)
  const [health,   setHealth]   = useState<{ score: number; label: string; color: string } | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [lastFetch, setLastFetch] = useState(0)

  const fetchMetrics = useCallback(async (force = false) => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/pokt-agent/metrics${force ? '?force=1' : ''}`)
      const data = await res.json() as { metrics: POKTNetworkMetrics; health: { score: number; label: string; color: string } }
      setMetrics(data.metrics)
      setHealth(data.health)
      setLastFetch(Date.now())
    } catch {
      // silent — keep last values
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMetrics()
    const id = setInterval(() => fetchMetrics(), 30_000)
    return () => clearInterval(id)
  }, [fetchMetrics])

  const ago = lastFetch ? Math.round((Date.now() - lastFetch) / 1000) + 's ago' : '—'

  return (
    <Card>
      <CardHeader title="Pocket Network — Live Health" sub={`Updated ${ago}`} />
      <div className="p-4 flex flex-col gap-3">

        {/* Health score bar */}
        {health && (
          <div className="flex items-center gap-3 p-3 rounded-xl"
            style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
                  Network Health
                </span>
                <span className="mono text-xs font-bold" style={{ color: health.color }}>
                  {health.label} ({health.score}/100)
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full" style={{ background: 'var(--bg4)' }}>
                <div className="h-1.5 rounded-full transition-all duration-700"
                  style={{ width: `${health.score}%`, background: health.color }} />
              </div>
            </div>
            <StatusDot ok={health.score > 40} pulse={health.score > 40} />
          </div>
        )}

        {loading && !metrics && (
          <div className="flex justify-center py-6"><Spinner /></div>
        )}

        {metrics && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MetricTile
              label="24h Relays"
              value={metrics.relays24h > 0 ? (metrics.relays24h / 1e6).toFixed(1) + 'M' : '—'}
              sub="RPC requests served"
              color="var(--green)"
            />
            <MetricTile
              label="Computed Units"
              value={metrics.computedUnitsLabel || '—'}
              sub="24h compute work"
              color="var(--yellow)"
            />
            <MetricTile
              label="Supplier Nodes"
              value={metrics.supplierCount.toLocaleString()}
              sub="Active node operators"
              color="var(--text)"
            />
            <MetricTile
              label="POKT Price"
              value={metrics.priceUSD != null ? `$${metrics.priceUSD.toFixed(4)}` : '—'}
              sub={`${(POKT_TOKENOMICS.CIRCULATING_SUPPLY / 1e9).toFixed(1)}B circ. supply`}
              color="var(--yellow)"
            />
          </div>
        )}

        {metrics && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <MetricTile
              label="Validators"
              value={String(metrics.validatorCount)}
              sub="Active (max 20)"
            />
            <MetricTile
              label="Staked Supply"
              value={metrics.stakedSupplyLabel}
              sub="Total supplier stake"
              color="var(--green)"
            />
            <MetricTile
              label="Latest Block"
              value={metrics.latestBlock > 0 ? `#${metrics.latestBlock.toLocaleString()}` : '—'}
              sub="Pocket chain height"
            />
          </div>
        )}

        {/* Tokenomics summary */}
        <div className="p-3 rounded-xl mono text-[10px] leading-relaxed"
          style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
          <span style={{ color: 'var(--yellow)' }}>PIP-41 Tokenomics</span>
          {' · '}For every 100 POKT burned,{' '}
          <span style={{ color: 'var(--green)' }}>97.5 POKT</span> is minted
          (79% Suppliers · 14% Validators · 4.5% DAO).
          The remaining <span style={{ color: 'var(--red)' }}>2.5%</span> is permanently removed.
          {' '}More usage = more deflation.
        </div>

        <button
          onClick={() => fetchMetrics(true)}
          disabled={loading}
          className="mono text-[10px] px-3 py-1.5 rounded-lg self-end flex items-center gap-2 transition-all"
          style={{
            background: 'var(--bg3)', border: '1px solid var(--border2)',
            color: 'var(--text2)', cursor: loading ? 'not-allowed' : 'pointer',
          }}>
          {loading && <Spinner />}
          {loading ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel 2 — Natural Language Chain Query (AI Agent)
// ─────────────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role:    'user' | 'assistant'
  content: string
  ts:      number
}

const EXAMPLE_CATEGORIES: { label: string; key: POKTQueryCategory }[] = [
  { label: 'Balance',  key: 'balance'        },
  { label: 'Block',    key: 'block'          },
  { label: 'Gas',      key: 'gas'            },
  { label: 'Network',  key: 'network_health' },
  { label: 'Contract', key: 'contract'       },
]

function ChainQueryPanel() {
  const [selectedChain, setSelectedChain] = useState('ethereum')
  const [messages,  setMessages]  = useState<ChatMessage[]>([])
  const [input,     setInput]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || loading) return

    const userMsg: ChatMessage = { role: 'user', content: msg, ts: Date.now() }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/pokt-agent/query', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          messages:  next.map(m => ({ role: m.role, content: m.content })),
          chainKey:  selectedChain,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' })) as { error?: string }
        throw new Error(err.error ?? 'Request failed')
      }

      const text = await res.text()
      setMessages(prev => [...prev, { role: 'assistant', content: text, ts: Date.now() }])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  function fmtContent(text: string) {
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--yellow);font-weight:600">$1</strong>')
      .replace(/`([^`\n]+)`/g, '<code style="font-family:monospace;background:var(--bg);padding:1px 5px;border-radius:3px;font-size:11px;color:var(--green)">$1</code>')
      .replace(/^#{1,3} (.+)$/gm, '<div style="font-size:13px;font-weight:700;color:var(--yellow);margin:10px 0 4px">$1</div>')
      .replace(/^[-*] (.+)$/gm, '<div style="display:flex;gap:6px;margin:2px 0"><span style="color:var(--yellow)">›</span><span>$1</span></div>')
      .replace(/\n\n/g, '<br/><br/>').replace(/\n/g, '<br/>')
  }

  const activeChain = POKT_CHAINS[selectedChain]

  return (
    <Card>
      <CardHeader title="NL Chain Query — via POKT Network" />
      <div className="p-4 flex flex-col gap-3">

        {/* Chain selector */}
        <div className="flex gap-2 flex-wrap">
          {POKT_CHAIN_LIST.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedChain(c.id)}
              className="mono text-[10px] px-2.5 py-1 rounded-full transition-all"
              style={{
                background: selectedChain === c.id ? 'var(--yellow)' : 'var(--bg3)',
                color:      selectedChain === c.id ? '#000'          : 'var(--text2)',
                border:     selectedChain === c.id ? 'none'          : '1px solid var(--border)',
              }}>
              {c.icon} {c.name}
            </button>
          ))}
        </div>

        {/* Example queries */}
        <div className="flex flex-col gap-1.5">
          <span className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
            Quick examples
          </span>
          <div className="flex gap-2 flex-wrap">
            {EXAMPLE_CATEGORIES.map(cat =>
              POKT_QUERY_EXAMPLES[cat.key].slice(0, 1).map((ex, i) => (
                <button
                  key={`${cat.key}-${i}`}
                  onClick={() => sendMessage(ex)}
                  disabled={loading}
                  className="mono text-[9px] px-2 py-1 rounded-lg truncate max-w-[200px] text-left transition-all"
                  style={{
                    background: 'var(--bg3)', border: '1px solid var(--border)',
                    color: 'var(--text2)', cursor: loading ? 'not-allowed' : 'pointer',
                  }}>
                  {ex.length > 40 ? ex.slice(0, 40) + '…' : ex}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat history */}
        <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
          {messages.length === 0 && (
            <div className="py-8 text-center flex flex-col items-center gap-2">
              <div className="text-3xl opacity-30">◎</div>
              <div className="mono text-xs" style={{ color: 'var(--text3)' }}>
                Ask anything about any chain — data fetched live via POKT Network
              </div>
              <div className="mono text-[9px]" style={{ color: 'var(--text3)' }}>
                Active chain: <span style={{ color: 'var(--yellow)' }}>{activeChain?.name ?? selectedChain}</span>
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className="mono text-xs px-3 py-2 rounded-xl max-w-[85%] leading-relaxed"
                style={{
                  background: m.role === 'user' ? 'var(--yellow)' : 'var(--bg3)',
                  color:      m.role === 'user' ? '#000'           : 'var(--text)',
                  border:     m.role === 'user' ? 'none'           : '1px solid var(--border)',
                }}
                dangerouslySetInnerHTML={
                  m.role === 'assistant'
                    ? { __html: fmtContent(m.content) }
                    : undefined
                }>
                {m.role === 'user' ? m.content : null}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="px-3 py-2 rounded-xl flex items-center gap-2"
                style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                <Spinner />
                <span className="mono text-[10px]" style={{ color: 'var(--text3)' }}>
                  Querying {activeChain?.name ?? selectedChain} via POKT…
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="mono text-xs p-2 rounded-lg" style={{ background: 'rgba(246,70,93,0.08)', color: 'var(--red)' }}>
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder={`Ask about ${activeChain?.name ?? 'any chain'} via POKT…`}
            disabled={loading}
            className="flex-1 mono text-sm px-3 py-2.5 rounded-lg outline-none"
            style={{
              background: 'var(--bg3)', border: '1px solid var(--border2)',
              color: 'var(--text)',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--yellow)')}
            onBlur={e  => (e.target.style.borderColor = 'var(--border2)')}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="px-4 py-2 rounded-lg mono text-xs font-bold transition-all"
            style={{
              background: input.trim() && !loading ? 'var(--yellow)' : 'var(--bg4)',
              color:      input.trim() && !loading ? '#000'           : 'var(--text3)',
              cursor:     !input.trim() || loading ? 'not-allowed'   : 'pointer',
            }}>
            {loading ? <Spinner /> : 'Ask'}
          </button>
        </div>

        <div className="mono text-[9px]" style={{ color: 'var(--text3)' }}>
          ◎ All RPC calls routed through Pocket Network — decentralised, censorship-resistant, 5,000+ nodes
        </div>
      </div>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel 3 — Chain Grid (ping status)
// ─────────────────────────────────────────────────────────────────────────────

interface PingResult {
  chainKey:    string
  ok:          boolean
  latencyMs:   number
  blockNumber?: number
}

function ChainGridPanel() {
  const [pings,   setPings]   = useState<Record<string, PingResult>>({})
  const [loading, setLoading] = useState(false)
  const [lastRun, setLastRun] = useState(0)

  async function pingAll() {
    setLoading(true)
    try {
      const res  = await fetch('/api/pokt-agent/ping?chain=all')
      const data = await res.json() as { results: PingResult[] }
      const map: Record<string, PingResult> = {}
      data.results.forEach(r => { map[r.chainKey] = r })
      setPings(map)
      setLastRun(Date.now())
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { pingAll() }, [])

  return (
    <Card>
      <CardHeader
        title="POKT RPC — Chain Health"
        sub={lastRun ? `Pinged ${Math.round((Date.now() - lastRun) / 1000)}s ago` : 'Not yet pinged'}
      />
      <div className="p-4 flex flex-col gap-3">
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
          {POKT_CHAIN_LIST.map(chain => {
            const ping = pings[chain.id]
            const hasResult = !!ping

            return (
              <div
                key={chain.id}
                className="flex flex-col gap-1.5 p-3 rounded-xl"
                style={{ background: 'var(--bg3)', border: `1px solid ${hasResult && ping.ok ? 'rgba(14,203,129,0.18)' : 'var(--border)'}` }}>
                <div className="flex items-center justify-between">
                  <span className="mono text-xs font-bold" style={{ color: 'var(--text)' }}>
                    {chain.icon} {chain.name}
                  </span>
                  {hasResult
                    ? <StatusDot ok={ping.ok} />
                    : <span className="w-2 h-2 rounded-full" style={{ background: 'var(--bg4)' }} />
                  }
                </div>
                <div className="mono text-[9px]" style={{ color: 'var(--text3)' }}>
                  {chain.isEVM ? `Chain ${chain.chainId}` : 'Non-EVM'} · {chain.category}
                </div>
                {hasResult && (
                  <div className="flex items-center justify-between">
                    <span className="mono text-[9px]" style={{ color: ping.ok ? 'var(--green)' : 'var(--red)' }}>
                      {ping.ok ? `${ping.latencyMs}ms` : 'Timeout'}
                    </span>
                    {ping.blockNumber !== undefined && (
                      <span className="mono text-[9px]" style={{ color: 'var(--text3)' }}>
                        #{ping.blockNumber.toLocaleString()}
                      </span>
                    )}
                  </div>
                )}
                {!hasResult && loading && (
                  <div className="mono text-[9px]" style={{ color: 'var(--text3)' }}>Pinging…</div>
                )}
              </div>
            )
          })}
        </div>

        <button
          onClick={pingAll}
          disabled={loading}
          className="mono text-[10px] px-3 py-1.5 rounded-lg self-end flex items-center gap-2 transition-all"
          style={{
            background: 'var(--bg3)', border: '1px solid var(--border2)',
            color: 'var(--text2)', cursor: loading ? 'not-allowed' : 'pointer',
          }}>
          {loading && <Spinner />}
          {loading ? 'Pinging…' : '↻ Ping All Chains'}
        </button>
      </div>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel 4 — MetaMask RPC Config Guide
// ─────────────────────────────────────────────────────────────────────────────

function RPCConfigPanel() {
  const [selectedChain, setSelectedChain] = useState('ethereum')
  const [copied, setCopied] = useState('')

  const evmChains = POKT_CHAIN_LIST.filter(c => c.isEVM)
  const cfg = getPOKTWalletConfig(selectedChain)

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(''), 2000)
    })
  }

  function CopyRow({ label, value, id }: { label: string; value: string; id: string }) {
    return (
      <div className="flex items-center justify-between p-2.5 rounded-lg"
        style={{ background: 'var(--bg4)', border: '1px solid var(--border)' }}>
        <div>
          <div className="mono text-[9px] uppercase tracking-widest mb-0.5" style={{ color: 'var(--text3)' }}>{label}</div>
          <div className="mono text-xs" style={{ color: 'var(--text)' }}>{value}</div>
        </div>
        <button
          onClick={() => copy(value, id)}
          className="mono text-[9px] px-2 py-1 rounded transition-all shrink-0 ml-2"
          style={{
            background: copied === id ? 'rgba(14,203,129,0.12)' : 'var(--bg3)',
            color:      copied === id ? 'var(--green)'          : 'var(--text3)',
            border: '1px solid var(--border)',
          }}>
          {copied === id ? '✓ Copied' : 'Copy'}
        </button>
      </div>
    )
  }

  const STEPS = [
    'Open MetaMask and click the ≡ menu (top right)',
    'Go to Settings → Networks',
    'Find your chain (e.g. Ethereum Mainnet) and click Edit',
    'Under "Default RPC URL", click + Add RPC URL',
    'Paste the POKT RPC URL below and save',
    'MetaMask will now route requests through Pocket Network',
  ]

  return (
    <Card>
      <CardHeader title="MetaMask RPC Setup — via POKT" />
      <div className="p-4 flex flex-col gap-4">

        {/* Chain selector */}
        <div className="flex gap-2 flex-wrap">
          {evmChains.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedChain(c.id)}
              className="mono text-[10px] px-2.5 py-1 rounded-full transition-all"
              style={{
                background: selectedChain === c.id ? 'var(--yellow)' : 'var(--bg3)',
                color:      selectedChain === c.id ? '#000'           : 'var(--text2)',
                border:     selectedChain === c.id ? 'none'           : '1px solid var(--border)',
              }}>
              {c.icon} {c.name}
            </button>
          ))}
        </div>

        {cfg && (
          <div className="flex flex-col gap-2">
            <CopyRow label="RPC URL"      value={cfg.rpcUrl}      id="rpc"     />
            <CopyRow label="Chain Name"   value={cfg.chainName}   id="name"    />
            <CopyRow label="Chain ID"     value={cfg.chainId}     id="chainid" />
            <CopyRow label="Symbol"       value={cfg.symbol}      id="symbol"  />
            <CopyRow label="Explorer URL" value={cfg.explorerUrl} id="explorer"/>
          </div>
        )}

        {/* Step guide */}
        <div className="flex flex-col gap-2">
          <span className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
            Setup Steps
          </span>
          {STEPS.map((step, i) => (
            <div key={i} className="flex gap-3 items-start">
              <span className="mono text-[9px] w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-bold"
                style={{ background: 'var(--yellow)', color: '#000' }}>
                {i + 1}
              </span>
              <span className="mono text-[10px] leading-relaxed" style={{ color: 'var(--text2)' }}>
                {step}
              </span>
            </div>
          ))}
        </div>

        {/* Why POKT */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: '🌐', label: 'No Downtime',      desc: '5,000+ nodes — if one fails, others handle it' },
            { icon: '🔒', label: 'No Censorship',    desc: 'No single entity can block your wallet access'  },
            { icon: '🔐', label: 'Real Privacy',     desc: 'No single company logs all your transactions'   },
            { icon: '💰', label: 'Stable Pricing',   desc: 'Predictable costs — providers can\'t arbitrarily raise fees' },
          ].map(item => (
            <div key={item.label} className="p-3 rounded-xl flex flex-col gap-1"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
              <div className="text-base">{item.icon}</div>
              <div className="mono text-[10px] font-bold" style={{ color: 'var(--text)' }}>{item.label}</div>
              <div className="mono text-[9px] leading-relaxed" style={{ color: 'var(--text3)' }}>{item.desc}</div>
            </div>
          ))}
        </div>

        <div className="mono text-[9px] leading-relaxed p-3 rounded-xl"
          style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text3)' }}>
          <span style={{ color: 'var(--yellow)' }}>Security reminder:</span>{' '}
          Never share your private key or seed phrase. The POKT RPC URL only handles read/write
          requests to the blockchain — it never has access to your wallet keys.
          Always verify URLs before adding them to MetaMask.
        </div>
      </div>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Tab
// ─────────────────────────────────────────────────────────────────────────────

type Panel = 'health' | 'query' | 'chains' | 'rpc'

const PANELS: { id: Panel; label: string; icon: string }[] = [
  { id: 'health', label: 'Network Health', icon: '◉' },
  { id: 'query',  label: 'Chain Query',    icon: '◈' },
  { id: 'chains', label: 'Chain Grid',     icon: '⬡' },
  { id: 'rpc',    label: 'RPC Setup',      icon: '⚙' },
]

export default function POKTAgentTab() {
  const [activePanel, setActivePanel] = useState<Panel>('health')

  return (
    <div className="flex flex-col gap-4 pb-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">◎</span>
            <h2 className="mono text-sm font-bold" style={{ color: 'var(--text)' }}>
              Pocket Network Agent
            </h2>
            <Badge label="POKT" color="#5C6BC0" />
            <Badge label="Decentralised RPC" color="var(--green)" />
          </div>
          <p className="mono text-[10px] mt-1" style={{ color: 'var(--text3)' }}>
            Query any chain via 5,000+ independent nodes · No censorship · No single point of failure
          </p>
        </div>
        <a
          href="https://pocket.network"
          target="_blank"
          rel="noopener noreferrer"
          className="mono text-[9px] px-2 py-1 rounded-lg transition-all"
          style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text3)' }}>
          pocket.network ↗
        </a>
      </div>

      {/* Panel tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {PANELS.map(p => (
          <button
            key={p.id}
            onClick={() => setActivePanel(p.id)}
            className="mono text-[10px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
            style={{
              background: activePanel === p.id ? 'var(--yellow)' : 'var(--bg3)',
              color:      activePanel === p.id ? '#000'           : 'var(--text2)',
              border:     activePanel === p.id ? 'none'           : '1px solid var(--border)',
            }}>
            <span>{p.icon}</span>
            {p.label}
          </button>
        ))}
      </div>

      {/* Active panel */}
      {activePanel === 'health'  && <NetworkHealthPanel />}
      {activePanel === 'query'   && <ChainQueryPanel />}
      {activePanel === 'chains'  && <ChainGridPanel />}
      {activePanel === 'rpc'     && <RPCConfigPanel />}
    </div>
  )
}
