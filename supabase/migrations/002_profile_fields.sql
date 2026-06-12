-- ─── Migration 002: Profil-Felder ────────────────────────────────────────────
-- Ausführen im Supabase SQL-Editor (einmalig)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name  TEXT,
  ADD COLUMN IF NOT EXISTS nickname   TEXT,
  ADD COLUMN IF NOT EXISTS language   TEXT NOT NULL DEFAULT 'de'
    CHECK (language IN ('de', 'en', 'ru'));
