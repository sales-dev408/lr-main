-- App-level publishing snapshot. Stores the entire published app state
-- (vendors, apartments, events, content blocks, theme) in a single atomic row.
BEGIN;

CREATE TABLE IF NOT EXISTS app_published (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version integer NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_published_version ON app_published(version DESC);

COMMIT;
