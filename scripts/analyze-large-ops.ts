/**
 * Query dev_io_log for largest operations causing IO issues
 * Usage: npx tsx scripts/analyze-large-ops.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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

async function analyzeLargeOps() {
  console.log('🔍 Analyzing largest database operations from dev_io_log...\n');

  // Get top 20 largest operations
  const { data: largest, error: largestError } = await supabase
    .from('dev_io_log')
    .select('*')
    .order('data_size_kb', { ascending: false })
    .limit(20);

  if (largestError) {
    console.error('Error fetching largest ops:', largestError);
    return;
  }

  console.log('=== TOP 20 LARGEST OPERATIONS ===\n');
  largest?.forEach((log, i) => {
    const sizeMB = ((log.data_size_kb || 0) / 1024).toFixed(2);
    console.log(`${i + 1}. ${log.table_name || 'unknown'} - ${log.operation_type}`);
    console.log(`   Size: ${sizeMB} MB (${(log.data_size_kb || 0).toFixed(0)} KB)`);
    console.log(`   Duration: ${log.duration_ms?.toFixed(0) || 0} ms`);
    console.log(`   Source: ${log.source || 'unknown'}`);
    console.log(`   Timestamp: ${log.timestamp}`);
    if (log.error) {
      console.log(`   Error: ${log.error}`);
    }
    console.log('');
  });

  // Aggregate stats by table and operation for queries > 100KB
  const { data: allLarge, error: allError } = await supabase
    .from('dev_io_log')
    .select('table_name, operation_type, data_size_kb, duration_ms')
    .gt('data_size_kb', 100);

  if (allError) {
    console.error('Error fetching all large ops:', allError);
    return;
  }

  const byTableOp = allLarge?.reduce((acc, log) => {
    const key = `${log.table_name || 'unknown'}:${log.operation_type}`;
    if (!acc[key]) {
      acc[key] = {
        table: log.table_name || 'unknown',
        operation: log.operation_type,
        count: 0,
        totalSize: 0,
        maxSize: 0,
        avgSize: 0,
        totalDuration: 0,
        avgDuration: 0
      };
    }
    acc[key].count++;
    acc[key].totalSize += log.data_size_kb || 0;
    acc[key].maxSize = Math.max(acc[key].maxSize, log.data_size_kb || 0);
    acc[key].totalDuration += log.duration_ms || 0;
    return acc;
  }, {} as Record<string, any>);

  // Calculate averages and sort by total size
  const sorted = Object.values(byTableOp || {})
    .map(stats => ({
      ...stats,
      avgSize: stats.totalSize / stats.count,
      avgDuration: stats.totalDuration / stats.count
    }))
    .sort((a, b) => b.totalSize - a.totalSize);

  console.log('\n=== OPERATIONS > 100KB GROUPED BY TABLE ===\n');
  sorted.forEach(stats => {
    console.log(`${stats.table} - ${stats.operation}:`);
    console.log(`  Count: ${stats.count}`);
    console.log(`  Total Size: ${(stats.totalSize / 1024).toFixed(2)} MB`);
    console.log(`  Avg Size: ${(stats.avgSize / 1024).toFixed(2)} MB`);
    console.log(`  Max Size: ${(stats.maxSize / 1024).toFixed(2)} MB`);
    console.log(`  Avg Duration: ${stats.avgDuration.toFixed(0)} ms`);
    console.log('');
  });
}

analyzeLargeOps();
