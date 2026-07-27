import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiscountRule } from '../types.js';

const dbQuery = vi.fn();

vi.mock('../db/pool.js', () => ({
  dbQuery: (...args: unknown[]) => dbQuery(...args),
}));

const { resolvePassLookup } = await import('./lookup.js');

const PASS_ROW = {
  pass_id: 'pass-1',
  user_id: 'user-1',
  card_id: 'card-membership',
  user_email: 'member@example.com',
  user_phone: '+16025551234',
  user_full_name: 'Ada Member',
  card_name: 'Light Rail Membership',
  card_theme: 'shops_restaurants',
  card_description: null,
  card_image_url: null,
  vendor_id: 'vendor-a',
  vendor_name: 'Vendor A',
};

function discount(vendorId: string, value: string): DiscountRule {
  return {
    id: `discount-${vendorId}`,
    cardId: 'card-membership',
    vendorId,
    type: 'percent',
    value,
    minPurchase: '0',
    maxUsesTotal: null,
    maxUsesPerCustomer: null,
    usesCount: 0,
    cityOverrides: {},
    active: true,
  };
}

describe('resolvePassLookup', () => {
  beforeEach(() => {
    dbQuery.mockReset();
  });

  it('resolves only the scanning vendor\'s discount from the shared membership card', async () => {
    dbQuery.mockResolvedValueOnce([PASS_ROW]).mockResolvedValueOnce([discount('vendor-a', '15')]);

    const result = await resolvePassLookup('opaque-lookup-token', 'vendor-a', 'Phoenix');

    expect(result?.discounts).toHaveLength(1);
    expect(result?.discounts[0]?.vendorId).toBe('vendor-a');
    expect(result?.discounts[0]?.applied.description).toContain('15%');

    // The vendor id must reach the discount query so a member barcode alone
    // never exposes another vendor's offer.
    const [, discountParams] = dbQuery.mock.calls[1] as [string, unknown[]];
    expect(discountParams).toEqual(['card-membership', 'vendor-a']);
  });

  it('returns every membership discount when no vendor context is supplied', async () => {
    dbQuery.mockResolvedValueOnce([PASS_ROW]).mockResolvedValueOnce([discount('vendor-a', '15'), discount('vendor-b', '20')]);

    const result = await resolvePassLookup('opaque-lookup-token');

    expect(result?.discounts.map((item) => item.vendorId)).toEqual(['vendor-a', 'vendor-b']);
    const [, discountParams] = dbQuery.mock.calls[1] as [string, unknown[]];
    expect(discountParams).toEqual(['card-membership', null]);
  });

  it('returns null for an unknown barcode', async () => {
    dbQuery.mockResolvedValueOnce([]);
    expect(await resolvePassLookup('not-a-real-token', 'vendor-a')).toBeNull();
  });
});
