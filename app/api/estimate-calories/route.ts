import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface ExerciseInfo {
  id: string
  name: string
  muscle_group: string | null
  type: string
}

interface SetRow {
  weight_kg: number | null
  reps: number | null
  round_number: number
  duration_seconds: number | null
  elapsed_seconds: number | null
  distance_m: number | null
  active_kcal: number | null
  total_kcal: number | null
  exercise: ExerciseInfo | null
}

interface GroupedExercise {
  muscle_group: string | null
  type: string
  sets: Array<{
    weight_kg: number | null
    reps: number | null
    round_number: number
    duration_seconds?: number | null
    elapsed_seconds?: number | null
    distance_m?: number | null
    active_kcal?: number | null
    total_kcal?: number | null
  }>
}

interface GeminiSet {
  exercise_name: string
  round_number: number
  calories: number
}

interface GeminiResult {
  total_calories: number
  explanation: string
  sets: GeminiSet[]
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { workoutId } = await request.json()
    if (!workoutId) {
      return NextResponse.json({ error: 'Missing workoutId' }, { status: 400 })
    }
    
    // Fetch workout
    const { data: workout, error: workoutError } = await supabase
      .from('workouts')
      .select('id, start_time, status, user_id')
      .eq('id', workoutId)
      .single()
      
    if (workoutError || !workout) {
      return NextResponse.json({ error: 'Workout not found' }, { status: 404 })
    }
    
    // Fetch user profile weight & lang
    const { data: profile } = await supabase
      .from('profiles')
      .select('weight_kg, language')
      .eq('id', workout.user_id)
      .single()
      
    const userWeight = profile?.weight_kg ? parseFloat(profile.weight_kg) : 75
    const userLang = profile?.language || 'de'
    
    // Fetch sets and joined exercises
    const { data: setsData, error: setsError } = await supabase
      .from('sets')
      .select('weight_kg, reps, round_number, duration_seconds, elapsed_seconds, distance_m, active_kcal, total_kcal, exercise:exercises(id, name, muscle_group, type)')
      .eq('workout_id', workoutId)
      
    if (setsError || !setsData || setsData.length === 0) {
      return NextResponse.json({ 
        success: true, 
        estimated_kcal: 0, 
        ai_explanation: userLang === 'de' ? 'Keine Sätze aufgezeichnet.' : userLang === 'ru' ? 'Нет записанных подходов.' : 'No sets recorded.',
        ai_breakdown: []
      })
    }
    
    const sets = setsData as unknown as SetRow[]
    
    // Group sets by exercise
    const grouped: Record<string, GroupedExercise> = {}
    sets.forEach((s) => {
      if (!s.exercise) return
      const name = s.exercise.name
      if (!grouped[name]) {
        grouped[name] = {
          muscle_group: s.exercise.muscle_group,
          type: s.exercise.type,
          sets: []
        }
      }
      grouped[name].sets.push({
        weight_kg: s.weight_kg,
        reps: s.reps,
        round_number: s.round_number,
        duration_seconds: s.duration_seconds,
        elapsed_seconds: s.elapsed_seconds,
        distance_m: s.distance_m,
        active_kcal: s.active_kcal,
        total_kcal: s.total_kcal
      })
    })
    
    const exercisesSummary = Object.entries(grouped).map(([name, ex]) => {
      const setsStr = ex.sets.map((s) => {
        if (ex.type === 'cardio') {
          const minPart = s.duration_seconds ? Math.round(s.duration_seconds / 60) + ' min' : ''
          const distPart = s.distance_m ? (s.distance_m / 1000).toFixed(2) + ' km' : ''
          const kcalPart = s.active_kcal ? s.active_kcal + ' kcal' : ''
          return `${minPart} ${distPart} ${kcalPart}`.trim()
        }
        return `${s.weight_kg || 0} kg x ${s.reps || 0} Wdh (Runde ${s.round_number})`
      }).join(', ')
      return `- ${name} (${ex.muscle_group || 'Unbekannt'}, Typ: ${ex.type}): ${setsStr}`
    }).join('\n')
    
    const geminiKey = process.env.GEMINI_API_KEY
    if (!geminiKey) {
      console.warn('GEMINI_API_KEY environment variable is not defined.')
      return NextResponse.json({ error: 'Gemini API key is not configured on the server.' }, { status: 500 })
    }
    
    const prompt = `Du bist ein hochentwickelter Sportwissenschaftler und Kalorienrechner.
Schätze den aktiven Kalorienverbrauch für dieses Training.

Körpergewicht des Nutzers: ${userWeight} kg
Trainings-Startzeit: ${workout.start_time || 'Unbekannt'}

Übungen und ausgeführte Sätze:
${exercisesSummary}

Richtlinien für die Schätzung:
1. Physikalische Arbeit berücksichtigen: Sätze mit schwererem Gewicht im Verhältnis zum Körpergewicht verbrauchen mehr Energie.
2. Muskelgruppen: Übungen für große Muskelgruppen (Beine, Rücken, z.B. Kniebeugen, Beinpresse, Kreuzheben) verbrauchen wesentlich mehr Energie als Isolationsübungen für kleine Muskelgruppen (Bizepscurls, Wadenheben).
3. Custom Übungen interpretieren: Wenn eine benutzerdefinierte Übung wie 'Waden an der Beinpresse' vorhanden ist, erkenne sie als Wadenheben an der Beinpresse (Beintraining, Wadenmuskulatur) und schätze sie physiologisch korrekt.
4. Schätze die Kalorien für JEDEN einzelnen Satz (Set) separat. Die Summe aller Sätze bildet den Gesamtwert.
5. Realistische Werte: Ein Krafttraining von moderater Intensität verbrennt ca. 3-6 kcal pro Minute oder 1.5 - 3.5 kcal pro Satz. Sei realistisch, schätze nicht zu hoch.
6. Ausgabe-Sprache: Schreibe die Erklärung (explanation) zwingend in ${userLang === 'de' ? 'Deutsch' : userLang === 'ru' ? 'Russisch' : 'Englisch'}. Halte sie kurz (2-3 Sätze), motivierend und erklärend.
7. Klimmzüge (Pull-ups / Chin-ups): Beachte, dass bei Klimmzügen (Klimmzüge, Klimmzug, Klimmzüg) das angegebene Gewicht die Unterstützung (Hilfe durch Band/Maschine) darstellt. 0 kg bedeutet, dass der Nutzer sein volles Körpergewicht (${userWeight} kg) selbst gehoben hat (am anstrengendsten). Ein höheres Gewicht bedeutet mehr Hilfe und somit weniger Anstrengung (z.B. bei 20 kg Hilfe hebt der Nutzer effektiv nur ${userWeight} - 20 = 60 kg).
`

    const responseSchema = {
      type: 'OBJECT',
      properties: {
        total_calories: {
          type: 'INTEGER',
          description: 'Gesamte aktive Kalorien verbrannt für das gesamte Krafttraining'
        },
        explanation: {
          type: 'STRING',
          description: 'Eine kurze, motivierende Erklärung auf der Zielsprache, wie sich der Kalorienverbrauch zusammensetzt'
        },
        sets: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              exercise_name: {
                type: 'STRING',
                description: 'Der exakte Name der Übung wie in der Eingabeliste'
              },
              round_number: {
                type: 'INTEGER',
                description: 'Die Runde/Satz-Nummer dieses Satzes (z.B. 1, 2, 3)'
              },
              calories: {
                type: 'INTEGER',
                description: 'Schätzung der verbrannten aktiven Kalorien für DIESEN spezifischen Satz'
              }
            },
            required: ['exercise_name', 'round_number', 'calories']
          }
        }
      },
      required: ['total_calories', 'explanation', 'sets']
    }
    
    // Try multiple available models sequentially to handle temporary rate limits or unavailability
    const candidateModels = [
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-flash-latest',
      'gemini-3.5-flash'
    ]
    
    let geminiRes: GeminiResult | null = null
    let usedModel = ''
    for (const modelName of candidateModels) {
      console.log(`Attempting AI calorie estimation with model: ${modelName}`)
      geminiRes = await callGemini(modelName, prompt, responseSchema, geminiKey)
      if (geminiRes) {
        usedModel = modelName
        break
      }
    }
    
    if (!geminiRes) {
      throw new Error(`Gemini API calls failed for all candidate models: ${candidateModels.join(', ')}`)
    }
    
    console.log(`Successfully estimated calories using model: ${usedModel}`)
    
    const { total_calories, explanation, sets: aiSets } = geminiRes
    
    // Update each individual set's active_kcal column in database
    const updatePromises = sets.map((s) => {
      if (!s.exercise) return Promise.resolve()
      
      const match = aiSets.find((ai) => 
        ai.exercise_name.toLowerCase().trim() === s.exercise!.name.toLowerCase().trim() &&
        ai.round_number === s.round_number
      )
      
      if (match) {
        return supabase
          .from('sets')
          .update({ active_kcal: match.calories })
          .eq('workout_id', workoutId)
          .eq('exercise_id', s.exercise.id)
          .eq('round_number', s.round_number)
      }
      return Promise.resolve()
    })
    
    await Promise.all(updatePromises)
    
    // Update workout summary in database
    const { error: updateError } = await supabase
      .from('workouts')
      .update({
        estimated_kcal: total_calories,
        ai_explanation: explanation,
        ai_breakdown: aiSets
      })
      .eq('id', workoutId)
      
    if (updateError) {
      console.error('Failed to update workout calories in DB:', updateError)
      throw updateError
    }
    
    return NextResponse.json({
      success: true,
      estimated_kcal: total_calories,
      ai_explanation: explanation,
      ai_breakdown: aiSets
    })
    
  } catch (err: unknown) {
    console.error('AI calorie estimation failed:', err)
    const errMessage = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: errMessage }, { status: 500 })
  }
}

async function callGemini(model: string, prompt: string, schema: Record<string, unknown>, key: string): Promise<GeminiResult | null> {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: schema
        }
      })
    })
    
    if (!res.ok) {
      const errText = await res.text()
      console.error(`Gemini model ${model} failed:`, errText)
      return null
    }
    
    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return null
    
    return JSON.parse(text) as GeminiResult
  } catch (e) {
    console.error(`Error invoking Gemini model ${model}:`, e)
    return null
  }
}
