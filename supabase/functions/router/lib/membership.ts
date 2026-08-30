import { withDbClient } from './db.ts';
import { generateOpaqueToken } from './ids.ts';
import { getMembershipCardId } from './vendors.ts';

export interface MembershipPass {
  id: string;
  user_id: string;
  serial_number: string;
  lookup_token: string;
  auth_token: string;
  card_id: string;
  platform: string;
  barcode_value: string | null;
}

const PASS_COLUMNS = `id, user_id, serial_number, lookup_token, auth_token, card_id, platform,
  barcode_value`;

// Idempotently returns the user's single membership pass, creating the DB row
// and the hosted Passcreator pass on first use. Called right after signup so a
// pass is auto-generated for every user, and lazily whenever the pass is read.
export async function ensureMembershipPass(userId: string, opts?: { platform?: 'apple' | 'google' }): Promise<MembershipPass> {
  return withDbClient(async (client) => {
    const membership = await getMembershipCardId(client);

    const existing = await client.query<MembershipPass>(
      `SELECT ${PASS_COLUMNS} FROM passes WHERE user_id = $1 AND card_id = $2 ORDER BY created_at ASC LIMIT 1`,
      [userId, membership.id],
    );
    let pass = existing.rows[0];

    if (!pass) {
      const serial = generateOpaqueToken(12);
      const lookup = generateOpaqueToken(18);
      const authToken = generateOpaqueToken(18);
      const inserted = await client.query<MembershipPass>(
        `INSERT INTO passes (user_id, card_id, platform, serial_number, auth_token, lookup_token, barcode_value)
         VALUES ($1, $2, $3, $4, $5, $6, $6)
         RETURNING ${PASS_COLUMNS}`,
        [userId, membership.id, opts?.platform ?? 'apple', serial, authToken, lookup],
      );
      pass = inserted.rows[0]!;
    }

    return pass!;
  });
}

// Wallet pass downloads are disabled; always returns null.
export function membershipWalletUrl(_pass: MembershipPass): string | null {
  return null;
}
