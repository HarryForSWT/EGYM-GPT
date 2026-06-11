'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Check, ChevronDown, Edit2, FastForward, Loader2 } from 'lucide-react'

type Exercise = { id: string; name: string; muscle_group: string; egym_order: number }

export default function TrainingPage() {
  const supabase = createClient()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [workoutId, setWorkoutId] = useState<string | null>(null)

  const [activePanelIndex, setActivePanelIndex] = useState<number>(0)
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [round, setRound] = useState<number>(1)
  const totalRounds = 3
  
  const [weights, setWeights] = useState<Record<string, string>>({})
  const [reps, setReps] = useState<Record<string, number>>({})
  const [baseline, setBaseline] = useState<Record<string, { max: number, last: number }>>({})

  useEffect(() => {
    async function initTraining() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 1. Übungen laden
      const { data: exData } = await supabase
        .from('exercises')
        .select('*')
        .eq('type', 'egym')
        .order('egym_order', { ascending: true })
      
      if (exData) setExercises(exData)

      // 2. Aktuelles Workout finden oder neu anlegen
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const { data: workouts } = await supabase
        .from('workouts')
        .select('id')
        .eq('user_id', user.id)
        .gte('start_time', today.toISOString())
        .order('start_time', { ascending: false })
        .limit(1)
        
      if (workouts && workouts.length > 0) {
        setWorkoutId(workouts[0].id)
      } else {
        const { data: newWorkout } = await supabase
          .from('workouts')
          .insert({ user_id: user.id })
          .select('id')
          .single()
        if (newWorkout) setWorkoutId(newWorkout.id)
      }
      
      // 3. Historie abfragen (für "Max Kraft" und "Letztes Gewicht")
      const { data: allSets } = await supabase
        .from('sets')
        .select('exercise_id, weight_kg, created_at')
        .order('created_at', { ascending: false })
      
      if (allSets) {
        const newBaseline: Record<string, { max: number, last: number }> = {}
        const newWeights: Record<string, string> = {}
        
        allSets.forEach(set => {
           if (!newBaseline[set.exercise_id]) {
               // Das erste (neueste) Set, das wir für diese Übung sehen
               newBaseline[set.exercise_id] = { max: set.weight_kg, last: set.weight_kg }
               newWeights[set.exercise_id] = set.weight_kg.toString()
           } else {
               // Bei älteren Sets nur schauen, ob es ein neues Max ist
               if (set.weight_kg > newBaseline[set.exercise_id].max) {
                   newBaseline[set.exercise_id].max = set.weight_kg
               }
           }
        })
        setBaseline(newBaseline)
        setWeights(newWeights)
      }

      setLoading(false)
    }
    
    initTraining()
  }, [])

  const handleConfirm = async (exIndex: number) => {
    const exercise = exercises[exIndex]
    const weightVal = parseFloat(weights[exercise.id] || '0')
    const repsVal = reps[exercise.id] || 12

    // 1. In DB speichern
    if (workoutId && weightVal > 0) {
      await supabase.from('sets').insert({
        workout_id: workoutId,
        exercise_id: exercise.id,
        weight_kg: weightVal,
        reps: repsVal,
        round_number: round
      })
    }

    // 2. UI Status updaten
    let currentCompletedSize = completed.size

    setCompleted(prev => {
      const newSet = new Set(prev)
      newSet.add(exercise.id)
      currentCompletedSize = newSet.size
      return newSet
    })
    
    setSkipped(prev => {
      const newSet = new Set(prev)
      newSet.delete(exercise.id)
      return newSet
    })

    // Logik für neue Runde
    if (currentCompletedSize + 1 >= exercises.length) {
      if (round < totalRounds) {
        setTimeout(() => {
          setRound(r => r + 1)
          setCompleted(new Set())
          setSkipped(new Set())
          setActivePanelIndex(0)
        }, 600)
      } else {
        setTimeout(() => {
          alert('Herzlichen Glückwunsch! Du hast alle Runden abgeschlossen.')
        }, 600)
      }
    } else {
      // Suche nächstes nicht abgeschlossenes Panel
      let nextIdx = exIndex
      for (let i = 0; i < exercises.length; i++) {
        nextIdx = (nextIdx + 1) % exercises.length
        const nextExId = exercises[nextIdx].id
        if (!completed.has(nextExId) && nextIdx !== exIndex) {
           setActivePanelIndex(nextIdx)
           break
        }
      }
    }
  }

  const handleSkip = (exIndex: number) => {
    const exercise = exercises[exIndex]
    setSkipped(prev => {
      const newSet = new Set(prev)
      newSet.add(exercise.id)
      return newSet
    })
    
    const nextIdx = (exIndex + 1) % exercises.length
    setActivePanelIndex(nextIdx)
  }

  if (loading) {
    return <div className="flex justify-center items-center h-full mt-20"><Loader2 className="spin text-accent" size={32} /></div>
  }

  return (
    <div className="animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-header-title">EGYM Zirkel</h1>
          <p className="text-secondary" style={{ fontSize: '0.85rem' }}>Runde {round} von {totalRounds}</p>
        </div>
        <div className="round-dots">
          {[...Array(totalRounds)].map((_, i) => (
             <div key={i} className={`round-dot ${i + 1 < round ? 'done' : ''} ${i + 1 === round ? 'current' : ''}`}></div>
          ))}
        </div>
      </header>

      <div className="px-4 pb-4">
        {exercises.map((ex, index) => {
          const isActive = activePanelIndex === index
          const isDone = completed.has(ex.id)
          const isSkipped = skipped.has(ex.id)
          const currentReps = reps[ex.id] || 12

          return (
            <div 
              key={ex.id} 
              className={`exercise-panel ${isActive ? 'active' : ''} ${isDone ? 'done' : ''} ${isSkipped ? 'skipped' : ''}`}
            >
              <div 
                className="panel-header" 
                onClick={() => setActivePanelIndex(index)}
              >
                <div className="panel-status-icon">
                  {isDone && <Check size={18} className="text-success" />}
                  {isSkipped && !isDone && <FastForward size={18} className="text-warning" />}
                  {!isDone && !isSkipped && <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--border)' }}></div>}
                </div>
                
                <div className="panel-title">{ex.name}</div>
                
                <div className="panel-reps-badge">
                  {currentReps} Wdh
                </div>
                
                <ChevronDown size={20} className="panel-chevron" />
              </div>

              {isActive && (
                <div className="panel-body animate-slide-down">
                  <button className="panel-edit-btn" aria-label="Wiederholungen anpassen">
                    <Edit2 size={16} />
                  </button>

                  <div className="baseline-info">
                    <div className="baseline-chip">
                      Max Kraft
                      <strong>{baseline[ex.id]?.max ? `${baseline[ex.id].max} kg` : '-- kg'}</strong>
                    </div>
                    <div className="baseline-chip">
                      Letztes
                      <strong>{baseline[ex.id]?.last ? `${baseline[ex.id].last} kg` : '-- kg'}</strong>
                    </div>
                  </div>

                  <div className="input-row mt-2">
                    <div className="input-group">
                      <label className="input-label" htmlFor={`weight-${ex.id}`}>Aktuelles Gewicht (kg)</label>
                      <input 
                        id={`weight-${ex.id}`}
                        type="number" 
                        className="input-field" 
                        placeholder="z.B. 45"
                        value={weights[ex.id] || ''}
                        onChange={(e) => setWeights(prev => ({ ...prev, [ex.id]: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 mt-3">
                    <button 
                      className="btn btn-secondary flex-1"
                      onClick={() => handleSkip(index)}
                    >
                      Überspringen
                    </button>
                    <button 
                      className="btn btn-primary flex-1"
                      onClick={() => handleConfirm(index)}
                    >
                      Bestätigen
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
