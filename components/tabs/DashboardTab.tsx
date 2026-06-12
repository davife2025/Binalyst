'use client'

/**
 * components/tabs/DashboardTab.tsx — Session I
 * Mission control dashboard. Built on the existing design system.
 * Shows: agent status, live PnL, F&G, top signal, quick actions.
 */

import { useStore }        from '@/lib/store'
import { useAgentStore }   from '@/lib/agentStore'
import { useFearAndGreed } from '@/hooks/useSignals'
import { FearGreedMini }   from '@/components/agent/FearGreedGauge'
import { DrawdownBar }     from '@/components/agent/DrawdownGauge'
import { PnLSparkline }    from '@/components/agent/PnLChart'
import { usePortfolio }    from '@/hooks/usePortfolio'

function StatCard({
  label, value, sub, color = 'var(--text)', bg, border, onClick, badge,
}: {
  label: string; value: string; sub?: string
  color?: string; bg?: string; border?: string
  onClick?: () => void; badge?: string
}) {
  return (
    <div
      onClick={onClick}
      className="rounded-xl p-4 flex flex-col gap-1 transition-all"
      style={{
        background: bg ?? 'var(--bg2)',
        border:     `1px solid ${border ?? 'var(--border)'}`,
        cursor:     onClick ? 'pointer' : 'default',
      }}
      onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLElement).style.borderColor = 'var(--yellow)' }}
      onMouseLeave={e => { if (onClick) (e.currentTarget as HTMLElement).style.borderColor = border ?? 'var(--border)' }}
    >
      <div className="flex items-center justify-between">
        <div className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
          {label}
        </div>
        {badge && (
          <span className="mono text-[9px] px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(240,185,11,0.15)', color: 'var(--yellow)', border: '1px solid rgba(240,185,11,0.3)' }}>
            {badge}
          </span>
        )}
      </div>
      <div className="mono text-xl font-extrabold leading-tight" style={{ color }}>{value}</div>
      {sub && <div className="mono text-[10px]" style={{ color: 'var(--text3)' }}>{sub}</div>}
    </div>
  )
}

function QuickAction({
  icon, label, desc, tab, color = 'var(--yellow)',
}: {
  icon: string; label: string; desc: string; tab: string; color?: string
}) {
  const { setActiveTab } = useStore()
  return (
    <button
      onClick={() => setActiveTab(tab as any)}
      className="flex items-center gap-3 px-4 py-3 rounded-xl text-left w-full transition-all"
      style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = color)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
      <span className="text-2xl shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>{label}</div>
        <div className="mono text-[10px]" style={{ color: 'var(--text3)' }}>{desc}</div>
      </div>
      <span className="ml-auto mono text-xs" style={{ color: 'var(--text3)' }}>→</span>
    </button>
  )
}

const STATUS_CONFIG = {
  idle:         { color: 'var(--text3)',  label: 'Idle',          dot: false },
  running:      { color: 'var(--green)',  label: 'Live',          dot: true  },
  paused:       { color: 'var(--yellow)', label: 'Paused',        dot: false },
  error:        { color: 'var(--red)',    label: 'Error',         dot: false },
  disqualified: { color: 'var(--red)',    label: 'Disqualified',  dot: false },
}

export default function DashboardTab() {
  const { setActiveTab, isConnected }  = useStore()
  const {
    session, isWalletLoaded, agentAddress,
    strategyParsed, trades, agentConfig,
  } = useAgentStore()

  const network   = (useAgentStore() as any).network ?? 'testnet'
  const { data: fg } = useFearAndGreed()
  const { snapshot, history } = usePortfolio()

  const agentStatus  = session?.status ?? 'idle'
  const statusCfg    = STATUS_CONFIG[agentStatus] ?? STATUS_CONFIG.idle
  const pnlPct       = session?.startValueUSDT && session.startValueUSDT > 0
    ? ((( session.currentValueUSDT - session.startValueUSDT) / session.startValueUSDT) * 100)
    : 0
  const pnlColor     = pnlPct >= 0 ? 'var(--green)' : 'var(--red)'
  const drawdownPct  = session?.drawdownPct ?? 0
  const totalTrades  = session?.totalTrades ?? 0
  const liveTrades   = trades.filter(t => !t.dryRun && t.txHash)

  // Setup completeness
  const steps = [
    { label: 'Wallet connected',   done: isWalletLoaded,          tab: 'agent-wallet' },
    { label: 'Strategy defined',   done: strategyParsed.length > 0, tab: 'strategy'   },
    { label: 'Registered on BSC',  done: session?.isRegistered ?? false, tab: 'agent-wallet' },
    { label: 'Agent started',      done: agentStatus === 'running', tab: 'competition' },
  ]
  const setupPct    = Math.round((steps.filter(s => s.done).length / steps.length) * 100)
  const allSetUp    = steps.every(s => s.done)
  const nextStep    = steps.find(s => !s.done)

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
      <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col gap-6">

        {/* ── Platform header ──────────────────────────────────────────── */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-lg"
                style={{ background: 'var(--yellow)', color: '#000' }}>B</div>
              <div>
                <h1 className="text-xl font-extrabold" style={{ color: 'var(--text)' }}>Binalyst</h1>
                <p className="mono text-[10px] tracking-widest" style={{ color: 'var(--text3)' }}>
                  BNB CHAIN AI TRADING PLATFORM
                </p>
              </div>
            </div>
            <p className="text-sm mt-2 max-w-md" style={{ color: 'var(--text2)' }}>
              Autonomous trading agent powered by{' '}
              <span style={{ color: 'var(--yellow)' }}>CMC signals</span>,{' '}
              <span style={{ color: 'var(--yellow)' }}>AI strategy</span>, and{' '}
              <span style={{ color: 'var(--yellow)' }}>TWAK self-custody signing</span> on BSC.
            </p>
          </div>

          {/* Network + agent status badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{
                background: network === 'mainnet' ? 'rgba(246,70,93,0.1)' : 'rgba(14,203,129,0.1)',
                border: `1px solid ${network === 'mainnet' ? 'rgba(246,70,93,0.3)' : 'rgba(14,203,129,0.3)'}`,
              }}>
              <span className="w-1.5 h-1.5 rounded-full"
                style={{ background: network === 'mainnet' ? 'var(--red)' : 'var(--green)' }} />
              <span className="mono text-[10px] font-bold"
                style={{ color: network === 'mainnet' ? 'var(--red)' : 'var(--green)' }}>
                {network === 'mainnet' ? 'BSC Mainnet' : 'BSC Testnet'}
              </span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{
                background: agentStatus === 'running' ? 'rgba(14,203,129,0.1)' : 'var(--bg2)',
                border: `1px solid ${agentStatus === 'running' ? 'rgba(14,203,129,0.3)' : 'var(--border)'}`,
              }}>
              {statusCfg.dot && (
                <span className="w-1.5 h-1.5 rounded-full"
                  style={{ background: statusCfg.color, animation: 'blink 1.5s infinite' }} />
              )}
              <span className="mono text-[10px] font-bold" style={{ color: statusCfg.color }}>
                Agent {statusCfg.label}
              </span>
            </div>
          </div>
        </div>

        {/* ── Setup progress (shown until fully set up) ─────────────────── */}
        {!allSetUp && (
          <div className="rounded-xl p-5" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
                Setup Progress
              </div>
              <span className="mono text-xs font-bold" style={{ color: 'var(--yellow)' }}>
                {setupPct}% complete
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden mb-4" style={{ background: 'var(--bg4)' }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${setupPct}%`, background: 'var(--yellow)' }} />
            </div>
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
              {steps.map(step => (
                <button key={step.label}
                  onClick={() => setActiveTab(step.tab as any)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all"
                  style={{
                    background: step.done ? 'rgba(14,203,129,0.06)' : 'var(--bg3)',
                    border: `1px solid ${step.done ? 'rgba(14,203,129,0.2)' : 'var(--border)'}`,
                  }}>
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0"
                    style={{
                      background: step.done ? 'rgba(14,203,129,0.2)' : 'var(--bg4)',
                      color: step.done ? 'var(--green)' : 'var(--text3)',
                    }}>
                    {step.done ? '✓' : '○'}
                  </span>
                  <span className="mono text-[10px]"
                    style={{ color: step.done ? 'var(--text2)' : 'var(--text3)' }}>
                    {step.label}
                  </span>
                  {!step.done && (
                    <span className="mono text-[9px] ml-auto" style={{ color: 'var(--yellow)' }}>→</span>
                  )}
                </button>
              ))}
            </div>
            {nextStep && (
              <button
                onClick={() => setActiveTab(nextStep.tab as any)}
                className="w-full mt-3 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: 'var(--yellow)', color: '#000' }}>
                Next: {nextStep.label} →
              </button>
            )}
          </div>
        )}

        {/* ── Live stats row ────────────────────────────────────────────── */}
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
          <StatCard
            label="Portfolio Value"
            value={snapshot ? '$' + snapshot.totalUSD.toFixed(2) : session ? '$' + (session.currentValueUSDT ?? 0).toFixed(2) : '—'}
            sub={isWalletLoaded ? 'Live on-chain' : 'Connect wallet'}
            color="var(--text)"
            onClick={() => setActiveTab('performance')}
            badge={isWalletLoaded ? undefined : 'Setup'}
          />
          <StatCard
            label="Total Return"
            value={session ? (pnlPct >= 0 ? '+' : '') + pnlPct.toFixed(2) + '%' : '—'}
            sub={session ? `Started at $${session.startValueUSDT.toFixed(2)}` : 'Agent not started'}
            color={pnlColor}
            onClick={() => setActiveTab('performance')}
          />
          <StatCard
            label="Drawdown"
            value={session ? drawdownPct.toFixed(1) + '%' : '—'}
            sub="Cap: 30% (disqualify)"
            color={drawdownPct >= 24 ? 'var(--yellow)' : drawdownPct >= 28 ? 'var(--red)' : 'var(--green)'}
            onClick={() => setActiveTab('competition')}
          />
          <StatCard
            label="Total Trades"
            value={totalTrades.toString()}
            sub={`${liveTrades.length} live on-chain`}
            color="var(--text)"
            onClick={() => setActiveTab('competition')}
            badge={totalTrades >= 7 ? '✓ Qualified' : undefined}
          />
        </div>

        {/* ── Middle row: F&G + PnL sparkline + agent status ────────────── */}
        <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1.6fr 1fr' }}>

          {/* Fear & Greed */}
          <div className="rounded-xl p-4 flex flex-col gap-3"
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
              CMC Fear & Greed
            </div>
            {fg ? (
              <>
                <FearGreedMini value={fg.value} label={fg.label} />
                <div className="mono text-[10px] leading-snug" style={{ color: 'var(--text3)' }}>
                  {fg.value <= 25 && 'Extreme fear — contrarian buy window.'}
                  {fg.value > 25 && fg.value <= 44 && 'Fear — elevated caution, watch for reversals.'}
                  {fg.value > 44 && fg.value <= 55 && 'Neutral — no strong directional bias.'}
                  {fg.value > 55 && fg.value <= 74 && 'Greed — market optimistic, manage risk.'}
                  {fg.value > 74 && 'Extreme greed — elevated risk of correction.'}
                </div>
                <button onClick={() => setActiveTab('signals')}
                  className="mono text-[10px] px-3 py-1.5 rounded-lg w-full"
                  style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
                  View all signals →
                </button>
              </>
            ) : (
              <div className="flex items-center justify-center h-16 mono text-xs"
                style={{ color: 'var(--text3)' }}>
                Loading...
              </div>
            )}
          </div>

          {/* PnL chart */}
          <div className="rounded-xl p-4 flex flex-col gap-3"
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <div className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
                Competition PnL
              </div>
              {session && (
                <span className="mono text-xs font-bold" style={{ color: pnlColor }}>
                  {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                </span>
              )}
            </div>
            {history.length >= 2 ? (
              <PnLSparkline history={history} />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-4">
                <div className="mono text-xs text-center" style={{ color: 'var(--text3)' }}>
                  {session ? 'Collecting hourly data...' : 'Start agent to track PnL'}
                </div>
              </div>
            )}
            {session && (
              <DrawdownBar drawdownPct={drawdownPct} />
            )}
            <button onClick={() => setActiveTab('competition')}
              className="mono text-[10px] px-3 py-1.5 rounded-lg w-full"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
              Open competition dashboard →
            </button>
          </div>

          {/* Agent status */}
          <div className="rounded-xl p-4 flex flex-col gap-3"
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
              Agent Status
            </div>

            <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
              style={{
                background: agentStatus === 'running'
                  ? 'rgba(14,203,129,0.08)' : 'var(--bg3)',
                border: `1px solid ${agentStatus === 'running'
                  ? 'rgba(14,203,129,0.25)' : 'var(--border)'}`,
              }}>
              <span className="w-2 h-2 rounded-full shrink-0"
                style={{
                  background: statusCfg.color,
                  animation: statusCfg.dot ? 'blink 1.5s infinite' : 'none',
                }} />
              <span className="mono text-xs font-bold" style={{ color: statusCfg.color }}>
                {statusCfg.label}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              {[
                { label: 'Wallet',   value: isWalletLoaded ? agentAddress.slice(0,8)+'...' : 'Not connected',   ok: isWalletLoaded },
                { label: 'Strategy', value: strategyParsed.length > 0 ? `${strategyParsed.length} rules` : 'None defined', ok: strategyParsed.length > 0 },
                { label: 'Mode',     value: agentConfig.dryRun ? 'Dry Run' : 'Live',                           ok: !agentConfig.dryRun },
                { label: 'Trades',   value: `${totalTrades} / 7 min`,                                          ok: totalTrades >= 7 },
              ].map(({ label, value, ok }) => (
                <div key={label} className="flex justify-between">
                  <span className="mono text-[10px]" style={{ color: 'var(--text3)' }}>{label}</span>
                  <span className="mono text-[10px] font-bold"
                    style={{ color: ok ? 'var(--text)' : 'var(--text3)' }}>{value}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setActiveTab(isWalletLoaded ? 'competition' : 'agent-wallet')}
              className="mono text-[10px] px-3 py-1.5 rounded-lg w-full font-bold"
              style={{ background: 'var(--yellow)', color: '#000' }}>
              {agentStatus === 'running' ? 'View competition →' : isWalletLoaded ? 'Start agent →' : 'Connect wallet →'}
            </button>
          </div>
        </div>

        {/* ── Quick actions ─────────────────────────────────────────────── */}
        <div>
          <div className="mono text-[10px] uppercase tracking-widest mb-3" style={{ color: 'var(--text3)' }}>
            Quick Actions
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
            <QuickAction icon="📡" label="Live Signals"     desc="CMC F&G + signal scoring"  tab="signals"      />
            <QuickAction icon="🧠" label="Strategy Builder" desc="Write & parse your strategy" tab="strategy"    />
            <QuickAction icon="🏆" label="Competition"      desc="Live PnL + trade log"       tab="competition"  />
            <QuickAction icon="📊" label="Performance"      desc="Portfolio + hourly PnL"     tab="performance"  />
            <QuickAction icon="◈"  label="AI Assistant"     desc="Ask anything about markets" tab="chat"         />
            <QuickAction icon="◐"  label="Live Markets"     desc="Prices, charts, order book" tab="markets"      />
          </div>
        </div>

        {/* ── Platform pillars (info strip) ────────────────────────────── */}
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
          {[
            {
              icon:  '📡',
              title: 'CMC Intelligence',
              desc:  'Fear & Greed index, signal scoring across 149 eligible tokens, trending analysis, x402 pay-per-request data.',
              color: '#3498db',
            },
            {
              icon:  '🤖',
              title: 'Autonomous Agent',
              desc:  'Strategy rules evaluated every 2 minutes. Self-custodial TWAK signing. Guardrails: drawdown cap, daily minimums, eligible-only trades.',
              color: 'var(--yellow)',
            },
            {
              icon:  '⛓',
              title: 'BNB Chain Native',
              desc:  'Registered on BSC competition contract. PancakeSwap V2 execution. On-chain proof of every trade. Testnet → Mainnet flow.',
              color: 'var(--green)',
            },
          ].map(({ icon, title, desc, color }) => (
            <div key={title} className="rounded-xl p-4"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{icon}</span>
                <span className="font-bold text-sm" style={{ color }}>{title}</span>
              </div>
              <p className="mono text-[10px] leading-relaxed" style={{ color: 'var(--text3)' }}>
                {desc}
              </p>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
