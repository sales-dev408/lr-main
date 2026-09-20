import { config } from '../config.js';
import { withDbClient, closePool } from './pool.js';

// Geocoding function using Mapbox Geocoding API
async function geocodeAddress(address: string): Promise<{ latitude: number; longitude: number } | null> {
  if (!config.mapboxAccessToken) {
    console.warn('Mapbox access token not configured, skipping geocoding');
    return null;
  }

  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${config.mapboxAccessToken}&limit=1`;

    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Geocoding failed for ${address}: ${response.statusText}`);
      return null;
    }

    const data = await response.json() as { features?: Array<{ center: [number, number] }> };
    if (data.features && data.features.length > 0 && data.features[0]) {
      const [longitude, latitude] = data.features[0].center;
      return { latitude, longitude };
    }

    return null;
  } catch (error) {
    console.warn(`Geocoding error for ${address}:`, error);
    return null;
  }
}

async function main(): Promise<void> {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required to add coordinates');
  }

  await withDbClient(async (client) => {
    await client.query('BEGIN');
    try {
      // Get all vendors that don't have coordinates but have addresses
      const vendors = await client.query<{
        id: string;
        name: string;
        address: string;
        station: string | null;
      }>(
        `SELECT id, name, address, station FROM vendors 
         WHERE address IS NOT NULL 
         AND (latitude IS NULL OR longitude IS NULL)
         ORDER BY station, name`
      );

      console.log(`Found ${vendors.rows.length} vendors without coordinates`);

      if (vendors.rows.length === 0) {
        console.log('All vendors already have coordinates!');
        await client.query('ROLLBACK');
        return;
      }

      let updatedCount = 0;
      let failedCount = 0;

      for (const vendor of vendors.rows) {
        console.log(`Geocoding: ${vendor.name} at ${vendor.address}`);

        const coordinates = await geocodeAddress(vendor.address);

        if (coordinates) {
          await client.query(
            `UPDATE vendors SET latitude = $1, longitude = $2, updated_at = now()
             WHERE id = $3`,
            [coordinates.latitude, coordinates.longitude, vendor.id]
          );
          console.log(`  ✓ Coordinates: ${coordinates.latitude}, ${coordinates.longitude}`);
          updatedCount++;
        } else {
          console.log(`  ✗ Failed to geocode`);
          failedCount++;
        }

        // Add a small delay to avoid hitting Mapbox rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      await client.query('COMMIT');
      console.log(`\nCompleted: ${updatedCount} vendors updated with coordinates, ${failedCount} failed`);
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
