-- Push notifications and user city for local event/deal targeting.

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS expo_push_token text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS city text;

COMMIT;
