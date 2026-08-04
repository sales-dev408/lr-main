-- Add optional drawing date to event tickets and ensure updated_at exists for lifecycle hooks.

BEGIN;

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS drawing_date date NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

COMMIT;
