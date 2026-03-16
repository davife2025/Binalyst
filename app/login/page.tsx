'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { signUp, resetPassword } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Mode = 'login' | 'signup' | 'reset'

export default function LoginPage() {
  const router = useRouter()
  const [mode,     setMode]     = useState<Mode>('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')
  const [showPass, setShowPass] = useState(false)

  function reset() { setError(''); setSuccess('') }

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

  const inputStyle = { background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)' }
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

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {mode === 'signup' && (
              <div className="flex flex-col gap-1.5">
                <label className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
                  className="mono text-sm px-4 py-3 rounded-xl outline-none" style={inputStyle} onFocus={focus} onBlur={blur} />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required
                className="mono text-sm px-4 py-3 rounded-xl outline-none" style={inputStyle} onFocus={focus} onBlur={blur} />
            </div>

            {mode !== 'reset' && (
              <div className="flex flex-col gap-1.5">
                <label className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>Password</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" required className="w-full mono text-sm px-4 py-3 pr-16 rounded-xl outline-none"
                    style={inputStyle} onFocus={focus} onBlur={blur} />
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
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold mt-1"
              style={{ background: 'var(--yellow)', color: '#000', opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading && <span className="w-4 h-4 rounded-full border-2 border-black/30 border-t-black animate-spin-slow" />}
              {loading ? 'Please wait...' : LABELS[mode]}
            </button>
          </form>

          <div className="flex items-center justify-center gap-3">
            {mode !== 'login'   && <button onClick={() => { setMode('login');  reset() }} className="mono text-xs" style={{ color: 'var(--text2)' }}>Sign in</button>}
            {mode !== 'login'   && mode !== 'signup' && <span style={{ color: 'var(--text3)' }}>·</span>}
            {mode !== 'signup'  && <button onClick={() => { setMode('signup'); reset() }} className="mono text-xs" style={{ color: 'var(--text2)' }}>Create account</button>}
          </div>
        </div>

        <p className="mono text-[10px] text-center" style={{ color: 'var(--text3)' }}>
          Powered by Supabase · Your data is yours
        </p>
      </div>
    </div>
  )
}
