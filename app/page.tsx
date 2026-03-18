'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useStore } from '@/lib/store'
import Sidebar      from '@/components/Sidebar'
import Header       from '@/components/Header'
import BottomNav    from '@/components/BottomNav'
import MobileDrawer from '@/components/MobileDrawer'
import DashboardTab from '@/components/tabs/DashboardTab'
import ChatTab      from '@/components/tabs/ChatTab'
import MarketsTab   from '@/components/tabs/MarketsTab'
import EventsTab    from '@/components/tabs/EventsTab'
import LearnTab     from '@/components/tabs/LearnTab'
import PortfolioTab from '@/components/tabs/PortfolioTab'
import TradingTab   from '@/components/tabs/TradeTab'
import AlertsTab    from '@/components/tabs/AlertsTab'
import AgentTab     from '@/components/tabs/AgentTab'
import Web3Tab      from '@/components/tabs/Web3Tab'
import SquareTab    from '@/components/tabs/SquareTab'
import MessagingTab from '@/components/tabs/MessagingTab'
import SettingsTab  from '@/components/tabs/SettingsTab'

const TABS: Record<string, React.ReactNode> = {
  home:      <DashboardTab />,
  chat:      <ChatTab />,
  markets:   <MarketsTab />,
  events:    <EventsTab />,
  learn:     <LearnTab />,
  portfolio: <PortfolioTab />,
  trading:   <TradingTab />,
  alerts:    <AlertsTab />,
  agent:     <AgentTab />,
  web3:      <Web3Tab />,
  square:    <SquareTab />,
  messaging: <MessagingTab />,
  settings:  <SettingsTab />,
}

export default function App() {
  const { data: session } = useSession()
  const { activeTab, setActiveTab } = useStore()
  const [drawer, setDrawer] = useState(false)
  const isHome = activeTab === 'home'

  // Always land on dashboard after login
  useEffect(() => {
    if (session) setActiveTab('home')
  }, [session?.user?.email])

  return (
    <>
      {/* ── Desktop ── */}
      <div className="hidden md:flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0">
          {!isHome && <Header />}
          <main className="flex-1 overflow-y-auto">
            {TABS[activeTab]}
          </main>
        </div>
      </div>

      {/* ── Mobile ── */}
      <div className="flex md:hidden flex-col" style={{ background: 'var(--bg)', minHeight: '100dvh' }}>
        {!isHome && (
          <div className="flex items-center justify-between px-4 h-14 shrink-0 border-b"
            style={{ background: 'rgba(11,14,17,0.95)', backdropFilter: 'blur(12px)', borderColor: 'var(--border)', position: 'sticky', top: 0, zIndex: 30 }}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-sm"
                style={{ background: 'var(--yellow)', color: '#000' }}>B</div>
              <span className="font-extrabold text-sm" style={{ color: 'var(--text)' }}>Binalyst</span>
            </div>
            <button onClick={() => setDrawer(true)}
              className="flex flex-col items-center justify-center gap-1 w-9 h-9 rounded-lg"
              style={{ background: 'var(--bg3)' }}>
              {[16, 16, 10].map((w, i) => (
                <span key={i} style={{ width: w, height: 1.5, background: 'var(--text2)', borderRadius: 1, display: 'block' }} />
              ))}
            </button>
          </div>
        )}
        <main className="flex-1 overflow-y-auto" style={{ paddingBottom: 68 }}>
          {TABS[activeTab]}
        </main>
        <BottomNav />
        <MobileDrawer open={drawer} onClose={() => setDrawer(false)} />
      </div>
    </>
  )
}