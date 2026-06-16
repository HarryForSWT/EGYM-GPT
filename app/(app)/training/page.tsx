'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Check, Edit2, Loader2, Trophy, ChevronDown, ChevronLeft, ChevronRight, Calendar, Settings } from 'lucide-react'
import { useLang } from '@/lib/LanguageContext'
import { t } from '@/lib/i18n'
import { getGermanDateBounds, getGermanDateString } from '@/lib/dateUtils'
import RestTimer from '@/components/RestTimer'

type Exercise = { id: string; name: string; muscle_group: string; egym_order: number }
type SetDetails = { weight: string; reps: string }
type RoundWeights = Record<string, Record<number, SetDetails | null>>
type MaxLifts = Record<string, number>


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
  return date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function TrainingPage() {
  const supabase  = createClient()
  const { lang }  = useLang()

  const [exercises, setExercises]         = useState<Exercise[]>([])
  const [loading, setLoading]             = useState(true)
  const [workoutId, setWorkoutId]         = useState<string | null>(null)
  const [isCompleted, setIsCompleted]     = useState(false)
  const [finishing, setFinishing]         = useState(false)
  const [weights, setWeights]             = useState<RoundWeights>({})
  const [maxLifts, setMaxLifts]           = useState<MaxLifts>({})
  const [editMaxEx, setEditMaxEx]         = useState<Exercise | null>(null)
  const [editMaxVal, setEditMaxVal]       = useState('')
  const [userWeight, setUserWeight]       = useState<number>(75)
  const [egymRounds, setEgymRounds]       = useState<number>(3)
  const [restTimerSeconds, setRestTimerSeconds] = useState<number>(90)
  const [timerOpen, setTimerOpen]               = useState(false)
  const [timerDuration, setTimerDuration]       = useState(90)

  // Page Settings modal states
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false)
  const [tempRounds, setTempRounds] = useState('3')
  const [tempTimer, setTempTimer] = useState('90')
  const [settingsSaving, setSettingsSaving] = useState(false)

  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate]   = useState<Date>(() => {
    if (typeof window !== 'undefined') {
      const param = new URLSearchParams(window.location.search).get('date')
      if (param) {
        const parts = param.split('-')
        if (parts.length === 3) {
          const y = parseInt(parts[0], 10)
          const m = parseInt(parts[1], 10) - 1
          const d = parseInt(parts[2], 10)
          return new Date(Date.UTC(y, m, d, 12, 0, 0))
        }
      }
    }
    return new Date()
  })

  // Set Modal Dialog States
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogExercise, setDialogExercise] = useState<Exercise | null>(null)
  const [dialogRound, setDialogRound] = useState<number | null>(null)
  const [dialogWeight, setDialogWeight] = useState('')
  const [dialogReps, setDialogReps] = useState('12')

  useEffect(() => {
    async function init() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Load user weight, egym_rounds & rest timer
      let currentRounds = 3
      const { data: prof } = await supabase
        .from('profiles').select('weight_kg, egym_rounds, rest_timer_seconds').eq('id', user.id).single()
      if (prof?.weight_kg) {
        setUserWeight(parseFloat(prof.weight_kg))
      }
      if (prof?.egym_rounds) {
        setEgymRounds(prof.egym_rounds)
        setTempRounds(prof.egym_rounds.toString())
        currentRounds = prof.egym_rounds
      }
      if (prof?.rest_timer_seconds !== undefined) {
        setRestTimerSeconds(prof.rest_timer_seconds)
        setTimerDuration(prof.rest_timer_seconds)
        setTempTimer(prof.rest_timer_seconds.toString())
      }

      const { data: exData } = await supabase
        .from('exercises').select('*').eq('type', 'egym')
        .order('egym_order', { ascending: true })
      if (!exData) return
      setExercises(exData)

      const { start: dateStart, end: dateEnd } = getGermanDateBounds(selectedDate)
      const todayStart = getGermanDateBounds(new Date()).start

      // Fetch workout for selected date
      const { data: selectedWorkouts } = await supabase
        .from('workouts').select('id, status')
        .eq('user_id', user.id)
        .gte('start_time', dateStart.toISOString())
        .lte('start_time', dateEnd.toISOString())
        .order('start_time', { ascending: false }).limit(1)

      // Veraltete aktive Workouts automatisch abschließen
      await supabase.from('workouts')
        .update({ status: 'completed', completed_at: new Date(todayStart.getTime() - 1000).toISOString() })
        .eq('user_id', user.id).eq('status', 'active')
        .lt('start_time', todayStart.toISOString())

      let wid: string | null = null
      let completedState = false

      if (selectedWorkouts && selectedWorkouts.length > 0) {
        wid = selectedWorkouts[0].id
        completedState = selectedWorkouts[0].status === 'completed'
      } else {
        // Only auto-create if it's today
        const isToday = getGermanDateString(selectedDate) === getGermanDateString(new Date())
        if (isToday) {
          const { data: nw } = await supabase.from('workouts')
            .insert({ user_id: user.id, status: 'active' }).select('id').single()
          if (nw) {
            wid = nw.id
          }
        }
      }

      setWorkoutId(wid)
      setIsCompleted(completedState)

      if (wid) {
        const { data: existingSets } = await supabase
          .from('sets').select('exercise_id, weight_kg, reps, round_number').eq('workout_id', wid)
        const loadedWeights: RoundWeights = {}
        existingSets?.forEach(s => {
          if (!loadedWeights[s.exercise_id]) loadedWeights[s.exercise_id] = {}
          const r = s.round_number
          if (r >= 1 && r <= currentRounds) {
            loadedWeights[s.exercise_id][r] = {
              weight: s.weight_kg?.toString() ?? '',
              reps: s.reps?.toString() ?? '12'
            }
          }
        })
        setWeights(loadedWeights)

        // Auto-open first unfinished exercise
        const firstUnfinished = exData.find(ex => {
          const finishedCount = loadedWeights[ex.id]
            ? Object.values(loadedWeights[ex.id]).filter(v => v !== null && parseFloat(v.weight) > 0).length
            : 0
          return finishedCount < currentRounds
        })
        setActiveExerciseId(firstUnfinished?.id ?? exData[0]?.id ?? null)
      } else {
        setWeights({})
        setActiveExerciseId(null)
      }

      const { data: ml } = await supabase.from('max_lifts')
        .select('exercise_id, weight_kg, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
      if (ml) {
        const mlMap: MaxLifts = {}
        ml.forEach(m => {
          if (mlMap[m.exercise_id] === undefined) {
            mlMap[m.exercise_id] = m.weight_kg
          }
        })
        setMaxLifts(mlMap)
      }

      setLoading(false)
    }
    init()
  }, [selectedDate])

  const openMaxEdit = (ex: Exercise) => {
    setEditMaxEx(ex)
    setEditMaxVal(maxLifts[ex.id]?.toString() ?? '')
  }

  const saveMaxLift = async () => {
    if (!editMaxEx) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const val = parseFloat(editMaxVal.replace(',', '.'))
    if (isNaN(val) || val <= 0) { setEditMaxEx(null); return }
    
    // Optimistic UI Update
    setMaxLifts(prev => ({ ...prev, [editMaxEx.id]: val }))
    setEditMaxEx(null)

    // Background Database Insert
    supabase.from('max_lifts').insert(
      { user_id: user.id, exercise_id: editMaxEx.id, weight_kg: val, updated_at: new Date().toISOString() }
    ).then()
  }

  const handleSavePageSettings = async () => {
    setSettingsSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSettingsSaving(false); return }

    const rVal = parseInt(tempRounds, 10) || 3
    const tVal = parseInt(tempTimer, 10) || 90

    const { error } = await supabase
      .from('profiles')
      .update({ egym_rounds: rVal, rest_timer_seconds: tVal })
      .eq('id', user.id)

    if (!error) {
      setEgymRounds(rVal)
      setRestTimerSeconds(tVal)
      setTimerDuration(tVal)
      setPageSettingsOpen(false)
    }
    setSettingsSaving(false)
  }

  const finishTraining = async () => {
    if (!workoutId) return
    setFinishing(true)
    await supabase.from('workouts')
      .update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', workoutId)
    setIsCompleted(true)
    setFinishing(false)
  }

  const resumeTraining = async () => {
    if (!workoutId) return
    setLoading(true)
    await supabase.from('workouts')
      .update({ status: 'active', completed_at: null })
      .eq('id', workoutId)
    setIsCompleted(false)
    setLoading(false)
  }

  const createRetrospectiveWorkout = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const GermanBounds = getGermanDateBounds(selectedDate)
    const noonLocal = new Date(GermanBounds.start.getTime() + 12 * 60 * 60 * 1000)

    const { data: nw } = await supabase.from('workouts')
      .insert({
        user_id: user.id,
        status: 'active',
        start_time: noonLocal.toISOString()
      }).select('id').single()

    if (nw) {
      setWorkoutId(nw.id)
      setIsCompleted(false)
      setWeights({})
      if (exercises.length > 0) {
        setActiveExerciseId(exercises[0].id)
      }
    }
    setLoading(false)
  }

  const navigateDay = (offset: number) => {
    setSelectedDate(prev => {
      const d = new Date(prev)
      d.setDate(d.getDate() + offset)
      return d
    })
  }

  const roundsArray = Array.from({ length: egymRounds }, (_, i) => i + 1)

  const completedRounds = (exId: string) =>
    roundsArray.filter(r => {
      const set = weights[exId]?.[r]
      return set !== null && set !== undefined && parseFloat(set.weight) > 0
    }).length

  const openSetDialog = (ex: Exercise, round: number) => {
    setDialogExercise(ex)
    setDialogRound(round)
    const existing = weights[ex.id]?.[round]
    setDialogWeight(existing?.weight ?? '')
    setDialogReps(existing?.reps ?? '12')
    setDialogOpen(true)
  }

  const handleSaveSet = async () => {
    if (!dialogExercise || !dialogRound || !workoutId) return
    const wVal = parseFloat(dialogWeight.replace(',', '.'))
    const rVal = parseInt(dialogReps, 10)
    
    if (isNaN(wVal) || wVal <= 0 || isNaN(rVal) || rVal <= 0) {
      return
    }
    
    // 1. Update local state
    setWeights(prev => ({
      ...prev,
      [dialogExercise.id]: {
        ...(prev[dialogExercise.id] ?? {}),
        [dialogRound]: { weight: wVal.toString(), reps: rVal.toString() }
      }
    }))
    
    setDialogOpen(false)

    // Trigger Rest Timer
    if (restTimerSeconds > 0) {
      setTimerDuration(restTimerSeconds)
      setTimerOpen(false) // Reset
      setTimeout(() => setTimerOpen(true), 50)
    }
    
    // 2. Auto-advance to next panel in circuit order
    const currentExIndex = exercises.findIndex(ex => ex.id === dialogExercise.id)
    if (currentExIndex !== -1) {
      const currentIndex = (dialogRound - 1) * exercises.length + currentExIndex
      
      const tempWeights = {
        ...weights,
        [dialogExercise.id]: {
          ...(weights[dialogExercise.id] ?? {}),
          [dialogRound]: { weight: wVal.toString(), reps: rVal.toString() }
        }
      }
      
      let foundNext = false
      const totalTasks = exercises.length * egymRounds
      for (let offset = 1; offset <= totalTasks; offset++) {
        const nextIdx = (currentIndex + offset) % totalTasks
        const nextExIndex = nextIdx % exercises.length
        const nextRound = Math.floor(nextIdx / exercises.length) + 1
        const nextEx = exercises[nextExIndex]
        
        const nextSet = tempWeights[nextEx.id]?.[nextRound]
        const hasNextSet = nextSet !== null && nextSet !== undefined && parseFloat(nextSet.weight) > 0
        
        if (!hasNextSet) {
          setActiveExerciseId(nextEx.id)
          foundNext = true
          break
        }
      }
      
      if (!foundNext) {
        setActiveExerciseId(null)
      }
    }

    // 3. Persist in database in background
    supabase.from('sets').upsert(
      { workout_id: workoutId, exercise_id: dialogExercise.id, weight_kg: wVal, reps: rVal, round_number: dialogRound },
      { onConflict: 'workout_id,exercise_id,round_number' }
    ).then()
  }

  const totalCompletedSets = exercises.reduce((sum, ex) => sum + completedRounds(ex.id), 0)
  const estimatedKcal = Math.round(totalCompletedSets * 1.5 * 5.5 * userWeight / 60)

  const isToday = getGermanDateString(selectedDate) === getGermanDateString(new Date())

  if (loading) {
    return <div className="flex justify-center items-center h-full mt-20"><Loader2 className="spin text-accent" size={32} /></div>
  }

  return (
    <div className="animate-fade-in">
      <header className="page-header pb-3">
        <div>
          <h1 className="page-header-title">{t(lang, 'egymTitle')}</h1>
          <p className="text-secondary" style={{ fontSize: '0.85rem' }}>
            {isCompleted ? t(lang, 'trainingDone') : t(lang, 'trainingHint')}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isCompleted && <Trophy size={22} className="text-warning" />}
          <button 
            className="btn btn-ghost" 
            style={{ padding: 6, minHeight: 'auto' }} 
            onClick={() => setPageSettingsOpen(true)}
            aria-label="Settings"
          >
            <Settings size={22} className="text-muted" />
          </button>
        </div>
      </header>

      {/* Date Navigation Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface border border-border" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', padding: '10px 16px', borderRadius: 'var(--radius-lg)', margin: '0 16px 12px', position: 'relative' }}>
        <button
          className="btn btn-ghost btn-sm"
          style={{ padding: 6, minHeight: 'auto', zIndex: 2 }}
          onClick={() => navigateDay(-1)}
        >
          <ChevronLeft size={20} />
        </button>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, zIndex: 1 }}>
          <div style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
              {getDateLabel(selectedDate, lang)}
            </span>
            <input
              type="date"
              max={getGermanDateString(new Date())}
              value={getGermanDateString(selectedDate)}
              onChange={(e) => {
                const val = e.target.value
                if (val) {
                  const parts = val.split('-')
                  if (parts.length === 3) {
                    const y = parseInt(parts[0], 10)
                    const m = parseInt(parts[1], 10) - 1
                    const d = parseInt(parts[2], 10)
                    setSelectedDate(new Date(Date.UTC(y, m, d, 12, 0, 0)))
                  }
                }
              }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                opacity: 0,
                cursor: 'pointer',
                width: '100%',
                height: '100%'
              }}
            />
          </div>
          
          {!isToday && (
            <button
              className="btn btn-ghost btn-sm animate-fade-in"
              style={{ padding: '2px 8px', fontSize: '0.7rem', minHeight: 'auto', color: 'var(--text-secondary)', textDecoration: 'underline', fontFamily: 'inherit' }}
              onClick={() => setSelectedDate(new Date())}
            >
              {lang === 'de' ? 'Zurück zu Heute' : lang === 'ru' ? 'Назад к Сегодня' : 'Back to Today'}
            </button>
          )}
        </div>

        <button
          className="btn btn-ghost btn-sm"
          style={{ padding: 6, minHeight: 'auto', zIndex: 2 }}
          disabled={isToday}
          onClick={() => navigateDay(1)}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="px-4 pb-4">
        {!workoutId ? (
          <div className="card text-center py-6" style={{ marginTop: 8 }}>
            <Calendar size={32} className="text-muted" style={{ margin: '0 auto 12px' }} />
            <p style={{ fontWeight: 600 }}>
              {lang === 'de' ? 'Kein Training an diesem Tag' : lang === 'ru' ? 'Нет тренировок в этот день' : 'No workout on this day'}
            </p>
            <p className="text-secondary text-sm mt-1 mb-4">
              {lang === 'de' ? 'Du hast an diesem Tag kein Training aufgezeichnet.' : lang === 'ru' ? 'Вы не записывали тренировку в этот день.' : 'You did not record a workout on this day.'}
            </p>
            <button className="btn btn-primary btn-full" onClick={createRetrospectiveWorkout}>
              {lang === 'de' ? 'Training nachtragen' : lang === 'ru' ? 'Записать тренировку' : 'Log training retrospectively'}
            </button>
          </div>
        ) : (
          <>
            {exercises.map(ex => {
              const done    = completedRounds(ex.id)
              const isDone  = done === egymRounds
              const exW     = weights[ex.id] ?? {}
              const isActive = activeExerciseId === ex.id

              return (
                <div key={ex.id} className={`exercise-panel ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}>
                  <div className="panel-header" style={{ cursor: 'pointer' }} onClick={() => setActiveExerciseId(isActive ? null : ex.id)}>
                    <div className="panel-status-icon">
                      {isDone
                        ? <Check size={18} className="text-success" />
                        : <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)' }}>{done > 0 ? done : ''}</div>
                      }
                    </div>
                    <div className="panel-title">{ex.name}</div>
                    <div className="panel-reps-badge">{ex.muscle_group}</div>
                    <ChevronDown size={16} className="panel-chevron" />
                  </div>

                  {isActive && (
                    <div style={{ padding: '0 14px 14px' }} className="animate-slide-down">
                      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 4 }}>
                        <div className="round-grid" style={{ gridTemplateColumns: `90px repeat(${egymRounds}, minmax(80px, 1fr))`, minWidth: `${90 + egymRounds * 80}px` }}>
                          <div className="round-grid-label">{t(lang, 'maxForce')}</div>
                          {roundsArray.map(r => <div key={r} className="round-grid-label">{t(lang, 'round')} {r}</div>)}

                          <div className="max-lift-cell">
                            <span className="max-lift-value">
                              {maxLifts[ex.id] != null ? `${maxLifts[ex.id]} kg` : '-- kg'}
                            </span>
                            <button className="max-lift-edit-btn" aria-label="Max Kraft bearbeiten" onClick={() => openMaxEdit(ex)}>
                              <Edit2 size={13} />
                            </button>
                          </div>

                          {roundsArray.map(r => {
                            const set = exW[r]
                            const filled = set !== null && set !== undefined && parseFloat(set.weight) > 0
                            return (
                              <div key={r} className="round-cell">
                                <button
                                  className={`round-cell-button ${filled ? 'filled' : ''}`}
                                  onClick={() => openSetDialog(ex, r)}
                                >
                                  {filled ? `${set.weight} kg * ${set.reps}` : '--'}
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            <div style={{ marginTop: 16, marginBottom: 8 }}>
              {!isCompleted ? (
                <>
                  {estimatedKcal > 0 && (
                    <div style={{ textAlign: 'center', marginBottom: 10, fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                      ⚡ {t(lang, 'estCalorieBurn')}: <strong style={{ color: 'var(--accent)' }}>{estimatedKcal} {t(lang, 'kcal')}</strong>
                    </div>
                  )}
                  <button className="btn btn-success btn-full btn-lg" onClick={finishTraining} disabled={finishing}>
                    {finishing ? <Loader2 size={18} className="spin" /> : <Check size={20} />}
                    {finishing ? t(lang, 'saving2') : t(lang, 'finishTraining')}
                  </button>
                </>
              ) : (
                <div className="card text-center py-4" style={{ borderColor: '#22c55e33' }}>
                  <Trophy size={28} className="text-warning" style={{ margin: '0 auto 8px' }} />
                  <p style={{ fontWeight: 600 }}>{t(lang, 'trainingDone')}</p>
                  <p className="text-secondary text-sm mt-1 mb-2">{t(lang, 'trainingDoneMsg')}</p>
                  {estimatedKcal > 0 && (
                    <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>
                      🔥 {t(lang, 'estCalorieBurn')}: <span style={{ color: 'var(--accent)' }}>{estimatedKcal} {t(lang, 'kcal')}</span>
                    </p>
                  )}
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ margin: '0 auto' }}
                    onClick={resumeTraining}
                  >
                    {lang === 'de' ? 'Training fortsetzen' : lang === 'ru' ? 'Продолжить тренировку' : 'Resume training'}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {editMaxEx && (
        <div className="max-lift-modal-backdrop" onClick={() => setEditMaxEx(null)}>
          <div className="max-lift-modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: 6 }}>{t(lang, 'maxForce')}</h2>
            <p className="text-secondary text-sm mb-4">{editMaxEx.name}</p>
            <div className="input-group mb-4">
              <label className="input-label">kg</label>
              <input type="number" inputMode="decimal" step="0.001" className="input-field" placeholder="z.B. 80"
                value={editMaxVal} autoFocus
                onChange={e => setEditMaxVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveMaxLift() }} />
            </div>
            <div className="flex gap-3">
              <button className="btn btn-secondary flex-1" onClick={() => setEditMaxEx(null)}>{t(lang, 'cancel')}</button>
              <button className="btn btn-primary flex-1" onClick={saveMaxLift}>{t(lang, 'save')}</button>
            </div>
          </div>
        </div>
      )}

      {dialogOpen && dialogExercise && dialogRound && (
        <div className="max-lift-modal-backdrop" onClick={() => setDialogOpen(false)}>
          <div className="max-lift-modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: 4 }}>{dialogExercise.name}</h2>
            <p className="text-secondary text-sm mb-4">{t(lang, 'round')} {dialogRound}</p>
            
            <div className="flex gap-4 mb-4">
              <div className="input-group flex-1">
                <label className="input-label">{lang === 'de' ? 'Gewicht (kg)' : 'Weight (kg)'}</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.001"
                  className="input-field"
                  placeholder="z.B. 55"
                  value={dialogWeight}
                  autoFocus
                  onChange={e => setDialogWeight(e.target.value)}
                />
              </div>
              
              <div className="input-group flex-1">
                <label className="input-label">{lang === 'de' ? 'Wiederholungen' : 'Reps'}</label>
                <input
                  type="number"
                  inputMode="numeric"
                  className="input-field"
                  placeholder="z.B. 12"
                  value={dialogReps}
                  onChange={e => setDialogReps(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveSet() }}
                />
              </div>
            </div>
            
            <div className="flex gap-3">
              <button className="btn btn-secondary flex-1" onClick={() => setDialogOpen(false)}>{t(lang, 'cancel')}</button>
              <button className="btn btn-primary flex-1" onClick={handleSaveSet}>{t(lang, 'save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Rest Timer */}
      {timerOpen && (
        <RestTimer 
          duration={timerDuration} 
          lang={lang} 
          onClose={() => setTimerOpen(false)} 
        />
      )}

      {/* Settings Modal */}
      {pageSettingsOpen && (
        <div className="max-lift-modal-backdrop animate-fade-in" onClick={() => setPageSettingsOpen(false)}>
          <div className="max-lift-modal animate-scale-in" onClick={e => e.stopPropagation()} style={{ width: '290px', padding: '20px' }}>
            <h3 style={{ fontWeight: 600, fontSize: '0.98rem', marginBottom: 16, textAlign: 'center' }}>
              ⚙️ {t(lang, 'settings')}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <div className="input-group">
                <label className="input-label">{t(lang, 'egymRounds')}</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  className="input-field"
                  value={tempRounds}
                  onChange={e => setTempRounds(e.target.value)}
                />
              </div>

              <div className="input-group">
                <label className="input-label">{t(lang, 'restTimerConfig')}</label>
                <select
                  className="input-field"
                  value={tempTimer}
                  onChange={e => setTempTimer(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}
                >
                  <option value="0">{t(lang, 'disabled')}</option>
                  <option value="60">60 {t(lang, 'seconds')}</option>
                  <option value="90">90 {t(lang, 'seconds')}</option>
                  <option value="120">120 {t(lang, 'seconds')}</option>
                  <option value="150">150 {t(lang, 'seconds')}</option>
                  <option value="180">180 {t(lang, 'seconds')}</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary flex-1" onClick={() => setPageSettingsOpen(false)}>
                {t(lang, 'cancel')}
              </button>
              <button className="btn btn-primary flex-1" onClick={handleSavePageSettings} disabled={settingsSaving}>
                {settingsSaving ? <Loader2 size={14} className="spin" /> : null}
                {t(lang, 'save')}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`.spin { animation: spin 0.8s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } } .flex-1 { flex: 1; }`}</style>
    </div>
  )
}
