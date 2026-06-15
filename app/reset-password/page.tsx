'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Dumbbell, Loader2, Check } from 'lucide-react'
import { useLang } from '@/lib/LanguageContext'
import { t, LANG_LABELS, type Lang } from '@/lib/i18n'

export default function ResetPasswordPage() {
  const [password, setPassword]               = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError]                     = useState('')
  const [success, setSuccess]                 = useState(false)
  const [loading, setLoading]                 = useState(false)
  const [sessionLoading, setSessionLoading]   = useState(true)
  const [hasSession, setHasSession]           = useState(false)
  const { lang, setLang }                     = useLang()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function checkSession() {
      // Check current session
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setHasSession(true)
        setSessionLoading(false)
        return
      }

      // Check user object as fallback
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setHasSession(true)
      } else {
        setHasSession(false)
      }
      setSessionLoading(false)
    }

    checkSession()

    // Listen to changes (e.g. if Supabase handles hash fragment auto-login)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setHasSession(true)
      }
      setSessionLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (password !== confirmPassword) {
      setError(t(lang, 'passwordMismatch'))
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError(lang === 'de' ? 'Das Passwort muss mindestens 6 Zeichen lang sein.' : lang === 'ru' ? 'Пароль должен состоять минимум из 6 символов.' : 'Password must be at least 6 characters long.')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push('/')
        router.refresh()
      }, 2000)
    }
  }

  if (sessionLoading) {
    return (
      <div className="auth-page flex justify-center items-center h-full mt-20">
        <Loader2 className="spin text-accent" size={32} />
      </div>
    )
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
            {t(lang, 'resetPassword')}
          </p>
        </div>
      </div>

      {!hasSession ? (
        <div className="auth-form text-center" style={{ gap: 16, display: 'flex', flexDirection: 'column' }}>
          <p style={{ color: 'var(--danger)', fontSize: '0.92rem' }}>
            {lang === 'de' ? 'Der Link ist abgelaufen oder ungültig. Bitte fordere einen neuen Link an.' : lang === 'ru' ? 'Ссылка истекла или недействительна. Пожалуйста, запросите новую ссылку.' : 'The link is expired or invalid. Please request a new link.'}
          </p>
          <a href="/forgot-password" className="btn btn-primary btn-full mt-2">
            {t(lang, 'forgotTitle')}
          </a>
          <a href="/login" className="btn btn-secondary btn-full">
            {t(lang, 'backToLogin')}
          </a>
        </div>
      ) : success ? (
        <div className="auth-form text-center" style={{ gap: 16, display: 'flex', flexDirection: 'column' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%', background: 'var(--success-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto'
          }}>
            <Check size={24} className="text-success" />
          </div>
          <p style={{ fontSize: '0.92rem', lineHeight: '1.4' }}>
            {t(lang, 'passwordSaved')}
          </p>
        </div>
      ) : (
        <form className="auth-form" onSubmit={handleReset}>
          <div className="input-group">
            <label className="input-label" htmlFor="password">{t(lang, 'newPassword')}</label>
            <input id="password" type="password" className="input-field"
              placeholder="••••••••" value={password}
              onChange={e => setPassword(e.target.value)} required autoComplete="new-password" />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="confirmPassword">{t(lang, 'newPasswordConfirm')}</label>
            <input id="confirmPassword" type="password" className="input-field"
              placeholder="••••••••" value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)} required autoComplete="new-password" />
          </div>

          {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'center' }}>{error}</p>}

          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading ? <Loader2 size={18} className="spin" /> : null}
            {loading ? t(lang, 'savingPassword') : t(lang, 'savePassword')}
          </button>
        </form>
      )}

      <style>{`.spin { animation: spin 0.8s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } } .flex { display: flex; } .justify-center { justify-content: center; } .items-center { align-items: center; } .h-full { height: 100%; } .mt-20 { margin-top: 5rem; }`}</style>
    </div>
  )
}
