-- Vendor website/contact URL for dashboard display and map listings.
BEGIN;

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS website text;

COMMIT;
