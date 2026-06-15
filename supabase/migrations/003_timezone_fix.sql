-- ─── Migration 003: Timezone Fix for auto_complete_workouts ─────────────────────
-- Ausführen im Supabase SQL-Editor (einmalig)

CREATE OR REPLACE FUNCTION auto_complete_workouts()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE workouts
  SET
    status       = 'completed',
    completed_at = (date_trunc('day', start_time AT TIME ZONE 'Europe/Berlin') + INTERVAL '23 hours 59 minutes') AT TIME ZONE 'Europe/Berlin'
  WHERE
    status = 'active'
    AND start_time < date_trunc('day', now() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin';
END;
$$;
