'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/LanguageContext'
import { t } from '@/lib/i18n'
import { ChevronLeft, Dumbbell, Flame, Activity, Edit2, Loader2, Calendar } from 'lucide-react'
import MuscleFigure from '@/components/MuscleFigure'
import { getGermanDateString } from '@/lib/dateUtils'

type SetData = {
  id: string
  weight_kg: number
  reps: number
  round_number: number
  exercise: {
    id: string
    name: string
    type: string
    muscle_group: string | null
  }
}

type GroupedExercise = {
  exerciseName: string
  exerciseType: string
  sets: { round: number; weight: number; reps: number }[]
}

export default function WorkoutDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { lang } = useLang()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [workout, setWorkout] = useState<any>(null)
  const [groupedExercises, setGroupedExercises] = useState<GroupedExercise[]>([])
  const [stats, setStats] = useState({
    volume: 0,
    kcal: 0,
    exCount: 0,
    trainedMuscles: [] as string[],
    dateLabel: '',
    typeLabel: 'Gym'
  })

  useEffect(() => {
    async function loadWorkout() {
      if (!id) return

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Load user weight for kcal calculation
      const { data: prof } = await supabase
        .from('profiles').select('weight_kg').eq('id', user.id).single()
      let uWeight = 75
      if (prof?.weight_kg) {
        uWeight = parseFloat(prof.weight_kg)
      }

      // Fetch workout
      const { data: wData } = await supabase
        .from('workouts')
        .select('*')
        .eq('id', id)
        .single()

      if (!wData) {
        setLoading(false)
        return
      }

      setWorkout(wData)

      // Fetch sets
      const { data: sData } = await supabase
        .from('sets')
        .select('id, weight_kg, reps, round_number, created_at, exercise:exercises(id, name, type, muscle_group)')
        .eq('workout_id', id)
        .order('created_at', { ascending: true }) as { data: SetData[] | null }

      if (sData) {
        let volume = 0
        const exIds = new Set<string>()
        const trainedMusclesSet = new Set<string>()
        let egymSets = 0
        let classicSets = 0

        const groupsMap = new Map<string, GroupedExercise>()

        sData.forEach(s => {
          volume += (s.weight_kg || 0) * (s.reps || 0)
          
          if (s.exercise) {
            exIds.add(s.exercise.id)
            if (s.exercise.muscle_group) {
              trainedMusclesSet.add(s.exercise.muscle_group)
            }
            if (s.exercise.name) {
              trainedMusclesSet.add(s.exercise.name)
            }
            if (s.exercise.type === 'egym') egymSets++
            if (s.exercise.type === 'classic') classicSets++

            // Grouping
            const exName = s.exercise.name
            if (!groupsMap.has(exName)) {
              groupsMap.set(exName, {
                exerciseName: exName,
                exerciseType: s.exercise.type,
                sets: []
              })
            }
            groupsMap.get(exName)!.sets.push({
              round: s.round_number,
              weight: s.weight_kg || 0,
              reps: s.reps || 0
            })
          }
        })

        // Sort sets inside groups
        const groupsArr = Array.from(groupsMap.values())
        groupsArr.forEach(g => {
          g.sets.sort((a, b) => a.round - b.round)
        })
        setGroupedExercises(groupsArr)

        // Calculate Kcal
        const egymCal = egymSets * 1.5 * 5.5 * uWeight / 60
        const classicCal = classicSets * 2.5 * 4.0 * uWeight / 60
        const kcal = Math.round(egymCal + classicCal)

        // Type label
        let typeLabel = 'Gym'
        if (egymSets > 0 && classicSets > 0) typeLabel = 'EGYM & Classic'
        else if (egymSets > 0) typeLabel = 'EGYM Zirkel'
        else if (classicSets > 0) typeLabel = 'Classic'

        // Date label
        let dateLabel = ''
        if (wData.start_time) {
          const wDate = new Date(wData.start_time)
          dateLabel = wDate.toLocaleDateString(lang === 'de' ? 'de-DE' : lang === 'ru' ? 'ru-RU' : 'en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })
        }

        setStats({
          volume,
          kcal,
          exCount: exIds.size,
          trainedMuscles: Array.from(trainedMusclesSet),
          dateLabel,
          typeLabel
        })
      }

      setLoading(false)
    }

    loadWorkout()
  }, [id, lang, supabase])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full mt-20">
        <Loader2 className="spin text-accent" size={28} />
      </div>
    )
  }

  if (!workout) {
    return (
      <div className="px-4 py-8 text-center text-muted">
        Workout nicht gefunden.
        <button className="btn btn-secondary mt-4" onClick={() => router.push('/')}>Zurück zur Startseite</button>
      </div>
    )
  }

  const handleEdit = () => {
    const editUrl = stats.typeLabel.includes('EGYM') 
      ? `/training?date=${getGermanDateString(new Date(workout.start_time))}`
      : `/classic?date=${getGermanDateString(new Date(workout.start_time))}`
    router.push(editUrl)
  }

  return (
    <div className="animate-fade-in pb-10">
      {/* Header */}
      <div className="subview-header" style={{ padding: '16px 20px 8px', position: 'sticky', top: 0, background: 'rgba(10, 10, 15, 0.8)', backdropFilter: 'blur(10px)', zIndex: 50 }}>
        <button className="subview-back-btn" onClick={() => router.push('/')}>
          <ChevronLeft size={22} />
          {t(lang, 'back' as any) || 'Zurück'}
        </button>
      </div>

      {/* Muscle Figure Top Section */}
      <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0 30px' }}>
        <MuscleFigure 
          activeMuscles={stats.trainedMuscles} 
          width={240} 
          height={216} 
        />
      </div>

      <div className="px-4">
        {/* Title and Date */}
        <div className="mb-6 text-center">
          <div className="badge badge-accent mb-2">{stats.typeLabel}</div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 4 }}>Workout</h1>
          <p className="text-secondary" style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Calendar size={14} /> {stats.dateLabel}
          </p>
        </div>

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          <div className="card text-center" style={{ padding: '16px 8px' }}>
            <Flame size={20} className="text-accent" style={{ margin: '0 auto 8px' }} />
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{stats.kcal}</div>
            <div className="text-muted" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>Kcal</div>
          </div>
          <div className="card text-center" style={{ padding: '16px 8px' }}>
            <Activity size={20} className="text-accent" style={{ margin: '0 auto 8px' }} />
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{stats.volume}</div>
            <div className="text-muted" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>kg Volumen</div>
          </div>
          <div className="card text-center" style={{ padding: '16px 8px' }}>
            <Dumbbell size={20} className="text-accent" style={{ margin: '0 auto 8px' }} />
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{stats.exCount}</div>
            <div className="text-muted" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>Übungen</div>
          </div>
        </div>

        {/* Exercises List */}
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 12 }}>Übungen</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {groupedExercises.map((g, idx) => (
            <div key={idx} className="card p-0" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{g.exerciseName}</span>
                <span className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>{g.sets.length} Sätze</span>
              </div>
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {g.sets.map((s, sIdx) => (
                  <div key={sIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                    <span className="text-muted" style={{ width: '60px' }}>Satz {s.round}</span>
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', fontWeight: 500 }}>
                      {s.weight} kg
                    </div>
                    <div style={{ width: '60px', textAlign: 'right', fontWeight: 500 }}>
                      {s.reps} Wdh.
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {groupedExercises.length === 0 && (
            <div className="text-center text-muted py-6" style={{ fontSize: '0.9rem' }}>
              Keine Übungen aufgezeichnet.
            </div>
          )}
        </div>

        {/* Edit Button */}
        <button className="btn btn-secondary btn-full flex justify-center items-center" onClick={handleEdit}>
          <Edit2 size={16} />
          Training nachträglich bearbeiten
        </button>
      </div>

      <style>{`
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
