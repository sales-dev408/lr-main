import { config } from '../config.js';
import { withDbClient, closePool } from './pool.js';

async function main(): Promise<void> {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required to update vendor discounts');
  }

  await withDbClient(async (client) => {
    await client.query('BEGIN');
    try {
      // First, check if there's a default 0% discount card, or create one
      let zeroDiscountCardId: string | null = null;

      const existingCard = await client.query<{ id: string }>(
        'SELECT id FROM cards WHERE discount_type = $1 AND discount_value = $2 LIMIT 1',
        ['percent', 0]
      );

      if (existingCard.rows[0]) {
        zeroDiscountCardId = existingCard.rows[0].id;
        console.log('Found existing 0% discount card');
      } else {
        // Check if there's an existing membership card to use instead
        const existingMembershipCard = await client.query<{ id: string }>(
          'SELECT id FROM cards WHERE is_membership = true LIMIT 1'
        );

        if (existingMembershipCard.rows[0]) {
          zeroDiscountCardId = existingMembershipCard.rows[0].id;
          // Update it to 0% discount
          await client.query(
            'UPDATE cards SET discount_type = $1, discount_value = $2 WHERE id = $3',
            ['percent', 0, zeroDiscountCardId]
          );
          console.log('Updated existing membership card to 0% discount');
        } else {
          // Create a new 0% discount card
          const insertedCard = await client.query<{ id: string }>(
            `INSERT INTO cards (name, theme, description, discount_type, discount_value, status, is_membership)
             VALUES ('0% Discount', 'shops_restaurants', 'No discount - listing only', 'percent', 0, 'active', true)
             RETURNING id`
          );
          zeroDiscountCardId = insertedCard.rows[0]!.id;
          console.log('Created new 0% discount card');
        }
      }

      if (!zeroDiscountCardId) {
        throw new Error('Failed to get or create 0% discount card');
      }

      // Get all vendors that were recently imported (with station set)
      const vendors = await client.query<{ id: string; name: string; station: string | null }>(
        `SELECT id, name, station FROM vendors WHERE station IS NOT NULL AND status = 'approved'`
      );

      console.log(`Found ${vendors.rows.length} vendors to update`);

      let updatedCount = 0;

      for (const vendor of vendors.rows) {
        // Check if vendor already has a discount with the 0% card
        const existingDiscount = await client.query<{ id: string }>(
          `SELECT id FROM discounts WHERE card_id = $1 AND vendor_id = $2 LIMIT 1`,
          [zeroDiscountCardId, vendor.id]
        );

        if (existingDiscount.rows[0]) {
          // Update existing discount to 0%
          await client.query(
            `UPDATE discounts SET type = 'percent', value = 0, active = true, updated_at = now()
             WHERE id = $1`,
            [existingDiscount.rows[0].id]
          );
          console.log(`Updated discount for: ${vendor.name} (Station: ${vendor.station})`);
          updatedCount++;
        } else {
          // Create new discount
          await client.query(
            `INSERT INTO discounts (card_id, vendor_id, type, value, min_purchase, active, city_overrides)
             VALUES ($1, $2, 'percent', 0, 0, true, '{}'::jsonb)`,
            [zeroDiscountCardId, vendor.id]
          );
          console.log(`Created discount for: ${vendor.name} (Station: ${vendor.station})`);
          updatedCount++;
        }

        // Link vendor to the card if not already linked
        await client.query(
          `INSERT INTO card_vendors (card_id, vendor_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [zeroDiscountCardId, vendor.id]
        );
      }

      await client.query('COMMIT');
      console.log(`\nCompleted: ${updatedCount} vendors updated with 0% discount`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });

  await closePool();
}

void main().catch(async (error) => {
  console.error(error);
  await closePool();
  process.exitCode = 1;
});
