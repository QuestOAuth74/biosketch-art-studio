/**
 * Script to compare CSV icon names with database icon names
 * Usage: npx tsx scripts/compare-icon-names.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface IconMatch {
  csvName: string;
  dbName?: string;
  matchType: 'exact' | 'case-insensitive' | 'partial' | 'fuzzy' | 'none';
  similarity?: number;
}

// Levenshtein distance for fuzzy matching
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

function calculateSimilarity(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLength = Math.max(str1.length, str2.length);
  return ((maxLength - distance) / maxLength) * 100;
}

function parseCSV(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');

  // Skip header, get first column (OriginalName)
  const names: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const firstComma = lines[i].indexOf(',');
    if (firstComma !== -1) {
      const name = lines[i].substring(0, firstComma).trim();
      if (name) names.push(name);
    }
  }

  return names;
}

async function fetchAllIconNames(): Promise<string[]> {
  let allIcons: Array<{ name: string }> = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: icons, error } = await supabase
      .from('icons')
      .select('name')
      .order('name')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('Error fetching icons:', error);
      return [];
    }

    if (!icons || icons.length === 0) {
      hasMore = false;
    } else {
      allIcons = allIcons.concat(icons);
      if (icons.length < pageSize) {
        hasMore = false;
      }
      page++;
    }
  }

  return allIcons.map(icon => icon.name);
}

function findBestMatch(csvName: string, dbNames: string[]): IconMatch {
  const csvLower = csvName.toLowerCase().trim();

  // Try exact match
  const exactMatch = dbNames.find(name => name === csvName);
  if (exactMatch) {
    return { csvName, dbName: exactMatch, matchType: 'exact' };
  }

  // Try case-insensitive match
  const caseInsensitiveMatch = dbNames.find(name => name.toLowerCase() === csvLower);
  if (caseInsensitiveMatch) {
    return { csvName, dbName: caseInsensitiveMatch, matchType: 'case-insensitive' };
  }

  // Try partial match (CSV name is substring of DB name or vice versa)
  const partialMatch = dbNames.find(name => {
    const nameLower = name.toLowerCase();
    return nameLower.includes(csvLower) || csvLower.includes(nameLower);
  });
  if (partialMatch) {
    const similarity = calculateSimilarity(csvName, partialMatch);
    return { csvName, dbName: partialMatch, matchType: 'partial', similarity };
  }

  // Try fuzzy match (80% similarity threshold)
  let bestMatch: string | null = null;
  let bestSimilarity = 0;

  for (const dbName of dbNames) {
    const similarity = calculateSimilarity(csvName, dbName);
    if (similarity > bestSimilarity && similarity >= 80) {
      bestSimilarity = similarity;
      bestMatch = dbName;
    }
  }

  if (bestMatch) {
    return { csvName, dbName: bestMatch, matchType: 'fuzzy', similarity: bestSimilarity };
  }

  // No match found
  return { csvName, matchType: 'none' };
}

async function main() {
  console.log('🔍 Comparing CSV icon names with database...\n');

  // Get CSV file path from command line or use default
  const csvPath = process.argv[2] || path.join(process.cwd(), 'icon_taxonomy_alternatives(1).csv');

  if (!fs.existsSync(csvPath)) {
    console.error(`Error: CSV file not found at ${csvPath}`);
    process.exit(1);
  }

  console.log(`📄 Reading CSV: ${csvPath}`);
  const csvNames = parseCSV(csvPath);
  console.log(`   Found ${csvNames.length} names in CSV\n`);

  console.log('🗄️  Fetching all icon names from database...');
  const dbNames = await fetchAllIconNames();
  console.log(`   Found ${dbNames.length} icons in database\n`);

  console.log('🔗 Matching names...\n');
  const matches: IconMatch[] = [];

  for (const csvName of csvNames) {
    const match = findBestMatch(csvName, dbNames);
    matches.push(match);
  }

  // Generate report
  const exactMatches = matches.filter(m => m.matchType === 'exact');
  const caseMatches = matches.filter(m => m.matchType === 'case-insensitive');
  const partialMatches = matches.filter(m => m.matchType === 'partial');
  const fuzzyMatches = matches.filter(m => m.matchType === 'fuzzy');
  const noMatches = matches.filter(m => m.matchType === 'none');

  console.log('═══════════════════════════════════════════════════════════');
  console.log('                      SUMMARY REPORT');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`📊 Total CSV names:            ${csvNames.length}`);
  console.log(`✅ Exact matches:              ${exactMatches.length} (${((exactMatches.length / csvNames.length) * 100).toFixed(1)}%)`);
  console.log(`🔤 Case-insensitive matches:   ${caseMatches.length} (${((caseMatches.length / csvNames.length) * 100).toFixed(1)}%)`);
  console.log(`🔍 Partial matches:            ${partialMatches.length} (${((partialMatches.length / csvNames.length) * 100).toFixed(1)}%)`);
  console.log(`🎯 Fuzzy matches (≥80%):       ${fuzzyMatches.length} (${((fuzzyMatches.length / csvNames.length) * 100).toFixed(1)}%)`);
  console.log(`❌ No matches:                 ${noMatches.length} (${((noMatches.length / csvNames.length) * 100).toFixed(1)}%)\n`);

  console.log(`🎉 Total matchable:            ${exactMatches.length + caseMatches.length} (${(((exactMatches.length + caseMatches.length) / csvNames.length) * 100).toFixed(1)}%)`);
  console.log(`🤔 Potential matches (review): ${partialMatches.length + fuzzyMatches.length} (${(((partialMatches.length + fuzzyMatches.length) / csvNames.length) * 100).toFixed(1)}%)\n`);

  // Show unmatched names
  if (noMatches.length > 0) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('                    UNMATCHED NAMES');
    console.log('═══════════════════════════════════════════════════════════\n');
    noMatches.forEach((match, idx) => {
      console.log(`${idx + 1}. ${match.csvName}`);
    });
    console.log();
  }

  // Show potential fuzzy matches for review
  if (fuzzyMatches.length > 0) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('          FUZZY MATCHES (May need manual review)');
    console.log('═══════════════════════════════════════════════════════════\n');
    fuzzyMatches.forEach((match, idx) => {
      console.log(`${idx + 1}. CSV: "${match.csvName}"`);
      console.log(`   DB:  "${match.dbName}" (${match.similarity?.toFixed(1)}% similar)\n`);
    });
  }

  // Show partial matches
  if (partialMatches.length > 0 && partialMatches.length <= 20) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('                    PARTIAL MATCHES');
    console.log('═══════════════════════════════════════════════════════════\n');
    partialMatches.forEach((match, idx) => {
      console.log(`${idx + 1}. CSV: "${match.csvName}"`);
      console.log(`   DB:  "${match.dbName}" (${match.similarity?.toFixed(1)}% similar)\n`);
    });
  }

  // Save detailed report to file
  const reportPath = path.join(process.cwd(), 'icon-name-comparison-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    summary: {
      totalCSVNames: csvNames.length,
      totalDBIcons: dbNames.length,
      exactMatches: exactMatches.length,
      caseInsensitiveMatches: caseMatches.length,
      partialMatches: partialMatches.length,
      fuzzyMatches: fuzzyMatches.length,
      noMatches: noMatches.length
    },
    matches: matches
  }, null, 2));

  console.log(`\n💾 Detailed report saved to: ${reportPath}`);
}

main().catch(console.error);
