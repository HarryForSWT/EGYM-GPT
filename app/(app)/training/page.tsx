'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Check, Edit2, Loader2, Trophy } from 'lucide-react'
import { useLang } from '@/lib/LanguageContext'
import { t } from '@/lib/i18n'

type Exercise = { id: string; name: string; muscle_group: string; egym_order: number }
type RoundWeights = Record<string, Record<1 | 2 | 3, string>>
type MaxLifts = Record<string, number>
const ROUNDS = [1, 2, 3] as const

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

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: exData } = await supabase
        .from('exercises').select('*').eq('type', 'egym')
        .order('egym_order', { ascending: true })
      if (!exData) return
      setExercises(exData)

      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
      const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999)

      const { data: todayWorkouts } = await supabase
        .from('workouts').select('id, status')
        .eq('user_id', user.id)
        .gte('start_time', todayStart.toISOString())
        .lte('start_time', todayEnd.toISOString())
        .order('start_time', { ascending: false }).limit(1)

      // Veraltete aktive Workouts automatisch abschließen
      await supabase.from('workouts')
        .update({ status: 'completed', completed_at: new Date(todayStart.getTime() - 1000).toISOString() })
        .eq('user_id', user.id).eq('status', 'active')
        .lt('start_time', todayStart.toISOString())

      let wid: string
      if (todayWorkouts && todayWorkouts.length > 0) {
        wid = todayWorkouts[0].id
        setIsCompleted(todayWorkouts[0].status === 'completed')
      } else {
        const { data: nw } = await supabase.from('workouts')
          .insert({ user_id: user.id, status: 'active' }).select('id').single()
        if (!nw) return
        wid = nw.id
      }
      setWorkoutId(wid)

      const { data: existingSets } = await supabase
        .from('sets').select('exercise_id, weight_kg, round_number').eq('workout_id', wid)
      const loadedWeights: RoundWeights = {}
      existingSets?.forEach(s => {
        if (!loadedWeights[s.exercise_id]) loadedWeights[s.exercise_id] = { 1: '', 2: '', 3: '' }
        const r = s.round_number as 1 | 2 | 3
        if (r === 1 || r === 2 || r === 3) loadedWeights[s.exercise_id][r] = s.weight_kg?.toString() ?? ''
      })
      setWeights(loadedWeights)

      const { data: ml } = await supabase.from('max_lifts')
        .select('exercise_id, weight_kg').eq('user_id', user.id)
      if (ml) {
        const mlMap: MaxLifts = {}
        ml.forEach(m => { mlMap[m.exercise_id] = m.weight_kg })
        setMaxLifts(mlMap)
      }
      setLoading(false)
    }
    init()
  }, [])

  const saveSet = useCallback(async (exerciseId: string, round: 1 | 2 | 3, rawValue: string) => {
    if (!workoutId) return
    const val = parseFloat(rawValue)
    if (isNaN(val) || val <= 0) return
    await supabase.from('sets').upsert(
      { workout_id: workoutId, exercise_id: exerciseId, weight_kg: val, reps: 12, round_number: round },
      { onConflict: 'workout_id,exercise_id,round_number' }
    )
  }, [workoutId])

  const openMaxEdit = (ex: Exercise) => {
    setEditMaxEx(ex)
    setEditMaxVal(maxLifts[ex.id]?.toString() ?? '')
  }

  const saveMaxLift = async () => {
    if (!editMaxEx) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const val = parseFloat(editMaxVal)
    if (isNaN(val) || val <= 0) { setEditMaxEx(null); return }
    await supabase.from('max_lifts').upsert(
      { user_id: user.id, exercise_id: editMaxEx.id, weight_kg: val, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,exercise_id' }
    )
    setMaxLifts(prev => ({ ...prev, [editMaxEx.id]: val }))
    setEditMaxEx(null)
  }

  const finishTraining = async () => {
    if (!workoutId) return
    setFinishing(true)
    await supabase.from('workouts')
      .update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', workoutId)
    setIsCompleted(true)
    setFinishing(false)
  }

  const handleWeightChange = (exId: string, round: 1 | 2 | 3, value: string) => {
    setWeights(prev => ({ ...prev, [exId]: { ...(prev[exId] ?? { 1: '', 2: '', 3: '' }), [round]: value } }))
  }

  const completedRounds = (exId: string) =>
    ROUNDS.filter(r => { const v = parseFloat(weights[exId]?.[r] ?? ''); return !isNaN(v) && v > 0 }).length

  if (loading) {
    return <div className="flex justify-center items-center h-full mt-20"><Loader2 className="spin text-accent" size={32} /></div>
  }

  return (
    <div className="animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-header-title">{t(lang, 'egymTitle')}</h1>
          <p className="text-secondary" style={{ fontSize: '0.85rem' }}>
            {isCompleted ? t(lang, 'trainingDone') : t(lang, 'trainingHint')}
          </p>
        </div>
        {isCompleted && <Trophy size={22} className="text-warning" />}
      </header>

      <div className="px-4 pb-4">
        {exercises.map(ex => {
          const done    = completedRounds(ex.id)
          const isDone  = done === 3
          const exW     = weights[ex.id] ?? { 1: '', 2: '', 3: '' }

          return (
            <div key={ex.id} className={`exercise-panel ${isDone ? 'done' : ''}`}>
              <div className="panel-header" style={{ cursor: 'default' }}>
                <div className="panel-status-icon">
                  {isDone
                    ? <Check size={18} className="text-success" />
                    : <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)' }}>{done > 0 ? done : ''}</div>
                  }
                </div>
                <div className="panel-title">{ex.name}</div>
                <div className="panel-reps-badge">{ex.muscle_group}</div>
              </div>

              <div style={{ padding: '0 14px 14px' }}>
                <div className="round-grid">
                  <div className="round-grid-label">{t(lang, 'maxForce')}</div>
                  {ROUNDS.map(r => <div key={r} className="round-grid-label">{t(lang, 'round')} {r}</div>)}

                  <div className="max-lift-cell">
                    <span className="max-lift-value">
                      {maxLifts[ex.id] != null ? `${maxLifts[ex.id]} kg` : '-- kg'}
                    </span>
                    <button className="max-lift-edit-btn" aria-label="Max Kraft bearbeiten" onClick={() => openMaxEdit(ex)}>
                      <Edit2 size={13} />
                    </button>
                  </div>

                  {ROUNDS.map(r => {
                    const val    = exW[r]
                    const filled = parseFloat(val) > 0
                    return (
                      <div key={r} className="round-cell">
                        <input
                          type="number" inputMode="decimal"
                          className={`round-cell-input ${filled ? 'filled' : ''}`}
                          placeholder="-- kg" value={val}
                          onChange={e => handleWeightChange(ex.id, r, e.target.value)}
                          onBlur={e => saveSet(ex.id, r, e.target.value)}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}

        <div style={{ marginTop: 16, marginBottom: 8 }}>
          {!isCompleted ? (
            <button className="btn btn-success btn-full btn-lg" onClick={finishTraining} disabled={finishing}>
              {finishing ? <Loader2 size={18} className="spin" /> : <Check size={20} />}
              {finishing ? t(lang, 'saving2') : t(lang, 'finishTraining')}
            </button>
          ) : (
            <div className="card text-center py-4" style={{ borderColor: '#22c55e33' }}>
              <Trophy size={28} className="text-warning" style={{ margin: '0 auto 8px' }} />
              <p style={{ fontWeight: 600 }}>{t(lang, 'trainingDone')}</p>
              <p className="text-secondary text-sm mt-2">{t(lang, 'trainingDoneMsg')}</p>
            </div>
          )}
        </div>
      </div>

      {editMaxEx && (
        <div className="max-lift-modal-backdrop" onClick={() => setEditMaxEx(null)}>
          <div className="max-lift-modal" onClick={e => e.stopPropagation()}>
            <div className="bottom-sheet-handle" />
            <h2 style={{ marginBottom: 6 }}>{t(lang, 'maxForce')}</h2>
            <p className="text-secondary text-sm mb-4">{editMaxEx.name}</p>
            <div className="input-group mb-4">
              <label className="input-label">kg</label>
              <input type="number" inputMode="decimal" className="input-field" placeholder="z.B. 80"
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

      <style>{`.spin { animation: spin 0.8s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } } .flex-1 { flex: 1; }`}</style>
    </div>
  )
}
