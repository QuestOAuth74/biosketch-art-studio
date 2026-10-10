/**
 * Migration Script: Convert Icon Thumbnails to PNG
 *
 * This script regenerates thumbnails for ALL icons in the database,
 * converting SVG thumbnails to optimized PNG format (5-20 KB each).
 *
 * FIXED: Now uses the same generateCompressedThumbnail method as the app
 *        (Image element from Blob URL) to prevent clipping and ensure
 *        consistent results with the regenerate button in IconManager.
 *
 * Features:
 * - Transparent background (no white fill)
 * - Regenerates ALL icons (not just missing/broken thumbnails)
 * - Only skips icons with no svg_content (can't generate without source)
 *
 * Usage: npx tsx scripts/migrate-icon-thumbnails-png.ts [--batch-size=20] [--dry-run]
 *
 * Options:
 *   --batch-size=N   Process N icons at a time (default: 20)
 *   --dry-run        Show what would be done without making changes
 *   --category=NAME  Only process icons in specified category
 */

import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env and .env.local
// .env.local takes precedence over .env
const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');
const envLocalPath = path.join(rootDir, '.env.local');

// Load .env first
if (fs.existsSync(envPath)) {
  console.log('📄 Loading .env file...');
  dotenv.config({ path: envPath });
}

// Load .env.local second (overrides .env)
if (fs.existsSync(envLocalPath)) {
  console.log('📄 Loading .env.local file (overrides .env)...');
  dotenv.config({ path: envLocalPath, override: true });
}

// Get environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
// Use service role key for migration (bypasses RLS), fall back to anon key if not available
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  console.error('   Make sure you have a .env.local file with these variables');
  process.exit(1);
}

if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('🔑 Using service role key for migration (bypasses RLS)');
} else {
  console.log('⚠️  Using anon key - make sure icons table has appropriate permissions');
}

console.log(`🔗 Connecting to: ${supabaseUrl.substring(0, 30)}...`);

const supabase = createClient(supabaseUrl, supabaseKey);

interface Icon {
  id: string;
  name: string;
  category: string;
  svg_content: string;
  thumbnail: string | null;
}

interface MigrationStats {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  totalSavings: number; // KB saved
}

// Parse command line args
const args = process.argv.slice(2);
const batchSize = parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '20');
const dryRun = args.includes('--dry-run');
const categoryFilter = args.find(arg => arg.startsWith('--category='))?.split('=')[1];

console.log('🔄 Icon Thumbnail PNG Migration (FIXED VERSION)');
console.log('========================================');
console.log(`Batch size: ${batchSize}`);
console.log(`Dry run: ${dryRun ? 'YES' : 'NO'}`);
if (categoryFilter) console.log(`Category filter: ${categoryFilter}`);
console.log();

/**
 * Generate PNG thumbnail from SVG content or external image reference
 * This matches src/utils/thumbnailGenerator.ts exactly
 *
 * Handles two cases:
 * 1. SVG with external <image> tag: Extracts and loads the image URL directly
 * 2. Regular SVG: Renders SVG to canvas
 */
async function svgToPng(page: any, svgContent: string, maxSize: number = 128): Promise<string> {
  return page.evaluate(async (args: { svgContent: string; maxSize: number }) => {
    return new Promise<string>((resolve, reject) => {
      try {
        // Check if SVG contains external <image> tag
        const hasExternalImage = args.svgContent.includes('<image') && args.svgContent.includes('href=');

        if (hasExternalImage) {
          // Extract image URL from SVG
          const hrefMatch = args.svgContent.match(/href\s*=\s*["']([^"']+)["']/);
          if (hrefMatch) {
            const imageUrl = hrefMatch[1];

            // Load the external image directly
            const img = new Image();
            img.crossOrigin = 'anonymous'; // Handle CORS

            img.onload = () => {
              try {
                const canvas = document.createElement('canvas');
                canvas.width = args.maxSize;
                canvas.height = args.maxSize;
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                  reject(new Error('Failed to get canvas context'));
                  return;
                }

                // Calculate scaled dimensions
                const scale = Math.min(args.maxSize / img.width, args.maxSize / img.height);
                const scaledWidth = img.width * scale;
                const scaledHeight = img.height * scale;
                const x = (args.maxSize - scaledWidth) / 2;
                const y = (args.maxSize - scaledHeight) / 2;

                ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
                const pngDataUrl = canvas.toDataURL('image/png', 0.8);
                resolve(pngDataUrl);
              } catch (error: any) {
                reject(error);
              }
            };

            img.onerror = () => {
              reject(new Error('Failed to load external image from SVG'));
            };

            img.src = imageUrl;
            return;
          }
        }

        // Regular SVG rendering (original code)
        // Clean SVG content
        let cleanedSvg = args.svgContent
          .replace(/<\?xml[^>]*\?>/g, '')
          .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
          .trim();

        // Create a Blob from SVG
        const svgBlob = new Blob([cleanedSvg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        // Create image element
        const img = new Image();
        img.onload = () => {
          try {
            // Create canvas
            const canvas = document.createElement('canvas');
            canvas.width = args.maxSize;
            canvas.height = args.maxSize;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
              URL.revokeObjectURL(url);
              reject(new Error('Failed to get canvas context'));
              return;
            }

            // Canvas has transparent background by default - no fill needed

            // Calculate aspect ratio to fit SVG within canvas
            const scale = Math.min(args.maxSize / img.width, args.maxSize / img.height);
            const scaledWidth = img.width * scale;
            const scaledHeight = img.height * scale;
            const x = (args.maxSize - scaledWidth) / 2;
            const y = (args.maxSize - scaledHeight) / 2;

            // Draw SVG onto canvas
            ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

            // Convert canvas to PNG data URL
            const pngDataUrl = canvas.toDataURL('image/png', 0.8); // 0.8 quality for smaller size

            URL.revokeObjectURL(url);
            resolve(pngDataUrl);
          } catch (error: any) {
            URL.revokeObjectURL(url);
            reject(error);
          }
        };

        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Failed to load SVG image'));
        };

        img.src = url;
      } catch (error) {
        reject(error);
      }
    });
  }, { svgContent, maxSize });
}

function calculateSize(content: string): number {
  if (content.startsWith('data:')) {
    const base64Data = content.split(',')[1] || content;
    const actualSize = (base64Data.length * 3) / 4;
    return actualSize / 1024;
  }
  return new Blob([content]).size / 1024;
}

async function migrateIconThumbnails() {
  const stats: MigrationStats = {
    total: 0,
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    totalSavings: 0
  };

  // Create ONE browser instance for the entire migration
  console.log('🌐 Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  console.log('✅ Browser ready\n');

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

    // Process in batches
    let offset = 0;
    while (offset < stats.total) {
      console.log(`\n📦 Processing batch ${Math.floor(offset / batchSize) + 1} (icons ${offset + 1}-${Math.min(offset + batchSize, stats.total)})...`);

      // Fetch batch
      let query = supabase
        .from('icons')
        .select('id, name, category, svg_content, thumbnail')
        .range(offset, offset + batchSize - 1);

      if (categoryFilter) {
        query = query.eq('category', categoryFilter);
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
      // NOTE: ALL icons are processed - thumbnails are regenerated even if they already exist
      for (const icon of icons) {
        stats.processed++;
        const iconLabel = `[${stats.processed}/${stats.total}] ${icon.name}`;

        try {
          // Skip only if no svg_content (can't generate thumbnail without source)
          if (!icon.svg_content) {
            console.log(`⚠️  ${iconLabel} - No svg_content, skipping`);
            stats.skipped++;
            continue;
          }

          const oldSize = icon.thumbnail ? calculateSize(icon.thumbnail) : calculateSize(icon.svg_content);

          if (dryRun) {
            console.log(`🔍 ${iconLabel} - Would convert to PNG: ${oldSize.toFixed(2)} KB → ~15 KB (estimated)`);
            stats.succeeded++;
            stats.totalSavings += (oldSize - 15); // Estimate 15 KB for PNG
          } else {
            // Generate PNG thumbnail from svg_content - always regenerate for all icons
            const pngThumbnail = await svgToPng(page, icon.svg_content, 128);
            const newSize = calculateSize(pngThumbnail);
            const savings = oldSize - newSize;

            stats.totalSavings += savings;

            // Update database
            const { error: updateError } = await supabase
              .from('icons')
              .update({ thumbnail: pngThumbnail })
              .eq('id', icon.id);

            if (updateError) {
              console.error(`❌ ${iconLabel} - Update failed:`, updateError.message);
              stats.failed++;
            } else {
              console.log(`✅ ${iconLabel} - Converted to PNG: ${oldSize.toFixed(2)} KB → ${newSize.toFixed(2)} KB (saved ${savings.toFixed(2)} KB)`);
              stats.succeeded++;
            }
          }
        } catch (error) {
          console.error(`❌ ${iconLabel} - Error:`, error instanceof Error ? error.message : error);
          stats.failed++;
        }
      }

      offset += batchSize;

      // Small delay between batches
      if (offset < stats.total) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    // Close the browser
    console.log('\n🔒 Closing browser...');
    await browser.close();

    // Print summary
    console.log('\n========================================');
    console.log('📊 Migration Summary');
    console.log('========================================');
    console.log(`Total icons: ${stats.total}`);
    console.log(`Processed: ${stats.processed}`);
    console.log(`Succeeded: ${stats.succeeded}`);
    console.log(`Failed: ${stats.failed}`);
    console.log(`Skipped: ${stats.skipped}`);
    console.log(`Total data saved: ${stats.totalSavings.toFixed(2)} KB (${(stats.totalSavings / 1024).toFixed(2)} MB)`);
    console.log();

    if (stats.succeeded > 0) {
      const avgSavings = stats.totalSavings / stats.succeeded;
      console.log(`Average savings per icon: ${avgSavings.toFixed(2)} KB`);
      console.log();
    }

    if (dryRun) {
      console.log('🔍 DRY RUN - No changes were made to the database');
      console.log('   Remove --dry-run flag to perform actual migration');
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
migrateIconThumbnails();
