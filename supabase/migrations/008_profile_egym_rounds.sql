-- ─── Migration 008: Add egym_rounds to profiles table ───────────────────────
-- Ausführen im Supabase SQL-Editor (einmalig)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS egym_rounds INTEGER NOT NULL DEFAULT 3 CHECK (egym_rounds > 0);
