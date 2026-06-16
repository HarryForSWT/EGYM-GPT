'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Dumbbell, Loader2 } from 'lucide-react'
import { useLang } from '@/lib/LanguageContext'
import { t, LANG_LABELS, type Lang } from '@/lib/i18n'

export default function RegisterPage() {
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [nickname,  setNickname]  = useState('')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const { lang, setLang }         = useLang()
  const router   = useRouter()
  const supabase = createClient()

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const displayName = nickname || firstName || email.split('@')[0]
    const { data, error: authError } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: displayName } },
    })
    if (authError) { setError(authError.message); setLoading(false); return }
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id, display_name: displayName,
        first_name: firstName, last_name: lastName,
        nickname, language: lang, role: 'user',
      })
    }
    router.push('/')
    router.refresh()
  }

  return (
    <div className="auth-page">
      {/* Sprachauswahl */}
      <div style={{ position: 'absolute', top: 'max(env(safe-area-inset-top, 20px), 60px)', right: 20, display: 'flex', gap: 6 }}>
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
          <h1 style={{ fontSize: '1.5rem' }}>{t(lang, 'newAccount')}</h1>
          <p className="text-secondary" style={{ fontSize: '0.85rem', marginTop: 4 }}>{t(lang, 'registerSubtitle')}</p>
        </div>
      </div>

      <form className="auth-form" onSubmit={handleRegister}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="input-group" style={{ flex: 1 }}>
            <label className="input-label" htmlFor="firstName">{t(lang, 'firstName')}</label>
            <input id="firstName" type="text" className="input-field" placeholder="Max"
              value={firstName} onChange={e => setFirstName(e.target.value)} required />
          </div>
          <div className="input-group" style={{ flex: 1 }}>
            <label className="input-label" htmlFor="lastName">{t(lang, 'lastName')}</label>
            <input id="lastName" type="text" className="input-field" placeholder="Mustermann"
              value={lastName} onChange={e => setLastName(e.target.value)} />
          </div>
        </div>
        <div className="input-group">
          <label className="input-label" htmlFor="nickname">{t(lang, 'nickname')}</label>
          <input id="nickname" type="text" className="input-field" placeholder="Harry"
            value={nickname} onChange={e => setNickname(e.target.value)} />
        </div>
        <div className="input-group">
          <label className="input-label" htmlFor="email">{t(lang, 'email')}</label>
          <input id="email" type="email" className="input-field" placeholder="name@beispiel.de"
            value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div className="input-group">
          <label className="input-label" htmlFor="password">{t(lang, 'password')}</label>
          <input id="password" type="password" className="input-field" placeholder="••••••••"
            value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
        </div>

        {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'center' }}>{error}</p>}

        <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
          {loading ? <Loader2 size={18} className="spin" /> : null}
          {loading ? t(lang, 'registering') : t(lang, 'registerBtn')}
        </button>

        <div className="divider">{t(lang, 'orDivider')}</div>

        <a href="/login" className="btn btn-secondary btn-full">{t(lang, 'backToLogin')}</a>
      </form>

      <style>{`.spin { animation: spin 0.8s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
