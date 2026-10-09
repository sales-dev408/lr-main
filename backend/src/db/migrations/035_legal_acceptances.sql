BEGIN;

-- First-run legal gate: users accept the Terms of Use, Privacy Policy, and
-- EULA before entering the app — usually without an account. Each acceptance
-- is recorded with the request IP and timestamp so there is a durable audit
-- trail independent of whether the user ever signs up.
CREATE TABLE IF NOT EXISTS legal_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  platform text,
  ip inet,
  user_agent text,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS legal_acceptances_user_idx ON legal_acceptances(user_id);
CREATE INDEX IF NOT EXISTS legal_acceptances_accepted_at_idx ON legal_acceptances(accepted_at);

COMMIT;
