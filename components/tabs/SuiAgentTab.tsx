'use client'

/**
 * components/tabs/SuiAgentTab.tsx
 * Sui Autonomous Agent Wallet — Session K (UI rebuild).
 * Styled using Binalyst's design system:
 *   bg: var(--bg) / --bg2 / --bg3 / --bg4
 *   text: var(--text) / --text2 / --text3
 *   border: var(--border) / --border2
 *   accents: var(--yellow) / --green / --red
 *   font: Syne (default), Space Mono (.mono class)
 */

import { useState, useRef } from 'react'
import { useSuiStore }                  from '@/lib/store.sui'
import { isValidSuiAddress, shortenAddress, explorerAddressUrl } from '@/lib/sui/client'
import { formatBudget, budgetUsedPct, policyStatusLabel, DEFAULT_POLICY } from '@/lib/movePolicy/client'
import { SuiAgentLoop, adaptSignalSnapshot } from '@/lib/suiAgent/agentLoop'
import type { SuiAgentCallbacks }            from '@/lib/suiAgent/agentLoop'
import type { SuiCycleResult, SuiAgentDecision } from '@/lib/sui/types'

// ─────────────────────────────────────────────────────────────────────────────
// Sub-tab nav
// ─────────────────────────────────────────────────────────────────────────────

const SUB_TABS = [
  { id: 'wallet' as const, label: 'Wallet'   },
  { id: 'policy' as const, label: 'Policy'   },
  { id: 'agent'  as const, label: 'Agent'    },
  { id: 'log'    as const, label: 'Activity' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────────────────────

export default function SuiAgentTab() {
  const store    = useSuiStore()
  const agentRef = useRef<SuiAgentLoop | null>(null)

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="px-6 pt-5 pb-0 shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3 mb-3">
          <span style={{ color: 'var(--text)', fontSize: 18, fontWeight: 600 }}>Sui Agent Wallet</span>
          <span className="mono text-[10px] px-2 py-0.5 rounded"
            style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}>
            AGENTIC WEB · SUI OVERFLOW 2026
          </span>
        </div>

        {/* Sub-tab nav */}
        <div className="flex gap-0">
          {SUB_TABS.map(t => (
            <button key={t.id} onClick={() => store.setActiveSubTab(t.id)}
              className="mono text-[11px] uppercase tracking-widest px-4 py-2.5 transition-all"
              style={{
                color:       store.activeSubTab === t.id ? 'var(--yellow)' : 'var(--text3)',
                borderBottom: store.activeSubTab === t.id ? '2px solid var(--yellow)' : '2px solid transparent',
                background:  'none',
                border:      'none',
                cursor:      'pointer',
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6">
        {store.activeSubTab === 'wallet'  && <WalletTab />}
        {store.activeSubTab === 'policy'  && <PolicyTab />}
        {store.activeSubTab === 'agent'   && <AgentTab agentRef={agentRef} />}
        {store.activeSubTab === 'log'     && <ActivityLog />}
      </div>
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
    if (!isValidSuiAddress(addr)) { setWalletError('Invalid Sui address — must be 0x + 64 hex chars'); return }
    setLoading(true); setWalletError(null)
    try {
      const res  = await fetch(`/api/sui/wallet?address=${addr}&network=${network}`)
      const data = await res.json() as { balanceSUI?: number; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Fetch failed')
      setWallet(addr, network, data.balanceSUI ?? 0)
    } catch (e: unknown) {
      setWalletError(e instanceof Error ? e.message : 'Connection failed')
    } finally { setLoading(false) }
  }

  async function refresh() {
    if (!walletAddress) return
    setLoading(true)
    try {
      const res  = await fetch(`/api/sui/wallet?address=${walletAddress}&network=${network}`)
      const data = await res.json() as { balanceSUI?: number }
      if (data.balanceSUI !== undefined) setBalance(data.balanceSUI)
    } finally { setLoading(false) }
  }

  return (
    <div className="flex flex-col gap-4 max-w-lg">

      {/* Network badge */}
      <Card label="Network">
        <div className="flex gap-2">
          {(['testnet', 'mainnet'] as const).map(n => (
            <span key={n} className="mono text-[11px] px-3 py-1 rounded"
              style={{
                background: network === n ? 'rgba(240,185,11,0.15)' : 'var(--bg3)',
                color:      network === n ? 'var(--yellow)' : 'var(--text3)',
                border:     `1px solid ${network === n ? 'rgba(240,185,11,0.4)' : 'var(--border)'}`,
              }}>
              {n}
            </span>
          ))}
        </div>
      </Card>

      {/* Address input */}
      <Card label="Agent wallet address">
        <div className="flex gap-2">
          <input value={inputAddr} onChange={e => setInputAddr(e.target.value)}
            placeholder="0x0000…0000"
            className="mono text-[12px] flex-1 px-3 py-2 rounded outline-none"
            style={{ background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)' }} />
          <Btn onClick={connect} loading={loading} disabled={!inputAddr.trim()}>Connect</Btn>
          {walletConnected && <Btn onClick={clearWallet} variant="ghost">Disconnect</Btn>}
        </div>
        {walletError && <p className="mono text-[11px] mt-2" style={{ color: 'var(--red)' }}>{walletError}</p>}
      </Card>

      {/* Balance */}
      {walletConnected && walletAddress && (
        <Card label="Wallet">
          <div className="flex justify-between items-start">
            <div>
              <div className="mono text-2xl font-bold" style={{ color: 'var(--yellow)' }}>
                {balanceSUI.toFixed(4)} SUI
              </div>
              <div className="mono text-[11px] mt-1" style={{ color: 'var(--text3)' }}>
                {shortenAddress(walletAddress, 8)}
              </div>
            </div>
            <div className="flex flex-col gap-2 items-end">
              <Btn onClick={refresh} loading={loading} variant="ghost" size="sm">Refresh</Btn>
              <a href={explorerAddressUrl(walletAddress, network)} target="_blank" rel="noopener noreferrer"
                className="mono text-[11px]" style={{ color: 'var(--yellow)' }}>
                Suiscan ↗
              </a>
            </div>
          </div>
          <div className="mono text-[11px] mt-3 px-3 py-2 rounded"
            style={{ background: 'rgba(14,203,129,0.1)', color: 'var(--green)', border: '1px solid rgba(14,203,129,0.2)' }}>
            ● Connected on {network} — ready for policy creation
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
          setPolicy, setPolicyLoading, markPolicyRevoked } = useSuiStore()
  const [budgetCap,     setBudgetCap]     = useState('500')
  const [perTrade,      setPerTrade]      = useState('50')
  const [agentAddr,     setAgentAddr]     = useState('')
  const [error,         setError]         = useState<string | null>(null)
  const [revokeConfirm, setRevokeConfirm] = useState(false)

  async function createPolicy() {
    if (!walletAddress) { setError('Connect a wallet first'); return }
    if (!isValidSuiAddress(agentAddr)) { setError('Invalid agent address'); return }
    const budgetCents   = Math.round(parseFloat(budgetCap)  * 100)
    const perTradeCents = Math.round(parseFloat(perTrade)   * 100)
    if (!budgetCents || budgetCents <= 0)   { setError('Invalid budget cap'); return }
    if (!perTradeCents || perTradeCents <= 0) { setError('Invalid per-trade limit'); return }
    setPolicyLoading(true); setError(null)
    try {
      const res  = await fetch('/api/sui/policy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerAddress: walletAddress, agentAddress: agentAddr, budgetCapCents: budgetCents, perTradeLimitCents: perTradeCents, network }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Failed')
      setPolicy({
        ...DEFAULT_POLICY,
        ownerAddress: walletAddress, agentAddress: agentAddr,
        budgetCapCents: budgetCents, perTradeLimitCents: perTradeCents, network,
        objectId: `0x${Date.now().toString(16).padStart(64,'0')}`,
        createdAt: new Date().toISOString(),
        creationTxDigest: `sim-${Date.now()}`,
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally { setPolicyLoading(false) }
  }

  async function revokePolicy() {
    if (!policy?.objectId) return
    setPolicyLoading(true)
    try {
      await fetch(`/api/sui/policy?policyId=${policy.objectId}&network=${network}`, { method: 'DELETE' })
      markPolicyRevoked()
      setRevokeConfirm(false)
    } finally { setPolicyLoading(false) }
  }

  if (!walletAddress) {
    return <Empty message="Connect a wallet in the Wallet tab first." />
  }

  const status  = policy ? policyStatusLabel(policy) : null
  const usedPct = policy ? budgetUsedPct(policy) : 0

  const statusColors: Record<string, string> = {
    green: 'var(--green)', yellow: 'var(--yellow)', red: 'var(--red)', gray: 'var(--text3)',
  }

  return (
    <div className="flex flex-col gap-4 max-w-lg">
      {policy ? (
        <Card label="Active policy">
          <div className="flex justify-between items-center mb-4">
            <span className="mono text-[11px] px-2 py-0.5 rounded"
              style={{ color: statusColors[status!.color], background: `${statusColors[status!.color]}20`, border: `1px solid ${statusColors[status!.color]}40` }}>
              {status!.label}
            </span>
            <span className="mono text-[10px]" style={{ color: 'var(--text3)' }}>
              {policy.objectId?.slice(0, 18)}…
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              ['Budget cap',    formatBudget(policy.budgetCapCents)],
              ['Per-trade max', formatBudget(policy.perTradeLimitCents)],
              ['Spent',         formatBudget(policy.spentCents)],
              ['Remaining',     formatBudget(policy.budgetCapCents - policy.spentCents)],
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
                style={{ width: `${Math.min(100,usedPct)}%`, background: usedPct >= 80 ? 'var(--red)' : 'var(--green)' }} />
            </div>
          </div>

          {!policy.revoked && (
            revokeConfirm ? (
              <div className="p-3 rounded" style={{ background: 'rgba(246,70,93,0.1)', border: '1px solid rgba(246,70,93,0.3)' }}>
                <p className="mono text-[11px] mb-3" style={{ color: 'var(--red)' }}>
                  Revoke policy? This is permanent and irreversible.
                </p>
                <div className="flex gap-2">
                  <Btn onClick={revokePolicy} loading={policyLoading} variant="danger" size="sm">Confirm revoke</Btn>
                  <Btn onClick={() => setRevokeConfirm(false)} variant="ghost" size="sm">Cancel</Btn>
                </div>
              </div>
            ) : (
              <Btn onClick={() => setRevokeConfirm(true)} variant="danger" size="sm">
                Revoke (owner kill switch)
              </Btn>
            )
          )}

          {policy.revoked && (
            <div className="mono text-[11px] px-3 py-2 rounded"
              style={{ background: 'rgba(246,70,93,0.1)', color: 'var(--red)', border: '1px solid rgba(246,70,93,0.3)' }}>
              Policy revoked — agent is blocked.
            </div>
          )}
        </Card>
      ) : (
        <Card label="Create agent policy">
          <p className="text-sm mb-4" style={{ color: 'var(--text2)' }}>
            Deploy a Move policy object that enforces a budget ceiling on the agent wallet.
            Only you (the owner) can revoke it.
          </p>
          <div className="flex flex-col gap-3">
            <Field label="Agent wallet address">
              <input value={agentAddr} onChange={e => setAgentAddr(e.target.value)}
                placeholder="0x0000…0000" className="mono text-[12px] w-full px-3 py-2 rounded outline-none"
                style={{ background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)' }} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Budget cap (USD)">
                <input type="number" value={budgetCap} onChange={e => setBudgetCap(e.target.value)}
                  className="mono text-[12px] w-full px-3 py-2 rounded outline-none"
                  style={{ background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)' }} />
              </Field>
              <Field label="Max per trade (USD)">
                <input type="number" value={perTrade} onChange={e => setPerTrade(e.target.value)}
                  className="mono text-[12px] w-full px-3 py-2 rounded outline-none"
                  style={{ background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)' }} />
              </Field>
            </div>
            {error && <p className="mono text-[11px]" style={{ color: 'var(--red)' }}>{error}</p>}
            <Btn onClick={createPolicy} loading={policyLoading}>Deploy policy on Sui {network}</Btn>
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
        try {
          const res  = await fetch('/api/cmc?action=signals_batch')
          const data = await res.json() as { data?: unknown[] }
          return (data.data ?? []).map((s: unknown) => adaptSignalSnapshot(s as Parameters<typeof adaptSignalSnapshot>[0]))
        } catch { return [] }
      },
      getConfig:        () => agentConfig,
      getWalletAddress: () => walletAddress,
      executeTrade: async (params) => {
        try {
          const poolRes  = await fetch(`/api/deepbook/pools?network=${agentConfig.network}`)
          const poolData = await poolRes.json() as { pools?: Array<{ poolId: string; pair: string; bestAsk?: number; bestBid?: number; tickSize?: number }> }
          const pool     = poolData.pools?.find(p => p.pair.startsWith(params.symbol)) ?? poolData.pools?.[0]
          if (!pool) return { success: false, error: 'No pool for ' + params.symbol }
          const mid = ((pool.bestAsk ?? 1) + (pool.bestBid ?? 1)) / 2 || 1
          const qty = Math.max(params.amountUSD / mid, pool.tickSize ?? 0.1)
          const res = await fetch('/api/deepbook/order', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              poolId: pool.poolId, side: params.action === 'BUY' ? 'bid' : 'ask',
              type: 'market', price: mid, quantity: qty,
              walletAddress: walletAddress ?? '0x' + '0'.repeat(64),
              network: agentConfig.network, dryRun: params.dryRun,
              agentReasoning: `Signal-driven ${params.action}`,
            }),
          })
          const data = await res.json() as { success?: boolean; order?: { clientOrderId: string }; error?: string }
          return data.success ? { success: true, txDigest: data.order?.clientOrderId } : { success: false, error: data.error }
        } catch (e: unknown) {
          return { success: false, error: e instanceof Error ? e.message : 'Failed' }
        }
      },
      onDecision:      addDecision,
      onCycleComplete: (r: SuiCycleResult) => onCycleComplete(r),
      onStatusChange:  setAgentStatus,
    }
    agentRef.current = new SuiAgentLoop(callbacks)
    agentRef.current.start()
  }

  function stopAgent() { agentRef.current?.stop(); agentRef.current = null }

  const isRunning = agentStatus === 'running'
  const canStart  = !!policy && !policy.revoked && !!walletAddress

  return (
    <div className="flex flex-col gap-4 max-w-lg">
      {!canStart && (
        <div className="mono text-[11px] px-4 py-3 rounded"
          style={{ background: 'rgba(240,185,11,0.1)', color: 'var(--yellow)', border: '1px solid rgba(240,185,11,0.3)' }}>
          {!walletAddress ? '→ Connect a wallet first (Wallet tab).' : '→ Deploy a policy first (Policy tab).'}
        </div>
      )}

      <Card label="Agent status">
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            ['Status',   agentStatus],
            ['Cycles',   String(cycleCount)],
            ['Trades',   String(tradesExecuted)],
          ].map(([l, v]) => (
            <div key={l} className="p-3 rounded" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
              <div className="mono text-[10px] mb-1" style={{ color: 'var(--text3)' }}>{l}</div>
              <div className="mono text-sm font-bold" style={{ color: 'var(--text)' }}>{v}</div>
            </div>
          ))}
        </div>
        {lastCycleAt && (
          <p className="mono text-[10px] mb-3" style={{ color: 'var(--text3)' }}>
            Last cycle: {new Date(lastCycleAt).toLocaleTimeString()}
          </p>
        )}
        <div className="flex gap-2">
          {!isRunning
            ? <Btn onClick={startAgent} disabled={!canStart}>Start Sui agent</Btn>
            : <Btn onClick={stopAgent} variant="danger">Stop agent</Btn>}
        </div>
      </Card>

      <Card label="Configuration">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Field label="Max trade USD">
            <input type="number" value={agentConfig.maxTradeUSD}
              onChange={e => setAgentConfig({ maxTradeUSD: Number(e.target.value) })}
              className="mono text-[12px] w-full px-3 py-2 rounded outline-none"
              style={{ background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)' }} />
          </Field>
          <Field label="Min signal score (0–100)">
            <input type="number" value={agentConfig.minSignalScore}
              onChange={e => setAgentConfig({ minSignalScore: Number(e.target.value) })}
              className="mono text-[12px] w-full px-3 py-2 rounded outline-none"
              style={{ background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)' }} />
          </Field>
        </div>
        <div className="flex gap-4">
          <Toggle checked={agentConfig.dryRun}        onChange={v => setAgentConfig({ dryRun: v })}        label="Dry run" />
          <Toggle checked={agentConfig.autonomousMode} onChange={v => setAgentConfig({ autonomousMode: v })} label="Autonomous mode" />
        </div>
      </Card>

      {agentErrors.length > 0 && (
        <Card label="Recent errors">
          {agentErrors.slice(-4).map((e, i) => (
            <p key={i} className="mono text-[10px] mb-1" style={{ color: 'var(--red)' }}>{e}</p>
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
  if (!decisions.length) return <Empty message="No agent decisions yet. Start the agent to see activity." />

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <span className="mono text-[11px]" style={{ color: 'var(--text3)' }}>{decisions.length} decisions logged</span>
        <Btn onClick={clearDecisions} variant="ghost" size="sm">Clear</Btn>
      </div>
      {decisions.map((d, i) => <DecisionRow key={i} d={d} />)}
    </div>
  )
}

function DecisionRow({ d }: { d: SuiAgentDecision }) {
  const isBlocked = d.blocked
  const isBuy     = d.action === 'BUY'
  return (
    <div className="p-3 rounded" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-2">
          <span className="mono text-sm font-bold" style={{ color: 'var(--text)' }}>{d.symbol}</span>
          <span className="mono text-[10px] px-1.5 py-0.5 rounded"
            style={{
              background: isBlocked ? 'var(--bg4)' : isBuy ? 'rgba(14,203,129,0.15)' : 'rgba(246,70,93,0.15)',
              color:      isBlocked ? 'var(--text3)' : isBuy ? 'var(--green)' : 'var(--red)',
            }}>
            {isBlocked ? 'BLOCKED' : d.action}
          </span>
          <span className="mono text-[10px]" style={{ color: 'var(--text3)' }}>${d.amountUSD.toFixed(2)}</span>
        </div>
        <span className="mono text-[10px]" style={{ color: 'var(--text3)' }}>
          {new Date(d.timestamp).toLocaleTimeString()}
        </span>
      </div>
      <p className="text-xs" style={{ color: 'var(--text2)' }}>{d.reasoning}</p>
      {d.blockReason && <p className="mono text-[10px] mt-1" style={{ color: 'var(--yellow)' }}>Blocked: {d.blockReason}</p>}
      {d.txDigest    && <p className="mono text-[10px] mt-1" style={{ color: 'var(--text3)' }}>tx: {d.txDigest.slice(0, 24)}…</p>}
      <p className="mono text-[10px] mt-1" style={{ color: 'var(--text3)' }}>score: {d.signalScore.toFixed(0)}/100</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared micro-components (Binalyst-styled)
// ─────────────────────────────────────────────────────────────────────────────

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-xl" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
      <div className="mono text-[10px] uppercase tracking-widest mb-3" style={{ color: 'var(--text3)' }}>{label}</div>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mono text-[10px] mb-1" style={{ color: 'var(--text3)' }}>{label}</div>
      {children}
    </div>
  )
}

function Empty({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-40">
      <p className="mono text-[12px]" style={{ color: 'var(--text3)' }}>{message}</p>
    </div>
  )
}

function Btn({ children, onClick, loading, disabled, variant = 'primary', size = 'md' }: {
  children: React.ReactNode; onClick?: () => void; loading?: boolean
  disabled?: boolean; variant?: 'primary' | 'ghost' | 'danger'; size?: 'sm' | 'md'
}) {
  const styles = {
    primary: { background: 'var(--yellow)',                     color: '#000',           border: 'none' },
    ghost:   { background: 'var(--bg3)',                        color: 'var(--text2)',   border: '1px solid var(--border)' },
    danger:  { background: 'rgba(246,70,93,0.15)',              color: 'var(--red)',     border: '1px solid rgba(246,70,93,0.4)' },
  }
  return (
    <button onClick={onClick} disabled={disabled || loading}
      className={`mono font-bold rounded transition-all ${size === 'sm' ? 'text-[10px] px-3 py-1.5' : 'text-[11px] px-4 py-2'}`}
      style={{ ...styles[variant], opacity: disabled || loading ? 0.5 : 1, cursor: disabled || loading ? 'not-allowed' : 'pointer' }}>
      {loading ? '…' : children}
    </button>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <div onClick={() => onChange(!checked)}
        className="relative rounded-full transition-all"
        style={{ width: 32, height: 18, background: checked ? 'var(--yellow)' : 'var(--bg4)', flexShrink: 0 }}>
        <div className="absolute rounded-full transition-all"
          style={{ top: 2, left: checked ? 16 : 2, width: 14, height: 14, background: checked ? '#000' : 'var(--text3)' }} />
      </div>
      <span className="mono text-[11px]" style={{ color: 'var(--text2)' }}>{label}</span>
    </label>
  )
}
