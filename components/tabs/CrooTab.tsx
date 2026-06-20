'use client'

import React from 'react'

/**
 * components/tabs/CrooTab.tsx
 * CROO Agent Protocol (CAP) Integration Dashboard
 *
 * Sections:
 *  1. Agent Store Listing — status, manifest link, store URL
 *  2. CAP Services — 4 priced services with live test panel
 *  3. A2A Activity — incoming calls, USDC revenue earned
 *  4. DoraHacks Submission — AI-generated writeup for CROO hackathon
 */

import { useState, useEffect, useCallback } from 'react'
import { useAgentStore } from '@/lib/agentStore'
import { BINALYST_SERVICES, AGENT_STORE_URL, type CAPService } from '@/lib/croo/capClient'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtUSD(n: number) {
  return '$' + n.toFixed(4)
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
      style={{ background: color + '22', color }}
    >
      {label}
    </span>
  )
}

const TRACK_COLORS: Record<string, string> = {
  research_intelligence: 'var(--blue)',
  defi_onchain_ops:      'var(--yellow)',
  data_verification:     'var(--purple, #a855f7)',
  open_a2a:              'var(--green)',
}

const TRACK_LABELS: Record<string, string> = {
  research_intelligence: 'Research & Intelligence',
  defi_onchain_ops:      'DeFi / On-chain Ops',
  data_verification:     'Data & Verification',
  open_a2a:              'Open A2A',
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ServiceCard({
  service,
  onTest,
}: {
  service: CAPService
  onTest: (service: CAPService) => void
}) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-bold text-sm" style={{ color: 'var(--text)' }}>{service.name}</div>
          <div className="mono text-[10px] mt-0.5" style={{ color: 'var(--text3)' }}>{service.id}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-extrabold text-base mono" style={{ color: 'var(--green)' }}>
            ${service.priceUSDC} <span className="text-[10px] font-normal">USDC</span>
          </div>
          <div className="text-[10px]" style={{ color: 'var(--text3)' }}>per call</div>
        </div>
      </div>

      <p className="text-xs leading-relaxed" style={{ color: 'var(--text2)' }}>
        {service.description}
      </p>

      <div className="flex items-center justify-between">
        <Badge
          label={TRACK_LABELS[service.track] ?? service.track}
          color={TRACK_COLORS[service.track] ?? 'var(--blue)'}
        />
        <button
          onClick={() => onTest(service)}
          className="text-xs px-3 py-1 rounded-lg font-semibold transition"
          style={{ background: 'var(--blue)', color: '#fff' }}
        >
          Test Call
        </button>
      </div>
    </div>
  )
}

// ── CAP Test Panel ─────────────────────────────────────────────────────────────

function CAPTestPanel({
  service,
  agentAddress,
  onClose,
}: {
  service: CAPService
  agentAddress: string
  onClose: () => void
}) {
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState<any>(null)
  const [params, setParams]     = useState<Record<string, string>>({})

  const inputKeys = Object.keys(service.inputSchema).filter(k => !k.endsWith('?'))

  async function runTest() {
    setLoading(true)
    setResult(null)
    try {
      const parsedParams: Record<string, any> = {}
      for (const [k, v] of Object.entries(params)) {
        try { parsedParams[k] = JSON.parse(v) } catch { parsedParams[k] = v }
      }

      // Fill defaults
      if (service.id === 'market_signal' && !parsedParams.symbol) parsedParams.symbol = 'BTC'
      if (service.id === 'backtest_report') {
        parsedParams.symbols   ??= ['BTC', 'ETH']
        parsedParams.startDate ??= '2024-01-01'
        parsedParams.endDate   ??= '2024-03-31'
        parsedParams.startUSDT ??= 1000
      }
      if (service.id === 'portfolio_scan' && !parsedParams.walletAddress) {
        parsedParams.walletAddress = agentAddress || '0x0000000000000000000000000000000000000000'
      }
      if (service.id === 'trade_execute') {
        parsedParams.symbol    ??= 'BTC'
        parsedParams.action    ??= 'BUY'
        parsedParams.amountUSDT ??= 10
        parsedParams.dryRun    = true
      }

      const capRequest = {
        serviceId:     service.id,
        callerId:      'test-client-' + Date.now(),
        paymentTxHash: 'DEMO',
        paymentChain:  'bsc',
        params:        parsedParams,
        nonce:         crypto.randomUUID(),
        timestamp:     Date.now(),
      }

      const res  = await fetch('/api/cap/invoke', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(capRequest),
      })
      const data = await res.json()
      setResult(data)
    } catch (err: any) {
      setResult({ success: false, error: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ background: 'var(--bg1)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <div className="font-bold" style={{ color: 'var(--text)' }}>{service.name}</div>
            <div className="text-xs mono" style={{ color: 'var(--text3)' }}>CAP Demo Call · DEMO payment (no USDC required)</div>
          </div>
          <button onClick={onClose} className="text-xl" style={{ color: 'var(--text3)' }}>✕</button>
        </div>

        <div className="p-4 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
          {/* Input params */}
          <div>
            <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text2)' }}>Parameters</div>
            <div className="flex flex-col gap-2">
              {Object.entries(service.inputSchema).map(([key, desc]) => (
                <div key={key}>
                  <label className="text-[10px] mono" style={{ color: 'var(--text3)' }}>
                    {key} — {desc}
                  </label>
                  <input
                    type="text"
                    placeholder={key.endsWith('?') ? 'optional' : `enter ${key}`}
                    value={params[key.replace('?', '')] ?? ''}
                    onChange={e => setParams(p => ({ ...p, [key.replace('?', '')]: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-lg mono text-sm"
                    style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* CAP request preview */}
          <div className="rounded-lg p-3 mono text-[10px] leading-relaxed" style={{ background: 'var(--bg2)', color: 'var(--text2)', border: '1px solid var(--border)' }}>
            <div style={{ color: 'var(--text3)' }}>POST /api/cap/invoke</div>
            <div>serviceId: &quot;{service.id}&quot;</div>
            <div>paymentTxHash: &quot;DEMO&quot;</div>
            <div>priceUSDC: ${service.priceUSDC}</div>
            <div>callerId: &quot;test-client&quot;</div>
          </div>

          <button
            onClick={runTest}
            disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-sm transition"
            style={{ background: loading ? 'var(--bg3)' : 'var(--blue)', color: '#fff' }}
          >
            {loading ? 'Calling agent...' : `Send CAP Request · $${service.priceUSDC} USDC`}
          </button>

          {result && (
            <div
              className="rounded-lg p-3 mono text-xs overflow-auto max-h-48"
              style={{
                background: result.success ? 'rgba(14,203,129,0.08)' : 'rgba(246,70,93,0.08)',
                border: `1px solid ${result.success ? 'var(--green)' : 'var(--red)'}`,
                color: 'var(--text)',
              }}
            >
              <div className="font-bold mb-1" style={{ color: result.success ? 'var(--green)' : 'var(--red)' }}>
                {result.success ? '✓ Service responded' : '✗ Error'}
              </div>
              <pre className="whitespace-pre-wrap text-[10px]">
                {JSON.stringify(result.result ?? result.error ?? result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Registration Panel (Session 4) ───────────────────────────────────────────

function RegistrationPanel({ agentAddress }: { agentAddress: string }) {
  const [loading,       setLoading]       = React.useState(false)
  const [status,        setStatus]        = React.useState<'idle'|'checking'|'submitting'|'done'|'error'>('idle')
  const [readiness,     setReadiness]     = React.useState<any>(null)
  const [result,        setResult]        = React.useState<any>(null)
  const [demoUrl,       setDemoUrl]       = React.useState('')
  const [email,         setEmail]         = React.useState('')
  const [listingId,     setListingId]     = React.useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('croo_listing_id') ?? ''
    return ''
  })
  const [listingStatus, setListingStatus] = React.useState<string>('')

  React.useEffect(() => {
    async function check() {
      setStatus('checking')
      try {
        const res  = await fetch('/api/cap/register')
        const data = await res.json()
        setReadiness(data)
      } catch { /* ignore */ } finally {
        setStatus('idle')
      }
    }
    check()
  }, [])

  React.useEffect(() => {
    if (!listingId) return
    async function poll() {
      try {
        const res  = await fetch(`/api/cap/register?listingId=${listingId}`)
        const data = await res.json()
        setListingStatus(data.status ?? 'unknown')
      } catch { /* ignore */ }
    }
    poll()
    const t = setInterval(poll, 30_000)
    return () => clearInterval(t)
  }, [listingId])

  async function handleSubmit() {
    setLoading(true)
    setStatus('submitting')
    setResult(null)
    try {
      const res  = await fetch('/api/cap/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ demoVideoUrl: demoUrl, contactEmail: email }),
      })
      const data = await res.json()
      setResult(data)
      if (data.success && data.listingId) {
        setListingId(data.listingId)
        localStorage.setItem('croo_listing_id', data.listingId)
        setListingStatus('pending')
      }
      setStatus(data.success ? 'done' : 'error')
    } catch (err: any) {
      setResult({ success: false, error: err.message })
      setStatus('error')
    } finally {
      setLoading(false)
    }
  }

  const statusColor: Record<string, string> = {
    active:   'var(--green)',
    verified: 'var(--green)',
    pending:  'var(--yellow)',
    rejected: 'var(--red)',
    error:    'var(--red)',
    unknown:  'var(--text3)',
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Pre-flight checklist */}
      <div className="rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
        <div className="font-bold text-sm mb-3" style={{ color: 'var(--text)' }}>Pre-flight Checklist</div>
        {status === 'checking' && (
          <div className="text-xs" style={{ color: 'var(--text3)' }}>Checking configuration…</div>
        )}
        {readiness && (
          <div className="flex flex-col gap-2">
            {[
              { label: 'Agent wallet set',    ok: readiness.agentWallet !== 'not set', val: readiness.agentWallet },
              { label: 'App URL (HTTPS)',      ok: readiness.appUrl !== 'not set',      val: readiness.appUrl },
              { label: 'CAP services loaded', ok: (readiness.servicesCount ?? 0) > 0,  val: `${readiness.servicesCount ?? 0} services` },
              { label: 'Multi-chain ready',   ok: (readiness.chainsCount ?? 0) > 0,    val: `${readiness.chainsCount ?? 0} chains` },
            ].map(({ label, ok, val }) => (
              <div key={label} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span style={{ color: ok ? 'var(--green)' : 'var(--red)' }}>{ok ? '✓' : '✗'}</span>
                  <span style={{ color: 'var(--text2)' }}>{label}</span>
                </div>
                <span className="mono" style={{ color: ok ? 'var(--text)' : 'var(--red)' }}>{val}</span>
              </div>
            ))}
            {(readiness.validationErrors ?? []).length > 0 && (
              <div className="rounded-lg p-3 mt-1" style={{ background: 'rgba(246,70,93,0.08)', border: '1px solid var(--red)' }}>
                {readiness.validationErrors.map((e: string) => (
                  <div key={e} className="text-xs" style={{ color: 'var(--red)' }}>• {e}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Already listed banner */}
      {listingId && (
        <div className="rounded-xl p-4" style={{ background: 'rgba(14,203,129,0.08)', border: '1px solid var(--green)' }}>
          <div className="font-bold text-sm mb-2" style={{ color: 'var(--green)' }}>✓ Listing Submitted</div>
          <div className="flex flex-col gap-1 text-xs">
            <div className="flex justify-between">
              <span style={{ color: 'var(--text3)' }}>Listing ID</span>
              <span className="mono" style={{ color: 'var(--text)' }}>{listingId.slice(0, 28)}…</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text3)' }}>Status</span>
              <span className="font-bold" style={{ color: statusColor[listingStatus] ?? 'var(--text3)' }}>
                {listingStatus || 'polling…'}
              </span>
            </div>
          </div>
          <a
            href={result?.storeUrl ?? 'https://agent.croo.network/agents/binalyst-trading-agent'}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-xs mt-3 py-2 rounded-lg font-semibold"
            style={{ background: 'var(--green)', color: '#000' }}
          >
            View on Agent Store ↗
          </a>
        </div>
      )}

      {/* Submission form */}
      <div className="rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
        <div className="font-bold text-sm mb-3" style={{ color: 'var(--text)' }}>
          {listingId ? 'Re-submit / Update Listing' : 'Submit to CROO Agent Store'}
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[10px] mono mb-1 block" style={{ color: 'var(--text3)' }}>
              Demo Video URL (optional — YouTube / Loom, max 5 min)
            </label>
            <input
              type="url"
              placeholder="https://youtube.com/watch?v=..."
              value={demoUrl}
              onChange={e => setDemoUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--bg1)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>
          <div>
            <label className="text-[10px] mono mb-1 block" style={{ color: 'var(--text3)' }}>
              Contact Email (optional)
            </label>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--bg1)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full mt-4 py-3 rounded-xl font-bold text-sm transition"
          style={{
            background: loading ? 'var(--bg3)' : 'var(--yellow)',
            color:      loading ? 'var(--text3)' : '#000',
          }}
        >
          {loading
            ? status === 'checking' ? 'Checking…' : 'Submitting…'
            : listingId ? '↺ Re-submit Listing' : '🚀 List on CROO Agent Store'}
        </button>

        {result && (
          <div
            className="mt-3 rounded-lg p-3 text-xs"
            style={{
              background: result.success ? 'rgba(14,203,129,0.08)' : 'rgba(246,70,93,0.08)',
              border:     `1px solid ${result.success ? 'var(--green)' : 'var(--red)'}`,
              color:      'var(--text2)',
            }}
          >
            <div className="font-bold mb-1" style={{ color: result.success ? 'var(--green)' : 'var(--red)' }}>
              {result.success ? '✓ Submitted' : '✗ Failed'}
            </div>
            {result.warning  && <div style={{ color: 'var(--yellow)' }}>⚠ {result.warning}</div>}
            {!result.success && result.error && <div style={{ color: 'var(--red)' }}>{result.error}</div>}
            {result.listingId && <div className="mt-1 mono" style={{ color: 'var(--text3)' }}>ID: {result.listingId}</div>}
            {(result.validationErrors ?? []).map((e: string) => (
              <div key={e} style={{ color: 'var(--red)' }}>• {e}</div>
            ))}
          </div>
        )}
      </div>

      {/* What happens next */}
      <div className="rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
        <div className="font-bold text-sm mb-2" style={{ color: 'var(--text)' }}>What happens next</div>
        <div className="flex flex-col gap-1.5">
          {[
            ['Pending',  'var(--yellow)', 'CROO reviews manifest + tests CAP endpoint'],
            ['Active',   'var(--blue)',   'Binalyst is live and discoverable by agents'],
            ['Verified', 'var(--green)',  'CROO confirmed CAP calls work end-to-end'],
          ].map(([s, c, desc]) => (
            <div key={s} className="flex gap-3 text-xs">
              <span className="w-16 shrink-0 font-bold" style={{ color: c }}>{s}</span>
              <span style={{ color: 'var(--text2)' }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Submission Panel ──────────────────────────────────────────────────────────

function SubmissionPanel({
  agentAddress,
  strategyText,
  trades,
  session,
}: {
  agentAddress: string
  strategyText: string
  trades:       any[]
  session:      any
}) {
  const [loading, setLoading]         = useState(false)
  const [submission, setSubmission]   = useState('')
  const [copied, setCopied]           = useState(false)

  async function generate() {
    setLoading(true)
    setSubmission('')
    try {
      const res = await fetch('/api/cap/submission', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          agentAddress,
          strategyText,
          trades,
          session,
          capCalls:         0,
          capRevenue:       '0.00',
          registeredOnStore: false,
        }),
      })
      const data = await res.json()
      if (data.success) setSubmission(data.submission)
      else setSubmission('Error: ' + data.error)
    } catch (err: any) {
      setSubmission('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(submission)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-bold text-sm" style={{ color: 'var(--text)' }}>DoraHacks Submission</div>
            <div className="text-xs" style={{ color: 'var(--text3)' }}>AI-generated CROO hackathon writeup</div>
          </div>
          <Badge label="CROO Hackathon" color="var(--yellow)" />
        </div>

        <div className="flex flex-col gap-2">
          {[
            ['Prize Pool', '~$10,200 USDC cash'],
            ['Tracks', 'DeFi/On-chain Ops + Research & Intelligence'],
            ['Deadline', 'See CROO Discord for current dates'],
            ['Venue', 'dorahacks.io / CROO Hackathon'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between text-xs">
              <span style={{ color: 'var(--text3)' }}>{k}</span>
              <span style={{ color: 'var(--text)' }}>{v}</span>
            </div>
          ))}
        </div>

        <button
          onClick={generate}
          disabled={loading}
          className="w-full mt-4 py-3 rounded-xl font-bold text-sm transition"
          style={{ background: loading ? 'var(--bg3)' : 'var(--yellow)', color: loading ? 'var(--text3)' : '#000' }}
        >
          {loading ? 'Generating with Claude...' : '⚡ Generate Submission'}
        </button>
      </div>

      {submission && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between px-4 py-2" style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
            <div className="text-xs font-semibold" style={{ color: 'var(--text2)' }}>Submission Draft</div>
            <button
              onClick={copyToClipboard}
              className="text-xs px-3 py-1 rounded-lg font-semibold transition"
              style={{ background: 'var(--green)', color: '#000' }}
            >
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
          <div
            className="p-4 max-h-96 overflow-y-auto text-xs leading-relaxed whitespace-pre-wrap"
            style={{ background: 'var(--bg1)', color: 'var(--text2)', fontFamily: 'monospace' }}
          >
            {submission}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Tab ──────────────────────────────────────────────────────────────────

export default function CrooTab() {
  const { agentAddress, strategyText, trades, session } = useAgentStore()

  const [activeSection, setActiveSection]     = useState<'overview' | 'services' | 'a2a' | 'submission'>('overview')
  const [testService, setTestService]         = useState<CAPService | null>(null)
  const [manifestData, setManifestData]       = useState<any>(null)
  const [statusData, setStatusData]           = useState<any>(null)
  const [loadingManifest, setLoadingManifest] = useState(false)

  const loadManifest = useCallback(async () => {
    setLoadingManifest(true)
    try {
      const [mRes, sRes] = await Promise.all([
        fetch('/api/cap/manifest'),
        fetch('/api/cap/status'),
      ])
      setManifestData(await mRes.json())
      setStatusData(await sRes.json())
    } catch { /* ignore */ } finally {
      setLoadingManifest(false)
    }
  }, [])

  useEffect(() => {
    loadManifest()
  }, [loadManifest])

  const sections = [
    { id: 'overview',    label: 'Overview'    },
    { id: 'services',    label: 'Services'    },
    { id: 'a2a',         label: 'A2A Live'    },
    { id: 'submission',  label: 'Submission'  },
    { id: 'register',    label: 'Register'    },
  ] as const

  return (
    <div className="flex flex-col gap-6 pb-24">

      {/* Header */}
      <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(135deg, #f59e0b22 0%, #3b82f622 100%)', border: '1px solid var(--border)' }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">🤖</span>
              <span className="font-extrabold text-lg" style={{ color: 'var(--text)' }}>CROO Agent Protocol</span>
              <Badge label="CAP v1.0" color="var(--yellow)" />
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text2)' }}>
              Binalyst is CAP-enabled — any AI agent can hire it for trading signals, backtests, or live execution. Every service is priced in USDC, settled on-chain.
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[10px] uppercase mono mb-1" style={{ color: 'var(--text3)' }}>Status</div>
            <div className="flex items-center gap-1 justify-end">
              <span className="w-2 h-2 rounded-full" style={{ background: statusData ? 'var(--green)' : 'var(--text3)' }} />
              <span className="text-xs font-bold" style={{ color: statusData ? 'var(--green)' : 'var(--text3)' }}>
                {statusData ? 'Online' : 'Loading…'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[
            { label: 'Services',  value: BINALYST_SERVICES.length.toString() },
            { label: 'Tracks',    value: '3' },
            { label: 'Chains',    value: '4' },
            { label: 'CAP Calls', value: statusData?.aggregate?.totalCalls?.toString() ?? '0' },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg p-3 text-center" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <div className="font-extrabold text-lg mono" style={{ color: 'var(--text)' }}>{value}</div>
              <div className="text-[10px] uppercase" style={{ color: 'var(--text3)' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-2 overflow-x-auto">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className="px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition"
            style={{
              background: activeSection === s.id ? 'var(--blue)' : 'var(--bg2)',
              color:      activeSection === s.id ? '#fff'        : 'var(--text2)',
              border:     '1px solid var(--border)',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {activeSection === 'overview' && (
        <div className="flex flex-col gap-4">
          {/* CAP Manifest */}
          <div className="rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div className="font-bold text-sm mb-3" style={{ color: 'var(--text)' }}>Agent Manifest</div>
            {loadingManifest && (
              <div className="text-xs" style={{ color: 'var(--text3)' }}>Loading manifest…</div>
            )}
            {manifestData && (
              <div className="flex flex-col gap-1.5">
                {[
                  ['Agent ID',   manifestData.agentId],
                  ['Version',    manifestData.version],
                  ['CAP',        manifestData.capVersion],
                  ['Endpoint',   '/api/cap/invoke'],
                  ['Discovery',  '/.well-known/cap-agent.json'],
                  ['Chains',     (manifestData.chains ?? []).join(', ')],
                  ['License',    manifestData.license],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span style={{ color: 'var(--text3)' }}>{k}</span>
                    <span className="mono truncate max-w-[180px]" style={{ color: 'var(--text)' }}>{v}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 mt-3">
              <a
                href="/api/cap/manifest"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center text-xs py-2 rounded-lg font-semibold"
                style={{ background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)' }}
              >
                View Manifest JSON
              </a>
              <a
                href={`${AGENT_STORE_URL}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center text-xs py-2 rounded-lg font-semibold"
                style={{ background: 'var(--yellow)', color: '#000' }}
              >
                Open Agent Store ↗
              </a>
            </div>
          </div>

          {/* Tracks */}
          <div className="rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div className="font-bold text-sm mb-3" style={{ color: 'var(--text)' }}>Hackathon Tracks</div>
            <div className="flex flex-col gap-2">
              {[
                { track: 'research_intelligence', desc: 'market_signal + backtest_report — paid AI research with verifiable on-chain receipts.' },
                { track: 'defi_onchain_ops',      desc: 'trade_execute — autonomous on-chain swaps on BSC with AI guardrails via CAP.' },
                { track: 'open_a2a',              desc: 'Any agent can hire Binalyst as a dependency, composing signals into larger workflows.' },
              ].map(({ track, desc }) => (
                <div key={track} className="rounded-lg p-3" style={{ background: 'var(--bg1)', border: '1px solid var(--border)' }}>
                  <Badge label={TRACK_LABELS[track]} color={TRACK_COLORS[track]} />
                  <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--text2)' }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CAP flow diagram */}
          <div className="rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div className="font-bold text-sm mb-3" style={{ color: 'var(--text)' }}>How A2A Calls Work</div>
            <div className="flex flex-col gap-1 mono text-xs" style={{ color: 'var(--text2)' }}>
              {[
                ['1', 'Caller agent discovers Binalyst via /.well-known/cap-agent.json'],
                ['2', 'Caller sends USDC to Binalyst wallet on BSC'],
                ['3', 'Caller posts CAPRequest to /api/cap/invoke with paymentTxHash'],
                ['4', 'Binalyst verifies payment on-chain via BSCScan'],
                ['5', 'Service executes (signal, backtest, portfolio, or trade)'],
                ['6', 'CAPResponse returned with result + settlementRef'],
              ].map(([n, step]) => (
                <div key={n} className="flex gap-3 items-start">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5" style={{ background: 'var(--blue)', color: '#fff' }}>{n}</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Services ── */}
      {activeSection === 'services' && (
        <div className="flex flex-col gap-3">
          <div className="text-xs" style={{ color: 'var(--text3)' }}>
            Click &quot;Test Call&quot; to send a live CAP request using DEMO payment mode (no USDC required).
          </div>
          {BINALYST_SERVICES.map(s => (
            <ServiceCard key={s.id} service={s} onTest={setTestService} />
          ))}

          {/* Input/Output schemas */}
          <div className="rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div className="font-bold text-sm mb-3" style={{ color: 'var(--text)' }}>Example CAP Request</div>
            <pre className="text-[10px] leading-relaxed overflow-auto mono" style={{ color: 'var(--text2)' }}>
{`POST /api/cap/invoke
Content-Type: application/json

{
  "serviceId": "market_signal",
  "callerId": "your-agent-wallet",
  "paymentTxHash": "0xabc...def",
  "paymentChain": "bsc",
  "params": {
    "symbol": "BTC",
    "interval": "1h"
  },
  "nonce": "uuid-v4",
  "timestamp": 1718000000000
}`}
            </pre>
          </div>
        </div>
      )}

      {/* ── A2A Activity ── */}
      {activeSection === 'a2a' && (
        <div className="flex flex-col gap-4">
          {/* Revenue */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Total CAP Calls',   value: statusData?.aggregate?.totalCalls ?? 0,                           unit: '' },
              { label: 'USDC Earned',       value: statusData?.aggregate?.totalRevenueUSDC ?? '0.0000',              unit: '$' },
            ].map(({ label, value, unit }) => (
              <div key={label} className="rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                <div className="text-[10px] uppercase mono mb-1" style={{ color: 'var(--text3)' }}>{label}</div>
                <div className="font-extrabold text-xl mono" style={{ color: 'var(--green)' }}>{unit}{value}</div>
              </div>
            ))}
          </div>

          {/* Per-service breakdown */}
          <div className="rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div className="font-bold text-sm mb-3" style={{ color: 'var(--text)' }}>Service Breakdown</div>
            <div className="flex flex-col gap-2">
              {(statusData?.services ?? BINALYST_SERVICES.map(s => ({ ...s, calls: 0, revenue: 0 }))).map((s: any) => (
                <div key={s.id} className="flex items-center justify-between text-xs py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div className="font-semibold" style={{ color: 'var(--text)' }}>{s.name ?? s.id}</div>
                    <Badge label={TRACK_LABELS[s.track] ?? s.track} color={TRACK_COLORS[s.track] ?? 'var(--blue)'} />
                  </div>
                  <div className="text-right">
                    <div className="mono" style={{ color: 'var(--text)' }}>{s.calls ?? 0} calls</div>
                    <div className="mono" style={{ color: 'var(--green)' }}>${(s.revenue ?? 0).toFixed(4)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* A2A guide */}
          <div className="rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div className="font-bold text-sm mb-2" style={{ color: 'var(--text)' }}>List on CROO Agent Store</div>
            <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text2)' }}>
              To complete CROO Agent Store listing, go to agent.croo.network and register Binalyst using the manifest endpoint below. Your agent will be discoverable by other agents and users worldwide.
            </p>
            <div className="mono text-[11px] p-3 rounded-lg" style={{ background: 'var(--bg1)', color: 'var(--text2)', border: '1px solid var(--border)' }}>
              {typeof window !== 'undefined' ? window.location.origin : 'https://your-app.vercel.app'}/api/cap/manifest
            </div>
            <a
              href="https://agent.croo.network"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center mt-3 py-3 rounded-xl font-bold text-sm"
              style={{ background: 'var(--yellow)', color: '#000' }}
            >
              Go to CROO Agent Store ↗
            </a>
          </div>
        </div>
      )}

      {/* ── Submission ── */}
      {activeSection === 'submission' && (
        <SubmissionPanel
          agentAddress={agentAddress}
          strategyText={strategyText ?? ''}
          trades={trades ?? []}
          session={session}
        />
      )}

      {/* ── Register (Session 4) ── */}
      {activeSection === 'register' && (
        <RegistrationPanel agentAddress={agentAddress} />
      )}

      {/* Test panel modal */}
      {testService && (
        <CAPTestPanel
          service={testService}
          agentAddress={agentAddress}
          onClose={() => setTestService(null)}
        />
      )}
    </div>
  )
}
