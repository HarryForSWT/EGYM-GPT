-- ─── Migration 010: Cardio Training Support ──────────────────────────────────────────
-- Ausführen im Supabase SQL-Editor (einmalig)

-- 1. weight_kg and reps in sets should be optional (nullable)
ALTER TABLE sets ALTER COLUMN weight_kg DROP NOT NULL;
ALTER TABLE sets ALTER COLUMN reps DROP NOT NULL;

-- 2. Add cardio metrics to sets table
ALTER TABLE sets
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS elapsed_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS distance_m NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS active_kcal INTEGER,
  ADD COLUMN IF NOT EXISTS total_kcal INTEGER,
  ADD COLUMN IF NOT EXISTS elevation_gain_m INTEGER,
  ADD COLUMN IF NOT EXISTS avg_speed_kmh NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS avg_pace TEXT,
  ADD COLUMN IF NOT EXISTS avg_heart_rate_bpm INTEGER,
  ADD COLUMN IF NOT EXISTS laps INTEGER,
  ADD COLUMN IF NOT EXISTS pool_length_m INTEGER,
  ADD COLUMN IF NOT EXISTS avg_cadence_spm INTEGER;

-- 3. Insert default cardio exercises
INSERT INTO exercises (id, name, muscle_group, type)
VALUES
  ('d1b4a0f4-5f11-4770-ae0e-9c716766440b', 'Rad outdoor', 'Ausdauer', 'cardio'),
  ('e2c5b105-6a22-4881-bf1f-ad827877551c', 'Beckenschwimmen', 'Ausdauer', 'cardio'),
  ('f3d6c216-7b33-4992-c020-be938988662d', 'Freiwasserschwimmen', 'Ausdauer', 'cardio'),
  ('a4e7d327-8c44-4aa3-d131-cf049099773e', 'Laufen indoor', 'Ausdauer', 'cardio'),
  ('b5f8e438-9d55-4bb4-e242-d01501aa884f', 'Laufen outdoor', 'Ausdauer', 'cardio')
ON CONFLICT (id) DO NOTHING;
