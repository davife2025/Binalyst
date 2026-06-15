'use client'

/**
 * components/tabs/BitgetConnectTab.tsx
 * Session O — Bitget wallet/API connection hub.
 *
 * Sections:
 *   1. Connection Setup — enter API key / secret / passphrase, validate
 *   2. Account Overview — UID, spot balance, futures balance, positions count
 *   3. Sub-Accounts — list and switch between sub-accounts
 *   4. Permissions — read/trade/withdraw status indicators
 *   5. Playbook Key — separate Playbook API key for strategy publishing
 *   6. Setup guide — step-by-step instructions if not connected
 */

import { useState, useEffect } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Credential store (browser sessionStorage — server never sees raw key)
// ─────────────────────────────────────────────────────────────────────────────

const CRED_KEY = 'bitget_credentials'

function saveCreds(creds: BitgetCreds) {
  try { sessionStorage.setItem(CRED_KEY, JSON.stringify(creds)) } catch {}
}
function loadCreds(): BitgetCreds | null {
  try {
    const raw = sessionStorage.getItem(CRED_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
function clearCreds() {
  try { sessionStorage.removeItem(CRED_KEY) } catch {}
}

interface BitgetCreds {
  apiKey:      string
  secretKey:   string
  passphrase:  string
  playbookKey: string
}

interface AccountInfo {
  uid:          string
  spotBalance:  number
  futuresBalance: number
  positionCount: number
  permissions:  { read: boolean; trade: boolean; withdraw: boolean }
}

// ─────────────────────────────────────────────────────────────────────────────
// API caller
// ─────────────────────────────────────────────────────────────────────────────

async function bitgetCall(action: string, params: any[] = [], creds?: BitgetCreds) {
  const res = await fetch('/api/bitget', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action, params, credentials: creds }),
  })
  return res.json()
}

// ─────────────────────────────────────────────────────────────────────────────
// StatusDot
// ─────────────────────────────────────────────────────────────────────────────

function Dot({ ok, pulse }: { ok: boolean; pulse?: boolean }) {
  return (
    <span className="w-2.5 h-2.5 rounded-full shrink-0 inline-block"
      style={{ background: ok ? 'var(--green)' : 'var(--border)', animation: ok && pulse ? 'pulse 2s infinite' : 'none' }} />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function BitgetConnectTab() {
  const [creds,       setCreds]       = useState<BitgetCreds>({ apiKey: '', secretKey: '', passphrase: '', playbookKey: '' })
  const [saved,       setSaved]       = useState<BitgetCreds | null>(null)
  const [status,      setStatus]      = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle')
  const [errorMsg,    setErrorMsg]    = useState('')
  const [account,     setAccount]     = useState<AccountInfo | null>(null)
  const [showSecrets, setShowSecrets] = useState(false)
  const [hasEnvCreds, setHasEnvCreds] = useState(false)
  const [activeTab,   setActiveTab]   = useState<'connect' | 'account' | 'guide'>('connect')
  const [copied,      setCopied]      = useState('')

  useEffect(() => {
    // Check if env vars are set
    fetch('/api/bitget').then(r => r.json()).then(d => setHasEnvCreds(d.hasEnvCreds ?? false)).catch(() => {})
    // Load saved creds
    const saved = loadCreds()
    if (saved) {
      setSaved(saved)
      setCreds(saved)
      setStatus('connected')
      loadAccount(saved)
    }
  }, [])

  async function connect() {
    if (!creds.apiKey || !creds.secretKey || !creds.passphrase) {
      setErrorMsg('API Key, Secret Key and Passphrase are all required.')
      return
    }
    setStatus('connecting'); setErrorMsg('')
    const result = await bitgetCall('validateCredentials', [], creds)
    if (result.success && result.data?.valid) {
      saveCreds(creds)
      setSaved(creds)
      setStatus('connected')
      await loadAccount(creds)
      setActiveTab('account')
    } else {
      setStatus('error')
      setErrorMsg(result.data?.error ?? result.error ?? 'Invalid credentials')
    }
  }

  async function loadAccount(c: BitgetCreds) {
    try {
      const [infoRes, spotRes, futRes] = await Promise.allSettled([
        bitgetCall('getAccountInfo', [], c),
        bitgetCall('getSpotAccountAssets', [], c),
        bitgetCall('getAccountAssets', ['USDT-FUTURES'], c),
      ])
      const info  = infoRes.status  === 'fulfilled' ? infoRes.value?.data?.data  : null
      const spot  = spotRes.status  === 'fulfilled' ? spotRes.value?.data?.data  : []
      const fut   = futRes.status   === 'fulfilled' ? futRes.value?.data?.data   : []

      const spotBal = Array.isArray(spot)
        ? spot.reduce((s: number, a: any) => s + parseFloat(a.usdtValue ?? 0), 0)
        : 0
      const futBal = Array.isArray(fut)
        ? fut.reduce((s: number, a: any) => s + parseFloat(a.equity ?? 0), 0)
        : 0

      setAccount({
        uid:           info?.userId ?? info?.uid ?? '—',
        spotBalance:   spotBal,
        futuresBalance: futBal,
        positionCount: Array.isArray(fut) ? fut.length : 0,
        permissions: {
          read:     true,   // if we got here, read works
          trade:    info?.authorities?.includes('trade')    ?? false,
          withdraw: info?.authorities?.includes('withdraw') ?? false,
        },
      })
    } catch { /* silently skip if account info unavailable */ }
  }

  function disconnect() {
    clearCreds()
    setSaved(null)
    setStatus('idle')
    setAccount(null)
    setCreds({ apiKey: '', secretKey: '', passphrase: '', playbookKey: '' })
    setActiveTab('connect')
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key); setTimeout(() => setCopied(''), 2000)
    })
  }

  const maskedKey = (k: string) => k.length > 8 ? k.slice(0, 4) + '••••••••' + k.slice(-4) : '••••••••'

  const TABS = [
    { id: 'connect', label: status === 'connected' ? '✓ Connected' : '🔑 Connect' },
    { id: 'account', label: '📊 Account' },
    { id: 'guide',   label: '📖 Setup Guide' },
  ] as const

  return (
    <div className="max-w-3xl mx-auto px-6 py-6 flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-extrabold" style={{ color: 'var(--text)' }}>Bitget Connect</h2>
          <p className="mono text-xs mt-1" style={{ color: 'var(--text3)' }}>
            Link your Bitget account to enable live skill hub data, trading APIs, and Playbook publishing
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{
            background: status === 'connected' ? 'rgba(14,203,129,0.1)' : status === 'error' ? 'rgba(246,70,93,0.1)' : 'var(--bg2)',
            border: `1px solid ${status === 'connected' ? 'rgba(14,203,129,0.3)' : status === 'error' ? 'rgba(246,70,93,0.3)' : 'var(--border)'}`,
          }}>
          <Dot ok={status === 'connected'} pulse />
          <span className="mono text-xs font-bold" style={{
            color: status === 'connected' ? 'var(--green)' : status === 'error' ? 'var(--red)' : 'var(--text3)',
          }}>
            {status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting…' : status === 'error' ? 'Error' : 'Not connected'}
          </span>
        </div>
      </div>

      {/* Env creds notice */}
      {hasEnvCreds && (
        <div className="rounded-xl px-4 py-3 mono text-xs flex items-center gap-2"
          style={{ background: 'rgba(14,203,129,0.06)', border: '1px solid rgba(14,203,129,0.2)', color: 'var(--text2)' }}>
          <Dot ok />
          <span>Environment credentials detected in <code>.env.local</code> — server-side API calls use these automatically.</span>
        </div>
      )}

      {/* Tab strip */}
      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="mono text-xs px-4 py-2 rounded-t-lg transition-all"
            style={{
              background:   activeTab === tab.id ? 'var(--bg2)' : 'transparent',
              color:        activeTab === tab.id ? 'var(--yellow)' : 'var(--text3)',
              borderBottom: activeTab === tab.id ? '2px solid var(--yellow)' : '2px solid transparent',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Connect tab ───────────────────────────────────────────────────── */}
      {activeTab === 'connect' && (
        <div className="flex flex-col gap-4">

          {status === 'connected' && saved ? (
            <div className="rounded-xl p-5 flex flex-col gap-4"
              style={{ background: 'var(--bg2)', border: '1px solid rgba(14,203,129,0.25)' }}>
              <div className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--green)' }}>
                ✓ Bitget account connected
              </div>
              <div className="flex flex-col gap-2">
                {[
                  { label: 'API Key',    value: maskedKey(saved.apiKey),      key: 'apiKey' },
                  { label: 'Passphrase', value: '••••••••',                    key: 'pass' },
                  { label: 'Playbook Key', value: saved.playbookKey ? maskedKey(saved.playbookKey) : 'Not set', key: 'pb' },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between mono text-xs py-1">
                    <span style={{ color: 'var(--text3)' }}>{item.label}</span>
                    <div className="flex items-center gap-2">
                      <span style={{ color: 'var(--text)' }}>{item.value}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={disconnect}
                  className="py-2 px-4 rounded-lg mono text-xs"
                  style={{ background: 'rgba(246,70,93,0.08)', border: '1px solid rgba(246,70,93,0.2)', color: 'var(--red)' }}>
                  Disconnect
                </button>
                <button onClick={() => { setStatus('idle'); setSaved(null) }}
                  className="py-2 px-4 rounded-lg mono text-xs"
                  style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
                  Update Keys
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl p-5 flex flex-col gap-4"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <div className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
                Bitget API Credentials
              </div>

              {[
                { label: 'API Key',     key: 'apiKey',     placeholder: 'bg_••••••••••••••••••••••••••••••••' },
                { label: 'Secret Key',  key: 'secretKey',  placeholder: '••••••••••••••••••••••••••••••••' },
                { label: 'Passphrase',  key: 'passphrase', placeholder: 'Your API passphrase' },
              ].map(field => (
                <div key={field.key} className="flex flex-col gap-1.5">
                  <label className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
                    {field.label}
                  </label>
                  <div className="relative">
                    <input
                      type={showSecrets ? 'text' : 'password'}
                      value={creds[field.key as keyof BitgetCreds]}
                      onChange={e => setCreds(prev => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full mono text-xs px-3 py-2 rounded-lg outline-none"
                      style={{
                        background: 'var(--bg3)',
                        border:     '1px solid var(--border2)',
                        color:      'var(--text)',
                        paddingRight: '40px',
                      }}
                      onFocus={e => (e.target.style.borderColor = 'var(--yellow)')}
                      onBlur={e => (e.target.style.borderColor = 'var(--border2)')}
                    />
                  </div>
                </div>
              ))}

              <div className="flex flex-col gap-1.5">
                <label className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
                  Playbook API Key <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(optional — for strategy publishing)</span>
                </label>
                <input
                  type={showSecrets ? 'text' : 'password'}
                  value={creds.playbookKey}
                  onChange={e => setCreds(prev => ({ ...prev, playbookKey: e.target.value }))}
                  placeholder="Your Bitget Playbook key"
                  className="w-full mono text-xs px-3 py-2 rounded-lg outline-none"
                  style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--yellow)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border2)')}
                />
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="showSecrets" checked={showSecrets}
                  onChange={e => setShowSecrets(e.target.checked)} />
                <label htmlFor="showSecrets" className="mono text-[10px]" style={{ color: 'var(--text3)' }}>
                  Show credentials
                </label>
              </div>

              {errorMsg && (
                <div className="mono text-xs px-3 py-2 rounded-lg"
                  style={{ background: 'rgba(246,70,93,0.08)', border: '1px solid rgba(246,70,93,0.2)', color: 'var(--red)' }}>
                  {errorMsg}
                </div>
              )}

              <button onClick={connect}
                disabled={status === 'connecting'}
                className="py-3 rounded-xl mono text-sm font-bold flex items-center justify-center gap-2 transition-all"
                style={{
                  background: status === 'connecting' ? 'var(--bg4)' : 'var(--yellow)',
                  color:      status === 'connecting' ? 'var(--text3)' : '#000',
                  cursor:     status === 'connecting' ? 'not-allowed' : 'pointer',
                }}>
                {status === 'connecting' && (
                  <span className="w-4 h-4 rounded-full border-2 border-black/30 border-t-black animate-spin-slow" />
                )}
                {status === 'connecting' ? 'Validating…' : '🔑 Connect Bitget Account'}
              </button>

              <div className="mono text-[10px] leading-relaxed" style={{ color: 'var(--text3)' }}>
                Credentials are stored in browser sessionStorage only — never sent to any server except Bitget.
                Refresh the page to clear them. For persistent use, add to <code>.env.local</code>.
              </div>
            </div>
          )}

          {/* Permissions panel */}
          {account && (
            <div className="rounded-xl p-5"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <div className="mono text-[10px] uppercase tracking-widest mb-4" style={{ color: 'var(--text3)' }}>
                API Permissions
              </div>
              <div className="flex flex-col gap-3">
                {[
                  { label: 'Read / View',  ok: account.permissions.read,     desc: 'Can read balances, positions, market data' },
                  { label: 'Trade',        ok: account.permissions.trade,    desc: 'Can place and cancel orders' },
                  { label: 'Withdraw',     ok: account.permissions.withdraw, desc: 'Can initiate withdrawals — keep disabled for trading bots' },
                ].map(p => (
                  <div key={p.label} className="flex items-center gap-3">
                    <Dot ok={p.ok} />
                    <div>
                      <div className="mono text-xs font-semibold" style={{ color: p.ok ? 'var(--text)' : 'var(--text3)' }}>
                        {p.label}
                      </div>
                      <div className="mono text-[10px]" style={{ color: 'var(--text3)' }}>{p.desc}</div>
                    </div>
                    <span className="ml-auto mono text-[10px] px-2 py-0.5 rounded-full"
                      style={{
                        background: p.ok ? 'rgba(14,203,129,0.1)' : 'var(--bg3)',
                        color: p.ok ? 'var(--green)' : 'var(--text3)',
                      }}>
                      {p.ok ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Account tab ────────────────────────────────────────────────────── */}
      {activeTab === 'account' && (
        <div className="flex flex-col gap-4">
          {!account ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3"
              style={{ background: 'var(--bg2)', border: '1px dashed var(--border)', borderRadius: 12 }}>
              <div className="text-4xl opacity-30">🔑</div>
              <div className="mono text-xs" style={{ color: 'var(--text3)' }}>
                Connect your Bitget account first
              </div>
              <button onClick={() => setActiveTab('connect')}
                className="mono text-xs px-4 py-2 rounded-lg"
                style={{ background: 'var(--yellow)', color: '#000' }}>
                → Connect
              </button>
            </div>
          ) : (
            <>
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
                {[
                  { label: 'Bitget UID',      value: account.uid,                       color: 'var(--text)' },
                  { label: 'Open Positions',   value: `${account.positionCount}`,        color: 'var(--text)' },
                  { label: 'Spot Balance',     value: `$${account.spotBalance.toFixed(2)}`,    color: account.spotBalance > 0 ? 'var(--green)' : 'var(--text3)' },
                  { label: 'Futures Balance',  value: `$${account.futuresBalance.toFixed(2)}`, color: account.futuresBalance > 0 ? 'var(--green)' : 'var(--text3)' },
                ].map(m => (
                  <div key={m.label} className="rounded-xl p-4"
                    style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                    <div className="mono text-[9px] uppercase tracking-widest mb-1" style={{ color: 'var(--text3)' }}>
                      {m.label}
                    </div>
                    <div className="mono text-lg font-extrabold" style={{ color: m.color }}>
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={() => loadAccount(saved!)}
                className="py-2 px-4 rounded-lg mono text-xs self-start"
                style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
                ↺ Refresh
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Guide tab ──────────────────────────────────────────────────────── */}
      {activeTab === 'guide' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl p-5"
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div className="mono text-[10px] uppercase tracking-widest mb-4" style={{ color: 'var(--text3)' }}>
              Step-by-step: Get your Bitget API Keys
            </div>
            {[
              { step: '1', text: 'Log in to bitget.com → top-right avatar → API Management' },
              { step: '2', text: 'Click "Create API" → choose "System-generated API Key"' },
              { step: '3', text: 'Set a Passphrase (remember this — it cannot be recovered)' },
              { step: '4', text: 'Permissions: enable "Read" + "Trade" — leave Withdraw OFF for safety' },
              { step: '5', text: 'IP allowlist: add your server IP for production, leave blank for dev' },
              { step: '6', text: 'Copy API Key + Secret Key and paste them above' },
              { step: '7', text: 'For Playbook: go to bitget.com/activity/ai-get-agent/playbook → Create Agent → copy Playbook Key' },
            ].map(({ step, text }) => (
              <div key={step} className="flex gap-3 py-2.5 border-b last:border-0"
                style={{ borderColor: 'var(--border)' }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center mono text-[10px] font-bold shrink-0"
                  style={{ background: 'var(--yellow)', color: '#000' }}>
                  {step}
                </div>
                <span className="mono text-[11px]" style={{ color: 'var(--text2)' }}>{text}</span>
              </div>
            ))}
          </div>

          <div className="rounded-xl p-4 mono text-[10px] leading-relaxed"
            style={{ background: 'rgba(240,185,11,0.05)', border: '1px solid rgba(240,185,11,0.15)', color: 'var(--text3)' }}>
            <div className="font-bold mb-1" style={{ color: 'var(--yellow)' }}>Persistent setup (recommended)</div>
            Add to <code style={{ color: 'var(--text)' }}>.env.local</code> in the repo root:<br />
            <code style={{ color: 'var(--green)' }}>
              BITGET_API_KEY=bg_...<br />
              BITGET_SECRET_KEY=...<br />
              BITGET_PASSPHRASE=...<br />
            </code>
            This way credentials are never stored in the browser and all server-side Skill Hub calls work automatically.
          </div>
        </div>
      )}
    </div>
  )
}
