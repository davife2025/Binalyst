'use client'

/**
 * components/tabs/MantleAgentTab.tsx — Session N3 (new file)
 *
 * Mantle AI Trading Agent — full dashboard tab.
 * Part of: The Turing Test Hackathon — AI Trading & Strategy track.
 *
 * Sections:
 *  1. Status strip (wallet / loop / network / ERC-8004)
 *  2. Wallet setup wizard (generate / import / unlock) — same flow as CeloAgentTab
 *  3. Network selector (testnet ↔ mainnet)
 *  4. Portfolio overview (MNT, mETH, USDY, USDC, USD total)
 *  5. Bybit live prices (MNTUSDT, ETHUSDT, BTCUSDT)
 *  6. Agent controls (dry-run, autonomous, symbol config)
 *  7. Loop controls (Start / Stop / Run Once · next-run countdown)
 *  8. ERC-8004 identity card (Register / View on 8004scan)
 *  9. On-chain benchmark panel (count, sink link, last record)
 * 10. Trade log (last 20 trades with status, score, tx link)
 *
 * Fully isolated from all other tabs — imports only from N1/N2 files.
 * No existing component or tab is modified.
 */

import { useState, useEffect } from 'react'
import { useMantleAgentStore, MANTLE_NETWORK_LABELS } from '@/lib/mantleAgentStore'
import { useMantleAgentLoop }    from '@/hooks/useMantleAgentLoop'
import {
  generateMantleWallet,
  walletFromPrivateKey,
  encryptPrivateKey,
  decryptPrivateKey,
} from '@/lib/mantle/client'
import type { MantleNetwork }    from '@/lib/mantle/config'
import {
  EIGHT004SCAN_MANTLE_URL,
} from '@/lib/mantle/config'
import {
  shortAddr,
  fmtUSD,
  fmtPct,
  mantleExplorerTx,
} from '@/lib/mantleAgentLoop'
import { benchmarkSinkUrl }      from '@/lib/mantle/benchmark'

// ─────────────────────────────────────────────────────────────────────────────
// Micro components
// ─────────────────────────────────────────────────────────────────────────────

function Pill({
  label, value, color = 'var(--text)', sub,
}: { label: string; value: string | number; color?: string; sub?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
      <div className="mono text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text3)' }}>{label}</div>
      <div className="mono text-lg font-extrabold truncate" style={{ color }}>{value}</div>
      {sub && <div className="mono text-[10px] mt-0.5" style={{ color: 'var(--text3)' }}>{sub}</div>}
    </div>
  )
}

function StatusDot({ ok, pulse }: { ok: boolean; pulse?: boolean }) {
  return (
    <span className="w-2 h-2 rounded-full shrink-0" style={{
      background: ok ? 'var(--green)' : 'var(--text3)',
      animation:  ok && pulse ? 'blink 2s infinite' : 'none',
    }} />
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
      {children}
    </div>
  )
}

function Card({ children, gap = 3 }: { children: React.ReactNode; gap?: number }) {
  return (
    <div className={`rounded-xl p-4 flex flex-col gap-${gap}`}
      style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup step type
// ─────────────────────────────────────────────────────────────────────────────

type SetupStep = 'choose' | 'generate' | 'import' | 'unlock' | 'ready'

// ─────────────────────────────────────────────────────────────────────────────
// Main tab
// ─────────────────────────────────────────────────────────────────────────────

export default function MantleAgentTab() {
  const {
    agentAddress, privateKey, encryptedKey, isWalletLoaded,
    network, setNetwork,
    mntBalance, mEthBalance, usdyBalance, usdcBalance, usdtBalance,
    agentConfig, setAgentConfig,
    agentId, registrationTxHash,
    benchmarks,
    setWallet, setEncryptedKey, clearWallet,
  } = useMantleAgentStore()

  const {
    loopStatus, lastCycle, nextRunIn, isRunning, cycleError, isActive,
    portfolioUSD, startUSD, drawdownPct, pnlPct, pnlUSD,
    totalTrades, tradesToday, benchmarkCount,
    trades, prices,
    startLoop, stopLoop, runCycle,
    registerAgent,
  } = useMantleAgentLoop()

  // ── Setup wizard state ────────────────────────────────────────────────────
  const [step,        setStep]        = useState<SetupStep>(
    encryptedKey ? 'unlock' : agentAddress ? 'ready' : 'choose'
  )
  const [generated,   setGenerated]   = useState<{ address: string; privateKey: string; mnemonic?: string } | null>(null)
  const [importKey,   setImportKey]   = useState('')   // raw private key or mnemonic
  const [password,    setPassword]    = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [unlockPass,  setUnlockPass]  = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [copied,      setCopied]      = useState('')
  const [showKey,     setShowKey]     = useState(false)
  const [registering, setRegistering] = useState(false)
  const [regResult,   setRegResult]   = useState<{ agentId?: string; scanUrl?: string; error?: string } | null>(null)

  // Symbol selector state (local — committed to store on Apply)
  const [symbolInput, setSymbolInput] = useState(agentConfig.symbols.join(', '))

  // On wallet load, trigger an initial cycle
  useEffect(() => {
    if (isWalletLoaded && privateKey && step === 'ready') {
      runCycle()
    }
  }, [isWalletLoaded, privateKey, network])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ───────────────────────────────────────────────────────────────

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(''), 2000)
  }

  // ── Wallet: generate ──────────────────────────────────────────────────────

  function handleGenerate() {
    const w = generateMantleWallet()
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
      setGenerated(null); setPassword(''); setConfirmPass('')
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  // ── Wallet: import ────────────────────────────────────────────────────────

  async function handleImport() {
    if (!importKey.trim())                 { setError('Enter your private key.'); return }
    if (!password || password.length < 8)  { setError('Password must be at least 8 characters.'); return }
    if (password !== confirmPass)           { setError('Passwords do not match.'); return }
    setLoading(true)
    try {
      const key  = importKey.trim().startsWith('0x') ? importKey.trim() : `0x${importKey.trim()}`
      const w    = walletFromPrivateKey(key)
      const enc  = await encryptPrivateKey(w.privateKey, password)
      setEncryptedKey(enc)
      setWallet(w.address, w.privateKey)
      setStep('ready')
      setImportKey(''); setPassword(''); setConfirmPass('')
    } catch (e: any) { setError('Invalid private key: ' + e.message) }
    setLoading(false)
  }

  // ── Wallet: unlock ────────────────────────────────────────────────────────

  async function handleUnlock() {
    if (!encryptedKey) { setError('No wallet found.'); return }
    if (!unlockPass)   { setError('Enter your password.'); return }
    setLoading(true)
    try {
      const pk = await decryptPrivateKey(encryptedKey, unlockPass)
      const w  = walletFromPrivateKey(pk)
      setWallet(w.address, pk)
      setStep('ready')
      setUnlockPass('')
    } catch { setError('Wrong password.') }
    setLoading(false)
  }

  // ── ERC-8004 registration ─────────────────────────────────────────────────

  async function handleRegister() {
    setRegistering(true)
    setRegResult(null)
    setError('')
    const result = await registerAgent(
      'Binalyst Mantle AI Trading Agent',
      'Autonomous AI trading agent on Mantle Network — built for The Turing Test Hackathon (AI Trading & Strategy track). Every decision is benchmarked on-chain.',
    )
    setRegResult(result)
    if (result.error) setError(result.error)
    setRegistering(false)
  }

  // ── Symbol config apply ───────────────────────────────────────────────────

  function applySymbols() {
    const syms = symbolInput
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(s => s.length > 0)
    if (syms.length === 0) return
    setAgentConfig({ symbols: syms })
  }

  // ── Derived display ───────────────────────────────────────────────────────

  const mntPrice  = prices['MNT']  ?? 0
  const ethPrice  = prices['ETH']  ?? 0
  const btcPrice  = prices['BTC']  ?? 0
  const pnlColor  = pnlPct >= 0 ? 'var(--green)' : 'var(--red)'
  const ddColor   = drawdownPct > 10 ? 'var(--red)' : drawdownPct > 5 ? 'var(--yellow)' : 'var(--green)'

  const statusItems = [
    { label: 'Wallet',       ok: isWalletLoaded },
    { label: 'Loop active',  ok: isActive, pulse: true },
    { label: 'MNT funded',   ok: mntBalance > 0.05 },
    { label: 'ERC-8004',     ok: !!agentId },
  ]

  // ════════════════════════════════════════════════════════════════════════════
  // Render
  // ════════════════════════════════════════════════════════════════════════════

  return (
    <div className="max-w-3xl mx-auto px-6 py-6 flex flex-col gap-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">⬡</span>
          <h2 className="text-lg font-extrabold" style={{ color: 'var(--text)' }}>
            Mantle AI Trading Agent
          </h2>
          <span className="mono text-[10px] px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(97,218,251,0.1)', border: '1px solid rgba(97,218,251,0.3)', color: '#61DAFB' }}>
            Turing Test Hackathon
          </span>
        </div>
        <p className="mono text-xs" style={{ color: 'var(--text3)' }}>
          AI Trading &amp; Strategy track · Bybit market data · On-chain benchmarking · ERC-8004 identity
        </p>
      </div>

      {/* ── Status strip ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        {statusItems.map(s => (
          <div key={s.label} className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <StatusDot ok={s.ok} pulse={s.ok && (s as any).pulse} />
            <span className="mono text-[10px]" style={{ color: s.ok ? 'var(--green)' : 'var(--text3)' }}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-lg p-3 mono text-xs"
          style={{ background: 'rgba(246,70,93,0.08)', border: '1px solid rgba(246,70,93,0.2)', color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          SETUP WIZARD
      ═══════════════════════════════════════════════════════════════ */}

      {/* ── Choose ──────────────────────────────────────────────────────── */}
      {step === 'choose' && (
        <Card>
          <SectionLabel>Set up your Mantle agent wallet</SectionLabel>
          <p className="text-sm" style={{ color: 'var(--text2)' }}>
            This agent needs its own Mantle wallet (completely separate from your BNB, Celo, and Sui
            agent wallets). The private key is encrypted locally — it never touches our servers.
          </p>
          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {[
              { icon: '⚡', title: 'Generate New Wallet', desc: 'Create a fresh Mantle agent wallet in seconds', action: handleGenerate },
              { icon: '🔑', title: 'Import Private Key',  desc: 'Import an existing EVM-compatible private key', action: () => { setStep('import'); setError('') } },
            ].map(opt => (
              <button key={opt.title} onClick={opt.action}
                className="rounded-xl p-5 text-left transition-all"
                style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#61DAFB')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                <div className="text-2xl mb-2">{opt.icon}</div>
                <div className="font-bold mb-1" style={{ color: 'var(--text)' }}>{opt.title}</div>
                <div className="mono text-[10px]" style={{ color: 'var(--text3)' }}>{opt.desc}</div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* ── Generate ────────────────────────────────────────────────────── */}
      {step === 'generate' && generated && (
        <Card gap={4}>
          <SectionLabel>New Mantle wallet generated</SectionLabel>
          <div className="rounded-lg p-3" style={{ background: 'rgba(246,70,93,0.06)', border: '1px solid rgba(246,70,93,0.2)' }}>
            <div className="mono text-xs font-bold mb-1" style={{ color: 'var(--red)' }}>⚠ Back up your private key</div>
            <div className="mono text-[10px]" style={{ color: 'var(--text2)' }}>
              Store this safely — it's the only way to recover this wallet and any funds on Mantle.
            </div>
          </div>

          <div>
            <div className="mono text-[9px] uppercase tracking-widest mb-2" style={{ color: 'var(--text3)' }}>Address</div>
            <div className="flex items-center gap-2">
              <code className="mono text-xs flex-1 break-all" style={{ color: 'var(--text)' }}>{generated.address}</code>
              <button onClick={() => copy(generated.address, 'gen-addr')}
                className="mono text-[10px] px-2 py-1 rounded shrink-0"
                style={{ background: 'var(--bg3)', color: 'var(--text2)' }}>
                {copied === 'gen-addr' ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div>
            <div className="mono text-[9px] uppercase tracking-widest mb-2" style={{ color: 'var(--text3)' }}>Private key</div>
            <div className="flex items-center gap-2">
              <code className="mono text-xs flex-1 break-all p-3 rounded-lg"
                style={{ background: 'var(--bg3)', color: 'var(--text)' }}>
                {showKey ? generated.privateKey : '•'.repeat(64)}
              </code>
              <button onClick={() => setShowKey(s => !s)}
                className="mono text-[10px] px-2 py-1 rounded shrink-0"
                style={{ background: 'var(--bg3)', color: 'var(--text2)' }}>
                {showKey ? 'Hide' : 'Show'}
              </button>
              <button onClick={() => copy(generated.privateKey, 'gen-key')}
                className="mono text-[10px] px-2 py-1 rounded shrink-0"
                style={{ background: 'var(--bg3)', color: 'var(--text2)' }}>
                {copied === 'gen-key' ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="mono text-[10px] p-3 rounded-lg" style={{ background: 'rgba(97,218,251,0.05)', border: '1px solid rgba(97,218,251,0.15)', color: 'var(--text2)' }}>
            Fund this address with MNT for gas:&nbsp;
            <a href="https://faucet.sepolia.mantle.xyz" target="_blank" rel="noopener noreferrer"
              className="underline" style={{ color: '#61DAFB' }}>
              Mantle Sepolia Faucet ↗
            </a>
            &nbsp;(testnet) or bridge via&nbsp;
            <a href="https://bridge.mantle.xyz" target="_blank" rel="noopener noreferrer"
              className="underline" style={{ color: '#61DAFB' }}>
              bridge.mantle.xyz ↗
            </a>
            &nbsp;(mainnet).
          </div>

          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <input type="password" placeholder="Password (min 8 chars)" value={password} onChange={e => setPassword(e.target.value)}
              className="mono text-xs px-3 py-2 rounded-lg"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            <input type="password" placeholder="Confirm password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
              className="mono text-xs px-3 py-2 rounded-lg"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          </div>
          <button onClick={handleSaveGenerated} disabled={loading}
            className="mono text-xs font-bold px-4 py-2.5 rounded-lg"
            style={{ background: '#61DAFB', color: '#000' }}>
            {loading ? 'Saving…' : 'Save & Continue'}
          </button>
        </Card>
      )}

      {/* ── Import ──────────────────────────────────────────────────────── */}
      {step === 'import' && (
        <Card gap={4}>
          <SectionLabel>Import wallet</SectionLabel>
          <input type="password" placeholder="Private key (0x... or hex without 0x)"
            value={importKey} onChange={e => setImportKey(e.target.value)}
            className="mono text-xs px-3 py-2 rounded-lg"
            style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <input type="password" placeholder="Password (min 8 chars)" value={password} onChange={e => setPassword(e.target.value)}
              className="mono text-xs px-3 py-2 rounded-lg"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            <input type="password" placeholder="Confirm password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
              className="mono text-xs px-3 py-2 rounded-lg"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setStep('choose'); setError('') }}
              className="mono text-xs px-4 py-2.5 rounded-lg"
              style={{ background: 'var(--bg3)', color: 'var(--text2)' }}>
              Back
            </button>
            <button onClick={handleImport} disabled={loading}
              className="mono text-xs font-bold px-4 py-2.5 rounded-lg flex-1"
              style={{ background: '#61DAFB', color: '#000' }}>
              {loading ? 'Importing…' : 'Import & Continue'}
            </button>
          </div>
        </Card>
      )}

      {/* ── Unlock ──────────────────────────────────────────────────────── */}
      {step === 'unlock' && (
        <Card gap={4}>
          <SectionLabel>Unlock Mantle wallet</SectionLabel>
          <input type="password" placeholder="Password" value={unlockPass} onChange={e => setUnlockPass(e.target.value)}
            className="mono text-xs px-3 py-2 rounded-lg"
            style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          <div className="flex gap-3">
            <button onClick={() => { clearWallet(); setEncryptedKey(''); setStep('choose') }}
              className="mono text-xs px-4 py-2.5 rounded-lg"
              style={{ background: 'var(--bg3)', color: 'var(--text2)' }}>
              Start over
            </button>
            <button onClick={handleUnlock} disabled={loading}
              className="mono text-xs font-bold px-4 py-2.5 rounded-lg flex-1"
              style={{ background: '#61DAFB', color: '#000' }}>
              {loading ? 'Unlocking…' : 'Unlock'}
            </button>
          </div>
        </Card>
      )}

      {/* ════════════════════════════════════════════════════════════════
          MAIN DASHBOARD (step === 'ready')
      ═══════════════════════════════════════════════════════════════ */}

      {step === 'ready' && (
        <>
          {/* ── Network selector ──────────────────────────────────────── */}
          <div className="flex items-center gap-3">
            <span className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>Network</span>
            {(['testnet', 'mainnet'] as MantleNetwork[]).map(n => (
              <button key={n} onClick={() => setNetwork(n)}
                className="mono text-[10px] px-3 py-1.5 rounded-full transition-all"
                style={{
                  background: network === n ? '#61DAFB' : 'var(--bg2)',
                  color:      network === n ? '#000'    : 'var(--text2)',
                  border:     '1px solid var(--border)',
                }}>
                {MANTLE_NETWORK_LABELS[n]}
              </button>
            ))}
          </div>

          {/* ── Agent address ─────────────────────────────────────────── */}
          <Card>
            <div className="flex items-center justify-between gap-2">
              <div>
                <SectionLabel>Agent address</SectionLabel>
                <code className="mono text-xs break-all" style={{ color: 'var(--text)' }}>
                  {agentAddress}
                </code>
              </div>
              <button onClick={() => copy(agentAddress, 'addr')}
                className="mono text-[10px] px-2 py-1 rounded shrink-0"
                style={{ background: 'var(--bg3)', color: 'var(--text2)' }}>
                {copied === 'addr' ? 'Copied' : 'Copy'}
              </button>
            </div>
          </Card>

          {/* ── Portfolio ─────────────────────────────────────────────── */}
          <div>
            <div className="mono text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--text3)' }}>
              Portfolio
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <Pill label="MNT" value={mntBalance.toFixed(4)}
                sub={mntPrice ? `≈ ${fmtUSD(mntBalance * mntPrice)}` : undefined} />
              <Pill label="mETH" value={mEthBalance.toFixed(6)} color="var(--green)"
                sub={ethPrice ? `≈ ${fmtUSD(mEthBalance * ethPrice)}` : undefined} />
              <Pill label="USDY" value={usdyBalance.toFixed(2)} color="var(--yellow)" sub="Ondo RWA" />
            </div>
            <div className="grid gap-3 mt-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <Pill label="USDC"           value={usdcBalance.toFixed(2)} color="var(--text)" />
              <Pill label="Total (USD)"    value={fmtUSD(portfolioUSD)} color="#61DAFB" />
              <Pill label={`PnL vs start`} value={fmtPct(pnlPct)}
                color={pnlColor}
                sub={fmtUSD(pnlUSD)} />
            </div>
          </div>

          {/* ── Bybit live prices ─────────────────────────────────────── */}
          <Card>
            <SectionLabel>Bybit live prices</SectionLabel>
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {[
                { sym: 'MNT',  label: 'MNT/USDT',  price: mntPrice },
                { sym: 'ETH',  label: 'ETH/USDT',  price: ethPrice },
                { sym: 'BTC',  label: 'BTC/USDT',  price: btcPrice },
              ].map(({ sym, label, price }) => (
                <div key={sym} className="rounded-lg p-3"
                  style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                  <div className="mono text-[9px] uppercase tracking-widest mb-1" style={{ color: 'var(--text3)' }}>
                    {label}
                  </div>
                  <div className="mono text-sm font-bold" style={{ color: 'var(--text)' }}>
                    {price ? fmtUSD(price) : '—'}
                  </div>
                </div>
              ))}
            </div>
            {lastCycle && (
              <div className="mono text-[10px]" style={{ color: 'var(--text3)' }}>
                Updated {new Date(lastCycle.cycleAt).toLocaleTimeString()}
              </div>
            )}
          </Card>

          {/* ── Agent config ──────────────────────────────────────────── */}
          <Card>
            <SectionLabel>Agent config</SectionLabel>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 mono text-xs" style={{ color: 'var(--text2)' }}>
                <input type="checkbox" checked={agentConfig.dryRun}
                  onChange={e => setAgentConfig({ dryRun: e.target.checked })} />
                Dry run (simulate — no real transactions)
              </label>
              <label className="flex items-center gap-2 mono text-xs" style={{ color: 'var(--text2)' }}>
                <input type="checkbox" checked={agentConfig.autonomousMode}
                  onChange={e => setAgentConfig({ autonomousMode: e.target.checked })}
                  disabled={agentConfig.dryRun} />
                Autonomous mode (send real on-chain trades)
              </label>
              <label className="flex items-center gap-2 mono text-xs" style={{ color: 'var(--text2)' }}>
                <input type="checkbox" checked={agentConfig.enableBenchmark}
                  onChange={e => setAgentConfig({ enableBenchmark: e.target.checked })} />
                On-chain benchmarking
              </label>
            </div>
            {!agentConfig.dryRun && !agentConfig.autonomousMode && (
              <div className="mono text-[10px]" style={{ color: 'var(--yellow)' }}>
                Dry run is off but autonomous mode is off — decisions evaluated but not executed. Enable autonomous mode to trade.
              </div>
            )}
            <div>
              <div className="mono text-[9px] uppercase tracking-widest mb-1" style={{ color: 'var(--text3)' }}>
                Symbols to watch (comma-separated Bybit pairs)
              </div>
              <div className="flex gap-2">
                <input value={symbolInput} onChange={e => setSymbolInput(e.target.value)}
                  className="mono text-xs px-3 py-2 rounded-lg flex-1"
                  style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  placeholder="MNTUSDT, ETHUSDT, BTCUSDT" />
                <button onClick={applySymbols}
                  className="mono text-xs px-3 py-2 rounded-lg shrink-0"
                  style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
                  Apply
                </button>
              </div>
            </div>
          </Card>

          {/* ── Loop controls ─────────────────────────────────────────── */}
          <Card>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <SectionLabel>Loop status</SectionLabel>
                <div className="mono text-sm font-bold mt-1"
                  style={{ color: loopStatus === 'running' ? 'var(--green)' : loopStatus === 'error' ? 'var(--red)' : 'var(--text2)' }}>
                  {loopStatus.toUpperCase()}
                  {isActive && nextRunIn > 0 && (
                    <span className="font-normal text-xs ml-2" style={{ color: 'var(--text3)' }}>
                      · next in {nextRunIn}s
                    </span>
                  )}
                </div>
                {cycleError && (
                  <div className="mono text-[10px] mt-1" style={{ color: 'var(--red)' }}>{cycleError}</div>
                )}
                {drawdownPct > 0 && (
                  <div className="mono text-[10px] mt-1" style={{ color: ddColor }}>
                    Drawdown: {drawdownPct.toFixed(1)}%
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                {!isActive ? (
                  <button onClick={startLoop}
                    className="mono text-xs font-bold px-4 py-2 rounded-lg"
                    style={{ background: 'var(--green)', color: '#000' }}>
                    Start Agent
                  </button>
                ) : (
                  <button onClick={stopLoop}
                    className="mono text-xs font-bold px-4 py-2 rounded-lg"
                    style={{ background: 'var(--red)', color: '#fff' }}>
                    Stop Agent
                  </button>
                )}
                <button onClick={runCycle} disabled={isRunning}
                  className="mono text-xs px-4 py-2 rounded-lg"
                  style={{ background: 'var(--bg3)', color: 'var(--text2)' }}>
                  {isRunning ? 'Running…' : 'Run Once'}
                </button>
              </div>
            </div>

            {/* Cycle stats */}
            {lastCycle && (
              <div className="grid gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)', gridTemplateColumns: 'repeat(4, 1fr)' }}>
                {[
                  { label: 'Decisions', value: lastCycle.decisions },
                  { label: 'Executed',  value: lastCycle.executed  },
                  { label: 'Blocked',   value: lastCycle.blocked   },
                  { label: 'Benchmarks', value: lastCycle.benchmarkCount },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <div className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>{s.label}</div>
                    <div className="mono text-base font-bold" style={{ color: 'var(--text)' }}>{s.value}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* ── Session stats ─────────────────────────────────────────── */}
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <Pill label="Trades today"  value={tradesToday} />
            <Pill label="Total trades"  value={totalTrades} />
            <Pill label="On-chain logs" value={benchmarkCount} sub="decisions benchmarked" />
          </div>

          {/* ── ERC-8004 Identity ─────────────────────────────────────── */}
          <Card>
            <SectionLabel>Agent Identity · ERC-8004 · Turing Test Feature #2</SectionLabel>
            {agentId ? (
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="mono text-sm font-bold" style={{ color: 'var(--green)' }}>
                    Registered — Agent #{agentId}
                  </div>
                  {registrationTxHash && (
                    <div className="mono text-[10px] mt-0.5" style={{ color: 'var(--text3)' }}>
                      tx: {shortAddr(registrationTxHash)}
                    </div>
                  )}
                </div>
                <a href={EIGHT004SCAN_MANTLE_URL(agentId)} target="_blank" rel="noopener noreferrer"
                  className="mono text-[10px] font-bold px-3 py-1.5 rounded-lg"
                  style={{ background: '#61DAFB', color: '#000' }}>
                  View on 8004scan ↗
                </a>
              </div>
            ) : (
              <>
                <p className="mono text-[10px]" style={{ color: 'var(--text2)' }}>
                  Register this agent's wallet as an ERC-8004 identity (an on-chain NFT) on Mantle Mainnet
                  so it's discoverable on 8004scan and verifiably linked to this agent's on-chain record.
                  One-time registration — requires Mantle Mainnet + small MNT gas.
                </p>
                {network !== 'mainnet' ? (
                  <div className="mono text-[10px]" style={{ color: 'var(--yellow)' }}>
                    Switch to Mantle Mainnet above to register.
                  </div>
                ) : (
                  <button onClick={handleRegister} disabled={registering}
                    className="mono text-xs font-bold px-4 py-2 rounded-lg self-start"
                    style={{ background: '#61DAFB', color: '#000' }}>
                    {registering ? 'Registering…' : 'Register Agent (ERC-8004)'}
                  </button>
                )}
                {regResult?.error && (
                  <div className="mono text-[10px]" style={{ color: 'var(--red)' }}>{regResult.error}</div>
                )}
              </>
            )}
          </Card>

          {/* ── On-chain Benchmark ────────────────────────────────────── */}
          <Card>
            <SectionLabel>On-chain Benchmarking · Turing Test Feature #1</SectionLabel>
            <p className="mono text-[10px]" style={{ color: 'var(--text2)' }}>
              Every agent decision is written to Mantle as a permanent, verifiable zero-value
              data transaction — the first on-chain AI performance benchmark in Web3.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="mono text-sm font-bold" style={{ color: '#61DAFB' }}>
                {benchmarkCount} decision{benchmarkCount !== 1 ? 's' : ''} benchmarked
              </div>
              <a href={benchmarkSinkUrl(network)} target="_blank" rel="noopener noreferrer"
                className="mono text-[10px] px-3 py-1.5 rounded-lg"
                style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
                View on Explorer ↗
              </a>
            </div>

            {/* Last 3 benchmark records */}
            {benchmarks.length > 0 && (
              <div className="flex flex-col gap-1 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                <div className="mono text-[9px] uppercase tracking-widest mb-1" style={{ color: 'var(--text3)' }}>
                  Recent decisions
                </div>
                {benchmarks.slice(0, 3).map((b, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 mono text-[10px] py-1"
                    style={{ borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ color: 'var(--text3)' }}>{new Date(b.ts).toLocaleTimeString()}</span>
                    <span style={{ color: 'var(--text)' }}>{b.symbol}</span>
                    <span style={{ color: b.decision === 'BUY' ? 'var(--green)' : b.decision === 'SELL' ? 'var(--red)' : 'var(--text3)' }}>
                      {b.decision}
                    </span>
                    <span style={{ color: 'var(--text3)' }}>score {b.score}</span>
                    <span style={{ color: b.executed ? 'var(--green)' : 'var(--text3)' }}>
                      {b.executed ? '✓ executed' : 'evaluated'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* ── Trade log ─────────────────────────────────────────────── */}
          <Card>
            <SectionLabel>Trade log</SectionLabel>
            {trades.length === 0 ? (
              <div className="mono text-xs" style={{ color: 'var(--text3)' }}>
                No trades yet. Start the agent or click Run Once.
              </div>
            ) : (
              <div className="flex flex-col gap-0">
                {trades.slice(0, 20).map((t, i) => (
                  <div key={t.id}
                    className="flex items-center justify-between gap-2 mono text-[10px] py-2"
                    style={{ borderBottom: i < Math.min(trades.length, 20) - 1 ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ color: 'var(--text3)' }}>{new Date(t.timestamp).toLocaleTimeString()}</span>
                    <span style={{ color: 'var(--text)' }}>{t.symbol}</span>
                    <span style={{ color: t.side === 'BUY' ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                      {t.side}
                    </span>
                    <span style={{ color: 'var(--text3)' }}>score {t.signalScore}</span>
                    <span style={{ color: 'var(--text2)' }}>{fmtUSD(t.amountUSD)}</span>
                    <span style={{
                      color: t.status === 'confirmed'  ? 'var(--green)'
                           : t.status === 'simulated'  ? 'var(--yellow)'
                           : t.status === 'blocked'    ? 'var(--text3)'
                           : 'var(--red)',
                    }}>
                      {t.status}
                      {t.txHash && (
                        <a href={mantleExplorerTx(t.txHash, network)} target="_blank" rel="noopener noreferrer"
                          className="ml-1 underline">
                          {shortAddr(t.txHash)}
                        </a>
                      )}
                    </span>
                    {t.dryRun && (
                      <span style={{ color: 'var(--text3)' }}>sim</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* ── Disconnect ────────────────────────────────────────────── */}
          <div className="flex justify-end">
            <button onClick={() => { stopLoop(); clearWallet(); setStep('choose') }}
              className="mono text-[10px] px-3 py-1.5 rounded-lg"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text3)' }}>
              Disconnect wallet
            </button>
          </div>
        </>
      )}
    </div>
  )
}
