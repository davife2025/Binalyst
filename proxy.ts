/**
 * proxy.ts — Next.js 16 proxy (replaces middleware.ts)
 *
 * IMPORTANT: Next.js 16 requires the function to be exported as `proxy`
 * (or as default), NOT as `middleware`. That was the bug.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = [
  '/login',
  '/api/auth',
  '/api/cmc',
  '/api/binance/market',
  '/_next',
  '/favicon.ico',
]

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname.startsWith(p))
}

// ← named export must be `proxy` in Next.js 16
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (isPublic(pathname)) return NextResponse.next()

  const token =
    req.cookies.get('next-auth.session-token')?.value ??
    req.cookies.get('__Secure-next-auth.session-token')?.value ??
    req.cookies.get('authjs.session-token')?.value ??
    req.cookies.get('__Secure-authjs.session-token')?.value

  if (!token) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
