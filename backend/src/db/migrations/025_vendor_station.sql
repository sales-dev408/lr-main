-- Optional light rail stop association for imported vendors.
BEGIN;

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS station text;

COMMIT;
