-- Manageable list of light rail stops used to link vendors, apartments, and content.

BEGIN;

CREATE TABLE IF NOT EXISTS stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text,
  line text,
  position int,
  latitude double precision,
  longitude double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stops_name ON stops(name);
CREATE INDEX IF NOT EXISTS idx_stops_city ON stops(city);
CREATE INDEX IF NOT EXISTS idx_stops_line ON stops(line);

COMMIT;
