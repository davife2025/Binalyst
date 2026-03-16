'use client'

import { useStore } from '@/lib/store'

const NAV = [
  { id: 'chat',      label: 'Assistant',  icon: '◈' },
  { id: 'markets',   label: 'Markets',    icon: '◐' },
  { id: 'events',    label: 'Events',     icon: '◎', dot: true },
  { id: 'learn',     label: 'Learn',      icon: '◉' },
  { id: 'portfolio', label: 'Portfolio',  icon: '◑' },
  { id: 'trade',     label: 'Trade',      icon: '⚡' },
] as const

export default function Sidebar() {
  const { activeTab, setActiveTab, isConnected } = useStore()

  return (
    <aside className="flex flex-col w-56 shrink-0 border-r"
      style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>

      <div className="flex items-center gap-3 px-5 h-16 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-black font-bold text-sm shrink-0"
          style={{ background: 'var(--yellow)' }}>B</div>
        <div>
          <div className="font-extrabold text-sm leading-tight" style={{ color: 'var(--text)' }}>Binalyst</div>
          <div className="mono text-[9px] tracking-widest uppercase" style={{ color: 'var(--text3)' }}>AI Platform</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {NAV.map(item => {
          const active = activeTab === item.id
          return (
            <button key={item.id} onClick={() => setActiveTab(item.id as any)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all"
              style={{
                background: active ? 'var(--yellow-glow)' : 'transparent',
                color: active ? 'var(--yellow)' : 'var(--text2)',
                border: active ? '1px solid rgba(240,185,11,0.25)' : '1px solid transparent',
              }}>
              <span className="text-base w-4 text-center leading-none">{item.icon}</span>
              <span className="text-sm font-semibold">{item.label}</span>
              {'dot' in item && item.dot && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full"
                  style={{ background: 'var(--green)', animation: 'blink 2s infinite' }} />
              )}
            </button>
          )
        })}
      </nav>

      <div className="px-3 pb-4 pt-2 border-t flex flex-col gap-2" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--bg3)' }}>
          <span className="w-2 h-2 rounded-full shrink-0"
            style={{ background: isConnected ? 'var(--green)' : 'var(--text3)', animation: isConnected ? 'blink 2s infinite' : 'none' }} />
          <span className="mono text-[10px]" style={{ color: 'var(--text2)' }}>
            {isConnected ? 'Binance connected' : 'No API key'}
          </span>
        </div>
        <button onClick={() => setActiveTab('settings' as any)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
          style={{
            background: activeTab === 'settings' ? 'var(--yellow-glow)' : 'transparent',
            color: activeTab === 'settings' ? 'var(--yellow)' : 'var(--text2)',
            border: activeTab === 'settings' ? '1px solid rgba(240,185,11,0.25)' : '1px solid transparent',
          }}>
          <span className="text-base w-4 text-center">⚙</span>
          <span className="text-sm font-semibold">Settings</span>
        </button>
      </div>
    </aside>
  )
}
