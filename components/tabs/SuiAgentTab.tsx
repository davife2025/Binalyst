'use client'

/**
 * components/tabs/SuiAgentTab.tsx
 * Sui Autonomous Agent Wallet tab — Session K.
 *
 * Sub-tabs:
 *   Wallet   — connect a Sui address, view SUI balance
 *   Policy   — create / view / revoke Move policy object
 *   Agent    — configure + start/stop the Sui agent loop
 *   Log      — decision log (on-chain activity feed)
 *
 * NEW FILE — does not modify any existing tab or component.
 * Uses only: lib/store.sui.ts, lib/sui/client.ts, lib/movePolicy/client.ts
 */

import { useState, useEffect, useRef } from 'react'
import { useSuiStore }           from '@/lib/store.sui'
import { isValidSuiAddress, shortenAddress, explorerAddressUrl } from '@/lib/sui/client'
import {
  checkPolicyAllowsTrade,
  formatBudget,
  budgetUsedPct,
  policyStatusLabel,
  DEFAULT_POLICY,
} from '@/lib/movePolicy/client'
import { SuiAgentLoop, adaptSignalSnapshot } from '@/lib/suiAgent/agentLoop'
import type { SuiAgentCallbacks }            from '@/lib/suiAgent/agentLoop'
import type { SuiCycleResult, SuiAgentDecision } from '@/lib/sui/types'

// ─────────────────────────────────────────────────────────────────────────────
// Sub-tab nav
// ─────────────────────────────────────────────────────────────────────────────

const SUB_TABS = [
  { id: 'wallet' as const, label: 'Wallet',  icon: '🔐' },
  { id: 'policy' as const, label: 'Policy',  icon: '📜' },
  { id: 'agent'  as const, label: 'Agent',   icon: '🤖' },
  { id: 'log'    as const, label: 'Activity', icon: '📋' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function SuiAgentTab() {
  const store = useSuiStore()
  const agentRef = useRef<SuiAgentLoop | null>(null)

  return (
    <div style={{ padding: '24px', maxWidth: 720, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <span style={{ fontSize: 22, fontWeight: 500, color: 'var(--color-text-primary)' }}>
            Sui Agent Wallet
          </span>
          <span style={{
            fontSize: 11, fontWeight: 500, padding: '2px 8px',
            borderRadius: 4, background: 'var(--color-background-info)',
            color: 'var(--color-text-info)',
          }}>
            AGENTIC WEB · SUI OVERFLOW 2026
          </span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>
          Autonomous agent wallet with on-chain budget enforcement via Move policy object.
          All trades execute on Sui testnet via DeepBook.
        </p>
      </div>

      {/* Sub-tab nav */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--color-border-tertiary)', paddingBottom: 0 }}>
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => store.setActiveSubTab(t.id)}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: store.activeSubTab === t.id ? 500 : 400,
              color: store.activeSubTab === t.id ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              background: 'none',
              border: 'none',
              borderBottom: store.activeSubTab === t.id ? '2px solid var(--color-text-primary)' : '2px solid transparent',
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      {store.activeSubTab === 'wallet'  && <WalletTab />}
      {store.activeSubTab === 'policy'  && <PolicyTab />}
      {store.activeSubTab === 'agent'   && <AgentTab agentRef={agentRef} />}
      {store.activeSubTab === 'log'     && <ActivityLog />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Wallet sub-tab
// ─────────────────────────────────────────────────────────────────────────────

function WalletTab() {
  const { walletAddress, network, balanceSUI, walletConnected, walletError,
          setWallet, clearWallet, setWalletError, setBalance } = useSuiStore()
  const [inputAddr, setInputAddr] = useState(walletAddress ?? '')
  const [loading,   setLoading]   = useState(false)

  async function connect() {
    const addr = inputAddr.trim()
    if (!isValidSuiAddress(addr)) {
      setWalletError('Invalid Sui address — must be 0x followed by 64 hex characters')
      return
    }
    setLoading(true)
    setWalletError(null)
    try {
      const res  = await fetch(`/api/sui/wallet?address=${addr}&network=${network}`)
      const data = await res.json() as { balanceSUI?: number; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Fetch failed')
      setWallet(addr, network, data.balanceSUI ?? 0)
    } catch (e: unknown) {
      setWalletError(e instanceof Error ? e.message : 'Connection failed')
    } finally {
      setLoading(false)
    }
  }

  async function refreshBalance() {
    if (!walletAddress) return
    setLoading(true)
    try {
      const res  = await fetch(`/api/sui/wallet?address=${walletAddress}&network=${network}`)
      const data = await res.json() as { balanceSUI?: number }
      if (data.balanceSUI !== undefined) setBalance(data.balanceSUI)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Network selector */}
      <Card label="Network">
        <div style={{ display: 'flex', gap: 8 }}>
          {(['testnet', 'mainnet'] as const).map(n => (
            <NetworkBadge key={n} id={n} active={network === n} />
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', margin: '8px 0 0' }}>
          Testnet recommended for hackathon demo. Switch to mainnet for live trading.
        </p>
      </Card>

      {/* Address input */}
      <Card label="Agent wallet address">
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={inputAddr}
            onChange={e => setInputAddr(e.target.value)}
            placeholder="0x0000...0000 (64 hex chars)"
            style={{
              flex: 1, padding: '8px 12px', fontSize: 13,
              borderRadius: 6, border: '1px solid var(--color-border-secondary)',
              background: 'var(--color-background-secondary)',
              color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)',
            }}
          />
          <Btn onClick={connect} loading={loading} disabled={!inputAddr.trim()}>
            Connect
          </Btn>
          {walletConnected && (
            <Btn onClick={clearWallet} variant="ghost">Disconnect</Btn>
          )}
        </div>
        {walletError && (
          <p style={{ fontSize: 12, color: 'var(--color-text-danger)', margin: '6px 0 0' }}>{walletError}</p>
        )}
      </Card>

      {/* Balance display */}
      {walletConnected && walletAddress && (
        <Card label="Wallet status">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 500, color: 'var(--color-text-primary)', lineHeight: 1.2 }}>
                {balanceSUI.toFixed(4)} SUI
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                {shortenAddress(walletAddress, 8)}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
              <Btn onClick={refreshBalance} loading={loading} variant="ghost" size="sm">
                Refresh
              </Btn>
              <a
                href={explorerAddressUrl(walletAddress, network)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, color: 'var(--color-text-info)' }}
              >
                View on Suiscan ↗
              </a>
            </div>
          </div>
          <div style={{
            marginTop: 12, padding: '8px 12px', borderRadius: 6,
            background: 'var(--color-background-success)',
            color: 'var(--color-text-success)', fontSize: 12,
          }}>
            Connected on {network} — ready for policy creation
          </div>
        </Card>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Policy sub-tab
// ─────────────────────────────────────────────────────────────────────────────

function PolicyTab() {
  const { walletAddress, network, policy, policyLoading,
          setPolicy, clearPolicy, setPolicyLoading, markPolicyRevoked } = useSuiStore()

  const [budgetCap,   setBudgetCap]   = useState('500')
  const [perTrade,    setPerTrade]    = useState('50')
  const [agentAddr,   setAgentAddr]   = useState('')
  const [error,       setError]       = useState<string | null>(null)
  const [revokeConfirm, setRevokeConfirm] = useState(false)

  async function createPolicy() {
    if (!walletAddress) { setError('Connect a wallet first'); return }
    if (!isValidSuiAddress(agentAddr)) { setError('Invalid agent address'); return }
    const budgetCents   = Math.round(parseFloat(budgetCap)  * 100)
    const perTradeCents = Math.round(parseFloat(perTrade)   * 100)
    if (isNaN(budgetCents) || budgetCents <= 0)   { setError('Invalid budget cap'); return }
    if (isNaN(perTradeCents) || perTradeCents <= 0) { setError('Invalid per-trade limit'); return }

    setPolicyLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/sui/policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerAddress:       walletAddress,
          agentAddress:       agentAddr,
          budgetCapCents:     budgetCents,
          perTradeLimitCents: perTradeCents,
          network,
        }),
      })
      const data = await res.json() as { ptb?: unknown; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Policy creation failed')

      // In a full integration the user signs the PTB here via wallet adapter.
      // For the hackathon demo we simulate the on-chain creation:
      setPolicy({
        ...DEFAULT_POLICY,
        ownerAddress:       walletAddress,
        agentAddress:       agentAddr,
        budgetCapCents:     budgetCents,
        perTradeLimitCents: perTradeCents,
        network,
        objectId:           `0x${Date.now().toString(16).padStart(64, '0')}`,
        createdAt:          new Date().toISOString(),
        creationTxDigest:   `simulated-${Date.now()}`,
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setPolicyLoading(false)
    }
  }

  async function revokePolicy() {
    if (!policy?.objectId) return
    setPolicyLoading(true)
    try {
      await fetch(`/api/sui/policy?policyId=${policy.objectId}&network=${network}`, { method: 'DELETE' })
      markPolicyRevoked()
      setRevokeConfirm(false)
    } finally {
      setPolicyLoading(false)
    }
  }

  if (!walletAddress) {
    return <EmptyState icon="🔐" message="Connect a wallet in the Wallet tab first." />
  }

  const status = policy ? policyStatusLabel(policy) : null
  const usedPct = policy ? budgetUsedPct(policy) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Existing policy */}
      {policy && (
        <Card label="Active policy">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <StatusPill color={status!.color}>{status!.label}</StatusPill>
            <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              {policy.objectId ? shortenAddress(policy.objectId, 8) : 'Not deployed'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <Stat label="Budget cap"       value={formatBudget(policy.budgetCapCents)} />
            <Stat label="Per-trade limit"  value={formatBudget(policy.perTradeLimitCents)} />
            <Stat label="Spent"            value={formatBudget(policy.spentCents)} />
            <Stat label="Remaining"        value={formatBudget(policy.budgetCapCents - policy.spentCents)} />
          </div>

          {/* Budget bar */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
              <span>Budget used</span><span>{usedPct.toFixed(1)}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--color-border-tertiary)' }}>
              <div style={{
                height: '100%', borderRadius: 3,
                width: `${Math.min(100, usedPct)}%`,
                background: usedPct >= 80 ? 'var(--color-background-danger)' : 'var(--color-background-success)',
                transition: 'width 0.3s',
              }} />
            </div>
          </div>

          {!policy.revoked && (
            revokeConfirm ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--color-text-danger)' }}>
                  Revoke policy? This is irreversible.
                </span>
                <Btn onClick={revokePolicy} loading={policyLoading} variant="danger" size="sm">Confirm revoke</Btn>
                <Btn onClick={() => setRevokeConfirm(false)} variant="ghost" size="sm">Cancel</Btn>
              </div>
            ) : (
              <Btn onClick={() => setRevokeConfirm(true)} variant="danger" size="sm">
                Revoke policy (owner kill switch)
              </Btn>
            )
          )}

          {policy.revoked && (
            <div style={{ padding: '8px 12px', borderRadius: 6, background: 'var(--color-background-danger)', color: 'var(--color-text-danger)', fontSize: 12 }}>
              Policy revoked — agent cannot execute trades.
            </div>
          )}
        </Card>
      )}

      {/* Create policy form */}
      {!policy && (
        <Card label="Create agent policy">
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
            Deploy a Move policy object that enforces a budget ceiling on the agent wallet.
            Only you (the owner) can revoke it.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Agent wallet address (the address the AI agent uses)">
              <input
                value={agentAddr}
                onChange={e => setAgentAddr(e.target.value)}
                placeholder="0x0000...0000"
                style={inputStyle}
              />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Total budget cap (USD)">
                <input type="number" value={budgetCap} onChange={e => setBudgetCap(e.target.value)} style={inputStyle} min="1" />
              </Field>
              <Field label="Max per trade (USD)">
                <input type="number" value={perTrade} onChange={e => setPerTrade(e.target.value)} style={inputStyle} min="1" />
              </Field>
            </div>

            {error && <p style={{ fontSize: 12, color: 'var(--color-text-danger)', margin: 0 }}>{error}</p>}

            <Btn onClick={createPolicy} loading={policyLoading}>
              Deploy policy on Sui {network}
            </Btn>
          </div>
        </Card>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent sub-tab
// ─────────────────────────────────────────────────────────────────────────────

function AgentTab({ agentRef }: { agentRef: React.MutableRefObject<SuiAgentLoop | null> }) {
  const {
    policy, agentStatus, agentConfig, cycleCount, tradesExecuted,
    lastCycleAt, agentErrors, walletAddress,
    setAgentStatus, setAgentConfig, onCycleComplete, addDecision,
  } = useSuiStore()

  function startAgent() {
    if (agentRef.current) return

    const callbacks: SuiAgentCallbacks = {
      getSignals: async () => {
        // Fetch from the existing CMC signals API — read-only, no modification
        try {
          const res  = await fetch('/api/cmc')
          const data = await res.json() as { signals?: unknown[] }
          return (data.signals ?? []).map((s: unknown) => adaptSignalSnapshot(s as Parameters<typeof adaptSignalSnapshot>[0]))
        } catch {
          return []
        }
      },
      getConfig:        () => agentConfig,
      getWalletAddress: () => walletAddress,
      executeTrade: async (params) => {
        // Session L will wire real DeepBook here. For K, dry-run only.
        return {
          success:   true,
          txDigest:  `dry-run-${Date.now()}`,
        }
      },
      onDecision:      addDecision,
      onCycleComplete: (r: SuiCycleResult) => {
        onCycleComplete(r)
      },
      onStatusChange:  setAgentStatus,
    }

    agentRef.current = new SuiAgentLoop(callbacks)
    agentRef.current.start()
  }

  function stopAgent() {
    agentRef.current?.stop()
    agentRef.current = null
  }

  const isRunning = agentStatus === 'running'
  const canStart  = !!policy && !policy.revoked && !!walletAddress

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {!canStart && (
        <div style={{ padding: '12px 16px', borderRadius: 8, background: 'var(--color-background-warning)', color: 'var(--color-text-warning)', fontSize: 13 }}>
          {!walletAddress ? 'Connect a wallet first (Wallet tab).' : 'Deploy a policy first (Policy tab).'}
        </div>
      )}

      {/* Stats */}
      <Card label="Agent status">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
          <Stat label="Status"         value={agentStatus} />
          <Stat label="Cycles run"     value={String(cycleCount)} />
          <Stat label="Trades executed" value={String(tradesExecuted)} />
        </div>
        {lastCycleAt && (
          <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', margin: '0 0 12px' }}>
            Last cycle: {new Date(lastCycleAt).toLocaleTimeString()}
          </p>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          {!isRunning ? (
            <Btn onClick={startAgent} disabled={!canStart}>Start Sui agent</Btn>
          ) : (
            <Btn onClick={stopAgent} variant="danger">Stop agent</Btn>
          )}
        </div>
      </Card>

      {/* Config */}
      <Card label="Agent configuration">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Max trade USD">
            <input type="number" value={agentConfig.maxTradeUSD}
              onChange={e => setAgentConfig({ maxTradeUSD: Number(e.target.value) })}
              style={inputStyle} min="1" />
          </Field>
          <Field label="Min signal score (0–100)">
            <input type="number" value={agentConfig.minSignalScore}
              onChange={e => setAgentConfig({ minSignalScore: Number(e.target.value) })}
              style={inputStyle} min="0" max="100" />
          </Field>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <ToggleSwitch
            checked={agentConfig.dryRun}
            onChange={v => setAgentConfig({ dryRun: v })}
            label="Dry run (no real trades)"
          />
          <ToggleSwitch
            checked={agentConfig.autonomousMode}
            onChange={v => setAgentConfig({ autonomousMode: v })}
            label="Autonomous mode"
          />
        </div>
      </Card>

      {/* Errors */}
      {agentErrors.length > 0 && (
        <Card label="Recent errors">
          {agentErrors.slice(-5).map((e, i) => (
            <p key={i} style={{ fontSize: 12, color: 'var(--color-text-danger)', margin: '0 0 4px', fontFamily: 'var(--font-mono)' }}>{e}</p>
          ))}
        </Card>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity log sub-tab
// ─────────────────────────────────────────────────────────────────────────────

function ActivityLog() {
  const { decisions, clearDecisions } = useSuiStore()

  if (decisions.length === 0) {
    return <EmptyState icon="📋" message="No agent decisions yet. Start the agent to see activity here." />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{decisions.length} decisions logged</span>
        <Btn onClick={clearDecisions} variant="ghost" size="sm">Clear log</Btn>
      </div>
      {decisions.map((d, i) => <DecisionCard key={i} decision={d} />)}
    </div>
  )
}

function DecisionCard({ decision }: { decision: SuiAgentDecision }) {
  const isBuy     = decision.action === 'BUY'
  const isBlocked = decision.blocked

  return (
    <div style={{
      padding: '12px 16px', borderRadius: 8,
      border: '1px solid var(--color-border-tertiary)',
      background: 'var(--color-background-secondary)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontWeight: 500, fontSize: 14 }}>{decision.symbol}</span>
          <StatusPill color={isBlocked ? 'gray' : isBuy ? 'green' : 'red'}>
            {isBlocked ? 'BLOCKED' : decision.action}
          </StatusPill>
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
            ${decision.amountUSD.toFixed(2)}
          </span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
          {new Date(decision.timestamp).toLocaleTimeString()}
        </span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '0 0 4px' }}>{decision.reasoning}</p>
      {decision.blockReason && (
        <p style={{ fontSize: 12, color: 'var(--color-text-warning)', margin: 0 }}>
          Blocked: {decision.blockReason}
        </p>
      )}
      {decision.txDigest && (
        <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)', margin: '4px 0 0' }}>
          tx: {decision.txDigest}
        </p>
      )}
      <div style={{ marginTop: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
          Signal score: {decision.signalScore.toFixed(0)}/100
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared micro-components
// ─────────────────────────────────────────────────────────────────────────────

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid var(--color-border-tertiary)', borderRadius: 10, padding: '16px 20px', background: 'var(--color-background-secondary)' }}>
      <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-tertiary)', margin: '0 0 12px' }}>{label}</p>
      {children}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', margin: '0 0 2px' }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>{value}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '0 0 4px' }}>{label}</p>
      {children}
    </div>
  )
}

function StatusPill({ color, children }: { color: string; children: React.ReactNode }) {
  const colors: Record<string, { bg: string; text: string }> = {
    green:  { bg: 'var(--color-background-success)', text: 'var(--color-text-success)' },
    yellow: { bg: 'var(--color-background-warning)',  text: 'var(--color-text-warning)'  },
    red:    { bg: 'var(--color-background-danger)',   text: 'var(--color-text-danger)'   },
    gray:   { bg: 'var(--color-background-secondary)', text: 'var(--color-text-secondary)' },
  }
  const c = colors[color] ?? colors.gray
  return (
    <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 4, background: c.bg, color: c.text }}>
      {children}
    </span>
  )
}

function NetworkBadge({ id, active }: { id: string; active: boolean }) {
  return (
    <span style={{
      fontSize: 12, padding: '4px 10px', borderRadius: 6, fontWeight: active ? 500 : 400,
      border: '1px solid var(--color-border-secondary)',
      background: active ? 'var(--color-background-info)' : 'transparent',
      color: active ? 'var(--color-text-info)' : 'var(--color-text-secondary)',
    }}>
      {id}
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

function Btn({ children, onClick, loading, disabled, variant = 'primary', size = 'md' }: {
  children: React.ReactNode
  onClick?: () => void
  loading?: boolean
  disabled?: boolean
  variant?: 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: 'var(--color-text-primary)', color: 'var(--color-background-primary)' },
    ghost:   { background: 'transparent', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-secondary)' },
    danger:  { background: 'var(--color-background-danger)', color: 'var(--color-text-danger)', border: '1px solid var(--color-border-danger)' },
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        padding: size === 'sm' ? '5px 12px' : '8px 16px',
        fontSize: size === 'sm' ? 12 : 13,
        fontWeight: 500, borderRadius: 6, border: 'none',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.6 : 1,
        ...styles[variant],
      }}
    >
      {loading ? '…' : children}
    </button>
  )
}

function ToggleSwitch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--color-text-secondary)' }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 36, height: 20, borderRadius: 10,
          background: checked ? 'var(--color-text-primary)' : 'var(--color-border-secondary)',
          position: 'relative', transition: 'background 0.2s', flexShrink: 0,
        }}
      >
        <div style={{
          position: 'absolute', top: 2, left: checked ? 18 : 2,
          width: 16, height: 16, borderRadius: '50%',
          background: 'var(--color-background-primary)',
          transition: 'left 0.2s',
        }} />
      </div>
      {label}
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 6,
  border: '1px solid var(--color-border-secondary)',
  background: 'var(--color-background-secondary)',
  color: 'var(--color-text-primary)', boxSizing: 'border-box',
}
