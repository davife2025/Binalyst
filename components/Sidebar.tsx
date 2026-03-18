'use client'

import { useStore } from '@/lib/store'

type Tab = 'home' | 'chat' | 'markets' | 'events' | 'learn' | 'portfolio' | 'trading' | 'alerts' | 'agent' | 'web3' | 'square' | 'messaging' | 'settings'

const NAV_MAIN: { id: Tab; label: string; icon: string; dot?: boolean; badge?: string }[] = [
  { id: 'home',      label: 'Dashboard',  icon: '⊞' },
  { id: 'chat',      label: 'AI Assistant', icon: '◈' },
  { id: 'markets',   label: 'Markets',    icon: '◐' },
  { id: 'portfolio', label: 'Portfolio',  icon: '◑' },
  { id: 'trading',   label: 'Trade',      icon: '⚡' },
  { id: 'web3',      label: 'Web3',       icon: '⬡' },
  { id: 'events',    label: 'Events',     icon: '◎', dot: true },
  { id: 'square',    label: 'Square',     icon: '✦' },
  { id: 'messaging', label: 'Messaging',  icon: '📱', badge: 'NEW' },
  { id: 'alerts',    label: 'Alerts',     icon: '🔔' },
  { id: 'agent',     label: 'Agent',      icon: '🤖', dot: true },
  { id: 'learn',     label: 'Learn',      icon: '◉' },
]

export default function Sidebar() {
  const { activeTab, setActiveTab, isConnected, autoTradeEnabled } = useStore()

  return (
    <>
      <style>{`
        .bn-sidebar {
          width: 52px;
          transition: width 0.22s cubic-bezier(0.4,0,0.2,1);
          overflow: hidden;
          white-space: nowrap;
        }
        .bn-sidebar:hover {
          width: 188px;
        }
        .bn-label {
          opacity: 0;
          transition: opacity 0.12s 0.06s;
          font-size: 12px;
          font-weight: 600;
          color: var(--text2);
          flex: 1;
        }
        .bn-sidebar:hover .bn-label { opacity: 1; }
        .bn-logo-text {
          opacity: 0;
          transition: opacity 0.12s 0.08s;
        }
        .bn-sidebar:hover .bn-logo-text { opacity: 1; }
        .bn-badge {
          opacity: 0;
          transition: opacity 0.12s 0.06s;
        }
        .bn-sidebar:hover .bn-badge { opacity: 1; }
        .bn-status {
          opacity: 0;
          transition: opacity 0.12s 0.06s;
          font-size: 10px;
          white-space: nowrap;
        }
        .bn-sidebar:hover .bn-status { opacity: 1; }
        .bn-item {
          position: relative;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 14px;
          cursor: pointer;
          width: 100%;
          border: none;
          background: transparent;
          text-align: left;
          transition: background 0.12s;
        }
        .bn-item:hover { background: var(--bg3); }
        .bn-item.active { background: var(--yellow-glow); }
        .bn-item.active::before {
          content: '';
          position: absolute;
          left: 0; top: 5px; bottom: 5px;
          width: 2px;
          background: var(--yellow);
          border-radius: 0 2px 2px 0;
        }
        .bn-item.active .bn-label { color: var(--yellow); }
        .bn-item .bn-icon { opacity: 0.65; }
        .bn-item.active .bn-icon { opacity: 1; }
        @keyframes sbBlink { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>

      <aside
        className="bn-sidebar flex flex-col shrink-0 border-r"
        style={{ background: 'var(--bg2)', borderColor: 'var(--border)', height: '100vh' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-[13px] py-4 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="w-[26px] h-[26px] rounded-md flex items-center justify-center font-black text-xs shrink-0"
            style={{ background: 'var(--yellow)', color: '#000', fontSize: 12 }}>B</div>
          <div className="bn-logo-text">
            <div className="font-extrabold text-sm leading-tight" style={{ color: 'var(--text)' }}>Binalyst</div>
            <div className="mono text-[8px] tracking-widest uppercase" style={{ color: 'var(--text3)' }}>AI Platform</div>
          </div>
        </div>

        {/* Main nav */}
        <nav className="flex-1 py-2 flex flex-col overflow-y-auto" style={{ gap: 1 }}>
          {NAV_MAIN.map(item => {
            const active = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`bn-item ${active ? 'active' : ''}`}
              >
                <span className="bn-icon text-center shrink-0" style={{ fontSize: 15, width: 24 }}>{item.icon}</span>
                <span className="bn-label">{item.label}</span>
                {item.badge && (
                  <span className="bn-badge mono text-[7px] font-bold px-1 py-0.5 rounded shrink-0"
                    style={{ background: 'var(--yellow)', color: '#000' }}>{item.badge}</span>
                )}
                {item.dot && !item.badge && (
                  <span className="bn-badge w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: 'var(--green)', animation: 'sbBlink 2s infinite' }} />
                )}
              </button>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="border-t shrink-0" style={{ borderColor: 'var(--border)', padding: '8px 0' }}>
          {/* Auto-trade warning */}
          {autoTradeEnabled && (
            <div className="flex items-center gap-2 mx-2 mb-1 px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(246,70,93,0.08)', border: '1px solid rgba(246,70,93,0.2)' }}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: 'var(--red)', animation: 'sbBlink 1.5s infinite' }} />
              <span className="bn-status mono font-bold" style={{ color: 'var(--red)' }}>AUTO-TRADE ON</span>
            </div>
          )}

          {/* Connection status */}
          <div className="flex items-center gap-3 px-[14px] py-2">
            <span className="w-2 h-2 rounded-full shrink-0"
              style={{ background: isConnected ? 'var(--green)' : 'var(--text3)', animation: isConnected ? 'sbBlink 2s infinite' : 'none' }} />
            <span className="bn-status mono" style={{ color: 'var(--text3)' }}>
              {isConnected ? 'Binance connected' : 'No API key'}
            </span>
          </div>

          {/* Settings */}
          <button
            onClick={() => setActiveTab('settings')}
            className={`bn-item ${activeTab === 'settings' ? 'active' : ''}`}
          >
            <span className="bn-icon text-center shrink-0" style={{ fontSize: 15, width: 24 }}>⚙</span>
            <span className="bn-label">Settings</span>
          </button>
        </div>
      </aside>
    </>
  )
}