'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Dumbbell, ChevronRight } from 'lucide-react'
import { useLang } from '@/lib/LanguageContext'
import { t } from '@/lib/i18n'
import { createClient } from '@/lib/supabase/client'
import { getGermanWeekBounds, getGermanDateString } from '@/lib/dateUtils'

type CalendarDay = {
  name: string
  dayNum: number
  dateStr: string
  isToday: boolean
  hasWorkout: boolean
}

const WEEKDAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

export default function Home() {
  const { lang } = useLang()
  const supabase = createClient()
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([])
  const [recentWorkouts, setRecentWorkouts] = useState<any[]>([])
  const [personalRecords, setPersonalRecords] = useState<any[]>([])
  const [userWeight, setUserWeight] = useState<number>(75)

  useEffect(() => {
    async function loadWeekWorkouts() {
      // 1. Get German week bounds
      const { start, end, days } = getGermanWeekBounds()
      const todayStr = getGermanDateString(new Date())

      // 2. Fetch authenticated user
      const { data: { user } } = await supabase.auth.getUser()
      const workoutDateStrings = new Set<string>()

      if (user) {
        // Load user weight
        const { data: prof } = await supabase
          .from('profiles').select('weight_kg').eq('id', user.id).single()
        let uWeight = 75
        if (prof?.weight_kg) {
          setUserWeight(parseFloat(prof.weight_kg))
          uWeight = parseFloat(prof.weight_kg)
        }

        // 3. Fetch workouts in current week range
        const { data: workouts } = await supabase
          .from('workouts')
          .select('start_time')
          .eq('user_id', user.id)
          .gte('start_time', start.toISOString())
          .lte('start_time', end.toISOString())

        if (workouts) {
          workouts.forEach(w => {
            if (w.start_time) {
              workoutDateStrings.add(getGermanDateString(w.start_time))
            }
          })
        }

        // 4. Fetch last 5 workouts with sets and exercises
        const { data: recWorkouts } = await supabase
          .from('workouts')
          .select('id, start_time, status, completed_at, sets(exercise_id, weight_kg, reps, exercise:exercises(type, name))')
          .eq('user_id', user.id)
          .order('start_time', { ascending: false })
          .limit(5)

        if (recWorkouts) {
          const formatted = recWorkouts.map(w => {
            const wSets = (w.sets as any[]) || []
            const exIds = new Set(wSets.map(s => s.exercise_id))
            const egymSets = wSets.filter(s => s.exercise?.type === 'egym')
            const classicSets = wSets.filter(s => s.exercise?.type === 'classic')
            
            const egymCal = egymSets.length * 1.5 * 5.5 * uWeight / 60
            const classicCal = classicSets.length * 2.5 * 4.0 * uWeight / 60
            const kcal = Math.round(egymCal + classicCal)

            const volume = Math.round(wSets.reduce((sum, s) => sum + (parseFloat(s.weight_kg?.toString().replace(',', '.') || '0') * parseInt(s.reps?.toString() || '0', 10)), 0))
            
            // Determine type label
            let typeLabel = 'Gym'
            if (egymSets.length > 0 && classicSets.length > 0) {
              typeLabel = 'EGYM & Classic'
            } else if (egymSets.length > 0) {
              typeLabel = 'EGYM Zirkel'
            } else if (classicSets.length > 0) {
              typeLabel = 'Classic'
            }

            return {
              id: w.id,
              dateStr: w.start_time ? getGermanDateString(w.start_time) : '',
              dateLabel: w.start_time ? getDateLabel(new Date(w.start_time), lang) : '',
              typeLabel,
              exCount: exIds.size,
              volume,
              kcal,
              status: w.status
            }
          })
          setRecentWorkouts(formatted)
        }

        // 5. Fetch personal records
        const { data: prData } = await supabase
          .from('max_lifts')
          .select('weight_kg, updated_at, exercise:exercises(name)')
          .eq('user_id', user.id)
          .order('weight_kg', { ascending: false })
          .limit(3)
        if (prData) {
          setPersonalRecords(prData)
        }
      }

      // 6. Map to CalendarDay objects
      const mapped = days.map((date, idx) => {
        const dateStr = getGermanDateString(date)
        return {
          name: WEEKDAY_NAMES[idx],
          dayNum: parseInt(dateStr.slice(8, 10), 10),
          dateStr,
          isToday: dateStr === todayStr,
          hasWorkout: workoutDateStrings.has(dateStr),
        }
      })
      setCalendarDays(mapped)
    }

    loadWeekWorkouts()
  }, [])

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
              {calendarDays.length === 0 ? (
                WEEKDAY_NAMES.map((day) => (
                  <div key={day} className="flex flex-col items-center gap-1">
                    <div className="cal-weekday" style={{ padding: 0 }}>{day}</div>
                    <div className="cal-day" style={{ width: 32, height: 32, opacity: 0.3 }}>
                      --
                    </div>
                  </div>
                ))
              ) : (
                calendarDays.map((day) => (
                  <Link
                    href={`/training?date=${day.dateStr}`}
                    key={day.name}
                    className="flex flex-col items-center gap-1"
                    style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
                  >
                    <div className="cal-weekday" style={{ padding: 0 }}>{day.name}</div>
                    <div className={`cal-day ${day.isToday ? 'today' : ''} ${day.hasWorkout ? 'has-workout' : ''}`} style={{ width: 32, height: 32 }}>
                      {day.dayNum}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Personal Records Showcase */}
        <div className="mt-2">
          <h3 style={{ fontSize: '0.9rem', marginBottom: 12, marginLeft: 4 }}>
            🏆 {t(lang, 'personalRecords')}
          </h3>
          <div className="card p-3">
            {personalRecords.length === 0 ? (
              <p className="text-secondary text-center py-4 text-sm" style={{ fontStyle: 'italic' }}>
                {lang === 'de' ? 'Trage deine erste Maximalkraft ein, um sie hier zu feiern!' : lang === 'ru' ? 'Запишите свой первый рекорд силы!' : 'Log your first max weight record to see it here!'}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {personalRecords.map((pr, idx) => (
                  <div key={idx} className="flex justify-between items-center" style={{ paddingBottom: idx < personalRecords.length - 1 ? 8 : 0, borderBottom: idx < personalRecords.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{pr.exercise?.name}</div>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                        {new Date(pr.updated_at).toLocaleDateString(lang === 'de' ? 'de-DE' : lang === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                    <div style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '1.05rem' }}>
                      {pr.weight_kg} kg
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Activity Feed / History */}
        <div className="mt-2 mb-6">
          <h3 style={{ fontSize: '0.9rem', marginBottom: 12, marginLeft: 4 }}>
            ⏱️ {t(lang, 'activityHistory')}
          </h3>
          {recentWorkouts.length === 0 ? (
            <div className="card text-center py-6 text-secondary text-sm">
              {lang === 'de' ? 'Noch keine aufgezeichneten Workouts.' : lang === 'ru' ? 'Нет записей о тренировках.' : 'No workouts recorded yet.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {recentWorkouts.map((w) => (
                <Link 
                  key={w.id} 
                  href={w.typeLabel.includes('EGYM') ? `/training?date=${w.dateStr}` : `/classic?date=${w.dateStr}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div className="card p-3 flex justify-between items-center" style={{ transition: 'all 0.15s', cursor: 'pointer' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className={`badge ${w.typeLabel.includes('EGYM') ? 'badge-accent' : 'badge-secondary'}`} style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                          {w.typeLabel}
                        </span>
                        {w.status === 'completed' && <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>✓</span>}
                      </div>
                      <h4 style={{ fontSize: '0.92rem', fontWeight: 600, marginTop: 4, marginBottom: 2 }}>
                        {w.dateLabel}
                      </h4>
                      <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                        {w.exCount} {t(lang, 'exercisesWord')} · {t(lang, 'volume')}: {w.volume} kg
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--accent)' }}>
                          {w.kcal} kcal
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-muted" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function getDateLabel(date: Date, lang: 'de' | 'en' | 'ru'): string {
  const todayStr = getGermanDateString(new Date())
  const targetStr = getGermanDateString(date)
  
  if (todayStr === targetStr) {
    return lang === 'de' ? 'Heute' : lang === 'ru' ? 'Сегодня' : 'Today'
  }
  
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = getGermanDateString(yesterday)
  if (yesterdayStr === targetStr) {
    return lang === 'de' ? 'Gestern' : lang === 'ru' ? 'Вчера' : 'Yesterday'
  }
  
  const localeMap = { de: 'de-DE', en: 'en-GB', ru: 'ru-RU' }
  const locale = localeMap[lang] ?? 'de-DE'
  return date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
}
