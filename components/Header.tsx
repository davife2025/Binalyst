'use client'

import { useStore } from '@/lib/store'
const TAB_TITLES: Record<string, { title: string; sub: string }> = {
  chat:      { title: 'AI Assistant',        sub: 'Powered by Claude + live Binance data' },
  markets:   { title: 'Live Markets',        sub: 'Real-time prices & analysis' },
  events:    { title: 'Events Radar',        sub: 'Listings, airdrops, launchpool & more' },
  learn:     { title: 'Crypto Academy',      sub: 'Learn Binance products & trading' },
  portfolio: { title: 'My Portfolio',        sub: 'Holdings, P&L & AI advisor' },
  trading:   { title: 'Trading',             sub: 'Place and manage Binance orders' },
  alerts:    { title: 'Price Alerts',        sub: 'Browser push notifications on price targets' },
  agent:     { title: 'Autonomous Agent',    sub: 'Rules engine · checks every 2 min' },
  web3:      { title: 'Web3 Intelligence',   sub: 'On-chain analytics · Binance Skills Hub' },
  settings:  { title: 'Settings',            sub: 'API keys, preferences & auto-trade' },
}

export default function Header() {
  const { activeTab, isConnected, autoTradeEnabled } = useStore()
 const meta = TAB_TITLES[activeTab] ?? TAB_TITLES.chat

  return (
    <header
      className="flex items-center justify-between px-6 h-16 shrink-0 border-b"
      style={{
        background: 'rgba(11,14,17,0.9)',
        backdropFilter: 'blur(12px)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Title */}
      <div>
        <h1
          className="text-base font-extrabold leading-tight"
          style={{ color: 'var(--text)' }}
        >
          {meta.title}
        </h1>
        <p className="mono text-[10px] mt-0.5" style={{ color: 'var(--text3)' }}>
          {meta.sub}
        </p>
      </div>

      {/* Right side indicators */}
      <div className="flex items-center gap-3">
        {/* Auto-trade badge */}
        {autoTradeEnabled && (
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full mono text-[10px] font-bold"
            style={{
              background: 'rgba(246,70,93,0.12)',
              border: '1px solid rgba(246,70,93,0.3)',
              color: 'var(--red)',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: 'var(--red)', animation: 'blink 1.5s infinite' }}
            />
            AUTO-TRADE ON
          </div>
        )}

        {/* AI status */}
        <div
          className="flex items-center gap-1.5 px-3 py-1 rounded-full mono text-[10px]"
          style={{
            background: 'rgba(14,203,129,0.08)',
            border: '1px solid rgba(14,203,129,0.2)',
            color: 'var(--green)',
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: 'var(--green)', animation: 'blink 2s infinite' }}
          />
          AI Online
        </div>

        {/* Binance connection */}
        <div
          className="flex items-center gap-1.5 px-3 py-1 rounded-full mono text-[10px]"
          style={{
            background: isConnected ? 'rgba(240,185,11,0.08)' : 'var(--bg3)',
            border: isConnected
              ? '1px solid rgba(240,185,11,0.25)'
              : '1px solid var(--border)',
            color: isConnected ? 'var(--yellow)' : 'var(--text3)',
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: isConnected ? 'var(--yellow)' : 'var(--text3)',
              animation: isConnected ? 'blink 2s infinite' : 'none',
            }}
          />
          {isConnected ? 'Binance ✓' : 'No key'}
        </div>
      </div>
    </header>
  )
}
