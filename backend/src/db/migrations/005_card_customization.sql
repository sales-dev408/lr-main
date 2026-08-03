-- Extend cards with membership-card customization fields.
ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS logo_url text NULL,
  ADD COLUMN IF NOT EXISTS icon_url text NULL,
  ADD COLUMN IF NOT EXISTS primary_color text NULL,
  ADD COLUMN IF NOT EXISTS secondary_color text NULL,
  ADD COLUMN IF NOT EXISTS qr_size int NULL DEFAULT 240,
  ADD COLUMN IF NOT EXISTS layout text NULL DEFAULT 'qr_bottom';
