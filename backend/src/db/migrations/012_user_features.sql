-- Add per-user push notification preferences and account deletion support.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS push_enabled_new_vendor boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS push_enabled_expiring_deal boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS push_enabled_local_event boolean NOT NULL DEFAULT true;
