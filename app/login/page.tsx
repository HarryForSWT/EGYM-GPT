'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Dumbbell, Loader2 } from 'lucide-react'
import { useLang } from '@/lib/LanguageContext'
import { t, LANG_LABELS, type Lang } from '@/lib/i18n'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const { lang, setLang }       = useLang()
  const router   = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(t(lang, 'wrongCredentials'))
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="auth-page">
      {/* Sprachauswahl */}
      <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', gap: 6 }}>
        {(Object.keys(LANG_LABELS) as Lang[]).map(l => (
          <button key={l} onClick={() => setLang(l)} style={{
            padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid',
            borderColor: lang === l ? 'var(--accent)' : 'var(--border)',
            background: lang === l ? 'var(--accent-dim)' : 'transparent',
            color: lang === l ? 'var(--accent)' : 'var(--text-muted)',
            fontWeight: 600, fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit',
            transition: 'all 0.15s',
          }}>
            {l.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="auth-logo">
        <div className="auth-logo-icon">
          <Dumbbell size={32} color="#000" strokeWidth={2.5} />
        </div>
        <div className="text-center">
          <h1 style={{ fontSize: '1.5rem' }}>EGYM Tracker</h1>
          <p className="text-secondary" style={{ fontSize: '0.85rem', marginTop: 4 }}>
            {t(lang, 'appSubtitle')}
          </p>
        </div>
      </div>

      <form className="auth-form" onSubmit={handleLogin}>
        <div className="input-group">
          <label className="input-label" htmlFor="email">{t(lang, 'email')}</label>
          <input id="email" type="email" className="input-field"
            placeholder="name@beispiel.de" value={email}
            onChange={e => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div className="input-group">
          <label className="input-label" htmlFor="password">{t(lang, 'password')}</label>
          <input id="password" type="password" className="input-field"
            placeholder="••••••••" value={password}
            onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
        </div>

        {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'center' }}>{error}</p>}

        <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
          {loading ? <Loader2 size={18} className="spin" /> : null}
          {loading ? t(lang, 'loggingIn') : t(lang, 'login')}
        </button>

        <a href="/forgot-password" style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--accent)', textDecoration: 'none' }}>
          {t(lang, 'forgotPassword')}
        </a>

        <div className="divider">{t(lang, 'orDivider')}</div>

        <a href="/register" className="btn btn-secondary btn-full">
          {t(lang, 'createAccount')}
        </a>
      </form>

      <style>{`.spin { animation: spin 0.8s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
