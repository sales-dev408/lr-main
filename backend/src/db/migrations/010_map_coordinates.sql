-- Add optional map coordinates for vendors.

BEGIN;

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS longitude double precision;

COMMIT;
