'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut, User, Moon, Sun, ChevronRight, ChevronLeft, Check, Loader2, Globe, Lock, Scale, Timer, Dumbbell } from 'lucide-react'
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

type ActiveView = 'main' | 'personalInfo' | 'weight' | 'egymRounds' | 'restTimer' | 'password' | 'language'

export default function ProfilPage() {
  const router   = useRouter()
  const supabase = createClient()

  const { lang, setLang }   = useLang()
  const [theme, setTheme]   = useState<'dark' | 'light'>('light')
  const [profile, setProfile] = useState<Profile>({
    display_name: '', first_name: '', last_name: '', nickname: '', language: 'de', weight_kg: '', egym_rounds: '3', rest_timer_seconds: '90',
  })
  const [loading, setLoading]   = useState(true)
  
  const [activeView, setActiveView] = useState<ActiveView>('main')
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

  const changeLang = async (l: Lang) => {
    setLang(l)
    setStoredLang(l)
    
    // Quick save to DB
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').upsert({
        id: user.id,
        language: l
      })
      setProfile(p => ({ ...p, language: l }))
    }
    
    setTimeout(() => setActiveView('main'), 300)
  }

  const handleBack = () => {
    setActiveView('main')
    setDraft(profile)
    setSaved(false)
    setPwError('')
    setPwSuccess(false)
    setNewPassword('')
    setConfirmPassword('')
  }

  const saveProfile = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const wVal = draft.weight_kg ? parseFloat(draft.weight_kg) : null
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
    setSaving(false)
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      handleBack()
    }, 800)
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
      setTimeout(() => {
        setPwSuccess(false)
        handleBack()
      }, 1500)
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

  const SubViewHeader = ({ title }: { title: string }) => (
    <div className="subview-header animate-slide-down">
      <button className="subview-back-btn" onClick={handleBack}>
        <ChevronLeft size={20} />
        {t(lang, 'back' as any) || 'Zurück'}
      </button>
      <h2 className="subview-title">{title}</h2>
    </div>
  )

  const renderMainView = () => (
    <div className="animate-fade-in px-4">
      <header className="page-header px-0" style={{ padding: '40px 0 16px' }}>
        <div>
          <h1 className="page-header-title">
            {t(lang, 'hello')}, {displayName}!
          </h1>
        </div>
        <div style={{
          width: 46, height: 46, borderRadius: '50%',
          background: 'var(--accent-dim)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <User size={22} className="text-accent" />
        </div>
      </header>

      <div className="settings-group-title">{t(lang, 'profileData')}</div>
      <div className="settings-group">
        <button className="settings-row" onClick={() => setActiveView('personalInfo')}>
          <div className="settings-row-content">
            <div className="settings-row-icon" style={{ background: '#8b5cf622', color: '#8b5cf6' }}>
              <User size={16} />
            </div>
            <span className="settings-row-label">{t(lang, 'name')} / {t(lang, 'nickname')}</span>
          </div>
          <div className="settings-row-right">
            <span className="settings-row-value">{displayName}</span>
            <ChevronRight size={18} className="settings-row-chevron" />
          </div>
        </button>

        <button className="settings-row" onClick={() => setActiveView('weight')}>
          <div className="settings-row-content">
            <div className="settings-row-icon" style={{ background: '#ec489922', color: '#ec4899' }}>
              <Scale size={16} />
            </div>
            <span className="settings-row-label">{t(lang, 'bodyWeight')}</span>
          </div>
          <div className="settings-row-right">
            <span className="settings-row-value">{profile.weight_kg ? `${profile.weight_kg} kg` : '—'}</span>
            <ChevronRight size={18} className="settings-row-chevron" />
          </div>
        </button>

        <button className="settings-row" onClick={() => setActiveView('egymRounds')}>
          <div className="settings-row-content">
            <div className="settings-row-icon" style={{ background: '#10b98122', color: '#10b981' }}>
              <Dumbbell size={16} />
            </div>
            <span className="settings-row-label">{t(lang, 'egymRounds')}</span>
          </div>
          <div className="settings-row-right">
            <span className="settings-row-value">{profile.egym_rounds || '3'}</span>
            <ChevronRight size={18} className="settings-row-chevron" />
          </div>
        </button>

        <button className="settings-row" onClick={() => setActiveView('restTimer')}>
          <div className="settings-row-content">
            <div className="settings-row-icon" style={{ background: '#f59e0b22', color: '#f59e0b' }}>
              <Timer size={16} />
            </div>
            <span className="settings-row-label">{t(lang, 'restTimerConfig')}</span>
          </div>
          <div className="settings-row-right">
            <span className="settings-row-value">
              {profile.rest_timer_seconds === '0' ? t(lang, 'disabled') : `${profile.rest_timer_seconds} ${t(lang, 'seconds')}`}
            </span>
            <ChevronRight size={18} className="settings-row-chevron" />
          </div>
        </button>
      </div>

      <div className="settings-group-title">Account</div>
      <div className="settings-group">
        <button className="settings-row" onClick={() => setActiveView('password')}>
          <div className="settings-row-content">
            <div className="settings-row-icon" style={{ background: '#ef444422', color: 'var(--danger)' }}>
              <Lock size={16} />
            </div>
            <span className="settings-row-label">{t(lang, 'changePassword')}</span>
          </div>
          <div className="settings-row-right">
            <ChevronRight size={18} className="settings-row-chevron" />
          </div>
        </button>
      </div>

      <div className="settings-group-title">{t(lang, 'settings')}</div>
      <div className="settings-group">
        <button className="settings-row" onClick={() => setActiveView('language')}>
          <div className="settings-row-content">
            <div className="settings-row-icon" style={{ background: '#3b82f622', color: '#3b82f6' }}>
              <Globe size={16} />
            </div>
            <span className="settings-row-label">{t(lang, 'language')}</span>
          </div>
          <div className="settings-row-right">
            <span className="settings-row-value">{LANG_LABELS[lang]}</span>
            <ChevronRight size={18} className="settings-row-chevron" />
          </div>
        </button>

        <div className="settings-row" onClick={toggleTheme}>
          <div className="settings-row-content">
            <div className="settings-row-icon" style={{ background: 'var(--text-muted)' }}>
              {theme === 'dark' ? <Moon size={16} color="var(--bg-base)" /> : <Sun size={16} color="var(--bg-base)" />}
            </div>
            <span className="settings-row-label">{t(lang, 'appearance')}</span>
          </div>
          <div className="settings-row-right">
            <span className="settings-row-value">{theme === 'dark' ? t(lang, 'darkMode') : t(lang, 'lightMode')}</span>
          </div>
        </div>
      </div>

      <button
        onClick={handleLogout}
        className="btn btn-secondary btn-full flex justify-between items-center mb-6"
        style={{ color: 'var(--danger)', borderColor: '#ef444433', background: 'var(--bg-surface)' }}
      >
        <span>{t(lang, 'logout')}</span>
        <LogOut size={18} />
      </button>
    </div>
  )

  const renderPersonalInfo = () => (
    <div className="animate-slide-down">
      <SubViewHeader title={t(lang, 'profileData')} />
      <div className="px-4 mt-4">
        <div className="card">
          <div className="input-group mb-4">
            <label className="input-label">{t(lang, 'firstName')}</label>
            <input
              type="text"
              className="input-field"
              value={draft.first_name}
              onChange={e => setDraft(d => ({ ...d, first_name: e.target.value }))}
            />
          </div>
          <div className="input-group mb-4">
            <label className="input-label">{t(lang, 'lastName')}</label>
            <input
              type="text"
              className="input-field"
              value={draft.last_name}
              onChange={e => setDraft(d => ({ ...d, last_name: e.target.value }))}
            />
          </div>
          <div className="input-group mb-4">
            <label className="input-label">{t(lang, 'nickname')}</label>
            <input
              type="text"
              className="input-field"
              value={draft.nickname}
              onChange={e => setDraft(d => ({ ...d, nickname: e.target.value }))}
            />
          </div>
          <button className="btn btn-primary btn-full" onClick={saveProfile} disabled={saving}>
            {saving ? <Loader2 size={16} className="spin" /> : (saved ? <Check size={16} /> : null)}
            {saving ? t(lang, 'saving') : (saved ? t(lang, 'saved') : t(lang, 'save'))}
          </button>
        </div>
      </div>
    </div>
  )

  const renderWeight = () => (
    <div className="animate-slide-down">
      <SubViewHeader title={t(lang, 'bodyWeight')} />
      <div className="px-4 mt-4">
        <div className="card">
          <div className="input-group mb-4">
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
          <button className="btn btn-primary btn-full" onClick={saveProfile} disabled={saving}>
            {saving ? <Loader2 size={16} className="spin" /> : (saved ? <Check size={16} /> : null)}
            {saving ? t(lang, 'saving') : (saved ? t(lang, 'saved') : t(lang, 'save'))}
          </button>
        </div>
      </div>
    </div>
  )

  const renderEgymRounds = () => (
    <div className="animate-slide-down">
      <SubViewHeader title={t(lang, 'egymRounds')} />
      <div className="px-4 mt-4">
        <div className="card">
          <div className="input-group mb-4">
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
          <button className="btn btn-primary btn-full" onClick={saveProfile} disabled={saving}>
            {saving ? <Loader2 size={16} className="spin" /> : (saved ? <Check size={16} /> : null)}
            {saving ? t(lang, 'saving') : (saved ? t(lang, 'saved') : t(lang, 'save'))}
          </button>
        </div>
      </div>
    </div>
  )

  const renderRestTimer = () => (
    <div className="animate-slide-down">
      <SubViewHeader title={t(lang, 'restTimerConfig')} />
      <div className="px-4 mt-4">
        <div className="card">
          <div className="input-group mb-4">
            <label className="input-label">{t(lang, 'restTimerConfig')}</label>
            <select
              className="input-field"
              value={draft.rest_timer_seconds}
              onChange={e => setDraft(d => ({ ...d, rest_timer_seconds: e.target.value }))}
            >
              <option value="0">{t(lang, 'disabled')}</option>
              <option value="60">60 {t(lang, 'seconds')}</option>
              <option value="90">90 {t(lang, 'seconds')}</option>
              <option value="120">120 {t(lang, 'seconds')}</option>
              <option value="150">150 {t(lang, 'seconds')}</option>
              <option value="180">180 {t(lang, 'seconds')}</option>
            </select>
          </div>
          <button className="btn btn-primary btn-full" onClick={saveProfile} disabled={saving}>
            {saving ? <Loader2 size={16} className="spin" /> : (saved ? <Check size={16} /> : null)}
            {saving ? t(lang, 'saving') : (saved ? t(lang, 'saved') : t(lang, 'save'))}
          </button>
        </div>
      </div>
    </div>
  )

  const renderPassword = () => (
    <div className="animate-slide-down">
      <SubViewHeader title={t(lang, 'changePassword')} />
      <div className="px-4 mt-4">
        <div className="card">
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
              className="btn btn-primary btn-full mt-2"
              disabled={pwSaving || !newPassword || !confirmPassword}
            >
              {pwSaving ? <Loader2 size={16} className="spin" /> : null}
              {t(lang, 'changePassword')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )

  const renderLanguage = () => (
    <div className="animate-slide-down">
      <SubViewHeader title={t(lang, 'language')} />
      <div className="px-4 mt-4">
        <div className="settings-group">
          {(Object.entries(LANG_LABELS) as [Lang, string][]).map(([code, label]) => (
            <button
              key={code}
              onClick={() => changeLang(code)}
              className="settings-row"
              style={{ background: lang === code ? 'var(--accent-dim)' : 'transparent' }}
            >
              <div className="settings-row-content">
                <span className="settings-row-label" style={{ color: lang === code ? 'var(--accent)' : 'inherit', fontWeight: lang === code ? 700 : 500 }}>
                  {label}
                </span>
              </div>
              <div className="settings-row-right">
                {lang === code && <Check size={18} className="text-accent" />}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className="pb-8">
      {activeView === 'main' && renderMainView()}
      {activeView === 'personalInfo' && renderPersonalInfo()}
      {activeView === 'weight' && renderWeight()}
      {activeView === 'egymRounds' && renderEgymRounds()}
      {activeView === 'restTimer' && renderRestTimer()}
      {activeView === 'password' && renderPassword()}
      {activeView === 'language' && renderLanguage()}

      <style>{`
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
