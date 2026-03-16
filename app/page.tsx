'use client'

import { useStore } from '@/lib/store'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import ChatTab from '@/components/tabs/ChatTab'
import MarketsTab from '@/components/tabs/MarketsTab'
import EventsTab from '@/components/tabs/EventsTab'
import LearnTab from '@/components/tabs/LearnTab'
import PortfolioTab from '@/components/tabs/PortfolioTab'
import TradingTab from '@/components/tabs/TradeTab'
import AlertsTab from '@/components/tabs/AlertsTab'
import AgentTab from '@/components/tabs/AgentTab'
import Web3Tab from '@/components/tabs/Web3Tab'
import SquareTab from '@/components/tabs/SquareTab'
import SettingsTab from '@/components/tabs/SettingsTab'

export default function Dashboard() {
  const activeTab = useStore(s => s.activeTab)
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto">
          {activeTab === 'chat'      && <ChatTab />}
          {activeTab === 'markets'   && <MarketsTab />}
          {activeTab === 'events'    && <EventsTab />}
          {activeTab === 'learn'     && <LearnTab />}
          {activeTab === 'portfolio' && <PortfolioTab />}
          {activeTab === 'trading'   && <TradingTab />}
          {activeTab === 'alerts'    && <AlertsTab />}
          {activeTab === 'agent'     && <AgentTab />}
          {activeTab === 'web3'      && <Web3Tab />}
          {activeTab === 'square'    && <SquareTab />}
          {activeTab === 'settings'  && <SettingsTab />}
        </main>
      </div>
    </div>
  )
}
