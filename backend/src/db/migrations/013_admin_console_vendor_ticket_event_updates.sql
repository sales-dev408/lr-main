-- Admin console updates: vendor owner name, ticket barcode format, custom events.

BEGIN;

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS owner_name text NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS barcode_format text NULL DEFAULT 'Code 128';

CREATE TABLE IF NOT EXISTS admin_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NULL,
  event_date date NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_events_date_idx ON admin_events (event_date);

COMMIT;
