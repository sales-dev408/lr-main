-- §12: drop obsolete structures (apply AFTER the vendor-scoped router deploy).
CREATE TABLE IF NOT EXISTS _backup_users AS SELECT * FROM users;
CREATE TABLE IF NOT EXISTS _backup_passes AS SELECT * FROM passes;
CREATE TABLE IF NOT EXISTS _backup_cards AS SELECT * FROM cards;
CREATE TABLE IF NOT EXISTS _backup_card_vendors AS SELECT * FROM card_vendors;
CREATE TABLE IF NOT EXISTS _backup_gift_cards AS SELECT * FROM gift_cards;
CREATE TABLE IF NOT EXISTS _backup_tickets AS SELECT * FROM tickets;
CREATE TABLE IF NOT EXISTS _backup_ticket_entries AS SELECT * FROM ticket_entries;
CREATE TABLE IF NOT EXISTS _backup_pos_connections AS SELECT * FROM pos_connections;
CREATE TABLE IF NOT EXISTS _backup_pos_discount_mappings AS SELECT * FROM pos_discount_mappings;
CREATE TABLE IF NOT EXISTS _backup_pos_sync_logs AS SELECT * FROM pos_sync_logs;
ALTER TABLE discounts DROP COLUMN IF EXISTS card_id;
ALTER TABLE redemptions DROP COLUMN IF EXISTS card_id, DROP COLUMN IF EXISTS pass_id, DROP COLUMN IF EXISTS gift_card_id;
ALTER TABLE redemptions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE redemption_tokens DROP COLUMN IF EXISTS card_id, DROP COLUMN IF EXISTS user_id;
ALTER TABLE legal_acceptances DROP COLUMN IF EXISTS user_id;
DROP TABLE IF EXISTS ticket_entries, tickets, gift_cards, passes, card_vendors, cards, pos_discount_mappings, pos_sync_logs, pos_connections, users CASCADE;
-- Discounts are now vendor-scoped (one deal per vendor); upserts rely on this.
ALTER TABLE discounts ADD CONSTRAINT discounts_vendor_id_key UNIQUE (vendor_id);
