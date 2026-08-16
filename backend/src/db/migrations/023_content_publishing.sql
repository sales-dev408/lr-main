-- Atomic published content snapshot with version metadata.

BEGIN;

CREATE TABLE IF NOT EXISTS content_published (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version integer NOT NULL DEFAULT 1,
  published_at timestamptz NOT NULL DEFAULT now(),
  published_by uuid,
  content jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_content_published_version ON content_published(version DESC);

COMMIT;
