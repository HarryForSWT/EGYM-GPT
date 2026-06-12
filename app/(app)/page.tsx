'use client'

import Link from 'next/link'
import { Dumbbell, ChevronRight } from 'lucide-react'
import { useLang } from '@/lib/LanguageContext'
import { t } from '@/lib/i18n'

export default function Home() {
  const { lang } = useLang()

  return (
    <div className="animate-fade-in">
      <header className="page-header pb-4">
        <div>
          <h1 className="page-header-title">{t(lang, 'welcomeBack')}!</h1>
          <p className="text-secondary" style={{ fontSize: '0.85rem' }}>{t(lang, 'readyToTrain')}</p>
        </div>
      </header>

      <div className="px-4 flex flex-col gap-4">
        <Link href="/training" style={{ textDecoration: 'none' }}>
          <div className="card-elevated" style={{ background: 'linear-gradient(145deg, var(--bg-elevated) 0%, #00d4aa15 100%)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="badge badge-accent mb-2">{t(lang, 'egymCircuit')}</div>
                <h2 style={{ fontSize: '1.2rem', marginBottom: 4 }}>{t(lang, 'startTraining')}</h2>
                <p className="text-secondary" style={{ fontSize: '0.85rem' }}>{t(lang, 'devices3rounds')}</p>
              </div>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}>
                <Dumbbell size={20} />
              </div>
            </div>
          </div>
        </Link>

        <Link href="/classic" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1rem', marginBottom: 2 }}>{t(lang, 'classicTraining')}</h3>
              <p className="text-secondary" style={{ fontSize: '0.8rem' }}>{t(lang, 'freeWeights')}</p>
            </div>
            <ChevronRight size={20} className="text-muted" />
          </div>
        </Link>

        <div className="mt-2">
          <h3 style={{ fontSize: '0.9rem', marginBottom: 12, marginLeft: 4 }}>{t(lang, 'thisWeek')}</h3>
          <div className="card p-3">
            <div className="calendar-grid" style={{ gap: 8 }}>
              {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day, i) => (
                <div key={day} className="flex flex-col items-center gap-1">
                  <div className="cal-weekday" style={{ padding: 0 }}>{day}</div>
                  <div className={`cal-day ${i === 3 ? 'today' : ''} ${i === 1 ? 'has-workout' : ''}`} style={{ width: 32, height: 32 }}>
                    {i + 10}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
