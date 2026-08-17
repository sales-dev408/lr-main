import { dbQuery, withDbClient, type PoolClient } from './db.ts';
import { generateDiscountCode, humanDiscountLabel, type DiscountType } from './codes.ts';
import { uploadImageDataUrl } from './storage.ts';
import { config } from './config.ts';
import { sendVendorWelcomeEmail } from './resend.ts';
import { qrCodeUrl } from './quickchart.ts';
import { getPushTokensForNewVendor, sendPushNotifications } from './push.ts';

export type VendorCategory = 'Sports' | 'Dining' | 'Entertainment';

export interface CreateVendorInput {
  name: string;
  ownerName?: string | null;
  address?: string | null;
  category: VendorCategory;
  email?: string | null;
  phone?: string | null;
  discountType: DiscountType;
  discountValue: number;
  discountDescription?: string | null;
  discountTerms?: string | null;
  discountStartsAt?: string | null;
  discountEndsAt?: string | null;
  boosted?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  iconDataUrl?: string | null;
  logoDataUrl?: string | null;
}

export interface CreateVendorResult {
  vendor: { id: string; name: string; ownerName: string | null; address: string | null; category: string; email: string | null; phone: string | null };
  discountCode: string;
  discount: { id: string; type: DiscountType; value: number; label: string };
  membershipCard: { id: string; name: string };
  posInstructions: string;
}

function posInstructions(code: string, label: string): string {
  return [
    `Activate the "${label}" member discount in your point-of-sale system:`,
    '1. Ask the customer to show their Light Rail membership pass and scan its barcode (or check the participating-business list in the app).',
    `2. Apply this discount using code ${code}.`,
    '3. No NFC or special hardware is required — any barcode scanner or manual keypad works.',
  ].join('\n');
}

// Returns the id of the singleton membership card, creating it if needed.
export async function getMembershipCardId(client: PoolClient): Promise<{ id: string; name: string }> {
  const existing = await client.query<{ id: string; name: string }>('SELECT id, name FROM cards WHERE is_membership = true LIMIT 1');
  if (existing.rows[0]) return existing.rows[0];
  const created = await client.query<{ id: string; name: string }>(
    `INSERT INTO cards (name, theme, description, status, is_membership)
     VALUES ('Light Rail Membership', 'shops_restaurants', 'Your all-in-one membership card. Show it at any participating business for member discounts.', 'active', true)
     RETURNING id, name`,
  );
  return created.rows[0]!;
}

// "Add a vendor" workflow for the membership model: creates the vendor, attaches
// its exclusive discount to the single membership card, and generates a
// POS-friendly discount code. No per-vendor wallet pass is created — every
// member carries one membership pass that unlocks all vendor discounts.
export async function createVendorWithDiscount(input: CreateVendorInput): Promise<CreateVendorResult> {
  const label = humanDiscountLabel(input.discountType, input.discountValue);

  return await withDbClient(async (client: PoolClient) => {
    await client.query('BEGIN');
    try {
      const defaultTerms = 'Cannot be applied with any other offer\nNot redeemable for cash\nCan be used 1 time per week';
      const discountDescription = input.discountDescription?.trim() || (input.discountType === 'bogo' ? 'Buy one, get one offer' : `${label} member discount`);
      const discountTerms = input.discountTerms?.trim() || defaultTerms;
      const vendorRows = await client.query<{ id: string }>(
        `INSERT INTO vendors (name, owner_name, location, address, city, category, pos_type, pos_system, email, phone, password_hash, status, latitude, longitude, discount_terms)
         VALUES ($1, $2, $3, $4, NULL, $5, NULL, NULL, $6, $7, NULL, 'approved', $8, $9, $10) RETURNING id`,
        [input.name, input.ownerName ?? null, input.address ?? null, input.address ?? null, input.category, input.email ?? null, input.phone ?? null, input.latitude ?? null, input.longitude ?? null, discountTerms],
      );
      const vendorId = vendorRows.rows[0]!.id;

      let iconUrl: string | null = null;
      let logoUrl: string | null = null;
      try {
        if (input.iconDataUrl) iconUrl = await uploadImageDataUrl(`vendors/${vendorId}/icon.png`, input.iconDataUrl);
        if (input.logoDataUrl) logoUrl = await uploadImageDataUrl(`vendors/${vendorId}/logo.png`, input.logoDataUrl);
      } catch {
        iconUrl = null;
        logoUrl = null;
      }
      if (iconUrl || logoUrl) {
        await client.query('UPDATE vendors SET icon_url = COALESCE($2, icon_url), logo_url = COALESCE($3, logo_url) WHERE id = $1', [vendorId, iconUrl, logoUrl]);
      }

      const membership = await getMembershipCardId(client);
      const discountCode = generateDiscountCode({ merchantId: input.name || vendorId, type: input.discountType, value: input.discountValue });

      await client.query('INSERT INTO card_vendors (card_id, vendor_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [membership.id, vendorId]);
      const discountRows = await client.query<{ id: string }>(
        `INSERT INTO discounts (card_id, vendor_id, type, value, discount_code, description, active, starts_at, ends_at, boosted)
         VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9)
         ON CONFLICT (card_id, vendor_id) DO UPDATE SET type = EXCLUDED.type, value = EXCLUDED.value, discount_code = COALESCE(discounts.discount_code, EXCLUDED.discount_code), description = EXCLUDED.description, active = true, starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at, boosted = EXCLUDED.boosted, updated_at = now()
         RETURNING id`,
        [membership.id, vendorId, input.discountType, input.discountValue, discountCode, discountDescription, input.discountStartsAt ?? null, input.discountEndsAt ?? null, input.boosted ?? false],
      );
      const discountId = discountRows.rows[0]!.id;

      await client.query(
        `INSERT INTO transactions (actor_type, action, entity_type, entity_id, metadata)
         VALUES ('admin', 'admin.vendor.create', 'vendor', $1, $2::jsonb)`,
        [vendorId, { name: input.name, discountCode, membershipCardId: membership.id }],
      );

      await client.query('COMMIT');

      const result = {
        vendor: { id: vendorId, name: input.name, ownerName: input.ownerName ?? null, address: input.address ?? null, category: input.category, email: input.email ?? null, phone: input.phone ?? null },
        discountCode,
        discount: { id: discountId, type: input.discountType, value: input.discountValue, label },
        membershipCard: { id: membership.id, name: membership.name },
        posInstructions: posInstructions(discountCode, label),
      };

      if (input.email) {
        try {
          await sendVendorWelcomeEmail({
            to: input.email,
            vendorName: input.name,
            qrCodeUrl: qrCodeUrl(discountCode, 300),
            discountLabel: label,
            setupUrl: config.vendorPortalUrl,
          });
        } catch (err) {
          console.warn('[vendors] Failed to send welcome email:', err);
        }
      }

      void getPushTokensForNewVendor().then((tokens) =>
        sendPushNotifications(
          tokens,
          'New vendor joined',
          `${input.name} is now offering ${config.brandName} discounts.`,
          { type: 'new_vendor', vendorId: vendorId },
        ),
      );

      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

export interface VendorDirectoryItem {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  location: string | null;
  category: string | null;
  vendorType: string | null;
  cuisine: string | null;
  station: string | null;
  latitude: number | null;
  longitude: number | null;
  posSystem: string | null;
  iconUrl: string | null;
  logoUrl: string | null;
  discountTerms: string | null;
  discount: {
    type: 'fixed' | 'percent' | 'bogo';
    value: number;
    label: string;
    discountCode: string | null;
    description: string | null;
    startsAt: string | null;
    endsAt: string | null;
    boosted: boolean;
  };
  discountCode: string | null;
  discountDescription: string | null;
  boosted: boolean;
  startsAt: string | null;
  endsAt: string | null;
  cardId: string;
  walletUrl: null;
}

export async function getVendorDirectory(vendorId?: string): Promise<VendorDirectoryItem[]> {
  const rows = await dbQuery<{
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    location: string | null;
    category: string | null;
    vendor_type: string | null;
    cuisine: string | null;
    station: string | null;
    latitude: number | null;
    longitude: number | null;
    pos_system: string | null;
    icon_url: string | null;
    logo_url: string | null;
    discount_terms: string | null;
    discount_type: string | null;
    discount_value: number | null;
    discount_code: string | null;
    discount_description: string | null;
    starts_at: string | null;
    ends_at: string | null;
    boosted: boolean;
    card_icon: string | null;
    card_logo: string | null;
  }>(
    `SELECT v.id, v.name, v.address, v.city, v.location, v.category, v.vendor_type, v.cuisine, v.station, v.latitude, v.longitude, v.pos_system, v.icon_url, v.logo_url, v.discount_terms,
            d.type AS discount_type, d.value AS discount_value, d.discount_code, d.description AS discount_description,
            d.starts_at, d.ends_at, d.boosted, c.id AS card_id, c.icon_url AS card_icon, c.logo_url AS card_logo
     FROM vendors v
     JOIN cards c ON c.is_membership = true AND c.status = 'active'
     JOIN discounts d ON d.vendor_id = v.id AND d.card_id = c.id AND d.active = true
     WHERE v.status = 'approved'
       AND ($1::uuid IS NULL OR v.id = $1::uuid)
       AND (d.starts_at IS NULL OR d.starts_at <= now())
       AND (d.ends_at IS NULL OR d.ends_at >= now())
     ORDER BY CASE WHEN d.boosted THEN 0 ELSE 1 END, v.station NULLS LAST, v.name`,
    [vendorId ?? null],
  );

  return rows.map((row) => {
    const type = (row.discount_type ?? 'fixed') as 'fixed' | 'percent' | 'bogo';
    const value = Number(row.discount_value ?? 0);
    const label = humanDiscountLabel(type, value);
    return {
      id: row.id,
      name: row.name,
      address: row.address ?? row.location,
      city: row.city,
      location: row.location,
      category: row.category,
      vendorType: row.vendor_type,
      cuisine: row.cuisine,
      station: row.station,
      latitude: row.latitude,
      longitude: row.longitude,
      posSystem: row.pos_system,
      iconUrl: row.icon_url ?? row.card_icon,
      logoUrl: row.logo_url ?? row.card_logo,
      discountTerms: row.discount_terms ?? 'Cannot be applied with any other offer\nNot redeemable for cash\nCan be used 1 time per week',
      discount: {
        type,
        value,
        label,
        discountCode: row.discount_code,
        description: row.discount_description,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        boosted: row.boosted,
      },
      discountCode: row.discount_code,
      discountDescription: row.discount_description,
      boosted: row.boosted,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      cardId: row.card_id ?? '',
      walletUrl: null,
    };
  });
}

export async function getAdminVendorById(id: string): Promise<Record<string, unknown> | null> {
  const rows = await dbQuery<Record<string, unknown>>(
    `SELECT v.*, d.type AS discount_type, d.value AS discount_value, d.discount_code, d.description AS discount_description,
            d.starts_at AS discount_starts_at, d.ends_at AS discount_ends_at, d.boosted AS discount_boosted
     FROM vendors v
     LEFT JOIN LATERAL (
       SELECT d.type, d.value, d.discount_code, d.description, d.starts_at, d.ends_at, d.boosted
       FROM discounts d
       JOIN cards c ON c.id = d.card_id AND c.is_membership = true
       WHERE d.vendor_id = v.id
       ORDER BY d.created_at DESC
       LIMIT 1
     ) d ON true
     WHERE v.id = $1
     LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
}
