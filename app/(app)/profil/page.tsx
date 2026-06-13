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
}

export default function ProfilPage() {
  const router   = useRouter()
  const supabase = createClient()

  const { lang, setLang }   = useLang()
  const [theme, setTheme]   = useState<'dark' | 'light'>('light')
  const [profile, setProfile] = useState<Profile>({
    display_name: '', first_name: '', last_name: '', nickname: '', language: 'de',
  })
  const [loading, setLoading]   = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [draft, setDraft]       = useState<Profile>(profile)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)

  useEffect(() => {
    const storedTheme = (localStorage.getItem('theme') as 'dark' | 'light') ?? 'light'
    setTheme(storedTheme)
    document.documentElement.setAttribute('data-theme', storedTheme)

    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('display_name, first_name, last_name, nickname, language')
        .eq('id', user.id)
        .single()
      if (data) {
        const p: Profile = {
          display_name: data.display_name ?? '',
          first_name:   data.first_name   ?? '',
          last_name:    data.last_name    ?? '',
          nickname:     data.nickname     ?? '',
          language:     (data.language as Lang) ?? 'de',
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
    await supabase.from('profiles').upsert({
      id:           user.id,
      display_name: draft.nickname || draft.first_name || draft.display_name,
      first_name:   draft.first_name,
      last_name:    draft.last_name,
      nickname:     draft.nickname,
      language:     lang,
    })
    setProfile({ ...draft, language: lang })
    setStoredLang(lang)
    setSaving(false)
    setSaved(true)
    setEditMode(false)
    setTimeout(() => setSaved(false), 2000)
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
