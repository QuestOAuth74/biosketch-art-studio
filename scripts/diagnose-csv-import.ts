/**
 * Diagnostic script to replicate the exact CSV import logic
 * and identify why matches differ from compare-icon-names.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// EXACT copy of parseCSV from TagCSVImport.tsx
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

async function fetchAllIcons() {
  let allIcons: Array<{ id: string; name: string; thumbnail: string | null; tags: string[] | null }> = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  console.log('Fetching all icons from database...');

  while (hasMore) {
    const { data: icons, error } = await supabase
      .from('icons')
      .select('id, name, thumbnail, tags')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('Error fetching icons:', error);
      return [];
    }

    if (!icons || icons.length === 0) {
      hasMore = false;
    } else {
      allIcons = allIcons.concat(icons);
      console.log(`  Fetched page ${page + 1}: ${icons.length} icons (total: ${allIcons.length})`);
      if (icons.length < pageSize) {
        hasMore = false;
      }
      page++;
    }
  }

  return allIcons;
}

async function main() {
  console.log('🔍 Diagnosing CSV Import Logic\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Read CSV
  const csvPath = process.argv[2] || path.join(process.cwd(), 'icon_taxonomy_alternatives(1).csv');
  if (!fs.existsSync(csvPath)) {
    console.error(`Error: CSV file not found at ${csvPath}`);
    process.exit(1);
  }

  console.log(`📄 Reading CSV: ${csvPath}`);
  const csvText = fs.readFileSync(csvPath, 'utf-8');
  const { headers, rows } = parseCSV(csvText);

  console.log(`   Headers: ${headers.join(', ')}`);
  console.log(`   Total rows: ${rows.length}\n`);

  // Show sample row
  if (rows.length > 0) {
    console.log('Sample row:');
    console.log(JSON.stringify(rows[0], null, 2));
    console.log();
  }

  // Simulate column mapping - assuming OriginalName maps to nameColumn
  const mapping = {
    idColumn: null,
    nameColumn: 'OriginalName',
    tag1Column: 'Alternative1',
    tag2Column: 'Alternative2',
    tag3Column: 'Alternative3'
  };

  console.log('Column Mapping:');
  console.log(JSON.stringify(mapping, null, 2));
  console.log();

  // Fetch all icons (EXACT logic from TagCSVImport)
  const icons = await fetchAllIcons();
  console.log(`\n✅ Fetched ${icons.length} icons from database\n`);

  // Create lookup structures (EXACT logic from current TagCSVImport)
  const iconByIdMap = new Map(icons.map(icon => [icon.id, icon]));
  const iconsList = icons; // Keep as array for name matching

  console.log('Starting match process...\n');

  let validMatches = 0;
  let errorMatches = 0;
  let noChangeMatches = 0;
  const errorSamples: Array<{ csvName: string; reason: string }> = [];

  // Process each row (EXACT logic from TagCSVImport)
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

    // Extract tags
    const newTags: string[] = [];
    if (mapping.tag1Column && row[mapping.tag1Column]) {
      newTags.push(row[mapping.tag1Column].trim().toLowerCase());
    }
    if (mapping.tag2Column && row[mapping.tag2Column]) {
      newTags.push(row[mapping.tag2Column].trim().toLowerCase());
    }
    if (mapping.tag3Column && row[mapping.tag3Column]) {
      newTags.push(row[mapping.tag3Column].trim().toLowerCase());
    }

    if (!icon) {
      const identifier = mapping.idColumn && row[mapping.idColumn]
        ? row[mapping.idColumn]
        : row[mapping.nameColumn || ''] || 'Unknown';

      errorMatches++;
      if (errorSamples.length < 10) {
        errorSamples.push({
          csvName: identifier,
          reason: `Icon not found (tried matching by ${matchMethod || 'ID/Name'})`
        });
      }
      continue;
    }

    const currentTags = (icon.tags as string[]) || [];

    // Check if tags are different
    const tagsChanged = JSON.stringify(currentTags.sort()) !== JSON.stringify(newTags.sort());

    if (tagsChanged) {
      validMatches++;
    } else {
      noChangeMatches++;
    }

    // Show progress every 1000 rows
    if ((idx + 1) % 1000 === 0) {
      console.log(`Processed ${idx + 1}/${rows.length} rows...`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('                      RESULTS');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`📊 Total CSV rows:     ${rows.length}`);
  console.log(`✅ Valid updates:      ${validMatches} (${((validMatches / rows.length) * 100).toFixed(1)}%)`);
  console.log(`⚪ No changes:         ${noChangeMatches} (${((noChangeMatches / rows.length) * 100).toFixed(1)}%)`);
  console.log(`❌ Errors:             ${errorMatches} (${((errorMatches / rows.length) * 100).toFixed(1)}%)\n`);

  console.log(`🎯 Total matches:      ${validMatches + noChangeMatches} (${(((validMatches + noChangeMatches) / rows.length) * 100).toFixed(1)}%)\n`);

  if (errorSamples.length > 0) {
    console.log('Sample errors:');
    errorSamples.forEach((sample, idx) => {
      console.log(`  ${idx + 1}. "${sample.csvName}" - ${sample.reason}`);
    });
    console.log();
  }

  // Additional diagnostics
  console.log('═══════════════════════════════════════════════════════════');
  console.log('                   DIAGNOSTICS');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Check if CSV names match DB names (case-sensitive)
  const csvNames = rows.map(r => r[mapping.nameColumn || '']).filter(n => n);
  const dbNames = icons.map(i => i.name);
  const dbNamesLower = new Set(icons.map(i => i.name.toLowerCase()));

  const exactMatches = csvNames.filter(name => dbNames.includes(name)).length;
  const caseInsensitiveMatches = csvNames.filter(name => dbNamesLower.has(name.toLowerCase())).length;

  console.log(`CSV names (total):              ${csvNames.length}`);
  console.log(`CSV names (unique):             ${new Set(csvNames).size}`);
  console.log(`DB names (total):               ${dbNames.length}`);
  console.log(`DB names (unique):              ${new Set(dbNames).size}`);
  console.log(`DB names (unique lower):        ${dbNamesLower.size}\n`);

  console.log(`Exact matches (case-sensitive): ${exactMatches}`);
  console.log(`Case-insensitive matches:       ${caseInsensitiveMatches}\n`);

  // Sample CSV names vs DB names
  console.log('First 5 CSV names:');
  csvNames.slice(0, 5).forEach((name, idx) => {
    const dbMatch = iconsList.find(i => i.name.toLowerCase() === name.toLowerCase());
    console.log(`  ${idx + 1}. "${name}" → ${dbMatch ? `✅ "${dbMatch.name}"` : '❌ no match'}`);
  });
}

main().catch(console.error);
