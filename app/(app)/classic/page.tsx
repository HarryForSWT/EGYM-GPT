'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, Plus, Edit2, Play, Trash2, ChevronLeft, ChevronRight, Calendar, Loader2, Trophy, Check, Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/LanguageContext'
import { t } from '@/lib/i18n'
import { getGermanDateBounds, getGermanDateString } from '@/lib/dateUtils'
import RestTimer from '@/components/RestTimer'
import { useWakeLock } from '@/hooks/useWakeLock'

type Exercise = { id: string; name: string; muscle_group: string }
type SetItem = { weight: string; reps: string; round_number: number }

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

export default function ClassicTrainingPage() {
  useWakeLock()
  const supabase  = createClient()
  const { lang }  = useLang()

  const [exercises, setExercises]         = useState<Exercise[]>([])
  const [sets, setSets]                   = useState<Record<string, SetItem[]>>({})
  const [loading, setLoading]             = useState(true)
  const [workoutId, setWorkoutId]         = useState<string | null>(null)
  const [isCompleted, setIsCompleted]     = useState(false)
  const [finishing, setFinishing]         = useState(false)
  const [userWeight, setUserWeight]       = useState<number>(75)

  const [activePanel, setActivePanel]     = useState<string | null>(null)
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

  // Temporäre Eingaben pro Satz
  const [currentWeight, setCurrentWeight] = useState('')
  const [currentReps, setCurrentReps] = useState('')

  // Modal Dialog States
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogExercise, setDialogExercise] = useState<Exercise | null>(null)
  const [dialogRound, setDialogRound] = useState<number | null>(null)
  const [dialogWeight, setDialogWeight] = useState('')
  const [dialogReps, setDialogReps] = useState('12')

  // Rest Timer states
  const [restTimerSeconds, setRestTimerSeconds] = useState<number>(90)
  const [timerOpen, setTimerOpen] = useState(false)
  const [timerDuration, setTimerDuration] = useState(90)

  // Page Settings modal states
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false)
  const [tempTimer, setTempTimer] = useState('90')
  const [settingsSaving, setSettingsSaving] = useState(false)

  // Custom Exercise creation states
  const [customExOpen, setCustomExOpen] = useState(false)
  const [customExName, setCustomExName] = useState('')
  const [customExGroup, setCustomExGroup] = useState('Brust')

  // Templates states
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([])
  const [templateOpen, setTemplateOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [templateFilterIds, setTemplateFilterIds] = useState<string[] | null>(null)
  const [activeTemplateName, setActiveTemplateName] = useState<string>('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [loadingTemplates, setLoadingTemplates] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      // Load user weight & rest timer preference
      const { data: prof } = await supabase
        .from('profiles').select('weight_kg, rest_timer_seconds').eq('id', user.id).single()
      if (prof?.weight_kg) {
        setUserWeight(parseFloat(prof.weight_kg))
      }
      if (prof?.rest_timer_seconds !== undefined) {
        setRestTimerSeconds(prof.rest_timer_seconds)
        setTimerDuration(prof.rest_timer_seconds)
        setTempTimer(prof.rest_timer_seconds.toString())
      }

      // Load templates
      const { data: tData } = await supabase
        .from('workout_templates')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name', { ascending: true })
      if (tData) {
        setTemplates(tData)
      }

      // 1. Classic Übungen laden
      const { data: exData } = await supabase
        .from('exercises')
        .select('id, name, muscle_group')
        .eq('type', 'classic')
      if (exData) {
        setExercises(exData)
      }

      // 2. Workout laden/erstellen
      const { start: dateStart, end: dateEnd } = getGermanDateBounds(selectedDate)
      const todayStart = getGermanDateBounds(new Date()).start

      // Fetch workout for selected date
      const { data: selectedWorkouts } = await supabase
        .from('workouts')
        .select('id, status')
        .eq('user_id', user.id)
        .gte('start_time', dateStart.toISOString())
        .lte('start_time', dateEnd.toISOString())
        .order('start_time', { ascending: false })
        .limit(1)

      // Veraltete aktive Workouts automatisch abschließen
      await supabase.from('workouts')
        .update({ status: 'completed', completed_at: new Date(todayStart.getTime() - 1000).toISOString() })
        .eq('user_id', user.id)
        .eq('status', 'active')
        .lt('start_time', todayStart.toISOString())

      let wid: string | null = null
      let completedState = false

      if (selectedWorkouts && selectedWorkouts.length > 0) {
        wid = selectedWorkouts[0].id
        completedState = selectedWorkouts[0].status === 'completed'
      } else {
        // Nur für Heute automatisch anlegen
        const isToday = getGermanDateString(selectedDate) === getGermanDateString(new Date())
        if (isToday) {
          const { data: nw } = await supabase.from('workouts')
            .insert({ user_id: user.id, status: 'active' })
            .select('id')
            .single()
          if (nw) {
            wid = nw.id
          }
        }
      }

      setWorkoutId(wid)
      setIsCompleted(completedState)

      if (wid) {
        const { data: existingSets } = await supabase
          .from('sets')
          .select('exercise_id, weight_kg, reps, round_number')
          .eq('workout_id', wid)

        const loadedSets: Record<string, SetItem[]> = {}
        existingSets?.forEach(s => {
          if (!loadedSets[s.exercise_id]) loadedSets[s.exercise_id] = []
          loadedSets[s.exercise_id].push({
            weight: s.weight_kg?.toString() ?? '',
            reps: s.reps?.toString() ?? '12',
            round_number: s.round_number
          })
        })

        // Nach round_number aufsteigend sortieren
        Object.keys(loadedSets).forEach(exId => {
          loadedSets[exId].sort((a, b) => a.round_number - b.round_number)
        })

        setSets(loadedSets)
      } else {
        setSets({})
      }

      setLoading(false)
    }
    load()
  }, [selectedDate])

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
      })
      .select('id')
      .single()

    if (nw) {
      setWorkoutId(nw.id)
      setIsCompleted(false)
      setSets({})
      if (exercises.length > 0) {
        setActivePanel(exercises[0].id)
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

  const handleCreateCustomExercise = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customExName) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('exercises')
      .insert({
        name: customExName,
        muscle_group: customExGroup,
        type: 'classic',
        user_id: user.id
      })
      .select('id, name, muscle_group')
      .single()

    if (!error && data) {
      setExercises(prev => [...prev, data])
      setActivePanel(data.id)
      setCustomExName('')
      setCustomExOpen(false)
    }
  }

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!templateName) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setSavingTemplate(true)

    // Find exercise IDs that have logged sets today
    const activeExIds = Object.keys(sets).filter(exId => sets[exId] && sets[exId].length > 0)
    if (activeExIds.length === 0) {
      alert(lang === 'de' ? 'Füge zuerst Sätze zu mindestens einer Übung hinzu.' : lang === 'ru' ? 'Сначала добавьте сеты хотя бы к одному упражнению.' : 'Add sets to at least one exercise first.')
      setSavingTemplate(false)
      return
    }

    // 1. Insert template header
    const { data: temp, error: tempErr } = await supabase
      .from('workout_templates')
      .insert({ name: templateName, user_id: user.id })
      .select('id, name')
      .single()

    if (!tempErr && temp) {
      // 2. Insert exercises
      const items = activeExIds.map((exId, idx) => ({
        template_id: temp.id,
        exercise_id: exId,
        sequence_number: idx + 1
      }))

      await supabase.from('workout_template_exercises').insert(items)
      setTemplates(prev => [...prev, temp].sort((a, b) => a.name.localeCompare(b.name)))
      setTemplateName('')
      setTemplateOpen(false)
    }
    setSavingTemplate(false)
  }

  const handleLoadTemplate = async () => {
    if (!selectedTemplateId) return
    setLoadingTemplates(true)

    const { data: items, error } = await supabase
      .from('workout_template_exercises')
      .select('exercise_id')
      .eq('template_id', selectedTemplateId)
      .order('sequence_number', { ascending: true })

    if (!error && items) {
      const ids = items.map(i => i.exercise_id)
      setTemplateFilterIds(ids)
      const selectedT = templates.find(t => t.id === selectedTemplateId)
      setActiveTemplateName(selectedT?.name || '')
      setTemplateOpen(false)
      
      // Auto-open first exercise
      if (ids.length > 0) {
        setActivePanel(ids[0])
      }
    }
    setLoadingTemplates(false)
  }

  const handleAddSet = async (exId: string) => {
    if (!currentWeight || !currentReps || !workoutId) return
    const wVal = parseFloat(currentWeight)
    const rVal = parseInt(currentReps, 10)
    if (isNaN(wVal) || isNaN(rVal) || wVal < 0 || rVal <= 0) return

    const currentExSets = sets[exId] || []
    const nextRound = currentExSets.length > 0 ? Math.max(...currentExSets.map(s => s.round_number)) + 1 : 1

    const { error } = await supabase.from('sets').upsert(
      {
        workout_id: workoutId,
        exercise_id: exId,
        round_number: nextRound,
        weight_kg: wVal,
        reps: rVal,
        created_at: new Date().toISOString()
      },
      { onConflict: 'workout_id,exercise_id,round_number' }
    )

    if (!error) {
      setSets(prev => {
        const current = prev[exId] || []
        const updated = [...current, { weight: wVal.toString(), reps: rVal.toString(), round_number: nextRound }]
        return {
          ...prev,
          [exId]: updated.sort((a, b) => a.round_number - b.round_number)
        }
      })
      setCurrentWeight('')
      setCurrentReps('')

      // Trigger Rest Timer
      if (restTimerSeconds > 0) {
        setTimerDuration(restTimerSeconds)
        setTimerOpen(false) // Reset
        setTimeout(() => setTimerOpen(true), 50)
      }
    }
  }

  const handleDeleteSet = async (exId: string, roundNum: number) => {
    if (!workoutId) return
    const { error } = await supabase.from('sets')
      .delete()
      .eq('workout_id', workoutId)
      .eq('exercise_id', exId)
      .eq('round_number', roundNum)

    if (!error) {
      setSets(prev => ({
        ...prev,
        [exId]: (prev[exId] || []).filter(s => s.round_number !== roundNum)
      }))
    }
  }

  const openEditDialog = (ex: Exercise, setItem: SetItem) => {
    setDialogExercise(ex)
    setDialogRound(setItem.round_number)
    setDialogWeight(setItem.weight)
    setDialogReps(setItem.reps)
    setDialogOpen(true)
  }

  const handleSaveDialogSet = async () => {
    if (!dialogExercise || dialogRound === null || !workoutId) return
    const wVal = parseFloat(dialogWeight)
    const rVal = parseInt(dialogReps, 10)
    if (isNaN(wVal) || isNaN(rVal) || wVal < 0 || rVal <= 0) return

    const { error } = await supabase.from('sets').upsert(
      {
        workout_id: workoutId,
        exercise_id: dialogExercise.id,
        round_number: dialogRound,
        weight_kg: wVal,
        reps: rVal,
        created_at: new Date().toISOString()
      },
      { onConflict: 'workout_id,exercise_id,round_number' }
    )

    if (!error) {
      setSets(prev => {
        const current = prev[dialogExercise.id] || []
        const updated = current.map(s => {
          if (s.round_number === dialogRound) {
            return { ...s, weight: wVal.toString(), reps: rVal.toString() }
          }
          return s
        })
        return {
          ...prev,
          [dialogExercise.id]: updated
        }
      })
      setDialogOpen(false)
      setDialogExercise(null)
      setDialogRound(null)
    }
  }

  const togglePanel = (id: string) => {
    setActivePanel(prev => prev === id ? null : id)
  }

  const finishTraining = async () => {
    setTimerOpen(false)
    if (!workoutId) return
    setFinishing(true)
    await supabase.from('workouts')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', workoutId)
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

  const handleSavePageSettings = async () => {
    setSettingsSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSettingsSaving(false); return }

    const tVal = parseInt(tempTimer, 10) || 90

    const { error } = await supabase
      .from('profiles')
      .update({ rest_timer_seconds: tVal })
      .eq('id', user.id)

    if (!error) {
      setRestTimerSeconds(tVal)
      setTimerDuration(tVal)
      setPageSettingsOpen(false)
    }
    setSettingsSaving(false)
  }

  const totalCompletedSets = Object.values(sets).reduce((sum, setList) => sum + setList.length, 0)
  const estimatedKcal = Math.round(totalCompletedSets * 2.5 * 4.0 * userWeight / 60)

  const isToday = getGermanDateString(selectedDate) === getGermanDateString(new Date())

  if (loading) {
    return <div className="flex justify-center items-center h-full mt-20"><Loader2 className="spin text-accent" size={32} /></div>
  }

  return (
    <div className="animate-fade-in pb-8">
      <header className="page-header pb-3">
        <div>
          <h1 className="page-header-title">{t(lang, 'classicTraining')}</h1>
          <p className="text-secondary" style={{ fontSize: '0.85rem' }}>
            {isCompleted ? t(lang, 'trainingDone') : t(lang, 'freeWeights')}
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
        {workoutId && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <button 
              className="btn btn-secondary flex-1" 
              style={{ fontSize: '0.8rem', padding: '8px 12px', minHeight: 'auto' }}
              onClick={() => setCustomExOpen(true)}
            >
              ➕ {t(lang, 'addExercise')}
            </button>
            <button 
              className="btn btn-secondary flex-1" 
              style={{ fontSize: '0.8rem', padding: '8px 12px', minHeight: 'auto' }}
              onClick={() => setTemplateOpen(true)}
            >
              📋 {t(lang, 'templates')}
            </button>
          </div>
        )}

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
            {templateFilterIds && (
              <div className="card mb-3" style={{ background: 'var(--accent-dim)', borderColor: 'var(--accent)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent)' }}>
                  📋 {t(lang, 'templates')}: {activeTemplateName}
                </span>
                <button 
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '2px 8px', minHeight: 'auto', fontSize: '0.75rem', textDecoration: 'underline' }}
                  onClick={() => { setTemplateFilterIds(null); setActiveTemplateName(''); }}
                >
                  {lang === 'de' ? 'Alle anzeigen' : lang === 'ru' ? 'Показать все' : 'Show all'}
                </button>
              </div>
            )}

            {exercises
              .filter((ex) => !templateFilterIds || templateFilterIds.includes(ex.id))
              .map((ex) => {
                const isActive = activePanel === ex.id
                const exerciseSets = sets[ex.id] || []

                return (
                  <div 
                    key={ex.id} 
                    className={`exercise-panel ${isActive ? 'active' : ''}`}
                  >
                  <div 
                    className="panel-header" 
                    onClick={() => togglePanel(ex.id)}
                  >
                    <div className="panel-status-icon">
                      <Play size={18} className="text-accent" />
                    </div>
                    
                    <div className="panel-title">{ex.name}</div>
                    
                    {exerciseSets.length > 0 && (
                      <div className="badge badge-accent">
                        {exerciseSets.length} {exerciseSets.length === 1 ? t(lang, 'setWord') : t(lang, 'setsWord')}
                      </div>
                    )}
                    
                    <ChevronDown size={20} className="panel-chevron" />
                  </div>

                  {isActive && (
                    <div className="panel-body animate-slide-down">
                      {/* Sätze Historie */}
                      {exerciseSets.length > 0 && (
                        <div className="mb-4 flex flex-col gap-2">
                          <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                            {t(lang, 'todaySets')}
                          </div>
                          {exerciseSets.map((set, index) => (
                            <div key={index} className="set-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                              <div className="set-number" style={{ flex: 1 }}>{t(lang, 'setWord')} {index + 1}</div>
                              <div style={{ minWidth: 60 }}><strong>{set.weight}</strong> kg</div>
                              <div style={{ minWidth: 60 }}><strong>{set.reps}</strong> {lang === 'ru' ? 'повт' : 'Wdh'}</div>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button className="text-muted" style={{ padding: 4 }} onClick={() => openEditDialog(ex, set)}>
                                  <Edit2 size={14} />
                                </button>
                                <button className="text-muted" style={{ padding: 4, color: 'var(--danger)' }} onClick={() => handleDeleteSet(ex.id, set.round_number)}>
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {!isCompleted && (
                        <>
                          <div className="input-row mt-2">
                            <div className="input-group">
                              <label className="input-label">{t(lang, 'weightLabel')}</label>
                              <input 
                                type="number" 
                                className="input-field" 
                                placeholder="z.B. 60"
                                value={currentWeight}
                                onChange={(e) => setCurrentWeight(e.target.value)}
                              />
                            </div>
                            <div className="input-group">
                              <label className="input-label">{t(lang, 'repsLabel')}</label>
                              <input 
                                type="number" 
                                className="input-field" 
                                placeholder="z.B. 10"
                                value={currentReps}
                                onChange={(e) => setCurrentReps(e.target.value)}
                              />
                            </div>
                          </div>

                          <div className="mt-4">
                            <button 
                              className="btn btn-primary btn-full"
                              onClick={() => handleAddSet(ex.id)}
                              disabled={!currentWeight || !currentReps}
                            >
                              <Plus size={18} />
                              {t(lang, 'addSetBtn')}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Workout Abschluss Panel */}
            {isCompleted ? (
              <div className="mt-6 mb-4">
                <div className="card text-center py-4">
                  <span style={{ fontSize: '1.5rem', marginBottom: 4, display: 'block' }}>✓</span>
                  <p style={{ fontWeight: 600, fontSize: '0.92rem' }}>{t(lang, 'trainingDone')}</p>
                  <p className="text-secondary mb-3" style={{ fontSize: '0.78rem' }}>{t(lang, 'trainingDoneMsg')}</p>
                  {estimatedKcal > 0 && (
                    <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>
                      🔥 {t(lang, 'estCalorieBurn')}: <span style={{ color: 'var(--accent)' }}>{estimatedKcal} {t(lang, 'kcal')}</span>
                    </p>
                  )}
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }} onClick={resumeTraining}>
                    {t(lang, 'resumeTraining')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-6 mb-4">
                {estimatedKcal > 0 && (
                  <div style={{ textAlign: 'center', marginBottom: 10, fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                    ⚡ {t(lang, 'estCalorieBurn')}: <strong style={{ color: 'var(--accent)' }}>{estimatedKcal} {t(lang, 'kcal')}</strong>
                  </div>
                )}
                <button className="btn btn-primary btn-full" onClick={finishTraining} disabled={finishing}>
                  {finishing ? <Loader2 size={18} className="spin" /> : <Check size={20} />}
                  {finishing ? t(lang, 'saving2') : t(lang, 'finishTraining')}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Set Edit Modal (consistent with egym training) */}
      {dialogOpen && dialogExercise && dialogRound !== null && (
        <div 
          className="max-lift-modal-backdrop animate-fade-in"
          onClick={() => { setDialogOpen(false); setDialogExercise(null); setDialogRound(null); }}
        >
          <div 
            className="max-lift-modal animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '280px', padding: '20px', borderRadius: 'var(--radius-lg)' }}
          >
            <h3 style={{ fontWeight: 600, fontSize: '0.98rem', marginBottom: 16, textAlign: 'center' }}>
              {t(lang, 'editSet')}
            </h3>
            <p className="text-secondary text-sm text-center mb-4" style={{ fontWeight: 500 }}>
              {dialogExercise.name} — {t(lang, 'setWord')} {dialogRound}
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {t(lang, 'weightLabel')}
                </label>
                <input
                  type="number"
                  className="input-field"
                  value={dialogWeight}
                  onChange={(e) => setDialogWeight(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {t(lang, 'repsLabel')}
                </label>
                <input
                  type="number"
                  className="input-field"
                  value={dialogReps}
                  onChange={(e) => setDialogReps(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                className="btn btn-ghost" 
                style={{ flex: 1, border: '1px solid var(--border)' }}
                onClick={() => { setDialogOpen(false); setDialogExercise(null); setDialogRound(null); }}
              >
                {t(lang, 'cancel')}
              </button>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1 }}
                onClick={handleSaveDialogSet}
                disabled={!dialogWeight || !dialogReps}
              >
                {t(lang, 'save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Exercise creation dialog */}
      {customExOpen && (
        <div className="max-lift-modal-backdrop animate-fade-in" onClick={() => setCustomExOpen(false)}>
          <div className="max-lift-modal animate-scale-in" onClick={e => e.stopPropagation()} style={{ width: '290px', padding: '20px' }}>
            <h3 style={{ fontWeight: 600, fontSize: '0.98rem', marginBottom: 16, textAlign: 'center' }}>
              {t(lang, 'addExercise')}
            </h3>
            <form onSubmit={handleCreateCustomExercise} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="input-group">
                <label className="input-label">{t(lang, 'exerciseName')}</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="z.B. Bankdrücken"
                  value={customExName} 
                  onChange={e => setCustomExName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="input-group">
                <label className="input-label">{t(lang, 'muscleGroup')}</label>
                <select 
                  className="input-field"
                  value={customExGroup}
                  onChange={e => setCustomExGroup(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}
                >
                  <option value="Brust">{t(lang, 'muscleChest')}</option>
                  <option value="Rücken">{t(lang, 'muscleBack')}</option>
                  <option value="Schulter">{t(lang, 'muscleShoulders')}</option>
                  <option value="Bizeps">{t(lang, 'muscleBiceps')}</option>
                  <option value="Trizeps">{t(lang, 'muscleTriceps')}</option>
                  <option value="Bauch">{t(lang, 'muscleAbs')}</option>
                  <option value="Beine">{t(lang, 'muscleLegs')}</option>
                </select>
              </div>
              <div className="flex gap-2 mt-2" style={{ display: 'flex' }}>
                <button type="button" className="btn btn-secondary flex-1" onClick={() => setCustomExOpen(false)}>
                  {t(lang, 'cancel')}
                </button>
                <button type="submit" className="btn btn-primary flex-1" disabled={!customExName}>
                  {t(lang, 'createBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Template Dialog Modal */}
      {templateOpen && (
        <div className="max-lift-modal-backdrop animate-fade-in" onClick={() => setTemplateOpen(false)}>
          <div className="max-lift-modal animate-scale-in" onClick={e => e.stopPropagation()} style={{ width: '310px', padding: '20px' }}>
            <h3 style={{ fontWeight: 600, fontSize: '0.98rem', marginBottom: 16, textAlign: 'center' }}>
              {t(lang, 'templates')}
            </h3>

            {/* Load Template Section */}
            <div className="mb-4">
              <p className="text-secondary text-xs uppercase font-bold tracking-wider mb-2">
                {t(lang, 'loadTemplate')}
              </p>
              {templates.length === 0 ? (
                <p className="text-muted text-center py-2 text-sm">
                  {t(lang, 'noTemplates')}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <select
                    className="input-field"
                    value={selectedTemplateId}
                    onChange={e => setSelectedTemplateId(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}
                  >
                    <option value="">-- {t(lang, 'selectTemplate')} --</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <button 
                    className="btn btn-primary btn-sm btn-full"
                    disabled={!selectedTemplateId || loadingTemplates}
                    onClick={handleLoadTemplate}
                  >
                    {loadingTemplates ? <Loader2 size={14} className="spin" /> : null}
                    {t(lang, 'loadTemplate')}
                  </button>
                </div>
              )}
            </div>

            <hr style={{ border: '0', borderTop: '1px solid var(--border)', margin: '16px 0' }} />

            {/* Save Template Section */}
            <div>
              <p className="text-secondary text-xs uppercase font-bold tracking-wider mb-2">
                {t(lang, 'saveTemplate')}
              </p>
              <form onSubmit={handleSaveTemplate} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder={t(lang, 'templateName')}
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  required
                />
                <button 
                  type="submit" 
                  className="btn btn-secondary btn-sm btn-full" 
                  disabled={savingTemplate || !templateName}
                >
                  {savingTemplate ? <Loader2 size={14} className="spin" /> : null}
                  {t(lang, 'save')}
                </button>
              </form>
            </div>

            <button 
              className="btn btn-ghost btn-sm btn-full mt-4" 
              style={{ border: '1px solid var(--border)' }}
              onClick={() => setTemplateOpen(false)}
            >
              {t(lang, 'cancel')}
            </button>
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
