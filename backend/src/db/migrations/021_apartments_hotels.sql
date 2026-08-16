-- Apartments and hotels listings on or near the light rail.

BEGIN;

CREATE TABLE IF NOT EXISTS apartments_hotels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  section text,
  station text,
  address text,
  city text,
  state text,
  zip text,
  phone text,
  website text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_apartments_hotels_section ON apartments_hotels(section);
CREATE INDEX IF NOT EXISTS idx_apartments_hotels_station ON apartments_hotels(station);

COMMIT;
