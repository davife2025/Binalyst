'use client'

/**
 * components/tabs/DorahacksTab.tsx
 * Session E: Dorahacks submission generator + performance export.
 * Generates a judge-ready writeup from actual agent data.
 */

import { useState } from 'react'
import { useAgentStore }  from '@/lib/agentStore'
import {
  exportTradesCSV,
  exportPerformanceReport,
  exportPnLJSON,
} from '@/lib/exportUtils'

function fmtUSD(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtPct(n: number) {
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
}

export default function DorahacksTab() {
  const {
    agentAddress, session, trades, strategyText,
    strategyParsed, agentConfig,
  } = useAgentStore()

  const [generating,   setGenerating]   = useState(false)
  const [submission,   setSubmission]   = useState('')
  const [error,        setError]        = useState('')
  const [copied,       setCopied]       = useState(false)
  const [activeSection, setActiveSection] = useState<'generate' | 'exports' | 'checklist'>('generate')

  const pnlPct = session?.startValueUSDT && session.startValueUSDT > 0
    ? ((session.currentValueUSDT - session.startValueUSDT) / session.startValueUSDT) * 100
    : 0

  const liveTrades = trades.filter(t => !t.dryRun && t.txHash)
  const topTrades  = [...trades]
    .sort((a, b) => Math.abs(b.amountUSDT) - Math.abs(a.amountUSDT))
    .slice(0, 5)

  // ── Generate submission ──────────────────────────────────────────────────
  async function handleGenerate() {
    setGenerating(true); setError(''); setSubmission('')
    try {
      const res = await fetch('/api/agent/dorahacks', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentAddress,
          strategyText,
          strategyRules:  strategyParsed,
          trades:         trades.slice(0, 50),
          session,
          agentConfig,
          registrationTx: session?.registrationTx,
          topTrades,
        }),
      })
      const data = await res.json()
      if (!data.success) { setError(data.error ?? 'Generation failed'); return }
      setSubmission(data.submission)
    } catch (e: any) { setError(e.message) }
    setGenerating(false)
  }

  function handleCopy() {
    navigator.clipboard.writeText(submission)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  // ── Completion checklist ─────────────────────────────────────────────────
  const checklist = [
    {
      label:  'Agent wallet created',
      done:   !!agentAddress,
      detail: agentAddress ? `${agentAddress.slice(0, 10)}...` : 'Go to Agent Wallet tab',
    },
    {
      label:  'Registered on BSC contract',
      done:   session?.isRegistered ?? false,
      detail: session?.registrationTx
        ? `Tx: ${session.registrationTx.slice(0, 14)}...`
        : 'Register before deadline',
    },
    {
      label:  'Strategy defined',
      done:   strategyParsed.length > 0,
      detail: `${strategyParsed.length} rules`,
    },
    {
      label:  'Agent run at least once',
      done:   (session?.totalTrades ?? 0) > 0,
      detail: `${session?.totalTrades ?? 0} total trades`,
    },
    {
      label:  `Min 1 trade/day (${trades.length} total)`,
      done:   trades.length >= 7,
      detail: trades.length >= 7 ? '✓ Qualifies' : `Need ${7 - trades.length} more`,
    },
    {
      label:  'Drawdown under 30%',
      done:   (session?.drawdownPct ?? 0) < 30,
      detail: `${(session?.drawdownPct ?? 0).toFixed(1)}% current DD`,
    },
    {
      label:  'Live on-chain trades',
      done:   liveTrades.length > 0,
      detail: `${liveTrades.length} confirmed txs`,
    },
    {
      label:  'Portfolio above $1',
      done:   (session?.currentValueUSDT ?? 0) > 1,
      detail: fmtUSD(session?.currentValueUSDT ?? 0),
    },
    {
      label:  'Dorahacks submission written',
      done:   submission.length > 0,
      detail: submission.length > 0 ? `${submission.split(' ').length} words` : 'Generate below',
    },
  ]

  const completedCount = checklist.filter(c => c.done).length
  const allDone = completedCount === checklist.length

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-extrabold" style={{ color: 'var(--text)' }}>
            Submission & Export
          </h2>
          <p className="mono text-xs mt-1" style={{ color: 'var(--text3)' }}>
            Dorahacks writeup generator · Performance export · Completion checklist
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl"
          style={{
            background: allDone ? 'rgba(14,203,129,0.1)' : 'rgba(240,185,11,0.08)',
            border:     `1px solid ${allDone ? 'rgba(14,203,129,0.3)' : 'rgba(240,185,11,0.2)'}`,
          }}>
          <span className="mono text-xs font-bold"
            style={{ color: allDone ? 'var(--green)' : 'var(--yellow)' }}>
            {completedCount}/{checklist.length} complete
          </span>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { label: 'Return',       value: fmtPct(pnlPct),             color: pnlPct >= 0 ? 'var(--green)' : 'var(--red)' },
          { label: 'Drawdown',     value: `${(session?.drawdownPct ?? 0).toFixed(1)}%`, color: (session?.drawdownPct ?? 0) >= 24 ? 'var(--yellow)' : 'var(--text)' },
          { label: 'Total trades', value: trades.length.toString(),    color: 'var(--text)' },
          { label: 'On-chain',     value: liveTrades.length.toString(), color: liveTrades.length > 0 ? 'var(--green)' : 'var(--text3)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl p-4"
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div className="mono text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text3)' }}>
              {label}
            </div>
            <div className="mono text-xl font-extrabold" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
        {([
          { id: 'generate',  label: '✍ Generate Submission' },
          { id: 'exports',   label: '⬇ Exports'             },
          { id: 'checklist', label: `☑ Checklist (${completedCount}/${checklist.length})` },
        ] as const).map(tab => (
          <button key={tab.id} onClick={() => setActiveSection(tab.id)}
            className="mono text-xs px-4 py-2 rounded-t-lg transition-all"
            style={{
              background:   activeSection === tab.id ? 'var(--bg2)' : 'transparent',
              color:        activeSection === tab.id ? 'var(--yellow)' : 'var(--text3)',
              borderBottom: activeSection === tab.id ? '2px solid var(--yellow)' : '2px solid transparent',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Generate ──────────────────────────────────────────────────────── */}
      {activeSection === 'generate' && (
        <div className="flex flex-col gap-4">

          {/* Context preview */}
          <div className="rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div className="mono text-[10px] uppercase tracking-widest mb-3" style={{ color: 'var(--text3)' }}>
              Data used for submission
            </div>
            <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {[
                { label: 'Agent address', value: agentAddress ? `${agentAddress.slice(0, 12)}...` : 'Not set' },
                { label: 'Strategy rules', value: `${strategyParsed.length} rules` },
                { label: 'Trade history', value: `${trades.length} trades` },
                { label: 'Live txs', value: `${liveTrades.length} on BSC` },
                { label: 'PnL', value: fmtPct(pnlPct) },
                { label: 'Drawdown', value: `${(session?.drawdownPct ?? 0).toFixed(1)}%` },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="mono text-[10px]" style={{ color: 'var(--text3)' }}>{label}</span>
                  <span className="mono text-[10px] font-bold" style={{ color: 'var(--text2)' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button onClick={handleGenerate} disabled={generating}
            className="py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
            style={{
              background: generating ? 'var(--bg4)' : 'var(--yellow)',
              color:      generating ? 'var(--text3)' : '#000',
              cursor:     generating ? 'not-allowed' : 'pointer',
            }}>
            {generating && (
              <span className="w-4 h-4 rounded-full border-2 border-black/30 border-t-black animate-spin-slow" />
            )}
            {generating ? 'Generating with AI...' : '⚡ Generate Dorahacks Submission'}
          </button>

          {error && (
            <div className="mono text-xs p-3 rounded-lg"
              style={{ background: 'rgba(246,70,93,0.08)', border: '1px solid rgba(246,70,93,0.25)', color: 'var(--red)' }}>
              {error}
            </div>
          )}

          {/* Submission output */}
          {submission && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
                  Generated Submission
                </div>
                <div className="flex gap-2">
                  <button onClick={handleCopy}
                    className="mono text-xs px-3 py-1.5 rounded-lg transition-all"
                    style={{
                      background: copied ? 'rgba(14,203,129,0.1)' : 'var(--bg3)',
                      border:     `1px solid ${copied ? 'rgba(14,203,129,0.3)' : 'var(--border)'}`,
                      color:      copied ? 'var(--green)' : 'var(--text2)',
                    }}>
                    {copied ? '✓ Copied!' : 'Copy'}
                  </button>
                  <button
                    onClick={() => {
                      const blob = new Blob([submission], { type: 'text/markdown' })
                      const url  = URL.createObjectURL(blob)
                      const a    = document.createElement('a')
                      a.href     = url
                      a.download = `binalyst-dorahacks-${Date.now()}.md`
                      a.click()
                    }}
                    className="mono text-xs px-3 py-1.5 rounded-lg transition-all"
                    style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
                    ⬇ Download .md
                  </button>
                </div>
              </div>

              <div
                className="rounded-xl p-5 text-sm leading-relaxed overflow-y-auto"
                style={{
                  background:    'var(--bg2)',
                  border:        '1px solid var(--border)',
                  color:         'var(--text2)',
                  whiteSpace:    'pre-wrap',
                  fontFamily:    'Space Mono, monospace',
                  fontSize:      11,
                  maxHeight:     480,
                  lineHeight:    1.7,
                }}
                dangerouslySetInnerHTML={{
                  __html: submission
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/^## (.+)$/gm,
                      '<span style="color:var(--yellow);font-size:13px;font-weight:700;display:block;margin-top:16px;margin-bottom:4px">## $1</span>')
                    .replace(/^# (.+)$/gm,
                      '<span style="color:var(--text);font-size:15px;font-weight:800;display:block;margin-bottom:8px">$1</span>')
                    .replace(/\*\*(.+?)\*\*/g,
                      '<strong style="color:var(--text);font-weight:700">$1</strong>')
                    .replace(/`(.+?)`/g,
                      '<code style="background:var(--bg3);padding:1px 4px;border-radius:3px;color:var(--green)">$1</code>')
                    .replace(/^- (.+)$/gm,
                      '<div style="margin:2px 0"><span style="color:var(--yellow)">›</span> $1</div>')
                    .replace(/\n/g, '<br/>'),
                }}
              />

              <div className="mono text-[10px] p-3 rounded-lg"
                style={{ background: 'rgba(240,185,11,0.06)', border: '1px solid rgba(240,185,11,0.15)', color: 'var(--yellow)' }}>
                ⚠ Review carefully before submitting — add your actual tx hashes, contract address proof,
                and any missing on-chain evidence. Submit at: https://dorahacks.io
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Exports ───────────────────────────────────────────────────────── */}
      {activeSection === 'exports' && (
        <div className="flex flex-col gap-3">
          <div className="mono text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text3)' }}>
            Export competition evidence
          </div>

          {[
            {
              icon:  '📋',
              title: 'Trade Log (CSV)',
              desc:  `${trades.length} trades · includes BSCScan links for live txs · judge-ready evidence`,
              action: () => exportTradesCSV(trades, agentAddress),
              disabled: trades.length === 0,
            },
            {
              icon:  '📊',
              title: 'Performance Report (Markdown)',
              desc:  'PnL summary · on-chain proof links · strategy rules · compliance check',
              action: () => session && exportPerformanceReport(session, trades, strategyParsed, agentAddress, strategyText),
              disabled: !session,
            },
            {
              icon:  '🔗',
              title: 'On-Chain Evidence (JSON)',
              desc:  'Machine-readable PnL + all live tx hashes · for Dorahacks submission evidence',
              action: () => session && exportPnLJSON(session, trades, agentAddress),
              disabled: !session,
            },
          ].map(({ icon, title, desc, action, disabled }) => (
            <div key={title} className="rounded-xl p-5 flex items-center gap-4"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <div className="text-3xl shrink-0">{icon}</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm mb-0.5" style={{ color: 'var(--text)' }}>{title}</div>
                <div className="mono text-[10px]" style={{ color: 'var(--text3)' }}>{desc}</div>
              </div>
              <button
                onClick={action}
                disabled={disabled}
                className="mono text-xs px-4 py-2 rounded-lg shrink-0 transition-all"
                style={{
                  background: disabled ? 'var(--bg4)' : 'var(--yellow)',
                  color:      disabled ? 'var(--text3)' : '#000',
                  cursor:     disabled ? 'not-allowed' : 'pointer',
                }}>
                ⬇ Export
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Checklist ─────────────────────────────────────────────────────── */}
      {activeSection === 'checklist' && (
        <div className="flex flex-col gap-2">
          <div className="mono text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text3)' }}>
            Competition submission checklist
          </div>

          {/* Progress bar */}
          <div className="h-2 rounded-full overflow-hidden mb-4" style={{ background: 'var(--bg4)' }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{
                width:      `${(completedCount / checklist.length) * 100}%`,
                background: allDone ? 'var(--green)' : 'var(--yellow)',
              }} />
          </div>

          {checklist.map(({ label, done, detail }) => (
            <div key={label} className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: 'var(--bg2)', border: `1px solid ${done ? 'rgba(14,203,129,0.2)' : 'var(--border)'}` }}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                style={{
                  background: done ? 'rgba(14,203,129,0.2)' : 'var(--bg4)',
                  color:      done ? 'var(--green)'          : 'var(--text3)',
                }}>
                {done ? '✓' : '○'}
              </div>
              <div className="flex-1">
                <div className="text-xs font-semibold" style={{ color: done ? 'var(--text)' : 'var(--text3)' }}>
                  {label}
                </div>
                <div className="mono text-[10px]" style={{ color: done ? 'var(--green)' : 'var(--text3)' }}>
                  {detail}
                </div>
              </div>
            </div>
          ))}

          {allDone && (
            <div className="rounded-xl p-4 mt-2 text-center"
              style={{ background: 'rgba(14,203,129,0.08)', border: '1px solid rgba(14,203,129,0.3)' }}>
              <div className="text-2xl mb-2">🏆</div>
              <div className="font-bold" style={{ color: 'var(--green)' }}>Ready to submit!</div>
              <div className="mono text-xs mt-1" style={{ color: 'var(--text2)' }}>
                Generate your submission above, then paste it at dorahacks.io
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
