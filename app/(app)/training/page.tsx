'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Check, Edit2, Loader2, Trophy, ChevronDown, ChevronLeft, ChevronRight, Calendar, Settings, Info } from 'lucide-react'
import { useLang } from '@/lib/LanguageContext'
import { t } from '@/lib/i18n'
import { getGermanDateBounds, getGermanDateString } from '@/lib/dateUtils'
import RestTimer from '@/components/RestTimer'
import { useWakeLock } from '@/hooks/useWakeLock'
import { enqueueSetUpsert, processSyncQueue } from '@/lib/syncQueue'

type Exercise = { id: string; name: string; muscle_group: string; egym_order: number }
type SetDetails = { weight: string; reps: string; active_kcal?: number | null }
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
  useWakeLock()
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

  // AI calorie states
  const [aiKcal, setAiKcal] = useState<number | null>(null)
  const [aiExplanation, setAiExplanation] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [setChangeCounter, setSetChangeCounter] = useState(0)

  // Page Settings modal states
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false)
  const [tempRounds, setTempRounds] = useState('3')
  const [tempTimer, setTempTimer] = useState('90')
  const [settingsSaving, setSettingsSaving] = useState(false)

  const [hasOfflineSync, setHasOfflineSync] = useState(false)

  useEffect(() => {
    const checkQueue = () => {
      const data = localStorage.getItem('egym_offline_sets_queue')
      setHasOfflineSync(data ? JSON.parse(data).length > 0 : false)
    }
    checkQueue()
    
    window.addEventListener('sync-queue-updated', checkQueue)
    
    processSyncQueue(supabase)
    const handleOnline = () => {
      processSyncQueue(supabase)
    }
    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('sync-queue-updated', checkQueue)
      window.removeEventListener('online', handleOnline)
    }
  }, [supabase])

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
        .from('workouts').select('id, status, estimated_kcal, ai_explanation')
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
        setAiKcal(selectedWorkouts[0].estimated_kcal)
        setAiExplanation(selectedWorkouts[0].ai_explanation)
      } else {
        setAiKcal(null)
        setAiExplanation(null)
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
          .from('sets').select('exercise_id, weight_kg, reps, round_number, active_kcal').eq('workout_id', wid)
        const loadedWeights: RoundWeights = {}
        existingSets?.forEach(s => {
          if (!loadedWeights[s.exercise_id]) loadedWeights[s.exercise_id] = {}
          const r = s.round_number
          if (r >= 1 && r <= currentRounds) {
            loadedWeights[s.exercise_id][r] = {
              weight: s.weight_kg?.toString() ?? '',
              reps: s.reps?.toString() ?? '12',
              active_kcal: s.active_kcal
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
    setTimerOpen(false)
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
      setAiKcal(null)
      setAiExplanation(null)
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
    const setKcal = calculateFallbackKcal(dialogExercise.name, wVal, rVal, userWeight, 'egym')
    setWeights(prev => ({
      ...prev,
      [dialogExercise.id]: {
        ...(prev[dialogExercise.id] ?? {}),
        [dialogRound]: { weight: wVal.toString(), reps: rVal.toString(), active_kcal: setKcal }
      }
    }))
    
    setSetChangeCounter(c => c + 1)
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
          [dialogRound]: { weight: wVal.toString(), reps: rVal.toString(), active_kcal: setKcal }
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
    const payload = { 
      workout_id: workoutId, 
      exercise_id: dialogExercise.id, 
      weight_kg: wVal, 
      reps: rVal, 
      round_number: dialogRound,
      active_kcal: setKcal,
      created_at: new Date().toISOString()
    }
    
    supabase.from('sets').upsert(payload, { onConflict: 'workout_id,exercise_id,round_number' })
      .then(
        ({ error }) => { if (error) enqueueSetUpsert(payload) },
        () => { enqueueSetUpsert(payload) }
      )
  }

  const totalCompletedSets = exercises.reduce((sum, ex) => sum + completedRounds(ex.id), 0)

  // Calculate dynamic fallback calorie burn by summing up all set fallback values
  const fallbackKcalSum = exercises.reduce((sum, ex) => {
    const exW = weights[ex.id] || {}
    const setKcalSum = roundsArray.reduce((sSum, r) => {
      const set = exW[r]
      return sSum + (set?.active_kcal || 0)
    }, 0)
    return sum + setKcalSum
  }, 0)

  const estimatedKcal = aiKcal !== null && aiKcal !== undefined ? aiKcal : fallbackKcalSum

  const isToday = getGermanDateString(selectedDate) === getGermanDateString(new Date())

  const handleEstimateAI = async () => {
    if (!workoutId) return
    setAiLoading(true)
    setAiError(null)
    try {
      const res = await fetch('/api/estimate-calories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workoutId })
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setAiError(data.error || 'API Error')
      } else {
        setAiKcal(data.estimated_kcal)
        setAiExplanation(data.ai_explanation)

        // Re-fetch sets from Supabase to load the updated active_kcal values
        const { data: updatedSets } = await supabase
          .from('sets')
          .select('exercise_id, weight_kg, reps, round_number, active_kcal')
          .eq('workout_id', workoutId)

        if (updatedSets) {
          const loadedWeights: RoundWeights = {}
          updatedSets.forEach(s => {
            if (!loadedWeights[s.exercise_id]) loadedWeights[s.exercise_id] = {}
            const r = s.round_number
            if (r >= 1 && r <= egymRounds) {
              loadedWeights[s.exercise_id][r] = {
                weight: s.weight_kg?.toString() ?? '',
                reps: s.reps?.toString() ?? '12',
                active_kcal: s.active_kcal
              }
            }
          })
          setWeights(loadedWeights)
        }
      }
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : String(err))
    } finally {
      setAiLoading(false)
    }
  }

  useEffect(() => {
    if (!workoutId || totalCompletedSets === 0) return
    
    if (setChangeCounter === 0 && aiKcal !== null && aiKcal !== undefined) {
      return
    }
    
    const timer = setTimeout(() => {
      handleEstimateAI()
    }, 3000)
    
    return () => clearTimeout(timer)
  }, [setChangeCounter, workoutId])

  const renderCalorieCard = () => {
    if (totalCompletedSets === 0) return null

    const displayingAi = aiKcal !== null && aiKcal !== undefined

    return (
      <div className="card" style={{ padding: '14px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
            <span>{displayingAi ? '🤖' : '⚡'}</span>
            <span>{t(lang, 'estCalorieBurn')} {displayingAi ? `(${t(lang, 'aiEstimated')})` : ''}</span>
          </span>
          <span style={{ fontSize: '1.05rem', fontWeight: 700, color: displayingAi ? 'var(--accent)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {aiLoading && <Loader2 size={14} className="spin text-accent" />}
            <span>{estimatedKcal} {t(lang, 'kcal')}</span>
          </span>
        </div>
        {displayingAi && aiExplanation && (
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 8, fontStyle: 'italic', lineHeight: 1.35, borderLeft: '2px solid var(--accent)', paddingLeft: 8, margin: '8px 0 0' }}>
            &quot;{aiExplanation}&quot;
          </p>
        )}
        {aiError && (
          <div style={{ fontSize: '0.72rem', color: 'var(--danger)', marginTop: 6 }}>
            ⚠️ {t(lang, 'aiError')}: {aiError}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return <div className="flex justify-center items-center h-full mt-20"><Loader2 className="spin text-accent" size={32} /></div>
  }

  return (
    <div className="animate-fade-in">
      <header className="page-header pb-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h1 className="page-header-title">{t(lang, 'egymTitle')}</h1>
            {hasOfflineSync && (
              <span title="Offline Änderungen warten auf Synchronisation" className="pulse-finished" style={{ display: 'flex', color: 'var(--warning, #f59e0b)', borderRadius: '50%' }}>
                ☁️
              </span>
            )}
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
        </div>
        <p className="text-secondary" style={{ fontSize: '0.85rem', marginTop: '4px' }}>
          {isCompleted ? t(lang, 'trainingDone') : t(lang, 'trainingHint')}
        </p>
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
                                  {filled ? (
                                    <span style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.2 }}>
                                      <span>{set.weight} kg * {set.reps}</span>
                                      {set.active_kcal && <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--accent)' }}>🔥 {set.active_kcal} kcal</span>}
                                    </span>
                                  ) : '--'}
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
              {renderCalorieCard()}
              {!isCompleted ? (
                <button className="btn btn-success btn-full btn-lg" onClick={finishTraining} disabled={finishing}>
                  {finishing ? <Loader2 size={18} className="spin" /> : <Check size={20} />}
                  {finishing ? t(lang, 'saving2') : t(lang, 'finishTraining')}
                </button>
              ) : (
                <div className="card text-center py-4" style={{ borderColor: '#22c55e33' }}>
                  <Trophy size={28} className="text-warning" style={{ margin: '0 auto 8px' }} />
                  <p style={{ fontWeight: 600 }}>{t(lang, 'trainingDone')}</p>
                  <p className="text-secondary text-sm mt-1 mb-4">{t(lang, 'trainingDoneMsg')}</p>
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
                <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {lang === 'de' ? 'Gewicht (kg)' : lang === 'ru' ? 'Вес (кг)' : 'Weight (kg)'}
                  {(dialogExercise?.name?.toLowerCase().includes('klimmzug') || dialogExercise?.name?.toLowerCase().includes('klimmzü')) && (
                    <span 
                      title={t(lang, 'pullupWeightInfo')} 
                      style={{ color: 'var(--accent)', display: 'flex', cursor: 'pointer' }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        alert(t(lang, 'pullupWeightInfo'));
                      }}
                    >
                      <Info size={14} />
                    </span>
                  )}
                </label>
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

function calculateFallbackKcal(
  exerciseName: string,
  weightKg: number | null | undefined,
  reps: number | null | undefined,
  userWeight: number,
  type: 'egym' | 'classic'
): number {
  const w = weightKg || 0
  const r = reps || 0
  if (r === 0) return 0
  
  const name = exerciseName.toLowerCase()
  let muscleFactor = 1.0
  
  if (name.includes('bein') || name.includes('knie') || name.includes('squat') || name.includes('kreuzheben') || name.includes('presse')) {
    muscleFactor = 1.3
  } else if (name.includes('curl') || name.includes('trizeps') || name.includes('seitheben') || name.includes('fly') || name.includes('wade') || name.includes('waden')) {
    muscleFactor = 0.7
  }
  
  const isPullup = name.includes('klimmzug') || name.includes('klimmzü')
  const effW = isPullup ? Math.max(0, userWeight - w) : w
  
  const baseKcalPerSet = (type === 'egym' ? 1.5 * 5.5 : 2.5 * 4.0) * userWeight / 60
  const repsFactor = r / 10
  const weightRatio = effW > 0 ? (effW / (userWeight * 0.7)) : 0.5
  const intensityFactor = 0.5 + 0.5 * weightRatio
  
  return Math.round(baseKcalPerSet * repsFactor * intensityFactor * muscleFactor)
}

