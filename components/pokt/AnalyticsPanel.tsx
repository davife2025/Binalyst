'use client'

/**
 * components/pokt/AnalyticsPanel.tsx — Session P5 (new file)
 *
 * POKT Token Analytics Panel — inline SVG charts, zero new dependencies.
 * Rendered inside POKTAgentTab when the user selects the Analytics panel.
 *
 * Charts (all inline SVG, matching BacktestTab pattern):
 *   1. Price chart        — 7d / 30d line chart with gradient fill
 *   2. Burn vs Mint bars  — daily PIP-41 burn/mint delta bar chart
 *   3. CU trend           — computed units sparkline (30-day)
 *   4. Distribution donut — mint split: Suppliers 79% / Validators 14% / DAO 4.5% / Source 2.5%
 *   5. Supply stats       — circulating, staked, deflation rate tiles
 */

import { useState, useEffect, useCallback } from 'react'
import type { POKTAnalyticsData, PricePoint, BurnMintPoint, CUPoint } from '@/lib/pokt/analytics'

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2): string {
  if (n >= 1e9)  return (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6)  return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3)  return (n / 1e3).toFixed(1) + 'K'
  return n.toFixed(decimals)
}

function fmtDate(ts: number, short = false): string {
  const d = new Date(ts)
  return short
    ? `${d.getMonth() + 1}/${d.getDate()}`
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function Spinner() {
  return (
    <span className="w-4 h-4 rounded-full border-2 inline-block animate-spin"
      style={{ borderColor: 'var(--border2)', borderTopColor: 'var(--yellow)' }} />
  )
}

function StatTile({ label, value, sub, color = 'var(--text)' }: {
  label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-xl"
      style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
      <div className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
        {label}
      </div>
      <div className="mono text-sm font-extrabold" style={{ color }}>{value}</div>
      {sub && <div className="mono text-[9px]" style={{ color: 'var(--text3)' }}>{sub}</div>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Price Line Chart (SVG)
// ─────────────────────────────────────────────────────────────────────────────

function PriceChart({ data, days }: { data: PricePoint[]; days: number }) {
  if (!data.length) return (
    <div className="flex items-center justify-center h-32 mono text-xs" style={{ color: 'var(--text3)' }}>
      Price data unavailable
    </div>
  )

  const W = 560; const H = 100; const PAD = { t: 8, b: 20, l: 40, r: 8 }
  const iW = W - PAD.l - PAD.r
  const iH = H - PAD.t - PAD.b

  const prices = data.map(p => p.price)
  const minP   = Math.min(...prices)
  const maxP   = Math.max(...prices)
  const rangeP = maxP - minP || 1

  const pts = data.map((p, i) => {
    const x = PAD.l + (i / (data.length - 1)) * iW
    const y = PAD.t + iH - ((p.price - minP) / rangeP) * iH
    return `${x},${y}`
  })

  const polyline  = pts.join(' ')
  const firstPt   = pts[0]
  const lastPt    = pts[pts.length - 1]
  const [lx, ly]  = lastPt.split(',').map(Number)
  const [fx]      = firstPt.split(',').map(Number)

  const areaPath = `M ${polyline.replace(/,/g, ' ').split(' ').reduce((acc, v, i) =>
    i % 2 === 0 ? acc + ' ' + v : acc + ',' + v, '').trim()} L ${lx} ${PAD.t + iH} L ${fx} ${PAD.t + iH} Z`

  const startP = prices[0]
  const endP   = prices[prices.length - 1]
  const isUp   = endP >= startP
  const colour = isUp ? 'var(--green)' : 'var(--red)'

  // Y-axis labels
  const yLabels = [minP, (minP + maxP) / 2, maxP]

  // X-axis sample dates (5 labels)
  const xSamples = [0, 0.25, 0.5, 0.75, 1].map(f => {
    const idx = Math.round(f * (data.length - 1))
    const x   = PAD.l + f * iW
    return { x, label: fmtDate(data[idx].ts, true) }
  })

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <defs>
        <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={colour} stopOpacity="0.25" />
          <stop offset="100%" stopColor={colour} stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yLabels.map((v, i) => {
        const y = PAD.t + iH - ((v - minP) / rangeP) * iH
        return (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y}
              stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3" />
            <text x={PAD.l - 4} y={y + 3} textAnchor="end"
              style={{ fontSize: 7, fill: 'var(--text3)', fontFamily: 'monospace' }}>
              ${v < 0.01 ? v.toFixed(4) : v.toFixed(3)}
            </text>
          </g>
        )
      })}

      {/* Area fill */}
      <path d={areaPath} fill="url(#priceGrad)" />

      {/* Price line */}
      <polyline points={polyline} fill="none" stroke={colour} strokeWidth="1.5" />

      {/* X labels */}
      {xSamples.map((s, i) => (
        <text key={i} x={s.x} y={H - 4} textAnchor="middle"
          style={{ fontSize: 7, fill: 'var(--text3)', fontFamily: 'monospace' }}>
          {s.label}
        </text>
      ))}

      {/* End price label */}
      <text x={lx + 4} y={ly} style={{ fontSize: 8, fill: colour, fontFamily: 'monospace', fontWeight: 700 }}>
        ${endP.toFixed(4)}
      </text>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Burn vs Mint Bar Chart
// ─────────────────────────────────────────────────────────────────────────────

function BurnMintChart({ data }: { data: BurnMintPoint[] }) {
  if (!data.length) return (
    <div className="flex items-center justify-center h-32 mono text-xs" style={{ color: 'var(--text3)' }}>
      Burn/mint data unavailable — requires POKTscan relay series
    </div>
  )

  const W = 560; const H = 90; const PAD = { t: 8, b: 20, l: 8, r: 8 }
  const iW = W - PAD.l - PAD.r
  const iH = H - PAD.t - PAD.b

  // Use last 14 data points for legibility
  const pts     = data.slice(-14)
  const barW    = iW / pts.length
  const maxVal  = Math.max(...pts.map(p => Math.max(p.burned, p.minted)))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {pts.map((p, i) => {
        const x      = PAD.l + i * barW
        const bH     = (p.burned / maxVal) * iH
        const mH     = (p.minted / maxVal) * iH
        const bY     = PAD.t + iH - bH
        const mY     = PAD.t + iH - mH
        const halfW  = barW * 0.38

        return (
          <g key={i}>
            {/* Burned (red) */}
            <rect x={x + 1} y={bY} width={halfW} height={bH}
              fill="var(--red)" opacity="0.7" rx="1" />
            {/* Minted (green — always shorter by 2.5%) */}
            <rect x={x + halfW + 2} y={mY} width={halfW} height={mH}
              fill="var(--green)" opacity="0.7" rx="1" />
          </g>
        )
      })}

      {/* X-axis date labels (every 3rd bar) */}
      {pts.filter((_, i) => i % 3 === 0).map((p, i) => {
        const idx = i * 3
        const x   = PAD.l + idx * barW + barW / 2
        return (
          <text key={i} x={x} y={H - 4} textAnchor="middle"
            style={{ fontSize: 7, fill: 'var(--text3)', fontFamily: 'monospace' }}>
            {fmtDate(p.ts, true)}
          </text>
        )
      })}

      {/* Legend */}
      <rect x={W - 90} y={PAD.t} width={8} height={6} fill="var(--red)" opacity="0.7" rx="1" />
      <text x={W - 78} y={PAD.t + 6}
        style={{ fontSize: 7, fill: 'var(--text3)', fontFamily: 'monospace' }}>Burned</text>
      <rect x={W - 40} y={PAD.t} width={8} height={6} fill="var(--green)" opacity="0.7" rx="1" />
      <text x={W - 28} y={PAD.t + 6}
        style={{ fontSize: 7, fill: 'var(--text3)', fontFamily: 'monospace' }}>Minted</text>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Computed Units Sparkline
// ─────────────────────────────────────────────────────────────────────────────

function CUSparkline({ data }: { data: CUPoint[] }) {
  if (!data.length) return (
    <div className="flex items-center justify-center h-20 mono text-xs" style={{ color: 'var(--text3)' }}>
      CU data unavailable
    </div>
  )

  const W = 560; const H = 60; const PAD = { t: 6, b: 16, l: 8, r: 8 }
  const iW = W - PAD.l - PAD.r
  const iH = H - PAD.t - PAD.b

  const vals   = data.map(p => p.cus)
  const minV   = Math.min(...vals)
  const maxV   = Math.max(...vals)
  const rangeV = maxV - minV || 1

  const pts = data.map((p, i) => {
    const x = PAD.l + (i / (data.length - 1)) * iW
    const y = PAD.t + iH - ((p.cus - minV) / rangeV) * iH
    return `${x},${y}`
  })

  const last    = data[data.length - 1]
  const [lx, ly] = pts[pts.length - 1].split(',').map(Number)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <polyline points={pts.join(' ')} fill="none" stroke="var(--yellow)" strokeWidth="1.5" />
      <circle cx={lx} cy={ly} r="3" fill="var(--yellow)" />
      <text x={lx + 6} y={ly + 3}
        style={{ fontSize: 8, fill: 'var(--yellow)', fontFamily: 'monospace', fontWeight: 700 }}>
        {fmt(last.cus)}
      </text>
      {[0, 0.5, 1].map((f, i) => {
        const idx = Math.round(f * (data.length - 1))
        const x   = PAD.l + f * iW
        return (
          <text key={i} x={x} y={H - 2} textAnchor={f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}
            style={{ fontSize: 7, fill: 'var(--text3)', fontFamily: 'monospace' }}>
            {fmtDate(data[idx].ts, true)}
          </text>
        )
      })}
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Mint Distribution Donut
// ─────────────────────────────────────────────────────────────────────────────

interface DonutSlice { label: string; pct: number; color: string }

function DonutChart({ slices }: { slices: DonutSlice[] }) {
  const R = 40; const CX = 60; const CY = 60; const strokeW = 16
  const circumference = 2 * Math.PI * R
  let cumPct = 0

  return (
    <svg viewBox="0 0 200 120" className="w-full" style={{ height: 120 }}>
      {/* Background ring */}
      <circle cx={CX} cy={CY} r={R} fill="none"
        stroke="var(--bg4)" strokeWidth={strokeW} />

      {slices.map((s, i) => {
        const dashLen   = (s.pct / 100) * circumference
        const offset    = circumference - (cumPct / 100) * circumference
        const rotation  = -90 + (cumPct / 100) * 360
        cumPct += s.pct
        return (
          <circle key={i} cx={CX} cy={CY} r={R} fill="none"
            stroke={s.color}
            strokeWidth={strokeW}
            strokeDasharray={`${dashLen} ${circumference - dashLen}`}
            strokeDashoffset={offset}
            transform={`rotate(${rotation} ${CX} ${CY})`}
            opacity="0.85"
          />
        )
      })}

      {/* Centre label */}
      <text x={CX} y={CY - 4} textAnchor="middle"
        style={{ fontSize: 9, fill: 'var(--text3)', fontFamily: 'monospace' }}>
        Mint Split
      </text>
      <text x={CX} y={CY + 8} textAnchor="middle"
        style={{ fontSize: 8, fill: 'var(--yellow)', fontFamily: 'monospace', fontWeight: 700 }}>
        PIP-41
      </text>

      {/* Legend */}
      {slices.map((s, i) => (
        <g key={i} transform={`translate(130, ${14 + i * 22})`}>
          <rect width={10} height={10} fill={s.color} rx="2" opacity="0.85" />
          <text x={14} y={9}
            style={{ fontSize: 8, fill: 'var(--text2)', fontFamily: 'monospace' }}>
            {s.pct}% {s.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Analytics Panel
// ─────────────────────────────────────────────────────────────────────────────

type DaysOption = 7 | 30 | 90

export default function AnalyticsPanel() {
  const [data,    setData]    = useState<POKTAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [days,    setDays]    = useState<DaysOption>(30)

  const fetchData = useCallback(async (d: DaysOption, force = false) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/pokt-agent/analytics?days=${d}${force ? '&force=1' : ''}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as POKTAnalyticsData
      setData(json)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(days) }, [days]) // eslint-disable-line react-hooks/exhaustive-deps

  const donutSlices: DonutSlice[] = data ? [
    { label: 'Suppliers',  pct: data.supply.supplierSharePct,    color: 'var(--green)'  },
    { label: 'Validators', pct: data.supply.validatorSharePct,   color: 'var(--yellow)' },
    { label: 'DAO',        pct: data.supply.daoSharePct,         color: '#5C6BC0'       },
    { label: 'Source',     pct: data.supply.sourceOwnerSharePct, color: 'var(--text3)'  },
  ] : []

  const priceColor = data?.priceChange24h != null
    ? data.priceChange24h >= 0 ? 'var(--green)' : 'var(--red)'
    : 'var(--text)'

  return (
    <div className="flex flex-col gap-4">

      {/* Header row — price stats + day selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          {data?.currentPrice != null && (
            <div className="flex items-center gap-2">
              <span className="mono text-lg font-extrabold" style={{ color: 'var(--yellow)' }}>
                ${data.currentPrice.toFixed(4)}
              </span>
              {data.priceChange24h != null && (
                <span className="mono text-xs font-bold" style={{ color: priceColor }}>
                  {data.priceChange24h >= 0 ? '▲' : '▼'} {Math.abs(data.priceChange24h).toFixed(2)}% 24h
                </span>
              )}
              {data.priceChange7d != null && (
                <span className="mono text-xs" style={{ color: data.priceChange7d >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  / {data.priceChange7d >= 0 ? '+' : ''}{data.priceChange7d.toFixed(2)}% 7d
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {([7, 30, 90] as DaysOption[]).map(d => (
            <button key={d} onClick={() => setDays(d)}
              className="mono text-[10px] px-2.5 py-1 rounded-full transition-all"
              style={{
                background: days === d ? 'var(--yellow)' : 'var(--bg3)',
                color:      days === d ? '#000'          : 'var(--text2)',
                border:     days === d ? 'none'          : '1px solid var(--border)',
              }}>
              {d}D
            </button>
          ))}
          <button onClick={() => fetchData(days, true)} disabled={loading}
            className="mono text-[10px] px-2.5 py-1 rounded-full transition-all"
            style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text2)' }}>
            {loading ? <Spinner /> : '↻'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mono text-xs p-3 rounded-xl" style={{ background: 'rgba(246,70,93,0.08)', color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="flex justify-center py-12"><Spinner /></div>
      )}

      {data && (
        <>
          {/* Supply stats */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile
              label="Circulating Supply"
              value={fmt(data.supply.circulatingSupply)}
              sub="POKT tokens"
              color="var(--text)"
            />
            <StatTile
              label="Staked Supply"
              value={fmt(data.supply.stakedSupply)}
              sub={`${((data.supply.stakedSupply / data.supply.circulatingSupply) * 100).toFixed(1)}% of circ.`}
              color="var(--green)"
            />
            <StatTile
              label="Burn Deflation"
              value={`${data.supply.burnDeflationPct}%`}
              sub="Permanently removed per cycle"
              color="var(--red)"
            />
            <StatTile
              label="Mint Ratio"
              value={`${(data.supply.mintRatio * 100).toFixed(1)}%`}
              sub="Of burned returned as rewards"
              color="var(--yellow)"
            />
          </div>

          {/* Price chart */}
          <div className="rounded-xl overflow-hidden"
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div className="px-4 py-2.5 flex items-center justify-between"
              style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
              <span className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
                POKT Price — {days}D
              </span>
              <span className="mono text-[9px]" style={{ color: 'var(--text3)' }}>
                {data.dataSource.price === 'coingecko' ? '◉ CoinGecko' : '○ Data unavailable'}
              </span>
            </div>
            <div className="p-3">
              <PriceChart data={data.priceHistory} days={days} />
            </div>
          </div>

          {/* Burn/mint + Donut row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Burn vs Mint */}
            <div className="rounded-xl overflow-hidden"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <div className="px-4 py-2.5"
                style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
                <span className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
                  Burn vs Mint — PIP-41 Deflation
                </span>
              </div>
              <div className="p-3">
                <BurnMintChart data={data.burnMintSeries} />
                <div className="mono text-[9px] mt-2 leading-relaxed" style={{ color: 'var(--text3)' }}>
                  Each cycle: burned POKT → only 97.5% minted back.
                  {' '}<span style={{ color: 'var(--red)' }}>2.5% permanently removed.</span>
                  {' '}More network usage = faster deflation.
                </div>
              </div>
            </div>

            {/* Mint distribution donut */}
            <div className="rounded-xl overflow-hidden"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <div className="px-4 py-2.5"
                style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
                <span className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
                  Mint Distribution — PIP-41
                </span>
              </div>
              <div className="p-3">
                <DonutChart slices={donutSlices} />
              </div>
            </div>
          </div>

          {/* CU Trend */}
          <div className="rounded-xl overflow-hidden"
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div className="px-4 py-2.5 flex items-center justify-between"
              style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
              <span className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
                Computed Units — 30D Trend
              </span>
              <span className="mono text-[9px]" style={{ color: 'var(--text3)' }}>
                {data.dataSource.metrics === 'poktscan' ? '◉ POKTscan' : '○ Data unavailable'}
              </span>
            </div>
            <div className="p-3">
              <CUSparkline data={data.cuSeries} />
              <div className="mono text-[9px] mt-1" style={{ color: 'var(--text3)' }}>
                Computed Units measure total network work. Higher = more relays served = more POKT burned.
                AI requests cost more CUs than standard RPC requests.
              </div>
            </div>
          </div>

          <div className="mono text-[9px]" style={{ color: 'var(--text3)' }}>
            Data sources: CoinGecko (price) · POKTscan (network metrics) · Updated {new Date(data.fetchedAt).toLocaleTimeString()}
          </div>
        </>
      )}
    </div>
  )
}
