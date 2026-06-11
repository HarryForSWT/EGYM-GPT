'use client'

import { useState } from 'react'
import { ChevronDown, Plus, Edit2, Play } from 'lucide-react'

// Dummy-Daten für Klassisches Training
const CLASSIC_EXERCISES = [
  { id: 101, name: 'Bankdrücken', muscle: 'Brust' },
  { id: 102, name: 'Kniebeuge', muscle: 'Beine' },
  { id: 103, name: 'Kreuzheben', muscle: 'Rücken' },
  { id: 104, name: 'Klimmzüge', muscle: 'Rücken' },
  { id: 105, name: 'Schulterdrücken (Kurzhantel)', muscle: 'Schulter' },
]

export default function ClassicTrainingPage() {
  const [activePanel, setActivePanel] = useState<number | null>(null)
  
  // Zustand für Sets: { exerciseId: [{ weight, reps }, ...] }
  const [sets, setSets] = useState<Record<number, { weight: string, reps: string }[]>>({})
  
  // Temporäre Eingaben
  const [currentWeight, setCurrentWeight] = useState('')
  const [currentReps, setCurrentReps] = useState('')

  const handleAddSet = (id: number) => {
    if (!currentWeight || !currentReps) return

    setSets(prev => {
      const currentSets = prev[id] || []
      return {
        ...prev,
        [id]: [...currentSets, { weight: currentWeight, reps: currentReps }]
      }
    })
    
    // Eingabefelder leeren für den nächsten Satz, aber Panel bleibt offen!
    //setCurrentWeight('') 
    //setCurrentReps('')
  }

  const togglePanel = (id: number) => {
    if (activePanel === id) {
      setActivePanel(null)
    } else {
      setActivePanel(id)
    }
  }

  return (
    <div className="animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-header-title">Klassisch</h1>
          <p className="text-secondary" style={{ fontSize: '0.85rem' }}>Freies Krafttraining</p>
        </div>
      </header>

      <div className="px-4 pb-4">
        {CLASSIC_EXERCISES.map((ex) => {
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
                    {exerciseSets.length} Sätze
                  </div>
                )}
                
                <ChevronDown size={20} className="panel-chevron" />
              </div>

              {isActive && (
                <div className="panel-body animate-slide-down">
                  {/* Historie der Sätze für diese Übung */}
                  {exerciseSets.length > 0 && (
                    <div className="mb-4 flex flex-col gap-2">
                      <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Heutige Sätze</div>
                      {exerciseSets.map((set, index) => (
                        <div key={index} className="set-item">
                          <div className="set-number">Satz {index + 1}</div>
                          <div><strong>{set.weight}</strong> kg</div>
                          <div><strong>{set.reps}</strong> Wdh</div>
                          <button className="text-muted"><Edit2 size={14} /></button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="input-row mt-2">
                    <div className="input-group">
                      <label className="input-label">Gewicht (kg)</label>
                      <input 
                        type="number" 
                        className="input-field" 
                        placeholder="z.B. 60"
                        value={currentWeight}
                        onChange={(e) => setCurrentWeight(e.target.value)}
                      />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Wiederholungen</label>
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
                      Satz hinzufügen
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
