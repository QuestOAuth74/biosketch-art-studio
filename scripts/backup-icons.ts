/**
 * Backup Script: Export All Icons from Production Database
 *
 * Creates a complete backup of all icons from the production database
 * before running any migration scripts.
 *
 * Exports to: backups/icons-backup-{timestamp}.json
 *
 * Usage: npx tsx scripts/backup-icons.ts [--output=path/to/backup.json]
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

console.log('🔄 Icon Backup Script');
console.log('========================================');
console.log();

// Load .env first (production URL)
if (fs.existsSync(envPath)) {
  console.log('📄 Loading .env file...');
  dotenv.config({ path: envPath });
}

// Store production URL before loading .env.local
const prodUrl = process.env.VITE_SUPABASE_URL;

// Load .env.local second (production service key)
if (fs.existsSync(envLocalPath)) {
  console.log('📄 Loading .env.local file...');
  dotenv.config({ path: envLocalPath, override: true });
}

// Get production service key from .env.local
const prodKey = process.env.PROD_SUPABASE_SERVICE_ROLE_KEY;

if (!prodUrl || !prodKey) {
  console.error('❌ Error: Missing production credentials');
  console.error('   VITE_SUPABASE_URL (from .env):', prodUrl ? '✓' : '✗');
  console.error('   PROD_SUPABASE_SERVICE_ROLE_KEY (from .env.local):', prodKey ? '✓' : '✗');
  process.exit(1);
}

console.log('🔑 Using production service role key');
console.log(`🔗 Connecting to: ${prodUrl.substring(0, 30)}...`);
console.log();

const supabase = createClient(prodUrl, prodKey);

// Parse command line args
const args = process.argv.slice(2);
const outputArg = args.find(arg => arg.startsWith('--output='));
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
const defaultOutput = path.join(rootDir, 'backups', `icons-backup-${timestamp}.json`);
const outputPath = outputArg ? outputArg.split('=')[1] : defaultOutput;

async function backupIcons() {
  try {
    // Create backups directory if it doesn't exist
    const backupDir = path.dirname(outputPath);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      console.log(`📁 Created backup directory: ${backupDir}`);
      console.log();
    }

    // Get total count
    console.log('📊 Counting icons in production database...');
    const { count, error: countError } = await supabase
      .from('icons')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Error counting icons:', countError);
      process.exit(1);
    }

    const totalIcons = count || 0;
    console.log(`   Found ${totalIcons} icons to backup`);
    console.log();

    // Fetch all icons in batches using cursor-based pagination
    const BATCH_SIZE = 100;
    let allIcons: any[] = [];
    let lastId: string | null = null;
    let batchNumber = 0;

    console.log('📦 Fetching icons...');

    while (true) {
      batchNumber++;
      process.stdout.write(`\r   Batch ${batchNumber}: ${allIcons.length}/${totalIcons} icons...`);

      let query = supabase
        .from('icons')
        .select('*')
        .order('id', { ascending: true })
        .limit(BATCH_SIZE);

      if (lastId) {
        query = query.gt('id', lastId);
      }

      const { data: batchIcons, error: fetchError } = await query;

      if (fetchError) {
        console.error(`\n❌ Error fetching batch ${batchNumber}:`, fetchError.message);
        process.exit(1);
      }

      if (!batchIcons || batchIcons.length === 0) {
        break;
      }

      allIcons = allIcons.concat(batchIcons);
      lastId = batchIcons[batchIcons.length - 1].id;

      if (batchIcons.length < BATCH_SIZE) {
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log(`\n   ✓ Fetched ${allIcons.length} icons`);
    console.log();

    console.log(`💾 Writing backup to file...`);
    console.log(`   Path: ${outputPath}`);

    // Write file incrementally to avoid memory issues
    const writeStream = fs.createWriteStream(outputPath, 'utf-8');

    // Write header
    writeStream.write('{\n');
    writeStream.write(`  "backup_date": "${new Date().toISOString()}",\n`);
    writeStream.write(`  "source_database": "${prodUrl}",\n`);
    writeStream.write(`  "total_icons": ${allIcons.length},\n`);
    writeStream.write('  "icons": [\n');

    // Write icons one by one
    for (let i = 0; i < allIcons.length; i++) {
      const iconJson = JSON.stringify(allIcons[i], null, 4);
      // Indent by 4 spaces
      const indentedIcon = iconJson.split('\n').map(line => '    ' + line).join('\n');
      writeStream.write(indentedIcon);

      if (i < allIcons.length - 1) {
        writeStream.write(',\n');
      } else {
        writeStream.write('\n');
      }

      // Progress indicator
      if ((i + 1) % 100 === 0) {
        process.stdout.write(`\r   Writing: ${i + 1}/${allIcons.length} icons...`);
      }
    }

    // Write footer
    writeStream.write('  ]\n');
    writeStream.write('}\n');
    writeStream.end();

    // Wait for write to complete
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    console.log(`\r   ✓ Wrote ${allIcons.length} icons to file`);

    // Get file size
    const stats = fs.statSync(outputPath);
    const sizeInMB = (stats.size / 1024 / 1024).toFixed(2);

    console.log();
    console.log('========================================');
    console.log('✅ Backup completed successfully!');
    console.log('========================================');
    console.log(`📄 Backup file: ${outputPath}`);
    console.log(`📊 Icons backed up: ${allIcons.length}`);
    console.log(`💾 File size: ${sizeInMB} MB`);
    console.log();

    // Show category breakdown
    const categoryCounts = allIcons.reduce((acc, icon) => {
      acc[icon.category] = (acc[icon.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('📋 Category breakdown:');
    Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .forEach(([category, count]) => {
        console.log(`   - ${category}: ${count} icons`);
      });

    if (Object.keys(categoryCounts).length > 10) {
      console.log(`   ... and ${Object.keys(categoryCounts).length - 10} more categories`);
    }

    console.log();
    console.log('💡 To restore from this backup, use:');
    console.log(`   npx tsx scripts/restore-icons.ts --input="${outputPath}"`);
    console.log();

  } catch (error) {
    console.error('\n❌ Backup failed:', error);
    process.exit(1);
  }
}

// Run backup
backupIcons();
