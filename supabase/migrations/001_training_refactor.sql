-- ─── Migration 001: Training Refactor ───────────────────────────────────────
-- Ausführen im Supabase SQL-Editor (einmalig)

-- 1. workouts: Status-Spalte + completed_at
ALTER TABLE workouts
  ADD COLUMN IF NOT EXISTS status       TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed')),
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 2. sets: round_number absichern (falls noch nicht vorhanden)
ALTER TABLE sets
  ADD COLUMN IF NOT EXISTS round_number INTEGER NOT NULL DEFAULT 1;

-- Duplikate bereinigen: pro (workout_id, exercise_id, round_number) nur den
-- neuesten Eintrag behalten, den Rest löschen.
DELETE FROM sets
WHERE id NOT IN (
  SELECT DISTINCT ON (workout_id, exercise_id, round_number) id
  FROM sets
  ORDER BY workout_id, exercise_id, round_number, created_at DESC
);

-- Unique-Constraint: pro Workout + Übung + Runde nur 1 Satz
-- (UPSERT-fähig, damit auto-save idempotent ist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sets_workout_exercise_round_key'
  ) THEN
    ALTER TABLE sets
      ADD CONSTRAINT sets_workout_exercise_round_key
      UNIQUE (workout_id, exercise_id, round_number);
  END IF;
END $$;

-- 3. max_lifts: separate Tabelle für manuell gepflegte Maximalgewichte
CREATE TABLE IF NOT EXISTS max_lifts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  weight_kg   NUMERIC(6,2) NOT NULL CHECK (weight_kg >= 0),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, exercise_id)
);

-- RLS für max_lifts
ALTER TABLE max_lifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "max_lifts_own" ON max_lifts;
CREATE POLICY "max_lifts_own" ON max_lifts
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS auch für workouts (falls noch nicht gesetzt)
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workouts_own" ON workouts;
CREATE POLICY "workouts_own" ON workouts
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS für sets (sets haben keine user_id direkt → über workout_id joinen)
ALTER TABLE sets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sets_own" ON sets;
CREATE POLICY "sets_own" ON sets
  USING (
    EXISTS (
      SELECT 1 FROM workouts w
      WHERE w.id = sets.workout_id
        AND w.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workouts w
      WHERE w.id = sets.workout_id
        AND w.user_id = auth.uid()
    )
  );

-- ─── Funktion: auto-complete overdue workouts (per Cron oder manuell) ────────
-- Kann per Supabase Cron (pg_cron) täglich um 23:59 aufgerufen werden:
--   SELECT cron.schedule('auto-complete-workouts', '59 23 * * *',
--     'SELECT auto_complete_workouts()');
CREATE OR REPLACE FUNCTION auto_complete_workouts()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE workouts
  SET
    status       = 'completed',
    completed_at = (date_trunc('day', start_time) + INTERVAL '23 hours 59 minutes')
  WHERE
    status = 'active'
    AND start_time < date_trunc('day', now());  -- gestrige oder ältere Workouts
END;
$$;
