'use client'

/**
 * components/tabs/MantleSubmissionTab.tsx — Session N4 · POLISHED
 *
 * FIXES applied:
 *  Bug #2 — Removed `benchmarkSinkUrl` from `'@/lib/mantle/config'` import
 *            (it's not exported there). `getSinkUrl` from benchmark is the
 *            only import now. Removed duplicate import.
 *  Bug #4 — Removed unused `fmtUSD` import (only `fmtPct` is used).
 *
 * All other logic is unchanged from Session N4.
 */

import { useState }               from 'react'
import { useMantleAgentStore }    from '@/lib/mantleAgentStore'
import { useMantleAgentLoop }     from '@/hooks/useMantleAgentLoop'
import { ByrealSkillHub }         from '@/lib/skills/byreal'
import { fmtPct }                 from '@/lib/mantleAgentLoop'        // ← FIXED: removed fmtUSD (unused)
import { EIGHT004SCAN_MANTLE_URL } from '@/lib/mantle/config'          // ← FIXED: removed benchmarkSinkUrl (not exported here)
import { benchmarkSinkUrl }       from '@/lib/mantle/benchmark'        // ← FIXED: single source, no duplicate alias

// ─────────────────────────────────────────────────────────────────────────────
// Checklist item
// ─────────────────────────────────────────────────────────────────────────────

function CheckItem({
  label, done, detail,
}: { label: string; done: boolean; detail?: string }) {
  return (
    <div className="flex items-start gap-3 py-2"
      style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="mono text-sm shrink-0" style={{ color: done ? 'var(--green)' : 'var(--text3)' }}>
        {done ? '✓' : '○'}
      </span>
      <div>
        <div className="mono text-xs" style={{ color: done ? 'var(--text)' : 'var(--text3)' }}>{label}</div>
        {detail && (
          <div className="mono text-[10px] mt-0.5" style={{ color: 'var(--text3)' }}>{detail}</div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main tab
// ─────────────────────────────────────────────────────────────────────────────

export default function MantleSubmissionTab() {
  const {
    agentAddress, network, agentId, registrationTxHash,
    agentConfig, benchmarks,
  } = useMantleAgentStore()

  const {
    portfolioUSD, startUSD, pnlPct, totalTrades, benchmarkCount,
    trades, session,
  } = useMantleAgentLoop()

  const [generating,    setGenerating]    = useState(false)
  const [submission,    setSubmission]    = useState('')
  const [error,         setError]         = useState('')
  const [copied,        setCopied]        = useState<string>('')
  const [activeSection, setActiveSection] = useState<'generate' | 'skills' | 'checklist'>('checklist')

  // ── Checklist ─────────────────────────────────────────────────────────────

  const checklist = [
    {
      label:  'Agent wallet created',
      done:   !!agentAddress,
      detail: agentAddress ? `${agentAddress.slice(0, 14)}…` : 'Go to Mantle Agent tab → Set up wallet',
    },
    {
      label:  'Mantle network configured',
      done:   true,
      detail: 'lib/mantle/config.ts — chainId 5000 (mainnet) / 5003 (testnet)',
    },
    {
      label:  'Bybit market data integrated',
      done:   true,
      detail: 'lib/bybit.ts — V5 REST: tickers, candles, order book, signal scoring',
    },
    {
      label:  'Agent loop running',
      done:   totalTrades > 0,
      detail: totalTrades > 0 ? `${totalTrades} total decisions` : 'Start the agent on the Mantle Agent tab',
    },
    {
      label:  'On-chain benchmarking (Feature #1)',
      done:   benchmarkCount > 0 || benchmarks.length > 0,
      detail: benchmarkCount > 0
        ? `${benchmarkCount} decisions written to Mantle — ${benchmarkSinkUrl(network)}`
        : 'Run agent in live mode to write on-chain records',
    },
    {
      label:  'ERC-8004 agent identity (Feature #2)',
      done:   !!agentId,
      detail: agentId
        ? `Agent #${agentId} · tx: ${registrationTxHash?.slice(0, 14) ?? 'n/a'}`
        : 'Register on Mantle Agent tab → requires Mainnet + MNT gas',
    },
    {
      label:  'Byreal Skills registered (Agentic Wallets)',
      done:   true,
      detail: `${ByrealSkillHub.skills.length} skills: ${ByrealSkillHub.skills.map(s => s.name).join(', ')}`,
    },
    {
      label:  'RWA tokens configured (mETH + USDY)',
      done:   true,
      detail: 'mETH: 0xcDA86…B90bb0 · USDY: 0x5bE265…957c5A6',
    },
  ]

  const doneCount = checklist.filter(c => c.done).length
  const readyPct  = Math.round((doneCount / checklist.length) * 100)

  // ── Generate submission ───────────────────────────────────────────────────

  async function handleGenerate() {
    setGenerating(true); setError(''); setSubmission('')
    try {
      const res = await fetch('/api/mantle-agent/submission', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentAddress,
          network,
          agentId,
          registrationTxHash,
          totalTrades,
          benchmarkCount,
          portfolioUSD,
          startUSD,
          pnlPct,
          trades:     trades.slice(0, 10),
          session,
          agentConfig,
        }),
      })
      const data = await res.json()
      if (!data.success) { setError(data.error ?? 'Generation failed'); return }
      setSubmission(data.submission)
      setActiveSection('generate')
    } catch (e: any) {
      setError(e.message)
    }
    setGenerating(false)
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(''), 2000)
  }

  function downloadManifest() {
    const manifest = JSON.stringify(ByrealSkillHub.manifest(), null, 2)
    const blob     = new Blob([manifest], { type: 'application/json' })
    const url      = URL.createObjectURL(blob)
    const a        = document.createElement('a')
    a.href         = url
    a.download     = 'binalyst-mantle-byreal-manifest.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const tabs = [
    { id: 'checklist' as const, label: `Checklist (${doneCount}/${checklist.length})` },
    { id: 'generate'  as const, label: 'Submission' },
    { id: 'skills'    as const, label: 'Byreal Skills' },
  ]

  // ════════════════════════════════════════════════════════════════════════════
  // Render
  // ════════════════════════════════════════════════════════════════════════════

  return (
    <div className="max-w-3xl mx-auto px-6 py-6 flex flex-col gap-6">

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🏆</span>
          <h2 className="text-lg font-extrabold" style={{ color: 'var(--text)' }}>
            Turing Test Hackathon Submission
          </h2>
        </div>
        <p className="mono text-xs" style={{ color: 'var(--text3)' }}>
          AI Trading &amp; Strategy · Agentic Wallets &amp; Economy · $100,000 prize pool · Mantle Network
        </p>
      </div>

      {/* Readiness bar */}
      <div className="rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
            Submission readiness
          </span>
          <span className="mono text-sm font-bold"
            style={{ color: readyPct === 100 ? 'var(--green)' : '#61DAFB' }}>
            {readyPct}%
          </span>
        </div>
        <div className="rounded-full overflow-hidden h-2" style={{ background: 'var(--bg3)' }}>
          <div className="h-full rounded-full transition-all"
            style={{ width: `${readyPct}%`, background: readyPct === 100 ? 'var(--green)' : '#61DAFB' }} />
        </div>
        <div className="mono text-[10px] mt-2" style={{ color: 'var(--text3)' }}>
          {doneCount}/{checklist.length} criteria met
        </div>
      </div>

      {/* Stats row */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { label: 'Total trades', value: totalTrades },
          { label: 'Benchmarks',   value: benchmarkCount },
          { label: 'PnL',          value: fmtPct(pnlPct), color: pnlPct >= 0 ? 'var(--green)' : 'var(--red)' },
          { label: 'ERC-8004 ID',  value: agentId ? `#${agentId}` : '—' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-3"
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div className="mono text-[9px] uppercase tracking-widest mb-1" style={{ color: 'var(--text3)' }}>
              {s.label}
            </div>
            <div className="mono text-base font-bold"
              style={{ color: (s as any).color ?? 'var(--text)' }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Tab nav + generate button */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveSection(t.id)}
            className="mono text-xs px-4 py-2 rounded-full"
            style={{
              background: activeSection === t.id ? '#61DAFB' : 'var(--bg2)',
              color:      activeSection === t.id ? '#000'    : 'var(--text2)',
              border:     '1px solid var(--border)',
            }}>
            {t.label}
          </button>
        ))}
        <button onClick={handleGenerate} disabled={generating}
          className="mono text-xs font-bold px-4 py-2 rounded-full ml-auto"
          style={{ background: 'var(--green)', color: '#000' }}>
          {generating ? 'Generating…' : '✦ Generate Submission'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg p-3 mono text-xs"
          style={{ background: 'rgba(246,70,93,0.08)', border: '1px solid rgba(246,70,93,0.2)', color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {/* Checklist */}
      {activeSection === 'checklist' && (
        <div className="rounded-xl p-4"
          style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <div className="mono text-[10px] uppercase tracking-widest mb-3" style={{ color: 'var(--text3)' }}>
            Submission checklist
          </div>
          {checklist.map((item, i) => <CheckItem key={i} {...item} />)}
          {readyPct === 100 && (
            <div className="mt-4 rounded-lg p-3 mono text-xs text-center"
              style={{ background: 'rgba(14,203,129,0.08)', border: '1px solid rgba(14,203,129,0.2)', color: 'var(--green)' }}>
              ✓ All criteria met — click Generate Submission above
            </div>
          )}
        </div>
      )}

      {/* Submission writeup */}
      {activeSection === 'generate' && (
        <div className="rounded-xl p-4 flex flex-col gap-3"
          style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between">
            <div className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
              AI-generated submission
            </div>
            {submission && (
              <button onClick={() => copy(submission, 'submission')}
                className="mono text-[10px] px-3 py-1 rounded"
                style={{ background: 'var(--bg3)', color: 'var(--text2)' }}>
                {copied === 'submission' ? 'Copied!' : 'Copy markdown'}
              </button>
            )}
          </div>
          {!submission && !generating && (
            <div className="mono text-xs" style={{ color: 'var(--text3)' }}>
              Click "Generate Submission" above to create a judge-ready writeup based on your agent's live data.
            </div>
          )}
          {generating && (
            <div className="mono text-xs animate-pulse" style={{ color: '#61DAFB' }}>
              Generating with Claude…
            </div>
          )}
          {submission && (
            <pre className="mono text-[11px] whitespace-pre-wrap leading-relaxed overflow-auto"
              style={{ color: 'var(--text)', maxHeight: '600px' }}>
              {submission}
            </pre>
          )}
        </div>
      )}

      {/* Byreal skills */}
      {activeSection === 'skills' && (
        <div className="rounded-xl p-4 flex flex-col gap-4"
          style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between">
            <div className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
              Byreal Skills — Agentic Wallets &amp; Economy track
            </div>
            <button onClick={downloadManifest}
              className="mono text-[10px] px-3 py-1.5 rounded-lg"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
              Download manifest.json
            </button>
          </div>

          <div className="mono text-[10px] p-3 rounded-lg"
            style={{ background: 'rgba(97,218,251,0.05)', border: '1px solid rgba(97,218,251,0.15)', color: 'var(--text2)' }}>
            Register:&nbsp;
            <code style={{ color: '#61DAFB' }}>
              {`byreal skills register --url ${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/skills/byreal`}
            </code>
          </div>

          {ByrealSkillHub.skills.map(skill => (
            <div key={skill.name} className="rounded-lg p-4"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-2">
                <code className="mono text-xs font-bold" style={{ color: '#61DAFB' }}>{skill.name}</code>
                <span className="mono text-[9px] px-2 py-0.5 rounded"
                  style={{ background: 'rgba(97,218,251,0.1)', color: '#61DAFB' }}>
                  v{skill.version}
                </span>
              </div>
              <div className="mono text-[10px] mb-2" style={{ color: 'var(--text2)' }}>
                {skill.description}
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {skill.tags.map(tag => (
                  <span key={tag} className="mono text-[9px] px-1.5 py-0.5 rounded"
                    style={{ background: 'var(--bg2)', color: 'var(--text3)' }}>
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mono text-[9px]" style={{ color: 'var(--text3)' }}>
                Inputs: {skill.input.map(p => `${p.name}${p.required ? '*' : ''}`).join(', ')}
              </div>
            </div>
          ))}

          <div className="rounded-lg p-3 mono text-[10px]"
            style={{ background: 'var(--bg3)', color: 'var(--text3)' }}>
            <div className="mb-1 font-bold" style={{ color: 'var(--text2)' }}>Test via curl:</div>
            <code style={{ color: '#61DAFB' }}>
              {`curl -X POST /api/skills/byreal -H "Content-Type: application/json" -d '{"skill":"mantle_signal_score","input":{"symbol":"MNTUSDT"}}'`}
            </code>
          </div>
        </div>
      )}

      {/* Hackathon links */}
      <div className="rounded-xl p-4 flex flex-col gap-2"
        style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
        <div className="mono text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text3)' }}>
          Hackathon links
        </div>
        {[
          { label: 'Submit on DoraHacks',  url: 'https://dorahacks.io/hackathon/mantleturingtesthackathon2026/detail' },
          { label: 'Mantle Network',       url: 'https://www.mantle.xyz' },
          { label: 'Mantle Explorer',      url: 'https://explorer.mantle.xyz' },
          { label: '8004scan (ERC-8004)',  url: agentId ? EIGHT004SCAN_MANTLE_URL(agentId) : 'https://8004scan.io' },
          { label: 'Benchmark sink',       url: benchmarkSinkUrl(network) },
          { label: 'Byreal Skills',        url: 'https://skills.byreal.ai' },
        ].map(link => (
          <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between mono text-xs py-1.5 px-2 rounded hover:opacity-80 transition-opacity"
            style={{ color: '#61DAFB', borderBottom: '1px solid var(--border)' }}>
            <span>{link.label}</span>
            <span style={{ color: 'var(--text3)' }}>↗</span>
          </a>
        ))}
      </div>
    </div>
  )
}
