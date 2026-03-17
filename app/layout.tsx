import type { Metadata, Viewport } from 'next'
import Providers from '@/components/Providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Binalyst — Binance AI Assistant',
  description: 'AI-powered Binance co-pilot. Live markets, trading assistant, events radar, portfolio tracker.',
  icons: { icon: '/favicon.ico' },
  openGraph: {
    title: 'Binalyst',
    description: 'AI-powered Binance assistant',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0B0E11',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
