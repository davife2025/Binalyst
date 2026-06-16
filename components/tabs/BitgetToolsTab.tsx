'use client'

/**
 * components/tabs/BitgetToolsTab.tsx
 * Session O — Bitget Tools hub.
 *
 * Two sections:
 *   1. Skill Hub — 5 analyst-grade skills as interactive panels
 *      - technical-analysis (23 indicators — wired to Session J output)
 *      - sentiment-analyst  (funding, long/short, F&G)
 *      - market-intel       (ETF flows, whale activity, TVL)
 *      - news-briefing      (news aggregation + keyword search)
 *      - macro-analyst      (Fed policy, BTC vs DXY/Nasdaq/Gold)
 *
 *   2. Trading API Launcher — browse and test the 58 Bitget APIs
 *      organised by category: Account · Market · Trading · Strategy
 */

import { useState } from 'react'
import { BITGET_SKILLS, BITGET_TRADING_APIS } from '@/lib/bitgetClient'

// ─────────────────────────────────────────────────────────────────────────────
// API caller (reuses /api/bitget proxy)
// ─────────────────────────────────────────────────────────────────────────────

async function bitgetCall(action: string, params: any[] = []) {
  const creds = (() => {
    try {
      const raw = sessionStorage.getItem('bitget_credentials')
      return raw ? JSON.parse(raw) : undefined
    } catch { return undefined }
  })()
  const res = await fetch('/api/bitget', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action, params, credentials: creds }),
  })
  return res.json()
}

// ─────────────────────────────────────────────────────────────────────────────
// Skill panel — renders one Skill Hub skill
// ─────────────────────────────────────────────────────────────────────────────

const SKILL_ACTIONS: Record<string, string> = {
  'technical-analysis': 'getTechnicalAnalysis',
  'sentiment-analyst':  'getSentiment',
  'market-intel':       'getMarketIntel',
  'news-briefing':      'getNewsBriefing',
  'macro-analyst':      'getMacroAnalysis',
}

function SkillPanel({ skill }: { skill: typeof BITGET_SKILLS[number] }) {
  const [symbol,   setSymbol]   = useState('BTCUSDT')
  const [keyword,  setKeyword]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState<any>(null)
  const [error,    setError]    = useState('')
  const [expanded, setExpanded] = useState(false)

    const p = String(skill.params); 

  async function run() {
    setLoading(true); setError(''); setResult(null)
    const params: any[] = []
    

      if (p.includes('symbol'))         params.push(symbol)
      if (p.includes('granularity'))    params.push('1H')
      if (p.includes('keyword?'))       params.push(keyword || undefined)

    const res = await bitgetCall(SKILL_ACTIONS[skill.id], params)
    setLoading(false)
    if (res.success) setResult(res.data)
    else setError(res.error ?? 'Request failed')
  }

  // Special rendering for technical-analysis — pull from /api/technicals (Session J)
  // for richer output with full TechnicalSnapshot
  async function runTechnical() {
    setLoading(true); setError(''); setResult(null)
    try {
      const res  = await fetch(`/api/technicals?symbol=${symbol.replace('USDT','')}&interval=1h`)
      const data = await res.json()
      setResult(data.snapshot ?? data)
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  return (
    <div className="rounded-xl flex flex-col"
      style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>

      {/* Header */}
      <button className="flex items-center gap-3 px-5 py-4 text-left w-full"
        onClick={() => setExpanded(v => !v)}>
        <span className="text-2xl">{skill.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="mono text-sm font-bold" style={{ color: 'var(--text)' }}>
              {skill.name}
            </span>
            {skill.badge && (
              <span className="mono text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                style={{ background: 'rgba(240,185,11,0.12)', color: 'var(--yellow)', border: '1px solid rgba(240,185,11,0.2)' }}>
                {skill.badge}
              </span>
            )}
          </div>
          <div className="mono text-[10px] mt-0.5 line-clamp-1" style={{ color: 'var(--text3)' }}>
            {skill.desc}
          </div>
        </div>
        <span className="mono text-xs shrink-0" style={{ color: 'var(--text3)' }}>
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-3 px-5 pb-5 border-t" style={{ borderColor: 'var(--border)' }}>

          {/* Param inputs */}
          <div className="flex gap-3 pt-3 flex-wrap">
           {(p.includes('symbol') || skill.id === 'technical-analysis') && (
              <div className="flex flex-col gap-1">
                <label className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>Symbol</label>
                <select value={symbol} onChange={e => setSymbol(e.target.value)}
                  className="mono text-xs px-2 py-1.5 rounded-lg"
                  style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)' }}>
                  {['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','ADAUSDT','AVAXUSDT'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}
               {p.includes('keyword?') && (
              <div className="flex flex-col gap-1 flex-1">
                <label className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>Keyword (optional)</label>
                <input value={keyword} onChange={e => setKeyword(e.target.value)}
                  placeholder="e.g. bitcoin ETF"
                  className="mono text-xs px-2 py-1.5 rounded-lg outline-none"
                  style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)' }} />
              </div>
            )}
            <div className="flex items-end">
              <button
                onClick={skill.id === 'technical-analysis' ? runTechnical : run}
                disabled={loading}
                className="py-1.5 px-4 rounded-lg mono text-xs font-bold flex items-center gap-1.5 transition-all"
                style={{ background: loading ? 'var(--bg4)' : 'var(--yellow)', color: loading ? 'var(--text3)' : '#000' }}>
                {loading && <span className="w-3 h-3 rounded-full border-2 border-black/30 border-t-black animate-spin-slow" />}
                {loading ? 'Running…' : '▶ Run'}
              </button>
            </div>
          </div>

          {error && (
            <div className="mono text-[10px] px-3 py-2 rounded-lg"
              style={{ background: 'rgba(246,70,93,0.08)', border: '1px solid rgba(246,70,93,0.2)', color: 'var(--red)' }}>
              {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="flex flex-col gap-2">
              {/* Technical analysis — rich display */}
              {skill.id === 'technical-analysis' && result.regime && (
                <div className="flex flex-col gap-2">
                  <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
                    {[
                      { label: 'Regime',     value: result.regime?.replace('_',' '),         color: result.regime === 'TRENDING_UP' ? 'var(--green)' : result.regime === 'TRENDING_DOWN' ? 'var(--red)' : 'var(--yellow)' },
                      { label: 'RSI 14',     value: result.momentum?.rsi14?.toFixed(0) ?? '—', color: result.momentum?.rsi14 < 30 ? 'var(--green)' : result.momentum?.rsi14 > 70 ? 'var(--red)' : 'var(--text)' },
                      { label: 'MACD Hist',  value: result.momentum?.macdHist?.toFixed(4) ?? '—', color: result.momentum?.macdHist > 0 ? 'var(--green)' : 'var(--red)' },
                      { label: 'Tech Score', value: result.summary?.overallScore ? `${result.summary.overallScore}/100` : '—', color: 'var(--yellow)' },
                      { label: 'ADX',        value: result.adx?.toFixed(0) ?? '—', color: 'var(--text)' },
                      { label: 'BB %B',      value: result.volatility?.bbPct ? `${(result.volatility.bbPct * 100).toFixed(0)}%` : '—', color: 'var(--text)' },
                      { label: 'OBV Trend',  value: result.volume?.obvTrend ?? '—', color: result.volume?.obvTrend === 'UP' ? 'var(--green)' : result.volume?.obvTrend === 'DOWN' ? 'var(--red)' : 'var(--text3)' },
                      { label: 'Conf',       value: result.regimeConf ? `${result.regimeConf.toFixed(0)}%` : '—', color: 'var(--text)' },
                    ].map(m => (
                      <div key={m.label} className="rounded-lg p-2.5"
                        style={{ background: 'var(--bg3)' }}>
                        <div className="mono text-[8px] uppercase tracking-widest mb-1" style={{ color: 'var(--text3)' }}>
                          {m.label}
                        </div>
                        <div className="mono text-sm font-bold" style={{ color: m.color }}>
                          {m.value}
                        </div>
                      </div>
                    ))}
                  </div>
                  {result.summary?.signals?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {result.summary.signals.slice(0, 8).map((sig: string, i: number) => (
                        <span key={i} className="mono text-[9px] px-2 py-0.5 rounded-full"
                          style={{
                            background: sig.startsWith('↑') ? 'rgba(14,203,129,0.1)' : 'rgba(246,70,93,0.1)',
                            color: sig.startsWith('↑') ? 'var(--green)' : 'var(--red)',
                          }}>
                          {sig}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Raw JSON fallback for other skills */}
              {skill.id !== 'technical-analysis' && (
                <pre className="mono text-[10px] rounded-lg p-3 overflow-auto max-h-48"
                  style={{ background: 'var(--bg3)', color: 'var(--text2)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {JSON.stringify(result, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Trading API Launcher
// ─────────────────────────────────────────────────────────────────────────────

function ApiLauncher() {
  const [activeCategory, setActiveCategory] = useState<string>('Account')
  const [selectedApi,    setSelectedApi]    = useState<string | null>(null)
  const [symbol,         setSymbol]         = useState('BTCUSDT')
  const [result,         setResult]         = useState<any>(null)
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState('')

  const API_MAP: Record<string, { action: string; params: () => any[] }> = {
    'Get Account Assets':  { action: 'getAccountAssets',    params: () => []       },
    'Get Spot Assets':     { action: 'getSpotAccountAssets',params: () => []       },
    'Get Positions':       { action: 'getPositions',        params: () => []       },
    'Get Sub-Accounts':    { action: 'getSubAccounts',      params: () => []       },
    'Account Info':        { action: 'getAccountInfo',      params: () => []       },
    'Get Ticker':          { action: 'getTicker',           params: () => [symbol] },
    'Get Klines':          { action: 'getKlines',           params: () => [symbol] },
    'Get Orderbook':       { action: 'getOrderbook',        params: () => [symbol] },
    'Get Funding Rate':    { action: 'getFundingRate',      params: () => [symbol] },
    'Get Open Orders':     { action: 'getOpenOrders',       params: () => [symbol] },
    'Get Order History':   { action: 'getOrderHistory',     params: () => [symbol] },
  }

  async function runApi(apiName: string) {
    const cfg = API_MAP[apiName]
    if (!cfg) { setError('API not yet wired for demo'); return }
    setLoading(true); setError(''); setResult(null); setSelectedApi(apiName)
    const res = await bitgetCall(cfg.action, cfg.params())
    setLoading(false)
    if (res.success) setResult(res.data)
    else setError(res.error ?? 'API call failed')
  }

  const currentCat = BITGET_TRADING_APIS.find(c => c.category === activeCategory)

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--border)' }}>

      {/* Category tabs */}
      <div className="flex border-b" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
        {BITGET_TRADING_APIS.map(cat => (
          <button key={cat.category}
            onClick={() => { setActiveCategory(cat.category); setResult(null); setSelectedApi(null) }}
            className="flex-1 py-3 mono text-xs font-bold transition-all"
            style={{
              color:        activeCategory === cat.category ? 'var(--yellow)' : 'var(--text3)',
              borderBottom: activeCategory === cat.category ? '2px solid var(--yellow)' : '2px solid transparent',
            }}>
            {cat.category}
          </button>
        ))}
      </div>

      <div className="flex" style={{ minHeight: '220px' }}>
        {/* API list */}
        <div className="w-1/3 border-r flex flex-col p-3 gap-1"
          style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
          {/* Symbol input for market/trading APIs */}
          {(activeCategory === 'Market' || activeCategory === 'Trading') && (
            <div className="mb-2">
              <input value={symbol} onChange={e => setSymbol(e.target.value)}
                placeholder="Symbol e.g. BTCUSDT"
                className="w-full mono text-[10px] px-2 py-1.5 rounded-lg outline-none"
                style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)' }} />
            </div>
          )}
          {currentCat?.apis.map(api => (
            <button key={api}
              onClick={() => API_MAP[api] ? runApi(api) : setSelectedApi(api)}
              className="text-left px-3 py-2 rounded-lg mono text-[10px] transition-all"
              style={{
                background: selectedApi === api ? 'rgba(240,185,11,0.1)' : 'transparent',
                color:      selectedApi === api ? 'var(--yellow)' : API_MAP[api] ? 'var(--text2)' : 'var(--text3)',
                border:     selectedApi === api ? '1px solid rgba(240,185,11,0.2)' : '1px solid transparent',
              }}>
              {api}
              {!API_MAP[api] && (
                <span className="mono text-[8px] ml-2 opacity-50">soon</span>
              )}
            </button>
          ))}
        </div>

        {/* Result pane */}
        <div className="flex-1 p-4 flex flex-col gap-3" style={{ background: 'var(--bg3)' }}>
          {!selectedApi && !loading && (
            <div className="flex items-center justify-center h-full mono text-xs" style={{ color: 'var(--text3)' }}>
              Select an API to run
            </div>
          )}
          {loading && (
            <div className="flex items-center gap-2 mono text-xs" style={{ color: 'var(--text3)' }}>
              <span className="w-3 h-3 rounded-full border-2 border-yellow-400/30 border-t-yellow-400 animate-spin-slow" />
              Calling Bitget API…
            </div>
          )}
          {error && (
            <div className="mono text-[10px] px-3 py-2 rounded-lg"
              style={{ background: 'rgba(246,70,93,0.08)', border: '1px solid rgba(246,70,93,0.2)', color: 'var(--red)' }}>
              {error}
            </div>
          )}
          {result && (
            <pre className="mono text-[9px] overflow-auto flex-1 rounded-lg p-3"
              style={{ background: 'var(--bg2)', color: 'var(--text2)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 180 }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
          {selectedApi && !loading && !result && !error && !API_MAP[selectedApi] && (
            <div className="mono text-[10px]" style={{ color: 'var(--text3)' }}>
              {selectedApi} — not yet wired in the demo. Add to API_MAP with your preferred params.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function BitgetToolsTab() {
  const [section, setSection] = useState<'skills' | 'apis'>('skills')

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 flex flex-col gap-6">

      {/* Header */}
      <div>
        <h2 className="text-lg font-extrabold" style={{ color: 'var(--text)' }}>Bitget Tools</h2>
        <p className="mono text-xs mt-1" style={{ color: 'var(--text3)' }}>
          5 Skill Hub analyst skills · 58 trading APIs · all wired to your connected Bitget account
        </p>
      </div>

      {/* Section switcher */}
      <div className="flex gap-2">
        {[
          { id: 'skills', label: '🧠 Skill Hub (5 skills)' },
          { id: 'apis',   label: '⚡ Trading APIs (58)' },
        ].map(s => (
          <button key={s.id} onClick={() => setSection(s.id as any)}
            className="py-2 px-5 rounded-full mono text-xs font-bold transition-all"
            style={{
              background: section === s.id ? 'var(--yellow)' : 'var(--bg2)',
              color:      section === s.id ? '#000' : 'var(--text3)',
              border:     '1px solid var(--border)',
            }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Skill Hub */}
      {section === 'skills' && (
        <div className="flex flex-col gap-3">
          <div className="mono text-[10px] leading-relaxed px-1" style={{ color: 'var(--text3)' }}>
            Each skill calls the Bitget Skill Hub REST endpoint (or falls back to local computation).
            Requires Bitget API credentials from the <span style={{ color: 'var(--yellow)' }}>Bitget Connect</span> tab.
            The <span style={{ color: 'var(--yellow)' }}>Technical Analysis</span> skill is already powering Sessions J–M — run it here to see the raw output.
          </div>
          {BITGET_SKILLS.map(skill => (
            <SkillPanel key={skill.id} skill={skill} />
          ))}
        </div>
      )}

      {/* Trading APIs */}
      {section === 'apis' && (
        <div className="flex flex-col gap-4">
          <div className="mono text-[10px] leading-relaxed px-1" style={{ color: 'var(--text3)' }}>
            Browse and test the 58 Bitget trading APIs. Select an API on the left, results appear on the right.
            Requires Bitget API credentials with appropriate permissions.
          </div>
          <ApiLauncher />
          <div className="mono text-[10px] px-1" style={{ color: 'var(--text3)' }}>
            58 total APIs available. Common ones are wired for demo — add any others to <code>API_MAP</code> in <code>BitgetToolsTab.tsx</code>.
          </div>
        </div>
      )}
    </div>
  )
}
