/**
 * Unit test for CSV import functionality
 * Tests the exact same logic as TagCSVImport component
 *
 * Run: NEXT_PUBLIC_SUPABASE_URL="..." NEXT_PUBLIC_SUPABASE_ANON_KEY="..." npx tsx scripts/test-csv-import.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================================================
// EXACT COPY OF FUNCTIONS FROM TagCSVImport.tsx
// ============================================================================

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split('\n');
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = lines[0].split(',').map(h => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() || '';
    });

    rows.push(row);
  }

  return { headers, rows };
}

interface ColumnMapping {
  idColumn: string | null;
  nameColumn: string | null;
  tag1Column: string | null;
  tag2Column: string | null;
  tag3Column: string | null;
}

function extractTagsFromMapping(row: Record<string, string>, mapping: ColumnMapping): string[] {
  const tags: string[] = [];

  if (mapping.tag1Column && row[mapping.tag1Column]) {
    tags.push(row[mapping.tag1Column].trim().toLowerCase());
  }
  if (mapping.tag2Column && row[mapping.tag2Column]) {
    tags.push(row[mapping.tag2Column].trim().toLowerCase());
  }
  if (mapping.tag3Column && row[mapping.tag3Column]) {
    tags.push(row[mapping.tag3Column].trim().toLowerCase());
  }

  return tags.filter(t => t.length > 0).slice(0, 3);
}

interface CSVImportPreview {
  status: 'valid' | 'error' | 'no-change';
  iconId: string;
  iconName: string;
  thumbnail: string | null;
  currentTags: string[];
  newTags: string[];
  error?: string;
}

async function validateAndPreview(
  csvText: string,
  mapping: ColumnMapping
): Promise<CSVImportPreview[]> {
  const { headers, rows } = parseCSV(csvText);

  if (rows.length === 0) {
    throw new Error('No data rows found in CSV');
  }

  // Fetch all icons to match (paginate to handle >1000 icons)
  let allIcons: Array<{ id: string; name: string; thumbnail: string | null; tags: string[] | null }> = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  console.log('Fetching icons from database...');
  while (hasMore) {
    const { data: icons, error } = await supabase
      .from('icons')
      .select('id, name, thumbnail, tags')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      throw new Error('Failed to fetch icons: ' + error.message);
    }

    if (!icons || icons.length === 0) {
      hasMore = false;
    } else {
      allIcons = allIcons.concat(icons);
      console.log(`  Page ${page + 1}: ${icons.length} icons (total: ${allIcons.length})`);
      if (icons.length < pageSize) {
        hasMore = false;
      }
      page++;
    }
  }

  const icons = allIcons;
  console.log(`✅ Fetched ${icons.length} icons total\n`);

  // Create lookup map for ID matching
  const iconByIdMap = new Map(icons?.map(icon => [icon.id, icon]) || []);

  // For name matching, keep as array to handle duplicates
  // (Map would only keep last icon with duplicate names)
  const iconsList = icons || [];

  const preview: CSVImportPreview[] = [];

  console.log('Processing CSV rows...');
  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    let icon = null;
    let iconId = '';
    let matchMethod = '';

    // Try ID matching first if ID column is mapped
    if (mapping.idColumn && row[mapping.idColumn]) {
      iconId = row[mapping.idColumn];
      icon = iconByIdMap.get(iconId);
      matchMethod = 'ID';
    }

    // Try name matching if no ID match and name column is mapped
    if (!icon && mapping.nameColumn && row[mapping.nameColumn]) {
      const iconName = row[mapping.nameColumn].toLowerCase().trim();
      // Use find() to get first match (handles duplicate names better than Map)
      icon = iconsList.find(i => i.name.toLowerCase() === iconName) || null;
      iconId = icon?.id || '';
      matchMethod = 'Name';
    }

    const newTags = extractTagsFromMapping(row, mapping);

    if (!icon) {
      const identifier = mapping.idColumn && row[mapping.idColumn]
        ? row[mapping.idColumn]
        : row[mapping.nameColumn || ''] || 'Unknown';

      preview.push({
        status: 'error',
        iconId: iconId || identifier,
        iconName: identifier,
        thumbnail: null,
        currentTags: [],
        newTags,
        error: `Icon not found (tried matching by ${matchMethod || 'ID/Name'})`
      });
      continue;
    }

    const currentTags = (icon.tags as string[]) || [];

    // Validate tags
    if (newTags.length > 3) {
      preview.push({
        status: 'error',
        iconId: icon.id,
        iconName: icon.name,
        thumbnail: icon.thumbnail,
        currentTags,
        newTags: newTags.slice(0, 3),
        error: 'Too many tags (max 3), only first 3 will be used'
      });
      continue;
    }

    // Check if tags are different
    const tagsChanged = JSON.stringify(currentTags.sort()) !== JSON.stringify(newTags.sort());

    preview.push({
      status: tagsChanged ? 'valid' : 'no-change',
      iconId: icon.id,
      iconName: icon.name,
      thumbnail: icon.thumbnail,
      currentTags,
      newTags
    });

    // Progress indicator
    if ((idx + 1) % 1000 === 0) {
      console.log(`  Processed ${idx + 1}/${rows.length} rows`);
    }
  }

  return preview;
}

// ============================================================================
// TEST EXECUTION
// ============================================================================

async function runTest() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          CSV IMPORT UNIT TEST                              ║');
  console.log('║  Testing TagCSVImport.tsx validateAndPreview() logic       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const csvPath = process.argv[2] || path.join(process.cwd(), 'icon_taxonomy_alternatives(1).csv');

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV file not found: ${csvPath}`);
    process.exit(1);
  }

  console.log(`📄 CSV File: ${csvPath}`);
  const csvText = fs.readFileSync(csvPath, 'utf-8');
  const { headers, rows } = parseCSV(csvText);

  console.log(`📊 CSV Headers: ${headers.join(', ')}`);
  console.log(`📊 CSV Rows: ${rows.length}\n`);

  // Simulate column mapping (same as user would select in UI)
  const mapping: ColumnMapping = {
    idColumn: null,
    nameColumn: 'OriginalName',
    tag1Column: 'Alternative1',
    tag2Column: 'Alternative2',
    tag3Column: 'Alternative3'
  };

  console.log('🔧 Column Mapping:');
  console.log(`   Name Column: ${mapping.nameColumn}`);
  console.log(`   Tag 1 Column: ${mapping.tag1Column}`);
  console.log(`   Tag 2 Column: ${mapping.tag2Column}`);
  console.log(`   Tag 3 Column: ${mapping.tag3Column}\n`);

  console.log('═══════════════════════════════════════════════════════════\n');

  const startTime = Date.now();
  const preview = await validateAndPreview(csvText, mapping);
  const duration = Date.now() - startTime;

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('                      TEST RESULTS');
  console.log('═══════════════════════════════════════════════════════════\n');

  const validCount = preview.filter(p => p.status === 'valid').length;
  const noChangeCount = preview.filter(p => p.status === 'no-change').length;
  const errorCount = preview.filter(p => p.status === 'error').length;

  console.log(`⏱️  Processing Time:    ${(duration / 1000).toFixed(2)}s`);
  console.log(`📊 Total Rows:         ${preview.length}`);
  console.log(`✅ Valid Updates:      ${validCount} (${((validCount / preview.length) * 100).toFixed(1)}%)`);
  console.log(`⚪ No Changes:         ${noChangeCount} (${((noChangeCount / preview.length) * 100).toFixed(1)}%)`);
  console.log(`❌ Errors:             ${errorCount} (${((errorCount / preview.length) * 100).toFixed(1)}%)`);
  console.log(`🎯 Match Rate:         ${(((validCount + noChangeCount) / preview.length) * 100).toFixed(1)}%\n`);

  // Show error samples
  const errors = preview.filter(p => p.status === 'error');
  if (errors.length > 0) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('                    ERROR SAMPLES');
    console.log('═══════════════════════════════════════════════════════════\n');
    errors.slice(0, 20).forEach((err, idx) => {
      console.log(`${idx + 1}. "${err.iconName}"`);
      console.log(`   Error: ${err.error}\n`);
    });
  }

  // Show valid update samples
  const validSamples = preview.filter(p => p.status === 'valid').slice(0, 5);
  if (validSamples.length > 0) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('                  VALID UPDATE SAMPLES');
    console.log('═══════════════════════════════════════════════════════════\n');
    validSamples.forEach((sample, idx) => {
      console.log(`${idx + 1}. ${sample.iconName} (${sample.iconId.substring(0, 8)}...)`);
      console.log(`   Current: [${sample.currentTags.join(', ')}]`);
      console.log(`   New:     [${sample.newTags.join(', ')}]\n`);
    });
  }

  // Save detailed results
  const reportPath = path.join(process.cwd(), 'csv-import-test-results.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    testDate: new Date().toISOString(),
    csvFile: csvPath,
    processingTimeMs: duration,
    summary: {
      totalRows: preview.length,
      validUpdates: validCount,
      noChanges: noChangeCount,
      errors: errorCount,
      matchRate: ((validCount + noChangeCount) / preview.length) * 100
    },
    columnMapping: mapping,
    results: preview
  }, null, 2));

  console.log(`💾 Detailed results saved to: ${reportPath}\n`);

  // Test conclusion
  console.log('═══════════════════════════════════════════════════════════');
  console.log('                      CONCLUSION');
  console.log('═══════════════════════════════════════════════════════════\n');

  const matchRate = ((validCount + noChangeCount) / preview.length) * 100;
  if (matchRate >= 98) {
    console.log('✅ TEST PASSED: Match rate >= 98%');
    console.log('   The CSV import logic is working correctly.\n');
  } else if (matchRate >= 90) {
    console.log('⚠️  TEST WARNING: Match rate between 90-98%');
    console.log('   Some icons may be missing from database.\n');
  } else {
    console.log('❌ TEST FAILED: Match rate < 90%');
    console.log('   There is a bug in the matching logic or database.\n');
  }
}

runTest().catch(err => {
  console.error('\n❌ Test failed with error:', err);
  process.exit(1);
});
