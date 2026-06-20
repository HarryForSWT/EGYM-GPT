import { SupabaseClient } from '@supabase/supabase-js'

export type SetPayload = {
  workout_id: string
  exercise_id: string
  round_number: number
  weight_kg?: number
  reps?: number
  created_at?: string
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
}

const QUEUE_KEY = 'egym_offline_sets_queue'

export const getSyncQueue = (): SetPayload[] => {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(QUEUE_KEY)
  if (!data) return []
  try {
    return JSON.parse(data)
  } catch (e) {
    return []
  }
}

export const enqueueSetUpsert = (payload: SetPayload) => {
  if (typeof window === 'undefined') return
  const queue = getSyncQueue()
  // Replace existing queued item for the same set if user edited it while offline
  const filtered = queue.filter(
    q => !(q.workout_id === payload.workout_id && q.exercise_id === payload.exercise_id && q.round_number === payload.round_number)
  )
  filtered.push(payload)
  localStorage.setItem(QUEUE_KEY, JSON.stringify(filtered))
  
  // Dispatch a custom event so the UI can update
  window.dispatchEvent(new Event('sync-queue-updated'))
}

let isProcessing = false

export const processSyncQueue = async (supabase: SupabaseClient) => {
  if (typeof window === 'undefined' || isProcessing) return
  if (!navigator.onLine) return

  const queue = getSyncQueue()
  if (queue.length === 0) return

  isProcessing = true

  try {
    // Supabase allows bulk upserts
    const { error } = await supabase.from('sets').upsert(queue, { onConflict: 'workout_id,exercise_id,round_number' })
    
    if (!error) {
      // Clear queue on success
      localStorage.removeItem(QUEUE_KEY)
      window.dispatchEvent(new Event('sync-queue-updated'))
    } else {
      console.error('Failed to process offline queue', error)
    }
  } catch (err) {
    console.error('Offline queue processing error', err)
  } finally {
    isProcessing = false
  }
}
