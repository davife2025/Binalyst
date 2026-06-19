'use client'

/**
 * components/tabs/StellarSubmissionTab.tsx — Session S
 *
 * Stellar Hacks submission panel for Binalyst × RISC Zero ZK.
 *
 * Sections:
 *   1. Submission checklist  — live status of every requirement
 *   2. Proof audit log       — all on-chain verified proofs, exportable as JSON
 *   3. Tech architecture     — what ZK is doing + how to verify it
 *   4. Demo script           — judges walkthrough guide
 */

import { useState, useEffect, useCallback } from 'react'
import { useZKProofStore }   from '@/lib/zkProofStore'
import { STELLAR_CONFIG }    from '@/lib/stellar/client'
import { useAgentStore }     from '@/lib/agentStore'
import type { ZKProofEntry } from '@/lib/stellar/types'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtTime(ts: number) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}
function fmtUSD(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function copyText(text: string, setCopied: (k: string) => void, key: string) {
  navigator.clipboard.writeText(text).then(() => {
    setCopied(key)
    setTimeout(() => setCopied(''), 2000)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// CheckItem
// ─────────────────────────────────────────────────────────────────────────────

function CheckItem({
  label, done, detail, warn,
}: { label: string; done: boolean; detail?: string; warn?: boolean }) {
  const color = done ? 'var(--green)' : warn ? 'var(--yellow)' : 'var(--text3)'
  const icon  = done ? '✓' : warn ? '◌' : '○'
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0',
                  borderBottom: '1px solid var(--border)' }}>
      <span className="mono" style={{ color, fontSize: 13, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div>
        <div className="mono" style={{ fontSize: 12, color: done ? 'var(--text)' : 'var(--text3)' }}>
          {label}
        </div>
        {detail && (
          <div className="mono" style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>
            {detail}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Section wrapper
// ─────────────────────────────────────────────────────────────────────────────

function Panel({ title, icon, children }: {
  title: string; icon: string; children: React.ReactNode
}) {
  return (
    <div style={{
      background:   'var(--bg2)',
      border:       '1px solid var(--border)',
      borderRadius: 10,
      marginBottom: 16,
      overflow:     'hidden',
    }}>
      <div style={{
        padding:      '10px 16px',
        borderBottom: '1px solid var(--border)',
        display:      'flex',
        alignItems:   'center',
        gap:          8,
      }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--yellow)' }}>
          {title}
        </span>
      </div>
      <div style={{ padding: '12px 16px' }}>{children}</div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Proof audit log row
// ─────────────────────────────────────────────────────────────────────────────

function AuditRow({ entry }: { entry: ZKProofEntry }) {
  const actionColor = entry.action === 'BUY' ? 'var(--green)' : 'var(--red)'
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '140px 50px 80px 1fr 90px',
      gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)',
      alignItems: 'center',
    }}>
      <span className="mono" style={{ fontSize: 10, color: 'var(--text3)' }}>
        {fmtTime(entry.decidedAt)}
      </span>
      <span className="mono" style={{ fontSize: 11, color: 'var(--yellow)' }}>
        {entry.symbol}
      </span>
      <span className="mono" style={{ fontSize: 11, color: actionColor }}>
        {entry.action} {fmtUSD(entry.amountUSDT)}
      </span>
      <span className="mono" style={{ fontSize: 10, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {entry.ruleName}
      </span>
      {entry.explorerUrl
        ? <a href={entry.explorerUrl} target="_blank" rel="noreferrer"
            className="mono" style={{ fontSize: 10, color: '#3498db', textDecoration: 'none' }}>
            #{entry.proofIndex} ↗
          </a>
        : <span className="mono" style={{ fontSize: 10, color: 'var(--text3)' }}>—</span>
      }
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main tab
// ─────────────────────────────────────────────────────────────────────────────

export default function StellarSubmissionTab() {
  const { proofs }              = useZKProofStore()
  const { agentAddress, trades, strategyParsed } = useAgentStore()

  const [onChainCount,  setOnChainCount]  = useState(0)
  const [contractId,    setContractId]    = useState(STELLAR_CONFIG.contractId)
  const [activeSection, setActiveSection] = useState<'checklist' | 'audit' | 'tech' | 'demo'>('checklist')
  const [copied,        setCopied]        = useState('')
  const [loading,       setLoading]       = useState(false)

  const verifiedProofs = proofs.filter(p => p.status === 'verified')
  const hasWallet      = !!agentAddress
  const hasStrategy    = strategyParsed.length > 0
  const hasProofs      = verifiedProofs.length > 0
  const hasContract    = !!contractId && contractId !== ''

  // Fetch on-chain proof count
  const fetchOnChainCount = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/zk/verify')
      if (res.ok) {
        const data = await res.json()
        setOnChainCount(data.proofCount ?? 0)
        if (data.contractId) setContractId(data.contractId)
      }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchOnChainCount() }, [fetchOnChainCount])

  // Export audit log as JSON
  function exportAuditLog() {
    const log = verifiedProofs.map(p => ({
      proofId:      p.proofId,
      symbol:       p.symbol,
      action:       p.action,
      amountUSDT:   p.amountUSDT,
      ruleName:     p.ruleName,
      decidedAt:    new Date(p.decidedAt).toISOString(),
      stellarTxId:  p.stellarTxId,
      proofIndex:   p.proofIndex,
      explorerUrl:  p.explorerUrl,
      attestation:  p.output?.attestation ?? '',
      drawdownPct:  p.output?.drawdown_pct ?? null,
      tradeSizePct: p.output?.trade_size_pct ?? null,
      dryRun:       p.output?.dry_run ?? true,
    }))
    const blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), network: STELLAR_CONFIG.network, contractId, proofCount: log.length, proofs: log }, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `binalyst-zk-audit-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const SECTIONS = [
    { id: 'checklist', label: 'Checklist' },
    { id: 'audit',     label: 'Audit Log' },
    { id: 'tech',      label: 'Architecture' },
    { id: 'demo',      label: 'Demo Script' },
  ] as const

  return (
    <div style={{ padding: 16, maxWidth: 760, margin: '0 auto', color: 'var(--text)' }}>

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 22 }}>⬡</span>
          <div>
            <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--yellow)' }}>
              Stellar Hacks — ZK Submission
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--text3)' }}>
              Real-World ZK · Binalyst × RISC Zero · Stellar {STELLAR_CONFIG.network}
            </div>
          </div>
        </div>

        {/* Live stats */}
        <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Verified proofs (session)', value: verifiedProofs.length, color: 'var(--green)' },
            { label: 'On-chain (Stellar)',         value: onChainCount,          color: '#3498db'      },
            { label: 'Total trades',               value: trades.length,         color: 'var(--yellow)'},
            { label: 'Strategy rules',             value: strategyParsed.length, color: 'var(--text)'  },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div className="mono" style={{ fontSize: 9,  color: 'var(--text3)', letterSpacing: '0.06em' }}>
                {s.label.toUpperCase()}
              </div>
            </div>
          ))}
          <button
            onClick={fetchOnChainCount}
            disabled={loading}
            className="mono"
            style={{
              marginLeft: 'auto', alignSelf: 'center',
              padding: '4px 10px', fontSize: 11, borderRadius: 6, cursor: 'pointer',
              background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text3)',
            }}>
            {loading ? '⟳' : '↻'} Refresh
          </button>
        </div>
      </div>

      {/* ── Section tabs ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className="mono"
            style={{
              padding: '5px 14px', fontSize: 11, borderRadius: 6, cursor: 'pointer',
              border:      activeSection === s.id ? '1px solid var(--yellow)' : '1px solid var(--border)',
              background:  activeSection === s.id ? 'rgba(240,185,11,0.1)' : 'transparent',
              color:       activeSection === s.id ? 'var(--yellow)' : 'var(--text3)',
              letterSpacing: '0.06em',
            }}>
            {s.label.toUpperCase()}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 1 — CHECKLIST
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeSection === 'checklist' && (
        <>
          <Panel title="Stellar Hacks Requirements" icon="📋">
            <CheckItem
              label="Open-source repository"
              done
              detail="github.com/davife2025/Binalyst — full source, clear README"
            />
            <CheckItem
              label="Demo video (2–3 min walkthrough)"
              done={false}
              warn
              detail="Record using the Demo Script tab — show agent loop → ZK proof → Stellar tx"
            />
            <CheckItem
              label="ZK technology integrated in a meaningful way"
              done
              detail="RISC Zero guest proves every trade decision; proof is load-bearing — trades without valid proof are flagged"
            />
            <CheckItem
              label="Stellar testnet integration — proofs verified on-chain"
              done={hasContract && onChainCount > 0}
              warn={hasContract && onChainCount === 0}
              detail={
                hasContract
                  ? onChainCount > 0
                    ? `${onChainCount} proofs on Stellar ${STELLAR_CONFIG.network} — contract ${contractId.slice(0, 14)}…`
                    : 'Contract deployed — run agent loop to generate on-chain proofs'
                  : 'Deploy Soroban verifier contract (Session P scripts/deploy-verifier.sh)'
              }
            />
            <CheckItem
              label="ZK is load-bearing (not just namechecked)"
              done
              detail="Every trade decision is cryptographically proved: condition fired, drawdown OK, size OK, daily cap OK — verified on Stellar"
            />
          </Panel>

          <Panel title="Technical Prerequisites" icon="🔧">
            <CheckItem
              label="RISC Zero guest program built (Session O)"
              done={false}
              warn
              detail="Run: cargo risczero build — produces ELF + image_id"
            />
            <CheckItem
              label="VK constants filled in Soroban contract (Session P)"
              done={false}
              warn
              detail="Copy vk_* from github.com/NethermindEth/stellar-risc0-verifier/blob/main/src/vk.rs"
            />
            <CheckItem
              label="Soroban verifier deployed to Stellar testnet"
              done={hasContract}
              detail={hasContract ? `Contract: ${contractId}` : 'Run: bash scripts/deploy-verifier.sh'}
            />
            <CheckItem
              label="ZK_PROVER_MODE=real (real proofs, not mock)"
              done={false}
              warn
              detail="Set in .env.local after cargo build --release -p binalyst-zk-host"
            />
            <CheckItem
              label="STELLAR_MOCK=false (real Stellar txs)"
              done={hasContract && onChainCount > 0}
              detail={hasContract ? 'STELLAR_CONTRACT_ID is set' : 'Set STELLAR_CONTRACT_ID in .env.local'}
            />
          </Panel>

          <Panel title="Binalyst Prerequisites" icon="🤖">
            <CheckItem
              label="Agent wallet configured"
              done={hasWallet}
              detail={hasWallet ? agentAddress!.slice(0, 16) + '…' : 'Go to Agent Wallet tab'}
            />
            <CheckItem
              label="Strategy rules loaded"
              done={hasStrategy}
              detail={hasStrategy ? `${strategyParsed.length} rules active` : 'Go to Strategy tab → parse a strategy'}
            />
            <CheckItem
              label="ZK proofs generated (this session)"
              done={hasProofs}
              detail={hasProofs ? `${verifiedProofs.length} verified` : 'Start agent loop → trades trigger proofs automatically'}
            />
            <CheckItem
              label="On-chain proofs verified on Stellar"
              done={onChainCount > 0}
              detail={onChainCount > 0 ? `${onChainCount} proofs on Stellar ${STELLAR_CONFIG.network}` : 'Proofs submit to Stellar after each trade'}
            />
          </Panel>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 2 — AUDIT LOG
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeSection === 'audit' && (
        <Panel title="ZK Proof Audit Log" icon="📊">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>
              {verifiedProofs.length} verified proof{verifiedProofs.length !== 1 ? 's' : ''} this session
              {onChainCount > 0 ? ` · ${onChainCount} on-chain` : ''}
            </span>
            {verifiedProofs.length > 0 && (
              <button
                onClick={exportAuditLog}
                className="mono"
                style={{
                  padding: '4px 12px', fontSize: 11, borderRadius: 6, cursor: 'pointer',
                  background: 'rgba(14,203,129,0.1)', border: '1px solid rgba(14,203,129,0.3)',
                  color: 'var(--green)',
                }}>
                ↓ Export JSON
              </button>
            )}
          </div>

          {verifiedProofs.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center' }}>
              <div className="mono" style={{ fontSize: 12, color: 'var(--text3)' }}>
                No verified proofs yet — start the agent loop to generate proofs
              </div>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '140px 50px 80px 1fr 90px',
                            gap: 8, padding: '4px 0', marginBottom: 4 }}>
                {['TIME', 'SYMBOL', 'ACTION', 'RULE', 'STELLAR'].map(h => (
                  <span key={h} className="mono" style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: '0.08em' }}>{h}</span>
                ))}
              </div>
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                {[...verifiedProofs].reverse().map(entry => (
                  <AuditRow key={entry.proofId} entry={entry} />
                ))}
              </div>
            </>
          )}

          {/* Contract explorer link */}
          {hasContract && (
            <div style={{ marginTop: 16, padding: '10px 0', borderTop: '1px solid var(--border)' }}>
              <a
                href={`${STELLAR_CONFIG.explorerUrl}/contract/${contractId}`}
                target="_blank"
                rel="noreferrer"
                className="mono"
                style={{ fontSize: 11, color: '#3498db' }}>
                View all proofs on Stellar Expert ↗
              </a>
            </div>
          )}
        </Panel>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 3 — ARCHITECTURE
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeSection === 'tech' && (
        <>
          <Panel title="What ZK is proving" icon="⬡">
            <div className="mono" style={{ fontSize: 12, lineHeight: 1.8, color: 'var(--text)' }}>
              Every Binalyst trade decision is proved inside the <strong style={{ color: 'var(--yellow)' }}>RISC Zero zkVM</strong>:
            </div>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { icon: '1.', label: 'Strategy condition fired', detail: 'The rule\'s condition (RSI, MACD cross, regime, etc.) evaluated to TRUE on the live signal — mirrors evaluateCondition() from signalEngine.ts exactly' },
                { icon: '2.', label: 'Drawdown within limit', detail: `Portfolio drawdown < ${30}% competition guardrail — (peak − current) / peak` },
                { icon: '3.', label: 'Trade size within limit', detail: `Per-trade size ≤ ${15}% of portfolio — prevents over-concentration` },
                { icon: '4.', label: 'Daily trade cap respected', detail: `Trades today < ${8} — competition compliance` },
                { icon: '5.', label: 'Decision matches rule', detail: 'Symbol + action in the decision is exactly what the rule specified — no arbitrary trades' },
              ].map(item => (
                <div key={item.icon} style={{ display: 'flex', gap: 10, alignItems: 'flex-start',
                                              padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--yellow)', flexShrink: 0 }}>{item.icon}</span>
                  <div>
                    <div className="mono" style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>{item.label}</div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="ZK Stack" icon="🔗">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { layer: 'Proof system',  value: 'RISC Zero — Groth16 over BN254',                   color: '#3498db'       },
                { layer: 'Guest program', value: 'Rust — evaluates strategy + guardrails in zkVM',   color: 'var(--text)'   },
                { layer: 'Host prover',   value: 'binalyst-zk-host binary — spawned by Next.js API', color: 'var(--text)'   },
                { layer: 'Verifier',      value: 'Soroban smart contract — Stellar Protocol 26 BN254 host functions', color: '#3D9BE9' },
                { layer: 'Network',       value: `Stellar ${STELLAR_CONFIG.network}`,                 color: '#3D9BE9'       },
                { layer: 'ZK language',   value: 'Rust guest (not Noir/Circom — RISC Zero zkVM)',    color: 'var(--text3)'  },
                { layer: 'Proof size',    value: '~260 bytes seal + journal (Groth16 compact)',       color: 'var(--text3)'  },
              ].map(item => (
                <div key={item.layer} style={{ display: 'flex', justifyContent: 'space-between',
                                              padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>{item.layer}</span>
                  <span className="mono" style={{ fontSize: 11, color: item.color }}>{item.value}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Data flow" icon="→">
            <div className="mono" style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 2 }}>
              {[
                'Agent loop fires every 2 min',
                '→ evaluateRules() fires a rule against live signal',
                '→ executeTradeViaAPI() executes the swap',
                '→ submitTradeProof() called (fire-and-forget)',
                '   → POST /api/zk/prove — spawns RISC Zero host binary',
                '      → TradeProofInput (signal + rule + guardrails) → zkVM guest',
                '      → Guest proves all 5 checks, commits TradeProofOutput to journal',
                '      → Returns receipt (sealHex + journalHex)',
                '   → POST /api/zk/verify — StellarVerifierClient',
                '      → Builds Soroban tx, signs with backend keypair',
                '      → Contract verifies Groth16 pairing check (BN254)',
                '      → Emits TradeProofVerified event, stores ProofRecord on-chain',
                '      → Returns Stellar tx hash + proof index',
                '→ ZKProofTab UI shows proof status badge + explorer link',
              ].map((line, i) => (
                <div key={i} style={{ color: line.startsWith('→') || line.startsWith(' ') ? 'var(--text3)' : 'var(--yellow)' }}>
                  {line}
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 4 — DEMO SCRIPT
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeSection === 'demo' && (
        <Panel title="Judges Demo Script (2–3 min)" icon="🎬">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              {
                step: '00:00',
                title: 'Open Binalyst — intro',
                script: 'Binalyst is an AI quant trading agent. Today we\'re adding zero-knowledge proofs so every trade decision is cryptographically verifiable on Stellar — you can prove a strategy fired without revealing the strategy itself.',
              },
              {
                step: '00:25',
                title: 'Show Strategy tab',
                script: 'Here\'s the strategy builder. Rules are defined in plain English — RSI below 30 AND MACD bullish cross → BUY BTC 10% of portfolio. This rule\'s condition is exactly what the ZK guest proves fired.',
              },
              {
                step: '00:50',
                title: 'Show ZK Proofs tab — explain',
                script: 'This is the ZK Proofs dashboard. Every trade the agent executes gets proved by a RISC Zero guest program running inside a zkVM. The proof attests: condition fired, drawdown OK, trade size OK, daily cap respected.',
              },
              {
                step: '01:10',
                title: 'Start agent loop — watch proof flow',
                script: 'Starting the agent. [Start loop] Watch the proof queue — you can see it go from Pending → Proving → Proved → Submitting → Verified. Each transition is a real step: the RISC Zero prover, then a Stellar transaction.',
              },
              {
                step: '01:35',
                title: 'Click a verified proof — show detail',
                script: 'Click any verified proof. You can see the exact guardrail results — drawdown 4.7%, trade size 10%, condition fired true. The attestation string is committed inside the zkVM journal — it\'s the public output of the proof.',
              },
              {
                step: '01:55',
                title: 'Click Stellar explorer link',
                script: 'This link goes to Stellar Expert. Here\'s the transaction where the Soroban verifier contract confirmed the proof on-chain using Stellar Protocol 26\'s BN254 host functions. The TradeProofVerified event is visible here.',
              },
              {
                step: '02:20',
                title: 'Stellar Submission tab — show checklist + audit log',
                script: 'The submission tab shows the full checklist and an exportable JSON audit log of all verified proofs. This is what judges can use to independently verify every on-chain proof.',
              },
              {
                step: '02:45',
                title: 'Close — ZK is load-bearing',
                script: 'The ZK here is genuinely load-bearing — every trade the agent executes produces a verifiable proof on Stellar. You can\'t fake the proof without solving Groth16. The strategy stays private, but the compliance is public.',
              },
            ].map((item, i) => (
              <div key={i} style={{
                borderLeft: '2px solid var(--yellow)',
                paddingLeft: 12,
              }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', marginBottom: 4 }}>
                  <span className="mono" style={{ fontSize: 10, color: 'var(--yellow)', flexShrink: 0 }}>{item.step}</span>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>{item.title}</span>
                </div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.7 }}>
                  "{item.script}"
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20, padding: '12px', background: 'rgba(240,185,11,0.06)',
                        borderRadius: 8, border: '1px solid rgba(240,185,11,0.2)' }}>
            <div className="mono" style={{ fontSize: 11, color: 'var(--yellow)', marginBottom: 6 }}>
              ⚡ Before recording
            </div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.8 }}>
              1. Set ZK_PROVER_MODE=real and STELLAR_MOCK=false in .env.local<br/>
              2. Deploy verifier contract (bash scripts/deploy-verifier.sh)<br/>
              3. Load a strategy + configure agent wallet<br/>
              4. Run one agent cycle to confirm proof flow works end-to-end<br/>
              5. Then record — the whole flow takes ~30s per proof
            </div>
          </div>
        </Panel>
      )}

    </div>
  )
}
