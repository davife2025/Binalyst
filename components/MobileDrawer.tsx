'use client'

/**
 * components/MobileDrawer.tsx — Session I
 * Updated to reflect 4-section platform structure.
 * Preserves existing animation and design.
 */

import { useStore }      from '@/lib/store'
import { useAgentStore } from '@/lib/agentStore'
import { useEffect, useState } from 'react'
import { signOut, useSession } from 'next-auth/react'
import type { ActiveTab } from '@/lib/store'

type DrawerSection = {
  label: string
  color: string
  items: { id: ActiveTab; label: string; icon: string; desc: string }[]
}

const SECTIONS: DrawerSection[] = [
  {
    label: 'Intelligence',
    color: '#3498db',
    items: [
      { id: 'signals',     label: 'CMC Signals',   icon: '📡', desc: 'Fear & Greed · signal scoring' },
      { id: 'web3',        label: 'Web3 Intel',     icon: '⬡',  desc: 'On-chain analytics' },
      { id: 'events',      label: 'Events Radar',  icon: '◎',  desc: 'Listings, airdrops, launchpool' },
    ],
  },
  {
    label: 'Trading Agent',
    color: '#F0B90B',
    items: [
      { id: 'agent-wallet', label: 'Agent Wallet',  icon: '🔐', desc: 'Self-custodial BSC wallet' },
      { id: 'strategy',     label: 'Strategy',      icon: '🧠', desc: 'AI-parsed trading rules' },
      { id: 'competition',  label: 'Competition',   icon: '🏆', desc: 'Live PnL · trade log' },
      { id: 'performance',  label: 'Performance',   icon: '📊', desc: 'Portfolio · hourly PnL' },
      { id: 'submission',   label: 'Submission',    icon: '📝', desc: 'Dorahacks writeup' },
      { id: 'agent',        label: 'Rules Engine',  icon: '🤖', desc: 'Simple rules agent' },
    ],
  },
  {
    label: 'Celo Agent',
    color: '#FCFF52',
    items: [
      { id: 'celo-agent', label: 'Celo Agent', icon: '🟡', desc: 'Onchain payments agent' },
    ],
  },
  {
    label: 'Binance',
    color: '#0ECB81',
    items: [
      { id: 'markets',   label: 'Live Markets',  icon: '◐',  desc: 'Prices, charts, order book' },
      { id: 'portfolio', label: 'Portfolio',     icon: '◑',  desc: 'Holdings, P&L, AI advisor' },
      { id: 'trading',   label: 'Trade',         icon: '⚡',  desc: 'Place & manage orders' },
      { id: 'alerts',    label: 'Price Alerts',  icon: '🔔', desc: 'Push notifications' },
    ],
  },
  {
    label: 'Tools',
    color: '#474D57',
    items: [
      { id: 'chat',      label: 'AI Assistant', icon: '◈',  desc: 'Claude + live Binance data' },
      { id: 'learn',     label: 'Learn',        icon: '◉',  desc: 'Crypto academy & quizzes' },
      { id: 'square',    label: 'Square',       icon: '✦',  desc: 'Post to Binance Square' },
      { id: 'messaging', label: 'Messaging',    icon: '📱', desc: 'Telegram & WhatsApp bot' },
    ],
  },
  // ── Mantle AI Trading Agent (Session N — The Turing Test Hackathon) ───────
  {
    label: 'Mantle Agent',
    color: '#61DAFB',
    items: [
      { id: 'mantle-agent', label: 'Mantle Agent', icon: '⬡', desc: 'AI trading · on-chain benchmarking · ERC-8004' },
    ],
  },
]

interface MobileDrawerProps {
  open:    boolean
  onClose: () => void
}

export default function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const { activeTab, setActiveTab, isConnected } = useStore()
  const { session, isWalletLoaded, clearWallet }  = useAgentStore()
  const network     = (useAgentStore() as any).network ?? 'testnet'
  const { data: sessionData } = useSession()
  const [signingOut, setSigningOut] = useState(false)
  const isLive = session?.status === 'running'

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else      document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  function navigate(tab: ActiveTab) {
    setActiveTab(tab)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
      {/* Backdrop */}
      <div onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />

      {/* Sheet */}
      <div className="animate-fade-up"
        style={{
          position:   'absolute', bottom: 0, left: 0, right: 0,
          background: 'var(--bg2)',
          borderTop:  '1px solid var(--border)',
          borderRadius: '16px 16px 0 0',
          padding:    '1rem',
          paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
          maxHeight:  '85vh',
          overflowY:  'auto',
        }}>

        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)', margin: '0 auto 1rem' }} />

        {/* Platform identity */}
        <div className="flex items-center gap-3 mb-4 px-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold"
            style={{ background: 'var(--yellow)', color: '#000', fontSize: 14 }}>B</div>
          <div>
            <div className="font-extrabold text-sm" style={{ color: 'var(--text)' }}>Binalyst</div>
            <div className="mono text-[9px] tracking-widest uppercase" style={{ color: 'var(--text3)' }}>
              BNB Chain AI Trading Platform
            </div>
          </div>
          {isLive && (
            <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(14,203,129,0.1)', border: '1px solid rgba(14,203,129,0.3)' }}>
              <span className="w-1.5 h-1.5 rounded-full"
                style={{ background: 'var(--green)', animation: 'blink 1s infinite' }} />
              <span className="mono text-[9px] font-bold" style={{ color: 'var(--green)' }}>LIVE</span>
            </div>
          )}
        </div>

        {/* Status strip */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg mb-4"
          style={{ background: 'var(--bg3)' }}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full"
              style={{ background: isConnected ? 'var(--green)' : 'var(--text3)' }} />
            <span className="mono text-xs" style={{ color: 'var(--text2)' }}>
              {isConnected ? 'Binance connected' : 'No API key'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full"
              style={{ background: network === 'mainnet' ? 'var(--red)' : 'var(--green)' }} />
            <span className="mono text-[10px]"
              style={{ color: network === 'mainnet' ? 'var(--red)' : 'var(--green)' }}>
              {network === 'mainnet' ? 'Mainnet' : 'Testnet'}
            </span>
          </div>
          {sessionData?.user?.email && (
            <span className="mono text-[10px] truncate max-w-[100px]" style={{ color: 'var(--text3)' }}>
              {sessionData.user.email}
            </span>
          )}
        </div>

        {/* Sections */}
        {SECTIONS.map(section => (
          <div key={section.label} className="mb-4">
            <div className="mono text-[9px] font-bold tracking-widest uppercase mb-2 px-1"
              style={{ color: section.color }}>
              {section.label}
            </div>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {section.items.map(item => {
                const active = activeTab === item.id
                return (
                  <button key={item.id} onClick={() => navigate(item.id)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all"
                    style={{
                      background: active ? 'var(--yellow-glow)' : 'var(--bg3)',
                      border:     active ? '1px solid rgba(240,185,11,0.25)' : '1px solid transparent',
                      color:      active ? 'var(--yellow)' : 'var(--text2)',
                    }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">{item.label}</div>
                      <div className="mono text-[9px] truncate"
                        style={{ color: active ? 'rgba(240,185,11,0.6)' : 'var(--text3)' }}>
                        {item.desc}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        {/* Settings + Sign out */}
        <div className="flex gap-2 mt-2">
          <button onClick={() => navigate('settings')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold"
            style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
            ⚙ Settings
          </button>
          <button
            onClick={async () => {
              setSigningOut(true)
              clearWallet()
              await signOut({ callbackUrl: '/login' })
            }}
            disabled={signingOut}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all"
            style={{
              background: 'rgba(246,70,93,0.08)',
              border:     '1px solid rgba(246,70,93,0.2)',
              color:      'var(--red)',
              opacity:    signingOut ? 0.6 : 1,
            }}>
            {signingOut
              ? <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin-slow" />
              : null}
            {signingOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      </div>
    </div>
  )
}
