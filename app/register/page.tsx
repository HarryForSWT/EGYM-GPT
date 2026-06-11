'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Dumbbell, Loader2 } from 'lucide-react'

export default function RegisterPage() {
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const router  = useRouter()
  const supabase = createClient()

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    // 1. User registrieren
    const { data, error: authError } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        data: {
          display_name: name,
        }
      }
    })
    
    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    // 2. Profil in Datenbank anlegen (falls nicht schon per Trigger in Supabase passiert)
    // Bei Supabase macht man das oft über einen Auth Trigger, aber wir können es auch hier zur Sicherheit machen
    if (data.user) {
        const { error: dbError } = await supabase
            .from('profiles')
            .upsert({ id: data.user.id, display_name: name, role: 'user' })
            
        if(dbError) {
             console.error("Fehler beim Profil anlegen", dbError)
             // wir blockieren den Login hier aber nicht
        }
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div className="auth-page">
      <div className="auth-logo">
        <div className="auth-logo-icon">
          <Dumbbell size={32} color="#000" strokeWidth={2.5} />
        </div>
        <div className="text-center">
          <h1 style={{ fontSize: '1.5rem' }}>Neues Konto</h1>
          <p className="text-secondary" style={{ fontSize: '0.85rem', marginTop: 4 }}>
            Werde Teil des EGYM Trackers
          </p>
        </div>
      </div>

      <form className="auth-form" onSubmit={handleRegister} id="register-form">
        <div className="input-group">
          <label className="input-label" htmlFor="name">Name</label>
          <input
            id="name"
            type="text"
            className="input-field"
            placeholder="Dein Name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
        </div>

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
            placeholder="Mind. 6 Zeichen"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>

        {error && (
          <p style={{ color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'center' }}>
            {error}
          </p>
        )}

        <button
          id="btn-register"
          type="submit"
          className="btn btn-primary btn-full btn-lg"
          disabled={loading}
        >
          {loading ? <Loader2 size={18} className="spin" /> : null}
          {loading ? 'Konto wird erstellt…' : 'Konto erstellen'}
        </button>

        <div className="divider">oder</div>

        <a href="/login" className="btn btn-secondary btn-full" id="btn-to-login">
          Zurück zur Anmeldung
        </a>
      </form>

      <style>{`.spin { animation: spin 0.8s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
