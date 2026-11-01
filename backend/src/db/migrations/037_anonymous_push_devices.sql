-- Anonymous push notification devices + campaign delivery ledger.
-- Push registration no longer requires a user account.
CREATE TABLE IF NOT EXISTS push_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expo_push_token text NOT NULL UNIQUE,
  platform text,
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS push_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_key text UNIQUE,
  title text NOT NULL,
  body text NOT NULL,
  created_by uuid,
  sent_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE TABLE IF NOT EXISTS push_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES push_campaigns(id) ON DELETE CASCADE,
  expo_push_token text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, expo_push_token)
);
-- Legal acceptance is anonymous now: track device id instead of user id.
ALTER TABLE legal_acceptances ADD COLUMN IF NOT EXISTS device_id text;
