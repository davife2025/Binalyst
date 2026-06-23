'use client'

/**
 * components/tabs/CompetitionTab.tsx — Session J
 *
 * Key fixes:
 *
 * 1. autonomousMode toggle removed from UI.
 *    Previously two separate toggles (Dry Run + Auto Trade) confused users
 *    who enabled "Live Mode" but left "Auto Trade OFF", resulting in zero
 *    trade activity with no error. autonomousMode is now set automatically
 *    to match dryRun: enabling live mode sets both, disabling resets both.
 *
 * 2. Live readiness simplified to one toggle: dryRun.
 *    isLiveReady = !isDryRun && !isTestnet (network warning kept as soft gate).
 *
 * 3. Tab state from store (Bug 1 fix from Session I preserved).
 *
 * 4. Config drift warning removed (Session I fix preserved — hook reads live ref).
 */

import { useState } from 'react'
import { useAgentLoop }          from '@/hooks/useAgentLoop'
import { useAgentStore }         from '@/lib/agentStore'
import DrawdownGauge, { DrawdownBar } from '@/components/agent/DrawdownGauge'
import { FearGreedMini }         from '@/components/agent/FearGreedGauge'
import { useFearAndGreed }       from '@/hooks/useSignals'
import { COMPETITION_RULES }     from '@/lib/twak/client'
import { NETWORKS }              from '@/lib/twak/networks'

function fmtUSD(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtPct(n: number, sign = true) {
  return (sign && n >= 0 ? '+' : '') + n.toFixed(2) + '%'
}
function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  idle:         { color: 'var(--text3)',  bg: 'var(--bg3)',             label: 'Idle'         },
  running:      { color: 'var(--green)',  bg: 'rgba(14,203,129,0.1)',   label: 'Running'      },
  paused:       { color: 'var(--yellow)', bg: 'rgba(240,185,11,0.1)',   label: 'Paused'       },
  error:        { color: 'var(--red)',    bg: 'rgba(246,70,93,0.1)',    label: 'Error'        },
  disqualified: { color: 'var(--red)',    bg: 'rgba(246,70,93,0.12)',   label: 'DISQUALIFIED' },
}

export default function CompetitionTab() {
  const {
    agentAddress, isWalletLoaded, agentConfig, strategyParsed, trades, session,
    setAgentConfig,
    activeCompetitionTab: activeView,
    setActiveCompetitionTab: setActiveView,
  } = useAgentStore()

  const network = (useAgentStore() as any).network ?? 'testnet'
  const netCfg  = NETWORKS[network as 'mainnet' | 'testnet']

  const {
    loopStatus, lastCycle, nextRunIn, isRunning, cycleError, isActive,
    pnlPct, tradeStatus, todayTrades, totalTrades, drawdownPct,
    portfolioUSD, startUSD, daysElapsed, isRegistered,
    startLoop, stopLoop, pauseLoop, resumeLoop, runCycle,
  } = useAgentLoop()

  const { data: fg }                    = useFearAndGreed()
  const [startCapital, setStartCapital] = useState('100')
  const [tradeFilter, setTradeFilter]   = useState<'all' | 'buy' | 'sell' | 'live'>('all')

  const statusCfg = STATUS_CONFIG[loopStatus] ?? STATUS_CONFIG.idle
  const pnlColor  = pnlPct >= 0 ? 'var(--green)' : 'var(--red)'
  const noWallet   = !isWalletLoaded || !agentAddress
  const noStrategy = strategyParsed.length === 0

  const isDryRun   = agentConfig.dryRun
  const isTestnet  = network !== 'mainnet'
  // Live ready = not dry run + on mainnet
  const isLiveReady = !isDryRun && !isTestnet

  // Toggle live mode: sets BOTH dryRun and autonomousMode together.
  // This eliminates the "dryRun=false but autonomousMode=false → no trades" trap.
  function toggleLiveMode() {
    const goingLive = isDryRun  // currently dry, switching to live
    setAgentConfig({
      dryRun:         !isDryRun,
      autonomousMode: goingLive,   // true when going live, false when going dry
    })
  }

  const baseReady   = !noWallet && !noStrategy && loopStatus !== 'disqualified'
  const canStart    = baseReady
  const canRunCycle = !isRunning && !noWallet && !noStrategy

  const filteredTrades = trades.filter(t => {
    if (tradeFilter === 'buy')  return t.side === 'BUY'
    if (tradeFilter === 'sell') return t.side === 'SELL'
    if (tradeFilter === 'live') return !t.dryRun && t.txHash
    return true
  })
  const liveTrades = trades.filter(t => !t.dryRun && t.txHash)

  function getStartLabel() {
    if (!canStart)    return '▶ Start'
    if (isDryRun)     return '▶ Start (Dry Run)'
    if (isTestnet)    return '▶ Start (Testnet — no real funds)'
    return '▶ Start Agent (LIVE)'
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left controls ───────────────────────────────────────────────── */}
      <div className="w-64 shrink-0 flex flex-col border-r overflow-y-auto"
        style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>

        <div className="px-4 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="mono text-[10px] uppercase tracking-widest mb-3" style={{ color: 'var(--text3)' }}>
            Agent Status
          </div>

          {/* Status badge */}
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

          {/* Self-custody badge */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-3"
            style={{ background: 'rgba(14,203,129,0.06)', border: '1px solid rgba(14,203,129,0.2)' }}>
            <span style={{ fontSize: 14 }}>🔐</span>
            <div>
              <div className="mono text-[10px] font-bold" style={{ color: 'var(--green)' }}>Self-Custodial</div>
              <div className="mono text-[9px]" style={{ color: 'var(--text3)' }}>TWAK local signing · {network}</div>
            </div>
          </div>

          {/* ── Trade mode panel ─────────────────────────────────────────── */}
          <div className="rounded-lg p-3 mb-3 flex flex-col gap-2"
            style={{
              background: isLiveReady ? 'rgba(14,203,129,0.06)' : 'rgba(246,70,93,0.06)',
              border: `1px solid ${isLiveReady ? 'rgba(14,203,129,0.25)' : 'rgba(246,70,93,0.25)'}`,
            }}>

            <div className="mono text-[10px] font-bold"
              style={{ color: isLiveReady ? 'var(--green)' : isDryRun ? 'var(--text3)' : 'var(--yellow)' }}>
              {isLiveReady
                ? '✓ Live trading active'
                : isDryRun
                  ? '🔵 Dry Run — simulated trades'
                  : '⚠ Live mode — switch to Mainnet'}
            </div>

            {/* Single toggle: Dry Run ↔ Live */}
            <div className="flex items-center justify-between mt-1">
              <span className="mono text-[10px]" style={{ color: 'var(--text3)' }}>
                {isDryRun ? 'Mode: Dry Run' : 'Mode: Live'}
              </span>
              <button
                onClick={toggleLiveMode}
                className="mono text-[9px] px-2 py-1 rounded transition-all"
                style={{
                  background: isDryRun ? 'rgba(14,203,129,0.15)' : 'rgba(246,70,93,0.15)',
                  color:      isDryRun ? 'var(--green)' : 'var(--red)',
                  border:     `1px solid ${isDryRun ? 'rgba(14,203,129,0.3)' : 'rgba(246,70,93,0.3)'}`,
                }}>
                {isDryRun ? 'Switch to Live' : 'Switch to Dry Run'}
              </button>
            </div>

            {/* Testnet soft warning */}
            {!isDryRun && isTestnet && (
              <div className="mono text-[9px] p-1.5 rounded"
                style={{ background: 'rgba(240,185,11,0.1)', color: 'var(--yellow)', border: '1px solid rgba(240,185,11,0.2)' }}>
                Switch network to Mainnet in Agent Wallet tab for real swaps
              </div>
            )}

            {/* All green */}
            {isLiveReady && (
              <div className="mono text-[9px] p-1.5 rounded"
                style={{ background: 'rgba(14,203,129,0.08)', color: 'var(--green)' }}>
                Real BSC swaps will be signed and broadcast each cycle
              </div>
            )}

            {isActive && (
              <div className="mono text-[9px] p-1.5 rounded"
                style={{ background: 'rgba(14,203,129,0.04)', color: 'var(--text3)', border: '1px solid rgba(14,203,129,0.1)' }}>
                ✓ Mode changes apply on next cycle
              </div>
            )}
          </div>

          {/* Blockers */}
          {noWallet && (
            <div className="mono text-[10px] p-2 rounded mb-2"
              style={{ background: 'rgba(246,70,93,0.08)', color: 'var(--red)' }}>
              ⚠ No wallet — go to Agent Wallet tab
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
              ⚠ Not registered on BSC — register in Agent Wallet tab
            </div>
          )}

          {/* Starting capital */}
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
                onBlur={e =>  (e.target.style.borderColor = 'var(--border2)')} />
            </div>
          )}

          {/* Loop controls */}
          <div className="flex flex-col gap-2">
            {!isActive ? (
              <button onClick={() => startLoop(parseFloat(startCapital))}
                disabled={!canStart}
                className="py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                style={{
                  background: !canStart
                    ? 'var(--bg4)'
                    : isLiveReady
                      ? 'var(--yellow)'
                      : 'rgba(240,185,11,0.5)',
                  color:  !canStart ? 'var(--text3)' : '#000',
                  cursor: canStart  ? 'pointer' : 'not-allowed',
                }}>
                {getStartLabel()}
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

            <button onClick={runCycle} disabled={!canRunCycle}
              className="py-2 rounded-xl mono text-xs transition-all"
              style={{
                background: 'var(--bg3)', border: '1px solid var(--border)',
                color:  !canRunCycle ? 'var(--text3)' : 'var(--text2)',
                cursor: canRunCycle  ? 'pointer'      : 'not-allowed',
              }}>
              {isRunning
                ? <span className="flex items-center justify-center gap-2">
                    <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin-slow" />
                    Running...
                  </span>
                : '↻ Run cycle now'}
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
          <div className="mono text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--text3)' }}>Config</div>
          {[
            { label: 'Mode',      value: agentConfig.dryRun ? '🔵 Dry Run' : '🔴 Live',       color: agentConfig.dryRun ? 'var(--text3)' : 'var(--red)'    },
            { label: 'Network',   value: network === 'mainnet' ? '🟢 Mainnet' : '🟡 Testnet', color: network === 'mainnet' ? 'var(--green)' : 'var(--yellow)' },
            { label: 'Max DD',    value: agentConfig.maxDrawdownPct + '%',                     color: 'var(--text2)'                                          },
            { label: 'Per trade', value: agentConfig.maxPerTradePct + '%',                     color: 'var(--text2)'                                          },
            { label: 'Rules',     value: strategyParsed.length + ' active',                    color: strategyParsed.length > 0 ? 'var(--green)' : 'var(--red)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex justify-between py-1 border-b" style={{ borderColor: 'var(--border)' }}>
              <span className="mono text-[10px]" style={{ color: 'var(--text3)' }}>{label}</span>
              <span className="mono text-[10px] font-bold" style={{ color }}>{value}</span>
            </div>
          ))}
        </div>

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

        {/* Top stats */}
        <div className="px-6 py-5 border-b shrink-0 flex items-start gap-4 flex-wrap"
          style={{ borderColor: 'var(--border)' }}>
          <DrawdownGauge drawdownPct={drawdownPct} size={150} />
          <div className="flex-1 grid gap-3 min-w-0" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>

            <div className="rounded-xl p-4 col-span-3 sm:col-span-1"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <div className="mono text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text3)' }}>Total Return</div>
              <div className="mono text-2xl font-extrabold" style={{ color: pnlColor }}>{fmtPct(pnlPct)}</div>
              <div className="mono text-[10px] mt-0.5" style={{ color: 'var(--text3)' }}>
                {fmtUSD(startUSD)} → {fmtUSD(portfolioUSD)}
              </div>
            </div>

            <div className="rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <div className="mono text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--text3)' }}>Drawdown</div>
              <DrawdownBar drawdownPct={drawdownPct} />
              <div className="mono text-[10px] mt-1" style={{ color: 'var(--text3)' }}>
                Cap: {COMPETITION_RULES.MAX_DRAWDOWN_PCT}%
              </div>
            </div>

            <div className="rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <div className="mono text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text3)' }}>Trades</div>
              <div className="mono text-xl font-extrabold" style={{ color: 'var(--text)' }}>
                {todayTrades}<span style={{ color: 'var(--text3)', fontSize: 12 }}> today</span>
              </div>
              <div className="mono text-[10px] mt-0.5 flex items-center gap-1.5" style={{ color: tradeStatus.color }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: tradeStatus.color }} />
                {totalTrades} total · {tradeStatus.label}
              </div>
            </div>

            <div className="rounded-xl p-4"
              style={{ background: 'rgba(14,203,129,0.04)', border: '1px solid rgba(14,203,129,0.15)' }}>
              <div className="mono text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text3)' }}>On-Chain Proof</div>
              <div className="mono text-xl font-extrabold" style={{ color: 'var(--green)' }}>{liveTrades.length}</div>
              <div className="mono text-[10px] mt-0.5" style={{ color: 'var(--text3)' }}>signed txs on {network}</div>
            </div>

            <div className="rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <div className="mono text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text3)' }}>Day</div>
              <div className="mono text-xl font-extrabold" style={{ color: 'var(--text)' }}>
                {daysElapsed + 1}<span style={{ color: 'var(--text3)', fontSize: 12 }}>/7</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden mt-2" style={{ background: 'var(--bg4)' }}>
                <div className="h-full rounded-full"
                  style={{ width: `${((daysElapsed + 1) / 7) * 100}%`, background: 'var(--yellow)' }} />
              </div>
            </div>

            <div className="rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <div className="mono text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text3)' }}>Last Cycle</div>
              <div className="mono text-xs font-bold" style={{ color: 'var(--text)' }}>
                {lastCycle ? fmtTime(lastCycle.cycleAt) : '-'}
              </div>
              {lastCycle && (
                <div className="mono text-[10px] mt-0.5" style={{ color: 'var(--text3)' }}>
                  {lastCycle.executed} executed · {lastCycle.blocked} blocked
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab strip */}
        <div className="flex gap-1 px-6 pt-4 border-b" style={{ borderColor: 'var(--border)' }}>
          {(['overview', 'trades', 'decisions'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveView(tab)}
              className="mono text-xs px-4 py-2 rounded-t-lg transition-all capitalize"
              style={{
                background:   activeView === tab ? 'var(--bg2)' : 'transparent',
                color:        activeView === tab ? 'var(--yellow)' : 'var(--text3)',
                borderBottom: activeView === tab ? '2px solid var(--yellow)' : '2px solid transparent',
              }}>
              {tab === 'trades' ? `Trades (${trades.length})` : tab === 'decisions' ? 'Last Cycle' : 'Overview'}
            </button>
          ))}
        </div>

        {/* Overview */}
        {activeView === 'overview' && (
          <div className="px-6 py-4 flex flex-col gap-4">
            <div className="rounded-xl p-4"
              style={{ background: 'rgba(14,203,129,0.04)', border: '1px solid rgba(14,203,129,0.15)' }}>
              <div className="mono text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--green)' }}>
                How Self-Custody Works Here
              </div>
              <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
                {[
                  { step: '1', label: 'Server fetches signals',     desc: 'CMC F&G + signal scores via x402'          },
                  { step: '2', label: 'Server builds unsigned txs',  desc: 'Approval + swap calldata, no key needed'   },
                  { step: '3', label: 'Browser signs locally',       desc: 'ethers.Wallet — key never leaves device'   },
                  { step: '4', label: 'Server broadcasts',           desc: 'Relay only — signs nothing'                },
                ].map(s => (
                  <div key={s.step} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: 'var(--bg3)' }}>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center mono text-[9px] font-bold shrink-0"
                      style={{ background: 'var(--yellow)', color: '#000' }}>{s.step}</div>
                    <div>
                      <div className="mono text-[10px] font-bold" style={{ color: 'var(--text)' }}>{s.label}</div>
                      <div className="mono text-[9px]" style={{ color: 'var(--text3)' }}>{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              <div className="px-4 py-3 border-b flex items-center justify-between"
                style={{ borderColor: 'var(--border)', background: 'var(--bg2)' }}>
                <span className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>Active Rules</span>
                <span className="mono text-[10px]" style={{ color: 'var(--yellow)' }}>{strategyParsed.length} rules</span>
              </div>
              {strategyParsed.length === 0 ? (
                <div className="px-4 py-8 text-center mono text-xs" style={{ color: 'var(--text3)' }}>
                  No rules — go to Strategy Builder tab
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {strategyParsed.slice(0, 5).map((rule: any, i: number) => (
                    <div key={rule.id ?? i} className="px-4 py-3 flex items-center gap-3" style={{ background: 'var(--bg2)' }}>
                      <span className="mono text-[10px] font-bold w-8" style={{ color: 'var(--text3)' }}>#{i + 1}</span>
                      <span className="mono text-xs font-bold" style={{ color: 'var(--text)' }}>{rule.symbol}</span>
                      <span className="mono text-[10px] px-2 py-0.5 rounded-full"
                        style={{
                          background: rule.action === 'BUY' ? 'rgba(14,203,129,0.1)' : 'rgba(246,70,93,0.1)',
                          color:      rule.action === 'BUY' ? 'var(--green)' : 'var(--red)',
                        }}>
                        {rule.action}
                      </span>
                      <span className="mono text-[10px]" style={{ color: 'var(--text3)' }}>{rule.sizePct}% portfolio</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Trades */}
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
            </div>

            {filteredTrades.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3"
                style={{ background: 'var(--bg2)', border: '1px dashed var(--border)', borderRadius: 12 }}>
                <div className="text-4xl opacity-20">📋</div>
                <div className="mono text-xs" style={{ color: 'var(--text3)' }}>No trades yet</div>
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                <div className="grid px-4 py-2 mono text-[9px] uppercase tracking-widest border-b"
                  style={{
                    gridTemplateColumns: '80px 60px 90px 90px 70px 80px 1fr',
                    background: 'var(--bg3)', color: 'var(--text3)', borderColor: 'var(--border)',
                  }}>
                  {['Time','Symbol','Side','Amount','Price','Score','Tx'].map(h => <span key={h}>{h}</span>)}
                </div>
                {filteredTrades.map(t => (
                  <div key={t.id} className="grid px-4 py-3 border-b items-center"
                    style={{
                      gridTemplateColumns: '80px 60px 90px 90px 70px 80px 1fr',
                      background: 'var(--bg2)', borderColor: 'var(--border)',
                    }}>
                    <span className="mono text-[10px]" style={{ color: 'var(--text3)' }}>{fmtTime(t.timestamp)}</span>
                    <span className="mono text-xs font-bold" style={{ color: 'var(--text)' }}>{t.symbol}</span>
                    <span className="mono text-[10px] font-bold" style={{ color: t.side === 'BUY' ? 'var(--green)' : 'var(--red)' }}>
                      {t.side}
                    </span>
                    <span className="mono text-[10px]" style={{ color: 'var(--text)' }}>{fmtUSD(t.amountUSDT)}</span>
                    <span className="mono text-[10px]" style={{ color: 'var(--text2)' }}>
                      {t.price > 0 ? fmtUSD(t.price) : '-'}
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
                        <a href={`${netCfg.explorerTx}${t.txHash}`} target="_blank" rel="noreferrer"
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

        {/* Decisions */}
        {activeView === 'decisions' && (
          <div className="px-6 py-4 flex flex-col gap-3">
            {!lastCycle ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3"
                style={{ background: 'var(--bg2)', border: '1px dashed var(--border)', borderRadius: 12 }}>
                <div className="text-4xl opacity-20">⚡</div>
                <div className="mono text-xs" style={{ color: 'var(--text3)' }}>No cycle run yet</div>
              </div>
            ) : (
              <>
                <div className="mono text-[10px]" style={{ color: 'var(--text3)' }}>
                  Cycle at {fmtTime(lastCycle.cycleAt)} · {lastCycle.executed} executed · {lastCycle.blocked} blocked · DD {lastCycle.drawdownPct.toFixed(1)}%
                </div>
                {lastCycle.decisions.map((d: any, i: number) => (
                  <div key={i} className="rounded-xl p-4 flex items-start gap-3"
                    style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                    <span className="text-lg shrink-0 mt-0.5">
                      {d.guardrail === 'blocked' ? '🚫' : d.guardrail === 'warning' ? '⚠' : '✓'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="mono text-xs font-bold" style={{ color: 'var(--text)' }}>{d.symbol}</span>
                        <span className="mono text-[10px] px-2 py-0.5 rounded-full"
                          style={{
                            background: d.action === 'BUY' ? 'rgba(14,203,129,0.1)' : 'rgba(246,70,93,0.1)',
                            color:      d.action === 'BUY' ? 'var(--green)' : 'var(--red)',
                          }}>
                          {d.action}
                        </span>
                        <span className="mono text-[10px]" style={{ color: 'var(--yellow)' }}>
                          ${d.amountUSDT?.toFixed(2)}
                        </span>
                        <span className="mono text-[10px]" style={{ color: 'var(--text3)' }}>
                          score {d.signalScore?.toFixed(0)}
                        </span>
                        {d.dryRun && (
                          <span className="mono text-[9px] px-1.5 py-0.5 rounded"
                            style={{ background: 'var(--bg3)', color: 'var(--text3)' }}>dry-run</span>
                        )}
                        {d.txHash && (
                          <a href={`${netCfg.explorerTx}${d.txHash}`} target="_blank" rel="noreferrer"
                            className="mono text-[9px] px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(14,203,129,0.1)', color: 'var(--green)' }}>
                            {d.txHash.slice(0, 8)}...↗
                          </a>
                        )}
                      </div>
                      {d.blockReason && (
                        <div className="mono text-[10px]" style={{ color: 'var(--red)' }}>{d.blockReason}</div>
                      )}
                      {d.warning && (
                        <div className="mono text-[10px]" style={{ color: 'var(--yellow)' }}>{d.warning}</div>
                      )}
                      <div className="mono text-[10px] leading-snug mt-0.5" style={{ color: 'var(--text3)' }}>
                        {d.reasoning}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}