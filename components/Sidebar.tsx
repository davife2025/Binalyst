'use client'

/**
 * components/Sidebar.tsx — Session I
 * Reorganized into 4 clear sections matching platform pillars:
 *   INTELLIGENCE · TRADING AGENT · BINANCE · TOOLS
 * Preserves all existing animation + design.
 */

import { useStore }      from '@/lib/store'
import { useAgentStore } from '@/lib/agentStore'
import type { ActiveTab } from '@/lib/store'

type NavItem = {
  id:       ActiveTab
  label:    string
  icon:     string
  dot?:     boolean
  badge?:   string
  section:  'intelligence' | 'agent' | 'binance' | 'tools'  | 'celo' | 'sui' |'mantle' 
}

const NAV: NavItem[] = [
  // ── Intelligence ──────────────────────────────────────────────────────────
  { id: 'signals',      label: 'CMC Signals',    icon: '📡',  dot: true,  section: 'intelligence' },
  { id: 'web3',         label: 'Web3 Intel',      icon: '⬡',              section: 'intelligence' },
  { id: 'events',       label: 'Events Radar',    icon: '◎',  dot: true,  section: 'intelligence' },

  // ── Trading Agent ─────────────────────────────────────────────────────────
  { id: 'agent-wallet', label: 'Agent Wallet',    icon: '🔐',             section: 'agent' },
  { id: 'strategy',     label: 'Strategy',        icon: '🧠',             section: 'agent' },
  { id: 'backtest',     label: 'Backtest',        icon: '📈',  dot: true, section: 'agent' },
  { id: 'competition',  label: 'Competition',     icon: '🏆',  dot: true, section: 'agent' },
  { id: 'performance',  label: 'Performance',     icon: '📊',             section: 'agent' },
  { id: 'submission',   label: 'Submission',      icon: '📝',             section: 'agent' },
  { id: 'agent',        label: 'Rules Engine',    icon: '🤖',             section: 'agent' },

  // ── Binance ───────────────────────────────────────────────────────────────
  { id: 'markets',      label: 'Live Markets',    icon: '◐',              section: 'binance' },
  { id: 'portfolio',    label: 'Portfolio',       icon: '◑',              section: 'binance' },
  { id: 'trading',      label: 'Trade',           icon: '⚡',              section: 'binance' },
  { id: 'alerts',       label: 'Price Alerts',    icon: '🔔',             section: 'binance' },

     // ── Celo Payments Agent (Session L — Onchain Agents Hackathon) ───────────────
  { id: 'celo-agent',   label: 'Celo Agent',      icon: '🟡',  dot: true, section: 'celo' },


     // ── sui ───────────────
  { id: 'sui-agent',  label: 'Sui Agent',  icon: '⛓️',    section: 'sui'},
  { id: 'deepbook',   label: 'DeepBook',   icon: '📊',   section: 'sui'},
  { id: 'revocation', label: 'Revocation', icon: '🛑',  section: 'sui' },

  // ── Tools ─────────────────────────────────────────────────────────────────
  { id: 'chat',         label: 'AI Assistant',    icon: '◈',              section: 'tools' },
  { id: 'learn',        label: 'Learn',           icon: '◉',              section: 'tools' },
  { id: 'square',       label: 'Square',          icon: '✦',              section: 'tools' },
  { id: 'messaging',    label: 'Messaging',    icon: '📱',  badge: 'NEW', section: 'tools' },

  // ── Mantle AI Trading Agent (Session N — The Turing Test Hackathon) ───────
  { id: 'mantle-agent', label: 'Mantle Agent',  icon: '⬡',  badge: 'NEW', section: 'mantle' },
   { id: 'mantle-submission', label: 'Submit Hackathon',   icon: '🏆', section: 'mantle' },
]

const SECTIONS: { id: NavItem['section']; label: string; color: string }[] = [
  { id: 'intelligence', label: 'Intelligence',   color: '#3498db'       },
  { id: 'agent',        label: 'Trading Agent',  color: 'var(--yellow)' },
  { id: 'celo',         label: 'Celo Agent',     color: '#FCFF52'       },
  { id: 'sui',          label: 'Sui Agent',      color: '#61DAFB'       },
  { id: 'mantle',       label: 'Mantle Agent',   color: '#61DAFB'       },
  { id: 'binance',      label: 'Binance',        color: 'var(--green)'  },
  { id: 'tools',        label: 'Tools',          color: 'var(--text3)'  },
  
]

export default function Sidebar() {
  const { activeTab, setActiveTab, isConnected, autoTradeEnabled } = useStore()
  const { session, isWalletLoaded } = useAgentStore()
  const network = (useAgentStore() as any).network ?? 'testnet'
  const isLive  = session?.status === 'running' && network === 'mainnet'

  return (
    <>
      <style>{`
        .bn-sidebar {
          width: 52px;
          transition: width 0.22s cubic-bezier(0.4,0,0.2,1);
          overflow: hidden;
          white-space: nowrap;
        }
        .bn-sidebar:hover { width: 200px; }

        .bn-label, .bn-logo-text, .bn-badge, .bn-status, .bn-section-label {
          opacity: 0;
          transition: opacity 0.12s 0.06s;
        }
        .bn-sidebar:hover .bn-label,
        .bn-sidebar:hover .bn-logo-text,
        .bn-sidebar:hover .bn-badge,
        .bn-sidebar:hover .bn-status,
        .bn-sidebar:hover .bn-section-label { opacity: 1; }

        .bn-label  { font-size: 12px; font-weight: 600; color: var(--text2); flex: 1; }
        .bn-status { font-size: 10px; white-space: nowrap; }
        .bn-section-label {
          font-size: 9px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 10px 14px 3px;
          font-family: 'Space Mono', monospace;
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
        .bn-item:hover { background: var(--bg3); }
        .bn-item.active { background: var(--yellow-glow); }
        .bn-item.active::before {
          content: '';
          position: absolute;
          left: 0; top: 4px; bottom: 4px;
          width: 2px;
          background: var(--yellow);
          border-radius: 0 2px 2px 0;
        }
        .bn-item.active .bn-label { color: var(--yellow); }
        .bn-item .bn-icon         { opacity: 0.65; }
        .bn-item.active .bn-icon  { opacity: 1; }
        @keyframes sbBlink { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>

      <aside className="bn-sidebar flex flex-col shrink-0 border-r"
        style={{ background: 'var(--bg2)', borderColor: 'var(--border)', height: '100vh' }}>

        {/* ── Logo ──────────────────────────────────────────────────────── */}
        <button
          onClick={() => setActiveTab('home')}
          className="flex items-center gap-3 px-[13px] py-4 border-b shrink-0 w-full text-left transition-all"
          style={{ borderColor: 'var(--border)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <div className="w-[26px] h-[26px] rounded-md flex items-center justify-center font-black shrink-0"
            style={{ background: 'var(--yellow)', color: '#000', fontSize: 12 }}>B</div>
          <div className="bn-logo-text">
            <div className="font-extrabold text-sm leading-tight" style={{ color: 'var(--text)' }}>
              Binalyst
            </div>
            <div className="mono text-[8px] tracking-widest uppercase" style={{ color: 'var(--text3)' }}>
              BNB AI Trading
            </div>
          </div>
        </button>

        {/* ── Live badge (only on mainnet + running) ─────────────────────── */}
        {isLive && (
          <div className="mx-2 mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(14,203,129,0.08)', border: '1px solid rgba(14,203,129,0.25)' }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: 'var(--green)', animation: 'sbBlink 1s infinite' }} />
            <span className="bn-status mono font-bold" style={{ color: 'var(--green)' }}>
              LIVE TRADING
            </span>
          </div>
        )}

        {/* ── Nav sections ──────────────────────────────────────────────── */}
        <nav className="flex-1 py-1 flex flex-col overflow-y-auto">
          {SECTIONS.map((section, si) => {
            const items = NAV.filter(n => n.section === section.id)
            return (
              <div key={section.id}>
                {si > 0 && (
                  <div className="mx-2 my-1 h-px" style={{ background: 'var(--border)' }} />
                )}
                <div className="bn-section-label" style={{ color: section.color }}>
                  {section.label}
                </div>
                {items.map(item => {
                  const active = activeTab === item.id
                  return (
                    <button key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`bn-item ${active ? 'active' : ''}`}>
                      <span className="bn-icon text-center shrink-0"
                        style={{ fontSize: 14, width: 24 }}>{item.icon}</span>
                      <span className="bn-label">{item.label}</span>
                      {item.badge && (
                        <span className="bn-badge mono text-[7px] font-bold px-1 py-0.5 rounded shrink-0"
                          style={{ background: 'var(--yellow)', color: '#000' }}>
                          {item.badge}
                        </span>
                      )}
                      {item.dot && !item.badge && (
                        <span className="bn-badge w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: section.color === 'var(--yellow)' ? 'var(--yellow)' : 'var(--green)', animation: 'sbBlink 2s infinite' }} />
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </nav>

        {/* ── Bottom ────────────────────────────────────────────────────── */}
        <div className="border-t shrink-0" style={{ borderColor: 'var(--border)', padding: '6px 0' }}>
          {autoTradeEnabled && (
            <div className="flex items-center gap-2 mx-2 mb-1 px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(246,70,93,0.08)', border: '1px solid rgba(246,70,93,0.2)' }}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: 'var(--red)', animation: 'sbBlink 1.5s infinite' }} />
              <span className="bn-status mono font-bold" style={{ color: 'var(--red)' }}>
                AUTO-TRADE ON
              </span>
            </div>
          )}

          <div className="flex items-center gap-3 px-[14px] py-1.5">
            <span className="w-2 h-2 rounded-full shrink-0"
              style={{
                background: isConnected ? 'var(--green)' : 'var(--text3)',
                animation:  isConnected ? 'sbBlink 2s infinite' : 'none',
              }} />
            <span className="bn-status mono" style={{ color: 'var(--text3)' }}>
              {isConnected ? 'Binance ✓' : 'No API key'}
            </span>
          </div>

          <button onClick={() => setActiveTab('settings')}
            className={`bn-item ${activeTab === 'settings' ? 'active' : ''}`}>
            <span className="bn-icon text-center shrink-0" style={{ fontSize: 14, width: 24 }}>⚙</span>
            <span className="bn-label">Settings</span>
          </button>
        </div>
      </aside>
    </>
  )
}
