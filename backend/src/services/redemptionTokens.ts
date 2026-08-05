import type { PoolClient } from '../db/pool.js';
import { withDbClient } from '../db/pool.js';
import { generateOpaqueToken } from '../utils/ids.js';
import { redeemDiscount } from './redeem.js';
import type { AppliedDiscount } from '../types.js';

const TOKEN_TTL_MINUTES = 5;

const DEFAULT_TERMS = 'Cannot be applied with any other offer\nNot redeemable for cash\nCan be used 1 time per week';

export interface RedemptionTokenPayload {
  token: string;
  url: string;
  vendorName: string;
  discountLabel: string;
  discountDescription: string;
  terms: string;
  amountApplied: number;
  expiresAt: string;
}

export async function createRedemptionToken(client: PoolClient, userId: string, vendorId: string): Promise<RedemptionTokenPayload> {
  const membership = await client.query<{ id: string; name: string }>(
    'SELECT id, name FROM cards WHERE is_membership = true AND status = $1 LIMIT 1',
    ['active'],
  );
  const card = membership.rows[0];
  if (!card) {
    throw new Error('Membership card not found');
  }

  const discountRows = await client.query<{
    id: string;
    type: 'fixed' | 'percent' | 'bogo';
    value: string;
    description: string | null;
  }>(
    `SELECT d.id, d.type, d.value, d.description
     FROM discounts d
     JOIN cards c ON c.id = d.card_id AND c.is_membership = true
     WHERE d.vendor_id = $1 AND d.card_id = $2 AND d.active = true
       AND (d.starts_at IS NULL OR d.starts_at <= now())
       AND (d.ends_at IS NULL OR d.ends_at >= now())
     LIMIT 1`,
    [vendorId, card.id],
  );
  const discount = discountRows.rows[0];
  if (!discount) {
    throw new Error('No active discount found for this vendor');
  }

  const token = generateOpaqueToken(18);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

  const termsRows = await client.query<{ discount_terms: string | null; name: string }>(
    'SELECT discount_terms, name FROM vendors WHERE id = $1 LIMIT 1',
    [vendorId],
  );
  const vendorName = termsRows.rows[0]?.name ?? 'Participating vendor';
  const terms = termsRows.rows[0]?.discount_terms?.trim() || DEFAULT_TERMS;

  const numericValue = Number(discount.value) || 0;
  const label =
    discount.type === 'bogo'
      ? discount.description?.trim() || 'Buy one, get one'
      : discount.type === 'percent'
        ? `${numericValue}% off`
        : `$${numericValue.toFixed(2)} off`;

  const amountApplied = discount.type === 'fixed' ? numericValue : 0;

  await client.query(
    `INSERT INTO redemption_tokens (token, user_id, card_id, vendor_id, discount_id, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [token, userId, card.id, vendorId, discount.id, expiresAt.toISOString()],
  );

  const base = process.env.REDEEM_BASE_URL || process.env.PUBLIC_REDEEM_URL || '';
  const url = `${base.replace(/\/$/, '')}/redeem/${token}`;

  return {
    token,
    url,
    vendorName,
    discountLabel: label,
    discountDescription: discount.description?.trim() || label,
    terms,
    amountApplied,
    expiresAt: expiresAt.toISOString(),
  };
}

interface TokenRow {
  token: string;
  user_id: string;
  card_id: string;
  vendor_id: string;
  discount_id: string;
  status: string;
  expires_at: string;
}

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() <= Date.now();
}

export interface RedeemTokenResult {
  ok: boolean;
  discount?: AppliedDiscount;
  amountApplied?: number;
  redemptionId?: string;
  error?: string;
}

async function loadTokenForUpdate(client: PoolClient, token: string): Promise<TokenRow | null> {
  const rows = await client.query<TokenRow>(
    `SELECT token, user_id, card_id, vendor_id, discount_id, status, expires_at
     FROM redemption_tokens
     WHERE token = $1
     FOR UPDATE`,
    [token],
  );
  return rows.rows[0] ?? null;
}

async function markTokenUsed(client: PoolClient, token: string, redemptionId: string, affirmationName?: string): Promise<void> {
  await client.query(
    `UPDATE redemption_tokens
     SET status = 'used', used_at = now(), redemption_id = $2, affirmation_name = $3
     WHERE token = $1`,
    [token, redemptionId, affirmationName?.trim() || null],
  );
}

async function revertToken(client: PoolClient, token: string): Promise<void> {
  await client.query(
    `UPDATE redemption_tokens
     SET status = 'pending', used_at = null, redemption_id = null, affirmation_name = null
     WHERE token = $1`,
    [token],
  );
}

async function redeemTokenRow(client: PoolClient, row: TokenRow, actorType: 'vendor' | 'customer', actorId: string, ip?: string | null): Promise<RedeemTokenResult> {
  const result = await redeemDiscount({
    cardId: row.card_id,
    vendorId: row.vendor_id,
    discountId: row.discount_id,
    userId: row.user_id,
    actorType,
    actorId,
    ip: ip ?? null,
  });

  if (!result.valid || !result.redemptionId) {
    return { ok: false, error: result.reason ?? 'Unable to redeem this discount' };
  }

  return {
    ok: true,
    discount: result.discount!,
    amountApplied: result.amountApplied ?? 0,
    redemptionId: result.redemptionId,
  };
}

export async function redeemByToken(token: string, ip?: string | null): Promise<RedeemTokenResult> {
  return withDbClient(async (client) => {
    const row = await loadTokenForUpdate(client, token);
    if (!row) {
      return { ok: false, error: 'Invalid or expired QR code' };
    }
    if (row.status !== 'pending' || isExpired(row.expires_at)) {
      await client.query("UPDATE redemption_tokens SET status = 'expired' WHERE token = $1 AND status = 'pending'", [token]);
      return { ok: false, error: 'This QR code has already been used or expired' };
    }

    const result = await redeemTokenRow(client, row, 'vendor', row.vendor_id, ip);
    if (!result.ok) {
      return result;
    }

    await markTokenUsed(client, token, result.redemptionId!);
    return result;
  });
}

export async function affirmRedemptionToken(token: string, userId: string, affirmationName: string, ip?: string | null): Promise<RedeemTokenResult> {
  if (!affirmationName.trim()) {
    return { ok: false, error: 'Please sign your name to confirm you used the discount' };
  }

  return withDbClient(async (client) => {
    const row = await loadTokenForUpdate(client, token);
    if (!row) {
      return { ok: false, error: 'Invalid or expired discount' };
    }
    if (row.user_id !== userId) {
      return { ok: false, error: 'This discount does not belong to you' };
    }
    if (row.status !== 'pending' || isExpired(row.expires_at)) {
      await client.query("UPDATE redemption_tokens SET status = 'expired' WHERE token = $1 AND status = 'pending'", [token]);
      return { ok: false, error: 'This discount has already been used or expired' };
    }

    const result = await redeemTokenRow(client, row, 'customer', userId, ip);
    if (!result.ok) {
      await revertToken(client, token);
      return result;
    }

    await markTokenUsed(client, token, result.redemptionId!, affirmationName);
    return result;
  });
}
