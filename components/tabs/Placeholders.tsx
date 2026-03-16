'use client'

function TabPlaceholder({ icon, title, session, desc }: {
  icon: string; title: string; session: string; desc: string
}) {
  return (
    <div className="flex items-center justify-center h-full flex-col gap-4 p-8">
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
        style={{ background: 'var(--bg3)', color: 'var(--yellow)', border: '1px solid var(--border)' }}
      >
        {icon}
      </div>
      <div className="text-center">
        <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{title}</h2>
        <p className="text-sm mt-1 max-w-xs" style={{ color: 'var(--text2)' }}>{desc}</p>
      </div>
      <div
        className="mono text-xs px-4 py-2 rounded-full"
        style={{ background: 'var(--bg3)', color: 'var(--text3)' }}
      >
        {session}
      </div>
    </div>
  )
}

export function EventsTab() {
  return <TabPlaceholder icon="◎" title="Events Radar" session="S6" desc="Live Binance events scanner, calendar export and countdowns coming in Session 6." />
}

export function LearnTab() {
  return <TabPlaceholder icon="◉" title="Crypto Academy" session="S7" desc="AI-powered lessons and quiz generator coming in Session 7." />
}

export function PortfolioTab() {
  return <TabPlaceholder icon="◑" title="My Portfolio" session="S5" desc="Live Binance portfolio sync with P&L and AI advisor coming in Session 5." />
}

export default TabPlaceholder
