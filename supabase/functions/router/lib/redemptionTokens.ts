import type { PoolClient } from './db.ts';
import { withDbClient } from './db.ts';
import { generateOpaqueToken } from './ids.ts';
import { redeemDiscount } from './redeem.ts';
import { toAppliedDiscount, humanDiscountLabel } from './discounts.ts';
import { config } from './config.ts';
import type { RedeemResult } from './types.ts';

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

export interface RedeemTokenResult {
  ok: boolean;
  discount?: { type: 'fixed' | 'percent' | 'bogo'; value: number; description: string; instruction?: string };
  amountApplied?: number;
  redemptionId?: string;
  error?: string;
}

export async function createRedemptionToken(client: PoolClient, userId: string, vendorId: string): Promise<RedemptionTokenPayload> {
  const membership = await client.query<{ id: string; name: string }>(
    'SELECT id, name FROM cards WHERE is_membership = true AND status = $1 LIMIT 1',
    ['active'],
  );
  if (!membership.rows[0]) {
    throw new Error('No active membership card found');
  }
  const cardId = membership.rows[0].id;

  const discountRows = await client.query<{
    id: string;
    type: 'fixed' | 'percent' | 'bogo';
    value: string;
    description: string | null;
    min_purchase: string | number | null;
    city_overrides: Record<string, { type?: 'fixed' | 'percent' | 'bogo'; value?: number }> | null;
    active: boolean;
    max_uses_total: number | null;
    uses_count: number;
  }>(
    'SELECT * FROM discounts WHERE card_id = $1 AND vendor_id = $2 AND active = true LIMIT 1',
    [cardId, vendorId],
  );
  const discount = discountRows.rows[0];
  if (!discount) {
    throw new Error('No active discount for this vendor');
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
    discount.description?.trim() ||
    (discount.type === 'bogo'
      ? 'Buy one, get one offer'
      : discount.type === 'percent'
        ? `${numericValue}% off`
        : `$${numericValue.toFixed(2)} off`);

  const base = config.redeemBaseUrl || config.publicApiBaseUrl || '';
  const url = `${base.replace(/\/$/, '')}/redeem/${token}`;

  const computed = toAppliedDiscount({ type: discount.type, value: numericValue, description: discount.description });

  await client.query(
    `INSERT INTO redemption_tokens (token, user_id, card_id, vendor_id, discount_id, status, created_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, 'pending', now(), $6)`,
    [token, userId, cardId, vendorId, discount.id, expiresAt.toISOString()],
  );

  return {
    token,
    url,
    vendorName,
    discountLabel: label,
    discountDescription: discount.description?.trim() || label,
    terms,
    amountApplied: computed.amountApplied ?? 0,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function redeemByToken(token: string, ip?: string | null): Promise<RedeemTokenResult> {
  return await withDbClient(async (client) => {
    await client.query('BEGIN');
    try {
      const tokenRows = await client.query<{
        user_id: string;
        card_id: string;
        vendor_id: string;
        discount_id: string;
        status: string;
        expires_at: string;
      }>(
        'SELECT user_id, card_id, vendor_id, discount_id, status, expires_at FROM redemption_tokens WHERE token = $1 FOR UPDATE',
        [token],
      );
      const row = tokenRows.rows[0];
      if (!row) {
        await client.query('COMMIT');
        return { ok: false, error: 'Invalid or expired redemption code' };
      }
      if (row.status !== 'pending' || new Date(row.expires_at) < new Date()) {
        await client.query("UPDATE redemption_tokens SET status = 'expired' WHERE token = $1", [token]);
        await client.query('COMMIT');
        return { ok: false, error: 'This redemption code has expired or already been used' };
      }

      const result = await redeemDiscount({
        userId: row.user_id,
        cardId: row.card_id,
        vendorId: row.vendor_id,
        discountId: row.discount_id,
        actorType: 'vendor',
        actorId: null,
        ip,
      });

      if (!result.valid || !result.redemptionId) {
        await client.query("UPDATE redemption_tokens SET status = 'expired' WHERE token = $1", [token]);
        await client.query('COMMIT');
        return { ok: false, error: result.reason ?? 'Unable to apply discount' };
      }

      await client.query(
        "UPDATE redemption_tokens SET status = 'used', used_at = now(), redemption_id = $2 WHERE token = $1",
        [token, result.redemptionId],
      );

      await client.query('COMMIT');

      return {
        ok: true,
        discount: result.discount,
        amountApplied: result.amountApplied,
        redemptionId: result.redemptionId,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

export async function affirmRedemptionToken(token: string, userId: string, affirmationName: string, ip?: string | null): Promise<RedeemTokenResult> {
  return await withDbClient(async (client) => {
    await client.query('BEGIN');
    try {
      const tokenRows = await client.query<{
        user_id: string;
        card_id: string;
        vendor_id: string;
        discount_id: string;
        status: string;
        expires_at: string;
      }>(
        'SELECT user_id, card_id, vendor_id, discount_id, status, expires_at FROM redemption_tokens WHERE token = $1 FOR UPDATE',
        [token],
      );
      const row = tokenRows.rows[0];
      if (!row) {
        await client.query('COMMIT');
        return { ok: false, error: 'Invalid or expired redemption code' };
      }
      if (row.user_id !== userId) {
        await client.query('COMMIT');
        return { ok: false, error: 'This code does not belong to your account' };
      }
      if (row.status !== 'pending' || new Date(row.expires_at) < new Date()) {
        await client.query("UPDATE redemption_tokens SET status = 'expired' WHERE token = $1", [token]);
        await client.query('COMMIT');
        return { ok: false, error: 'This redemption code has expired or already been used' };
      }

      const result = await redeemDiscount({
        userId: row.user_id,
        cardId: row.card_id,
        vendorId: row.vendor_id,
        discountId: row.discount_id,
        actorType: 'customer',
        actorId: userId,
        ip,
      });

      if (!result.valid || !result.redemptionId) {
        await client.query("UPDATE redemption_tokens SET status = 'expired' WHERE token = $1", [token]);
        await client.query('COMMIT');
        return { ok: false, error: result.reason ?? 'Unable to apply discount' };
      }

      await client.query(
        'UPDATE redemptions SET affirmation_name = $2 WHERE id = $1',
        [result.redemptionId, affirmationName],
      );

      await client.query(
        "UPDATE redemption_tokens SET status = 'used', used_at = now(), redemption_id = $2, affirmation_name = $3 WHERE token = $1",
        [token, result.redemptionId, affirmationName],
      );

      await client.query('COMMIT');

      return {
        ok: true,
        discount: result.discount,
        amountApplied: result.amountApplied,
        redemptionId: result.redemptionId,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}
