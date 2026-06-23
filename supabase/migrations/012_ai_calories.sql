-- ─── Migration 012: Add AI calorie estimation columns to workouts table ─────────────────────────

-- 1. Add estimated_kcal, ai_explanation and ai_breakdown columns to workouts table
ALTER TABLE workouts
  ADD COLUMN IF NOT EXISTS estimated_kcal INTEGER,
  ADD COLUMN IF NOT EXISTS ai_explanation TEXT,
  ADD COLUMN IF NOT EXISTS ai_breakdown JSONB;
