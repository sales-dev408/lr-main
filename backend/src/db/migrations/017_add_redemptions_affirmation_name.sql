BEGIN;

ALTER TABLE redemptions
  ADD COLUMN IF NOT EXISTS affirmation_name text;

COMMIT;
