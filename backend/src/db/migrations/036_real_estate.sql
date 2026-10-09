-- Real estate listings shown on the app's Real Estate tab.
-- Rows with active = true are included in the /api/app snapshot; the tab
-- shows a "Coming soon" state until the first listing is added.
CREATE TABLE IF NOT EXISTS real_estate (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  price numeric,
  beds numeric,
  baths numeric,
  sqft integer,
  property_type text,
  listing_status text NOT NULL DEFAULT 'for_sale',
  address text,
  city text,
  state text,
  zip text,
  phone text,
  email text,
  website text,
  image_url text,
  station text,
  latitude double precision,
  longitude double precision,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_real_estate_active ON real_estate(active);
CREATE INDEX IF NOT EXISTS idx_real_estate_station ON real_estate(station);
