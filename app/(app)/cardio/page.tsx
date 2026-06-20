'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, Plus, Edit2, Trash2, ChevronLeft, ChevronRight, Calendar, Loader2, Check, Info, Bike, Waves, Flame, Activity } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/LanguageContext'
import { t } from '@/lib/i18n'
import { getGermanDateBounds, getGermanDateString } from '@/lib/dateUtils'
import { useWakeLock } from '@/hooks/useWakeLock'
import { enqueueSetUpsert, processSyncQueue } from '@/lib/syncQueue'

type Exercise = { id: string; name: string; muscle_group: string; type: string }

type SetItem = {
  workout_id: string
  exercise_id: string
  round_number: number
  duration_seconds?: number
  elapsed_seconds?: number
  distance_m?: number
  active_kcal?: number
  total_kcal?: number
  elevation_gain_m?: number
  avg_speed_kmh?: number
  avg_pace?: string
  avg_heart_rate_bpm?: number
  laps?: number
  pool_length_m?: number
  avg_cadence_spm?: number
  created_at?: string
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
  return date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })
}

function formatSeconds(totalSecs: number | undefined): string {
  if (!totalSecs) return '--'
  const h = Math.floor(totalSecs / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  const s = totalSecs % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function CardioTrainingPage() {
  useWakeLock()
  const supabase = createClient()
  const { lang } = useLang()

  const [exercises, setExercises] = useState<Exercise[]>([])
  const [sets, setSets] = useState<Record<string, SetItem[]>>({})
  const [loading, setLoading] = useState(true)
  const [workoutId, setWorkoutId] = useState<string | null>(null)
  const [isCompleted, setIsCompleted] = useState(false)
  const [activePanel, setActivePanel] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
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

  // Inputs for logging new Cardio set
  const [durationH, setDurationH] = useState('')
  const [durationM, setDurationM] = useState('')
  const [durationS, setDurationS] = useState('')

  const [elapsedH, setElapsedH] = useState('')
  const [elapsedM, setElapsedM] = useState('')
  const [elapsedS, setElapsedS] = useState('')

  const [distance, setDistance] = useState('') // KM or M depending on exercise
  const [activeKcal, setActiveKcal] = useState('')
  const [totalKcal, setTotalKcal] = useState('')
  const [elevationGain, setElevationGain] = useState('')
  const [avgSpeed, setAvgSpeed] = useState('')

  const [paceMin, setPaceMin] = useState('')
  const [paceSec, setPaceSec] = useState('')

  const [avgHeartRate, setAvgHeartRate] = useState('')
  const [laps, setLaps] = useState('')
  const [poolLength, setPoolLength] = useState('25')
  const [avgCadence, setAvgCadence] = useState('')

  // Custom distance unit for custom cardio exercises
  const [customDistanceUnit, setCustomDistanceUnit] = useState<'km' | 'm'>('km')

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editExercise, setEditExercise] = useState<Exercise | null>(null)
  const [editRound, setEditRound] = useState<number | null>(null)
  
  // Custom Exercise creation states
  const [customExOpen, setCustomExOpen] = useState(false)
  const [customExName, setCustomExName] = useState('')
  const [customExGroup, setCustomExGroup] = useState('Ausdauer')

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

  // Fetch Exercises and Sets for selectedDate
  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      // Fetch cardio exercises
      const { data: exData, error: exErr } = await supabase
        .from('exercises')
        .select('*')
        .eq('type', 'cardio')
      
      const defaultCardioList = [
        { id: 'd1b4a0f4-5f11-4770-ae0e-9c716766440b', name: 'Rad outdoor', muscle_group: 'Ausdauer', type: 'cardio' },
        { id: 'e2c5b105-6a22-4881-bf1f-ad827877551c', name: 'Beckenschwimmen', muscle_group: 'Ausdauer', type: 'cardio' },
        { id: 'f3d6c216-7b33-4992-c020-be938988662d', name: 'Freiwasserschwimmen', muscle_group: 'Ausdauer', type: 'cardio' },
        { id: 'a4e7d327-8c44-4aa3-d131-cf049099773e', name: 'Laufen indoor', muscle_group: 'Ausdauer', type: 'cardio' },
        { id: 'b5f8e438-9d55-4bb4-e242-d01501aa884f', name: 'Laufen outdoor', muscle_group: 'Ausdauer', type: 'cardio' }
      ]

      let list = exData || []
      if (list.length === 0) {
        list = defaultCardioList
      }
      setExercises(list)

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

      // Veraltete aktive Workouts abschließen
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
          .from('sets')
          .select('*')
          .eq('workout_id', wid)

        const loadedSets: Record<string, SetItem[]> = {}
        existingSets?.forEach(s => {
          if (!loadedSets[s.exercise_id]) loadedSets[s.exercise_id] = []
          loadedSets[s.exercise_id].push({
            workout_id: s.workout_id,
            exercise_id: s.exercise_id,
            round_number: s.round_number,
            duration_seconds: s.duration_seconds,
            elapsed_seconds: s.elapsed_seconds,
            distance_m: s.distance_m ? parseFloat(s.distance_m.toString()) : undefined,
            active_kcal: s.active_kcal,
            total_kcal: s.total_kcal,
            elevation_gain_m: s.elevation_gain_m,
            avg_speed_kmh: s.avg_speed_kmh ? parseFloat(s.avg_speed_kmh.toString()) : undefined,
            avg_pace: s.avg_pace,
            avg_heart_rate_bpm: s.avg_heart_rate_bpm,
            laps: s.laps,
            pool_length_m: s.pool_length_m,
            avg_cadence_spm: s.avg_cadence_spm,
            created_at: s.created_at
          })
        })

        // Sort rounds
        Object.keys(loadedSets).forEach(exId => {
          loadedSets[exId].sort((a, b) => a.round_number - b.round_number)
        })

        setSets(loadedSets)
        
        // Auto-open first panel
        if (list.length > 0 && !activePanel) {
          setActivePanel(list[0].id)
        }
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

  const clearInputForm = () => {
    setDurationH('')
    setDurationM('')
    setDurationS('')
    setElapsedH('')
    setElapsedM('')
    setElapsedS('')
    setDistance('')
    setActiveKcal('')
    setTotalKcal('')
    setElevationGain('')
    setAvgSpeed('')
    setPaceMin('')
    setPaceSec('')
    setAvgHeartRate('')
    setLaps('')
    setAvgCadence('')
  }

  const togglePanel = (exId: string) => {
    setActivePanel(prev => (prev === exId ? null : exId))
    clearInputForm()
  }

  const getExerciseIcon = (name: string) => {
    const n = name.toLowerCase()
    if (n.includes('rad') || n.includes('cycling') || n.includes('bike')) {
      return <Bike size={18} className="text-accent" />
    }
    if (n.includes('schwimm') || n.includes('swim') || n.includes('wasser')) {
      return <Waves size={18} className="text-accent" />
    }
    if (n.includes('lauf') || n.includes('run') || n.includes('jog')) {
      return <Activity size={18} className="text-accent" />
    }
    return <Flame size={18} className="text-accent" />
  }

  // Handle adding a cardio entry
  const handleAddCardio = async (ex: Exercise) => {
    if (!workoutId) return

    // 1. Calculate duration
    const dh = parseInt(durationH || '0', 10)
    const dm = parseInt(durationM || '0', 10)
    const ds = parseInt(durationS || '0', 10)
    const duration_seconds = dh * 3600 + dm * 60 + ds
    if (duration_seconds <= 0) return // Duration is mandatory for cardio

    // 2. Calculate elapsed duration
    const eh = parseInt(elapsedH || '0', 10)
    const em = parseInt(elapsedM || '0', 10)
    const es = parseInt(elapsedS || '0', 10)
    const elapsed_seconds = eh * 3600 + em * 60 + es || undefined

    // 3. Distance conversion
    let distance_m: number | undefined = undefined
    if (distance) {
      const distVal = parseFloat(distance.replace(',', '.'))
      if (!isNaN(distVal) && distVal > 0) {
        const lowerName = ex.name.toLowerCase()
        const isSwim = lowerName.includes('schwimm') || lowerName.includes('swim')
        const isCustomMeters = ex.type === 'cardio' && !isSwim && customDistanceUnit === 'm'
        
        if (isSwim || isCustomMeters) {
          distance_m = distVal // swimming or custom meters is directly in meters
        } else {
          distance_m = distVal * 1000 // running, cycling is in KM, convert to meters
        }
      }
    }

    // 4. Pace calculations
    let avg_pace: string | undefined = undefined
    if (paceMin || paceSec) {
      const pm = paceMin || '0'
      const ps = String(parseInt(paceSec || '0', 10)).padStart(2, '0')
      const lowerName = ex.name.toLowerCase()
      if (lowerName.includes('schwimm') || lowerName.includes('swim')) {
        avg_pace = `${pm}'${ps}" / 100m`
      } else {
        avg_pace = `${pm}'${ps}" / km`
      }
    }

    const active_kcal = parseInt(activeKcal, 10) || undefined
    const total_kcal = parseInt(totalKcal, 10) || undefined
    const elevation_gain_m = parseInt(elevationGain, 10) || undefined
    const avg_speed_kmh = parseFloat(avgSpeed.replace(',', '.')) || undefined
    const avg_heart_rate_bpm = parseInt(avgHeartRate, 10) || undefined
    const lapsVal = parseInt(laps, 10) || undefined
    const pool_length_m = parseInt(poolLength, 10) || undefined
    const avg_cadence_spm = parseInt(avgCadence, 10) || undefined

    const currentExSets = sets[ex.id] || []
    const nextRound = currentExSets.length > 0 ? Math.max(...currentExSets.map(s => s.round_number)) + 1 : 1

    const newSet: SetItem = {
      workout_id: workoutId,
      exercise_id: ex.id,
      round_number: nextRound,
      duration_seconds,
      elapsed_seconds,
      distance_m,
      active_kcal,
      total_kcal,
      elevation_gain_m,
      avg_speed_kmh,
      avg_pace,
      avg_heart_rate_bpm,
      laps: lapsVal,
      pool_length_m,
      avg_cadence_spm,
      created_at: new Date().toISOString()
    }

    // Optimistic UI Update
    setSets(prev => {
      const current = prev[ex.id] || []
      const updated = [...current, newSet]
      return {
        ...prev,
        [ex.id]: updated.sort((a, b) => a.round_number - b.round_number)
      }
    })

    clearInputForm()

    // Background Database Upsert
    enqueueSetUpsert(newSet)
    
    // Attempt instant save
    supabase.from('sets').upsert(newSet, { onConflict: 'workout_id,exercise_id,round_number' })
      .then(({ error }) => {
        if (!error) {
          // Remove from local storage queue since it succeeded immediately
          const q = localStorage.getItem('egym_offline_sets_queue')
          if (q) {
            try {
              const parsed = JSON.parse(q) as SetItem[]
              const filtered = parsed.filter(item => !(item.workout_id === newSet.workout_id && item.exercise_id === newSet.exercise_id && item.round_number === newSet.round_number))
              localStorage.setItem('egym_offline_sets_queue', JSON.stringify(filtered))
              window.dispatchEvent(new Event('sync-queue-updated'))
            } catch (e) {}
          }
        }
      })
  }

  // Handle deleting a cardio set
  const handleDeleteCardio = async (exId: string, roundNum: number) => {
    if (!workoutId) return

    // Optimistic delete
    setSets(prev => ({
      ...prev,
      [exId]: (prev[exId] || []).filter(s => s.round_number !== roundNum)
    }))

    const { error } = await supabase.from('sets')
      .delete()
      .eq('workout_id', workoutId)
      .eq('exercise_id', exId)
      .eq('round_number', roundNum)

    if (error) {
      // Re-fetch or log if delete failed
      console.error('Delete failed', error)
    }
  }

  // Edit Set Dialog Setup
  const openEditDialog = (ex: Exercise, set: SetItem) => {
    setEditExercise(ex)
    setEditRound(set.round_number)

    // Load inputs
    const dSecs = set.duration_seconds || 0
    setDurationH(dSecs >= 3600 ? Math.floor(dSecs / 3600).toString() : '')
    setDurationM(Math.floor((dSecs % 3600) / 60).toString())
    setDurationS((dSecs % 60).toString())

    const eSecs = set.elapsed_seconds || 0
    if (eSecs > 0) {
      setElapsedH(Math.floor(eSecs / 3600).toString())
      setElapsedM(Math.floor((eSecs % 3600) / 60).toString())
      setElapsedS((eSecs % 60).toString())
    } else {
      setElapsedH('')
      setElapsedM('')
      setElapsedS('')
    }

    // Distance M to unit
    if (set.distance_m) {
      const lowerName = ex.name.toLowerCase()
      const isSwim = lowerName.includes('schwimm') || lowerName.includes('swim')
      if (isSwim) {
        setDistance(set.distance_m.toString())
      } else {
        setDistance((set.distance_m / 1000).toString())
      }
    } else {
      setDistance('')
    }

    setActiveKcal(set.active_kcal?.toString() ?? '')
    setTotalKcal(set.total_kcal?.toString() ?? '')
    setElevationGain(set.elevation_gain_m?.toString() ?? '')
    setAvgSpeed(set.avg_speed_kmh?.toString() ?? '')

    if (set.avg_pace) {
      const cleanPace = set.avg_pace.split(' ')[0] || '' // get "8'05"" or "4'33""
      const parts = cleanPace.split("'")
      if (parts.length >= 2) {
        setPaceMin(parts[0])
        setPaceSec(parts[1].replace('"', ''))
      }
    } else {
      setPaceMin('')
      setPaceSec('')
    }

    setAvgHeartRate(set.avg_heart_rate_bpm?.toString() ?? '')
    setLaps(set.laps?.toString() ?? '')
    setPoolLength(set.pool_length_m?.toString() ?? '25')
    setAvgCadence(set.avg_cadence_spm?.toString() ?? '')

    setEditDialogOpen(true)
  }

  const handleSaveEditedCardio = async () => {
    if (!workoutId || !editExercise || editRound === null) return

    const dh = parseInt(durationH || '0', 10)
    const dm = parseInt(durationM || '0', 10)
    const ds = parseInt(durationS || '0', 10)
    const duration_seconds = dh * 3600 + dm * 60 + ds
    if (duration_seconds <= 0) return

    const eh = parseInt(elapsedH || '0', 10)
    const em = parseInt(elapsedM || '0', 10)
    const es = parseInt(elapsedS || '0', 10)
    const elapsed_seconds = eh * 3600 + em * 60 + es || undefined

    let distance_m: number | undefined = undefined
    if (distance) {
      const distVal = parseFloat(distance.replace(',', '.'))
      if (!isNaN(distVal) && distVal > 0) {
        const lowerName = editExercise.name.toLowerCase()
        const isSwim = lowerName.includes('schwimm') || lowerName.includes('swim')
        if (isSwim) {
          distance_m = distVal
        } else {
          distance_m = distVal * 1000
        }
      }
    }

    let avg_pace: string | undefined = undefined
    if (paceMin || paceSec) {
      const pm = paceMin || '0'
      const ps = String(parseInt(paceSec || '0', 10)).padStart(2, '0')
      const lowerName = editExercise.name.toLowerCase()
      if (lowerName.includes('schwimm') || lowerName.includes('swim')) {
        avg_pace = `${pm}'${ps}" / 100m`
      } else {
        avg_pace = `${pm}'${ps}" / km`
      }
    }

    const updatedSet: SetItem = {
      workout_id: workoutId,
      exercise_id: editExercise.id,
      round_number: editRound,
      duration_seconds,
      elapsed_seconds,
      distance_m,
      active_kcal: parseInt(activeKcal, 10) || undefined,
      total_kcal: parseInt(totalKcal, 10) || undefined,
      elevation_gain_m: parseInt(elevationGain, 10) || undefined,
      avg_speed_kmh: parseFloat(avgSpeed.replace(',', '.')) || undefined,
      avg_pace,
      avg_heart_rate_bpm: parseInt(avgHeartRate, 10) || undefined,
      laps: parseInt(laps, 10) || undefined,
      pool_length_m: parseInt(poolLength, 10) || undefined,
      avg_cadence_spm: parseInt(avgCadence, 10) || undefined,
      created_at: new Date().toISOString()
    }

    // UI Update
    setSets(prev => {
      const current = prev[editExercise.id] || []
      const updated = current.map(s => s.round_number === editRound ? updatedSet : s)
      return {
        ...prev,
        [editExercise.id]: updated
      }
    })

    setEditDialogOpen(false)
    clearInputForm()

    // DB update
    await supabase.from('sets').upsert(updatedSet, { onConflict: 'workout_id,exercise_id,round_number' })
  }

  // Create custom exercise
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
        type: 'cardio',
        user_id: user.id
      })
      .select('*')
      .single()

    if (!error && data) {
      setExercises(prev => [...prev, data])
      setActivePanel(data.id)
      setCustomExName('')
      setCustomExOpen(false)
    }
  }

  // Finish current workout
  const handleFinishWorkout = async () => {
    if (!workoutId) return
    const { error } = await supabase.from('workouts')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', workoutId)
    if (!error) {
      setIsCompleted(true)
    }
  }

  return (
    <div className="animate-fade-in pb-12">
      {/* Page Header */}
      <header className="page-header pb-3" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ChevronLeft 
            size={24} 
            className="text-muted" 
            style={{ cursor: 'pointer' }} 
            onClick={() => window.location.href = '/'}
          />
          <div>
            <h1 className="page-header-title">{t(lang, 'cardioTraining')}</h1>
            <p className="text-secondary" style={{ fontSize: '0.8rem' }}>{t(lang, 'cardioDesc')}</p>
          </div>
        </div>
        
        {/* Offline Sync Banner if has items */}
        {hasOfflineSync && (
          <div className="badge badge-accent animate-pulse" title="Ungespeicherte Änderungen liegen in der Offline-Warteschlange.">
            ☁️ Offline
          </div>
        )}
      </header>

      {/* Date Navigation */}
      <div className="flex items-center justify-between mb-4 px-4">
        <button className="btn btn-ghost p-2" onClick={() => navigateDay(-1)}>
          <ChevronLeft size={20} />
        </button>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: '0.95rem' }}>
          <Calendar size={16} className="text-accent" />
          <span>{getDateLabel(selectedDate, lang)}</span>
        </div>

        <button className="btn btn-ghost p-2" onClick={() => navigateDay(1)}>
          <ChevronRight size={20} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12 text-muted">
          <Loader2 className="animate-spin mr-2" size={20} />
          <span>{t(lang, 'saving')}</span>
        </div>
      ) : !workoutId ? (
        /* No active workout view */
        <div className="px-4 text-center py-12 flex flex-col items-center gap-4">
          <p className="text-secondary" style={{ fontSize: '0.9rem', fontStyle: 'italic' }}>
            {lang === 'de' ? 'Für dieses Datum existiert kein Training.' : lang === 'ru' ? 'В этот день тренировок нет.' : 'No training exists for this date.'}
          </p>
          <button className="btn btn-primary" onClick={createRetrospectiveWorkout}>
            {lang === 'de' ? 'Training eintragen' : lang === 'ru' ? 'Начать тренировку' : 'Create training'}
          </button>
        </div>
      ) : (
        /* Active workout view */
        <div className="px-4 flex flex-col gap-4">
          {isCompleted && (
            <div className="card text-center p-3" style={{ border: '1px solid var(--accent)', background: '#00d4aa10' }}>
              <div style={{ fontWeight: 600, color: 'var(--accent)', fontSize: '0.9rem' }}>
                ✓ {t(lang, 'trainingDone')}
              </div>
              <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: 4 }}>
                {t(lang, 'trainingDoneMsg')}
              </p>
            </div>
          )}

          {/* Exercise Panel List */}
          <div className="flex flex-col gap-3">
            {exercises.map((ex) => {
              const isActive = activePanel === ex.id
              const exSets = sets[ex.id] || []
              const lowerName = ex.name.toLowerCase()

              const isSwim = lowerName.includes('schwimm') || lowerName.includes('swim')
              const isPoolSwim = lowerName.includes('beckenschwimm') || lowerName.includes('pool')
              const isRun = lowerName.includes('lauf') || lowerName.includes('run') || lowerName.includes('jog')
              const isCycling = lowerName.includes('rad') || lowerName.includes('cycle') || lowerName.includes('bike')

              return (
                <div key={ex.id} className={`exercise-panel ${isActive ? 'active' : ''}`}>
                  {/* Panel Header */}
                  <div className="panel-header" onClick={() => togglePanel(ex.id)}>
                    <div className="panel-status-icon">
                      {getExerciseIcon(ex.name)}
                    </div>
                    <div className="panel-title">{ex.name}</div>
                    {exSets.length > 0 && (
                      <div className="badge badge-accent">
                        {exSets.length} {exSets.length === 1 ? t(lang, 'setWord') : t(lang, 'setsWord')}
                      </div>
                    )}
                    <ChevronDown size={20} className="panel-chevron" />
                  </div>

                  {/* Panel Body */}
                  {isActive && (
                    <div className="panel-body animate-slide-down">
                      
                      {/* Logged Sets */}
                      {exSets.length > 0 && (
                        <div className="mb-4 flex flex-col gap-2">
                          <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                            {lang === 'de' ? 'Einträge' : lang === 'ru' ? 'Записи' : 'Logs'}
                          </div>
                          {exSets.map((s, idx) => {
                            const isSwimItem = lowerName.includes('schwimm') || lowerName.includes('swim')
                            const formattedDistance = s.distance_m 
                              ? (isSwimItem ? `${s.distance_m} m` : `${(s.distance_m / 1000).toLocaleString(lang === 'de' ? 'de-DE' : 'en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} km`)
                              : ''

                            return (
                              <div key={idx} className="set-item" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontWeight: 600, color: 'var(--accent)', fontSize: '0.85rem' }}>
                                    {lang === 'de' ? 'Lauf' : lang === 'ru' ? 'Забег' : 'Run'} {idx + 1}
                                  </span>
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    <button className="text-muted" style={{ padding: 4 }} onClick={() => openEditDialog(ex, s)}>
                                      <Edit2 size={14} />
                                    </button>
                                    <button className="text-muted" style={{ padding: 4, color: 'var(--danger)' }} onClick={() => handleDeleteCardio(ex.id, s.round_number)}>
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                                
                                {/* Metrics Grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px 12px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                  <div>⏱️ {t(lang, 'durationLabel')}: <strong>{formatSeconds(s.duration_seconds)}</strong></div>
                                  {s.elapsed_seconds && <div>⏳ {t(lang, 'elapsedLabel')}: <strong>{formatSeconds(s.elapsed_seconds)}</strong></div>}
                                  {s.distance_m && <div>📍 {t(lang, 'distanceLabel')}: <strong>{formattedDistance}</strong></div>}
                                  {s.active_kcal && <div>🔥 {t(lang, 'activeKcalLabel')}: <strong>{s.active_kcal} kcal</strong></div>}
                                  {s.total_kcal && <div>🔋 {t(lang, 'totalKcalLabel')}: <strong>{s.total_kcal} kcal</strong></div>}
                                  {s.elevation_gain_m && <div>⛰️ {t(lang, 'elevationLabel')}: <strong>{s.elevation_gain_m} m</strong></div>}
                                  {s.avg_speed_kmh && <div>⚡ {t(lang, 'speedLabel')}: <strong>{s.avg_speed_kmh} km/h</strong></div>}
                                  {s.avg_pace && <div>⏱️ {t(lang, 'paceLabel')}: <strong>{s.avg_pace}</strong></div>}
                                  {s.avg_heart_rate_bpm && <div>❤️ {t(lang, 'hrLabel')}: <strong>{s.avg_heart_rate_bpm} bpm</strong></div>}
                                  {s.laps && <div>🔁 {t(lang, 'lapsLabel')}: <strong>{s.laps}</strong> {s.pool_length_m && <span className="text-muted">({s.pool_length_m}m)</span>}</div>}
                                  {s.avg_cadence_spm && <div>🏃‍♂️ {t(lang, 'cadenceLabel')}: <strong>{s.avg_cadence_spm} spm</strong></div>}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Add Form */}
                      {!isCompleted && (
                        <div className="flex flex-col gap-3 mt-2" style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                          
                          {/* Duration input */}
                          <div className="input-group">
                            <label className="input-label">{t(lang, 'durationLabel')} *</label>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <input type="number" placeholder="Std" className="input-field text-center" style={{ flex: 1 }} value={durationH} onChange={e => setDurationH(e.target.value)} min="0" />
                              <span className="text-muted">:</span>
                              <input type="number" placeholder="Min" className="input-field text-center" style={{ flex: 1 }} value={durationM} onChange={e => setDurationM(e.target.value)} min="0" max="59" />
                              <span className="text-muted">:</span>
                              <input type="number" placeholder="Sek" className="input-field text-center" style={{ flex: 1 }} value={durationS} onChange={e => setDurationS(e.target.value)} min="0" max="59" />
                            </div>
                          </div>

                          {/* Elapsed Time input (only swim or run, or custom) */}
                          {(isSwim || isRun || ex.type === 'cardio') && (
                            <div className="input-group">
                              <label className="input-label">{t(lang, 'elapsedLabel')}</label>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <input type="number" placeholder="Std" className="input-field text-center" style={{ flex: 1 }} value={elapsedH} onChange={e => setElapsedH(e.target.value)} min="0" />
                                <span className="text-muted">:</span>
                                <input type="number" placeholder="Min" className="input-field text-center" style={{ flex: 1 }} value={elapsedM} onChange={e => setElapsedM(e.target.value)} min="0" max="59" />
                                <span className="text-muted">:</span>
                                <input type="number" placeholder="Sek" className="input-field text-center" style={{ flex: 1 }} value={elapsedS} onChange={e => setElapsedS(e.target.value)} min="0" max="59" />
                              </div>
                            </div>
                          )}

                          {/* Distance input */}
                          <div className="input-group">
                            <label className="input-label">{t(lang, 'distanceLabel')} {isSwim ? '(m)' : '(km)'}</label>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <input 
                                type="number" 
                                step="any" 
                                placeholder={isSwim ? 'z.B. 1000' : 'z.B. 5.5'} 
                                className="input-field" 
                                value={distance} 
                                onChange={e => setDistance(e.target.value)} 
                              />
                              {/* Unit selector for custom cardio exercises */}
                              {ex.type === 'cardio' && !isSwim && !isRun && !isCycling && (
                                <select 
                                  className="input-field" 
                                  style={{ width: 'auto' }} 
                                  value={customDistanceUnit} 
                                  onChange={e => setCustomDistanceUnit(e.target.value as any)}
                                >
                                  <option value="km">km</option>
                                  <option value="m">m</option>
                                </select>
                              )}
                            </div>
                          </div>

                          {/* Calories inputs */}
                          <div style={{ display: 'flex', gap: 12 }}>
                            <div className="input-group" style={{ flex: 1 }}>
                              <label className="input-label">{t(lang, 'activeKcalLabel')}</label>
                              <input type="number" placeholder="kcal" className="input-field" value={activeKcal} onChange={e => setActiveKcal(e.target.value)} />
                            </div>
                            <div className="input-group" style={{ flex: 1 }}>
                              <label className="input-label">{t(lang, 'totalKcalLabel')}</label>
                              <input type="number" placeholder="kcal" className="input-field" value={totalKcal} onChange={e => setTotalKcal(e.target.value)} />
                            </div>
                          </div>

                          {/* Elevation & Speed (only for Cycling/Outdoor) */}
                          {(isCycling || (ex.type === 'cardio' && !isSwim)) && (
                            <div style={{ display: 'flex', gap: 12 }}>
                              {(!isRun && isCycling) && (
                                <div className="input-group" style={{ flex: 1 }}>
                                  <label className="input-label">{t(lang, 'speedLabel')} (km/h)</label>
                                  <input type="number" step="any" placeholder="z.B. 25.2" className="input-field" value={avgSpeed} onChange={e => setAvgSpeed(e.target.value)} />
                                </div>
                              )}
                              {!isPoolSwim && (
                                <div className="input-group" style={{ flex: 1 }}>
                                  <label className="input-label">{t(lang, 'elevationLabel')}</label>
                                  <input type="number" placeholder="Meter" className="input-field" value={elevationGain} onChange={e => setElevationGain(e.target.value)} />
                                </div>
                              )}
                            </div>
                          )}

                          {/* Pace input (running / swimming / custom) */}
                          {(isRun || isSwim || ex.type === 'cardio') && (
                            <div className="input-group">
                              <label className="input-label">{t(lang, 'paceLabel')} {isSwim ? '(Min:Sek / 100m)' : '(Min:Sek / km)'}</label>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <input type="number" placeholder="Min" className="input-field text-center" style={{ flex: 1 }} value={paceMin} onChange={e => setPaceMin(e.target.value)} min="0" />
                                <span className="text-muted">:</span>
                                <input type="number" placeholder="Sek" className="input-field text-center" style={{ flex: 1 }} value={paceSec} onChange={e => setPaceSec(e.target.value)} min="0" max="59" />
                              </div>
                            </div>
                          )}

                          {/* Heart rate & Cadence / Pool particulars */}
                          <div style={{ display: 'flex', gap: 12 }}>
                            <div className="input-group" style={{ flex: 1 }}>
                              <label className="input-label">{t(lang, 'hrLabel')} (bpm)</label>
                              <input type="number" placeholder="bpm" className="input-field" value={avgHeartRate} onChange={e => setAvgHeartRate(e.target.value)} />
                            </div>
                            
                            {isRun && (
                              <div className="input-group" style={{ flex: 1 }}>
                                <label className="input-label">{t(lang, 'cadenceLabel')} (spm)</label>
                                <input type="number" placeholder="spm" className="input-field" value={avgCadence} onChange={e => setAvgCadence(e.target.value)} />
                              </div>
                            )}

                            {isPoolSwim && (
                              <div className="input-group" style={{ flex: 1 }}>
                                <label className="input-label">{t(lang, 'lapsLabel')}</label>
                                <input type="number" placeholder="z.B. 40" className="input-field" value={laps} onChange={e => setLaps(e.target.value)} />
                              </div>
                            )}
                          </div>

                          {/* Pool length particulars */}
                          {isPoolSwim && (
                            <div className="input-group">
                              <label className="input-label">{t(lang, 'poolLengthLabel')} (m)</label>
                              <select className="input-field" value={poolLength} onChange={e => setPoolLength(e.target.value)}>
                                <option value="15">15 m</option>
                                <option value="25">25 m</option>
                                <option value="33">33 1/3 m</option>
                                <option value="50">50 m</option>
                              </select>
                            </div>
                          )}

                          <button 
                            className="btn btn-accent mt-2"
                            onClick={() => handleAddCardio(ex)}
                          >
                            {t(lang, 'addEntry')}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Action buttons */}
          {!isCompleted && (
            <div className="flex flex-col gap-2 mt-4 mb-6">
              <button 
                className="btn btn-primary w-full"
                onClick={handleFinishWorkout}
              >
                {t(lang, 'finishTraining')}
              </button>

              <button 
                className="btn btn-secondary w-full"
                onClick={() => setCustomExOpen(true)}
              >
                + {t(lang, 'addExercise')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Edit Set Dialog Modal */}
      {editDialogOpen && editExercise && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-container p-4" style={{ width: '90%', maxWidth: 450, background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: 14 }}>
              {editExercise.name} - {t(lang, 'editSet')}
            </h3>

            <div className="flex flex-col gap-3" style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: 4 }}>
              {/* Duration input */}
              <div className="input-group">
                <label className="input-label">{t(lang, 'durationLabel')} *</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="number" placeholder="Std" className="input-field text-center" style={{ flex: 1 }} value={durationH} onChange={e => setDurationH(e.target.value)} min="0" />
                  <span className="text-muted">:</span>
                  <input type="number" placeholder="Min" className="input-field text-center" style={{ flex: 1 }} value={durationM} onChange={e => setDurationM(e.target.value)} min="0" max="59" />
                  <span className="text-muted">:</span>
                  <input type="number" placeholder="Sek" className="input-field text-center" style={{ flex: 1 }} value={durationS} onChange={e => setDurationS(e.target.value)} min="0" max="59" />
                </div>
              </div>

              {/* Elapsed time */}
              {(editExercise.name.toLowerCase().includes('schwimm') || editExercise.name.toLowerCase().includes('swim') || editExercise.name.toLowerCase().includes('lauf') || editExercise.name.toLowerCase().includes('run') || editExercise.type === 'cardio') && (
                <div className="input-group">
                  <label className="input-label">{t(lang, 'elapsedLabel')}</label>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="number" placeholder="Std" className="input-field text-center" style={{ flex: 1 }} value={elapsedH} onChange={e => setElapsedH(e.target.value)} min="0" />
                    <span className="text-muted">:</span>
                    <input type="number" placeholder="Min" className="input-field text-center" style={{ flex: 1 }} value={elapsedM} onChange={e => setElapsedM(e.target.value)} min="0" max="59" />
                    <span className="text-muted">:</span>
                    <input type="number" placeholder="Sek" className="input-field text-center" style={{ flex: 1 }} value={elapsedS} onChange={e => setElapsedS(e.target.value)} min="0" max="59" />
                  </div>
                </div>
              )}

              {/* Distance */}
              <div className="input-group">
                <label className="input-label">{t(lang, 'distanceLabel')} {editExercise.name.toLowerCase().includes('schwimm') || editExercise.name.toLowerCase().includes('swim') ? '(m)' : '(km)'}</label>
                <input type="number" step="any" className="input-field" value={distance} onChange={e => setDistance(e.target.value)} />
              </div>

              {/* Calories */}
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">{t(lang, 'activeKcalLabel')}</label>
                  <input type="number" className="input-field" value={activeKcal} onChange={e => setActiveKcal(e.target.value)} />
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">{t(lang, 'totalKcalLabel')}</label>
                  <input type="number" className="input-field" value={totalKcal} onChange={e => setTotalKcal(e.target.value)} />
                </div>
              </div>

              {/* Elevation & Speed */}
              {(editExercise.name.toLowerCase().includes('rad') || editExercise.name.toLowerCase().includes('cycle') || editExercise.name.toLowerCase().includes('bike') || editExercise.type === 'cardio') && (
                <div style={{ display: 'flex', gap: 12 }}>
                  {!editExercise.name.toLowerCase().includes('lauf') && !editExercise.name.toLowerCase().includes('run') && (
                    <div className="input-group" style={{ flex: 1 }}>
                      <label className="input-label">{t(lang, 'speedLabel')} (km/h)</label>
                      <input type="number" step="any" className="input-field" value={avgSpeed} onChange={e => setAvgSpeed(e.target.value)} />
                    </div>
                  )}
                  <div className="input-group" style={{ flex: 1 }}>
                    <label className="input-label">{t(lang, 'elevationLabel')}</label>
                    <input type="number" className="input-field" value={elevationGain} onChange={e => setElevationGain(e.target.value)} />
                  </div>
                </div>
              )}

              {/* Pace */}
              {(editExercise.name.toLowerCase().includes('lauf') || editExercise.name.toLowerCase().includes('run') || editExercise.name.toLowerCase().includes('schwimm') || editExercise.name.toLowerCase().includes('swim') || editExercise.type === 'cardio') && (
                <div className="input-group">
                  <label className="input-label">{t(lang, 'paceLabel')} {editExercise.name.toLowerCase().includes('schwimm') || editExercise.name.toLowerCase().includes('swim') ? '(Min:Sek / 100m)' : '(Min:Sek / km)'}</label>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="number" placeholder="Min" className="input-field text-center" style={{ flex: 1 }} value={paceMin} onChange={e => setPaceMin(e.target.value)} min="0" />
                    <span className="text-muted">:</span>
                    <input type="number" placeholder="Sek" className="input-field text-center" style={{ flex: 1 }} value={paceSec} onChange={e => setPaceSec(e.target.value)} min="0" max="59" />
                  </div>
                </div>
              )}

              {/* HR / Cadence / Laps */}
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">{t(lang, 'hrLabel')} (bpm)</label>
                  <input type="number" className="input-field" value={avgHeartRate} onChange={e => setAvgHeartRate(e.target.value)} />
                </div>
                
                {editExercise.name.toLowerCase().includes('lauf') && (
                  <div className="input-group" style={{ flex: 1 }}>
                    <label className="input-label">{t(lang, 'cadenceLabel')} (spm)</label>
                    <input type="number" className="input-field" value={avgCadence} onChange={e => setAvgCadence(e.target.value)} />
                  </div>
                )}

                {editExercise.name.toLowerCase().includes('beckenschwimm') && (
                  <div className="input-group" style={{ flex: 1 }}>
                    <label className="input-label">{t(lang, 'lapsLabel')}</label>
                    <input type="number" className="input-field" value={laps} onChange={e => setLaps(e.target.value)} />
                  </div>
                )}
              </div>

              {/* Pool length */}
              {editExercise.name.toLowerCase().includes('beckenschwimm') && (
                <div className="input-group">
                  <label className="input-label">{t(lang, 'poolLengthLabel')} (m)</label>
                  <select className="input-field" value={poolLength} onChange={e => setPoolLength(e.target.value)}>
                    <option value="15">15 m</option>
                    <option value="25">25 m</option>
                    <option value="33">33 1/3 m</option>
                    <option value="50">50 m</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-4" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <button className="btn btn-secondary" onClick={() => setEditDialogOpen(false)}>
                {t(lang, 'cancel')}
              </button>
              <button className="btn btn-accent" onClick={handleSaveEditedCardio}>
                {t(lang, 'save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Exercise Modal */}
      {customExOpen && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form className="modal-container p-4" style={{ width: '90%', maxWidth: 400, background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }} onSubmit={handleCreateCustomExercise}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: 14 }}>{t(lang, 'addExercise')}</h3>
            
            <div className="flex flex-col gap-3">
              <div className="input-group">
                <label className="input-label">{t(lang, 'exerciseName')} *</label>
                <input 
                  type="text" 
                  required
                  className="input-field" 
                  placeholder={lang === 'de' ? 'z.B. Rudern Ergometer' : 'e.g. Rowing ergometer'}
                  value={customExName} 
                  onChange={e => setCustomExName(e.target.value)} 
                />
              </div>

              <div className="input-group">
                <label className="input-label">{t(lang, 'muscleGroup')}</label>
                <select 
                  className="input-field" 
                  value={customExGroup} 
                  onChange={e => setCustomExGroup(e.target.value)}
                >
                  <option value="Ausdauer">{lang === 'de' ? 'Ausdauer' : lang === 'ru' ? 'Кардио' : 'Cardio'}</option>
                  <option value="Beine">{t(lang, 'muscleLegs')}</option>
                  <option value="Rücken">{t(lang, 'muscleBack')}</option>
                  <option value="Schulter">{t(lang, 'muscleShoulders')}</option>
                  <option value="Bizeps">{t(lang, 'muscleBiceps')}</option>
                  <option value="Trizeps">{t(lang, 'muscleTriceps')}</option>
                  <option value="Brust">{t(lang, 'muscleChest')}</option>
                  <option value="Bauch">{t(lang, 'muscleAbs')}</option>
                  <option value="Waden">{t(lang, 'muscleCalves')}</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setCustomExOpen(false)}>
                {t(lang, 'cancel')}
              </button>
              <button type="submit" className="btn btn-accent">
                {t(lang, 'createBtn')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
