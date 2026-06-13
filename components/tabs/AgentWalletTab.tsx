'use client'

/**
 * components/tabs/AgentWalletTab.tsx
 * Session A: Wallet setup, competition registration, balance display.
 * Self-custodial — private key never leaves the browser unencrypted.
 *
 * Session 1 (X Layer): Added chain selector strip at the top of the
 * ready step. All BSC/BNB logic below is unchanged.
 */

import { useState, useEffect, useCallback } from 'react'
import { useAgentStore } from '@/lib/agentStore'
import {
  generateAgentWallet,
  walletFromMnemonic,
  encryptPrivateKey,
  decryptPrivateKey,
  ELIGIBLE_TOKENS,
} from '@/lib/twak/client'
import {
  switchToXLayer,
  switchToBSC,
  getConnectedChainId,
} from '@/lib/xlayer/provider'
import { XLAYER_CHAIN_ID, XLAYER_EXPLORER_ADDR } from '@/lib/xlayer/config'

type SetupStep = 'choose' | 'generate' | 'import' | 'unlock' | 'ready'

function Pill({
  label, value, color = 'var(--text)',
}: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
      <div className="mono text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text3)' }}>{label}</div>
      <div className="mono text-lg font-extrabold truncate" style={{ color }}>{value}</div>
    </div>
  )
}

function StatusDot({ ok, pulse }: { ok: boolean; pulse?: boolean }) {
  return (
    <span
      className="w-2 h-2 rounded-full shrink-0"
      style={{
        background: ok ? 'var(--green)' : 'var(--text3)',
        animation: ok && pulse ? 'blink 2s infinite' : 'none',
      }}
    />
  )
}

export default function AgentWalletTab() {
  const {
    agentAddress, privateKey, encryptedKey, isWalletLoaded,
    bnbBalance, usdtBalance,
    setWallet, setEncryptedKey, clearWallet, setBNBBalance, setUSDTBalance,
    session, updateSession,
  } = useAgentStore()

  const [step,          setStep]          = useState<SetupStep>(
    encryptedKey ? 'unlock' : agentAddress ? 'ready' : 'choose'
  )
  const [mnemonic,      setMnemonic]      = useState('')
  const [password,      setPassword]      = useState('')
  const [confirmPass,   setConfirmPass]   = useState('')
  const [unlockPass,    setUnlockPass]    = useState('')
  const [generated,     setGenerated]     = useState<{ address: string; privateKey: string; mnemonic: string } | null>(null)
  const [loading,       setLoading]       = useState(false)
  const [registering,   setRegistering]   = useState(false)
  const [refreshing,    setRefreshing]    = useState(false)
  const [error,         setError]         = useState('')
  const [regResult,     setRegResult]     = useState<{ success: boolean; txHash?: string; message: string } | null>(null)
  const [copied,        setCopied]        = useState('')
  const [showKey,       setShowKey]       = useState(false)

  // ── X Layer chain selector state (Session 1 addition) ───────────────────
  const [activeChain,    setActiveChain]    = useState<'bsc' | 'xlayer'>('bsc')
  const [chainSwitching, setChainSwitching] = useState(false)
  const [chainError,     setChainError]     = useState('')

  // Detect connected chain on load
  useEffect(() => {
    getConnectedChainId().then(id => {
      if (id === XLAYER_CHAIN_ID) setActiveChain('xlayer')
    })
  }, [])

  async function handleChainSwitch(target: 'bsc' | 'xlayer') {
    setChainSwitching(true); setChainError('')
    const result = target === 'xlayer' ? await switchToXLayer() : await switchToBSC()
    if (result.success) {
      setActiveChain(target)
    } else {
      setChainError(result.error ?? 'Chain switch failed')
    }
    setChainSwitching(false)
  }

  // ── Balance refresh ──────────────────────────────────────────────────────
  const refreshBalances = useCallback(async () => {
    if (!privateKey) return
    setRefreshing(true)
    try {
      const res  = await fetch('/api/agent/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ privateKey, tokens: ['USDT', 'FDUSD', 'BNB'] }),
      })
      const data = await res.json()
      if (data.success) {
        setBNBBalance(data.bnbBalance)
        setUSDTBalance(data.tokenBalances?.USDT ?? 0)
        if (data.isRegistered) updateSession({ isRegistered: true })
      }
    } catch {}
    setRefreshing(false)
  }, [privateKey])

  useEffect(() => {
    if (isWalletLoaded && privateKey) refreshBalances()
  }, [isWalletLoaded, privateKey])

  // ── Wallet generation ────────────────────────────────────────────────────
  function handleGenerate() {
    const w = generateAgentWallet()
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
      const enc = await encryptPrivateKey(generated.privateKey, password)
      setEncryptedKey(enc)
      setWallet(generated.address, generated.privateKey)
      setStep('ready')
      setGenerated(null)
      setPassword(''); setConfirmPass('')
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  // ── Import from mnemonic ─────────────────────────────────────────────────
  async function handleImport() {
    if (!mnemonic.trim()) { setError('Enter your seed phrase.'); return }
    if (!password || password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirmPass) { setError('Passwords do not match.'); return }
    setLoading(true)
    try {
      const w   = walletFromMnemonic(mnemonic.trim())
      const enc = await encryptPrivateKey(w.privateKey, password)
      setEncryptedKey(enc)
      setWallet(w.address, w.privateKey)
      setStep('ready')
      setMnemonic(''); setPassword(''); setConfirmPass('')
    } catch (e: any) { setError('Invalid seed phrase: ' + e.message) }
    setLoading(false)
  }

  // ── Unlock ───────────────────────────────────────────────────────────────
  async function handleUnlock() {
    if (!encryptedKey) { setError('No wallet found.'); return }
    if (!unlockPass)   { setError('Enter your password.'); return }
    setLoading(true)
    try {
      const pk = await decryptPrivateKey(encryptedKey, unlockPass)
      // Derive address from decrypted key
      const { ethers } = await import('ethers')
      const w = new ethers.Wallet(pk)
      setWallet(w.address, pk)
      setStep('ready')
      setUnlockPass('')
    } catch { setError('Wrong password.') }
    setLoading(false)
  }

  // ── Competition registration ─────────────────────────────────────────────
  async function handleRegister() {
    if (!privateKey) return
    setRegistering(true); setRegResult(null); setError('')
    try {
      const res  = await fetch('/api/agent/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ privateKey }),
      })
      const data = await res.json()
      setRegResult({ success: data.success, txHash: data.txHash, message: data.message })
      if (data.success) updateSession({ isRegistered: true, registrationTx: data.txHash ?? '' })
    } catch (e: any) { setError(e.message) }
    setRegistering(false)
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(''), 2000)
  }

  const isRegistered = session?.isRegistered ?? false

  // ════════════════════════════════════════════════════════════════════════════
  // Render
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="max-w-3xl mx-auto px-6 py-6 flex flex-col gap-6">

      {/* Header */}
      <div>
        <h2 className="text-lg font-extrabold" style={{ color: 'var(--text)' }}>Agent Wallet</h2>
        <p className="mono text-xs mt-1" style={{ color: 'var(--text3)' }}>
          Self-custodial BSC wallet · Keys never leave your device · Powered by Trust Wallet Agent Kit
        </p>
      </div>

      {/* Status strip */}
      <div className="flex items-center gap-4 flex-wrap">
        {[
          { label: 'Wallet',       ok: isWalletLoaded },
          { label: 'Registered',   ok: isRegistered },
          { label: 'BNB funded',   ok: bnbBalance > 0.005 },
          { label: 'USDT ready',   ok: usdtBalance > 1 },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <StatusDot ok={s.ok} pulse={s.ok} />
            <span className="mono text-[10px]" style={{ color: s.ok ? 'var(--green)' : 'var(--text3)' }}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* ── STEP: CHOOSE ─────────────────────────────────────────────────── */}
      {step === 'choose' && (
        <div className="rounded-xl p-6" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <div className="mono text-[10px] uppercase tracking-widest mb-4" style={{ color: 'var(--text3)' }}>
            Set up your agent wallet
          </div>
          <p className="text-sm mb-6" style={{ color: 'var(--text2)' }}>
            Your agent needs a BSC wallet to sign transactions autonomously.
            The private key is encrypted locally with your password — it never touches our servers.
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
                Create a fresh BSC agent wallet in seconds
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

      {/* ── STEP: GENERATE ───────────────────────────────────────────────── */}
      {step === 'generate' && generated && (
        <div className="rounded-xl p-6 flex flex-col gap-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <div className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
            New wallet generated
          </div>

          <div className="rounded-lg p-4" style={{ background: 'rgba(246,70,93,0.06)', border: '1px solid rgba(246,70,93,0.2)' }}>
            <div className="mono text-xs font-bold mb-1" style={{ color: 'var(--red)' }}>⚠ Back up your seed phrase</div>
            <div className="mono text-[10px]" style={{ color: 'var(--text2)' }}>
              Write this down and store it safely. This is the only way to recover your wallet.
            </div>
          </div>

          <div>
            <div className="mono text-[9px] uppercase tracking-widest mb-2" style={{ color: 'var(--text3)' }}>Address</div>
            <div className="flex items-center gap-2">
              <div className="mono text-xs flex-1 truncate px-3 py-2 rounded-lg"
                style={{ background: 'var(--bg3)', color: 'var(--text)' }}>
                {generated.address}
              </div>
              <button onClick={() => copy(generated.address, 'address')}
                className="mono text-[10px] px-3 py-2 rounded-lg transition-all"
                style={{ background: 'var(--bg3)', color: copied === 'address' ? 'var(--green)' : 'var(--text3)' }}>
                {copied === 'address' ? '✓' : 'Copy'}
              </button>
            </div>
          </div>

          <div>
            <div className="mono text-[9px] uppercase tracking-widest mb-2" style={{ color: 'var(--text3)' }}>Seed Phrase</div>
            <div className="grid gap-2 p-3 rounded-lg" style={{ background: 'var(--bg3)', gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {generated.mnemonic.split(' ').map((word, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="mono text-[9px]" style={{ color: 'var(--text3)' }}>{i + 1}.</span>
                  <span className="mono text-xs" style={{ color: 'var(--text)' }}>{word}</span>
                </div>
              ))}
            </div>
            <button onClick={() => copy(generated.mnemonic, 'mnemonic')}
              className="mono text-[10px] mt-2 px-3 py-1.5 rounded-lg w-full transition-all"
              style={{ background: 'var(--bg3)', color: copied === 'mnemonic' ? 'var(--green)' : 'var(--text3)' }}>
              {copied === 'mnemonic' ? '✓ Copied' : 'Copy seed phrase'}
            </button>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-3">
            {[
              { label: 'Encryption Password', val: password, set: setPassword, placeholder: 'Min 8 characters' },
              { label: 'Confirm Password',    val: confirmPass, set: setConfirmPass, placeholder: 'Repeat password' },
            ].map(({ label, val, set, placeholder }) => (
              <div key={label} className="flex flex-col gap-1.5">
                <label className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>{label}</label>
                <input type="password" value={val} onChange={e => set(e.target.value)} placeholder={placeholder}
                  className="mono text-sm px-4 py-3 rounded-xl outline-none"
                  style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--yellow)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border2)')} />
              </div>
            ))}
          </div>

          {error && <ErrBox msg={error} />}

          <div className="flex gap-2">
            <button onClick={() => { setStep('choose'); setGenerated(null); setError('') }}
              className="flex-1 py-2.5 rounded-xl mono text-xs"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
              ← Back
            </button>
            <button onClick={handleSaveGenerated} disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
              style={{ background: loading ? 'var(--bg4)' : 'var(--yellow)', color: loading ? 'var(--text3)' : '#000' }}>
              {loading && <Spinner />}
              {loading ? 'Encrypting...' : 'Save & Continue →'}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: IMPORT ─────────────────────────────────────────────────── */}
      {step === 'import' && (
        <div className="rounded-xl p-6 flex flex-col gap-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <div className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>Import wallet</div>

          <div className="flex flex-col gap-1.5">
            <label className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
              Seed Phrase (12 or 24 words)
            </label>
            <textarea value={mnemonic} onChange={e => setMnemonic(e.target.value)} rows={3}
              placeholder="word1 word2 word3 ..."
              className="mono text-sm px-4 py-3 rounded-xl outline-none resize-none"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)' }}
              onFocus={e => (e.target.style.borderColor = 'var(--yellow)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border2)')} />
          </div>

          {[
            { label: 'Encryption Password', val: password,   set: setPassword,   ph: 'Min 8 characters' },
            { label: 'Confirm Password',    val: confirmPass, set: setConfirmPass, ph: 'Repeat password' },
          ].map(({ label, val, set, ph }) => (
            <div key={label} className="flex flex-col gap-1.5">
              <label className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>{label}</label>
              <input type="password" value={val} onChange={e => set(e.target.value)} placeholder={ph}
                className="mono text-sm px-4 py-3 rounded-xl outline-none"
                style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)' }}
                onFocus={e => (e.target.style.borderColor = 'var(--yellow)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border2)')} />
            </div>
          ))}

          {error && <ErrBox msg={error} />}

          <div className="flex gap-2">
            <button onClick={() => { setStep('choose'); setError('') }}
              className="flex-1 py-2.5 rounded-xl mono text-xs"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
              ← Back
            </button>
            <button onClick={handleImport} disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
              style={{ background: loading ? 'var(--bg4)' : 'var(--yellow)', color: loading ? 'var(--text3)' : '#000' }}>
              {loading && <Spinner />}
              {loading ? 'Importing...' : 'Import Wallet →'}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: UNLOCK ─────────────────────────────────────────────────── */}
      {step === 'unlock' && (
        <div className="rounded-xl p-6 flex flex-col gap-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <div className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
            Unlock your agent wallet
          </div>
          <div className="mono text-xs" style={{ color: 'var(--text2)' }}>
            Wallet found: <span style={{ color: 'var(--yellow)' }}>{agentAddress.slice(0, 10)}...{agentAddress.slice(-6)}</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>Password</label>
            <input type="password" value={unlockPass} onChange={e => setUnlockPass(e.target.value)}
              placeholder="Enter encryption password"
              className="mono text-sm px-4 py-3 rounded-xl outline-none"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)' }}
              onFocus={e => (e.target.style.borderColor = 'var(--yellow)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border2)')}
              onKeyDown={e => { if (e.key === 'Enter') handleUnlock() }} />
          </div>

          {error && <ErrBox msg={error} />}

          <div className="flex gap-2">
            <button onClick={() => { clearWallet(); setStep('choose'); setError('') }}
              className="mono text-xs px-4 py-2.5 rounded-xl"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text3)' }}>
              Use different wallet
            </button>
            <button onClick={handleUnlock} disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
              style={{ background: loading ? 'var(--bg4)' : 'var(--yellow)', color: loading ? 'var(--text3)' : '#000' }}>
              {loading && <Spinner />}
              {loading ? 'Unlocking...' : 'Unlock →'}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: READY ──────────────────────────────────────────────────── */}
      {step === 'ready' && isWalletLoaded && (
        <>
          {/* ── Chain selector (Session 1: X Layer addition) ──────────────── */}
          <div className="rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div className="mono text-[10px] uppercase tracking-widest mb-3" style={{ color: 'var(--text3)' }}>
              Active Chain
            </div>
            <div className="flex gap-2">
              {([
                { id: 'bsc',    label: 'BNB Smart Chain', sub: 'BSC · chainId 56',   color: '#F0B90B' },
                { id: 'xlayer', label: 'X Layer',         sub: 'OKX · chainId 196',  color: '#3498db' },
              ] as const).map(chain => (
                <button
                  key={chain.id}
                  onClick={() => handleChainSwitch(chain.id)}
                  disabled={chainSwitching || activeChain === chain.id}
                  className="flex-1 rounded-xl p-3 text-left transition-all"
                  style={{
                    background: activeChain === chain.id ? `${chain.color}12` : 'var(--bg3)',
                    border: `1px solid ${activeChain === chain.id ? chain.color + '50' : 'var(--border)'}`,
                    cursor: activeChain === chain.id ? 'default' : 'pointer',
                    opacity: chainSwitching && activeChain !== chain.id ? 0.5 : 1,
                  }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full"
                      style={{ background: activeChain === chain.id ? chain.color : 'var(--text3)' }} />
                    <span className="text-xs font-bold"
                      style={{ color: activeChain === chain.id ? chain.color : 'var(--text2)' }}>
                      {chain.label}
                    </span>
                    {activeChain === chain.id && (
                      <span className="mono text-[9px] ml-auto px-1.5 py-0.5 rounded"
                        style={{ background: `${chain.color}20`, color: chain.color }}>
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div className="mono text-[9px]" style={{ color: 'var(--text3)' }}>{chain.sub}</div>
                </button>
              ))}
            </div>
            {chainError && (
              <div className="mono text-[10px] mt-2 p-2 rounded-lg"
                style={{ background: 'rgba(246,70,93,0.08)', color: 'var(--red)' }}>
                {chainError}
              </div>
            )}
            {activeChain === 'xlayer' && (
              <div className="mono text-[10px] mt-2 p-2 rounded-lg"
                style={{ background: 'rgba(52,152,219,0.08)', border: '1px solid rgba(52,152,219,0.2)', color: '#3498db' }}>
                X Layer active — World Cup Hook tab available in Intelligence section
              </div>
            )}
          </div>

            {/* Wallet stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Pill label="BNB Balance"    value={bnbBalance.toFixed(4) + ' BNB'} color={bnbBalance > 0.005 ? 'var(--green)' : 'var(--red)'} />
            <Pill label="USDT Balance"   value={'$' + usdtBalance.toFixed(2)}   color="var(--text)" />
            <Pill label="Network"        value="BSC Mainnet"                     color="var(--yellow)" />
            <Pill label="Competition"    value={isRegistered ? '✓ Registered' : 'Not registered'} color={isRegistered ? 'var(--green)' : 'var(--text3)'} />
          </div>

          {/* Address card */}
          <div className="rounded-xl p-5" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div className="mono text-[10px] uppercase tracking-widest mb-3" style={{ color: 'var(--text3)' }}>
              Agent Wallet Address
            </div>
            <div className="flex items-center gap-2">
              <div className="mono text-sm flex-1 truncate px-3 py-2.5 rounded-lg"
                style={{ background: 'var(--bg3)', color: 'var(--text)' }}>
                {agentAddress}
              </div>
              <button onClick={() => copy(agentAddress, 'addr')}
                className="mono text-[10px] px-3 py-2.5 rounded-lg transition-all shrink-0"
                style={{ background: 'var(--bg3)', color: copied === 'addr' ? 'var(--green)' : 'var(--text3)', border: '1px solid var(--border)' }}>
                {copied === 'addr' ? '✓ Copied' : 'Copy'}
              </button>
              <a
                href={activeChain === 'xlayer'
                  ? XLAYER_EXPLORER_ADDR(agentAddress)
                  : `https://bscscan.com/address/${agentAddress}`}
                target="_blank" rel="noreferrer"
                className="mono text-[10px] px-3 py-2.5 rounded-lg shrink-0"
                style={{ background: 'var(--bg3)', color: 'var(--text3)', border: '1px solid var(--border)' }}>
                {activeChain === 'xlayer' ? 'OKLink ↗' : 'BSCScan ↗'}
              </a>
            </div>
            <div className="mono text-[10px] mt-2" style={{ color: 'var(--text3)' }}>
              Fund this address with BNB (gas) and USDT (trading capital) before running the agent.
            </div>
          </div>

          {/* Registration */}
          {!isRegistered ? (
            <div className="rounded-xl p-5" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <div className="mono text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--text3)' }}>
                Competition Registration
              </div>
              <p className="text-sm mb-4" style={{ color: 'var(--text2)' }}>
                Register your agent wallet on the BSC competition contract to participate in live trading.
                This writes your address on-chain — one transaction, ~0.001 BNB gas.
              </p>
              <div className="mono text-xs p-3 rounded-lg mb-4"
                style={{ background: 'var(--bg3)', color: 'var(--text2)' }}>
                Contract: <a href="https://bscscan.com/address/0x212c61b9b72c95d95bf29cf032f5e5635629aed5"
                  target="_blank" rel="noreferrer" style={{ color: 'var(--yellow)' }}>
                  0x212c...aed5 ↗
                </a>
              </div>

              {regResult && (
                <div className="mono text-xs p-3 rounded-lg mb-4"
                  style={{
                    background: regResult.success ? 'rgba(14,203,129,0.08)' : 'rgba(246,70,93,0.08)',
                    border: `1px solid ${regResult.success ? 'rgba(14,203,129,0.25)' : 'rgba(246,70,93,0.25)'}`,
                    color: regResult.success ? 'var(--green)' : 'var(--red)',
                  }}>
                  {regResult.message}
                  {regResult.txHash && (
                    <a href={`https://bscscan.com/tx/${regResult.txHash}`} target="_blank" rel="noreferrer"
                      className="block mt-1" style={{ color: 'var(--yellow)' }}>
                      View on BSCScan ↗
                    </a>
                  )}
                </div>
              )}

              <button onClick={handleRegister} disabled={registering || bnbBalance < 0.001}
                className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                style={{
                  background: registering || bnbBalance < 0.001 ? 'var(--bg4)' : 'var(--yellow)',
                  color: registering || bnbBalance < 0.001 ? 'var(--text3)' : '#000',
                  cursor: registering || bnbBalance < 0.001 ? 'not-allowed' : 'pointer',
                }}>
                {registering && <Spinner />}
                {registering ? 'Registering on BSC...' : bnbBalance < 0.001 ? 'Fund wallet first (need BNB for gas)' : '⚡ Register for Competition'}
              </button>
            </div>
          ) : (
            <div className="rounded-xl p-4 flex items-center gap-3"
              style={{ background: 'rgba(14,203,129,0.06)', border: '1px solid rgba(14,203,129,0.2)' }}>
              <span className="text-2xl">✓</span>
              <div>
                <div className="font-semibold text-sm" style={{ color: 'var(--green)' }}>Registered for competition</div>
                {session?.registrationTx && (
                  <a href={`https://bscscan.com/tx/${session.registrationTx}`} target="_blank" rel="noreferrer"
                    className="mono text-[10px]" style={{ color: 'var(--text3)' }}>
                    Tx: {session.registrationTx.slice(0, 18)}... ↗
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Actions row */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={refreshBalances} disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg mono text-xs transition-all"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
              {refreshing && <Spinner small />}
              {refreshing ? 'Refreshing...' : '↻ Refresh balances'}
            </button>
            <button onClick={() => { clearWallet(); setStep('choose') }}
              className="px-4 py-2 rounded-lg mono text-xs"
              style={{ background: 'rgba(246,70,93,0.06)', border: '1px solid rgba(246,70,93,0.2)', color: 'var(--red)' }}>
              Lock wallet
            </button>
          </div>

          {/* Eligible tokens preview */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg2)' }}>
              <span className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
                Eligible Tokens ({Object.keys(ELIGIBLE_TOKENS).length})
              </span>
            </div>
            <div className="flex flex-wrap gap-2 p-4" style={{ background: 'var(--bg2)' }}>
              {Object.keys(ELIGIBLE_TOKENS).map(sym => (
                <span key={sym} className="mono text-[10px] px-2 py-1 rounded"
                  style={{ background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)' }}>
                  {sym}
                </span>
              ))}
            </div>
          </div>
        </>
      )}

      {error && step !== 'generate' && step !== 'import' && step !== 'unlock' && (
        <ErrBox msg={error} />
      )}
    </div>
  )
}

function ErrBox({ msg }: { msg: string }) {
  return (
    <div className="mono text-xs p-3 rounded-lg"
      style={{ background: 'rgba(246,70,93,0.08)', border: '1px solid rgba(246,70,93,0.25)', color: 'var(--red)' }}>
      {msg}
    </div>
  )
}

function Spinner({ small }: { small?: boolean }) {
  const s = small ? 10 : 14
  return (
    <span className="rounded-full border-2 border-black/30 border-t-black animate-spin-slow"
      style={{ width: s, height: s, display: 'inline-block', flexShrink: 0 }} />
  )
}
