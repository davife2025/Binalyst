'use client'

import { useEffect, useState, useRef } from 'react'
import { useStore } from '@/lib/store'
import { useSession } from 'next-auth/react'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Ticker { symbol: string; price: string; change: string; vol: string }
interface Mover  { symbol: string; price: string; change: string }

// ── Constants ─────────────────────────────────────────────────────────────────
const COINS = ['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','DOGEUSDT']
const COIN_NAMES: Record<string,string> = { BTCUSDT:'Bitcoin', ETHUSDT:'Ethereum', BNBUSDT:'BNB', SOLUSDT:'Solana', XRPUSDT:'XRP', DOGEUSDT:'Dogecoin' }
const COIN_ICONS: Record<string,string> = { BTCUSDT:'₿', ETHUSDT:'Ξ', BNBUSDT:'◆', SOLUSDT:'◎', XRPUSDT:'✕', DOGEUSDT:'Ð' }

const QUICK_ACTIONS = [
  { id:'chat',      icon:'◈', label:'Ask AI',        desc:'Market analysis, trade ideas' },
  { id:'markets',   icon:'◐', label:'Markets',       desc:'Live prices & charts' },
  { id:'web3',      icon:'⬡', label:'Web3',          desc:'Tokens, audits, wallets' },
  { id:'trading',   icon:'⚡', label:'Trade',         desc:'Buy & sell on Binance' },
  { id:'events',    icon:'◎', label:'Events',        desc:'Listings & airdrops' },
  { id:'portfolio', icon:'◑', label:'Portfolio',     desc:'Holdings & P&L' },
  { id:'square',    icon:'✦', label:'Square',        desc:'Post to Binance Square' },
  { id:'alerts',    icon:'🔔', label:'Alerts',        desc:'Price notifications' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtPrice(p: string) {
  const n = parseFloat(p)
  if (isNaN(n)) return '—'
  if (n >= 1000) return n.toLocaleString('en', { maximumFractionDigits: 2 })
  if (n >= 1)    return n.toFixed(4)
  return n.toFixed(6)
}

function Spark({ change }: { change: string }) {
  const up = parseFloat(change) >= 0
  return (
    <svg width="40" height="20" viewBox="0 0 40 20">
      <polyline
        points={up ? '0,18 8,14 16,10 24,8 32,5 40,2' : '0,2 8,6 16,10 24,13 32,16 40,18'}
        fill="none"
        stroke={up ? '#0ECB81' : '#F6465D'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────
function TickerBar({ tickers }: { tickers: Ticker[] }) {
  return (
    <div className="overflow-hidden border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg2)' }}>
      <div className="flex animate-ticker-scroll" style={{ width: 'max-content' }}>
        {[...tickers, ...tickers].map((t, i) => {
          const up = parseFloat(t.change) >= 0
          return (
            <div key={i} className="flex items-center gap-2 px-5 py-2 border-r" style={{ borderColor: 'var(--border)' }}>
              <span className="mono text-[10px] font-bold" style={{ color: 'var(--text2)' }}>{t.symbol.replace('USDT', '')}</span>
              <span className="mono text-[10px]" style={{ color: 'var(--text)' }}>${fmtPrice(t.price)}</span>
              <span className="mono text-[9px] font-bold" style={{ color: up ? 'var(--green)' : 'var(--red)' }}>
                {up ? '▲' : '▼'} {Math.abs(parseFloat(t.change)).toFixed(2)}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CoinCard({ ticker }: { ticker: Ticker }) {
  const up     = parseFloat(ticker.change) >= 0
  const symbol = ticker.symbol
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2 transition-all cursor-pointer hover:scale-[1.02]"
      style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center mono text-sm font-bold"
            style={{ background: 'var(--bg3)', color: 'var(--yellow)' }}>
            {COIN_ICONS[symbol]}
          </div>
          <div>
            <div className="mono text-[10px] font-bold" style={{ color: 'var(--text)' }}>{symbol.replace('USDT','')}</div>
            <div className="mono text-[8px]" style={{ color: 'var(--text3)' }}>{COIN_NAMES[symbol]}</div>
          </div>
        </div>
        <Spark change={ticker.change} />
      </div>
      <div>
        <div className="mono text-sm font-bold" style={{ color: 'var(--text)' }}>${fmtPrice(ticker.price)}</div>
        <div className="mono text-[10px] font-bold mt-0.5" style={{ color: up ? 'var(--green)' : 'var(--red)' }}>
          {up ? '+' : ''}{parseFloat(ticker.change).toFixed(2)}%
        </div>
      </div>
    </div>
  )
}

function AiQuickBar({ onNavigate }: { onNavigate: (tab: any) => void }) {
  const [query,    setQuery]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [response, setResponse] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function ask() {
    if (!query.trim() || loading) return
    setLoading(true); setResponse('')
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: query }], mode: 'assistant' }),
      })
      const reader = res.body?.getReader(); const dec = new TextDecoder(); let text = ''
      if (!reader) return
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        for (const line of dec.decode(value).split('\n').filter(l => l.startsWith('data: '))) {
          try { const j = JSON.parse(line.slice(6)); if (j.type === 'text') text += j.text } catch {}
        }
      }
      setResponse(text.slice(0, 300) + (text.length > 300 ? '...' : ''))
    } catch {}
    setLoading(false)
  }

  const PROMPTS = ['What is BTC price?', 'Top movers today?', 'Audit token 0x...', 'What is trending on BSC?']

  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
      <div className="mono text-[10px] uppercase tracking-widest mb-3" style={{ color: 'var(--text3)' }}>◈ Quick ask AI</div>
      <div className="flex gap-2 mb-3">
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && ask()}
          placeholder="Ask anything about Binance, prices, tokens..."
          className="flex-1 mono text-sm px-4 py-3 rounded-xl outline-none"
          style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)' }}
          onFocus={e => (e.target.style.borderColor = 'var(--yellow)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border2)')}
        />
        <button
          onClick={ask}
          disabled={!query.trim() || loading}
          className="px-5 py-3 rounded-xl mono text-sm font-bold flex items-center gap-2 transition-all"
          style={{ background: query.trim() && !loading ? 'var(--yellow)' : 'var(--bg4)', color: query.trim() && !loading ? '#000' : 'var(--text3)', cursor: query.trim() && !loading ? 'pointer' : 'not-allowed' }}
        >
          {loading && <span className="w-4 h-4 rounded-full border-2 border-black/30 border-t-black animate-spin-slow" />}
          {loading ? '...' : 'Ask'}
        </button>
      </div>

      {/* Quick prompts */}
      <div className="flex flex-wrap gap-2 mb-3">
        {PROMPTS.map(p => (
          <button key={p} onClick={() => { setQuery(p); setTimeout(() => inputRef.current?.focus(), 50) }}
            className="mono text-[10px] px-3 py-1 rounded-full transition-all"
            style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text3)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--yellow)'; (e.currentTarget as HTMLElement).style.color = 'var(--yellow)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text3)' }}>
            {p}
          </button>
        ))}
        <button onClick={() => onNavigate('chat')}
          className="mono text-[10px] px-3 py-1 rounded-full transition-all ml-auto"
          style={{ background: 'var(--yellow-glow)', border: '1px solid rgba(240,185,11,0.3)', color: 'var(--yellow)' }}>
          Full chat →
        </button>
      </div>

      {response && (
        <div className="mono text-xs leading-relaxed p-3 rounded-xl animate-fade-up"
          style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
          {response}
        </div>
      )}
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function DashboardTab() {
  const { setActiveTab, isConnected } = useStore()
  const { data: session } = useSession()

  const [tickers,  setTickers]  = useState<Ticker[]>([])
  const [movers,   setMovers]   = useState<{ gainers: Mover[]; losers: Mover[] }>({ gainers: [], losers: [] })
  const [time,     setTime]     = useState(new Date())
  const [loadingM, setLoadingM] = useState(true)

  // Clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Fetch prices via REST (fallback for WebSocket)
  useEffect(() => {
    async function fetchPrices() {
      try {
        const res  = await fetch(`/api/binance/market?action=prices&symbols=${COINS.join(',')}`)
        const data = await res.json()
        if (data.success && data.data) {
          const t: Ticker[] = COINS.map(s => ({
            symbol: s,
            price:  data.data[s]?.price  ?? '0',
            change: data.data[s]?.change ?? '0',
            vol:    data.data[s]?.volume ?? '0',
          }))
          setTickers(t)
        }
      } catch {}
    }
    fetchPrices()
    const id = setInterval(fetchPrices, 15000)
    return () => clearInterval(id)
  }, [])

  // Fetch movers
  useEffect(() => {
    async function fetchMovers() {
      setLoadingM(true)
      try {
        const res  = await fetch('/api/binance/market?action=movers&limit=3')
        const data = await res.json()
        if (data.success) setMovers({ gainers: data.data?.gainers ?? [], losers: data.data?.losers ?? [] })
      } catch {}
      setLoadingM(false)
    }
    fetchMovers()
  }, [])

  const name    = session?.user?.name ?? session?.user?.email?.split('@')[0] ?? 'Trader'
  const hour    = time.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%' }}>

      {/* Ticker bar */}
      {tickers.length > 0 && <TickerBar tickers={tickers} />}

      <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="mono text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text3)' }}>
              {time.toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <h1 className="text-2xl font-extrabold" style={{ color: 'var(--text)' }}>
              {greeting}, {name.split(' ')[0]} 👋
            </h1>
            <p className="mono text-xs mt-1" style={{ color: 'var(--text3)' }}>
              {isConnected ? '● Binance connected — all features active' : '○ Connect API key in Settings to unlock trading'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="mono text-3xl font-bold tabular-nums" style={{ color: 'var(--text)', letterSpacing: '-1px' }}>
              {time.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="mono text-[10px]" style={{ color: 'var(--text3)' }}>UTC{(time.getTimezoneOffset() / -60) >= 0 ? '+' : ''}{time.getTimezoneOffset() / -60}</div>
          </div>
        </div>

        {/* Market overview */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>Market snapshot</span>
            <button onClick={() => setActiveTab('markets')} className="mono text-[10px]" style={{ color: 'var(--yellow)' }}>View all →</button>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
            {tickers.length > 0
              ? tickers.map(t => <CoinCard key={t.symbol} ticker={t} />)
              : COINS.map(c => (
                <div key={c} className="rounded-xl p-4 animate-pulse" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', height: 100 }}>
                  <div className="h-3 rounded mb-2" style={{ background: 'var(--bg4)', width: '60%' }} />
                  <div className="h-5 rounded mb-1" style={{ background: 'var(--bg4)', width: '80%' }} />
                  <div className="h-3 rounded" style={{ background: 'var(--bg4)', width: '40%' }} />
                </div>
              ))
            }
          </div>
        </div>

        {/* AI quick ask + movers */}
        <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 300px' }}>
          <AiQuickBar onNavigate={setActiveTab} />

          {/* Top movers */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div className="flex border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex-1 px-4 py-3 border-r" style={{ borderColor: 'var(--border)', background: 'rgba(14,203,129,0.05)' }}>
                <span className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--green)' }}>Top gainers</span>
              </div>
              <div className="flex-1 px-4 py-3" style={{ background: 'rgba(246,70,93,0.05)' }}>
                <span className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--red)' }}>Top losers</span>
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x" style={{ borderColor: 'var(--border)' }}>
              <div>
                {loadingM
                  ? <div className="p-4 mono text-xs" style={{ color: 'var(--text3)' }}>Loading...</div>
                  : movers.gainers.slice(0,3).map((m,i) => (
                    <div key={i} className="px-4 py-3 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                      <div className="mono text-xs font-bold" style={{ color: 'var(--text)' }}>{m.symbol?.replace('USDT','')}</div>
                      <div className="mono text-[10px] font-bold" style={{ color: 'var(--green)' }}>+{parseFloat(m.change).toFixed(2)}%</div>
                    </div>
                  ))
                }
              </div>
              <div>
                {loadingM
                  ? <div className="p-4 mono text-xs" style={{ color: 'var(--text3)' }}>Loading...</div>
                  : movers.losers.slice(0,3).map((m,i) => (
                    <div key={i} className="px-4 py-3 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                      <div className="mono text-xs font-bold" style={{ color: 'var(--text)' }}>{m.symbol?.replace('USDT','')}</div>
                      <div className="mono text-[10px] font-bold" style={{ color: 'var(--red)' }}>{parseFloat(m.change).toFixed(2)}%</div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        </div>

        {/* Quick navigation */}
        <div>
          <div className="mono text-[10px] uppercase tracking-widest mb-3" style={{ color: 'var(--text3)' }}>Quick access</div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
            {QUICK_ACTIONS.map(a => (
              <button
                key={a.id}
                onClick={() => setActiveTab(a.id as any)}
                className="flex flex-col items-start gap-2 p-4 rounded-xl text-left transition-all group"
                style={{ background: 'var(--bg2)', border: '1px solid var(--border)', cursor: 'pointer' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(240,185,11,0.4)'; (e.currentTarget as HTMLElement).style.background = 'var(--yellow-glow)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg2)' }}
              >
                <span className="text-xl">{a.icon}</span>
                <div>
                  <div className="mono text-xs font-bold" style={{ color: 'var(--text)' }}>{a.label}</div>
                  <div className="mono text-[9px] mt-0.5" style={{ color: 'var(--text3)' }}>{a.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-4 flex-wrap py-3 border-t" style={{ borderColor: 'var(--border)' }}>
          {[
            { label: 'AI engine',   value: 'Gemini 2.0 Flash',  ok: true },
            { label: 'Binance API', value: isConnected ? 'Connected' : 'Not connected', ok: isConnected },
            { label: 'Skills Hub',  value: '8 skills active',   ok: true },
            { label: 'WebSocket',   value: tickers.length > 0 ? 'Live' : 'Polling', ok: tickers.length > 0 },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.ok ? 'var(--green)' : 'var(--text3)' }} />
              <span className="mono text-[10px]" style={{ color: 'var(--text3)' }}>{s.label}</span>
              <span className="mono text-[10px] font-bold" style={{ color: s.ok ? 'var(--text2)' : 'var(--text3)' }}>{s.value}</span>
            </div>
          ))}
        </div>

      </div>

      <style>{`
        @keyframes ticker {
          0%   { transform: translateX(0) }
          100% { transform: translateX(-50%) }
        }
        .animate-ticker-scroll {
          animation: ticker 30s linear infinite;
        }
        .animate-ticker-scroll:hover {
          animation-play-state: paused;
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(8px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        .animate-fade-up { animation: fade-up 0.3s ease forwards }
      `}</style>
    </div>
  )
}
