-- Ticket random drawings and per-vendor redemption limits.

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS drawing_deadline timestamptz NOT NULL DEFAULT now() + interval '7 days',
  ADD COLUMN IF NOT EXISTS drawing_status text NOT NULL DEFAULT 'open' CHECK (drawing_status IN ('open', 'drawn', 'closed'));

CREATE TABLE IF NOT EXISTS ticket_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_count int NOT NULL CHECK (requested_count BETWEEN 1 AND 4),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ticket_id, user_id)
);

CREATE INDEX IF NOT EXISTS ticket_entries_ticket_id_idx ON ticket_entries(ticket_id);
CREATE INDEX IF NOT EXISTS ticket_entries_user_id_idx ON ticket_entries(user_id);
