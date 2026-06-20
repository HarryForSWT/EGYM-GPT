'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import { Loader2, TrendingUp, Dumbbell, Calendar } from 'lucide-react'
import { useLang } from '@/lib/LanguageContext'
import { t } from '@/lib/i18n'
import { getGermanDateString } from '@/lib/dateUtils'

type Period = '7d' | '30d' | '90d' | '180d'

type SetRow = {
  exercise_id: string
  weight_kg: number
  reps: number
  round_number: number
  created_at: string
  workouts: { start_time: string; status: string } | null
}

type MaxLiftRow = {
  exercise_id: string
  weight_kg: number
  updated_at: string
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
  const [trainingStats, setTrainingStats] = useState<ExerciseStat[]>([])
  const [maxKraftStats, setMaxKraftStats] = useState<ExerciseStat[]>([])
  const [volumeStats, setVolumeStats] = useState<ExerciseStat[]>([])
  const [distributionData, setDistributionData] = useState<{ name: string; value: number }[]>([])
  const [cardioDistributionData, setCardioDistributionData] = useState<{ name: string; value: number }[]>([])
  const [chartMode, setChartMode] = useState<'training' | 'maxKraft' | 'volume'>('training')
  const [loading, setLoading] = useState(true)
  const [activeEx, setActiveEx] = useState<string | null>(null)

  const DONUT_COLORS = ['var(--accent)', '#3b82f6', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444']

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const since = new Date()
      since.setDate(since.getDate() - periodDays(period))

      // 1. Alle Sets im Zeitraum holen (inkl. workout start_time über Join)
      const { data: rows } = await supabase
        .from('sets')
        .select(`
          exercise_id, weight_kg, reps, round_number, created_at,
          workouts!inner(start_time, status)
        `)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: true }) as { data: SetRow[] | null }

      // 2. Alle Max Kraft Tests im Zeitraum holen
      const { data: mlRows } = await supabase
        .from('max_lifts')
        .select('exercise_id, weight_kg, updated_at')
        .eq('user_id', user.id)
        .gte('updated_at', since.toISOString())
        .order('updated_at', { ascending: true }) as { data: MaxLiftRow[] | null }

      // Übungs-Namen laden (für alle Übungen in beiden Datensätzen)
      const setExIds = rows?.map(r => r.exercise_id) ?? []
      const mlExIds = mlRows?.map(r => r.exercise_id) ?? []
      const exIds = [...new Set([...setExIds, ...mlExIds])]

      if (exIds.length === 0) {
        setTrainingStats([])
        setMaxKraftStats([])
        setLoading(false)
        return
      }

      const { data: exercises } = await supabase
        .from('exercises')
        .select('id, name, muscle_group, type')
        .in('id', exIds)

      const exMap: Record<string, string> = {}
      const exMuscleMap: Record<string, string> = {}
      const exTypeMap: Record<string, string> = {}
      exercises?.forEach(e => {
        exMap[e.id] = e.name
        exMuscleMap[e.id] = e.muscle_group ?? ''
        exTypeMap[e.id] = e.type ?? 'classic'
      })

      // Pro Übung: nach Datum gruppieren, max(weight_kg) pro Tag für Trainingsgewicht
      const byExTraining: Record<string, Record<string, number[]>> = {}
      rows?.forEach(r => {
        const startTime = r.workouts?.start_time
        if (!startTime) return
        const day = getGermanDateString(startTime) // YYYY-MM-DD in Germany
        if (!byExTraining[r.exercise_id]) byExTraining[r.exercise_id] = {}
        if (!byExTraining[r.exercise_id][day]) byExTraining[r.exercise_id][day] = []
        byExTraining[r.exercise_id][day].push(r.weight_kg)
      })

      const trainingResult: ExerciseStat[] = Object.entries(byExTraining)
        .filter(([exId]) => exTypeMap[exId] !== 'cardio')
        .map(([exId, days]) => {
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
      trainingResult.sort((a, b) => b.sessions - a.sessions)

      // Pro Übung: nach Datum gruppieren, max(weight_kg) pro Tag für Maximalkraft
      const byExMaxKraft: Record<string, Record<string, number[]>> = {}
      mlRows?.forEach(r => {
        const day = getGermanDateString(r.updated_at) // YYYY-MM-DD in Germany
        if (!byExMaxKraft[r.exercise_id]) byExMaxKraft[r.exercise_id] = {}
        if (!byExMaxKraft[r.exercise_id][day]) byExMaxKraft[r.exercise_id][day] = []
        byExMaxKraft[r.exercise_id][day].push(r.weight_kg)
      })

      const maxKraftResult: ExerciseStat[] = Object.entries(byExMaxKraft)
        .filter(([exId]) => exTypeMap[exId] !== 'cardio')
        .map(([exId, days]) => {
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
      maxKraftResult.sort((a, b) => b.sessions - a.sessions)

      setTrainingStats(trainingResult)
      setMaxKraftStats(maxKraftResult)

      // Pro Übung: nach Datum gruppieren, sum(weight_kg * reps) pro Tag für Gesamtvolumen
      const byExVolume: Record<string, Record<string, number>> = {}
      rows?.forEach(r => {
        const startTime = r.workouts?.start_time
        if (!startTime) return
        const day = getGermanDateString(startTime) // YYYY-MM-DD in Germany
        if (!byExVolume[r.exercise_id]) byExVolume[r.exercise_id] = {}
        if (!byExVolume[r.exercise_id][day]) byExVolume[r.exercise_id][day] = 0
        byExVolume[r.exercise_id][day] += (r.weight_kg * (r.reps || 0))
      })

      const volumeResult: ExerciseStat[] = Object.entries(byExVolume)
        .filter(([exId]) => exTypeMap[exId] !== 'cardio')
        .map(([exId, days]) => {
          const data = Object.entries(days)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([day, vol]) => ({
              label: formatLabel(day, period),
              maxKg: Math.round(vol),
              date:  day,
            }))

          const allVols = data.map(d => d.maxKg)
          const pb   = Math.max(...allVols)
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
      volumeResult.sort((a, b) => b.sessions - a.sessions)
      setVolumeStats(volumeResult)

      // Muskelgruppen-Verteilung (nur für Krafttraining)
      const muscleCounts: Record<string, number> = {}
      rows?.forEach(r => {
        const type = exTypeMap[r.exercise_id]
        if (type === 'cardio') return
        const mg = exMuscleMap[r.exercise_id]
        if (!mg) return
        muscleCounts[mg] = (muscleCounts[mg] || 0) + 1
      })

      // Cardio-Verteilung (nur für Cardio)
      const cardioCounts: Record<string, number> = {}
      rows?.forEach(r => {
        const type = exTypeMap[r.exercise_id]
        if (type !== 'cardio') return
        const name = exMap[r.exercise_id] || r.exercise_id
        cardioCounts[name] = (cardioCounts[name] || 0) + 1
      })

      const cardioDist = Object.entries(cardioCounts).map(([name, value]) => ({
        name,
        value
      })).sort((a, b) => b.value - a.value)
      setCardioDistributionData(cardioDist)

      const translateMuscleGroup = (mg: string) => {
        switch (mg.toLowerCase()) {
          case 'rücken': return t(lang, 'muscleBack')
          case 'schulter': return t(lang, 'muscleShoulders')
          case 'bizeps': return t(lang, 'muscleBiceps')
          case 'trizeps': return t(lang, 'muscleTriceps')
          case 'brust': return t(lang, 'muscleChest')
          case 'bauch': return t(lang, 'muscleAbs')
          case 'beine': return t(lang, 'muscleLegs')
          case 'waden': return t(lang, 'muscleCalves')
          case 'ausdauer': return t(lang, 'muscleCardio')
          default: return mg
        }
      }

      const dist = Object.entries(muscleCounts).map(([name, value]) => ({
        name: translateMuscleGroup(name),
        value
      })).sort((a, b) => b.value - a.value)
      setDistributionData(dist)

      if (trainingResult.length > 0 || maxKraftResult.length > 0 || volumeResult.length > 0) {
        const allLoadedIds = [...new Set([
          ...trainingResult.map(r => r.id),
          ...maxKraftResult.map(r => r.id),
          ...volumeResult.map(r => r.id)
        ])]
        if (!activeEx || !allLoadedIds.includes(activeEx)) {
          setActiveEx(trainingResult[0]?.id ?? maxKraftResult[0]?.id ?? volumeResult[0]?.id ?? null)
        }
      }
      setLoading(false)
    }
    load()
  }, [period])

  const stats = chartMode === 'training' ? trainingStats : chartMode === 'maxKraft' ? maxKraftStats : volumeStats
  const active = stats.find(s => s.id === activeEx) ?? stats[0] ?? null
  const unitLabel = chartMode === 'volume' ? ' kg Vol.' : ' kg'

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
      <div className="px-4 mb-3">
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

      {/* Analyse-Modus-Toggle */}
      <div className="px-4 mb-4">
        <div style={{
          display: 'flex', gap: 6,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 4,
        }}>
          <button
            onClick={() => setChartMode('training')}
            style={{
              flex: 1,
              padding: '7px 4px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: chartMode === 'training' ? 'var(--accent)' : 'transparent',
              color: chartMode === 'training' ? '#000' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: 'inherit',
            }}
          >
            {t(lang, 'trainingWeightTab')}
          </button>
          <button
            onClick={() => setChartMode('maxKraft')}
            style={{
              flex: 1,
              padding: '7px 4px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: chartMode === 'maxKraft' ? 'var(--accent)' : 'transparent',
              color: chartMode === 'maxKraft' ? '#000' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: 'inherit',
            }}
          >
            {t(lang, 'maxKraftTab')}
          </button>
          <button
            onClick={() => setChartMode('volume')}
            style={{
              flex: 1,
              padding: '7px 4px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: chartMode === 'volume' ? 'var(--accent)' : 'transparent',
              color: chartMode === 'volume' ? '#000' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: 'inherit',
            }}
          >
            {t(lang, 'volumeTab')}
          </button>
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
                { label: t(lang, 'pbLabel'),    value: `${active.pb}${unitLabel}`,              icon: '🏆' },
                { label: t(lang, 'lastLabel'),  value: `${active.last}${unitLabel}`,            icon: '⚡' },
                { label: chartMode === 'training' ? t(lang, 'unitsLabel') : (lang === 'de' ? 'Tests' : lang === 'ru' ? 'Тесты' : 'Tests'), value: active.sessions.toString(),     icon: '📅' },
              ].map(chip => (
                <div key={chip.label} className="card text-center" style={{ padding: '10px 8px' }}>
                  <div style={{ fontSize: '1.2rem', marginBottom: 4 }}>{chip.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{chip.value}</div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.3 }}>{chip.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Kurvendiagramm */}
          <div className="px-4 mb-4">
            <div className="card" style={{ padding: '16px 8px 8px' }}>
              <p style={{ fontWeight: 600, fontSize: '0.9rem', paddingLeft: 8, marginBottom: 12 }}>
                {active.name} — {chartMode === 'training' ? t(lang, 'maxPerSession') : chartMode === 'maxKraft' ? t(lang, 'maxKraftHistory') : t(lang, 'volumePerSession')}
              </p>
              {active.data.length < 2 ? (
                <p className="text-muted text-sm text-center py-3">{t(lang, 'tooFewData')}</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={active.data}>
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
                      width={40}
                      unit={unitLabel}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-primary)',
                        fontSize: '0.8rem',
                      }}
                      formatter={(v: any) => [`${v}${unitLabel}`, chartMode === 'volume' ? t(lang, 'volumeTab') : 'Max']}
                      cursor={{ stroke: 'var(--border)', strokeWidth: 1, strokeDasharray: '3 3' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="maxKg"
                      stroke="var(--accent)"
                      strokeWidth={3}
                      dot={(dotProps: any) => {
                        const { cx, cy, payload, index } = dotProps;
                        if (cx == null || cy == null) return null;
                        const isPb = payload.maxKg === active.pb;
                        return (
                          <circle
                            key={index}
                            cx={cx}
                            cy={cy}
                            r={isPb ? 5 : 3.5}
                            fill={isPb ? 'var(--warning)' : 'var(--bg-surface)'}
                            stroke={isPb ? 'var(--warning)' : 'var(--accent)'}
                            strokeWidth={2}
                          />
                        );
                      }}
                      activeDot={{ r: 6, strokeWidth: 0, fill: 'var(--accent)' }}
                    />
                  </LineChart>
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
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>PB: <strong style={{ color: 'var(--warning)' }}>{s.pb}{unitLabel}</strong></span>
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>{t(lang, 'lastLabel')}: <strong style={{ color: 'var(--text-primary)' }}>{s.last}{unitLabel}</strong></span>
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                      <Calendar size={10} style={{ display: 'inline', marginRight: 2 }} />
                      {s.sessions}×
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Donut Chart - Muscle Group Distribution */}
          {distributionData.length > 0 && (
            <div className="px-4 mb-6 animate-fade-in">
              <div className="card" style={{ padding: '16px' }}>
                <p style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: 16, color: 'var(--text-secondary)' }}>
                  📊 {t(lang, 'muscleGroupDistribution')}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 16 }}>
                  <div style={{ width: '130px', height: '130px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={distributionData}
                          cx="50%"
                          cy="50%"
                          innerRadius={38}
                          outerRadius={58}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {distributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--text-primary)',
                            fontSize: '0.75rem',
                          }}
                          formatter={(v: any) => [`${v} ${v === 1 ? t(lang, 'setWord') : t(lang, 'setsWord')}`, '']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: '130px' }}>
                    {distributionData.map((entry, index) => {
                      const totalSets = distributionData.reduce((sum, d) => sum + d.value, 0)
                      const pct = Math.round((entry.value / totalSets) * 100)
                      return (
                        <div key={entry.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: DONUT_COLORS[index % DONUT_COLORS.length] }} />
                            <span style={{ fontWeight: 500 }}>{entry.name}</span>
                          </div>
                          <span className="text-muted" style={{ fontWeight: 600 }}>{pct}%</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Donut Chart - Cardio Exercise Distribution */}
          {cardioDistributionData.length > 0 && (
            <div className="px-4 mb-6 animate-fade-in">
              <div className="card" style={{ padding: '16px' }}>
                <p style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: 16, color: 'var(--text-secondary)' }}>
                  🏃‍♂️ {lang === 'de' ? 'Ausdauer-Verteilung' : lang === 'ru' ? 'Распределение кардио' : 'Cardio Distribution'}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 16 }}>
                  <div style={{ width: '130px', height: '130px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={cardioDistributionData}
                          cx="50%"
                          cy="50%"
                          innerRadius={38}
                          outerRadius={58}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {cardioDistributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={DONUT_COLORS[(index + 3) % DONUT_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--text-primary)',
                            fontSize: '0.75rem',
                          }}
                          formatter={(v: any) => [`${v} ${v === 1 ? (lang === 'de' ? 'Eintrag' : lang === 'ru' ? 'запись' : 'entry') : (lang === 'de' ? 'Einträge' : lang === 'ru' ? 'записей' : 'entries')}`, '']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: '130px' }}>
                    {cardioDistributionData.map((entry, index) => {
                      const totalCardio = cardioDistributionData.reduce((sum, d) => sum + d.value, 0)
                      const pct = Math.round((entry.value / totalCardio) * 100)
                      return (
                        <div key={entry.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: DONUT_COLORS[(index + 3) % DONUT_COLORS.length] }} />
                            <span style={{ fontWeight: 500 }}>{entry.name}</span>
                          </div>
                          <span className="text-muted" style={{ fontWeight: 600 }}>{pct}%</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <style>{`
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
