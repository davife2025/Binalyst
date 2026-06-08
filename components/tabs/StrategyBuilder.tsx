'use client'

/**
 * components/tabs/StrategyBuilder.tsx
 * Session C: Natural-language strategy input → AI parse → StrategyRule[] display.
 * Includes example templates, rule editor, risk assessment.
 */

import { useState } from 'react'
import { useAgentStore } from '@/lib/agentStore'
import { ALL_ELIGIBLE_SYMBOLS } from '@/lib/twak/client'

// ─────────────────────────────────────────────────────────────────────────────
// Strategy templates
// ─────────────────────────────────────────────────────────────────────────────
const TEMPLATES = [
  {
    name:   'Fear DCA',
    icon:   '😨',
    desc:   'Buy during extreme fear, sell into greed',
    text:   `Buy ETH with 10% of portfolio when Fear & Greed drops below 25 (extreme fear).
Buy CAKE with 8% when Fear & Greed is below 30 and signal score above 65.
Sell ETH when Fear & Greed exceeds 75 (extreme greed).
Sell CAKE when 24h change exceeds +20%.
Always keep at least 20% in USDT as reserve.`,
  },
  {
    name:   'Momentum Rider',
    icon:   '🚀',
    desc:   'Chase strong momentum with tight stops',
    text:   `Buy AVAX with 12% when signal score exceeds 75 and 24h change is above 5%.
Buy BNB with 10% when CMC trending and signal score above 70.
Sell AVAX when signal score drops below 45.
Sell BNB when 24h change drops below -8%.
Rotate into USDT when Fear & Greed exceeds 80.`,
  },
  {
    name:   'Sentiment Rotator',
    icon:   '🔄',
    desc:   'Rotate between assets based on sentiment shifts',
    text:   `When Fear & Greed is below 35, allocate 15% to ETH and 10% to ADA.
When Fear & Greed is between 50-65, rotate 12% into LINK and DOT.
When Fear & Greed exceeds 70, sell altcoins and move 80% to USDT.
Buy DOGE with 8% when volume spike detected and signal above 68.`,
  },
  {
    name:   'Conservative DCA',
    icon:   '🛡️',
    desc:   'Small steady positions, low risk, max drawdown protection',
    text:   `Buy ETH with 8% every time signal score exceeds 70. Max 2 buys per day.
Buy USDT when drawdown approaches 20% (exit all positions).
Sell ETH when profit exceeds 15% on the position.
Never risk more than 10% per trade.
Hold FDUSD as base currency between trades.`,
  },
]

const CONDITION_LABELS: Record<string, string> = {
  fear_below:       'Fear & Greed <',
  fear_above:       'Fear & Greed >',
  signal_above:     'Signal score >',
  signal_below:     'Signal score <',
  change24h_above:  '24h change >',
  change24h_below:  '24h change <',
  price_above:      'Price >',
  price_below:      'Price <',
  tag_includes:     'Tag =',
  and:              'AND',
  or:               'OR',
}

const RISK_CONFIG = {
  LOW:    { color: 'var(--green)', bg: 'rgba(14,203,129,0.1)',  border: 'rgba(14,203,129,0.25)' },
  MEDIUM: { color: 'var(--yellow)',bg: 'rgba(240,185,11,0.1)', border: 'rgba(240,185,11,0.25)' },
  HIGH:   { color: 'var(--red)',   bg: 'rgba(246,70,93,0.1)',  border: 'rgba(246,70,93,0.25)'  },
}

function conditionLabel(cond: any): string {
  if (!cond) return '—'
  if (cond.type === 'and') return `(${conditionLabel(cond.left)} AND ${conditionLabel(cond.right)})`
  if (cond.type === 'or')  return `(${conditionLabel(cond.left)} OR ${conditionLabel(cond.right)})`
  const label = CONDITION_LABELS[cond.type] ?? cond.type
  return `${label} ${cond.value ?? cond.tag ?? ''}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function StrategyBuilder() {
  const { strategyText, strategyParsed, setStrategy, agentConfig, setAgentConfig } = useAgentStore()

  const [text,        setText]        = useState(strategyText || '')
  const [parsing,     setParsing]     = useState(false)
  const [result,      setResult]      = useState<any>(null)
  const [error,       setError]       = useState('')
  const [activeTab,   setActiveTab]   = useState<'write' | 'rules' | 'config'>('write')
  const [showTokens,  setShowTokens]  = useState(false)

  // ── Parse strategy ────────────────────────────────────────────────────────
  async function handleParse() {
    if (!text.trim()) { setError('Write a strategy first.'); return }
    setParsing(true); setError(''); setResult(null)
    try {
      const res  = await fetch('/api/agent/strategy', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ strategyText: text }),
      })
      const data = await res.json()
      if (!data.success) { setError(data.error ?? 'Parse failed'); return }
      setResult(data)
      setStrategy(text, data.rules)
      // Auto-populate allowed tokens from rules
      const symbols = [...new Set(data.rules.map((r: any) => r.symbol))] as string[]
      setAgentConfig({ allowedTokens: symbols })
      setActiveTab('rules')
    } catch (e: any) { setError(e.message) }
    setParsing(false)
  }

  function loadTemplate(t: typeof TEMPLATES[0]) {
    setText(t.text)
    setResult(null)
    setActiveTab('write')
  }

  function removeRule(id: string) {
    if (!result) return
    const rules = result.rules.filter((r: any) => r.id !== id)
    setResult({ ...result, rules })
    setStrategy(text, rules)
  }

  const riskCfg = result ? RISK_CONFIG[result.riskLevel as keyof typeof RISK_CONFIG] ?? RISK_CONFIG.MEDIUM : null

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-extrabold" style={{ color: 'var(--text)' }}>Strategy Builder</h2>
          <p className="mono text-xs mt-1" style={{ color: 'var(--text3)' }}>
            Write your strategy in plain English → AI parses it into executable rules
          </p>
        </div>
        {result && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{ background: riskCfg!.bg, border: `1px solid ${riskCfg!.border}` }}>
            <span className="mono text-[10px] font-bold" style={{ color: riskCfg!.color }}>
              {result.riskLevel} RISK
            </span>
          </div>
        )}
      </div>

      {/* Templates */}
      <div>
        <div className="mono text-[10px] uppercase tracking-widest mb-3" style={{ color: 'var(--text3)' }}>
          Strategy Templates
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {TEMPLATES.map(t => (
            <button key={t.name} onClick={() => loadTemplate(t)}
              className="flex items-start gap-3 px-4 py-3 rounded-xl text-left transition-all"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--yellow)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
              <span className="text-xl shrink-0">{t.icon}</span>
              <div>
                <div className="text-xs font-bold" style={{ color: 'var(--text)' }}>{t.name}</div>
                <div className="mono text-[10px] mt-0.5" style={{ color: 'var(--text3)' }}>{t.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 border-b pb-0" style={{ borderColor: 'var(--border)' }}>
        {([
          { id: 'write', label: '✏ Write Strategy' },
          { id: 'rules', label: `⚡ Rules${result ? ` (${result.rules?.length ?? 0})` : ''}` },
          { id: 'config', label: '⚙ Agent Config' },
        ] as const).map(tab => (
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

      {/* ── Tab: Write ──────────────────────────────────────────────────────── */}
      {activeTab === 'write' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
                Strategy (plain English)
              </label>
              <span className="mono text-[9px]" style={{ color: 'var(--text3)' }}>
                {text.length} chars
              </span>
            </div>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={10}
              placeholder={`Describe your strategy in plain English. Examples:

Buy ETH with 10% when Fear & Greed drops below 25.
Sell ETH when Fear & Greed exceeds 75.
Buy CAKE when signal score is above 70 and volume spike detected.
Rotate to USDT when drawdown reaches 20%.`}
              className="mono text-sm px-4 py-3 rounded-xl outline-none resize-none leading-relaxed"
              style={{
                background: 'var(--bg2)',
                border:     '1px solid var(--border2)',
                color:      'var(--text)',
              }}
              onFocus={e => (e.target.style.borderColor = 'var(--yellow)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border2)')}
            />
          </div>

          {/* Competition rules reminder */}
          <div className="rounded-xl p-4" style={{ background: 'rgba(240,185,11,0.06)', border: '1px solid rgba(240,185,11,0.15)' }}>
            <div className="mono text-[10px] font-bold mb-2" style={{ color: 'var(--yellow)' }}>
              Competition Rules — Baked Into Every Strategy
            </div>
            <div className="grid gap-1" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {[
                '✓ Min 1 trade per day (7 total over week)',
                '✓ Portfolio must stay above $1 at all times',
                '✓ Max 30% drawdown → disqualification',
                '✓ Only eligible BEP-20 tokens count',
                '✓ Returns measured hourly — stay deployed',
                '✓ Must hold in-scope assets at competition start',
              ].map(rule => (
                <div key={rule} className="mono text-[10px]" style={{ color: 'var(--text2)' }}>
                  {rule}
                </div>
              ))}
            </div>
          </div>

          {/* Eligible tokens toggle */}
          <div>
            <button onClick={() => setShowTokens(v => !v)}
              className="mono text-[10px] px-3 py-1.5 rounded-lg"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text3)' }}>
              {showTokens ? '▲ Hide' : '▼ Show'} 149 eligible tokens
            </button>
            {showTokens && (
              <div className="flex flex-wrap gap-1.5 mt-3 p-4 rounded-xl"
                style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                {ALL_ELIGIBLE_SYMBOLS.map(sym => (
                  <button key={sym}
                    onClick={() => setText(t => t + ` ${sym}`)}
                    className="mono text-[9px] px-2 py-0.5 rounded transition-all"
                    style={{ background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--yellow)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                    {sym}
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="mono text-xs p-3 rounded-lg"
              style={{ background: 'rgba(246,70,93,0.08)', border: '1px solid rgba(246,70,93,0.25)', color: 'var(--red)' }}>
              {error}
            </div>
          )}

          <button onClick={handleParse} disabled={parsing || !text.trim()}
            className="py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
            style={{
              background: parsing || !text.trim() ? 'var(--bg4)' : 'var(--yellow)',
              color:      parsing || !text.trim() ? 'var(--text3)' : '#000',
              cursor:     parsing || !text.trim() ? 'not-allowed' : 'pointer',
            }}>
            {parsing && (
              <span className="w-4 h-4 rounded-full border-2 border-black/30 border-t-black animate-spin-slow" />
            )}
            {parsing ? 'Parsing with AI...' : '⚡ Parse Strategy → Rules'}
          </button>
        </div>
      )}

      {/* ── Tab: Rules ──────────────────────────────────────────────────────── */}
      {activeTab === 'rules' && (
        <div className="flex flex-col gap-4">
          {!result ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3"
              style={{ background: 'var(--bg2)', border: '1px dashed var(--border)', borderRadius: 12 }}>
              <div className="text-4xl opacity-30">⚡</div>
              <div className="mono text-xs" style={{ color: 'var(--text3)' }}>
                Write a strategy and click Parse to generate rules
              </div>
              <button onClick={() => setActiveTab('write')}
                className="mono text-xs px-4 py-2 rounded-lg"
                style={{ background: 'var(--yellow)', color: '#000' }}>
                ← Write Strategy
              </button>
            </div>
          ) : (
            <>
              {/* Summary */}
              {result.summary && (
                <div className="rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                  <div className="mono text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--text3)' }}>
                    Strategy Summary
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text2)' }}>
                    {result.summary}
                  </p>
                </div>
              )}

              {/* Warnings */}
              {result.warnings?.length > 0 && (
                <div className="rounded-xl p-4"
                  style={{ background: 'rgba(240,185,11,0.06)', border: '1px solid rgba(240,185,11,0.2)' }}>
                  <div className="mono text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--yellow)' }}>
                    Warnings
                  </div>
                  {result.warnings.map((w: string, i: number) => (
                    <div key={i} className="mono text-xs" style={{ color: 'var(--text2)' }}>
                      ⚠ {w}
                    </div>
                  ))}
                </div>
              )}

              {/* Rules list */}
              <div className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
                Parsed Rules ({result.rules?.length ?? 0})
              </div>
              <div className="flex flex-col gap-2">
                {(result.rules ?? []).map((rule: any, i: number) => (
                  <div key={rule.id ?? i} className="rounded-xl p-4 flex items-start gap-3"
                    style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>

                    {/* Priority badge */}
                    <div className="w-6 h-6 rounded-full flex items-center justify-center mono text-[10px] font-bold shrink-0 mt-0.5"
                      style={{ background: 'var(--bg4)', color: 'var(--text3)' }}>
                      {i + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Symbol + Action */}
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="mono text-xs font-extrabold" style={{ color: 'var(--text)' }}>
                          {rule.symbol}
                        </span>
                        <span className="mono text-[10px] px-2 py-0.5 rounded-full font-bold"
                          style={{
                            background: rule.action === 'BUY' ? 'rgba(14,203,129,0.15)' : 'rgba(246,70,93,0.15)',
                            color:      rule.action === 'BUY' ? 'var(--green)'           : 'var(--red)',
                          }}>
                          {rule.action}
                        </span>
                        <span className="mono text-[10px]" style={{ color: 'var(--yellow)' }}>
                          {rule.sizePct}% portfolio
                        </span>
                        <span className="mono text-[10px]" style={{ color: 'var(--text3)' }}>
                          cooldown {rule.cooldownMs >= 3600000
                            ? `${(rule.cooldownMs / 3600000).toFixed(0)}h`
                            : `${(rule.cooldownMs / 60000).toFixed(0)}m`}
                        </span>
                      </div>

                      {/* Condition */}
                      <div className="mono text-[10px] px-2 py-1 rounded mb-1"
                        style={{ background: 'var(--bg3)', color: 'var(--text2)' }}>
                        WHEN: {conditionLabel(rule.condition)}
                      </div>

                      {/* Reasoning */}
                      {rule.reasoning && (
                        <div className="mono text-[10px] leading-snug" style={{ color: 'var(--text3)' }}>
                          {rule.reasoning}
                        </div>
                      )}
                    </div>

                    {/* Remove */}
                    <button onClick={() => removeRule(rule.id)}
                      className="mono text-sm px-2 rounded shrink-0"
                      style={{ color: 'var(--text3)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text3)')}>
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <button onClick={() => setActiveTab('config')}
                className="py-2.5 rounded-xl mono text-sm font-bold"
                style={{ background: 'var(--yellow)', color: '#000' }}>
                Save & Configure Agent →
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Tab: Config ─────────────────────────────────────────────────────── */}
      {activeTab === 'config' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl p-5" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div className="mono text-[10px] uppercase tracking-widest mb-4" style={{ color: 'var(--text3)' }}>
              Guardrail Configuration
            </div>
            <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {[
                {
                  label: 'Max Drawdown %',
                  key:   'maxDrawdownPct',
                  min: 5, max: 29, step: 1,
                  warn: agentConfig.maxDrawdownPct >= 25,
                  hint: 'Competition disqualifies at 30%. Keep below 25%.',
                },
                {
                  label: 'Max Per-Trade %',
                  key:   'maxPerTradePct',
                  min: 3, max: 25, step: 1,
                  warn: agentConfig.maxPerTradePct >= 20,
                  hint: 'Max % of portfolio per single trade.',
                },
                {
                  label: 'Max Daily Trades',
                  key:   'maxDailyTrades',
                  min: 1, max: 20, step: 1,
                  warn: false,
                  hint: 'Minimum 1/day required to qualify.',
                },
                {
                  label: 'Slippage %',
                  key:   'slippagePct',
                  min: 0.1, max: 5, step: 0.1,
                  warn: agentConfig.slippagePct >= 3,
                  hint: 'Max allowed price impact per swap.',
                },
              ].map(({ label, key, min, max, step, warn, hint }) => (
                <div key={key} className="flex flex-col gap-2">
                  <div className="flex justify-between">
                    <label className="mono text-[10px] uppercase tracking-widest"
                      style={{ color: warn ? 'var(--yellow)' : 'var(--text3)' }}>
                      {label}
                    </label>
                    <span className="mono text-xs font-bold"
                      style={{ color: warn ? 'var(--yellow)' : 'var(--text)' }}>
                      {agentConfig[key as keyof typeof agentConfig]}
                      {key.includes('Pct') ? '%' : ''}
                    </span>
                  </div>
                  <input
                    type="range" min={min} max={max} step={step}
                    value={agentConfig[key as keyof typeof agentConfig] as number}
                    onChange={e => setAgentConfig({ [key]: parseFloat(e.target.value) })}
                    className="w-full accent-yellow-400"
                    style={{ accentColor: warn ? 'var(--yellow)' : 'var(--yellow)' }}
                  />
                  <div className="mono text-[9px]" style={{ color: 'var(--text3)' }}>{hint}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Dry run toggle */}
          <div className="rounded-xl p-5 flex items-center justify-between"
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div>
              <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Dry Run Mode</div>
              <div className="mono text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
                Simulate trades without executing on-chain. Disable only when ready to go live.
              </div>
            </div>
            <button
              onClick={() => setAgentConfig({ dryRun: !agentConfig.dryRun })}
              className="w-12 h-6 rounded-full relative transition-all shrink-0"
              style={{ background: agentConfig.dryRun ? 'var(--green)' : 'var(--red)' }}>
              <span className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
                style={{ background: '#000', left: agentConfig.dryRun ? '2px' : '26px' }} />
            </button>
          </div>

          {/* Autonomous mode toggle */}
          <div className="rounded-xl p-5 flex items-center justify-between"
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div>
              <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Autonomous Mode</div>
              <div className="mono text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
                Agent evaluates rules and signs transactions automatically every 2 minutes.
              </div>
            </div>
            <button
              onClick={() => setAgentConfig({ autonomousMode: !agentConfig.autonomousMode })}
              className="w-12 h-6 rounded-full relative transition-all shrink-0"
              style={{ background: agentConfig.autonomousMode ? 'var(--yellow)' : 'var(--bg4)' }}>
              <span className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
                style={{
                  background: agentConfig.autonomousMode ? '#000' : 'var(--text3)',
                  left: agentConfig.autonomousMode ? '26px' : '2px',
                }} />
            </button>
          </div>

          {!agentConfig.dryRun && agentConfig.autonomousMode && (
            <div className="rounded-xl p-4"
              style={{ background: 'rgba(246,70,93,0.08)', border: '1px solid rgba(246,70,93,0.25)' }}>
              <div className="mono text-xs font-bold" style={{ color: 'var(--red)' }}>
                ⚠ LIVE AUTONOMOUS MODE ENABLED
              </div>
              <div className="mono text-[10px] mt-1" style={{ color: 'var(--text2)' }}>
                The agent will sign and execute real BSC transactions without confirmation.
                Ensure your guardrails are correct and you have sufficient BNB for gas.
              </div>
            </div>
          )}

          <button
            onClick={() => {
              if (strategyParsed.length > 0) {
                alert('✓ Strategy and config saved to agent store. Go to the Competition tab to start the agent.')
              }
            }}
            className="py-3 rounded-xl text-sm font-bold"
            style={{ background: 'var(--yellow)', color: '#000' }}>
            ✓ Save Configuration
          </button>
        </div>
      )}
    </div>
  )
}
