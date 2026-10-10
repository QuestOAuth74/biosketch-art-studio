/**
 * Utility script to analyze dev_io_logs table
 * Usage: npx tsx scripts/analyze-dev-logs.ts
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

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeLogs() {
  console.log('📊 Analyzing dev_io_log...\n');

  try {
    // Get all logs
    const { data: logs, error } = await supabase
      .from('dev_io_log')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) throw error;

    if (!logs || logs.length === 0) {
      console.log('ℹ️  No logs found');
      return;
    }

    console.log(`Total operations: ${logs.length}\n`);

    // Filter icon-related operations
    const iconOps = logs.filter(log =>
      log.table_name === 'icons' ||
      log.source?.includes('icon') ||
      log.source?.includes('Icon')
    );

    console.log('=== ICON-RELATED OPERATIONS ===\n');

    if (iconOps.length === 0) {
      console.log('ℹ️  No icon operations found\n');
    } else {
      // Group by operation type
      const byType = iconOps.reduce((acc, log) => {
        const key = log.operation_type;
        if (!acc[key]) acc[key] = [];
        acc[key].push(log);
        return acc;
      }, {} as Record<string, any[]>);

      for (const [type, ops] of Object.entries(byType)) {
        const totalSize = ops.reduce((sum, op) => sum + (op.data_size_kb || 0), 0);
        const avgSize = totalSize / ops.length;
        const maxSize = Math.max(...ops.map(op => op.data_size_kb || 0));
        const totalDuration = ops.reduce((sum, op) => sum + (op.duration_ms || 0), 0);
        const avgDuration = totalDuration / ops.length;

        console.log(`${type.toUpperCase()}:`);
        console.log(`  Count: ${ops.length}`);
        console.log(`  Total Size: ${(totalSize / 1024).toFixed(2)} MB`);
        console.log(`  Average Size: ${avgSize.toFixed(2)} KB`);
        console.log(`  Max Size: ${maxSize.toFixed(2)} KB`);
        console.log(`  Average Duration: ${avgDuration.toFixed(0)} ms`);

        // Show largest queries
        const largest = ops.sort((a, b) => (b.data_size_kb || 0) - (a.data_size_kb || 0)).slice(0, 3);
        console.log('  Largest queries:');
        largest.forEach((op, i) => {
          const size = op.data_size_kb || 0;
          const source = op.source || 'unknown';
          console.log(`    ${i + 1}. ${size.toFixed(2)} KB - ${source}`);
        });
        console.log('');
      }
    }

    // Performance assessment
    console.log('=== PERFORMANCE ASSESSMENT ===\n');

    const iconSelects = iconOps.filter(op => op.operation_type === 'SELECT');
    if (iconSelects.length > 0) {
      const avgSelectSize = iconSelects.reduce((sum, op) => sum + (op.data_size_kb || 0), 0) / iconSelects.length;
      const maxSelectSize = Math.max(...iconSelects.map(op => op.data_size_kb || 0));

      console.log(`Icon SELECT operations: ${iconSelects.length}`);
      console.log(`Average size: ${avgSelectSize.toFixed(2)} KB`);
      console.log(`Max size: ${maxSelectSize.toFixed(2)} KB`);
      console.log(`Total transferred: ${(iconSelects.reduce((sum, op) => sum + (op.data_size_kb || 0), 0) / 1024).toFixed(2)} MB\n`);

      // Check if performance is acceptable
      const ACCEPTABLE_AVG_SIZE = 1024; // 1 MB in KB
      const ACCEPTABLE_MAX_SIZE = 2 * 1024; // 2 MB in KB

      if (maxSelectSize > ACCEPTABLE_MAX_SIZE) {
        console.log('❌ PERFORMANCE ISSUE: Max query size exceeds 2 MB');
        console.log(`   Found query of ${(maxSelectSize / 1024).toFixed(2)} MB`);
      } else if (avgSelectSize > ACCEPTABLE_AVG_SIZE) {
        console.log('⚠️  WARNING: Average query size exceeds 1 MB');
        console.log(`   Average: ${(avgSelectSize / 1024).toFixed(2)} MB`);
      } else {
        console.log('✅ PERFORMANCE ACCEPTABLE: All icon queries are optimized');
        console.log(`   Max query: ${maxSelectSize.toFixed(2)} KB`);
        console.log(`   Average query: ${avgSelectSize.toFixed(2)} KB`);
      }
    } else {
      console.log('ℹ️  No icon SELECT operations found');
    }

    console.log('');

    // Show all operations summary
    console.log('=== ALL OPERATIONS BY TABLE ===\n');
    const byTable = logs.reduce((acc, log) => {
      const key = log.table_name || 'unknown';
      if (!acc[key]) acc[key] = { count: 0, size: 0 };
      acc[key].count++;
      acc[key].size += log.data_size_kb || 0;
      return acc;
    }, {} as Record<string, { count: number; size: number }>);

    for (const [table, stats] of Object.entries(byTable).sort((a, b) => b[1].size - a[1].size)) {
      console.log(`${table}:`);
      console.log(`  Operations: ${stats.count}`);
      console.log(`  Total Size: ${(stats.size / 1024).toFixed(2)} MB`);
      console.log('');
    }

  } catch (error) {
    console.error('❌ Failed to analyze logs:', error);
    process.exit(1);
  }
}

analyzeLogs();
