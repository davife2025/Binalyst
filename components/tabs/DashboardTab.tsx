'use client'

import { useStore } from '@/lib/store'
import { useSession } from 'next-auth/react'

const MENU = [
  { id: 'chat',      icon: '◈', label: 'AI Assistant'  },
  { id: 'markets',   icon: '◐', label: 'Markets'       },
  { id: 'portfolio', icon: '◑', label: 'Portfolio'     },
  { id: 'trading',   icon: '⚡', label: 'Trade'         },
  { id: 'web3',      icon: '⬡', label: 'Web3'          },
  { id: 'events',    icon: '◎', label: 'Events'        },
  { id: 'square',    icon: '✦', label: 'Square'        },
  { id: 'alerts',    icon: '🔔', label: 'Alerts'        },
  { id: 'agent',     icon: '🤖', label: 'Agent'         },
  { id: 'learn',     icon: '◉', label: 'Learn'         },
]

export default function DashboardTab() {
  const { setActiveTab } = useStore()
  const { data: session } = useSession()
  const name = session?.user?.name?.split(' ')[0] ?? 'Trader'

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-6 py-16 text-center">

      {/* Logo + welcome */}
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-extrabold mb-6"
        style={{ background: 'var(--yellow)', color: '#000' }}>
        B
      </div>

      <h1 className="text-3xl font-extrabold mb-2" style={{ color: 'var(--text)' }}>
        Welcome to Binalyst
      </h1>
      <p className="mono text-sm mb-12" style={{ color: 'var(--text3)' }}>
        Hey {name} — your AI-powered Binance assistant
      </p>

      {/* Menu */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
        {MENU.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id as any)}
            className="flex items-center gap-3 px-4 py-4 rounded-xl text-left transition-all"
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--yellow)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg3)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg2)' }}
          >
            <span className="text-lg w-6 text-center shrink-0">{item.icon}</span>
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{item.label}</span>
          </button>
        ))}
      </div>

      <p className="mono text-[10px] mt-12" style={{ color: 'var(--text3)' }}>
        Powered by Binance Skills Hub · Gemini AI
      </p>
    </div>
  )
}