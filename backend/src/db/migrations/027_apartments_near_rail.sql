-- Track which apartments/hotels are within half a mile of the light rail.
BEGIN;

ALTER TABLE apartments_hotels
  ADD COLUMN IF NOT EXISTS near_rail boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS distance_miles double precision;

CREATE INDEX IF NOT EXISTS idx_apartments_near_rail ON apartments_hotels(near_rail) WHERE near_rail = true;

COMMIT;
