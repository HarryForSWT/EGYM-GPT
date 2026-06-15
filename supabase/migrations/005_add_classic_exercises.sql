-- ─── Migration 005: Add classic exercises to exercises table ─────────────────
-- Ausführen im Supabase SQL-Editor (einmalig)

INSERT INTO exercises (id, name, muscle_group, type, default_reps)
VALUES
  ('3ab1c1fe-46b0-466d-a128-cc6b1856711c', 'Klimmzüge', 'Rücken', 'classic', 12),
  ('5bf18320-c7ef-4ab0-880c-7bcae8d02df9', 'Schulterdrücken (Kurzhantel)', 'Schulter', 'classic', 12)
ON CONFLICT (id) DO NOTHING;
