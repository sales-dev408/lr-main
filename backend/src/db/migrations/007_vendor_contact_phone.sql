-- Vendor contact details: add phone and make POS type optional so the admin dashboard
-- can create vendors without selecting a POS system.

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS phone text NULL;
ALTER TABLE vendors ALTER COLUMN pos_type DROP NOT NULL;
