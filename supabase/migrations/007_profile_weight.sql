-- ─── Migration 007: Add weight_kg to profiles table ─────────────────────────
-- Ausführen im Supabase SQL-Editor (einmalig)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(5,2) CHECK (weight_kg > 0);
