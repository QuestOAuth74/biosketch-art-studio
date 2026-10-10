import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface AnalysisResult {
  path: string;
  type: string;
  size: number;
  sample?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function analyzeObject(obj: any, path: string = 'root', results: AnalysisResult[] = []): AnalysisResult[] {
  if (!obj || typeof obj !== 'object') return results;

  // Check for SVG content
  if (obj.objects && Array.isArray(obj.objects)) {
    const size = JSON.stringify(obj.objects).length;
    if (size > 1000) { // Only report if > 1KB
      results.push({
        path: `${path}.objects`,
        type: 'SVG objects array',
        size,
        sample: JSON.stringify(obj.objects).substring(0, 100) + '...'
      });
    }
  }

  // Check for path data
  if (obj.path && Array.isArray(obj.path)) {
    const size = JSON.stringify(obj.path).length;
    if (size > 1000) {
      results.push({
        path: `${path}.path`,
        type: 'SVG path data',
        size,
        sample: JSON.stringify(obj.path).substring(0, 100) + '...'
      });
    }
  }

  // Check for base64 images
  if (typeof obj.src === 'string' && obj.src.startsWith('data:image')) {
    results.push({
      path: `${path}.src`,
      type: 'Base64 image',
      size: obj.src.length,
      sample: obj.src.substring(0, 50) + '...'
    });
  }

  // Check for SVG content string
  if (typeof obj.svg_content === 'string' && obj.svg_content.includes('<svg')) {
    results.push({
      path: `${path}.svg_content`,
      type: 'SVG content string',
      size: obj.svg_content.length,
      sample: obj.svg_content.substring(0, 100) + '...'
    });
  }

  // Check for iconSVG
  if (typeof obj.iconSVG === 'string' && obj.iconSVG.includes('<svg')) {
    results.push({
      path: `${path}.iconSVG`,
      type: 'Icon SVG string',
      size: obj.iconSVG.length,
      sample: obj.iconSVG.substring(0, 100) + '...'
    });
  }

  // Check for membrane options with iconSVG
  if (obj.membraneOptions?.iconSVG && typeof obj.membraneOptions.iconSVG === 'string') {
    results.push({
      path: `${path}.membraneOptions.iconSVG`,
      type: 'Membrane icon SVG',
      size: obj.membraneOptions.iconSVG.length,
      sample: obj.membraneOptions.iconSVG.substring(0, 100) + '...'
    });
  }

  // Check for vectorObjects (rasterized membranes)
  if (obj.vectorObjects) {
    const size = JSON.stringify(obj.vectorObjects).length;
    if (size > 10000) { // Only report if > 10KB
      results.push({
        path: `${path}.vectorObjects`,
        type: 'Vector objects (rasterized membrane)',
        size,
        sample: JSON.stringify(obj.vectorObjects).substring(0, 100) + '...'
      });
    }
  }

  // Recurse into arrays
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      analyzeObject(item, `${path}[${index}]`, results);
    });
  } else {
    // Recurse into object properties
    for (const key in obj) {
      if (obj.hasOwnProperty(key) && typeof obj[key] === 'object') {
        analyzeObject(obj[key], `${path}.${key}`, results);
      }
    }
  }

  return results;
}

async function analyzeProject(projectId: string) {
  console.log(`\n🔍 Analyzing project: ${projectId}\n`);

  // Fetch project
  const { data: project, error } = await supabase
    .from('canvas_projects')
    .select('id, name, canvas_data')
    .eq('id', projectId)
    .single();

  if (error || !project) {
    console.error('❌ Error fetching project:', error);
    return;
  }

  console.log(`📊 Project: ${project.name}`);

  const canvasDataStr = JSON.stringify(project.canvas_data);
  const totalSize = canvasDataStr.length;
  const totalSizeMB = totalSize / (1024 * 1024);

  console.log(`📦 Total canvas_data size: ${formatBytes(totalSize)} (${totalSizeMB.toFixed(2)} MB)`);
  console.log(`⚠️  Supabase limit: 4 MB\n`);

  if (totalSizeMB > 4) {
    console.log('❌ Project exceeds 4 MB limit!\n');
  }

  // Analyze for large data
  const results = analyzeObject(project.canvas_data);

  if (results.length === 0) {
    console.log('✅ No large SVG or asset data found!');
    console.log('\nThe project size issue may be due to:');
    console.log('  - Large number of objects');
    console.log('  - Complex paths or shapes');
    console.log('  - Other metadata');
    return;
  }

  // Sort by size
  results.sort((a, b) => b.size - a.size);

  console.log(`\n🚨 Found ${results.length} instances of large data:\n`);

  // Group by type
  const byType = new Map<string, AnalysisResult[]>();
  results.forEach(r => {
    if (!byType.has(r.type)) {
      byType.set(r.type, []);
    }
    byType.get(r.type)!.push(r);
  });

  // Report by type
  byType.forEach((items, type) => {
    const totalTypeSize = items.reduce((sum, item) => sum + item.size, 0);
    console.log(`\n📌 ${type} (${items.length} instances, ${formatBytes(totalTypeSize)} total)`);
    console.log('─'.repeat(80));

    // Show top 5 largest
    items.slice(0, 5).forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.path}`);
      console.log(`     Size: ${formatBytes(item.size)}`);
      if (item.sample) {
        console.log(`     Sample: ${item.sample}`);
      }
      console.log();
    });

    if (items.length > 5) {
      console.log(`  ... and ${items.length - 5} more instances\n`);
    }
  });

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));

  const totalLargeDataSize = results.reduce((sum, r) => sum + r.size, 0);
  console.log(`Total size of large data found: ${formatBytes(totalLargeDataSize)}`);
  console.log(`Percentage of total: ${(totalLargeDataSize / totalSize * 100).toFixed(1)}%`);

  console.log('\n💡 RECOMMENDATIONS:');

  if (byType.has('Icon SVG string') || byType.has('Membrane icon SVG')) {
    console.log('  ⚠️  Found raw SVG content that should use icon-by-reference!');
    console.log('     - These icons should have iconId instead of full SVG');
  }

  if (byType.has('Base64 image')) {
    console.log('  ⚠️  Found base64 images - consider using external storage');
  }

  if (byType.has('SVG objects array')) {
    console.log('  ⚠️  Found large objects arrays - may be icons not using reference system');
  }

  if (byType.has('Vector objects (rasterized membrane)')) {
    console.log('  ⚠️  Found large vectorObjects in rasterized membranes');
    console.log('     - Check if nested icons are being stripped correctly');
  }

  console.log();
}

// Get project ID from command line
const projectId = process.argv[2] || '707553e5-70c2-4792-a955-f465ae989952';

analyzeProject(projectId)
  .then(() => {
    console.log('\n✅ Analysis complete\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  });
