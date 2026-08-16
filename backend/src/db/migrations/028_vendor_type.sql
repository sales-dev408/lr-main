-- Vendor classification for public browsing (restaurant / bar / cafe / other).
BEGIN;

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS vendor_type text,
  ADD COLUMN IF NOT EXISTS cuisine text;

CREATE INDEX IF NOT EXISTS idx_vendors_vendor_type ON vendors(vendor_type);
CREATE INDEX IF NOT EXISTS idx_vendors_cuisine ON vendors(cuisine);

COMMIT;
