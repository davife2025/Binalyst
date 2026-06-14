'use client'

/**
 * components/tabs/WorldCupTab.tsx
 * Session 4 — World Cup Hook dashboard.
 *
 * Tabs: Overview · Match Signals · Volume · X Posts
 *
 * Data sources:
 *   /api/worldcup              → WorldCupSignal (match state + hook phase)
 *   /api/worldcup?matches=true → full today's match list
 *   /api/xlayer/volume         → OKX Wallet swap volume snapshot
 *
 * SAFE: New file. No existing files modified except page.tsx
 * (two lines added — one import, one TABS entry).
 */

import { useState, useEffect, useCallback } from 'react'
import type { WorldCupSignal, WorldCupMatch } from '@/lib/xlayer/worldcup'
import type { VolumeSnapshot }               from '@/app/api/xlayer/volume/route'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'matches' | 'volume'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtUSD(n: number): string {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000)     return '$' + (n / 1_000).toFixed(1) + 'K'
  return '$' + n.toFixed(2)
}

function fmtNum(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return String(n)
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60)  return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

function kickoffCountdown(kickoffTs: number): string {
  const diff = Math.max(0, kickoffTs * 1000 - Date.now())
  const h    = Math.floor(diff / 3_600_000)
  const m    = Math.floor((diff % 3_600_000) / 60_000)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function phaseColor(phase: string): string {
  if (phase === 'GOAL')       return 'var(--red)'
  if (phase === 'LIVE')       return 'var(--green)'
  if (phase === 'HT')         return 'var(--yellow)'
  if (phase === 'PRE_MATCH')  return 'var(--yellow)'
  if (phase === 'POST_MATCH' || phase === 'FINISHED' || phase === 'FT') return 'var(--text3)'
  return 'var(--text3)'
}

function phaseLabel(phase: string): string {
  if (phase === 'GOAL')       return 'GOAL ⚽'
  if (phase === 'LIVE')       return 'LIVE'
  if (phase === 'HT')         return 'HT'
  if (phase === 'PRE_MATCH')  return 'PRE'
  if (phase === 'FINISHED' || phase === 'FT') return 'FT'
  if (phase === 'POST_MATCH') return 'FT'
  return phase
}

function hookFeeColor(bips: number): string {
  if (bips >= 8000) return 'var(--red)'
  if (bips >= 3000) return 'var(--yellow)'
  return 'var(--green)'
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl p-3 sm:p-4"
      style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
      <div className="mono text-[9px] uppercase tracking-widest mb-1.5"
        style={{ color: 'var(--text3)' }}>{label}</div>
      <div className="mono text-lg sm:text-xl font-bold"
        style={{ color: color ?? 'var(--text)' }}>{value}</div>
    </div>
  )
}

function Panel({ title, children, className = '' }: {
  title: string; children: React.ReactNode; className?: string
}) {
  return (
    <div className={`rounded-xl p-4 ${className}`}
      style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
      <div className="mono text-[9px] uppercase tracking-widest mb-3"
        style={{ color: 'var(--text3)' }}>{title}</div>
      {children}
    </div>
  )
}

function MatchCard({ match, isActive }: { match: WorldCupMatch; isActive: boolean }) {
  const col  = phaseColor(match.phase)
  const lbl  = phaseLabel(match.phase)
  const live = ['LIVE', 'GOAL', 'HT'].includes(match.phase)

  return (
    <div className="flex items-center justify-between py-3 border-b last:border-b-0"
      style={{ borderColor: 'var(--border)' }}>
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex items-center gap-1.5">
          {isActive && (
            <span className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: col, animation: live ? 'blink 1.5s infinite' : 'none' }} />
          )}
          <span className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>
            {match.homeFlag} {match.homeTeam}
            {match.homeScore !== null && ` ${match.homeScore}`}
            {' – '}
            {match.awayScore !== null && `${match.awayScore} `}
            {match.awayFlag} {match.awayTeam}
          </span>
        </div>
        <div className="mono text-[9px]" style={{ color: 'var(--text3)' }}>
          {match.stage.replace(/_/g, ' ')}
          {match.minute ? ` · ${match.minute}'` : ''}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0 ml-3">
        <span className="mono text-[9px] px-1.5 py-0.5 rounded"
          style={{ background: `${col}18`, color: col }}>
          {lbl}
        </span>
        {!live && match.phase !== 'FINISHED' && match.phase !== 'FT' && (
          <span className="mono text-[9px]" style={{ color: 'var(--text3)' }}>
            {kickoffCountdown(match.kickoffTs)}
          </span>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────────────────────────────────────

function OverviewTab({
  signal,
  volume,
}: {
  signal: WorldCupSignal | null
  volume: VolumeSnapshot | null
}) {
  const hookPhase = signal?.hookPhase ?? 'PRE_MATCH'
  const feeBips   = signal?.hookFeeBips ?? 500
  const feePct    = signal?.hookFeePct ?? '0.05%'
  const feeColor  = hookFeeColor(feeBips)

  return (
    <div className="flex flex-col gap-4">

      {/* Signal note banner */}
      {signal?.signalNote && (
        <div className="rounded-xl px-4 py-3 mono text-xs"
          style={{
            background: `${phaseColor(hookPhase)}0d`,
            border: `1px solid ${phaseColor(hookPhase)}30`,
            color: phaseColor(hookPhase),
          }}>
          {signal.signalNote}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="OKX Volume 24h"
          value={volume ? fmtUSD(volume.totalVolume24h) : '—'}
          color="var(--yellow)"
        />
        <StatCard
          label="Total Swaps"
          value={volume ? fmtNum(volume.totalSwaps) : '—'}
          color="var(--green)"
        />
        <StatCard
          label="Unique Traders"
          value={volume ? fmtNum(volume.uniqueTraders) : '—'}
        />
        <StatCard
          label="Hook Fee"
          value={feePct}
          color={feeColor}
        />
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Active match */}
        <Panel title="Active match">
          {signal?.match ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                  {signal.match.homeFlag} {signal.match.homeTeam}
                  {' '}
                  {signal.match.homeScore ?? '–'} – {signal.match.awayScore ?? '–'}
                  {' '}
                  {signal.match.awayFlag} {signal.match.awayTeam}
                </span>
                <span className="mono text-[9px] px-1.5 py-0.5 rounded"
                  style={{
                    background: `${phaseColor(signal.match.phase)}18`,
                    color: phaseColor(signal.match.phase),
                  }}>
                  {phaseLabel(signal.match.phase)}
                  {signal.match.minute ? ` ${signal.match.minute}'` : ''}
                </span>
              </div>
              <div className="mono text-[9px]" style={{ color: 'var(--text3)' }}>
                {signal.match.competition} · {signal.match.stage.replace(/_/g, ' ')}
              </div>
              {signal.match.lastGoal && (
                <div className="rounded-lg p-3"
                  style={{ background: 'rgba(246,70,93,0.07)', border: '1px solid rgba(246,70,93,0.2)' }}>
                  <div className="mono text-[10px]" style={{ color: 'var(--red)' }}>
                    ⚽ {signal.match.lastGoal.team} — {signal.match.lastGoal.scorerName} ({signal.match.lastGoal.minute}')
                  </div>
                </div>
              )}
            </div>
          ) : signal?.nextMatch ? (
            <div className="flex flex-col gap-2">
              <div className="mono text-[10px]" style={{ color: 'var(--text3)' }}>Next match</div>
              <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                {signal.nextMatch.homeFlag} {signal.nextMatch.homeTeam}
                {' vs '}
                {signal.nextMatch.awayFlag} {signal.nextMatch.awayTeam}
              </div>
              <div className="mono text-[10px]" style={{ color: 'var(--yellow)' }}>
                Kicks off in {kickoffCountdown(signal.nextMatch.kickoffTs)}
              </div>
            </div>
          ) : (
            <div className="mono text-xs" style={{ color: 'var(--text3)' }}>
              No matches today
            </div>
          )}
        </Panel>

        {/* Hook fee schedule */}
        <Panel title="Hook fee schedule">
          {(
            [
              { phase: 'PRE_MATCH',  label: 'Pre-match',       bips: 500,  dot: 'var(--text3)' },
              { phase: 'LIVE',       label: 'Match in progress', bips: 3000, dot: 'var(--yellow)' },
              { phase: 'GOAL',       label: 'Goal scored',      bips: 8000, dot: 'var(--red)'    },
              { phase: 'POST_MATCH', label: 'Post-match',       bips: 1000, dot: 'var(--text3)'  },
            ] as const
          ).map(row => {
            const active = hookPhase === row.phase
            return (
              <div key={row.phase}
                className="flex items-center justify-between py-2 border-b last:border-b-0"
                style={{
                  borderColor: 'var(--border)',
                  background:  active ? `${row.dot}08` : 'transparent',
                  margin:      active ? '0 -16px' : undefined,
                  padding:     active ? '8px 16px' : undefined,
                }}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      background: active ? row.dot : 'var(--bg4)',
                      animation: active && row.phase === 'GOAL' ? 'blink 1s infinite' : 'none',
                    }} />
                  <span className="text-xs" style={{ color: active ? 'var(--text)' : 'var(--text2)' }}>
                    {row.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="mono text-xs font-bold"
                    style={{ color: active ? hookFeeColor(row.bips) : 'var(--text3)' }}>
                    {(row.bips / 100).toFixed(2)}%
                  </span>
                  {active && (
                    <span className="mono text-[9px]" style={{ color: hookFeeColor(row.bips) }}>←</span>
                  )}
                </div>
              </div>
            )
          })}
        </Panel>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Volume by token */}
        <Panel title="Volume by country token">
          {volume?.byToken?.length ? (
            <div className="flex flex-col gap-3">
              {volume.byToken.slice(0, 5).map(t => (
                <div key={t.symbol} className="flex items-center gap-3">
                  <span className="text-base">{t.flag}</span>
                  <span className="mono text-[10px] w-8 shrink-0" style={{ color: 'var(--text2)' }}>
                    {t.symbol}
                  </span>
                  <div className="flex-1 h-0.5 rounded-full" style={{ background: 'var(--bg4)' }}>
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width:      `${t.pct}%`,
                        background: t.pct > 30 ? 'var(--green)' : t.pct > 15 ? 'var(--yellow)' : 'var(--text3)',
                      }} />
                  </div>
                  <span className="mono text-[10px] w-12 text-right shrink-0"
                    style={{ color: 'var(--text3)' }}>
                    {fmtUSD(t.volume24h)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mono text-xs" style={{ color: 'var(--text3)' }}>
              Awaiting swap data…
            </div>
          )}
        </Panel>

        {/* Hook activity */}
        <Panel title="Hook activity">
          {[
            { label: 'Swap velocity (1h)',  value: volume ? `${volume.swapVelocity1h > 0 ? '+' : ''}${volume.swapVelocity1h.toFixed(1)}%`, color: volume && volume.swapVelocity1h > 0 ? 'var(--green)' : 'var(--red)' },
            { label: 'Largest swap',        value: volume ? fmtUSD(volume.largestSwap)    : '—', color: 'var(--text)'   },
            { label: 'Fee revenue (24h)',   value: volume ? fmtUSD(volume.feeRevenue24h)  : '—', color: 'var(--yellow)' },
            { label: 'Volatility score',    value: signal ? `${signal.matchVolatilityScore}/100` : '—', color: signal && signal.matchVolatilityScore > 70 ? 'var(--red)' : 'var(--text)' },
            { label: 'Hook contract',       value: volume?.hookAddress ? `${volume.hookAddress.slice(0, 6)}…${volume.hookAddress.slice(-4)}` : 'Not deployed', color: '#3498db' },
          ].map(row => (
            <div key={row.label}
              className="flex items-center justify-between py-2 border-b last:border-b-0"
              style={{ borderColor: 'var(--border)' }}>
              <span className="text-xs" style={{ color: 'var(--text2)' }}>{row.label}</span>
              <span className="mono text-xs font-semibold" style={{ color: row.color }}>{row.value}</span>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  )
}

function MatchesTab({ matches, loading }: { matches: WorldCupMatch[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 mono text-xs"
        style={{ color: 'var(--text3)' }}>
        Loading matches…
      </div>
    )
  }

  const live     = matches.filter(m => ['LIVE', 'GOAL', 'HT'].includes(m.phase))
  const upcoming = matches.filter(m => ['SCHEDULED', 'TIMED', 'PRE_MATCH'].includes(m.phase))
  const finished = matches.filter(m => ['FINISHED', 'FT', 'AET', 'POST_MATCH'].includes(m.phase))

  return (
    <div className="flex flex-col gap-4">
      {live.length > 0 && (
        <Panel title={`Live now (${live.length})`}>
          {live.map(m => <MatchCard key={m.id} match={m} isActive />)}
        </Panel>
      )}
      {upcoming.length > 0 && (
        <Panel title={`Upcoming today (${upcoming.length})`}>
          {upcoming.map(m => <MatchCard key={m.id} match={m} isActive={false} />)}
        </Panel>
      )}
      {finished.length > 0 && (
        <Panel title={`Finished (${finished.length})`}>
          {finished.map(m => <MatchCard key={m.id} match={m} isActive={false} />)}
        </Panel>
      )}
      {matches.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 gap-2">
          <span style={{ fontSize: 32 }}>⚽</span>
          <span className="mono text-xs" style={{ color: 'var(--text3)' }}>No matches today</span>
        </div>
      )}
    </div>
  )
}

function VolumeTab({ volume, loading }: { volume: VolumeSnapshot | null; loading: boolean }) {
  if (loading || !volume) {
    return (
      <div className="flex items-center justify-center h-48 mono text-xs"
        style={{ color: 'var(--text3)' }}>
        Loading volume data…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Volume"   value={fmtUSD(volume.totalVolumeAll)} color="var(--yellow)" />
        <StatCard label="24h Volume"     value={fmtUSD(volume.totalVolume24h)} color="var(--yellow)" />
        <StatCard label="Total Swaps"    value={fmtNum(volume.totalSwaps)}     color="var(--green)"  />
        <StatCard label="Unique Traders" value={fmtNum(volume.uniqueTraders)}                        />
      </div>

      <Panel title="Volume by country token">
        <div className="flex flex-col gap-3">
          {volume.byToken.map((t, i) => (
            <div key={t.symbol} className="flex items-center gap-3">
              <span className="mono text-[10px] w-5 text-right shrink-0"
                style={{ color: 'var(--text3)' }}>#{i + 1}</span>
              <span className="text-base">{t.flag}</span>
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="mono text-[10px] font-bold" style={{ color: 'var(--text)' }}>
                    {t.symbol}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="mono text-[10px]" style={{ color: 'var(--text3)' }}>
                      {fmtNum(t.swapCount)} swaps
                    </span>
                    <span className="mono text-xs font-bold" style={{ color: 'var(--yellow)' }}>
                      {fmtUSD(t.volume24h)}
                    </span>
                  </div>
                </div>
                <div className="h-1 rounded-full" style={{ background: 'var(--bg4)' }}>
                  <div className="h-full rounded-full transition-all"
                    style={{
                      width: `${t.pct}%`,
                      background: i === 0
                        ? 'var(--green)'
                        : i === 1
                        ? 'var(--yellow)'
                        : 'var(--text3)',
                    }} />
                </div>
              </div>
              <span className="mono text-[10px] w-10 text-right shrink-0"
                style={{ color: 'var(--text3)' }}>
                {t.pct.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Panel title="Swap metrics">
          {[
            { label: 'Swap velocity (1h)',  value: `${volume.swapVelocity1h > 0 ? '+' : ''}${volume.swapVelocity1h.toFixed(1)}%`, color: volume.swapVelocity1h > 0 ? 'var(--green)' : 'var(--red)' },
            { label: 'Largest single swap', value: fmtUSD(volume.largestSwap),   color: 'var(--text)' },
            { label: 'Fee revenue (24h)',   value: fmtUSD(volume.feeRevenue24h),  color: 'var(--yellow)' },
          ].map(r => (
            <div key={r.label}
              className="flex items-center justify-between py-2.5 border-b last:border-b-0"
              style={{ borderColor: 'var(--border)' }}>
              <span className="text-xs" style={{ color: 'var(--text2)' }}>{r.label}</span>
              <span className="mono text-xs font-bold" style={{ color: r.color }}>{r.value}</span>
            </div>
          ))}
        </Panel>

        <Panel title="Hook contract">
          <div className="flex flex-col gap-3">
            <div className="rounded-lg p-3 break-all mono text-[10px]"
              style={{ background: 'var(--bg3)', color: '#3498db' }}>
              {volume.hookAddress}
            </div>
            <a href={`https://www.oklink.com/xlayer/address/${volume.hookAddress}`}
              target="_blank" rel="noreferrer"
              className="mono text-[10px] text-center py-2 rounded-lg transition-all hover:opacity-80"
              style={{ background: 'rgba(52,152,219,0.1)', color: '#3498db', border: '1px solid rgba(52,152,219,0.2)' }}>
              View on OKLink ↗
            </a>
          </div>
        </Panel>
      </div>
    </div>
  )
}

function OverviewTab({
  signal,
  volume,
}: {
  signal: WorldCupSignal | null
  volume: VolumeSnapshot | null
}) {
  const hookPhase = signal?.hookPhase ?? 'PRE_MATCH'
  const feeBips   = signal?.hookFeeBips ?? 500
  const feePct    = signal?.hookFeePct ?? '0.05%'
  const feeColor  = hookFeeColor(feeBips)

  return (
    <div className="flex flex-col gap-4">

      {/* Signal note banner */}
      {signal?.signalNote && (
        <div className="rounded-xl px-4 py-3 mono text-xs"
          style={{
            background: `${phaseColor(hookPhase)}0d`,
            border: `1px solid ${phaseColor(hookPhase)}30`,
            color: phaseColor(hookPhase),
          }}>
          {signal.signalNote}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="OKX Volume 24h"
          value={volume ? fmtUSD(volume.totalVolume24h) : '—'}
          color="var(--yellow)"
        />
        <StatCard
          label="Total Swaps"
          value={volume ? fmtNum(volume.totalSwaps) : '—'}
          color="var(--green)"
        />
        <StatCard
          label="Unique Traders"
          value={volume ? fmtNum(volume.uniqueTraders) : '—'}
        />
        <StatCard
          label="Hook Fee"
          value={feePct}
          color={feeColor}
        />
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Active match */}
        <Panel title="Active match">
          {signal?.match ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                  {signal.match.homeFlag} {signal.match.homeTeam}
                  {' '}
                  {signal.match.homeScore ?? '–'} – {signal.match.awayScore ?? '–'}
                  {' '}
                  {signal.match.awayFlag} {signal.match.awayTeam}
                </span>
                <span className="mono text-[9px] px-1.5 py-0.5 rounded"
                  style={{
                    background: `${phaseColor(signal.match.phase)}18`,
                    color: phaseColor(signal.match.phase),
                  }}>
                  {phaseLabel(signal.match.phase)}
                  {signal.match.minute ? ` ${signal.match.minute}'` : ''}
                </span>
              </div>
              <div className="mono text-[9px]" style={{ color: 'var(--text3)' }}>
                {signal.match.competition} · {signal.match.stage.replace(/_/g, ' ')}
              </div>
              {signal.match.lastGoal && (
                <div className="rounded-lg p-3"
                  style={{ background: 'rgba(246,70,93,0.07)', border: '1px solid rgba(246,70,93,0.2)' }}>
                  <div className="mono text-[10px]" style={{ color: 'var(--red)' }}>
                    ⚽ {signal.match.lastGoal.team} — {signal.match.lastGoal.scorerName} ({signal.match.lastGoal.minute}')
                  </div>
                </div>
              )}
            </div>
          ) : signal?.nextMatch ? (
            <div className="flex flex-col gap-2">
              <div className="mono text-[10px]" style={{ color: 'var(--text3)' }}>Next match</div>
              <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                {signal.nextMatch.homeFlag} {signal.nextMatch.homeTeam}
                {' vs '}
                {signal.nextMatch.awayFlag} {signal.nextMatch.awayTeam}
              </div>
              <div className="mono text-[10px]" style={{ color: 'var(--yellow)' }}>
                Kicks off in {kickoffCountdown(signal.nextMatch.kickoffTs)}
              </div>
            </div>
          ) : (
            <div className="mono text-xs" style={{ color: 'var(--text3)' }}>
              No matches today
            </div>
          )}
        </Panel>

        {/* Hook fee schedule */}
        <Panel title="Hook fee schedule">
          {(
            [
              { phase: 'PRE_MATCH',  label: 'Pre-match',       bips: 500,  dot: 'var(--text3)' },
              { phase: 'LIVE',       label: 'Match in progress', bips: 3000, dot: 'var(--yellow)' },
              { phase: 'GOAL',       label: 'Goal scored',      bips: 8000, dot: 'var(--red)'    },
              { phase: 'POST_MATCH', label: 'Post-match',       bips: 1000, dot: 'var(--text3)'  },
            ] as const
          ).map(row => {
            const active = hookPhase === row.phase
            return (
              <div key={row.phase}
                className="flex items-center justify-between py-2 border-b last:border-b-0"
                style={{
                  borderColor: 'var(--border)',
                  background:  active ? `${row.dot}08` : 'transparent',
                  margin:      active ? '0 -16px' : undefined,
                  padding:     active ? '8px 16px' : undefined,
                }}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      background: active ? row.dot : 'var(--bg4)',
                      animation: active && row.phase === 'GOAL' ? 'blink 1s infinite' : 'none',
                    }} />
                  <span className="text-xs" style={{ color: active ? 'var(--text)' : 'var(--text2)' }}>
                    {row.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="mono text-xs font-bold"
                    style={{ color: active ? hookFeeColor(row.bips) : 'var(--text3)' }}>
                    {(row.bips / 100).toFixed(2)}%
                  </span>
                  {active && (
                    <span className="mono text-[9px]" style={{ color: hookFeeColor(row.bips) }}>←</span>
                  )}
                </div>
              </div>
            )
          })}
        </Panel>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Volume by token */}
        <Panel title="Volume by country token">
          {volume?.byToken?.length ? (
            <div className="flex flex-col gap-3">
              {volume.byToken.slice(0, 5).map(t => (
                <div key={t.symbol} className="flex items-center gap-3">
                  <span className="text-base">{t.flag}</span>
                  <span className="mono text-[10px] w-8 shrink-0" style={{ color: 'var(--text2)' }}>
                    {t.symbol}
                  </span>
                  <div className="flex-1 h-0.5 rounded-full" style={{ background: 'var(--bg4)' }}>
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width:      `${t.pct}%`,
                        background: t.pct > 30 ? 'var(--green)' : t.pct > 15 ? 'var(--yellow)' : 'var(--text3)',
                      }} />
                  </div>
                  <span className="mono text-[10px] w-12 text-right shrink-0"
                    style={{ color: 'var(--text3)' }}>
                    {fmtUSD(t.volume24h)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mono text-xs" style={{ color: 'var(--text3)' }}>
              Awaiting swap data…
            </div>
          )}
        </Panel>

        {/* Hook activity */}
        <Panel title="Hook activity">
          {[
            { label: 'Swap velocity (1h)',  value: volume ? `${volume.swapVelocity1h > 0 ? '+' : ''}${volume.swapVelocity1h.toFixed(1)}%`, color: volume && volume.swapVelocity1h > 0 ? 'var(--green)' : 'var(--red)' },
            { label: 'Largest swap',        value: volume ? fmtUSD(volume.largestSwap)    : '—', color: 'var(--text)'   },
            { label: 'Fee revenue (24h)',   value: volume ? fmtUSD(volume.feeRevenue24h)  : '—', color: 'var(--yellow)' },
            { label: 'Volatility score',    value: signal ? `${signal.matchVolatilityScore}/100` : '—', color: signal && signal.matchVolatilityScore > 70 ? 'var(--red)' : 'var(--text)' },
            { label: 'Hook contract',       value: volume?.hookAddress ? `${volume.hookAddress.slice(0, 6)}…${volume.hookAddress.slice(-4)}` : 'Not deployed', color: '#3498db' },
          ].map(row => (
            <div key={row.label}
              className="flex items-center justify-between py-2 border-b last:border-b-0"
              style={{ borderColor: 'var(--border)' }}>
              <span className="text-xs" style={{ color: 'var(--text2)' }}>{row.label}</span>
              <span className="mono text-xs font-semibold" style={{ color: row.color }}>{row.value}</span>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  )
}

function MatchesTab({ matches, loading }: { matches: WorldCupMatch[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 mono text-xs"
        style={{ color: 'var(--text3)' }}>
        Loading matches…
      </div>
    )
  }

  const live     = matches.filter(m => ['LIVE', 'GOAL', 'HT'].includes(m.phase))
  const upcoming = matches.filter(m => ['SCHEDULED', 'TIMED', 'PRE_MATCH'].includes(m.phase))
  const finished = matches.filter(m => ['FINISHED', 'FT', 'AET', 'POST_MATCH'].includes(m.phase))

  return (
    <div className="flex flex-col gap-4">
      {live.length > 0 && (
        <Panel title={`Live now (${live.length})`}>
          {live.map(m => <MatchCard key={m.id} match={m} isActive />)}
        </Panel>
      )}
      {upcoming.length > 0 && (
        <Panel title={`Upcoming today (${upcoming.length})`}>
          {upcoming.map(m => <MatchCard key={m.id} match={m} isActive={false} />)}
        </Panel>
      )}
      {finished.length > 0 && (
        <Panel title={`Finished (${finished.length})`}>
          {finished.map(m => <MatchCard key={m.id} match={m} isActive={false} />)}
        </Panel>
      )}
      {matches.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 gap-2">
          <span style={{ fontSize: 32 }}>⚽</span>
          <span className="mono text-xs" style={{ color: 'var(--text3)' }}>No matches today</span>
        </div>
      )}
    </div>
  )
}

function VolumeTab({ volume, loading }: { volume: VolumeSnapshot | null; loading: boolean }) {
  if (loading || !volume) {
    return (
      <div className="flex items-center justify-center h-48 mono text-xs"
        style={{ color: 'var(--text3)' }}>
        Loading volume data…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Volume"   value={fmtUSD(volume.totalVolumeAll)} color="var(--yellow)" />
        <StatCard label="24h Volume"     value={fmtUSD(volume.totalVolume24h)} color="var(--yellow)" />
        <StatCard label="Total Swaps"    value={fmtNum(volume.totalSwaps)}     color="var(--green)"  />
        <StatCard label="Unique Traders" value={fmtNum(volume.uniqueTraders)}                        />
      </div>

      <Panel title="Volume by country token">
        <div className="flex flex-col gap-3">
          {volume.byToken.map((t, i) => (
            <div key={t.symbol} className="flex items-center gap-3">
              <span className="mono text-[10px] w-5 text-right shrink-0"
                style={{ color: 'var(--text3)' }}>#{i + 1}</span>
              <span className="text-base">{t.flag}</span>
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="mono text-[10px] font-bold" style={{ color: 'var(--text)' }}>
                    {t.symbol}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="mono text-[10px]" style={{ color: 'var(--text3)' }}>
                      {fmtNum(t.swapCount)} swaps
                    </span>
                    <span className="mono text-xs font-bold" style={{ color: 'var(--yellow)' }}>
                      {fmtUSD(t.volume24h)}
                    </span>
                  </div>
                </div>
                <div className="h-1 rounded-full" style={{ background: 'var(--bg4)' }}>
                  <div className="h-full rounded-full transition-all"
                    style={{
                      width: `${t.pct}%`,
                      background: i === 0
                        ? 'var(--green)'
                        : i === 1
                        ? 'var(--yellow)'
                        : 'var(--text3)',
                    }} />
                </div>
              </div>
              <span className="mono text-[10px] w-10 text-right shrink-0"
                style={{ color: 'var(--text3)' }}>
                {t.pct.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Panel title="Swap metrics">
          {[
            { label: 'Swap velocity (1h)',  value: `${volume.swapVelocity1h > 0 ? '+' : ''}${volume.swapVelocity1h.toFixed(1)}%`, color: volume.swapVelocity1h > 0 ? 'var(--green)' : 'var(--red)' },
            { label: 'Largest single swap', value: fmtUSD(volume.largestSwap),   color: 'var(--text)' },
            { label: 'Fee revenue (24h)',   value: fmtUSD(volume.feeRevenue24h),  color: 'var(--yellow)' },
          ].map(r => (
            <div key={r.label}
              className="flex items-center justify-between py-2.5 border-b last:border-b-0"
              style={{ borderColor: 'var(--border)' }}>
              <span className="text-xs" style={{ color: 'var(--text2)' }}>{r.label}</span>
              <span className="mono text-xs font-bold" style={{ color: r.color }}>{r.value}</span>
            </div>
          ))}
        </Panel>

        <Panel title="Hook contract">
          <div className="flex flex-col gap-3">
            <div className="rounded-lg p-3 break-all mono text-[10px]"
              style={{ background: 'var(--bg3)', color: '#3498db' }}>
              {volume.hookAddress}
            </div>
            <a href={`https://www.oklink.com/xlayer/address/${volume.hookAddress}`}
              target="_blank" rel="noreferrer"
              className="mono text-[10px] text-center py-2 rounded-lg transition-all hover:opacity-80"
              style={{ background: 'rgba(52,152,219,0.1)', color: '#3498db', border: '1px solid rgba(52,152,219,0.2)' }}>
              View on OKLink ↗
            </a>
          </div>
        </Panel>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function WorldCupTab() {
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  // Data state
  const [signal,         setSignal]        = useState<WorldCupSignal | null>(null)
  const [matches,        setMatches]       = useState<WorldCupMatch[]>([])
  const [volume,         setVolume]        = useState<VolumeSnapshot | null>(null)
  const [signalLoading,  setSignalLoading] = useState(true)
  const [matchesLoading, setMatchLoading]  = useState(false)
  const [volumeLoading,  setVolumeLoading] = useState(false)
  const [lastRefresh,    setLastRefresh]   = useState<number | null>(null)
  const [isMock,         setIsMock]        = useState(false)

  // ── Fetch signal ──────────────────────────────────────────────────────────
  const fetchSignal = useCallback(async () => {
    try {
      const res  = await fetch('/api/worldcup')
      setIsMock(res.headers.get('X-Mock') === 'true')
      const data = await res.json()
      setSignal(data)
      setLastRefresh(Date.now())
    } catch (err) {
      console.error('[WorldCupTab] signal fetch error', err)
    } finally {
      setSignalLoading(false)
    }
  }, [])

  // ── Fetch matches (lazy — only when tab active) ───────────────────────────
  const fetchMatches = useCallback(async () => {
    setMatchLoading(true)
    try {
      const res  = await fetch('/api/worldcup?matches=true')
      const data = await res.json()
      setMatches(data.matches ?? [])
    } catch (err) {
      console.error('[WorldCupTab] matches fetch error', err)
    } finally {
      setMatchLoading(false)
    }
  }, [])

  // ── Fetch volume (lazy) ───────────────────────────────────────────────────
  const fetchVolume = useCallback(async () => {
    setVolumeLoading(true)
    try {
      const res  = await fetch('/api/xlayer/volume')
      const data = await res.json()
      setVolume(data)
    } catch (err) {
      console.error('[WorldCupTab] volume fetch error', err)
    } finally {
      setVolumeLoading(false)
    }
  }, [])

  // On mount: fetch signal + volume (both needed for overview)
  useEffect(() => {
    fetchSignal()
    fetchVolume()
  }, [fetchSignal, fetchVolume])

  // Auto-refresh signal every 60s
  useEffect(() => {
    const id = setInterval(fetchSignal, 60_000)
    return () => clearInterval(id)
  }, [fetchSignal])

  // Fetch matches when tab switches to 'matches'
  useEffect(() => {
    if (activeTab === 'matches' && matches.length === 0) {
      fetchMatches()
    }
  }, [activeTab, matches.length, fetchMatches])

  // ── Hook phase badge ──────────────────────────────────────────────────────
  const hookPhase = signal?.hookPhase ?? 'PRE_MATCH'
  const phaseCol  = phaseColor(hookPhase)
  const live      = hookPhase === 'LIVE' || hookPhase === 'GOAL'

  const TABS: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview'       },
    { id: 'matches',  label: 'Match Signals'  },
    { id: 'volume',   label: 'Volume'         },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-5 pt-5 pb-0 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-base font-extrabold" style={{ color: 'var(--text)' }}>
              World Cup Hook
            </h2>
            <span className="mono text-[9px] px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(52,152,219,0.1)', color: '#3498db', border: '1px solid rgba(52,152,219,0.2)' }}>
              X LAYER
            </span>
            <span className="mono text-[9px] px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(240,185,11,0.08)', color: 'var(--yellow)', border: '1px solid rgba(240,185,11,0.2)' }}>
              UNISWAP V4
            </span>
          </div>
          <div className="mono text-[10px]" style={{ color: 'var(--text3)' }}>
            OKX Wallet swap volume · dynamic fee hook · X Layer mainnet
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isMock && (
            <span className="mono text-[9px] px-1.5 py-0.5 rounded"
              style={{ background: 'var(--bg3)', color: 'var(--text3)', border: '1px solid var(--border)' }}>
              MOCK
            </span>
          )}
          <div className="flex items-center gap-1.5 mono text-[9px] px-2 py-1 rounded-lg"
            style={{ background: `${phaseCol}10`, border: `1px solid ${phaseCol}30`, color: phaseCol }}>
            <span className="w-1.5 h-1.5 rounded-full"
              style={{ background: phaseCol, animation: live ? 'blink 1.5s infinite' : 'none' }} />
            {signalLoading ? 'LOADING' : hookPhase.replace('_', ' ')}
          </div>
          <button
            onClick={() => { fetchSignal(); fetchVolume() }}
            className="mono text-[9px] px-2 py-1 rounded-lg transition-all hover:opacity-80"
            style={{ background: 'var(--bg3)', color: 'var(--text3)', border: '1px solid var(--border)' }}>
            ↻ {lastRefresh ? timeAgo(lastRefresh) : '—'}
          </button>
        </div>
      </div>

      {/* ── Tab bar ────────────────────────────────────────────────────────── */}
      <div className="flex gap-0 border-b mt-4 px-5 shrink-0"
        style={{ borderColor: 'var(--border)' }}>
        {TABS.map(t => (
          <button key={t.id}
            onClick={() => setActiveTab(t.id)}
            className="mono text-[11px] pb-2.5 pt-1 px-4 border-b-2 transition-all"
            style={{
              borderColor: activeTab === t.id ? 'var(--yellow)' : 'transparent',
              color:       activeTab === t.id ? 'var(--yellow)' : 'var(--text3)',
              background:  'none',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-5">
        {signalLoading ? (
          <div className="flex items-center justify-center h-48 mono text-xs"
            style={{ color: 'var(--text3)' }}>
            Loading…
          </div>
        ) : activeTab === 'overview' ? (
          <OverviewTab signal={signal} volume={volume} />
        ) : activeTab === 'matches' ? (
          <MatchesTab matches={matches} loading={matchesLoading} />
        ) : activeTab === 'volume' ? (
          <VolumeTab volume={volume} loading={volumeLoading} />
        )}
      </div>

    </div>
  )
}
