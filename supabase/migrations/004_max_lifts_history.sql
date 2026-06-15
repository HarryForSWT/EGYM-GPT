-- ─── Migration 004: Enable history for max_lifts ───────────────────────────────
-- Ausführen im Supabase SQL-Editor (einmalig)

ALTER TABLE max_lifts DROP CONSTRAINT IF EXISTS max_lifts_user_id_exercise_id_key;
