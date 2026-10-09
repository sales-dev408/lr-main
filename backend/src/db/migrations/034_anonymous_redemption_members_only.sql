BEGIN;

-- Anonymous redemption tokens: the app is usable without an account, so a
-- redemption token may be created without a signed-in user. The row keeps the
-- FK to users when a member is present.
ALTER TABLE redemption_tokens
  ALTER COLUMN user_id DROP NOT NULL;

-- Members-only discounts: admins can flag a discount so it is only redeemable
-- by signed-in members. It still appears in the public directory.
ALTER TABLE discounts
  ADD COLUMN IF NOT EXISTS members_only boolean NOT NULL DEFAULT false;

COMMIT;
