'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dumbbell, Loader2, Check } from 'lucide-react'
import { useLang } from '@/lib/LanguageContext'
import { t, LANG_LABELS, type Lang } from '@/lib/i18n'

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('')
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const { lang, setLang }       = useLang()
  const supabase = createClient()

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(false)

    const redirectToUrl = `${window.location.origin}/reset-password`
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectToUrl,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
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
            {t(lang, 'forgotTitle')}
          </p>
        </div>
      </div>

      {success ? (
        <div className="auth-form text-center" style={{ gap: 16, display: 'flex', flexDirection: 'column' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%', background: 'var(--success-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto'
          }}>
            <Check size={24} className="text-success" />
          </div>
          <p style={{ fontSize: '0.92rem', lineHeight: '1.4' }}>
            {t(lang, 'checkEmail')}
          </p>
          <a href="/login" className="btn btn-primary btn-full mt-2">
            {t(lang, 'backToLogin')}
          </a>
        </div>
      ) : (
        <form className="auth-form" onSubmit={handleReset}>
          <p className="text-secondary text-center" style={{ fontSize: '0.88rem', marginBottom: 8 }}>
            {t(lang, 'forgotSubtitle')}
          </p>

          <div className="input-group">
            <label className="input-label" htmlFor="email">{t(lang, 'email')}</label>
            <input id="email" type="email" className="input-field"
              placeholder="name@beispiel.de" value={email}
              onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          </div>

          {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'center' }}>{error}</p>}

          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading ? <Loader2 size={18} className="spin" /> : null}
            {loading ? t(lang, 'sending') : t(lang, 'sendLink')}
          </button>

          <a href="/login" className="btn btn-secondary btn-full">
            {t(lang, 'backToLogin')}
          </a>
        </form>
      )}

      <style>{`.spin { animation: spin 0.8s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
