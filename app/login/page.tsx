'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router   = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [showPass, setShowPass] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await signIn('credentials', {
        email, password, redirect: false,
      })
      if (res?.ok) {
        router.push('/')
      } else {
        setError('Invalid email or password.')
      }
    } catch {
      setError('Something went wrong. Try again.')
    }
    setLoading(false)
  }

  async function loginDemo() {
    setEmail('demo@binalyst.com')
    setPassword('demo1234')
    setLoading(true); setError('')
    const res = await signIn('credentials', {
      email: 'demo@binalyst.com', password: 'demo1234', redirect: false,
    })
    if (res?.ok) router.push('/')
    else setError('Demo login failed.')
    setLoading(false)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--bg)' }}
    >
      {/* Grid bg */}
      <div
        className="fixed inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: 'linear-gradient(var(--bg3) 1px, transparent 1px), linear-gradient(90deg, var(--bg3) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative w-full max-w-sm flex flex-col gap-6">
        {/* Logo */}
        <div className="text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-extrabold mx-auto mb-4 animate-float"
            style={{ background: 'var(--yellow)', color: '#000' }}
          >
            B
          </div>
          <h1 className="text-2xl font-extrabold" style={{ color: 'var(--text)' }}>
            Binalyst
          </h1>
          <p className="mono text-xs mt-1" style={{ color: 'var(--text3)' }}>
            AI-powered Binance assistant
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-6 flex flex-col gap-4"
          style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}
        >
          <div className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
            Sign in to your account
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
                Email
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required autoComplete="email"
                className="mono text-sm px-4 py-3 rounded-xl outline-none transition-all"
                style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)' }}
                onFocus={e => (e.target.style.borderColor = 'var(--yellow)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border2)')}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required autoComplete="current-password"
                  className="w-full mono text-sm px-4 py-3 pr-16 rounded-xl outline-none transition-all"
                  style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--yellow)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border2)')}
                />
                <button
                  type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 mono text-[10px]"
                  style={{ color: 'var(--text3)' }}
                >
                  {showPass ? 'hide' : 'show'}
                </button>
              </div>
            </div>

            {error && (
              <div
                className="mono text-xs p-3 rounded-lg"
                style={{ background: 'rgba(246,70,93,0.08)', border: '1px solid rgba(246,70,93,0.25)', color: 'var(--red)' }}
              >
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading || !email || !password}
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all mt-1"
              style={{
                background: email && password ? 'var(--yellow)' : 'var(--bg4)',
                color: email && password ? '#000' : 'var(--text3)',
                cursor: loading || !email || !password ? 'not-allowed' : 'pointer',
              }}
            >
              {loading && (
                <span className="w-4 h-4 rounded-full border-2 border-black/30 border-t-black animate-spin-slow" />
              )}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <span className="mono text-[10px]" style={{ color: 'var(--text3)' }}>or</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>

          <button
            onClick={loginDemo} disabled={loading}
            className="py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            Try Demo Account
          </button>
        </div>

        <p className="mono text-[10px] text-center" style={{ color: 'var(--text3)' }}>
          Demo: demo@binalyst.com / demo1234
        </p>
      </div>
    </div>
  )
}
