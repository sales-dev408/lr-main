-- Distinguish apartments from hotels in the apartments_hotels directory.
BEGIN;

ALTER TABLE apartments_hotels
  ADD COLUMN IF NOT EXISTS listing_type text NOT NULL DEFAULT 'apartment';

ALTER TABLE apartments_hotels
  DROP CONSTRAINT IF EXISTS apartments_hotels_listing_type_check;

ALTER TABLE apartments_hotels
  ADD CONSTRAINT apartments_hotels_listing_type_check
  CHECK (listing_type IN ('apartment', 'hotel'));

CREATE INDEX IF NOT EXISTS idx_apartments_hotels_listing_type ON apartments_hotels(listing_type);

COMMIT;
