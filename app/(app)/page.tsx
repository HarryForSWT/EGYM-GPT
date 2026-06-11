import Link from 'next/link'
import { Dumbbell, Calendar, ChevronRight } from 'lucide-react'

export default function Home() {
  return (
    <div className="animate-fade-in">
      <header className="page-header pb-4">
        <div>
          <h1 className="page-header-title">Willkommen zurück!</h1>
          <p className="text-secondary" style={{ fontSize: '0.85rem' }}>Bereit für dein nächstes Training?</p>
        </div>
      </header>

      <div className="px-4 flex flex-col gap-4">
        {/* Haupt-Call-To-Action für EGYM Training */}
        <Link href="/training" style={{ textDecoration: 'none' }}>
          <div className="card-elevated" style={{ background: 'linear-gradient(145deg, var(--bg-elevated) 0%, #00d4aa15 100%)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="badge badge-accent mb-2">EGYM Zirkel</div>
                <h2 style={{ fontSize: '1.2rem', marginBottom: 4 }}>Training starten</h2>
                <p className="text-secondary" style={{ fontSize: '0.85rem' }}>8 Geräte • 3 Runden</p>
              </div>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}>
                <Dumbbell size={20} />
              </div>
            </div>
          </div>
        </Link>

        {/* Link zum Klassischen Training */}
        <Link href="/classic" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1rem', marginBottom: 2 }}>Klassisches Training</h3>
              <p className="text-secondary" style={{ fontSize: '0.8rem' }}>Freie Gewichte</p>
            </div>
            <ChevronRight size={20} className="text-muted" />
          </div>
        </Link>

        {/* Minimalistischer Kalender-Ausblick */}
        <div className="mt-2">
          <h3 style={{ fontSize: '0.9rem', marginBottom: 12, marginLeft: 4 }}>Diese Woche</h3>
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
