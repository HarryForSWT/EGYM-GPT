'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts'
import { Loader2, TrendingUp, Dumbbell, Calendar } from 'lucide-react'
import { useLang } from '@/lib/LanguageContext'
import { t } from '@/lib/i18n'

type Period = '7d' | '30d' | '90d' | '180d'

type SetRow = {
  exercise_id: string
  weight_kg: number
  round_number: number
  created_at: string
  workouts: { start_time: string; status: string } | null
}

type ExerciseStat = {
  id: string
  name: string
  data: { label: string; maxKg: number; date: string }[]
  pb: number
  last: number
  sessions: number
}

const PERIOD_LABELS: Record<Period, string> = {
  '7d':  'Woche',
  '30d': 'Monat',
  '90d': '3 Monate',
  '180d': '6 Monate',
}

function periodDays(p: Period) {
  return { '7d': 7, '30d': 30, '90d': 90, '180d': 180 }[p]
}

function formatLabel(dateStr: string, period: Period) {
  const d = new Date(dateStr)
  if (period === '7d') {
    return d.toLocaleDateString('de-DE', { weekday: 'short' })
  }
  if (period === '30d') {
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
  }
  return d.toLocaleDateString('de-DE', { month: 'short', day: '2-digit' })
}

export default function AnalysePage() {
  const supabase  = createClient()
  const { lang }  = useLang()
  const [period, setPeriod]   = useState<Period>('30d')
  const [stats, setStats]     = useState<ExerciseStat[]>([])
  const [loading, setLoading] = useState(true)
  const [activeEx, setActiveEx] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const since = new Date()
      since.setDate(since.getDate() - periodDays(period))

      // Alle Sets im Zeitraum holen (inkl. workout start_time über Join)
      const { data: rows } = await supabase
        .from('sets')
        .select(`
          exercise_id, weight_kg, round_number, created_at,
          workouts!inner(start_time, status)
        `)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: true }) as { data: SetRow[] | null }

      if (!rows || rows.length === 0) {
        setStats([])
        setLoading(false)
        return
      }

      // Übungs-Namen laden
      const exIds = [...new Set(rows.map(r => r.exercise_id))]
      const { data: exercises } = await supabase
        .from('exercises')
        .select('id, name')
        .in('id', exIds)

      const exMap: Record<string, string> = {}
      exercises?.forEach(e => { exMap[e.id] = e.name })

      // Pro Übung: nach Datum gruppieren, max(weight_kg) pro Tag
      const byEx: Record<string, Record<string, number[]>> = {}
      rows.forEach(r => {
        const startTime = r.workouts?.start_time
        if (!startTime) return
        const day = startTime.slice(0, 10) // YYYY-MM-DD
        if (!byEx[r.exercise_id]) byEx[r.exercise_id] = {}
        if (!byEx[r.exercise_id][day]) byEx[r.exercise_id][day] = []
        byEx[r.exercise_id][day].push(r.weight_kg)
      })

      const result: ExerciseStat[] = Object.entries(byEx).map(([exId, days]) => {
        const data = Object.entries(days)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([day, weights]) => ({
            label: formatLabel(day, period),
            maxKg: Math.max(...weights),
            date:  day,
          }))

        const allWeights = data.map(d => d.maxKg)
        const pb   = Math.max(...allWeights)
        const last = data[data.length - 1]?.maxKg ?? 0

        return {
          id: exId,
          name: exMap[exId] ?? exId,
          data,
          pb,
          last,
          sessions: data.length,
        }
      })
      // Sortieren nach Anzahl Einheiten (aktivste Übungen zuerst)
      result.sort((a, b) => b.sessions - a.sessions)
      setStats(result)
      if (result.length > 0 && !activeEx) setActiveEx(result[0].id)
      setLoading(false)
    }
    load()
  }, [period])

  const active = stats.find(s => s.id === activeEx) ?? stats[0] ?? null

  return (
    <div className="animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-header-title">{t(lang, 'analyseTitle')}</h1>
          <p className="text-secondary" style={{ fontSize: '0.85rem' }}>{t(lang, 'analyseSubtitle')}</p>
        </div>
        <TrendingUp size={22} className="text-accent" />
      </header>

      {/* Zeitraum-Toggle */}
      <div className="px-4 mb-4">
        <div style={{
          display: 'flex', gap: 6,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 4,
        }}>
          {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                flex: 1,
                padding: '7px 4px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: period === p ? 'var(--accent)' : 'transparent',
                color: period === p ? '#000' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.75rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: 'inherit',
              }}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex justify-center items-center mt-20">
          <Loader2 className="spin text-accent" size={28} />
        </div>
      )}

      {!loading && stats.length === 0 && (
        <div className="px-4">
          <div className="card text-center py-4">
            <Dumbbell size={32} className="text-muted" style={{ margin: '0 auto 12px' }} />
            <p className="text-muted mb-2">{t(lang, 'noData')}</p>
            <p className="text-secondary" style={{ fontSize: '0.85rem' }}>
              {t(lang, 'noDataHint')}
            </p>
          </div>
        </div>
      )}

      {!loading && stats.length > 0 && active && (
        <>
          {/* Übungs-Auswahl (horizontaler Scroll) */}
          <div style={{ overflowX: 'auto', paddingLeft: 16, paddingRight: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8, width: 'max-content' }}>
              {stats.map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveEx(s.id)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid',
                    borderColor: activeEx === s.id ? 'var(--accent)' : 'var(--border)',
                    background: activeEx === s.id ? 'var(--accent-dim)' : 'var(--bg-surface)',
                    color: activeEx === s.id ? 'var(--accent)' : 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s',
                  }}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          {/* Stat-Chips */}
          <div className="px-4 mb-4">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {[
                { label: t(lang, 'pbLabel'),    value: `${active.pb} kg`,              icon: '🏆' },
                { label: t(lang, 'lastLabel'),  value: `${active.last} kg`,            icon: '⚡' },
                { label: t(lang, 'unitsLabel'), value: active.sessions.toString(),     icon: '📅' },
              ].map(chip => (
                <div key={chip.label} className="card text-center" style={{ padding: '10px 8px' }}>
                  <div style={{ fontSize: '1.2rem', marginBottom: 4 }}>{chip.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{chip.value}</div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.3 }}>{chip.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Balkendiagramm */}
          <div className="px-4 mb-4">
            <div className="card" style={{ padding: '16px 8px 8px' }}>
              <p style={{ fontWeight: 600, fontSize: '0.9rem', paddingLeft: 8, marginBottom: 12 }}>
                {active.name} — {t(lang, 'maxPerSession')}
              </p>
              {active.data.length < 2 ? (
                <p className="text-muted text-sm text-center py-3">{t(lang, 'tooFewData')}</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={active.data} barCategoryGap="30%">
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      width={32}
                      unit=" kg"
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-primary)',
                        fontSize: '0.8rem',
                      }}
                      formatter={(v: number) => [`${v} kg`, 'Max']}
                      cursor={{ fill: 'var(--accent-dim)' }}
                    />
                    <Bar dataKey="maxKg" radius={[4, 4, 0, 0]}>
                      {active.data.map((entry, idx) => (
                        <Cell
                          key={idx}
                          fill={entry.maxKg === active.pb ? 'var(--warning)' : 'var(--accent)'}
                          fillOpacity={entry.maxKg === active.pb ? 1 : 0.75}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
              <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 4 }}>
                {t(lang, 'pbNote')}
              </p>
            </div>
          </div>

          {/* Alle Übungen – kompakte Übersicht */}
          <div className="px-4 mb-4">
            <p style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 10, color: 'var(--text-secondary)' }}>
              {t(lang, 'allExercises')}
            </p>
            {stats.map(s => {
              const trend = s.data.length >= 2
                ? s.data[s.data.length - 1].maxKg - s.data[0].maxKg
                : 0
              return (
                <div
                  key={s.id}
                  className="card mb-2"
                  style={{ padding: '12px 14px', cursor: 'pointer' }}
                  onClick={() => setActiveEx(s.id)}
                >
                  <div className="flex items-center justify-between">
                    <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{s.name}</span>
                    <span style={{
                      fontSize: '0.75rem', fontWeight: 700,
                      color: trend > 0 ? 'var(--success)' : trend < 0 ? 'var(--danger)' : 'var(--text-muted)',
                    }}>
                      {trend > 0 ? `+${trend.toFixed(1)}` : trend !== 0 ? trend.toFixed(1) : '±0'} kg
                    </span>
                  </div>
                  <div className="flex gap-3 mt-2">
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>PB: <strong style={{ color: 'var(--warning)' }}>{s.pb} kg</strong></span>
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>{t(lang, 'lastLabel')}: <strong style={{ color: 'var(--text-primary)' }}>{s.last} kg</strong></span>
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                      <Calendar size={10} style={{ display: 'inline', marginRight: 2 }} />
                      {s.sessions}×
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <style>{`
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
