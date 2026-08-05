BEGIN;

-- Marketing opt-in and legal acceptance on users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS promo_email_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promo_sms_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS eula_accepted_at timestamptz;

-- Vendor-wide discount terms shown in the mobile app
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS discount_terms text;

UPDATE vendors
  SET discount_terms = 'Cannot be applied with any other offer\nNot redeemable for cash\nCan be used 1 time per week'
  WHERE discount_terms IS NULL;

-- Optional per-discount description (required for BOGO)
ALTER TABLE discounts
  ADD COLUMN IF NOT EXISTS description text;

-- One-time QR redemption tokens shown by customers and scanned by vendors
CREATE TABLE IF NOT EXISTS redemption_tokens (
  token text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  discount_id uuid NOT NULL REFERENCES discounts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'used', 'expired')),
  affirmation_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  redemption_id uuid REFERENCES redemptions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS redemption_tokens_user_idx ON redemption_tokens (user_id);
CREATE INDEX IF NOT EXISTS redemption_tokens_vendor_idx ON redemption_tokens (vendor_id);
CREATE INDEX IF NOT EXISTS redemption_tokens_expires_at_idx ON redemption_tokens (expires_at);

COMMIT;
