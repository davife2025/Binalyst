'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { signUp, resetPassword } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Mode = 'login' | 'signup' | 'reset'

export default function LoginPage() {
  const router = useRouter()
  const [mode,       setMode]       = useState<Mode>('login')
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [name,       setName]       = useState('')
  const [loading,    setLoading]    = useState(false)
  const [googleLoad, setGoogleLoad] = useState(false)
  const [error,      setError]      = useState('')
  const [success,    setSuccess]    = useState('')
  const [showPass,   setShowPass]   = useState(false)

  function reset() { setError(''); setSuccess('') }

  // ── Google — goes through NextAuth directly ───────────────────
  async function loginWithGoogle() {
    setGoogleLoad(true); reset()
    await signIn('google', { callbackUrl: '/' })
  }

  // ── Email/password ────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); reset()
    try {
      if (mode === 'reset') {
        const { error } = await resetPassword(email)
        if (error) setError(error.message)
        else setSuccess('Check your email for a reset link.')
        setLoading(false); return
      }
      if (mode === 'signup') {
        const { error } = await signUp(email, password, name)
        if (error) { setError(error.message); setLoading(false); return }
      }
      const res = await signIn('credentials', { email, password, redirect: false })
      if (res?.ok) router.push('/')
      else setError('Invalid email or password.')
    } catch { setError('Something went wrong.') }
    setLoading(false)
  }

  const LABELS: Record<Mode, string> = { login: 'Sign in', signup: 'Create account', reset: 'Reset password' }
  const inp   = { background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)' }
  const focus = (e: React.FocusEvent<HTMLInputElement>) => (e.target.style.borderColor = 'var(--yellow)')
  const blur  = (e: React.FocusEvent<HTMLInputElement>) => (e.target.style.borderColor = 'var(--border2)')

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <div className="fixed inset-0 pointer-events-none opacity-25"
        style={{ backgroundImage: 'linear-gradient(var(--bg3) 1px,transparent 1px),linear-gradient(90deg,var(--bg3) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />

      <div className="relative w-full max-w-sm flex flex-col gap-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-extrabold mx-auto mb-4 animate-float"
            style={{ background: 'var(--yellow)', color: '#000' }}>B</div>
          <h1 className="text-2xl font-extrabold" style={{ color: 'var(--text)' }}>Binalyst</h1>
          <p className="mono text-xs mt-1" style={{ color: 'var(--text3)' }}>AI-powered Binance assistant</p>
        </div>

        <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <div className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>{LABELS[mode]}</div>

          {mode !== 'reset' && (
            <>
              <button onClick={loginWithGoogle} disabled={googleLoad}
                className="flex items-center justify-center gap-3 py-3 rounded-xl text-sm font-semibold w-full transition-all"
                style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)', cursor: googleLoad ? 'not-allowed' : 'pointer', opacity: googleLoad ? 0.6 : 1 }}>
                {googleLoad ? (
                  <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin-slow" />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
                {googleLoad ? 'Redirecting...' : 'Continue with Google'}
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                <span className="mono text-[10px]" style={{ color: 'var(--text3)' }}>or</span>
                <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {mode === 'signup' && (
              <div className="flex flex-col gap-1.5">
                <label className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
                  className="mono text-sm px-4 py-3 rounded-xl outline-none" style={inp} onFocus={focus} onBlur={blur} />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required className="mono text-sm px-4 py-3 rounded-xl outline-none"
                style={inp} onFocus={focus} onBlur={blur} />
            </div>

            {mode !== 'reset' && (
              <div className="flex flex-col gap-1.5">
                <label className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>Password</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)} placeholder="••••••••" required
                    className="w-full mono text-sm px-4 py-3 pr-16 rounded-xl outline-none"
                    style={inp} onFocus={focus} onBlur={blur} />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 mono text-[10px]" style={{ color: 'var(--text3)' }}>
                    {showPass ? 'hide' : 'show'}
                  </button>
                </div>
                {mode === 'login' && (
                  <button type="button" onClick={() => { setMode('reset'); reset() }}
                    className="mono text-[10px] self-end" style={{ color: 'var(--text3)' }}>
                    Forgot password?
                  </button>
                )}
              </div>
            )}

            {error   && <div className="mono text-xs p-3 rounded-lg" style={{ background: 'rgba(246,70,93,0.08)', border: '1px solid rgba(246,70,93,0.25)', color: 'var(--red)' }}>{error}</div>}
            {success && <div className="mono text-xs p-3 rounded-lg" style={{ background: 'rgba(14,203,129,0.08)', border: '1px solid rgba(14,203,129,0.25)', color: 'var(--green)' }}>{success}</div>}

            <button type="submit" disabled={loading}
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold"
              style={{ background: 'var(--yellow)', color: '#000', opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading && <span className="w-4 h-4 rounded-full border-2 border-black/30 border-t-black animate-spin-slow" />}
              {loading ? 'Please wait...' : LABELS[mode]}
            </button>
          </form>

          <div className="flex items-center justify-center gap-3">
            {mode !== 'login'  && <button onClick={() => { setMode('login');  reset() }} className="mono text-xs" style={{ color: 'var(--text2)' }}>Sign in</button>}
            {mode !== 'login'  && mode !== 'signup' && <span style={{ color: 'var(--text3)' }}>·</span>}
            {mode !== 'signup' && <button onClick={() => { setMode('signup'); reset() }} className="mono text-xs" style={{ color: 'var(--text2)' }}>Create account</button>}
          </div>
        </div>

        <p className="mono text-[10px] text-center" style={{ color: 'var(--text3)' }}>
          Powered by Supabase + NextAuth
        </p>
      </div>
    </div>
  )
}