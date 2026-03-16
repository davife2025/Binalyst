'use client'

import { useStore } from '@/lib/store'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import ChatPage from '@/components/tabs/ChatTab'
import MarketsTab from '@/components/tabs/MarketsTab'
import EventsTab from '@/components/tabs/EventsTab'
import LearnTab from '@/components/tabs/LearnTab'
import PortfolioTab from '@/components/tabs/PortfolioTab'
import SettingsTab from '@/components/tabs/SettingsTab'

export default function Dashboard() {
  const activeTab = useStore(s => s.activeTab)

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto">
          {activeTab === 'chat'      && <ChatPage />}
          {activeTab === 'markets'   && <MarketsTab />}
          {activeTab === 'events'    && <EventsTab />}
          {activeTab === 'learn'     && <LearnTab />}
          {activeTab === 'portfolio' && <PortfolioTab />}
          {activeTab === 'settings'  && <SettingsTab />}
        </main>
      </div>
    </div>
  )
}
