'use client'

/**
 * components/tabs/CeloAgentTab.tsx — Session L (new file)
 *
 * Celo Payments Agent — Onchain Agents Hackathon (Real World Payments &
 * Everyday Applications). Parallel to AgentWalletTab/CompetitionTab (BNB
 * agent) but fully independent: own wallet setup, own store
 * (celoAgentStore), own loop (useCeloAgentLoop). Nothing here touches the
 * BNB competition agent.
 */

import { useState, useEffect, useCallback } from 'react'
import { useCeloAgentStore, CELO_NETWORK_LABELS } from '@/lib/celoAgentStore'
import { useCeloAgentLoop } from '@/hooks/useCeloAgentLoop'
import {
  generateCeloWallet, celoWalletFromMnemonic, celoWalletFromPrivateKey,
  encryptCeloPrivateKey, decryptCeloPrivateKey,
} from '@/lib/celo/client'
import type { CeloNetwork } from '@/lib/celo/config'
import { get8004ScanUrl } from '@/lib/celo/erc8004'
import {
  PAYMENT_FREQUENCIES, formatFrequency, shortAddr,
  type PaymentRule,
} from '@/lib/celoAgentLoop'

type SetupStep = 'choose' | 'generate' | 'import' | 'unlock' | 'ready'

function Pill({ label, value, color = 'var(--text)' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
      <div className="mono text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text3)' }}>{label}</div>
      <div className="mono text-lg font-extrabold truncate" style={{ color }}>{value}</div>
    </div>
  )
}

function StatusDot({ ok, pulse }: { ok: boolean; pulse?: boolean }) {
  return (
    <span className="w-2 h-2 rounded-full shrink-0"
      style={{ background: ok ? 'var(--green)' : 'var(--text3)', animation: ok && pulse ? 'blink 2s infinite' : 'none' }} />
  )
}

export default function CeloAgentTab() {
  const {
    agentAddress, privateKey, encryptedKey, isWalletLoaded, network,
    celoBalance, cusdBalance,
    setWallet, setEncryptedKey, clearWallet, setNetwork,
    agentConfig, setAgentConfig,
    paymentRules, addPaymentRule, updatePaymentRule, removePaymentRule,
    payments,
    session,
    agentId, registrationTxHash, setAgentIdentity,
  } = useCeloAgentStore()

  const {
    loopStatus, lastCycle, nextRunIn, isRunning, cycleError, isActive,
    paymentsToday, totalPayments, totalUSDSent,
    startLoop, stopLoop, runCycle,
  } = useCeloAgentLoop()

  const [step,        setStep]        = useState<SetupStep>(
    encryptedKey ? 'unlock' : agentAddress ? 'ready' : 'choose'
  )
  const [mnemonic,    setMnemonic]    = useState('')
  const [importMode,  setImportMode]  = useState<'mnemonic' | 'privateKey'>('mnemonic')
  const [importKey,   setImportKey]   = useState('')
  const [password,    setPassword]    = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [unlockPass,  setUnlockPass]  = useState('')
  const [generated,   setGenerated]   = useState<{ address: string; privateKey: string; mnemonic: string } | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [copied,      setCopied]      = useState('')
  const [showKey,     setShowKey]     = useState(false)
  const [registering, setRegistering] = useState(false)

  // ── New payment rule form ─────────────────────────────────────────────
  const [ruleLabel,     setRuleLabel]     = useState('')
  const [ruleRecipient, setRuleRecipient] = useState('')
  const [ruleToken,     setRuleToken]     = useState<'cUSD' | 'CELO'>('cUSD')
  const [ruleAmount,    setRuleAmount]    = useState('1')
  const [ruleFreq,      setRuleFreq]      = useState<keyof typeof PAYMENT_FREQUENCIES>('DAILY')

  useEffect(() => {
    if (isWalletLoaded && privateKey) runCycle()
  }, [isWalletLoaded, privateKey, network])

  // ── Wallet generation ────────────────────────────────────────────────
  function handleGenerate() {
    const w = generateCeloWallet()
    setGenerated(w)
    setStep('generate')
    setError('')
  }

  async function handleSaveGenerated() {
    if (!generated) return
    if (!password || password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirmPass)          { setError('Passwords do not match.'); return }
    setLoading(true)
    try {
      const enc = await encryptCeloPrivateKey(generated.privateKey, password)
      setEncryptedKey(enc)
      setWallet(generated.address, generated.privateKey)
      setStep('ready')
      setGenerated(null)
      setPassword(''); setConfirmPass('')
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  // ── Import from mnemonic or private key ───────────────────────────────
  async function handleImport() {
    if (importMode === 'mnemonic' && !mnemonic.trim())  { setError('Enter your seed phrase.'); return }
    if (importMode === 'privateKey' && !importKey.trim()) { setError('Enter your private key.'); return }
    if (!password || password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirmPass) { setError('Passwords do not match.'); return }
    setLoading(true)
    try {
      const w = importMode === 'mnemonic'
        ? celoWalletFromMnemonic(mnemonic.trim())
        : celoWalletFromPrivateKey(importKey.trim())
      const enc = await encryptCeloPrivateKey(w.privateKey, password)
      setEncryptedKey(enc)
      setWallet(w.address, w.privateKey)
      setStep('ready')
      setMnemonic(''); setImportKey(''); setPassword(''); setConfirmPass('')
    } catch (e: any) {
      setError(importMode === 'mnemonic' ? 'Invalid seed phrase: ' + e.message : 'Invalid private key: ' + e.message)
    }
    setLoading(false)
  }

  // ── Unlock ───────────────────────────────────────────────────────────
  async function handleUnlock() {
    if (!encryptedKey) { setError('No wallet found.'); return }
    if (!unlockPass)   { setError('Enter your password.'); return }
    setLoading(true)
    try {
      const pk = await decryptCeloPrivateKey(encryptedKey, unlockPass)
      const { ethers } = await import('ethers')
      const w = new ethers.Wallet(pk)
      setWallet(w.address, pk)
      setStep('ready')
      setUnlockPass('')
    } catch { setError('Wrong password.') }
    setLoading(false)
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(''), 2000)
  }

  // ── Payment rules ────────────────────────────────────────────────────
  function handleAddRule() {
    if (!ruleRecipient.trim().startsWith('0x') || ruleRecipient.trim().length !== 42) {
      setError('Recipient must be a valid 0x... address.'); return
    }
    const amount = parseFloat(ruleAmount)
    if (!amount || amount <= 0) { setError('Amount must be greater than 0.'); return }
    setError('')

    const rule: PaymentRule = {
      id:          crypto.randomUUID(),
      label:       ruleLabel.trim() || `${amount} ${ruleToken} → ${shortAddr(ruleRecipient.trim())}`,
      recipient:   ruleRecipient.trim(),
      token:       ruleToken,
      amount,
      frequencyMs: PAYMENT_FREQUENCIES[ruleFreq],
      lastPaidAt:  null,
      enabled:     true,
    }
    addPaymentRule(rule)
    setRuleLabel(''); setRuleRecipient(''); setRuleAmount('1')
  }

  const totalUSD = cusdBalance + celoBalance * (lastCycle?.celoPriceUSD ?? 0)

  // ── ERC-8004 registration (Track 3) ───────────────────────────────────
  async function handleRegister() {
    if (!privateKey) return
    setRegistering(true)
    setError('')
    try {
      const res = await fetch('/api/celo-agent/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privateKey,
          network,
          name:        'Binalyst Celo Payments Agent',
          description: 'Autonomous agent for recurring CELO/cUSD payments — Onchain Agents Hackathon (Real World Payments & Everyday Applications).',
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Registration failed')
      if (data.agentId) setAgentIdentity(data.agentId, data.txHash)
      else setError('Registered, but could not determine agentId from the transaction receipt.')
    } catch (e: any) {
      setError(e.message)
    }
    setRegistering(false)
  }


  // ════════════════════════════════════════════════════════════════════════
  // Render
  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className="max-w-3xl mx-auto px-6 py-6 flex flex-col gap-6">

      {/* Header */}
      <div>
        <h2 className="text-lg font-extrabold" style={{ color: 'var(--text)' }}>Celo Payments Agent</h2>
        <p className="mono text-xs mt-1" style={{ color: 'var(--text3)' }}>
          Onchain Agents Hackathon · Real-world payments & everyday applications · Self-custodial
        </p>
      </div>

      {/* Status strip */}
      <div className="flex items-center gap-4 flex-wrap">
        {[
          { label: 'Wallet',      ok: isWalletLoaded },
          { label: 'Loop active', ok: isActive, pulse: true },
          { label: 'CELO funded', ok: celoBalance > 0.01 },
          { label: 'cUSD ready',  ok: cusdBalance > 0 },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <StatusDot ok={s.ok} pulse={s.ok && (s as any).pulse} />
            <span className="mono text-[10px]" style={{ color: s.ok ? 'var(--green)' : 'var(--text3)' }}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-lg p-3 mono text-xs" style={{ background: 'rgba(246,70,93,0.08)', border: '1px solid rgba(246,70,93,0.2)', color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {/* ── STEP: CHOOSE ─────────────────────────────────────────────── */}
      {step === 'choose' && (
        <div className="rounded-xl p-6" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <div className="mono text-[10px] uppercase tracking-widest mb-4" style={{ color: 'var(--text3)' }}>
            Set up your Celo agent wallet
          </div>
          <p className="text-sm mb-6" style={{ color: 'var(--text2)' }}>
            This agent needs its own Celo wallet (separate from your BNB agent wallet) to send
            CELO/cUSD payments autonomously. The private key is encrypted locally — it never
            touches our servers.
          </p>
          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <button onClick={handleGenerate}
              className="rounded-xl p-5 text-left transition-all"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--yellow)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
              <div className="text-2xl mb-2">⚡</div>
              <div className="font-bold mb-1" style={{ color: 'var(--text)' }}>Generate New Wallet</div>
              <div className="mono text-[10px]" style={{ color: 'var(--text3)' }}>
                Create a fresh Celo agent wallet in seconds
              </div>
            </button>
            <button onClick={() => setStep('import')}
              className="rounded-xl p-5 text-left transition-all"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--yellow)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
              <div className="text-2xl mb-2">🔑</div>
              <div className="font-bold mb-1" style={{ color: 'var(--text)' }}>Import Existing</div>
              <div className="mono text-[10px]" style={{ color: 'var(--text3)' }}>
                Import via 12/24-word seed phrase
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: GENERATE ───────────────────────────────────────────── */}
      {step === 'generate' && generated && (
        <div className="rounded-xl p-6 flex flex-col gap-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <div className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
            New Celo wallet generated
          </div>
          <div className="rounded-lg p-4" style={{ background: 'rgba(246,70,93,0.06)', border: '1px solid rgba(246,70,93,0.2)' }}>
            <div className="mono text-xs font-bold mb-1" style={{ color: 'var(--red)' }}>⚠ Back up your seed phrase</div>
            <div className="mono text-[10px]" style={{ color: 'var(--text2)' }}>
              Write this down and store it safely. This is the only way to recover this wallet.
            </div>
          </div>
          <div>
            <div className="mono text-[9px] uppercase tracking-widest mb-2" style={{ color: 'var(--text3)' }}>Address</div>
            <div className="flex items-center gap-2">
              <code className="mono text-xs flex-1 break-all" style={{ color: 'var(--text)' }}>{generated.address}</code>
              <button onClick={() => copy(generated.address, 'addr')} className="mono text-[10px] px-2 py-1 rounded"
                style={{ background: 'var(--bg3)', color: 'var(--text2)' }}>
                {copied === 'addr' ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
          <div>
            <div className="mono text-[9px] uppercase tracking-widest mb-2" style={{ color: 'var(--text3)' }}>Seed phrase</div>
            <div className="flex items-center gap-2">
              <code className="mono text-xs flex-1 break-all p-3 rounded-lg" style={{ background: 'var(--bg3)', color: 'var(--text)' }}>
                {showKey ? generated.mnemonic : '•'.repeat(48)}
              </code>
              <button onClick={() => setShowKey(s => !s)} className="mono text-[10px] px-2 py-1 rounded"
                style={{ background: 'var(--bg3)', color: 'var(--text2)' }}>
                {showKey ? 'Hide' : 'Show'}
              </button>
              <button onClick={() => copy(generated.mnemonic, 'seed')} className="mono text-[10px] px-2 py-1 rounded"
                style={{ background: 'var(--bg3)', color: 'var(--text2)' }}>
                {copied === 'seed' ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <input type="password" placeholder="Password (min 8 chars)" value={password} onChange={e => setPassword(e.target.value)}
              className="mono text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            <input type="password" placeholder="Confirm password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
              className="mono text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          </div>
          <button onClick={handleSaveGenerated} disabled={loading}
            className="mono text-xs font-bold px-4 py-2.5 rounded-lg" style={{ background: 'var(--yellow)', color: '#000' }}>
            {loading ? 'Saving…' : 'Save & Continue'}
          </button>
        </div>
      )}

      {/* ── STEP: IMPORT ─────────────────────────────────────────────── */}
      {step === 'import' && (
        <div className="rounded-xl p-6 flex flex-col gap-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <div className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>Import wallet</div>

          {/* Mode toggle */}
          <div className="flex gap-2">
            {(['mnemonic', 'privateKey'] as const).map(m => (
              <button key={m} onClick={() => setImportMode(m)}
                className="mono text-[10px] px-3 py-1.5 rounded-full"
                style={{
                  background: importMode === m ? 'var(--yellow)' : 'var(--bg3)',
                  color:      importMode === m ? '#000' : 'var(--text2)',
                  border:     '1px solid var(--border)',
                }}>
                {m === 'mnemonic' ? 'Seed phrase' : 'Private key'}
              </button>
            ))}
          </div>

          {importMode === 'mnemonic' ? (
            <textarea placeholder="Enter your 12/24-word seed phrase" value={mnemonic} onChange={e => setMnemonic(e.target.value)}
              rows={3} className="mono text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          ) : (
            <input type="password" placeholder="0x... private key" value={importKey} onChange={e => setImportKey(e.target.value)}
              className="mono text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          )}

          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <input type="password" placeholder="Password (min 8 chars)" value={password} onChange={e => setPassword(e.target.value)}
              className="mono text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            <input type="password" placeholder="Confirm password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
              className="mono text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep('choose')} className="mono text-xs px-4 py-2.5 rounded-lg" style={{ background: 'var(--bg3)', color: 'var(--text2)' }}>Back</button>
            <button onClick={handleImport} disabled={loading} className="mono text-xs font-bold px-4 py-2.5 rounded-lg flex-1" style={{ background: 'var(--yellow)', color: '#000' }}>
              {loading ? 'Importing…' : 'Import & Continue'}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: UNLOCK ─────────────────────────────────────────────── */}
      {step === 'unlock' && (
        <div className="rounded-xl p-6 flex flex-col gap-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <div className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>Unlock Celo wallet</div>
          <input type="password" placeholder="Password" value={unlockPass} onChange={e => setUnlockPass(e.target.value)}
            className="mono text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          <div className="flex gap-3">
            <button onClick={() => { clearWallet(); setEncryptedKey(''); setStep('choose') }} className="mono text-xs px-4 py-2.5 rounded-lg" style={{ background: 'var(--bg3)', color: 'var(--text2)' }}>Start over</button>
            <button onClick={handleUnlock} disabled={loading} className="mono text-xs font-bold px-4 py-2.5 rounded-lg flex-1" style={{ background: 'var(--yellow)', color: '#000' }}>
              {loading ? 'Unlocking…' : 'Unlock'}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: READY — main dashboard ────────────────────────────── */}
      {step === 'ready' && (
        <>
          {/* Network selector */}
          <div className="flex items-center gap-3">
            <span className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>Network</span>
            {(['alfajores', 'mainnet'] as CeloNetwork[]).map(n => (
              <button key={n} onClick={() => setNetwork(n)}
                className="mono text-[10px] px-3 py-1.5 rounded-full"
                style={{
                  background: network === n ? 'var(--yellow)' : 'var(--bg2)',
                  color:      network === n ? '#000' : 'var(--text2)',
                  border:     '1px solid var(--border)',
                }}>
                {CELO_NETWORK_LABELS[n]}
              </button>
            ))}
          </div>

          {/* Address */}
          <div className="rounded-xl p-4 flex items-center justify-between gap-2" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div>
              <div className="mono text-[9px] uppercase tracking-widest mb-1" style={{ color: 'var(--text3)' }}>Agent address</div>
              <code className="mono text-xs break-all" style={{ color: 'var(--text)' }}>{agentAddress}</code>
            </div>
            <button onClick={() => copy(agentAddress, 'addr2')} className="mono text-[10px] px-2 py-1 rounded shrink-0"
              style={{ background: 'var(--bg3)', color: 'var(--text2)' }}>
              {copied === 'addr2' ? 'Copied' : 'Copy'}
            </button>
          </div>

          {/* Balances */}
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <Pill label="CELO" value={celoBalance.toFixed(4)} />
            <Pill label="cUSD" value={cusdBalance.toFixed(2)} color="var(--green)" />
            <Pill label="Total (USD)" value={`$${totalUSD.toFixed(2)}`} color="var(--yellow)" />
          </div>

          {/* Loop controls */}
          <div className="rounded-xl p-4 flex items-center justify-between flex-wrap gap-3" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div>
              <div className="mono text-[9px] uppercase tracking-widest mb-1" style={{ color: 'var(--text3)' }}>Loop status</div>
              <div className="mono text-sm font-bold" style={{ color: isActive ? 'var(--green)' : 'var(--text2)' }}>
                {loopStatus.toUpperCase()} {isActive && nextRunIn > 0 && `· next run in ${nextRunIn}s`}
              </div>
              {cycleError && <div className="mono text-[10px] mt-1" style={{ color: 'var(--red)' }}>{cycleError}</div>}
            </div>
            <div className="flex gap-2">
              {!isActive ? (
                <button onClick={() => startLoop()} className="mono text-xs font-bold px-4 py-2 rounded-lg" style={{ background: 'var(--green)', color: '#000' }}>
                  Start Agent
                </button>
              ) : (
                <button onClick={stopLoop} className="mono text-xs font-bold px-4 py-2 rounded-lg" style={{ background: 'var(--red)', color: '#fff' }}>
                  Stop Agent
                </button>
              )}
              <button onClick={() => runCycle()} disabled={isRunning} className="mono text-xs px-4 py-2 rounded-lg" style={{ background: 'var(--bg3)', color: 'var(--text2)' }}>
                {isRunning ? 'Running…' : 'Run Once'}
              </button>
            </div>
          </div>

          {/* Agent config */}
          <div className="rounded-xl p-4 flex flex-wrap gap-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <label className="flex items-center gap-2 mono text-xs" style={{ color: 'var(--text2)' }}>
              <input type="checkbox" checked={agentConfig.dryRun} onChange={e => setAgentConfig({ dryRun: e.target.checked })} />
              Dry run (simulate — no real transactions)
            </label>
            <label className="flex items-center gap-2 mono text-xs" style={{ color: 'var(--text2)' }}>
              <input type="checkbox" checked={agentConfig.autonomousMode} onChange={e => setAgentConfig({ autonomousMode: e.target.checked })}
                disabled={agentConfig.dryRun} />
              Autonomous mode (send real payments)
            </label>
          </div>
          {!agentConfig.dryRun && !agentConfig.autonomousMode && (
            <div className="mono text-[10px]" style={{ color: 'var(--yellow)' }}>
              Dry run is off but autonomous mode is off — due payments will be evaluated but
              blocked. Enable autonomous mode to send real on-chain payments.
            </div>
          )}

          {/* ERC-8004 Agent Identity (Track 3 — 8004scan) */}
          <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
              Agent Identity · ERC-8004
            </div>
            {agentId ? (
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="mono text-sm font-bold" style={{ color: 'var(--green)' }}>
                    Registered — Agent #{agentId}
                  </div>
                  {registrationTxHash && (
                    <div className="mono text-[10px]" style={{ color: 'var(--text3)' }}>
                      tx: {shortAddr(registrationTxHash)}
                    </div>
                  )}
                </div>
                <a href={get8004ScanUrl(agentId)} target="_blank" rel="noopener noreferrer"
                  className="mono text-[10px] font-bold px-3 py-1.5 rounded-lg" style={{ background: 'var(--yellow)', color: '#000' }}>
                  View on 8004scan ↗
                </a>
              </div>
            ) : (
              <>
                <p className="mono text-[10px]" style={{ color: 'var(--text2)' }}>
                  Register this agent's wallet as an ERC-8004 identity (an on-chain NFT) so it's
                  discoverable on 8004scan. One-time, on Celo Mainnet only.
                </p>
                {network !== 'mainnet' ? (
                  <div className="mono text-[10px]" style={{ color: 'var(--yellow)' }}>
                    ERC-8004 is deployed on Celo Mainnet only. Switch network above to register.
                  </div>
                ) : (
                  <button onClick={handleRegister} disabled={registering}
                    className="mono text-xs font-bold px-4 py-2 rounded-lg self-start" style={{ background: 'var(--yellow)', color: '#000' }}>
                    {registering ? 'Registering…' : 'Register Agent (ERC-8004)'}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Session stats */}
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <Pill label="Payments today" value={paymentsToday} />
            <Pill label="Total payments" value={totalPayments} />
            <Pill label="Total sent (USD)" value={`$${totalUSDSent.toFixed(2)}`} />
          </div>

          {/* Payment rules */}
          <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>Payment rules</div>

            {paymentRules.length === 0 && (
              <div className="mono text-xs" style={{ color: 'var(--text3)' }}>
                No payment rules yet. Add one below — e.g. a recurring allowance, subscription, or DCA transfer.
              </div>
            )}

            {paymentRules.map(rule => (
              <div key={rule.id} className="rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap"
                style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                <div>
                  <div className="mono text-xs font-bold" style={{ color: 'var(--text)' }}>{rule.label}</div>
                  <div className="mono text-[10px]" style={{ color: 'var(--text3)' }}>
                    {rule.amount} {rule.token} → {shortAddr(rule.recipient)} · {formatFrequency(rule.frequencyMs)}
                    {rule.lastPaidAt && ` · last: ${new Date(rule.lastPaidAt).toLocaleString()}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 mono text-[10px]" style={{ color: 'var(--text2)' }}>
                    <input type="checkbox" checked={rule.enabled} onChange={e => updatePaymentRule(rule.id, { enabled: e.target.checked })} />
                    Enabled
                  </label>
                  <button onClick={() => removePaymentRule(rule.id)} className="mono text-[10px] px-2 py-1 rounded" style={{ background: 'var(--bg2)', color: 'var(--red)' }}>
                    Remove
                  </button>
                </div>
              </div>
            ))}

            {/* Add rule form */}
            <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
              <div className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>Add payment rule</div>
              <input placeholder="Label (optional, e.g. 'Weekly allowance')" value={ruleLabel} onChange={e => setRuleLabel(e.target.value)}
                className="mono text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)' }} />
              <input placeholder="Recipient address (0x...)" value={ruleRecipient} onChange={e => setRuleRecipient(e.target.value)}
                className="mono text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)' }} />
              <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                <select value={ruleToken} onChange={e => setRuleToken(e.target.value as 'cUSD' | 'CELO')}
                  className="mono text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                  <option value="cUSD">cUSD</option>
                  <option value="CELO">CELO</option>
                </select>
                <input type="number" min="0" step="any" placeholder="Amount" value={ruleAmount} onChange={e => setRuleAmount(e.target.value)}
                  className="mono text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                <select value={ruleFreq} onChange={e => setRuleFreq(e.target.value as keyof typeof PAYMENT_FREQUENCIES)}
                  className="mono text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                  <option value="HOURLY">Hourly</option>
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                </select>
              </div>
              <button onClick={handleAddRule} className="mono text-xs font-bold px-4 py-2 rounded-lg" style={{ background: 'var(--yellow)', color: '#000' }}>
                Add rule
              </button>
            </div>
          </div>

          {/* Payment log */}
          <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>Recent payments</div>
            {payments.length === 0 && (
              <div className="mono text-xs" style={{ color: 'var(--text3)' }}>No payments yet.</div>
            )}
            {payments.slice(0, 10).map(p => (
              <div key={p.id} className="flex items-center justify-between gap-2 mono text-[10px] py-1" style={{ borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text3)' }}>{new Date(p.timestamp).toLocaleString()}</span>
                <span style={{ color: 'var(--text)' }}>{p.amount} {p.token} → {shortAddr(p.recipient)}</span>
                <span style={{
                  color: p.status === 'confirmed' ? 'var(--green)'
                       : p.status === 'simulated' ? 'var(--yellow)'
                       : p.status === 'blocked'   ? 'var(--text3)'
                       : 'var(--red)',
                }}>
                  {p.status}{p.txHash ? ` · ${shortAddr(p.txHash)}` : ''}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
