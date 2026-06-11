'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Dumbbell, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const router  = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    
    if (error) {
      setError('E-Mail oder Passwort falsch.')
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-logo">
        <div className="auth-logo-icon">
          <Dumbbell size={32} color="#000" strokeWidth={2.5} />
        </div>
        <div className="text-center">
          <h1 style={{ fontSize: '1.5rem' }}>EGYM Tracker</h1>
          <p className="text-secondary" style={{ fontSize: '0.85rem', marginTop: 4 }}>
            Dein persönlicher Trainingsbegleiter
          </p>
        </div>
      </div>

      <form className="auth-form" onSubmit={handleLogin} id="login-form">
        <div className="input-group">
          <label className="input-label" htmlFor="email">E-Mail</label>
          <input
            id="email"
            type="email"
            className="input-field"
            placeholder="name@beispiel.de"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="input-group">
          <label className="input-label" htmlFor="password">Passwort</label>
          <input
            id="password"
            type="password"
            className="input-field"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        {error && (
          <p style={{ color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'center' }}>
            {error}
          </p>
        )}

        <button
          id="btn-login"
          type="submit"
          className="btn btn-primary btn-full btn-lg"
          disabled={loading}
        >
          {loading ? <Loader2 size={18} className="spin" /> : null}
          {loading ? 'Anmelden…' : 'Anmelden'}
        </button>

        <div className="divider">oder</div>

        <a href="/register" className="btn btn-secondary btn-full" id="btn-to-register">
          Konto erstellen
        </a>
      </form>

      <style>{`.spin { animation: spin 0.8s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
