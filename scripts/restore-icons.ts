/**
 * Restore Script: Import Icons from Backup
 *
 * Restores icons from a backup file created by backup-icons.ts
 * Can restore to production or development database
 *
 * Usage: npx tsx scripts/restore-icons.ts --input=backups/icons-backup-2026-02-09.json [--target=prod|dev] [--dry-run]
 *
 * Options:
 *   --input=PATH   Path to backup file (required)
 *   --target=ENV   Target database: "prod" or "dev" (default: dev)
 *   --dry-run      Show what would be restored without making changes
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');
const envLocalPath = path.join(rootDir, '.env.local');

console.log('🔄 Icon Restore Script');
console.log('========================================');
console.log();

// Parse command line args
const args = process.argv.slice(2);
const inputArg = args.find(arg => arg.startsWith('--input='));
const targetArg = args.find(arg => arg.startsWith('--target='));
const dryRun = args.includes('--dry-run');

if (!inputArg) {
  console.error('❌ Error: --input parameter is required');
  console.error('   Usage: npx tsx scripts/restore-icons.ts --input=backups/icons-backup-2026-02-09.json');
  process.exit(1);
}

const inputPath = inputArg.split('=')[1];
const target = targetArg ? targetArg.split('=')[1] : 'dev';

if (!['prod', 'dev'].includes(target)) {
  console.error('❌ Error: --target must be "prod" or "dev"');
  process.exit(1);
}

console.log(`📄 Backup file: ${inputPath}`);
console.log(`🎯 Target database: ${target.toUpperCase()}`);
console.log(`🔍 Dry run: ${dryRun ? 'YES' : 'NO'}`);
console.log();

// Verify backup file exists
if (!fs.existsSync(inputPath)) {
  console.error(`❌ Error: Backup file not found: ${inputPath}`);
  process.exit(1);
}

// Load .env first
if (fs.existsSync(envPath)) {
  console.log('📄 Loading .env file...');
  dotenv.config({ path: envPath });
}

// Load .env.local second
if (fs.existsSync(envLocalPath)) {
  console.log('📄 Loading .env.local file...');
  dotenv.config({ path: envLocalPath, override: true });
}

// Get credentials based on target
let supabaseUrl: string | undefined;
let supabaseKey: string | undefined;

if (target === 'prod') {
  supabaseUrl = process.env.VITE_SUPABASE_URL; // from .env
  supabaseKey = process.env.PROD_SUPABASE_SERVICE_ROLE_KEY; // from .env.local
} else {
  // For dev, both should be in .env.local
  supabaseUrl = process.env.VITE_SUPABASE_URL;
  supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
}

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Missing database credentials');
  console.error(`   VITE_SUPABASE_URL: ${supabaseUrl ? '✓' : '✗'}`);
  console.error(`   Service role key: ${supabaseKey ? '✓' : '✗'}`);
  process.exit(1);
}

console.log(`🔗 Connecting to: ${supabaseUrl.substring(0, 30)}...`);
console.log();

const supabase = createClient(supabaseUrl, supabaseKey);

async function restoreIcons() {
  try {
    // Read backup file
    console.log('📖 Reading backup file...');
    const fileContent = fs.readFileSync(inputPath, 'utf-8');
    const backupData = JSON.parse(fileContent);

    console.log(`   Backup date: ${new Date(backupData.backup_date).toLocaleString()}`);
    console.log(`   Icons in backup: ${backupData.total_icons}`);
    console.log();

    if (!backupData.icons || !Array.isArray(backupData.icons)) {
      console.error('❌ Error: Invalid backup file format');
      process.exit(1);
    }

    const icons = backupData.icons;

    if (dryRun) {
      console.log('🔍 DRY RUN - Showing what would be restored:');
      console.log();

      // Show sample of icons
      console.log('📋 Sample icons (first 10):');
      icons.slice(0, 10).forEach((icon: any, index: number) => {
        console.log(`   ${index + 1}. ${icon.name} (${icon.category})`);
      });

      if (icons.length > 10) {
        console.log(`   ... and ${icons.length - 10} more icons`);
      }

      console.log();
      console.log('========================================');
      console.log('🔍 DRY RUN - No changes were made');
      console.log('   Remove --dry-run flag to perform actual restore');
      return;
    }

    // Confirm before proceeding
    if (target === 'prod') {
      console.log('⚠️  WARNING: You are about to restore to PRODUCTION database!');
      console.log('   This will overwrite existing icons.');
      console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...');
      console.log();
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Restore icons in batches
    console.log('💾 Restoring icons to database...');
    const BATCH_SIZE = 100;
    const batches = Math.ceil(icons.length / BATCH_SIZE);

    for (let i = 0; i < batches; i++) {
      const start = i * BATCH_SIZE;
      const end = start + BATCH_SIZE;
      const batch = icons.slice(start, end);

      process.stdout.write(`\r   Restoring batch ${i + 1}/${batches}...`);

      const { error: upsertError } = await supabase
        .from('icons')
        .upsert(batch, { onConflict: 'id' });

      if (upsertError) {
        console.error(`\n❌ Error restoring batch ${i + 1}:`, upsertError.message);
        process.exit(1);
      }

      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log(`\n   ✓ Restored ${icons.length} icons`);
    console.log();

    console.log('========================================');
    console.log('✅ Restore completed successfully!');
    console.log('========================================');
    console.log(`📊 Icons restored: ${icons.length}`);
    console.log(`🎯 Target: ${target.toUpperCase()}`);
    console.log();

  } catch (error) {
    console.error('\n❌ Restore failed:', error);
    process.exit(1);
  }
}

// Run restore
restoreIcons();
