'use client'
// ChatTab — S3 will wire this to the real AI streaming endpoint
import { useStore } from '@/lib/store'

export default function ChatTab() {
  const isConnected = useStore(s => s.isConnected)
  return (
    <div className="flex items-center justify-center h-full flex-col gap-4 p-8">
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
        style={{ background: 'var(--yellow)', color: '#000' }}
      >
        ◈
      </div>
      <div className="text-center">
        <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
          AI Assistant
        </h2>
        <p className="text-sm mt-1 max-w-xs" style={{ color: 'var(--text2)' }}>
          Full chat UI coming in Session 4.{' '}
          {!isConnected && (
            <span style={{ color: 'var(--yellow)' }}>
              Connect your Binance API key in Settings for live data.
            </span>
          )}
        </p>
      </div>
      <div
        className="mono text-xs px-4 py-2 rounded-full"
        style={{ background: 'var(--bg3)', color: 'var(--text3)' }}
      >
        S4 — Chat UI
      </div>
    </div>
  )
}
