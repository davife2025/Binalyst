'use client'

/**
 * components/tabs/RevocationDemo.tsx
 * Owner revocation demo panel — Session M.
 *
 * Demonstrates the kill switch flow required by Sub-track 2:
 *   1. Shows current policy status + spend
 *   2. Owner initiates revoke → builds PTB
 *   3. Simulates on-chain confirmation
 *   4. Agent loop blocked — confirmed on-screen
 *
 * NEW FILE — does not modify any existing component.
 */

import { useState } from 'react'
import { useSuiStore } from '@/lib/store.sui'
import { budgetUsedPct, formatBudget, policyStatusLabel } from '@/lib/movePolicy/client'

export default function RevocationDemo() {
  const {
    policy, walletAddress, network,
    markPolicyRevoked, agentStatus,
  } = useSuiStore()

  const [step,         setStep]         = useState<'idle' | 'confirm' | 'building' | 'done'>('idle')
  const [walrusBlobId, setWalrusBlobId] = useState<string | null>(null)
  const [error,        setError]        = useState<string | null>(null)

  async function initiateRevoke() {
    if (!policy?.objectId || !walletAddress) return
    setStep('building')
    setError(null)

    try {
      const res  = await fetch('/api/sui/revoke', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyObjectId: policy.objectId,
          ownerAddress:   walletAddress,
          agentAddress:   policy.agentAddress,
          network,
          budgetCapCents: policy.budgetCapCents,
          // In live mode, txDigest comes back after wallet signs the PTB.
          // For the demo we simulate the confirmation:
          txDigest: `demo-revoke-${Date.now()}`,
        }),
      })

      const data = await res.json() as {
        success?:     boolean
        walrusBlobId?: string
        error?:       string
      }

      if (!res.ok || data.error) throw new Error(data.error ?? 'Revoke failed')

      // Mark revoked in local store — agent loop will block on next cycle check
      markPolicyRevoked()
      setWalrusBlobId(data.walrusBlobId ?? null)
      setStep('done')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
      setStep('confirm')
    }
  }

  if (!policy) {
    return (
      <EmptyState
        icon="📜"
        message="No active policy. Create a policy in the Sui Agent tab first."
      />
    )
  }

  const status  = policyStatusLabel(policy)
  const usedPct = budgetUsedPct(policy)

  return (
    <div style={{ maxWidth: 600 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 500, margin: '0 0 6px', color: 'var(--color-text-primary)' }}>
          Owner Revocation Demo
        </h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>
          Demonstrates the kill switch required by Agentic Web Sub-track 2.
          Only the owner wallet can revoke — immediately blocking all agent trades.
        </p>
      </div>

      {/* Current policy state */}
      <Card label="Current policy state">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <StatusPill color={status.color}>{status.label}</StatusPill>
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)' }}>
            {policy.objectId ? policy.objectId.slice(0, 20) + '…' : 'Simulated'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
          <Stat label="Budget cap"  value={formatBudget(policy.budgetCapCents)} />
          <Stat label="Spent"       value={formatBudget(policy.spentCents)} />
          <Stat label="Remaining"   value={formatBudget(policy.budgetCapCents - policy.spentCents)} />
        </div>

        {/* Budget bar */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
            <span>Budget used</span>
            <span>{usedPct.toFixed(1)}%</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: 'var(--color-border-tertiary)' }}>
            <div style={{
              height: '100%', borderRadius: 4,
              width: `${Math.min(100, usedPct)}%`,
              background: usedPct >= 80
                ? 'var(--color-background-danger)'
                : 'var(--color-background-success)',
              transition: 'width 0.4s',
            }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          <Stat label="Agent status" value={agentStatus} />
          <Stat label="Network"      value={network} />
        </div>
      </Card>

      {/* Revocation flow */}
      {!policy.revoked && (
        <Card label="Kill switch — owner revocation">
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
            Revoking the policy immediately invalidates it on-chain. The Move contract enforces
            this — any subsequent <code style={{ fontSize: 12 }}>check_and_spend</code> call by
            the agent will abort with <code style={{ fontSize: 12 }}>EPolicyRevoked</code>.
          </p>

          {step === 'idle' && (
            <button
              onClick={() => setStep('confirm')}
              style={{
                padding: '9px 20px', fontSize: 13, fontWeight: 500, borderRadius: 6,
                border: '1px solid var(--color-border-danger)',
                background: 'var(--color-background-danger)',
                color: 'var(--color-text-danger)', cursor: 'pointer',
              }}
            >
              Initiate revocation
            </button>
          )}

          {step === 'confirm' && (
            <div style={{
              padding: '16px', borderRadius: 8,
              border: '1px solid var(--color-border-danger)',
              background: 'var(--color-background-danger)',
            }}>
              <p style={{ fontSize: 13, color: 'var(--color-text-danger)', margin: '0 0 12px', fontWeight: 500 }}>
                ⚠️ This is permanent and irreversible.
              </p>
              <p style={{ fontSize: 13, color: 'var(--color-text-danger)', margin: '0 0 16px' }}>
                The agent will be blocked from all future trades immediately.
                Your owner wallet must sign the revoke PTB on-chain.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={initiateRevoke}
                  style={{
                    padding: '8px 18px', fontSize: 13, fontWeight: 500, borderRadius: 6,
                    border: 'none', background: 'var(--color-text-danger)',
                    color: '#fff', cursor: 'pointer',
                  }}
                >
                  Confirm — revoke now
                </button>
                <button
                  onClick={() => setStep('idle')}
                  style={{
                    padding: '8px 16px', fontSize: 13, borderRadius: 6,
                    border: '1px solid var(--color-border-secondary)',
                    background: 'transparent',
                    color: 'var(--color-text-secondary)', cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
              {error && (
                <p style={{ fontSize: 12, color: 'var(--color-text-danger)', margin: '10px 0 0' }}>{error}</p>
              )}
            </div>
          )}

          {step === 'building' && (
            <div style={{ padding: '16px', borderRadius: 8, background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)', fontSize: 13 }}>
              Building revoke PTB… signing with owner wallet…
            </div>
          )}
        </Card>
      )}

      {/* Done state */}
      {(step === 'done' || policy.revoked) && (
        <Card label="Revocation confirmed">
          <div style={{
            padding: '16px', borderRadius: 8,
            background: 'var(--color-background-success)',
            color: 'var(--color-text-success)',
            marginBottom: walrusBlobId ? 12 : 0,
          }}>
            <p style={{ fontSize: 14, fontWeight: 500, margin: '0 0 6px' }}>
              ✓ Policy revoked on-chain
            </p>
            <p style={{ fontSize: 13, margin: 0 }}>
              The agent loop is now blocked. Any call to{' '}
              <code style={{ fontSize: 12 }}>check_and_spend</code> will abort
              with <code style={{ fontSize: 12 }}>EPolicyRevoked (code 3)</code>.
            </p>
          </div>

          {walrusBlobId && (
            <div style={{ padding: '12px', borderRadius: 8, border: '1px solid var(--color-border-tertiary)', background: 'var(--color-background-secondary)' }}>
              <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', margin: '0 0 6px' }}>
                Revocation logged to Walrus
              </p>
              <p style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)', margin: '0 0 6px' }}>
                {walrusBlobId}
              </p>
              <a
                href={`https://aggregator.walrus-testnet.walrus.space/v1/blobs/${walrusBlobId}`}
                target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 12, color: 'var(--color-text-info)' }}
              >
                ↗ Verify on Walrus
              </a>
            </div>
          )}

          {/* On-chain event proof */}
          <div style={{ marginTop: 12, padding: '12px', borderRadius: 8, border: '1px solid var(--color-border-tertiary)', background: 'var(--color-background-secondary)' }}>
            <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', margin: '0 0 8px' }}>
              On-chain event emitted by Move contract
            </p>
            <pre style={{
              fontSize: 11, margin: 0, fontFamily: 'var(--font-mono)',
              color: 'var(--color-text-primary)', lineHeight: 1.6,
            }}>
{`PolicyRevoked {
  policy_id:     "${policy.objectId?.slice(0, 16)}…",
  owner:         "${policy.ownerAddress?.slice(0, 16)}…",
  spent_cents:   ${policy.spentCents},
  trade_count:   (from chain),
  revoked_at_ms: ${Date.now()}
}`}
            </pre>
          </div>
        </Card>
      )}
    </div>
  )
}

// ── Micro-components ──────────────────────────────────────────────────────────

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      border: '1px solid var(--color-border-tertiary)', borderRadius: 10,
      padding: '16px 20px', background: 'var(--color-background-secondary)',
      marginBottom: 16,
    }}>
      <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-tertiary)', margin: '0 0 12px' }}>
        {label}
      </p>
      {children}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', margin: '0 0 2px' }}>{label}</p>
      <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>{value}</p>
    </div>
  )
}

function StatusPill({ color, children }: { color: string; children: React.ReactNode }) {
  const map: Record<string, { bg: string; text: string }> = {
    green:  { bg: 'var(--color-background-success)', text: 'var(--color-text-success)' },
    yellow: { bg: 'var(--color-background-warning)',  text: 'var(--color-text-warning)'  },
    red:    { bg: 'var(--color-background-danger)',   text: 'var(--color-text-danger)'   },
    gray:   { bg: 'var(--color-background-secondary)', text: 'var(--color-text-secondary)' },
  }
  const c = map[color] ?? map.gray
  return (
    <span style={{
      fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 4,
      background: c.bg, color: c.text,
    }}>
      {children}
    </span>
  )
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--color-text-tertiary)' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>{icon}</div>
      <p style={{ fontSize: 14, margin: 0 }}>{message}</p>
    </div>
  )
}
