'use client'

import { useStore } from '@/lib/store'

type Tab = 'chat' | 'markets' | 'events' | 'learn' | 'portfolio' | 'trading' | 'alerts' | 'agent' | 'web3' | 'square' | 'settings'

const BOTTOM_NAV: { id: Tab; label: string; icon: string }[] = [
  { id: 'chat',      label: 'Chat',      icon: '◈' },
  { id: 'markets',   label: 'Markets',   icon: '◐' },
  { id: 'events',    label: 'Events',    icon: '◎' },
  { id: 'web3',      label: 'Web3',      icon: '⬡' },
  { id: 'portfolio', label: 'Portfolio', icon: '◑' },
]

export default function BottomNav() {
  const { activeTab, setActiveTab } = useStore()
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-2 pb-safe"
      style={{
        background: 'var(--bg2)',
        borderTop: '1px solid var(--border)',
        height: 60,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {BOTTOM_NAV.map(item => {
        const active = activeTab === item.id
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-all"
            style={{ color: active ? 'var(--yellow)' : 'var(--text3)' }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
            <span className="mono" style={{ fontSize: 9, letterSpacing: '0.04em' }}>{item.label}</span>
          </button>
        )
      })}
      {/* More button — opens a sheet with remaining tabs */}
      <button
        onClick={() => setActiveTab('settings')}
        className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-all"
        style={{ color: activeTab === 'settings' ? 'var(--yellow)' : 'var(--text3)' }}
      >
        <span style={{ fontSize: 18, lineHeight: 1 }}>⚙</span>
        <span className="mono" style={{ fontSize: 9, letterSpacing: '0.04em' }}>More</span>
      </button>
    </nav>
  )
}
