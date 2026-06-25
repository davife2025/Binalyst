'use client'

/**
 * components/Sidebar.tsx — UI Refresh (SVG icons, BNB brand aesthetic)
 * ALL logic, store hooks, tab IDs, sections, and nav structure preserved exactly.
 * Only changes: emoji → inline SVG icons, updated visual styling.
 */

import { useStore }         from '@/lib/store'
import { useAgentStore }    from '@/lib/agentStore'
import type { ActiveTab }   from '@/lib/store'

type NavItem = {
  id:      ActiveTab
  label:   string
  icon:    any
  dot?:    boolean
  badge?:  string
  section: 'intelligence' | 'agent' | 'binance' | 'tools' | 'stellar' | 'pokt' | 'croo' | 'bitget'
}

// ── Tiny inline SVG icon helper ───────────────────────────────────────────────
function I({ children, size = 16, stroke = 'currentColor' }: {
  children?: any; size?: number; stroke?: string
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={stroke} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0 }}>
      {children}
    </svg>
  )
}

// ── BNB Chain logo ────────────────────────────────────────────────────────────
function BNBIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M12 1.5L14.5 4 12 6.5 9.5 4Z"/>
      <path d="M16.5 6L19 8.5 16.5 11 14 8.5Z"/>
      <path d="M7.5 6L10 8.5 7.5 11 5 8.5Z"/>
      <path d="M12 9L17 13.5 12 18 7 13.5Z"/>
      <path d="M19.5 11L22 13.5 19.5 16 17 13.5Z"/>
      <path d="M4.5 11L7 13.5 4.5 16 2 13.5Z"/>
      <path d="M12 20.5L14.5 18 17 20.5 12 23 7 20.5 9.5 18Z"/>
    </svg>
  )
}

const NAV: NavItem[] = [
  // ── Intelligence ──────────────────────────────────────────────────────────
  { id: 'signals',   label: 'CMC Signals',  dot: true,  section: 'intelligence',
    icon: <I><circle cx="12" cy="12" r="3"/><path d="M6.3 6.3a8 8 0 0 0 0 11.4"/><path d="M17.7 6.3a8 8 0 0 1 0 11.4"/></I> },
  { id: 'events',    label: 'Events Radar', dot: true,  section: 'intelligence',
    icon: <I><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></I> },
  { id: 'web3',      label: 'Web3 Intel',               section: 'intelligence',
    icon: <I><polygon points="12 2 20.5 7 20.5 17 12 22 3.5 17 3.5 7"/></I> },
  { id: 'world-cup', label: 'World Cup',                section: 'intelligence',
    icon: <I><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10"/><line x1="2" y1="12" x2="22" y2="12"/></I> },

  // ── Trading Agent ─────────────────────────────────────────────────────────
  { id: 'agent-wallet', label: 'Agent Wallet',  section: 'agent',
    icon: <I><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><circle cx="12" cy="14" r="2"/></I> },
  { id: 'strategy',     label: 'Strategy',      section: 'agent',
    icon: <I><path d="M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 4v16"/></I> },
  { id: 'backtest',     label: 'Backtest',      dot: true, section: 'agent',
    icon: <I><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></I> },
  { id: 'competition',  label: 'Competition',   dot: true, section: 'agent',
    icon: <I><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/><path d="M4 22h16"/></I> },
  { id: 'performance',  label: 'Performance',   section: 'agent',
    icon: <I><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></I> },
  // Rules Engine — CPU/logic chip with pins + active dot
{ id: 'agent', label: 'Rules Engine', section: 'bitget',
  icon: <I>
    <rect x="6" y="6" width="10" height="10" rx="1.5"/>
    <line x1="2" y1="8.5" x2="6" y2="8.5"/>
    <line x1="2" y1="11" x2="6" y2="11"/>
    <line x1="2" y1="13.5" x2="6" y2="13.5"/>
    <line x1="16" y1="8.5" x2="20" y2="8.5"/>
    <line x1="16" y1="11" x2="20" y2="11"/>
    <line x1="16" y1="13.5" x2="20" y2="13.5"/>
    <line x1="9" y1="2" x2="9" y2="6"/>
    <line x1="13" y1="2" x2="13" y2="6"/>
    <line x1="9" y1="16" x2="9" y2="20"/>
    <line x1="13" y1="16" x2="13" y2="20"/>
    <circle cx="11" cy="11" r="1.5" fill="currentColor" stroke="none"/>
  </I> },

// Bitget Tools — wrench + lightning bolt
{ id: 'bitget-tools', label: 'Bitget Tools', section: 'bitget',
  icon: <I>
    <path d="M14.7 3.3a4 4 0 0 0-4.9 4.9L3.3 14.7a1.8 1.8 0 0 0 2.5 2.5l6.5-6.5a4 4 0 0 0 4.9-4.9l-2.2 2.2-1.8-1.8 2.2-2.2"/>
    <path d="M17 10l-2 3h3l-2 3" strokeWidth="1.2"/>
  </I> },

// Bitget Connect — two nodes linked by a signal cable
{ id: 'bitget-connect', label: 'Bitget Connect', section: 'bitget',
  icon: <I>
    <circle cx="5" cy="11" r="2.5"/>
    <circle cx="17" cy="11" r="2.5"/>
    <path d="M7.5 11 C10 7,12 7,14.5 11"/>
    <path d="M7.5 11 C10 15,12 15,14.5 11"/>
    <circle cx="11" cy="8.2" r="1" fill="currentColor" stroke="none"/>
    <circle cx="11" cy="13.8" r="1" fill="currentColor" stroke="none"/>
  </I> },

      // ── Stellar ZK (Session R — Stellar Hacks) ───────────────────────────────
  { id: 'zk-proofs',    label: 'ZK Proofs',  section: 'stellar' ,
      icon: <I><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></I> },

  // ── Binance ───────────────────────────────────────────────────────────────
  { id: 'markets',   label: 'Live Markets',  section: 'binance',
    icon: <I><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></I> },
  { id: 'portfolio', label: 'Portfolio',     section: 'binance',
    icon: <I><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10"/><line x1="2" y1="12" x2="22" y2="12"/></I> },
  { id: 'trading',   label: 'Trade',         section: 'binance',
    icon: <I><path d="m7 16 4-4-4-4"/><path d="m11 20 4-4-4-4"/></I> },
  { id: 'alerts',    label: 'Price Alerts',  section: 'binance',
    icon: <I><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></I> },


     // ── Pocket Network (POKT) ─────────────────────────────────────────────────
  { id: 'pokt-agent' as const, label: 'POKT Agent', badge: 'NEW', section: 'pokt' as const,
    icon: <I><circle cx="12" cy="12" r="9"/><path d="M12 3v9l4.5 4.5"/><circle cx="12" cy="12" r="3"/></I> },

      // ── CROO CAP ──────────────────────────────────────────────────────────────
  { id: 'croo-cap', label: 'CROO Agent Protocol', badge: 'NEW', section: 'croo',
    icon: <I><circle cx="12" cy="12" r="3"/><path d="M3 12h2M19 12h2M12 3v2M12 19v2"/><path d="M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4"/></I> },

  // ── Tools ─────────────────────────────────────────────────────────────────
  { id: 'chat',      label: 'AI Assistant', section: 'tools',
    icon: <I><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></I> },
  { id: 'learn',     label: 'Learn',        section: 'tools',
    icon: <I><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></I> },
  { id: 'square',    label: 'Square',       section: 'tools',
    icon: <I><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6v6H9z"/></I> },
  { id: 'messaging', label: 'Messaging',    badge: 'NEW', section: 'tools',
    icon: <I><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><circle cx="12" cy="10" r="1"/><circle cx="8" cy="10" r="1"/><circle cx="16" cy="10" r="1"/></I> },
]

const SECTIONS: { id: NavItem['section']; label: string; color: string }[] = [
  { id: 'intelligence', label: 'Intelligence',  color: '#3498db'  },
  { id: 'agent',        label: 'Trading Agent', color: '#F0B90B'  },
    { id: 'bitget',         label: 'Bitget',   color: '#0bf5d6'  },
    { id: 'pokt',         label: 'POKT Agent',   color: '#5C6BC0'  },
   { id: 'stellar',      label: 'Stellar Agent',   color: '#FCFF52'  },
    { id: 'croo',         label: 'CROO Agent Protocol',   color: '#f59e0b'  },
  { id: 'binance',      label: 'Binance',       color: '#0ECB81'  },
  { id: 'tools',        label: 'Tools',         color: 'rgba(255,255,255,.3)' },
]

export default function Sidebar() {
  const { activeTab, setActiveTab, isConnected, autoTradeEnabled } = useStore()
  const { session, isWalletLoaded } = useAgentStore()
  const network = (useAgentStore() as any).network ?? 'testnet'
  const isLive  = session?.status === 'running' && network === 'mainnet'

  // Show BNB chain indicator only when on agent-related tabs
  const agentTabs: ActiveTab[] = ['agent-wallet', 'strategy', 'backtest', 'competition', 'performance', 'agent', 'submission']
  const isAgentTab = agentTabs.includes(activeTab)

  return (
    <>
      <style>{`
        .bn-sidebar {
          width: 52px;
          transition: width 0.22s cubic-bezier(0.4,0,0.2,1);
          overflow: hidden;
          white-space: nowrap;
        }
        .bn-sidebar:hover { width: 204px; }

        .bn-label, .bn-logo-text, .bn-badge, .bn-status, .bn-section-label {
          opacity: 0;
          transition: opacity 0.1s 0.05s;
        }
        .bn-sidebar:hover .bn-label,
        .bn-sidebar:hover .bn-logo-text,
        .bn-sidebar:hover .bn-badge,
        .bn-sidebar:hover .bn-status,
        .bn-sidebar:hover .bn-section-label { opacity: 1; }

        .bn-label  { font-size: 12px; font-weight: 600; color: rgba(255,255,255,.55); flex: 1; }
        .bn-status { font-size: 9px; white-space: nowrap; font-family: 'Space Mono', monospace; font-weight: 700; }
        .bn-section-label {
          font-size: 8px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 10px 14px 3px;
          font-family: 'Space Mono', monospace;
          font-weight: 700;
        }

        .bn-item {
          position: relative;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 7px 14px;
          cursor: pointer;
          width: 100%;
          border: none;
          background: transparent;
          text-align: left;
          transition: background 0.12s;
        }
        .bn-item:hover { background: rgba(255,255,255,.04); }
        .bn-item.active { background: rgba(240,185,11,.08); }
        .bn-item.active::before {
          content: '';
          position: absolute;
          left: 0; top: 4px; bottom: 4px;
          width: 2px;
          background: #F0B90B;
          border-radius: 0 2px 2px 0;
        }
        .bn-item.active .bn-label { color: #F0B90B !important; }
        .bn-item .bn-icon { opacity: 0.45; transition: opacity .12s; }
        .bn-item:hover .bn-icon { opacity: 0.7; }
        .bn-item.active .bn-icon { opacity: 1; }

        @keyframes sbBlink { 0%,100%{opacity:1} 50%{opacity:0.2} }
      `}</style>

      <aside
        className="bn-sidebar flex flex-col shrink-0 border-r"
        style={{ background: '#000', borderColor: 'rgba(240,185,11,.1)', height: '100vh' }}>

        {/* ── Logo — just B, no chain branding ──────────────────────────── */}
        <button
          onClick={() => setActiveTab('home')}
          className="flex items-center gap-3 border-b shrink-0 w-full text-left transition-all"
          style={{ padding: '13px 13px', borderColor: 'rgba(240,185,11,.1)', background: 'transparent' }}
          onMouseEnter={(e: any) => (e.currentTarget.style.background = 'rgba(255,255,255,.03)')}
          onMouseLeave={(e: any) => (e.currentTarget.style.background = 'transparent')}>
          <div
            className="flex items-center justify-center font-black shrink-0 rounded"
            style={{ width: 26, height: 26, background: '#F0B90B', color: '#000', fontSize: 14, letterSpacing: '-.02em' }}>
            B
          </div>
          <div className="bn-logo-text">
            <div className="font-extrabold text-sm leading-tight" style={{ color: '#fff', letterSpacing: '-.01em' }}>
              Binalyst
            </div>
            <div className="mono text-[8px] tracking-widest uppercase" style={{ color: 'rgba(255,255,255,.28)' }}>
              AI Quant Trading
            </div>
          </div>
        </button>

        {/* ── Live badge (only mainnet + running) ────────────────────────── */}
        {isLive && (
          <div className="mx-2 mt-2 flex items-center gap-2 px-2 py-1.5 rounded"
            style={{ background: 'rgba(14,203,129,.07)', border: '1px solid rgba(14,203,129,.2)' }}>
            <span className="shrink-0 rounded-full"
              style={{ width: 6, height: 6, background: '#0ECB81', animation: 'sbBlink 1s infinite', display: 'block' }} />
            <span className="bn-status" style={{ color: '#0ECB81' }}>LIVE TRADING</span>
          </div>
        )}

        {/* ── BNB chain indicator — only when on an agent tab ───────────── */}
        {isAgentTab && isWalletLoaded && (
          <div className="mx-2 mt-2 flex items-center gap-2 px-2 py-1.5 rounded"
            style={{ background: 'rgba(240,185,11,.05)', border: '1px solid rgba(240,185,11,.18)' }}>
            <span style={{ color: '#F0B90B', display: 'flex', alignItems: 'center' }}>
              <BNBIcon size={12} />
            </span>
            <span className="bn-status" style={{ color: '#F0B90B' }}>BNB CHAIN</span>
            {session?.status === 'running' && (
              <span className="shrink-0 rounded-full ml-auto"
                style={{ width: 5, height: 5, background: '#0ECB81', animation: 'sbBlink 1.5s infinite', display: 'block' }} />
            )}
          </div>
        )}

        {/* ── Nav ───────────────────────────────────────────────────────── */}
        <nav className="flex-1 py-1 flex flex-col overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          {SECTIONS.map((section, si) => {
            const items = NAV.filter(n => n.section === section.id)
            return (
              <div key={section.id}>
                {si > 0 && (
                  <div className="mx-2 my-1" style={{ height: 1, background: 'rgba(240,185,11,.08)' }} />
                )}
                <div className="bn-section-label" style={{ color: section.color }}>
                  {section.label}
                </div>
                {items.map(item => {
                  const active = activeTab === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`bn-item ${active ? 'active' : ''}`}>
                      <span
                        className="bn-icon shrink-0 flex items-center justify-center"
                        style={{ width: 24, color: active ? '#F0B90B' : 'rgba(255,255,255,.7)' }}>
                        {item.icon}
                      </span>
                      <span className="bn-label" style={{ color: active ? '#F0B90B' : undefined }}>
                        {item.label}
                      </span>
                      {item.badge && (
                        <span
                          className="bn-badge mono shrink-0 rounded"
                          style={{ fontSize: 7, fontWeight: 800, padding: '1px 5px', background: '#F0B90B', color: '#000' }}>
                          {item.badge}
                        </span>
                      )}
                      {item.dot && !item.badge && (
                        <span
                          className="bn-badge shrink-0 rounded-full"
                          style={{ width: 6, height: 6, display: 'block',
                            background: section.color === '#F0B90B' ? '#F0B90B' : '#0ECB81',
                            animation: 'sbBlink 2s infinite' }} />
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </nav>

        {/* ── Bottom ────────────────────────────────────────────────────── */}
        <div className="shrink-0 border-t" style={{ borderColor: 'rgba(240,185,11,.1)', padding: '6px 0' }}>
          {autoTradeEnabled && (
            <div className="flex items-center gap-2 mx-2 mb-1 px-2 py-1.5 rounded"
              style={{ background: 'rgba(246,70,93,.07)', border: '1px solid rgba(246,70,93,.2)' }}>
              <span className="shrink-0 rounded-full"
                style={{ width: 6, height: 6, background: '#F6465D', animation: 'sbBlink 1.5s infinite', display: 'block' }} />
              <span className="bn-status" style={{ color: '#F6465D' }}>AUTO-TRADE ON</span>
            </div>
          )}

          <div className="flex items-center gap-3 px-[14px] py-1.5">
            <span className="shrink-0 rounded-full"
              style={{ width: 8, height: 8, display: 'block',
                background: isConnected ? '#0ECB81' : 'rgba(255,255,255,.2)',
                animation: isConnected ? 'sbBlink 2s infinite' : 'none' }} />
            <span className="bn-status" style={{ color: 'rgba(255,255,255,.3)' }}>
              {isConnected ? 'Binance ✓' : 'No API key'}
            </span>
          </div>

          <button
            onClick={() => setActiveTab('settings')}
            className={`bn-item ${activeTab === 'settings' ? 'active' : ''}`}>
            <span className="bn-icon shrink-0 flex items-center justify-center"
              style={{ width: 24, color: activeTab === 'settings' ? '#F0B90B' : 'rgba(255,255,255,.7)' }}>
              <I size={16}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></I>
            </span>
            <span className="bn-label">Settings</span>
          </button>
        </div>
      </aside>
    </>
  )
}
