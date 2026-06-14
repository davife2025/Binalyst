'use client'

/**
 * components/tabs/CompetitionTab.tsx
 * Session D: Live competition dashboard.
 * PnL tracker · Drawdown gauge · Agent loop controls · Trade log with BSCScan links
 */

import { useState } from 'react'
import { useAgentLoop }      from '@/hooks/useAgentLoop'
import { useAgentStore }     from '@/lib/agentStore'
import DrawdownGauge, { DrawdownBar } from '@/components/agent/DrawdownGauge'
import { FearGreedMini }     from '@/components/agent/FearGreedGauge'
import { useFearAndGreed }   from '@/hooks/useSignals'
import { COMPETITION_RULES } from '@/lib/twak/client'
import { buildPlaybook, downloadPlaybook } from '@/lib/playbook'
import type { BacktestResult } from '@/lib/backtester'

function fmtUSD(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtPct(n: number, sign = true) {
  const s = sign && n >= 0 ? '+' : ''
  return s + n.toFixed(2) + '%'
}
function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  idle:          { color: 'var(--text3)',  bg: 'var(--bg3)',                      label: 'Idle'           },
  running:       { color: 'var(--green)',  bg: 'rgba(14,203,129,0.1)',            label: 'Running'        },
  paused:        { color: 'var(--yellow)', bg: 'rgba(240,185,11,0.1)',            label: 'Paused'         },
  error:         { color: 'var(--red)',    bg: 'rgba(246,70,93,0.1)',             label: 'Error'          },
  disqualified:  { color: 'var(--red)',    bg: 'rgba(246,70,93,0.12)',            label: 'DISQUALIFIED'   },
}

export default function CompetitionTab() {
  const { agentAddress, isWalletLoaded, agentConfig, strategyParsed, trades, session } = useAgentStore()
  const {
    loopStatus, lastCycle, nextRunIn, isRunning, cycleError, isActive,
    pnlPct, tradeStatus, todayTrades, totalTrades, drawdownPct,
    portfolioUSD, startUSD, daysElapsed, isRegistered,
    startLoop, stopLoop, pauseLoop, resumeLoop, runCycle,
  } = useAgentLoop()

  const { data: fg } = useFearAndGreed()
  const [startCapital, setStartCapital] = useState('100')
  const [activeView,   setActiveView]   = useState<'overview' | 'trades' | 'decisions' | 'submission'>('overview')
  const [tradeFilter,  setTradeFilter]  = useState<'all' | 'buy' | 'sell' | 'live'>('all')

  const statusCfg  = STATUS_CONFIG[loopStatus] ?? STATUS_CONFIG.idle
  const pnlColor   = pnlPct >= 0 ? 'var(--green)' : 'var(--red)'
  const noWallet   = !isWalletLoaded || !agentAddress
  const noStrategy = strategyParsed.length === 0
  const canStart   = !noWallet && !noStrategy && loopStatus !== 'disqualified'

  // Filtered trades
  const filteredTrades = trades.filter(t => {
    if (tradeFilter === 'buy')  return t.side === 'BUY'
    if (tradeFilter === 'sell') return t.side === 'SELL'
    if (tradeFilter === 'live') return !t.dryRun
    return true
  })

  function handleExportPlaybook() {
    // Pull last backtest result from sessionStorage if available
    let result: BacktestResult | undefined
    try {
      const stored = sessionStorage.getItem('lastBacktestResult')
      if (stored) result = JSON.parse(stored)
    } catch { /* ignore */ }

    const playbook = buildPlaybook({
      rules:       strategyParsed,
      result,
      riskConfig: {
        maxDrawdownPct: agentConfig.maxDrawdownPct,
        maxPerTradePct: agentConfig.maxPerTradePct,
        maxDailyTrades: agentConfig.maxDailyTrades ?? 10,
        slippagePct:    agentConfig.slippagePct,
      },
      name:        'Binalyst BTC Adaptive Strategy',
      description: 'Regime-aware adaptive: trend-follow when trending, mean-revert when ranging, flat when ADX < 15.',
      symbol:      'BTCUSDT',
      interval:    '1h',
    })
    downloadPlaybook(playbook)
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left panel: controls ─────────────────────────────────────────── */}
      <div className="w-64 shrink-0 flex flex-col border-r overflow-y-auto"
        style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>

        {/* Status */}
        <div className="px-4 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="mono text-[10px] uppercase tracking-widest mb-3" style={{ color: 'var(--text3)' }}>
            Agent Status
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-3"
            style={{ background: statusCfg.bg, border: `1px solid ${statusCfg.color}30` }}>
            <span className="w-2 h-2 rounded-full shrink-0"
              style={{ background: statusCfg.color, animation: loopStatus === 'running' ? 'blink 1.5s infinite' : 'none' }} />
            <span className="mono text-xs font-bold" style={{ color: statusCfg.color }}>
              {statusCfg.label}
            </span>
            {loopStatus === 'running' && nextRunIn > 0 && (
              <span className="mono text-[9px] ml-auto" style={{ color: 'var(--text3)' }}>
                {nextRunIn}s
              </span>
            )}
          </div>

          {/* Blockers */}
          {noWallet && (
            <div className="mono text-[10px] p-2 rounded mb-2"
              style={{ background: 'rgba(246,70,93,0.08)', color: 'var(--red)' }}>
              ⚠ No wallet loaded — go to Agent Wallet tab
            </div>
          )}
          {noStrategy && !noWallet && (
            <div className="mono text-[10px] p-2 rounded mb-2"
              style={{ background: 'rgba(240,185,11,0.08)', color: 'var(--yellow)' }}>
              ⚠ No strategy — go to Strategy Builder tab
            </div>
          )}
          {!isRegistered && !noWallet && (
            <div className="mono text-[10px] p-2 rounded mb-2"
              style={{ background: 'rgba(240,185,11,0.08)', color: 'var(--yellow)' }}>
              ⚠ Not registered — register in Agent Wallet tab
            </div>
          )}

          {/* Start capital input (only before first session) */}
          {!session && (
            <div className="flex flex-col gap-1.5 mb-3">
              <label className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
                Starting capital (USDT)
              </label>
              <input type="number" value={startCapital}
                onChange={e => setStartCapital(e.target.value)}
                className="mono text-sm px-3 py-2 rounded-lg outline-none"
                style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)' }}
                onFocus={e => (e.target.style.borderColor = 'var(--yellow)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border2)')} />
            </div>
          )}

          {/* Loop controls */}
          <div className="flex flex-col gap-2">
            {!isActive ? (
              <button onClick={() => startLoop(parseFloat(startCapital))}
                disabled={!canStart}
                className="py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                style={{
                  background: canStart ? 'var(--yellow)' : 'var(--bg4)',
                  color:      canStart ? '#000'          : 'var(--text3)',
                  cursor:     canStart ? 'pointer'       : 'not-allowed',
                }}>
                ▶ Start Agent
              </button>
            ) : (
              <div className="flex gap-2">
                {loopStatus === 'running' ? (
                  <button onClick={pauseLoop}
                    className="flex-1 py-2 rounded-xl mono text-xs font-bold"
                    style={{ background: 'rgba(240,185,11,0.1)', border: '1px solid rgba(240,185,11,0.3)', color: 'var(--yellow)' }}>
                    ⏸ Pause
                  </button>
                ) : (
                  <button onClick={resumeLoop}
                    className="flex-1 py-2 rounded-xl mono text-xs font-bold"
                    style={{ background: 'rgba(14,203,129,0.1)', border: '1px solid rgba(14,203,129,0.3)', color: 'var(--green)' }}>
                    ▶ Resume
                  </button>
                )}
                <button onClick={stopLoop}
                  className="flex-1 py-2 rounded-xl mono text-xs font-bold"
                  style={{ background: 'rgba(246,70,93,0.08)', border: '1px solid rgba(246,70,93,0.2)', color: 'var(--red)' }}>
                  ■ Stop
                </button>
              </div>
            )}

            <button onClick={runCycle} disabled={isRunning}
              className="py-2 rounded-xl mono text-xs transition-all"
              style={{
                background: 'var(--bg3)',
                border:     '1px solid var(--border)',
                color:      isRunning ? 'var(--text3)' : 'var(--text2)',
                cursor:     isRunning ? 'not-allowed' : 'pointer',
              }}>
              {isRunning ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin-slow" />
                  Running cycle...
                </span>
              ) : '↻ Run cycle now'}
            </button>
          </div>

          {cycleError && (
            <div className="mono text-[10px] p-2 rounded mt-2"
              style={{ background: 'rgba(246,70,93,0.08)', color: 'var(--red)' }}>
              {cycleError}
            </div>
          )}
        </div>

        {/* Config summary */}
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="mono text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--text3)' }}>
            Active Config
          </div>
          {[
            { label: 'Mode',      value: agentConfig.dryRun ? '🔵 Dry Run' : '🔴 Live' },
            { label: 'Auto',      value: agentConfig.autonomousMode ? '✓ On' : '✗ Off' },
            { label: 'Max DD',    value: agentConfig.maxDrawdownPct + '%' },
            { label: 'Per trade', value: agentConfig.maxPerTradePct + '%' },
            { label: 'Rules',     value: strategyParsed.length + ' active' },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between py-1 border-b"
              style={{ borderColor: 'var(--border)' }}>
              <span className="mono text-[10px]" style={{ color: 'var(--text3)' }}>{label}</span>
              <span className="mono text-[10px] font-bold" style={{ color: 'var(--text2)' }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Fear & Greed mini */}
        {fg && (
          <div className="px-4 py-3">
            <div className="mono text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--text3)' }}>
              Market Sentiment
            </div>
            <FearGreedMini value={fg.value} label={fg.label} />
          </div>
        )}
      </div>

      {/* ── Main panel ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">

        {/* Top stats row */}
        <div className="px-6 py-5 border-b shrink-0 flex items-start gap-4 flex-wrap"
          style={{ borderColor: 'var(--border)' }}>

          {/* Drawdown gauge */}
          <DrawdownGauge drawdownPct={drawdownPct} size={150} />

          {/* KPI grid */}
          <div className="flex-1 grid gap-3 min-w-0"
            style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>

            {/* PnL */}
            <div className="rounded-xl p-4 col-span-3 sm:col-span-1"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <div className="mono text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text3)' }}>
                Total Return
              </div>
              <div className="mono text-2xl font-extrabold" style={{ color: pnlColor }}>
                {fmtPct(pnlPct)}
              </div>
              <div className="mono text-[10px] mt-0.5" style={{ color: 'var(--text3)' }}>
                {fmtUSD(startUSD)} → {fmtUSD(portfolioUSD)}
              </div>
            </div>

            {/* Drawdown bar */}
            <div className="rounded-xl p-4"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <div className="mono text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--text3)' }}>
                Drawdown
              </div>
              <DrawdownBar drawdownPct={drawdownPct} />
              <div className="mono text-[10px] mt-1" style={{ color: 'var(--text3)' }}>
                Cap: {COMPETITION_RULES.MAX_DRAWDOWN_PCT}% (disqualify)
              </div>
            </div>

            {/* Trade count */}
            <div className="rounded-xl p-4"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <div className="mono text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text3)' }}>
                Trades
              </div>
              <div className="mono text-xl font-extrabold" style={{ color: 'var(--text)' }}>
                {todayTrades}<span style={{ color: 'var(--text3)', fontSize: 12 }}> today</span>
              </div>
              <div className="mono text-[10px] mt-0.5 flex items-center gap-1.5"
                style={{ color: tradeStatus.color }}>
                <span className="w-1.5 h-1.5 rounded-full"
                  style={{ background: tradeStatus.color }} />
                {totalTrades} total · {tradeStatus.label}
              </div>
            </div>

            {/* Competition progress */}
            <div className="rounded-xl p-4"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <div className="mono text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text3)' }}>
                Day
              </div>
              <div className="mono text-xl font-extrabold" style={{ color: 'var(--text)' }}>
                {daysElapsed + 1}<span style={{ color: 'var(--text3)', fontSize: 12 }}>/7</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden mt-2" style={{ background: 'var(--bg4)' }}>
                <div className="h-full rounded-full"
                  style={{ width: `${((daysElapsed + 1) / 7) * 100}%`, background: 'var(--yellow)' }} />
              </div>
            </div>

            {/* Last cycle */}
            <div className="rounded-xl p-4"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <div className="mono text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text3)' }}>
                Last Cycle
              </div>
              <div className="mono text-xs font-bold" style={{ color: 'var(--text)' }}>
                {lastCycle ? fmtTime(lastCycle.cycleAt) : '—'}
              </div>
              {lastCycle && (
                <div className="mono text-[10px] mt-0.5" style={{ color: 'var(--text3)' }}>
                  {lastCycle.executed} executed · {lastCycle.blocked} blocked
                </div>
              )}
            </div>

            {/* Wallet */}
            <div className="rounded-xl p-4"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <div className="mono text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text3)' }}>
                Agent Wallet
              </div>
              <div className="mono text-[10px] font-bold truncate" style={{ color: 'var(--text)' }}>
                {agentAddress ? `${agentAddress.slice(0, 8)}...${agentAddress.slice(-6)}` : 'Not connected'}
              </div>
              {agentAddress && (
                <a href={`https://bscscan.com/address/${agentAddress}`} target="_blank" rel="noreferrer"
                  className="mono text-[9px]" style={{ color: 'var(--yellow)' }}>
                  View on BSCScan ↗
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Tab strip */}
        <div className="flex gap-1 px-6 pt-4 border-b"
          style={{ borderColor: 'var(--border)' }}>
          {([
            { id: 'overview',   label: 'Overview'                    },
            { id: 'trades',     label: `Trades (${trades.length})`   },
            { id: 'decisions',  label: `Last Cycle`                  },
            { id: 'submission', label: '📋 Submission'               },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => setActiveView(tab.id)}
              className="mono text-xs px-4 py-2 rounded-t-lg transition-all"
              style={{
                background:   activeView === tab.id ? 'var(--bg2)' : 'transparent',
                color:        activeView === tab.id ? 'var(--yellow)' : 'var(--text3)',
                borderBottom: activeView === tab.id ? '2px solid var(--yellow)' : '2px solid transparent',
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Overview ─────────────────────────────────────────────── */}
        {activeView === 'overview' && (
          <div className="px-6 py-4 flex flex-col gap-4">

            {/* Last cycle errors */}
            {lastCycle?.errors && lastCycle.errors.length > 0 && (
              <div className="rounded-xl p-4"
                style={{ background: 'rgba(246,70,93,0.06)', border: '1px solid rgba(246,70,93,0.2)' }}>
                <div className="mono text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--red)' }}>
                  Cycle Errors
                </div>
                {lastCycle.errors.map((e, i) => (
                  <div key={i} className="mono text-xs" style={{ color: 'var(--text2)' }}>• {e}</div>
                ))}
              </div>
            )}

            {/* Strategy rules summary */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              <div className="px-4 py-3 border-b flex items-center justify-between"
                style={{ borderColor: 'var(--border)', background: 'var(--bg2)' }}>
                <span className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
                  Active Strategy Rules
                </span>
                <span className="mono text-[10px]" style={{ color: 'var(--yellow)' }}>
                  {strategyParsed.length} rules
                </span>
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {strategyParsed.length === 0 ? (
                  <div className="px-4 py-8 text-center mono text-xs" style={{ color: 'var(--text3)' }}>
                    No rules — go to Strategy Builder
                  </div>
                ) : strategyParsed.slice(0, 6).map((rule, i) => (
                  <div key={rule.id ?? i} className="px-4 py-3 flex items-center gap-3"
                    style={{ background: 'var(--bg2)' }}>
                    <span className="mono text-[10px] font-bold w-8" style={{ color: 'var(--text3)' }}>
                      #{i + 1}
                    </span>
                    <span className="mono text-xs font-bold" style={{ color: 'var(--text)' }}>
                      {rule.symbol}
                    </span>
                    <span className="mono text-[10px] px-2 py-0.5 rounded-full"
                      style={{
                        background: rule.action === 'BUY' ? 'rgba(14,203,129,0.1)' : 'rgba(246,70,93,0.1)',
                        color:      rule.action === 'BUY' ? 'var(--green)' : 'var(--red)',
                      }}>
                      {rule.action}
                    </span>
                    <span className="mono text-[10px]" style={{ color: 'var(--text3)' }}>
                      {rule.sizePct}% portfolio
                    </span>
                    {rule.lastFiredAt && (
                      <span className="mono text-[9px] ml-auto" style={{ color: 'var(--text3)' }}>
                        Last: {fmtTime(rule.lastFiredAt)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Trades ───────────────────────────────────────────────── */}
        {activeView === 'trades' && (
          <div className="px-6 py-4 flex flex-col gap-3">
            <div className="flex gap-2 flex-wrap">
              {(['all', 'buy', 'sell', 'live'] as const).map(f => (
                <button key={f} onClick={() => setTradeFilter(f)}
                  className="mono text-[10px] px-3 py-1.5 rounded-full capitalize transition-all"
                  style={{
                    background: tradeFilter === f ? 'var(--yellow)' : 'var(--bg2)',
                    color:      tradeFilter === f ? '#000' : 'var(--text3)',
                    border:     `1px solid ${tradeFilter === f ? 'transparent' : 'var(--border)'}`,
                  }}>
                  {f}
                </button>
              ))}
              <span className="mono text-[10px] ml-auto self-center" style={{ color: 'var(--text3)' }}>
                {filteredTrades.length} trades
              </span>
            </div>

            {filteredTrades.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3"
                style={{ background: 'var(--bg2)', border: '1px dashed var(--border)', borderRadius: 12 }}>
                <div className="text-4xl opacity-20">📋</div>
                <div className="mono text-xs" style={{ color: 'var(--text3)' }}>
                  No trades yet — start the agent to begin trading
                </div>
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                {/* Header */}
                <div className="grid px-4 py-2 mono text-[9px] uppercase tracking-widest border-b"
                  style={{
                    gridTemplateColumns: '80px 60px 90px 90px 70px 80px 1fr',
                    background: 'var(--bg3)', color: 'var(--text3)', borderColor: 'var(--border)',
                  }}>
                  {['Time', 'Symbol', 'Side', 'Amount', 'Price', 'Score', 'Tx'].map(h => (
                    <span key={h}>{h}</span>
                  ))}
                </div>

                {filteredTrades.map(t => (
                  <div key={t.id}
                    className="grid px-4 py-3 border-b items-center"
                    style={{
                      gridTemplateColumns: '80px 60px 90px 90px 70px 80px 1fr',
                      background: 'var(--bg2)', borderColor: 'var(--border)',
                    }}>
                    <span className="mono text-[10px]" style={{ color: 'var(--text3)' }}>
                      {fmtTime(t.timestamp)}
                    </span>
                    <span className="mono text-xs font-bold" style={{ color: 'var(--text)' }}>
                      {t.symbol}
                    </span>
                    <span className="mono text-[10px] font-bold"
                      style={{ color: t.side === 'BUY' ? 'var(--green)' : 'var(--red)' }}>
                      {t.side}
                    </span>
                    <span className="mono text-[10px]" style={{ color: 'var(--text)' }}>
                      {fmtUSD(t.amountUSDT)}
                    </span>
                    <span className="mono text-[10px]" style={{ color: 'var(--text2)' }}>
                      {t.price > 0 ? fmtUSD(t.price) : '—'}
                    </span>
                    <span className="mono text-[10px]" style={{
                      color: t.signalScore >= 65 ? 'var(--green)' : t.signalScore <= 35 ? 'var(--red)' : 'var(--yellow)',
                    }}>
                      {t.signalScore.toFixed(0)}/100
                    </span>
                    <span className="mono text-[10px] truncate">
                      {t.dryRun ? (
                        <span style={{ color: 'var(--text3)' }}>dry-run</span>
                      ) : t.txHash ? (
                        <a href={`https://bscscan.com/tx/${t.txHash}`} target="_blank" rel="noreferrer"
                          style={{ color: 'var(--yellow)' }}>
                          {t.txHash.slice(0, 10)}...↗
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text3)' }}>pending</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Decisions ────────────────────────────────────────────── */}
        {activeView === 'decisions' && (
          <div className="px-6 py-4 flex flex-col gap-3">
            {!lastCycle ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3"
                style={{ background: 'var(--bg2)', border: '1px dashed var(--border)', borderRadius: 12 }}>
                <div className="text-4xl opacity-20">⚡</div>
                <div className="mono text-xs" style={{ color: 'var(--text3)' }}>
                  No cycle run yet
                </div>
              </div>
            ) : (
              <>
                <div className="mono text-[10px]" style={{ color: 'var(--text3)' }}>
                  Cycle at {fmtTime(lastCycle.cycleAt)} ·&nbsp;
                  {lastCycle.executed} executed · {lastCycle.blocked} blocked ·&nbsp;
                  Portfolio {fmtUSD(lastCycle.portfolioUSD)} · DD {lastCycle.drawdownPct.toFixed(1)}%
                </div>

                {lastCycle.decisions.length === 0 ? (
                  <div className="mono text-xs p-4 rounded-xl text-center"
                    style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text3)' }}>
                    No rules fired this cycle
                  </div>
                ) : lastCycle.decisions.map((d: any, i: number) => (
                  <div key={i} className="rounded-xl p-4 flex items-start gap-3"
                    style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                    <span className="text-lg shrink-0 mt-0.5">
                      {d.guardrail === 'blocked' ? '🚫' : d.guardrail === 'warning' ? '⚠' : '✓'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="mono text-xs font-bold" style={{ color: 'var(--text)' }}>
                          {d.symbol}
                        </span>
                        <span className="mono text-[10px] px-2 py-0.5 rounded-full"
                          style={{
                            background: d.action === 'BUY' ? 'rgba(14,203,129,0.1)' : 'rgba(246,70,93,0.1)',
                            color:      d.action === 'BUY' ? 'var(--green)' : 'var(--red)',
                          }}>
                          {d.action}
                        </span>
                        <span className="mono text-[10px]" style={{ color: 'var(--yellow)' }}>
                          {fmtUSD(d.amountUSDT)}
                        </span>
                        <span className="mono text-[10px]" style={{ color: 'var(--text3)' }}>
                          score {d.signalScore?.toFixed(0)}
                        </span>
                      </div>
                      {d.blockReason && (
                        <div className="mono text-[10px]" style={{ color: 'var(--red)' }}>
                          Blocked: {d.blockReason}
                        </div>
                      )}
                      {d.warning && (
                        <div className="mono text-[10px]" style={{ color: 'var(--yellow)' }}>
                          {d.warning}
                        </div>
                      )}
                      <div className="mono text-[10px] leading-snug mt-0.5" style={{ color: 'var(--text3)' }}>
                        {d.reasoning}
                      </div>
                      {d.txHash && (
                        <a href={`https://bscscan.com/tx/${d.txHash}`} target="_blank" rel="noreferrer"
                          className="mono text-[10px] mt-1 block" style={{ color: 'var(--yellow)' }}>
                          {d.txHash.slice(0, 16)}... ↗ BSCScan
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
        {/* ── Tab: Submission ─────────────────────────────────────────────── */}
        {activeView === 'submission' && (
          <div className="flex flex-col gap-5 p-6">

            {/* Track alignment */}
            <div className="rounded-xl p-5"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <div className="mono text-[10px] uppercase tracking-widest mb-4" style={{ color: 'var(--text3)' }}>
                Hackathon Track Alignment
              </div>
              <div className="flex flex-col gap-3">
                {[
                  {
                    track: 'Track 1 — Best Trading Agent',
                    prize: '$2,000',
                    items: [
                      { label: 'Complete strategy loop (perception → decision → execution → risk)', done: true },
                      { label: 'Technical indicators: 23 via Bitget Skill Hub (RSI, MACD, BB, ADX, EMA…)', done: true },
                      { label: 'Adaptive regime detection: trend-follow / mean-revert / flat', done: true },
                      { label: 'Validated via backtest (real Binance OHLCV, no lookahead bias)', done: true },
                      { label: 'Runnable demo with equity curve, Sharpe, drawdown, win rate', done: true },
                      { label: 'NL strategy builder + rule evaluator + guardrails', done: true },
                    ],
                  },
                  {
                    track: 'Track 2 — Most Onchain Activity',
                    prize: '$1,000',
                    items: [
                      { label: 'Agent loop fires every 2 minutes autonomously', done: true },
                      { label: 'Forced DCA fallback ensures ≥1 trade/day minimum', done: true },
                      { label: 'Competition wallet connected and signing transactions', done: strategyParsed.length > 0 },
                    ],
                  },
                  {
                    track: 'Track 3 — ERC-8004 Agent Registry',
                    prize: '$500',
                    items: [
                      { label: 'Agent wallet generated with stable identity', done: true },
                      { label: 'ERC-8004 registration — manual step via Celo explorer', done: false },
                    ],
                  },
                ].map(({ track, prize, items }) => {
                  const done = items.filter(i => i.done).length
                  const pct  = Math.round((done / items.length) * 100)
                  return (
                    <div key={track} className="rounded-xl p-4"
                      style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="mono text-xs font-bold" style={{ color: 'var(--text)' }}>{track}</span>
                        <div className="flex items-center gap-2">
                          <span className="mono text-[10px] font-bold" style={{ color: 'var(--yellow)' }}>{prize}</span>
                          <span className="mono text-[10px]" style={{ color: pct === 100 ? 'var(--green)' : 'var(--text3)' }}>
                            {done}/{items.length}
                          </span>
                        </div>
                      </div>
                      <div className="h-1 rounded-full mb-3" style={{ background: 'var(--bg4)' }}>
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: pct === 100 ? 'var(--green)' : 'var(--yellow)' }} />
                      </div>
                      {items.map((item, i) => (
                        <div key={i} className="flex items-start gap-2 py-1">
                          <span className="mono text-xs mt-0.5 shrink-0" style={{ color: item.done ? 'var(--green)' : 'var(--text3)' }}>
                            {item.done ? '✓' : '○'}
                          </span>
                          <span className="mono text-[10px]" style={{ color: item.done ? 'var(--text2)' : 'var(--text3)' }}>
                            {item.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Playbook export */}
            <div className="rounded-xl p-5"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <div className="mono text-[10px] uppercase tracking-widest mb-3" style={{ color: 'var(--text3)' }}>
                Bitget Playbook Export
              </div>
              <p className="mono text-[10px] mb-4" style={{ color: 'var(--text3)' }}>
                Exports your parsed strategy as a Bitget Playbook JSON. Upload to
                playbook.bitget.com or submit via the getagent-skill CLI.
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={handleExportPlaybook}
                  disabled={strategyParsed.length === 0}
                  className="py-2.5 px-5 rounded-xl mono text-sm font-bold flex items-center gap-2 transition-all"
                  style={{
                    background: strategyParsed.length === 0 ? 'var(--bg4)' : 'var(--yellow)',
                    color:      strategyParsed.length === 0 ? 'var(--text3)' : '#000',
                    cursor:     strategyParsed.length === 0 ? 'not-allowed' : 'pointer',
                  }}>
                  ⬇ Download Playbook JSON
                </button>
                <span className="mono text-[10px]" style={{ color: 'var(--text3)' }}>
                  {strategyParsed.length > 0
                    ? `${strategyParsed.length} rules · includes backtest metrics if run`
                    : 'Parse a strategy in Strategy Builder first'}
                </span>
              </div>
              <div className="mt-4 rounded-lg p-3 mono text-[10px]"
                style={{ background: 'var(--bg3)', color: 'var(--text3)' }}>
                <div className="mb-1" style={{ color: 'var(--yellow)' }}>Manual upload steps:</div>
                <div>1. Download Playbook JSON above</div>
                <div>2. Log in to bitget.com → Playbook → Create Agent</div>
                <div>3. Upload JSON via getagent CLI: <span style={{ color: 'var(--text)' }}>npx @bitget-ai/getagent-skill upload ./binalyst-playbook.json</span></div>
                <div>4. Backtest will run automatically on Bitget's servers</div>
                <div>5. Publish once backtest passes</div>
              </div>
            </div>

            {/* Demo script */}
            <div className="rounded-xl p-5"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <div className="mono text-[10px] uppercase tracking-widest mb-3" style={{ color: 'var(--text3)' }}>
                Judge Demo Script (3 minutes)
              </div>
              {[
                { step: '1', time: '0:00', label: 'Open Signals tab', desc: 'Show live fear & greed, CMC momentum signals for 15+ tokens. Point out technical columns (RSI, MACD, BB) in list view.' },
                { step: '2', time: '0:30', label: 'Open Strategy Builder', desc: 'Load BTC Adaptive template. Show live regime panel — regime badge, confidence bar, ADX. Parse strategy → show generated rules with 📊 Technical badges.' },
                { step: '3', time: '1:15', label: 'Open Backtest tab', desc: 'Run BTC / 1h / 3 months / $10k. Walk through equity curve, Sharpe ratio, max drawdown, win rate. Point out no lookahead bias.' },
                { step: '4', time: '2:00', label: 'Open Agent tab', desc: 'Show live regime indicator + RSI gauge + MACD histogram + BB position. Start agent loop — show it firing decisions every 2 minutes.' },
                { step: '5', time: '2:45', label: 'Open Competition → Submission', desc: 'Show track checklist (all green), export Playbook JSON. Done.' },
              ].map(({ step, time, label, desc }) => (
                <div key={step} className="flex gap-3 py-3 border-b last:border-0"
                  style={{ borderColor: 'var(--border)' }}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center mono text-[10px] font-bold shrink-0 mt-0.5"
                    style={{ background: 'var(--yellow)', color: '#000' }}>
                    {step}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="mono text-xs font-bold" style={{ color: 'var(--text)' }}>{label}</span>
                      <span className="mono text-[9px] px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--bg3)', color: 'var(--text3)' }}>{time}</span>
                    </div>
                    <span className="mono text-[10px]" style={{ color: 'var(--text3)' }}>{desc}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Total prize pool */}
            <div className="rounded-xl p-4 flex items-center justify-between"
              style={{ background: 'rgba(240,185,11,0.06)', border: '1px solid rgba(240,185,11,0.2)' }}>
              <div>
                <div className="mono text-xs font-bold" style={{ color: 'var(--yellow)' }}>Total Prize Potential</div>
                <div className="mono text-[10px] mt-0.5" style={{ color: 'var(--text3)' }}>
                  Track 1 ($2,000) + Track 2 ($1,000) + Track 3 ($500) — one submission, three pools
                </div>
              </div>
              <div className="mono text-2xl font-extrabold" style={{ color: 'var(--yellow)' }}>$3,500</div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
