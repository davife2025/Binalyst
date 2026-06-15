'use client'

/**
 * components/BottomNav.tsx — Session I
 * Mobile bottom nav — 5 primary tabs covering all 4 pillars + home.
 * Preserves existing design, updates tab selection to reflect platform.
 */

import { useStore }      from '@/lib/store'
import { useAgentStore } from '@/lib/agentStore'
import type { ActiveTab } from '@/lib/store'

type BottomNavItem = { id: ActiveTab; label: string; icon: string }

const BOTTOM_NAV: BottomNavItem[] = [
  { id: 'home',           label: 'Home',     icon: '⊞' },
  { id: 'signals',        label: 'Signals',  icon: '📡' },
  { id: 'backtest',       label: 'Backtest', icon: '📈' },
  { id: 'bitget-connect', label: 'Bitget',   icon: '🔗' },
  { id: 'chat',           label: 'AI',       icon: '◈'  },
]

export default function BottomNav() {
  const { activeTab, setActiveTab } = useStore()
  const { session } = useAgentStore()
  const isLive = session?.status === 'running'

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-2"
      style={{
        background:     'var(--bg2)',
        borderTop:      '1px solid var(--border)',
        height:         60,
        paddingBottom:  'env(safe-area-inset-bottom)',
      }}>
      {BOTTOM_NAV.map(item => {
        const active = activeTab === item.id
        const isAgent = item.id === 'competition'
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-all relative"
            style={{ color: active ? 'var(--yellow)' : 'var(--text3)' }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
            <span className="mono" style={{ fontSize: 9, letterSpacing: '0.04em' }}>{item.label}</span>
            {/* Live dot on agent tab */}
            {isAgent && isLive && (
              <span className="absolute top-1 right-1/4 w-1.5 h-1.5 rounded-full"
                style={{ background: 'var(--green)', animation: 'blink 1.5s infinite' }} />
            )}
          </button>
        )
      })}
    </nav>
  )
}
