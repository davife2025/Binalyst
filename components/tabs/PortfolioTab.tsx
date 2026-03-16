'use client'
export default function PortfolioTab() {
  return (
    <div className="flex items-center justify-center h-full flex-col gap-4 p-8">
      <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl" style={{ background: 'var(--bg3)', color: 'var(--yellow)', border: '1px solid var(--border)' }}>◑</div>
      <div className="text-center">
        <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>My Portfolio</h2>
        <p className="text-sm mt-1 max-w-xs" style={{ color: 'var(--text2)' }}>Live Binance portfolio sync, P&L tracking and AI advisor — Session 5.</p>
      </div>
      <div className="mono text-xs px-4 py-2 rounded-full" style={{ background: 'var(--bg3)', color: 'var(--text3)' }}>S5</div>
    </div>
  )
}
