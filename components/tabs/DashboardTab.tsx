'use client'

import { useStore } from '@/lib/store'
import { useSession } from 'next-auth/react'

const FEATURES = [
  { icon: '◈', title: 'AI Assistant',    desc: 'Ask anything about Binance, prices, and crypto markets in real time.' },
  { icon: '◐', title: 'Live Markets',    desc: 'Real-time prices, candlestick charts, and order book depth.' },
  { icon: '⬡', title: 'Web3 Intel',      desc: 'Token audits, wallet tracking, smart money, and meme launches.' },
  { icon: '◑', title: 'Portfolio',       desc: 'Track your holdings, P&L, and get AI rebalancing advice.' },
  { icon: '⚡', title: 'Trading',         desc: 'Place and manage Binance orders directly from the platform.' },
  { icon: '◎', title: 'Events Radar',    desc: 'Stay ahead of listings, airdrops, and launchpool opportunities.' },
  { icon: '✦', title: 'Binance Square',  desc: 'Draft and publish AI-generated posts to your Square profile.' },
  { icon: '🤖', title: 'Agent Mode',      desc: 'Set rules and let Binalyst watch the market autonomously.' },
]

export default function DashboardTab() {
  const { setActiveTab } = useStore()
  const { data: session } = useSession()
  const name = session?.user?.name?.split(' ')[0] ?? 'there'

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>

      {/* Hero */}
      <div className="flex flex-col items-center justify-center text-center px-6 pt-20 pb-12">
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl font-extrabold mb-8"
          style={{ background: 'var(--yellow)', color: '#000' }}
        >
          B
        </div>
        <h1 className="text-4xl font-extrabold mb-4" style={{ color: 'var(--text)', lineHeight: 1.1 }}>
          Welcome to Binalyst
        </h1>
        <p className="text-base max-w-md mb-2" style={{ color: 'var(--text2)', lineHeight: 1.7 }}>
          Hey {name} — Binalyst is your AI-powered assistant for Binance.
          Trade smarter, discover on-chain alpha, track your portfolio,
          and stay ahead of the market — all in one place.
        </p>
        <p className="mono text-xs" style={{ color: 'var(--text3)' }}>
          Use the sidebar on the left to navigate between modules.
        </p>

        {/* CTA */}
        <button
          onClick={() => setActiveTab('chat')}
          className="mt-8 px-8 py-3 rounded-xl text-sm font-bold transition-all"
          style={{ background: 'var(--yellow)', color: '#000' }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          Start with AI Assistant →
        </button>
      </div>

      {/* Divider */}
      <div className="mx-auto w-full max-w-3xl px-6">
        <div className="h-px" style={{ background: 'var(--border)' }} />
      </div>

      {/* What's inside */}
      <div className="max-w-3xl mx-auto w-full px-6 py-12">
        <p className="mono text-[10px] uppercase tracking-widest text-center mb-8" style={{ color: 'var(--text3)' }}>
          What's inside Binalyst
        </p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {FEATURES.map(f => (
            <div
              key={f.title}
              className="flex flex-col gap-2 p-4 rounded-xl"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}
            >
              <span className="text-xl">{f.icon}</span>
              <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{f.title}</div>
              <div className="mono text-[10px] leading-relaxed" style={{ color: 'var(--text3)' }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer note */}
      <div className="text-center pb-12">
        <p className="mono text-[10px]" style={{ color: 'var(--text3)' }}>
          Powered by Binance Skills Hub · Gemini AI · Built for the OpenClaw hackathon
        </p>
      </div>

    </div>
  )
}
