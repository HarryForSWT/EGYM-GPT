-- ─── Migration 011: Add body height and fat to profiles and create body_measurements table ─────────────────────────

-- 1. Add height_cm and body_fat_percent to profiles table if not exists
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS height_cm NUMERIC(5,2) CHECK (height_cm > 0),
  ADD COLUMN IF NOT EXISTS body_fat_percent NUMERIC(4,1) CHECK (body_fat_percent >= 0.0 AND body_fat_percent <= 100.0);

-- 2. Create body_measurements table for historical tracking
CREATE TABLE IF NOT EXISTS body_measurements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_kg        NUMERIC(5,2) CHECK (weight_kg > 0),
  body_fat_percent NUMERIC(4,1) CHECK (body_fat_percent >= 0.0 AND body_fat_percent <= 100.0),
  logged_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Enable RLS on body_measurements
ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "body_measurements_own" ON body_measurements;
CREATE POLICY "body_measurements_own" ON body_measurements
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4. Create trigger to automatically update weight_kg and body_fat_percent in profiles to the latest values
CREATE OR REPLACE FUNCTION update_profile_weight_from_measurement()
RETURNS TRIGGER AS $$
DECLARE
  target_user_id UUID;
  latest_weight NUMERIC(5,2);
  latest_fat NUMERIC(4,1);
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_user_id := OLD.user_id;
  ELSE
    target_user_id := NEW.user_id;
  END IF;

  -- Get latest weight_kg for this user
  SELECT weight_kg INTO latest_weight
  FROM body_measurements
  WHERE user_id = target_user_id AND weight_kg IS NOT NULL
  ORDER BY logged_at DESC
  LIMIT 1;

  -- Get latest body_fat_percent for this user
  SELECT body_fat_percent INTO latest_fat
  FROM body_measurements
  WHERE user_id = target_user_id AND body_fat_percent IS NOT NULL
  ORDER BY logged_at DESC
  LIMIT 1;

  -- Update profiles with the latest weight and body fat
  UPDATE profiles
  SET 
    weight_kg = latest_weight,
    body_fat_percent = latest_fat
  WHERE id = target_user_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_profile_weight ON body_measurements;
CREATE TRIGGER trg_update_profile_weight
AFTER INSERT OR UPDATE OR DELETE ON body_measurements
FOR EACH ROW
EXECUTE FUNCTION update_profile_weight_from_measurement();
