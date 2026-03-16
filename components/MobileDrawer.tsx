'use client'

import { useStore } from '@/lib/store'
import { useEffect, useState } from 'react'
import { signOut, useSession } from 'next-auth/react'

type Tab = 'chat' | 'markets' | 'events' | 'learn' | 'portfolio' | 'trading' | 'alerts' | 'agent' | 'web3' | 'square' | 'settings'

const ALL_TABS: { id: Tab; label: string; icon: string; desc: string }[] = [
  { id: 'chat',      label: 'Assistant',  icon: '◈', desc: 'AI chat with live Binance data' },
  { id: 'markets',   label: 'Markets',    icon: '◐', desc: 'Live prices, charts, order book' },
  { id: 'events',    label: 'Events',     icon: '◎', desc: 'Listings, airdrops, launchpool' },
  { id: 'web3',      label: 'Web3',       icon: '⬡', desc: 'On-chain analytics' },
  { id: 'square',    label: 'Square',     icon: '✦', desc: 'Post to Binance Square' },
  { id: 'learn',     label: 'Learn',      icon: '◉', desc: 'Crypto academy & quizzes' },
  { id: 'portfolio', label: 'Portfolio',  icon: '◑', desc: 'Holdings, P&L, AI advisor' },
  { id: 'trading',   label: 'Trading',    icon: '⚡', desc: 'Place & manage orders' },
  { id: 'alerts',    label: 'Alerts',     icon: '🔔', desc: 'Price push notifications' },
  { id: 'agent',     label: 'Agent',      icon: '🤖', desc: 'Autonomous rules engine' },
  { id: 'settings',  label: 'Settings',   icon: '⚙',  desc: 'API key, preferences' },
]

interface MobileDrawerProps {
  open: boolean
  onClose: () => void
}

export default function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const { activeTab, setActiveTab, isConnected, clearCredentials } = useStore()
  const { data: session } = useSession()
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  function navigate(tab: Tab) {
    setActiveTab(tab)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }}
      />
      {/* Sheet */}
      <div
        className="animate-fade-up"
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'var(--bg2)',
          borderTop: '1px solid var(--border)',
          borderRadius: '16px 16px 0 0',
          padding: '1rem',
          paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)', margin: '0 auto 1rem' }} />

        {/* Status */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg mb-3"
          style={{ background: 'var(--bg3)' }}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full"
              style={{ background: isConnected ? 'var(--green)' : 'var(--text3)', animation: isConnected ? 'blink 2s infinite' : 'none' }} />
            <span className="mono text-xs" style={{ color: 'var(--text2)' }}>
              {isConnected ? 'Binance connected' : 'No API key'}
            </span>
          </div>
          {session?.user?.email && (
            <span className="mono text-[10px] truncate max-w-[120px]" style={{ color: 'var(--text3)' }}>
              {session.user.email}
            </span>
          )}
        </div>

        {/* Sign out */}
        <button
          onClick={async () => {
            setSigningOut(true)
            clearCredentials()
            await signOut({ callbackUrl: '/login' })
          }}
          disabled={signingOut}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold mb-4 transition-all"
          style={{
            background: 'rgba(246,70,93,0.08)',
            border: '1px solid rgba(246,70,93,0.2)',
            color: 'var(--red)',
            cursor: signingOut ? 'not-allowed' : 'pointer',
            opacity: signingOut ? 0.6 : 1,
          }}
        >
          {signingOut && <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin-slow" />}
          {signingOut ? 'Signing out...' : 'Sign out'}
        </button>

        {/* All tabs */}
        <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {ALL_TABS.map(item => {
            const active = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all"
                style={{
                  background: active ? 'var(--yellow-glow)' : 'var(--bg3)',
                  border: active ? '1px solid rgba(240,185,11,0.25)' : '1px solid transparent',
                  color: active ? 'var(--yellow)' : 'var(--text2)',
                }}
              >
                <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold">{item.label}</div>
                  <div className="mono text-[9px] truncate" style={{ color: active ? 'rgba(240,185,11,0.6)' : 'var(--text3)' }}>
                    {item.desc}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
