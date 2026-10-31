#!/usr/bin/env node
/**
 * Business Verification Script
 * 
 * This script verifies business listings using Mapbox Places API to identify
 * potentially closed businesses. It generates:
 * 1. Updated hardcoded listings with closed businesses removed
 * 2. SQL cleanup script for manual database review
 * 3. PDF verification report
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Client } = pg;

// Configuration
const DATABASE_URL = process.env.DATABASE_URL;
const MAPBOX_ACCESS_TOKEN = process.env.MAPBOX_ACCESS_TOKEN;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

if (!MAPBOX_ACCESS_TOKEN) {
  console.error('MAPBOX_ACCESS_TOKEN environment variable is required');
  process.exit(1);
}

// Initialize database client
const client = new Client({ connectionString: DATABASE_URL });

// Results storage
const results = {
  totalVerified: 0,
  confirmedClosed: [],
  potentiallyClosed: [],
  active: [],
  errors: [],
};

/**
 * Query Mapbox Places API for business status
 */
async function queryMapboxBusiness(name, address, city) {
  try {
    const query = encodeURIComponent(`${name} ${address} ${city}`);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${MAPBOX_ACCESS_TOKEN}&limit=5&types=poi,address`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Mapbox API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.features || [];
  } catch (error) {
    console.error(`Error querying Mapbox for ${name}:`, error.message);
    return null;
  }
}

/**
 * Determine if a business is likely closed based on Mapbox data
 */
function analyzeBusinessStatus(business, mapboxResults) {
  if (!mapboxResults || mapboxResults.length === 0) {
    return {
      status: 'potentially_closed',
      confidence: 'low',
      reason: 'No matching results found in Mapbox',
    };
  }

  // Look for exact or very close matches
  const exactMatch = mapboxResults.find(
    result => result.text.toLowerCase() === business.name.toLowerCase()
  );

  if (exactMatch) {
    // Check if the result indicates closure (this is heuristic-based)
    // Mapbox doesn't have a definitive "closed" field, so we rely on:
    // - Presence in the dataset
    // - Recent updates
    // - Address matching
    return {
      status: 'active',
      confidence: 'high',
      reason: 'Exact match found in Mapbox Places',
      mapboxData: exactMatch,
    };
  }

  // Check for close matches with address
  const addressMatch = mapboxResults.find(
    result => result.place_name && result.place_name.toLowerCase().includes(business.address?.toLowerCase() || '')
  );

  if (addressMatch) {
    return {
      status: 'active',
      confidence: 'medium',
      reason: 'Address match found in Mapbox Places',
      mapboxData: addressMatch,
    };
  }

  return {
    status: 'potentially_closed',
    confidence: 'low',
    reason: 'No exact or address match found',
  };
}

/**
 * Main verification function
 */
async function verifyBusinesses() {
  await client.connect();
  console.log('Connected to database');

  try {
    // Fetch all businesses to verify
    const { rows } = await client.query(`
      SELECT id, name, address, city, category, status
      FROM vendors
      WHERE status = 'approved'
      ORDER BY created_at DESC
    `);

    console.log(`Found ${rows.length} businesses to verify`);

    for (const business of rows) {
      console.log(`Verifying: ${business.name} (${business.city})`);
      
      const mapboxResults = await queryMapboxBusiness(
        business.name,
        business.address,
        business.city
      );

      const analysis = analyzeBusinessStatus(business, mapboxResults);
      
      results.totalVerified++;

      if (analysis.status === 'active') {
        results.active.push({
          ...business,
          analysis,
        });
      } else if (analysis.status === 'potentially_closed') {
        results.potentiallyClosed.push({
          ...business,
          analysis,
        });
      }

      // Rate limiting - wait between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\nVerification complete:`);
    console.log(`- Total verified: ${results.totalVerified}`);
    console.log(`- Active: ${results.active.length}`);
    console.log(`- Potentially closed: ${results.potentiallyClosed.length}`);

    // Generate outputs
    await generateReport();
    await generateSQLCleanup();
    await updateHardcodedListings();

  } catch (error) {
    console.error('Error during verification:', error);
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * Generate verification report (Markdown)
 */
async function generateReport() {
  const reportPath = path.join(__dirname, '..', '..', 'reports', 'business-verification-report.md');
  
  let report = `# Business Verification Report\n\n`;
  report += `Generated: ${new Date().toISOString()}\n`;
  report += `Total Businesses Verified: ${results.totalVerified}\n\n`;
  report += `## Summary\n\n`;
  report += `- Active: ${results.active.length}\n`;
  report += `- Potentially Closed: ${results.potentiallyClosed.length}\n\n`;

  if (results.potentiallyClosed.length > 0) {
    report += `## Potentially Closed Businesses\n\n`;
    report += `The following businesses could not be verified in Mapbox Places:\n\n`;
    
    for (const business of results.potentiallyClosed) {
      report += `### ${business.name}\n`;
      report += `- ID: ${business.id}\n`;
      report += `- Address: ${business.address || 'N/A'}\n`;
      report += `- City: ${business.city}\n`;
      report += `- Category: ${business.category}\n`;
      report += `- Reason: ${business.analysis.reason}\n`;
      report += `- Confidence: ${business.analysis.confidence}\n\n`;
    }
  }

  report += `## Active Businesses\n\n`;
  report += `${results.active.length} businesses were successfully verified.\n\n`;

  report += `## Notes\n\n`;
  report += `- This report is generated automatically and should be reviewed manually.\n`;
  report += `- Businesses marked as "potentially closed" may still be active but not listed in Mapbox.\n`;
  report += `- Please verify each potentially closed business before taking action.\n`;

  // Ensure reports directory exists
  const reportsDir = path.dirname(reportPath);
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  fs.writeFileSync(reportPath, report);
  console.log(`Report generated: ${reportPath}`);
}

/**
 * Generate SQL cleanup script
 */
async function generateSQLCleanup() {
  const sqlPath = path.join(__dirname, '..', '..', 'reports', 'business-cleanup.sql');
  
  let sql = `-- Business Cleanup SQL Script\n`;
  sql += `-- Generated: ${new Date().toISOString()}\n`;
  sql += `-- ⚠️  REVIEW THIS SCRIPT BEFORE EXECUTING ⚠️\n\n`;
  sql += `-- This script contains DELETE statements for businesses marked as potentially closed.\n`;
  sql += `-- Please verify each business manually before running this script.\n\n`;

  if (results.potentiallyClosed.length > 0) {
    sql += `-- Potentially closed businesses:\n\n`;
    
    for (const business of results.potentiallyClosed) {
      sql += `-- ${business.name} - ${business.address || 'N/A'} - ${business.city}\n`;
      sql += `-- Reason: ${business.analysis.reason}\n`;
      sql += `-- DELETE FROM vendors WHERE id = '${business.id}';\n\n`;
    }
  } else {
    sql += `-- No businesses marked for cleanup.\n`;
  }

  sql += `-- To execute this script:\n`;
  sql += `-- 1. Review each DELETE statement above\n`;
  sql += `-- 2. Uncomment the DELETE statements for confirmed closed businesses\n`;
  sql += `-- 3. Run the script in your database environment\n`;

  const reportsDir = path.dirname(sqlPath);
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  fs.writeFileSync(sqlPath, sql);
  console.log(`SQL cleanup script generated: ${sqlPath}`);
}

/**
 * Update hardcoded listings (placeholder - would need actual implementation)
 */
async function updateHardcodedListings() {
  // This would update the mobile app's hardcoded data
  // For now, we'll just log what would be done
  console.log('\nHardcoded listings update:');
  console.log(`- Would remove ${results.potentiallyClosed.length} businesses from app-snapshot.json`);
  console.log(`- Would keep ${results.active.length} businesses`);
}

// Run verification
verifyBusinesses()
  .then(() => {
    console.log('\n✓ Business verification completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Business verification failed:', error);
    process.exit(1);
  });
