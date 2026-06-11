'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut, User, Moon, Sun } from 'lucide-react'

export default function ProfilPage() {
  const router = useRouter()
  const supabase = createClient()
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    // Lade Theme aus LocalStorage beim Start
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light'
    if (savedTheme) {
      setTheme(savedTheme)
      document.documentElement.setAttribute('data-theme', savedTheme)
    }
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-header-title">Profil</h1>
          <p className="text-secondary" style={{ fontSize: '0.85rem' }}>Deine Einstellungen</p>
        </div>
      </header>

      <div className="px-4">
        <div className="card mb-4 flex items-center gap-4">
          <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={24} className="text-accent" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.1rem' }}>Dein Konto</h2>
            <div className="text-secondary" style={{ fontSize: '0.85rem' }}>Eingeloggt</div>
          </div>
        </div>

        <h3 className="mb-2" style={{ fontSize: '0.9rem', marginLeft: 4 }}>Einstellungen</h3>
        <div className="card mb-4">
          <div className="flex justify-between items-center py-2">
            <div className="flex items-center gap-3">
              {theme === 'dark' ? <Moon size={20} className="text-muted" /> : <Sun size={20} className="text-muted" />}
              <span>Erscheinungsbild</span>
            </div>
            <button 
              onClick={toggleTheme}
              className="btn btn-secondary btn-sm"
            >
              {theme === 'dark' ? 'Hell-Modus' : 'Dunkel-Modus'}
            </button>
          </div>
        </div>

        <button 
          onClick={handleLogout}
          className="btn btn-secondary btn-full flex justify-between items-center"
          style={{ color: 'var(--danger)', borderColor: '#ef444433' }}
        >
          <span>Abmelden</span>
          <LogOut size={18} />
        </button>
      </div>
    </div>
  )
}
