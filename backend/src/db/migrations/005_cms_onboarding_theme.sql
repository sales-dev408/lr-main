-- Phase 2: onboarding names, admin-managed CMS content, and shared theme settings.

BEGIN;

-- Onboarding captures the member's first/last name. full_name is kept for
-- backwards compatibility and derived from these when they are provided.
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name text NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name text NULL;

-- CMS content authored in the admin dashboard (or in-app by an admin) and
-- rendered to members in the app's Discover feed.
CREATE TABLE IF NOT EXISTS content_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'article', 'image', 'file', 'embed')),
  title text NOT NULL DEFAULT '',
  body text NULL,
  url text NULL,
  position int NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_blocks_order_idx ON content_blocks (published, position, created_at);

-- Key/value application settings shared by the mobile app and admin site. The
-- theme entry drives the blue/red/green bottom-tab styling in both clients.
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app_settings (key, value)
VALUES (
  'theme',
  '{
    "brand": "#2563eb",
    "primaryGradient": ["#2563eb", "#16a34a"],
    "tabs": [
      { "key": "vendors", "label": "Deals",     "color": "#2563eb", "gradient": ["#3b82f6", "#1d4ed8"] },
      { "key": "index",   "label": "Browse",    "color": "#dc2626", "gradient": ["#ef4444", "#b91c1c"] },
      { "key": "discover","label": "Discover",  "color": "#16a34a", "gradient": ["#22c55e", "#15803d"] },
      { "key": "passes",  "label": "My Pass",   "color": "#2563eb", "gradient": ["#3b82f6", "#1d4ed8"] },
      { "key": "profile", "label": "Profile",   "color": "#16a34a", "gradient": ["#22c55e", "#15803d"] }
    ]
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;

COMMIT;
