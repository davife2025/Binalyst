'use client'

/**
 * components/tabs/RevocationDemo.tsx
 * Owner revocation demo — Session M (UI rebuild).
 * Styled with Binalyst's design system.
 */

import { useState } from 'react'
import { useSuiStore } from '@/lib/store.sui'
import { budgetUsedPct, formatBudget, policyStatusLabel } from '@/lib/movePolicy/client'

export default function RevocationDemo() {
  const { policy, walletAddress, network, markPolicyRevoked, agentStatus } = useSuiStore()
  const [step,         setStep]         = useState<'idle'|'confirm'|'building'|'done'>('idle')
  const [walrusBlobId, setWalrusBlobId] = useState<string | null>(null)
  const [error,        setError]        = useState<string | null>(null)

  async function initiateRevoke() {
    if (!policy?.objectId || !walletAddress) return
    setStep('building'); setError(null)
    try {
      const res  = await fetch('/api/sui/revoke', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyObjectId: policy.objectId, ownerAddress: walletAddress,
          agentAddress: policy.agentAddress, network,
          budgetCapCents: policy.budgetCapCents,
          txDigest: `demo-revoke-${Date.now()}`,
        }),
      })
      const data = await res.json() as { success?: boolean; walrusBlobId?: string; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Revoke failed')
      markPolicyRevoked()
      setWalrusBlobId(data.walrusBlobId ?? null)
      setStep('done')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
      setStep('confirm')
    }
  }

  if (!policy) return (
    <div className="flex items-center justify-center h-40">
      <p className="mono text-[12px]" style={{ color: 'var(--text3)' }}>
        No active policy. Create one in the Sui Agent → Policy tab first.
      </p>
    </div>
  )

  const status  = policyStatusLabel(policy)
  const usedPct = budgetUsedPct(policy)
  const statusColors: Record<string, string> = {
    green: 'var(--green)', yellow: 'var(--yellow)', red: 'var(--red)', gray: 'var(--text3)',
  }

  return (
    <div className="flex flex-col gap-4 max-w-lg">
      {/* Header */}
      <div>
        <h2 style={{ color: 'var(--text)', fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
          Owner Revocation Demo
        </h2>
        <p className="text-sm" style={{ color: 'var(--text2)' }}>
          Demonstrates the on-chain kill switch required by Sub-track 2.
          Only the owner wallet can revoke — immediately blocking all agent trades.
        </p>
      </div>

      {/* Policy state */}
      <div className="p-4 rounded-xl" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
        <div className="mono text-[10px] uppercase tracking-widest mb-3" style={{ color: 'var(--text3)' }}>Policy state</div>

        <div className="flex justify-between items-center mb-4">
          <span className="mono text-[11px] px-2 py-0.5 rounded"
            style={{ color: statusColors[status.color], background: `${statusColors[status.color]}20`, border: `1px solid ${statusColors[status.color]}40` }}>
            {status.label}
          </span>
          <span className="mono text-[10px]" style={{ color: 'var(--text3)' }}>
            {policy.objectId?.slice(0, 18)}…
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            ['Budget cap', formatBudget(policy.budgetCapCents)],
            ['Spent',      formatBudget(policy.spentCents)],
            ['Remaining',  formatBudget(policy.budgetCapCents - policy.spentCents)],
          ].map(([l, v]) => (
            <div key={l} className="p-3 rounded" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
              <div className="mono text-[10px] mb-1" style={{ color: 'var(--text3)' }}>{l}</div>
              <div className="mono text-sm font-bold" style={{ color: 'var(--text)' }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Budget bar */}
        <div className="mb-4">
          <div className="flex justify-between mono text-[10px] mb-1" style={{ color: 'var(--text3)' }}>
            <span>Budget used</span><span>{usedPct.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 rounded-full" style={{ background: 'var(--bg4)' }}>
            <div className="h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100,usedPct)}%`, background: usedPct>=80 ? 'var(--red)' : 'var(--green)' }} />
          </div>
        </div>

        <div className="flex gap-4">
          <div>
            <div className="mono text-[10px] mb-0.5" style={{ color: 'var(--text3)' }}>Agent status</div>
            <div className="mono text-sm font-bold" style={{ color: 'var(--text)' }}>{agentStatus}</div>
          </div>
          <div>
            <div className="mono text-[10px] mb-0.5" style={{ color: 'var(--text3)' }}>Network</div>
            <div className="mono text-sm font-bold" style={{ color: 'var(--text)' }}>{network}</div>
          </div>
        </div>
      </div>

      {/* Kill switch */}
      {!policy.revoked && (
        <div className="p-4 rounded-xl" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <div className="mono text-[10px] uppercase tracking-widest mb-3" style={{ color: 'var(--text3)' }}>
            Kill switch — owner revocation
          </div>
          <p className="text-sm mb-4" style={{ color: 'var(--text2)' }}>
            Revoking the policy calls <code className="mono text-[11px] px-1 rounded" style={{ background: 'var(--bg3)', color: 'var(--yellow)' }}>revoke_policy</code> on-chain.
            Any subsequent agent call aborts with <code className="mono text-[11px] px-1 rounded" style={{ background: 'var(--bg3)', color: 'var(--red)' }}>EPolicyRevoked</code>.
          </p>

          {step === 'idle' && (
            <button onClick={() => setStep('confirm')}
              className="mono text-[11px] font-bold px-4 py-2 rounded"
              style={{ background: 'rgba(246,70,93,0.15)', color: 'var(--red)', border: '1px solid rgba(246,70,93,0.4)', cursor: 'pointer' }}>
              Initiate revocation
            </button>
          )}

          {step === 'confirm' && (
            <div className="p-4 rounded-xl" style={{ background: 'rgba(246,70,93,0.08)', border: '1px solid rgba(246,70,93,0.3)' }}>
              <p className="mono text-[11px] font-bold mb-1" style={{ color: 'var(--red)' }}>⚠ This is permanent and irreversible.</p>
              <p className="text-sm mb-4" style={{ color: 'var(--text2)' }}>
                The agent will be blocked from all future trades immediately.
              </p>
              <div className="flex gap-2">
                <button onClick={initiateRevoke}
                  className="mono text-[11px] font-bold px-4 py-2 rounded"
                  style={{ background: 'var(--red)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                  Confirm — revoke now
                </button>
                <button onClick={() => setStep('idle')}
                  className="mono text-[11px] px-4 py-2 rounded"
                  style={{ background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
              {error && <p className="mono text-[11px] mt-2" style={{ color: 'var(--red)' }}>{error}</p>}
            </div>
          )}

          {step === 'building' && (
            <div className="mono text-[11px] px-4 py-3 rounded" style={{ background: 'var(--bg3)', color: 'var(--text3)' }}>
              Building revoke PTB… signing with owner wallet…
            </div>
          )}
        </div>
      )}

      {/* Done / already revoked */}
      {(step === 'done' || policy.revoked) && (
        <div className="p-4 rounded-xl" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <div className="mono text-[10px] uppercase tracking-widest mb-3" style={{ color: 'var(--text3)' }}>Revocation confirmed</div>

          <div className="p-3 rounded mb-3" style={{ background: 'rgba(14,203,129,0.1)', border: '1px solid rgba(14,203,129,0.25)' }}>
            <p className="mono text-[11px] font-bold mb-1" style={{ color: 'var(--green)' }}>✓ Policy revoked on-chain</p>
            <p className="text-sm" style={{ color: 'var(--text2)' }}>
              Agent loop blocked. Any call to <code className="mono text-[11px]" style={{ color: 'var(--yellow)' }}>check_and_spend</code> now aborts with <code className="mono text-[11px]" style={{ color: 'var(--red)' }}>EPolicyRevoked (3)</code>.
            </p>
          </div>

          {walrusBlobId && (
            <div className="p-3 rounded mb-3" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
              <div className="mono text-[10px] mb-1" style={{ color: 'var(--text3)' }}>Revocation logged to Walrus</div>
              <div className="mono text-[11px] mb-1" style={{ color: 'var(--yellow)' }}>{walrusBlobId}</div>
              <a href={`https://aggregator.walrus-testnet.walrus.space/v1/blobs/${walrusBlobId}`}
                target="_blank" rel="noopener noreferrer"
                className="mono text-[11px]" style={{ color: 'var(--yellow)' }}>↗ Verify on Walrus</a>
            </div>
          )}

          {/* On-chain event */}
          <div className="p-3 rounded" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
            <div className="mono text-[10px] mb-2" style={{ color: 'var(--text3)' }}>On-chain Move event</div>
            <pre className="mono text-[11px]" style={{ color: 'var(--text)', lineHeight: 1.6 }}>{`PolicyRevoked {
  policy_id:     "${policy.objectId?.slice(0,16)}…",
  owner:         "${policy.ownerAddress?.slice(0,16)}…",
  spent_cents:   ${policy.spentCents},
  revoked_at_ms: ${Date.now()}
}`}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
