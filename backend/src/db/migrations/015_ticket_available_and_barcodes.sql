-- Add per-drawing available ticket count and winner barcodes.

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS available_count int NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS barcodes jsonb NOT NULL DEFAULT '[]'::jsonb;

-- GIN index for quick membership checks when filtering winner barcodes.
CREATE INDEX IF NOT EXISTS tickets_barcodes_gin_idx ON tickets USING GIN (barcodes);
