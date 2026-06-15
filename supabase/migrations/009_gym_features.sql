-- ─── Migration 009: Advanced Gym Features ──────────────────────────────────────────
-- Ausführen im Supabase SQL-Editor (einmalig)

-- 1. Custom Exercises in exercises table
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Enable RLS for exercises table (if not already enabled)
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

-- Select policy: Allow users to see global exercises (user_id IS NULL) or their own custom exercises
DROP POLICY IF EXISTS "exercises_read" ON exercises;
CREATE POLICY "exercises_read" ON exercises FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());

-- Insert policy: Allow users to create their own custom exercises
DROP POLICY IF EXISTS "exercises_insert" ON exercises;
CREATE POLICY "exercises_insert" ON exercises FOR INSERT WITH CHECK (user_id = auth.uid());


-- 2. Rest Timer settings on profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rest_timer_seconds INTEGER NOT NULL DEFAULT 90 CHECK (rest_timer_seconds >= 0);


-- 3. Workout Templates
CREATE TABLE IF NOT EXISTS workout_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workout_template_exercises (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL,
  UNIQUE (template_id, exercise_id)
);

-- Enable RLS for templates
ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_template_exercises ENABLE ROW LEVEL SECURITY;

-- Template policies: Only access own templates
DROP POLICY IF EXISTS "workout_templates_own" ON workout_templates;
CREATE POLICY "workout_templates_own" ON workout_templates 
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "workout_template_exercises_own" ON workout_template_exercises;
CREATE POLICY "workout_template_exercises_own" ON workout_template_exercises
  USING (EXISTS (SELECT 1 FROM workout_templates t WHERE t.id = workout_template_exercises.template_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workout_templates t WHERE t.id = workout_template_exercises.template_id AND t.user_id = auth.uid()));
