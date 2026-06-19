'use client'

/**
 * components/tabs/ZKProofTab.tsx — Session R
 *
 * ZK proof dashboard for Binalyst × Stellar Hacks.
 * Shows the live proof queue, receipt hashes, Stellar tx links,
 * and a per-trade proof status badge.
 *
 * Data flow:
 *   agent loop → POST /api/zk/prove → POST /api/zk/verify
 *   → ZKProofEntry[] stored in zkProofSlice (lib/zkProofStore.ts)
 *   → this component reads + renders them
 */

import { useEffect, useState, useCallback } from 'react'
import { useZKProofStore }  from '@/lib/zkProofStore'
import { STELLAR_CONFIG }   from '@/lib/stellar/client'
import type { ZKProofEntry, ZKProofStatus } from '@/lib/stellar/types'

// ─────────────────────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────────────────────

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}
function fmtUSD(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtMs(ms: number | null) {
  if (!ms) return '—'
  if (ms < 1000)  return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}
function truncate(s: string, n = 12) {
  if (!s || s.length <= n) return s
  return s.slice(0, n) + '…'
}

// ─────────────────────────────────────────────────────────────────────────────
// Status config
// ─────────────────────────────────────────────────────────────────────────────

const STATUS: Record<ZKProofStatus, { label: string; color: string; bg: string; icon: string }> = {
  pending:    { label: 'Pending',    color: 'var(--text3)',  bg: 'var(--bg3)',                  icon: '◌' },
  proving:    { label: 'Proving',    color: 'var(--yellow)', bg: 'rgba(240,185,11,0.12)',        icon: '⟳' },
  proved:     { label: 'Proved',     color: '#3498db',       bg: 'rgba(52,152,219,0.12)',        icon: '✓' },
  submitting: { label: 'Submitting', color: 'var(--yellow)', bg: 'rgba(240,185,11,0.12)',        icon: '⟳' },
  verified:   { label: 'Verified ✓', color: 'var(--green)',  bg: 'rgba(14,203,129,0.12)',        icon: '⬡' },
  failed:     { label: 'Failed',     color: 'var(--red)',    bg: 'rgba(246,70,93,0.12)',         icon: '✗' },
}

// ─────────────────────────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ZKProofStatus }) {
  const cfg = STATUS[status]
  const isSpinning = status === 'proving' || status === 'submitting'
  return (
    <span
      className="mono"
      style={{
        display:      'inline-flex',
        alignItems:   'center',
        gap:          4,
        padding:      '2px 8px',
        borderRadius: 4,
        fontSize:     11,
        color:        cfg.color,
        background:   cfg.bg,
        border:       `1px solid ${cfg.color}33`,
      }}>
      <span style={{ animation: isSpinning ? 'spin 1s linear infinite' : 'none' }}>
        {cfg.icon}
      </span>
      {cfg.label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Proof row
// ─────────────────────────────────────────────────────────────────────────────

function ProofRow({ entry, onExpand }: {
  entry:    ZKProofEntry
  onExpand: (id: string) => void
}) {
  const actionColor = entry.action === 'BUY' ? 'var(--green)' : 'var(--red)'

  return (
    <div
      onClick={() => onExpand(entry.proofId)}
      style={{
        display:       'grid',
        gridTemplateColumns: '1fr 60px 90px 80px 100px 80px',
        alignItems:    'center',
        gap:           8,
        padding:       '10px 16px',
        borderBottom:  '1px solid var(--border)',
        cursor:        'pointer',
        transition:    'background 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      {/* Rule + time */}
      <div>
        <div className="mono" style={{ fontSize: 12, color: 'var(--text)' }}>
          {truncate(entry.ruleName, 28)}
        </div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
          {fmtTime(entry.decidedAt)}
        </div>
      </div>

      {/* Symbol */}
      <div className="mono" style={{ fontSize: 12, color: 'var(--yellow)' }}>
        {entry.symbol}
      </div>

      {/* Action */}
      <div className="mono" style={{ fontSize: 12, color: actionColor, fontWeight: 700 }}>
        {entry.action} {fmtUSD(entry.amountUSDT)}
      </div>

      {/* Elapsed */}
      <div className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>
        {fmtMs(entry.elapsedMs)}
      </div>

      {/* Stellar tx */}
      <div>
        {entry.explorerUrl
          ? <a
              href={entry.explorerUrl}
              target="_blank"
              rel="noreferrer"
              onClick={e => e.stopPropagation()}
              className="mono"
              style={{ fontSize: 10, color: '#3498db', textDecoration: 'none' }}>
              #{entry.proofIndex} ↗
            </a>
          : <span className="mono" style={{ fontSize: 10, color: 'var(--text3)' }}>—</span>
        }
      </div>

      {/* Status */}
      <div><StatusBadge status={entry.status} /></div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Expanded proof detail panel
// ─────────────────────────────────────────────────────────────────────────────

function ProofDetail({ entry, onClose }: { entry: ZKProofEntry; onClose: () => void }) {
  const o = entry.output

  return (
    <div style={{
      position:    'fixed', inset: 0, zIndex: 100,
      background:  'rgba(0,0,0,0.7)',
      display:     'flex', alignItems: 'center', justifyContent: 'center',
      padding:     16,
    }}
    onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background:   'var(--bg2)',
          border:       '1px solid var(--border)',
          borderRadius: 12,
          padding:      24,
          maxWidth:     560,
          width:        '100%',
          maxHeight:    '80vh',
          overflowY:    'auto',
        }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <span className="mono" style={{ fontSize: 13, color: 'var(--yellow)' }}>
              ZK Proof #{entry.proofIndex ?? '…'}
            </span>
            <StatusBadge status={entry.status} />
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 18 }}>✕</button>
        </div>

        {/* Decision */}
        <Section label="Trade Decision">
          <Row label="Symbol"   value={entry.symbol} />
          <Row label="Action"   value={entry.action} color={entry.action === 'BUY' ? 'var(--green)' : 'var(--red)'} />
          <Row label="Amount"   value={fmtUSD(entry.amountUSDT)} />
          <Row label="Rule"     value={entry.ruleName} />
          <Row label="Decided"  value={fmtTime(entry.decidedAt)} />
        </Section>

        {/* Proof output */}
        {o && (
          <Section label="ZK Proof Output">
            <Row label="Valid"           value={o.valid ? '✓ Yes' : '✗ No'} color={o.valid ? 'var(--green)' : 'var(--red)'} />
            <Row label="Condition fired" value={o.condition_fired ? 'Yes' : 'No'} />
            <Row label="Drawdown"        value={`${o.drawdown_pct.toFixed(2)}% — ${o.drawdown_ok ? '✓ OK' : '✗ FAIL'}`} />
            <Row label="Trade size"      value={`${o.trade_size_pct.toFixed(2)}% — ${o.trade_size_ok ? '✓ OK' : '✗ FAIL'}`} />
            <Row label="Daily trades"    value={o.daily_trades_ok ? '✓ OK' : '✗ FAIL'} />
            <Row label="Dry run"         value={o.dry_run ? 'Yes (simulation)' : 'No (live)'} />
            <Row label="Prove time"      value={fmtMs(entry.elapsedMs)} />
          </Section>
        )}

        {/* Attestation */}
        {o?.attestation && (
          <Section label="Attestation">
            <div className="mono" style={{
              fontSize: 10, color: 'var(--text3)', wordBreak: 'break-all',
              background: 'var(--bg3)', borderRadius: 6, padding: 10, lineHeight: 1.6,
            }}>
              {o.attestation}
            </div>
          </Section>
        )}

        {/* Stellar */}
        <Section label="Stellar">
          <Row label="Network" value={STELLAR_CONFIG.network} />
          {entry.stellarTxId
            ? <Row label="Tx ID" value={truncate(entry.stellarTxId, 20)} />
            : <Row label="Tx ID" value="—" />
          }
          {entry.explorerUrl && (
            <a
              href={entry.explorerUrl}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'block', marginTop: 8, fontSize: 12, color: '#3498db' }}>
              View on Stellar Expert ↗
            </a>
          )}
          {entry.explorerUrl === null && entry.status !== 'verified' && (
            <div className="mono" style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
              Not yet submitted to Stellar
            </div>
          )}
        </Section>

        {/* Error */}
        {entry.error && (
          <Section label="Error">
            <div className="mono" style={{
              fontSize: 11, color: 'var(--red)', wordBreak: 'break-all',
              background: 'rgba(246,70,93,0.08)', borderRadius: 6, padding: 10,
            }}>
              {entry.error}
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="mono" style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '0.1em', marginBottom: 8 }}>
        {label.toUpperCase()}
      </div>
      {children}
    </div>
  )
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
      <span className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>{label}</span>
      <span className="mono" style={{ fontSize: 11, color: color ?? 'var(--text)' }}>{value}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats bar
// ─────────────────────────────────────────────────────────────────────────────

function StatsBar({ proofs, onChainCount }: { proofs: ZKProofEntry[]; onChainCount: number }) {
  const verified  = proofs.filter(p => p.status === 'verified').length
  const failed    = proofs.filter(p => p.status === 'failed').length
  const pending   = proofs.filter(p => p.status === 'pending' || p.status === 'proving' || p.status === 'submitting').length

  const stats = [
    { label: 'Total',      value: proofs.length,  color: 'var(--text)'   },
    { label: 'Verified',   value: verified,        color: 'var(--green)'  },
    { label: 'Pending',    value: pending,         color: 'var(--yellow)' },
    { label: 'Failed',     value: failed,          color: 'var(--red)'    },
    { label: 'On-chain',   value: onChainCount,    color: '#3498db'       },
  ]

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: '12px 16px',
                  borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
      {stats.map(s => (
        <div key={s.label} style={{ textAlign: 'center', minWidth: 56 }}>
          <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
          <div className="mono" style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: '0.08em' }}>
            {s.label.toUpperCase()}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Contract info bar
// ─────────────────────────────────────────────────────────────────────────────

function ContractBar({ onChainCount, contractId }: { onChainCount: number; contractId: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px',
      background: 'rgba(52,152,219,0.06)', borderBottom: '1px solid var(--border)',
      flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 16 }}>⬡</span>
      <span className="mono" style={{ fontSize: 11, color: '#3498db' }}>
        Stellar {STELLAR_CONFIG.network}
      </span>
      {contractId && (
        <>
          <span className="mono" style={{ fontSize: 10, color: 'var(--text3)' }}>
            Contract: {truncate(contractId, 16)}
          </span>
          <a
            href={`${STELLAR_CONFIG.explorerUrl}/contract/${contractId}`}
            target="_blank"
            rel="noreferrer"
            className="mono"
            style={{ fontSize: 10, color: '#3498db', textDecoration: 'none' }}>
            Explorer ↗
          </a>
        </>
      )}
      <span className="mono" style={{ fontSize: 11, color: 'var(--green)', marginLeft: 'auto' }}>
        {onChainCount} proof{onChainCount !== 1 ? 's' : ''} on-chain
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main tab
// ─────────────────────────────────────────────────────────────────────────────

export default function ZKProofTab() {
  const { proofs, clearProofs } = useZKProofStore()
  const [expandedId,    setExpandedId]    = useState<string | null>(null)
  const [filterStatus,  setFilterStatus]  = useState<ZKProofStatus | 'all'>('all')
  const [onChainCount,  setOnChainCount]  = useState(0)
  const [contractId,    setContractId]    = useState(STELLAR_CONFIG.contractId)
  const [healthLoading, setHealthLoading] = useState(false)

  // Fetch on-chain proof count
  const fetchHealth = useCallback(async () => {
    setHealthLoading(true)
    try {
      const res = await fetch('/api/zk/verify')
      if (res.ok) {
        const data = await res.json()
        setOnChainCount(data.proofCount ?? 0)
        if (data.contractId) setContractId(data.contractId)
      }
    } catch { /* silent */ }
    finally { setHealthLoading(false) }
  }, [])

  useEffect(() => { fetchHealth() }, [fetchHealth])

  const expandedEntry = expandedId
    ? proofs.find(p => p.proofId === expandedId) ?? null
    : null

  const filtered = filterStatus === 'all'
    ? proofs
    : proofs.filter(p => p.status === filterStatus)

  const sortedProofs = [...filtered].sort((a, b) => b.decidedAt - a.decidedAt)

  const FILTERS: Array<ZKProofStatus | 'all'> = ['all', 'verified', 'proving', 'pending', 'failed']

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', borderBottom: '1px solid var(--border)',
      }}>
        <div>
          <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--yellow)' }}>
            ⬡ ZK Trade Proofs
          </div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
            RISC Zero · Stellar {STELLAR_CONFIG.network}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={fetchHealth}
            disabled={healthLoading}
            className="mono"
            style={{
              padding: '4px 10px', fontSize: 11, borderRadius: 6, cursor: 'pointer',
              background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text3)',
            }}>
            {healthLoading ? '⟳' : '↻'} Refresh
          </button>
          {proofs.length > 0 && (
            <button
              onClick={clearProofs}
              className="mono"
              style={{
                padding: '4px 10px', fontSize: 11, borderRadius: 6, cursor: 'pointer',
                background: 'rgba(246,70,93,0.1)', border: '1px solid rgba(246,70,93,0.3)',
                color: 'var(--red)',
              }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Contract bar ─────────────────────────────────────────────────────── */}
      <ContractBar onChainCount={onChainCount} contractId={contractId} />

      {/* ── Stats bar ────────────────────────────────────────────────────────── */}
      <StatsBar proofs={proofs} onChainCount={onChainCount} />

      {/* ── Filter bar ───────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 6, padding: '8px 16px',
        borderBottom: '1px solid var(--border)', background: 'var(--bg)',
      }}>
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilterStatus(f)}
            className="mono"
            style={{
              padding:      '3px 10px',
              fontSize:     10,
              borderRadius: 4,
              cursor:       'pointer',
              border:       filterStatus === f ? '1px solid var(--yellow)' : '1px solid var(--border)',
              background:   filterStatus === f ? 'rgba(240,185,11,0.1)' : 'transparent',
              color:        filterStatus === f ? 'var(--yellow)' : 'var(--text3)',
              letterSpacing: '0.06em',
            }}>
            {f.toUpperCase()}
          </button>
        ))}
        <span className="mono" style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 'auto', alignSelf: 'center' }}>
          {sortedProofs.length} proof{sortedProofs.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Table header ─────────────────────────────────────────────────────── */}
      {sortedProofs.length > 0 && (
        <div
          className="mono"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 60px 90px 80px 100px 80px',
            gap: 8, padding: '6px 16px',
            fontSize: 9, color: 'var(--text3)', letterSpacing: '0.08em',
            borderBottom: '1px solid var(--border)', background: 'var(--bg2)',
          }}>
          <span>RULE / TIME</span>
          <span>SYMBOL</span>
          <span>ACTION</span>
          <span>ELAPSED</span>
          <span>STELLAR</span>
          <span>STATUS</span>
        </div>
      )}

      {/* ── Proof list ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {sortedProofs.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⬡</div>
            <div className="mono" style={{ fontSize: 13, color: 'var(--text3)' }}>
              {proofs.length === 0
                ? 'No proofs yet — start the agent loop to generate ZK proofs'
                : `No ${filterStatus} proofs`}
            </div>
            {proofs.length === 0 && (
              <div className="mono" style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
                Every trade decision is automatically proved and verified on Stellar
              </div>
            )}
          </div>
        ) : (
          sortedProofs.map(entry => (
            <ProofRow
              key={entry.proofId}
              entry={entry}
              onExpand={setExpandedId}
            />
          ))
        )}
      </div>

      {/* ── Expanded detail modal ────────────────────────────────────────────── */}
      {expandedEntry && (
        <ProofDetail
          entry={expandedEntry}
          onClose={() => setExpandedId(null)}
        />
      )}

      {/* ── Spin keyframe ────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
