import type { RedeemResult } from './types.ts';
import { withDbClient, type PoolClient } from './db.ts';
import { applyCityRules, computeDiscountAmount, normalizeNumber, toAppliedDiscount } from './discounts.ts';

export interface RedeemInput {
  userId?: string;
  vendorId?: string;
  discountCode?: string;
  discountId?: string;
  city?: string | null;
  purchaseAmount?: number | null;
  actorType?: 'admin' | 'vendor' | 'customer' | 'system';
  actorId?: string | null;
  ip?: string | null;
}

function asNumeric(value: unknown): number {
  return normalizeNumber(typeof value === 'number' || typeof value === 'string' ? value : 0);
}

export async function redeemDiscount(input: RedeemInput): Promise<RedeemResult> {
  return await withDbClient(async (client) => {
    await client.query('BEGIN');
    try {
      const result = await redeemDiscountWithClient(client, input);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

// Discounts are vendor-scoped: each vendor carries at most one active deal and
// the redemption flow is fully anonymous — no membership card or account is
// involved. Vendor/deal level limits (active window, max uses) still apply.
export async function redeemDiscountWithClient(client: PoolClient, input: RedeemInput): Promise<RedeemResult> {
  const userId = input.userId ?? null;
  let vendorId = input.vendorId ?? null;
  let discountId = input.discountId ?? null;

  if (input.discountCode) {
    const codeRows = await client.query<{
      discount_id: string;
      vendor_id: string;
      active: boolean;
    }>(
      `SELECT id AS discount_id, vendor_id, active FROM discounts WHERE discount_code = $1 LIMIT 1`,
      [input.discountCode],
    );
    const codeRow = codeRows.rows[0];
    if (!codeRow || !codeRow.active) {
      return await denyAndReturn(client, input, { valid: false, reason: 'Discount not found' }, userId);
    }
    vendorId = codeRow.vendor_id;
    discountId = codeRow.discount_id;
    input.vendorId = codeRow.vendor_id;
    input.discountId = codeRow.discount_id;
  }

  if (!vendorId) {
    throw new Error('vendorId or discountCode is required');
  }

  const discountRows = await client.query<{
    id: string;
    vendor_id: string;
    type: 'fixed' | 'percent' | 'bogo';
    value: string;
    description: string | null;
    min_purchase: string;
    max_uses_total: number | null;
    uses_count: number;
    city_overrides: Record<string, { type?: 'fixed' | 'percent' | 'bogo'; value?: number }> | null;
    active: boolean;
  }>(
    `SELECT * FROM discounts WHERE vendor_id = $1 ${discountId ? 'AND id = $2' : ''} ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
    discountId ? [vendorId, discountId] : [vendorId],
  );

  const discount = discountRows.rows[0];
  if (!discount) {
    return await denyAndReturn(client, input, { valid: false, reason: 'Discount not found' }, userId);
  }

  const adjustedDiscount = applyCityRules(
    {
      type: discount.type,
      value: asNumeric(discount.value),
      minPurchase: asNumeric(discount.min_purchase),
      cityOverrides: discount.city_overrides,
    },
    input.city ?? null,
  );

  if (!discount.active) {
    return await denyAndReturn(client, input, { valid: false, reason: 'Discount is inactive' }, userId);
  }
  if (discount.max_uses_total !== null && discount.uses_count >= discount.max_uses_total) {
    return await denyAndReturn(client, input, { valid: false, reason: 'Discount limit reached' }, userId);
  }

  const amountInput = {
    type: adjustedDiscount.type,
    value: adjustedDiscount.value,
    description: discount.description,
    ...(input.purchaseAmount !== undefined && input.purchaseAmount !== null ? { purchaseAmount: input.purchaseAmount } : {}),
  };
  const computed = computeDiscountAmount(amountInput);
  const applied = toAppliedDiscount(amountInput);
  const redemption = await client.query<{ id: string }>(
    `
      INSERT INTO redemptions (discount_id, vendor_id, user_id, amount_applied, city, status, reason)
      VALUES ($1, $2, $3, $4, $5, 'approved', NULL)
      RETURNING id
    `,
    [discount.id, vendorId, userId, computed.amountApplied, input.city ?? null],
  );
  await client.query('UPDATE discounts SET uses_count = uses_count + 1, updated_at = now() WHERE id = $1', [discount.id]);
  await client.query(
    `
      INSERT INTO transactions (actor_type, actor_id, action, entity_type, entity_id, metadata, ip)
      VALUES ($1, $2, $3, 'redemption', $4, $5::jsonb, $6)
    `,
    [
      input.actorType ?? 'system',
      input.actorId ?? null,
      'redeem.approved',
      redemption.rows[0]!.id,
      { discountId: discount.id, vendorId, amountApplied: computed.amountApplied, city: input.city ?? null },
      input.ip ?? null,
    ],
  );

  const success: RedeemResult = { valid: true, discount: applied, amountApplied: computed.amountApplied, redemptionId: redemption.rows[0]!.id };
  if (computed.instruction) {
    success.instruction = computed.instruction;
  }
  return success;
}

async function denyAndReturn(
  client: PoolClient,
  input: RedeemInput,
  result: RedeemResult,
  userId?: string | null,
): Promise<RedeemResult> {
  if (!input.vendorId) {
    return result;
  }

  const denied = await client.query<{ id: string }>(
    `
      INSERT INTO redemptions (discount_id, vendor_id, user_id, amount_applied, city, status, reason)
      VALUES ($1, $2, $3, 0, $4, 'denied', $5)
      RETURNING id
    `,
    [input.discountId ?? null, input.vendorId, userId ?? null, input.city ?? null, result.reason ?? 'Denied'],
  );

  await client.query(
    `
      INSERT INTO transactions (actor_type, actor_id, action, entity_type, entity_id, metadata, ip)
      VALUES ($1, $2, $3, 'redemption', $4, $5::jsonb, $6)
    `,
    [
      input.actorType ?? 'system',
      input.actorId ?? null,
      'redeem.denied',
      denied.rows[0]!.id,
      { reason: result.reason, discountId: input.discountId ?? null, vendorId: input.vendorId },
      input.ip ?? null,
    ],
  );
  return result;
}
