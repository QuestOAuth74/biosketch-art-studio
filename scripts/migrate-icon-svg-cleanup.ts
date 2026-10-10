/**
 * Migration Script: Remove XML Declarations from Existing Icons
 *
 * This script applies the minifySVG() function to ALL icons in the database,
 * removing XML declarations and other metadata that can cause rendering issues.
 *
 * This retroactively applies the same cleanup that new uploads now receive automatically.
 *
 * Features:
 * - Removes XML declarations (<?xml version="1.0"?>)
 * - Removes metadata, comments, and editor-specific tags
 * - Optimizes number precision and whitespace
 * - Only updates icons that actually need cleaning (not already clean)
 * - Validates SVG structure before and after cleaning
 *
 * Usage: npx tsx scripts/migrate-icon-svg-cleanup.ts [--target=prod|dev] [--batch-size=50] [--dry-run] [--category=NAME]
 *
 * Options:
 *   --target=ENV     Target database: "prod" or "dev" (default: dev)
 *   --batch-size=N   Process N icons at a time (default: 50)
 *   --dry-run        Show what would be done without making changes
 *   --category=NAME  Only process icons in specified category
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { minifySVG } from '../src/lib/svgProcessor.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env and .env.local
const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');
const envLocalPath = path.join(rootDir, '.env.local');

// Parse command line args
const args = process.argv.slice(2);
const targetArg = args.find(arg => arg.startsWith('--target='));
const target = targetArg ? targetArg.split('=')[1] : 'dev';
const batchSize = parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '50');
const dryRun = args.includes('--dry-run');
const categoryFilter = args.find(arg => arg.startsWith('--category='))?.split('=')[1];

if (!['prod', 'dev'].includes(target)) {
  console.error('❌ Error: --target must be "prod" or "dev"');
  process.exit(1);
}

console.log('🔄 Icon SVG Cleanup Migration');
console.log('========================================');
console.log(`🎯 Target: ${target.toUpperCase()}`);
console.log();

// Load .env first (production URL)
if (fs.existsSync(envPath)) {
  console.log('📄 Loading .env file...');
  dotenv.config({ path: envPath });
}

// Store production URL before loading .env.local
const prodUrl = process.env.VITE_SUPABASE_URL;

// Load .env.local second (has both dev credentials and prod service key)
if (fs.existsSync(envLocalPath)) {
  console.log('📄 Loading .env.local file...');
  dotenv.config({ path: envLocalPath, override: true });
}

// Get credentials based on target
let supabaseUrl: string | undefined;
let supabaseKey: string | undefined;

if (target === 'prod') {
  supabaseUrl = prodUrl; // from .env (stored before override)
  supabaseKey = process.env.PROD_SUPABASE_SERVICE_ROLE_KEY; // from .env.local
} else {
  // For dev, both are in .env.local (after override)
  supabaseUrl = process.env.VITE_SUPABASE_URL;
  supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
}

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Missing database credentials');
  console.error(`   VITE_SUPABASE_URL: ${supabaseUrl ? '✓' : '✗'}`);
  console.error(`   Service role key: ${supabaseKey ? '✓' : '✗'}`);
  process.exit(1);
}

console.log('🔑 Using service role key for migration (bypasses RLS)');
console.log(`🔗 Connecting to: ${supabaseUrl.substring(0, 30)}...`);
console.log();

const supabase = createClient(supabaseUrl, supabaseKey);

interface Icon {
  id: string;
  name: string;
  category: string;
  svg_content: string;
}

interface MigrationStats {
  total: number;
  processed: number;
  needsCleaning: number;
  succeeded: number;
  failed: number;
  skipped: number;
  totalBytesSaved: number;
}

console.log(`Batch size: ${batchSize}`);
console.log(`Dry run: ${dryRun ? 'YES' : 'NO'}`);
if (categoryFilter) console.log(`Category filter: ${categoryFilter}`);
console.log();

/**
 * Check if SVG content needs cleaning
 */
function needsCleaning(svgContent: string): boolean {
  return (
    svgContent.includes('<?xml') ||
    svgContent.includes('<!DOCTYPE') ||
    svgContent.includes('<metadata') ||
    svgContent.includes('xmlns:sodipodi=') ||
    svgContent.includes('xmlns:inkscape=') ||
    svgContent.includes('xmlns:i=') ||
    svgContent.includes('<!--') ||
    /\s{2,}/.test(svgContent) // Multiple consecutive spaces
  );
}

/**
 * Validate SVG has essential structure
 */
function validateSVG(svgContent: string): boolean {
  return (
    svgContent.includes('<svg') &&
    svgContent.includes('</svg>') &&
    svgContent.length > 50 // Reasonable minimum size
  );
}

async function migrateIconSvgContent() {
  const stats: MigrationStats = {
    total: 0,
    processed: 0,
    needsCleaning: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    totalBytesSaved: 0
  };

  try {
    // Get total count
    let countQuery = supabase
      .from('icons')
      .select('id', { count: 'exact', head: true });

    if (categoryFilter) {
      countQuery = countQuery.eq('category', categoryFilter);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('❌ Error counting icons:', countError);
      return;
    }

    stats.total = count || 0;
    console.log(`📊 Total icons to process: ${stats.total}`);
    console.log();

    // Process in batches using cursor-based pagination
    let lastId: string | null = null;
    let batchNumber = 0;

    while (stats.processed < stats.total) {
      batchNumber++;
      console.log(`\n📦 Processing batch ${batchNumber} (icons ${stats.processed + 1}-${Math.min(stats.processed + batchSize, stats.total)})...`);

      // Fetch batch
      let query = supabase
        .from('icons')
        .select('id, name, category, svg_content')
        .order('id', { ascending: true })
        .limit(batchSize);

      if (categoryFilter) {
        query = query.eq('category', categoryFilter);
      }

      if (lastId) {
        query = query.gt('id', lastId);
      }

      const { data: icons, error: fetchError } = await query;

      if (fetchError) {
        console.error('❌ Error fetching batch:', fetchError);
        break;
      }

      if (!icons || icons.length === 0) {
        break;
      }

      // Process each icon in batch
      for (const icon of icons) {
        stats.processed++;
        lastId = icon.id;
        const iconLabel = `[${stats.processed}/${stats.total}] ${icon.name}`;

        try {
          // Skip if no svg_content
          if (!icon.svg_content) {
            console.log(`⚠️  ${iconLabel} - No svg_content, skipping`);
            stats.skipped++;
            continue;
          }

          // Validate original SVG
          if (!validateSVG(icon.svg_content)) {
            console.log(`⚠️  ${iconLabel} - Invalid SVG structure, skipping`);
            stats.skipped++;
            continue;
          }

          // Check if cleaning is needed
          if (!needsCleaning(icon.svg_content)) {
            console.log(`✓  ${iconLabel} - Already clean, skipping`);
            stats.skipped++;
            continue;
          }

          stats.needsCleaning++;
          const originalSize = icon.svg_content.length;

          // Apply minifySVG function (same as upload process)
          const cleanedSvg = minifySVG(icon.svg_content);
          const newSize = cleanedSvg.length;
          const bytesSaved = originalSize - newSize;

          // Validate cleaned SVG
          if (!validateSVG(cleanedSvg)) {
            console.error(`❌ ${iconLabel} - Cleaning produced invalid SVG, skipping`);
            stats.failed++;
            continue;
          }

          stats.totalBytesSaved += bytesSaved;

          if (dryRun) {
            console.log(`🔍 ${iconLabel} - Would clean: ${originalSize} → ${newSize} bytes (saved ${bytesSaved} bytes)`);

            // Show what would be removed
            const hasXml = icon.svg_content.includes('<?xml');
            const hasMetadata = icon.svg_content.includes('<metadata');
            const hasInkscape = icon.svg_content.includes('inkscape:');
            const hasAdobe = icon.svg_content.includes('xmlns:i=');
            const removed = [];
            if (hasXml) removed.push('XML declaration');
            if (hasMetadata) removed.push('metadata');
            if (hasInkscape) removed.push('Inkscape attrs');
            if (hasAdobe) removed.push('Adobe attrs');
            if (removed.length > 0) {
              console.log(`     Removes: ${removed.join(', ')}`);
            }

            stats.succeeded++;
          } else {
            // Update database
            const { error: updateError } = await supabase
              .from('icons')
              .update({ svg_content: cleanedSvg })
              .eq('id', icon.id);

            if (updateError) {
              console.error(`❌ ${iconLabel} - Update failed:`, updateError.message);
              stats.failed++;
            } else {
              console.log(`✅ ${iconLabel} - Cleaned: ${originalSize} → ${newSize} bytes (saved ${bytesSaved} bytes, ${((bytesSaved / originalSize) * 100).toFixed(1)}%)`);
              stats.succeeded++;
            }
          }
        } catch (error) {
          console.error(`❌ ${iconLabel} - Error:`, error instanceof Error ? error.message : error);
          stats.failed++;
        }
      }

      // Small delay between batches
      if (stats.processed < stats.total) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    // Print summary
    console.log('\n========================================');
    console.log('📊 Migration Summary');
    console.log('========================================');
    console.log(`Total icons: ${stats.total}`);
    console.log(`Processed: ${stats.processed}`);
    console.log(`Already clean (skipped): ${stats.skipped - (stats.processed - stats.needsCleaning - stats.skipped)}`);
    console.log(`Needed cleaning: ${stats.needsCleaning}`);
    console.log(`Successfully cleaned: ${stats.succeeded}`);
    console.log(`Failed: ${stats.failed}`);
    console.log(`Total bytes saved: ${stats.totalBytesSaved.toLocaleString()} bytes (${(stats.totalBytesSaved / 1024).toFixed(2)} KB)`);
    console.log();

    if (stats.succeeded > 0) {
      const avgSavings = stats.totalBytesSaved / stats.succeeded;
      console.log(`Average savings per cleaned icon: ${avgSavings.toFixed(0)} bytes (${(avgSavings / 1024).toFixed(2)} KB)`);
      console.log();
    }

    if (dryRun) {
      console.log('🔍 DRY RUN - No changes were made to the database');
      console.log('   Remove --dry-run flag to perform actual migration');
      console.log();
      console.log('📋 To run the migration:');
      console.log('   npx tsx scripts/migrate-icon-svg-cleanup.ts');
    } else if (stats.succeeded > 0) {
      console.log('✅ Migration completed successfully!');
    }

    if (stats.failed > 0) {
      console.log(`\n⚠️  ${stats.failed} icons failed to migrate`);
      process.exit(1);
    }
  }
}

// Run migration
migrateIconSvgContent();
