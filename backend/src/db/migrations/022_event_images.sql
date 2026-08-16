-- Optional event image URL for admin-created events.

BEGIN;

ALTER TABLE admin_events ADD COLUMN IF NOT EXISTS image_url text;

COMMIT;
