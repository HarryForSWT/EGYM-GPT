'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut, User, Moon, Sun, ChevronRight, Edit2, Check, Loader2 } from 'lucide-react'
import { useLang } from '@/lib/LanguageContext'
import { t, LANG_LABELS, type Lang, setStoredLang } from '@/lib/i18n'

type Profile = {
  display_name: string
  first_name:   string
  last_name:    string
  nickname:     string
  language:     Lang
  weight_kg:    string
  egym_rounds:  string
  rest_timer_seconds: string
}

export default function ProfilPage() {
  const router   = useRouter()
  const supabase = createClient()

  const { lang, setLang }   = useLang()
  const [theme, setTheme]   = useState<'dark' | 'light'>('light')
  const [profile, setProfile] = useState<Profile>({
    display_name: '', first_name: '', last_name: '', nickname: '', language: 'de', weight_kg: '', egym_rounds: '3', rest_timer_seconds: '90',
  })
  const [loading, setLoading]   = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [draft, setDraft]       = useState<Profile>(profile)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)

  // Password reset states
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  useEffect(() => {
    const storedTheme = (localStorage.getItem('theme') as 'dark' | 'light') ?? 'light'
    setTheme(storedTheme)
    document.documentElement.setAttribute('data-theme', storedTheme)

    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('display_name, first_name, last_name, nickname, language, weight_kg, egym_rounds, rest_timer_seconds')
        .eq('id', user.id)
        .single()
      if (data) {
        const p: Profile = {
          display_name: data.display_name ?? '',
          first_name:   data.first_name   ?? '',
          last_name:    data.last_name    ?? '',
          nickname:     data.nickname     ?? '',
          language:     (data.language as Lang) ?? 'de',
          weight_kg:    data.weight_kg?.toString() ?? '',
          egym_rounds:  data.egym_rounds?.toString() ?? '3',
          rest_timer_seconds: data.rest_timer_seconds?.toString() ?? '90',
        }
        setProfile(p)
        setDraft(p)
        const activeLang = (localStorage.getItem('lang') as Lang) ?? p.language ?? 'de'
        setLang(activeLang)
      }
      setLoading(false)
    }
    loadProfile()
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  const changeLang = (l: Lang) => {
    setLang(l)
    setDraft(d => ({ ...d, language: l }))
  }

  const saveProfile = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const wVal = draft.weight_kg ? parseFloat(draft.weight_kg.replace(',', '.')) : null
    const rVal = draft.egym_rounds ? parseInt(draft.egym_rounds, 10) : 3
    const tVal = draft.rest_timer_seconds ? parseInt(draft.rest_timer_seconds, 10) : 90
    await supabase.from('profiles').upsert({
      id:           user.id,
      display_name: draft.nickname || draft.first_name || draft.display_name,
      first_name:   draft.first_name,
      last_name:    draft.last_name,
      nickname:     draft.nickname,
      language:     lang,
      weight_kg:    wVal,
      egym_rounds:  rVal,
      rest_timer_seconds: tVal,
    })
    setProfile({ ...draft, language: lang })
    setStoredLang(lang)
    setSaving(false)
    setSaved(true)
    setEditMode(false)
    setTimeout(() => setSaved(false), 2000)
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwSaving(true)
    setPwError('')
    setPwSuccess(false)

    if (newPassword !== confirmPassword) {
      setPwError(t(lang, 'passwordMismatch'))
      setPwSaving(false)
      return
    }

    if (newPassword.length < 6) {
      setPwError(lang === 'de' ? 'Das Passwort muss mindestens 6 Zeichen lang sein.' : lang === 'ru' ? 'Пароль должен состоять минимум из 6 символов.' : 'Password must be at least 6 characters long.')
      setPwSaving(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      setPwError(error.message)
    } else {
      setPwSuccess(true)
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPwSuccess(false), 3000)
    }
    setPwSaving(false)
  }

  const displayName = profile.nickname || profile.first_name || profile.display_name || '…'
  const fullName    = [profile.first_name, profile.last_name].filter(Boolean).join(' ')

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full mt-20">
        <Loader2 className="spin text-accent" size={28} />
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-header-title">
            {t(lang, 'hello')}, {displayName}!
          </h1>
          <p className="text-secondary" style={{ fontSize: '0.85rem' }}>
            {t(lang, 'settings')}
          </p>
        </div>
        <div style={{
          width: 46, height: 46, borderRadius: '50%',
          background: 'var(--accent-dim)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <User size={22} className="text-accent" />
        </div>
      </header>

      <div className="px-4">

        {/* ── Profildaten-Karte ─────────────────────────────── */}
        <div className="card mb-4">
          <div className="flex justify-between items-center mb-3">
            <h3 style={{ fontSize: '0.9rem' }}>{t(lang, 'profileData')}</h3>
            {!editMode && (
              <button className="btn btn-ghost btn-sm flex items-center gap-1" onClick={() => setEditMode(true)}>
                <Edit2 size={14} /> {t(lang, 'edit')}
              </button>
            )}
          </div>

          {editMode ? (
            <>
              {([
                { key: 'first_name', label: t(lang, 'firstName') },
                { key: 'last_name',  label: t(lang, 'lastName')  },
                { key: 'nickname',   label: t(lang, 'nickname')   },
              ] as { key: keyof Profile; label: string }[]).map(({ key, label }) => (
                <div className="input-group mb-3" key={key}>
                  <label className="input-label">{label}</label>
                  <input
                    type="text"
                    className="input-field"
                    value={draft[key] as string}
                    onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="input-group mb-3">
                <label className="input-label">{t(lang, 'bodyWeight')}</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.001"
                  className="input-field"
                  placeholder="z.B. 75.5"
                  value={draft.weight_kg}
                  onChange={e => setDraft(d => ({ ...d, weight_kg: e.target.value }))}
                />
              </div>
              <div className="input-group mb-3">
                <label className="input-label">{t(lang, 'egymRounds')}</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  className="input-field"
                  placeholder="z.B. 3"
                  value={draft.egym_rounds}
                  onChange={e => setDraft(d => ({ ...d, egym_rounds: e.target.value }))}
                />
              </div>
              <div className="input-group mb-3">
                <label className="input-label">{t(lang, 'restTimerConfig')}</label>
                <select
                  className="input-field"
                  value={draft.rest_timer_seconds}
                  onChange={e => setDraft(d => ({ ...d, rest_timer_seconds: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontFamily: 'inherit',
                  }}
                >
                  <option value="0">{t(lang, 'disabled')}</option>
                  <option value="60">60 {t(lang, 'seconds')}</option>
                  <option value="90">90 {t(lang, 'seconds')}</option>
                  <option value="120">120 {t(lang, 'seconds')}</option>
                  <option value="150">150 {t(lang, 'seconds')}</option>
                  <option value="180">180 {t(lang, 'seconds')}</option>
                </select>
              </div>
              <div className="flex gap-3 mt-2">
                <button className="btn btn-secondary flex-1" onClick={() => { setEditMode(false); setDraft(profile) }}>
                  {t(lang, 'cancel')}
                </button>
                <button className="btn btn-primary flex-1" onClick={saveProfile} disabled={saving}>
                  {saving ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
                  {saving ? t(lang, 'saving') : t(lang, 'save')}
                </button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { label: t(lang, 'firstName'), value: profile.first_name },
                { label: t(lang, 'lastName'),  value: profile.last_name  },
                { label: t(lang, 'nickname'),  value: profile.nickname   },
                { label: t(lang, 'bodyWeight'), value: profile.weight_kg ? `${profile.weight_kg} kg` : '—' },
                { label: t(lang, 'egymRounds'), value: profile.egym_rounds || '3' },
                { label: t(lang, 'restTimerConfig'), value: profile.rest_timer_seconds === '0' ? t(lang, 'disabled') : `${profile.rest_timer_seconds} ${t(lang, 'seconds')}` },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center"
                  style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <span className="text-secondary" style={{ fontSize: '0.82rem' }}>{row.label}</span>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{row.value || '—'}</span>
                </div>
              ))}
              {saved && (
                <p className="text-success text-sm mt-2" style={{ textAlign: 'center' }}>
                  {t(lang, 'saved')} ✓
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Passwort ändern-Karte ─────────────────────────── */}
        <div className="card mb-4 animate-fade-in">
          <h3 style={{ fontSize: '0.9rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            🔑 {t(lang, 'changePassword')}
          </h3>
          
          <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="input-group">
              <label className="input-label">{t(lang, 'newPassword')}</label>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
              />
            </div>
            
            <div className="input-group">
              <label className="input-label">{t(lang, 'newPasswordConfirm')}</label>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {pwError && <p style={{ color: 'var(--danger)', fontSize: '0.82rem', marginTop: 2 }}>{pwError}</p>}
            {pwSuccess && <p style={{ color: 'var(--success)', fontSize: '0.82rem', marginTop: 2 }}>{t(lang, 'passwordChangedSuccess')}</p>}

            <button 
              type="submit" 
              className="btn btn-secondary btn-sm btn-full mt-2"
              disabled={pwSaving || !newPassword || !confirmPassword}
            >
              {pwSaving ? <Loader2 size={14} className="spin" /> : null}
              {t(lang, 'changePassword')}
            </button>
          </form>
        </div>

        {/* ── Einstellungen ─────────────────────────────────── */}
        <h3 className="mb-2" style={{ fontSize: '0.9rem', marginLeft: 4, color: 'var(--text-secondary)' }}>
          {t(lang, 'settings')}
        </h3>
        <div className="card mb-4" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

          {/* Erscheinungsbild */}
          <div className="flex justify-between items-center"
            style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-3">
              {theme === 'dark' ? <Moon size={18} className="text-muted" /> : <Sun size={18} className="text-muted" />}
              <span style={{ fontSize: '0.9rem' }}>{t(lang, 'appearance')}</span>
            </div>
            <button onClick={toggleTheme} className="btn btn-secondary btn-sm">
              {theme === 'dark' ? t(lang, 'lightMode') : t(lang, 'darkMode')}
            </button>
          </div>

          {/* Sprache */}
          <div style={{ padding: '12px 0' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              {t(lang, 'language')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(Object.entries(LANG_LABELS) as [Lang, string][]).map(([code, label]) => (
                <button
                  key={code}
                  onClick={() => changeLang(code)}
                  className="flex justify-between items-center"
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: lang === code ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                    border: `1.5px solid ${lang === code ? 'var(--accent)' : 'transparent'}`,
                    color: lang === code ? 'var(--accent)' : 'var(--text-primary)',
                    fontWeight: lang === code ? 700 : 500,
                    fontSize: '0.9rem',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                >
                  <span>{label}</span>
                  {lang === code && <Check size={16} />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Abmelden */}
        <button
          onClick={handleLogout}
          className="btn btn-secondary btn-full flex justify-between items-center"
          style={{ color: 'var(--danger)', borderColor: '#ef444433' }}
        >
          <span>{t(lang, 'logout')}</span>
          <LogOut size={18} />
        </button>

      </div>

      <style>{`
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .flex-1 { flex: 1; }
      `}</style>
    </div>
  )
}
