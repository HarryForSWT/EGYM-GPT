-- ─── Migration 006: Add isolated arm exercises to exercises table ────────────
-- Ausführen im Supabase SQL-Editor (einmalig)

INSERT INTO exercises (id, name, muscle_group, type, default_reps)
VALUES
  ('70b3b44b-4c28-4e89-bdc0-82cb3856d11c', 'Bizepscurls (Kurzhantel)', 'Bizeps', 'classic', 12),
  ('1cb3be0d-94d0-4ac0-ac22-38ac6689dacc', 'Hammercurls', 'Bizeps', 'classic', 12),
  ('5af1b320-c7ea-4ab0-880c-7bcae8d02dfa', 'Trizepsdrücken (Kabelzug)', 'Trizeps', 'classic', 12),
  ('d8a43621-3c2d-4df2-a1d6-73bcc49bcd3b', 'Trizeps-Dips', 'Trizeps', 'classic', 12)
ON CONFLICT (id) DO NOTHING;
