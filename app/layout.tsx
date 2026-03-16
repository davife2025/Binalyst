import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Binalyst — Binance AI Assistant',
  description: 'Your intelligent Binance co-pilot. Live markets, AI trading assistant, events radar, portfolio tracker.',
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    title: 'Binalyst',
    description: 'AI-powered Binance assistant',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}