-- Custom event tickets.
-- Admins add tickets by barcode (scanned or typed) and set the allowed number of uses.
-- Tickets appear in the mobile app for signed-in members to show at the event.

CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT 'Event Ticket',
  barcode text NOT NULL UNIQUE,
  allowed_uses int NOT NULL DEFAULT 1,
  used_uses int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tickets_user_id_idx ON tickets(user_id);
CREATE INDEX IF NOT EXISTS tickets_status_idx ON tickets(status);
