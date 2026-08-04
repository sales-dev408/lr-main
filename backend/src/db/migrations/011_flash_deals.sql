-- Flash-deal scheduling for time-boxed, boosted vendor discounts.
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS starts_at timestamptz NULL;
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS ends_at timestamptz NULL;
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS boosted boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS discounts_flash_active_idx
  ON discounts (starts_at, ends_at, boosted)
  WHERE active = true;
