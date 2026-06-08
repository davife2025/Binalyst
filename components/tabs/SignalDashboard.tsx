'use client'

/**
 * components/tabs/SignalDashboard.tsx
 * Session B: Live CMC signal dashboard.
 * Fear & Greed gauge + batch signal cards + summary stats.
 * Auto-refreshes every 60s from the CMC Agent Hub.
 */

import { useState } from 'react'
import { useSignals } from '@/hooks/useSignals'
import FearGreedGauge, { FearGreedMini } from '@/components/agent/FearGreedGauge'
import SignalCard from '@/components/agent/SignalCard'
import { useAgentStore } from '@/lib/agentStore'
import { COMPETITION_SYMBOLS } from '@/lib/skills/cmc'

type FilterDir = 'ALL' | 'BUY' | 'SELL' | 'HOLD'
type SortKey   = 'score' | 'change24h' | 'volume' | 'symbol'

const SYMBOL_PRESETS = [
  { label: 'Top 12',       symbols: COMPETITION_SYMBOLS.slice(0, 12)  },
  { label: 'Large Caps',   symbols: ['ETH', 'BNB', 'XRP', 'ADA', 'AVAX', 'DOT', 'LINK', 'ATOM'] },
  { label: 'DeFi',         symbols: ['CAKE', 'AAVE', 'UNI', 'COMP', 'SNX', 'SUSHI', 'PENDLE'] },
  { label: 'Meme & Alt',   symbols: ['DOGE', 'SHIB', 'FLOKI', 'BONK', 'PENGU', 'APE', 'BABYDOGE'] },
]

export default function SignalDashboard() {
  const { agentConfig }                         = useAgentStore()
  const [preset,     setPreset]                 = useState(0)
  const [filterDir,  setFilterDir]              = useState<FilterDir>('ALL')
  const [sortKey,    setSortKey]                = useState<SortKey>('score')
  const [selected,   setSelected]               = useState<string | null>(null)
  const [viewMode,   setViewMode]               = useState<'grid' | 'list'>('grid')
  const [showHistory, setShowHistory]           = useState(false)

  const { snapshots, summary, fearGreed, fgHistory, status, lastFetch, refresh } =
    useSignals(SYMBOL_PRESETS[preset].symbols)

  // Filter + sort
  const filtered = snapshots
    .filter(s => filterDir === 'ALL' || s.signalDir === filterDir)
    .sort((a, b) => {
      switch (sortKey) {
        case 'score':     return b.signalScore - a.signalScore
        case 'change24h': return b.change24h   - a.change24h
        case 'volume':    return b.volume24h   - a.volume24h
        case 'symbol':    return a.symbol.localeCompare(b.symbol)
        default:          return 0
      }
    })

  const selectedSignal = selected ? snapshots.find(s => s.symbol === selected) : null

  function fmtTime(ts: number | null) {
    if (!ts) return 'Never'
    const d = new Date(ts)
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const statusColor =
    status === 'live'  ? 'var(--green)'  :
    status === 'stale' ? 'var(--yellow)' :
    status === 'error' ? 'var(--red)'    : 'var(--text3)'

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left: Signal list ───────────────────────────────────────────── */}
      <div className="w-64 shrink-0 flex flex-col border-r overflow-hidden"
        style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>

        {/* Header */}
        <div className="px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
              Signals
            </span>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full"
                style={{ background: statusColor, animation: status === 'live' ? 'blink 2s infinite' : 'none' }} />
              <span className="mono text-[9px]" style={{ color: statusColor }}>
                {status === 'live' ? 'Live' : status === 'loading' ? 'Loading' : status}
              </span>
            </div>
          </div>

          {/* Preset tabs */}
          <div className="flex flex-wrap gap-1 mb-2">
            {SYMBOL_PRESETS.map((p, i) => (
              <button key={i} onClick={() => setPreset(i)}
                className="mono text-[9px] px-2 py-1 rounded transition-all"
                style={{
                  background: preset === i ? 'var(--yellow)' : 'var(--bg3)',
                  color:      preset === i ? '#000'          : 'var(--text3)',
                }}>
                {p.label}
              </button>
            ))}
          </div>

          {/* Direction filter */}
          <div className="flex gap-1">
            {(['ALL', 'BUY', 'SELL', 'HOLD'] as FilterDir[]).map(f => (
              <button key={f} onClick={() => setFilterDir(f)}
                className="flex-1 mono text-[9px] py-1 rounded transition-all"
                style={{
                  background: filterDir === f
                    ? f === 'BUY' ? 'rgba(14,203,129,0.2)' : f === 'SELL' ? 'rgba(246,70,93,0.2)' : 'var(--bg4)'
                    : 'var(--bg3)',
                  color: filterDir === f
                    ? f === 'BUY' ? 'var(--green)' : f === 'SELL' ? 'var(--red)' : 'var(--text2)'
                    : 'var(--text3)',
                }}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Signal list */}
        <div className="flex-1 overflow-y-auto py-2 px-2 flex flex-col gap-1">
          {status === 'loading' && !snapshots.length ? (
            Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center h-24 mono text-xs"
              style={{ color: 'var(--text3)' }}>
              No signals
            </div>
          ) : (
            filtered.map(s => (
              <SignalCard key={s.symbol} signal={s} compact
                selected={selected === s.symbol}
                onClick={() => setSelected(s.symbol === selected ? null : s.symbol)} />
            ))
          )}
        </div>

        {/* Refresh */}
        <div className="px-3 py-2 border-t shrink-0 flex items-center justify-between"
          style={{ borderColor: 'var(--border)' }}>
          <span className="mono text-[9px]" style={{ color: 'var(--text3)' }}>
            {lastFetch ? fmtTime(lastFetch) : 'Fetching...'}
          </span>
          <button onClick={refresh} disabled={status === 'loading'}
            className="mono text-[9px] px-2 py-1 rounded transition-all"
            style={{ background: 'var(--bg3)', color: 'var(--text3)',
              opacity: status === 'loading' ? 0.5 : 1 }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* ── Main: Dashboard ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">

        {/* Top row: F&G + Summary stats */}
        <div className="px-6 py-5 border-b shrink-0 flex items-start gap-6 flex-wrap"
          style={{ borderColor: 'var(--border)' }}>

          {/* Fear & Greed gauge */}
          <div className="flex flex-col items-center gap-2">
            <div className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
              Fear & Greed Index
            </div>
            <FearGreedGauge data={fearGreed} size={160}
              showHistory={showHistory} history={fgHistory} />
            <button onClick={() => setShowHistory(v => !v)}
              className="mono text-[9px] px-2 py-1 rounded"
              style={{ background: 'var(--bg3)', color: 'var(--text3)' }}>
              {showHistory ? 'Hide history' : 'Show 30d history'}
            </button>
          </div>

          {/* Summary stats */}
          {summary && (
            <div className="flex-1 flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: '🟢 Bullish',  value: summary.bullishCount, color: 'var(--green)'  },
                  { label: '🔴 Bearish',  value: summary.bearishCount, color: 'var(--red)'    },
                  { label: '⚪ Neutral',  value: summary.neutralCount, color: 'var(--text2)'  },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl p-3"
                    style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                    <div className="mono text-[9px] mb-1" style={{ color: 'var(--text3)' }}>{label}</div>
                    <div className="mono text-xl font-extrabold" style={{ color }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Avg score bar */}
              <div className="rounded-xl p-3" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                <div className="flex justify-between mb-1.5">
                  <span className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
                    Market Score
                  </span>
                  <span className="mono text-xs font-bold" style={{
                    color: summary.avgScore >= 60 ? 'var(--green)' : summary.avgScore <= 40 ? 'var(--red)' : 'var(--yellow)'
                  }}>
                    {summary.avgScore.toFixed(0)}/100
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg4)' }}>
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${summary.avgScore}%`,
                      background: summary.avgScore >= 60 ? 'var(--green)' : summary.avgScore <= 40 ? 'var(--red)' : 'var(--yellow)',
                    }} />
                </div>
              </div>

              {/* Top picks */}
              {(summary.topBuy || summary.topSell) && (
                <div className="grid grid-cols-2 gap-3">
                  {summary.topBuy && (
                    <div className="rounded-xl p-3"
                      style={{ background: 'rgba(14,203,129,0.06)', border: '1px solid rgba(14,203,129,0.2)' }}>
                      <div className="mono text-[9px] mb-1" style={{ color: 'var(--green)' }}>
                        Top BUY Signal
                      </div>
                      <div className="font-extrabold text-sm" style={{ color: 'var(--text)' }}>
                        {summary.topBuy.symbol}
                      </div>
                      <div className="mono text-[10px]" style={{ color: 'var(--green)' }}>
                        Score: {summary.topBuy.signalScore.toFixed(0)}
                      </div>
                    </div>
                  )}
                  {summary.topSell && (
                    <div className="rounded-xl p-3"
                      style={{ background: 'rgba(246,70,93,0.06)', border: '1px solid rgba(246,70,93,0.2)' }}>
                      <div className="mono text-[9px] mb-1" style={{ color: 'var(--red)' }}>
                        Top SELL Signal
                      </div>
                      <div className="font-extrabold text-sm" style={{ color: 'var(--text)' }}>
                        {summary.topSell.symbol}
                      </div>
                      <div className="mono text-[10px]" style={{ color: 'var(--red)' }}>
                        Score: {summary.topSell.signalScore.toFixed(0)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Signal detail or grid ─────────────────────────────────────────── */}
        <div className="flex-1 px-6 py-5">
          {selectedSignal ? (
            <div className="max-w-lg">
              <div className="flex items-center gap-3 mb-4">
                <button onClick={() => setSelected(null)}
                  className="mono text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)' }}>
                  ← Back
                </button>
                <span className="font-bold" style={{ color: 'var(--text)' }}>
                  {selectedSignal.symbol} Signal Detail
                </span>
              </div>
              <SignalCard signal={selectedSignal} />
            </div>
          ) : (
            <>
              {/* View + sort controls */}
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <div className="flex gap-1">
                  {(['grid', 'list'] as const).map(v => (
                    <button key={v} onClick={() => setViewMode(v)}
                      className="mono text-[10px] px-3 py-1.5 rounded-lg transition-all"
                      style={{
                        background: viewMode === v ? 'var(--yellow)' : 'var(--bg2)',
                        color: viewMode === v ? '#000' : 'var(--text3)',
                        border: `1px solid ${viewMode === v ? 'transparent' : 'var(--border)'}`,
                      }}>
                      {v === 'grid' ? '⊞ Grid' : '≡ List'}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <span className="mono text-[9px]" style={{ color: 'var(--text3)' }}>Sort:</span>
                  {(['score', 'change24h', 'volume', 'symbol'] as SortKey[]).map(k => (
                    <button key={k} onClick={() => setSortKey(k)}
                      className="mono text-[9px] px-2 py-1 rounded transition-all"
                      style={{
                        background: sortKey === k ? 'var(--bg4)' : 'transparent',
                        color: sortKey === k ? 'var(--yellow)' : 'var(--text3)',
                      }}>
                      {k === 'change24h' ? '24h' : k}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cards */}
              {viewMode === 'grid' ? (
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                  {filtered.map(s => (
                    <SignalCard key={s.symbol} signal={s}
                      selected={selected === s.symbol}
                      onClick={() => setSelected(s.symbol)} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {filtered.map(s => (
                    <SignalCard key={s.symbol} signal={s} compact
                      selected={selected === s.symbol}
                      onClick={() => setSelected(s.symbol)} />
                  ))}
                </div>
              )}

              {status === 'loading' && !snapshots.length && (
                <div className="grid gap-3 mt-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded-xl p-4 h-40 animate-pulse"
                      style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-xl px-3 py-2.5 flex items-center gap-3 animate-pulse"
      style={{ background: 'var(--bg3)', border: '1px solid var(--border)', height: 38 }}>
      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--bg4)' }} />
      <div className="w-10 h-3 rounded" style={{ background: 'var(--bg4)' }} />
      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--bg4)' }} />
      <div className="w-6 h-3 rounded" style={{ background: 'var(--bg4)' }} />
    </div>
  )
}
