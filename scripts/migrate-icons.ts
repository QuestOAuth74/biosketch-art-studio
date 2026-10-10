import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = resolve(__dirname, "../.env");
const envLocalPath = resolve(__dirname, "../.env.local");

console.log("=".repeat(60));
console.log("Icon Migration Script: Production → Development");
console.log("=".repeat(60));
console.log();

// Load production URL from .env
console.log("📦 Loading production URL from .env...");
if (!existsSync(envPath)) {
  console.error("❌ .env file not found");
  process.exit(1);
}
dotenv.config({ path: envPath });

const prodUrl = process.env.VITE_SUPABASE_URL;

if (!prodUrl) {
  console.error("❌ Missing VITE_SUPABASE_URL in .env");
  process.exit(1);
}

console.log("✓ Production URL loaded");
console.log(`  URL: ${prodUrl}`);
console.log();

// Load credentials from .env.local
console.log("📦 Loading credentials from .env.local...");
if (!existsSync(envLocalPath)) {
  console.error("❌ .env.local file not found");
  process.exit(1);
}

dotenv.config({ path: envLocalPath, override: true });

const prodKey = process.env.PROD_SUPABASE_SERVICE_ROLE_KEY;
const devUrl = process.env.VITE_SUPABASE_URL;
const devKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!prodKey) {
  console.error("❌ Missing PROD_SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

if (!devUrl || !devKey) {
  console.error("❌ Missing development credentials in .env.local");
  console.error("- VITE_SUPABASE_URL:", devUrl ? "✓" : "✗");
  console.error("- SUPABASE_SERVICE_ROLE_KEY:", devKey ? "✓" : "✗");
  process.exit(1);
}

console.log("✓ All credentials loaded");
console.log(`  Production key: ${prodKey.substring(0, 20)}...`);
console.log(`  Development URL: ${devUrl}`);
console.log();

// Verify we're not using the same database
if (prodUrl === devUrl) {
  console.error("❌ ERROR: Production and development URLs are the same!");
  console.error("   This would overwrite production data. Aborting.");
  process.exit(1);
}

// Create Supabase clients
const prodClient = createClient(prodUrl, prodKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'public' },
});

const devClient = createClient(devUrl, devKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'public' },
});

async function migrateIconCategories() {
  console.log("📁 Migrating icon categories...");

  // Fetch categories from prod
  const { data: prodCategories, error: fetchError } = await prodClient
    .from("icon_categories")
    .select("*");

  if (fetchError) {
    console.error("❌ Error fetching categories from production:", fetchError.message);
    return false;
  }

  if (!prodCategories || prodCategories.length === 0) {
    console.log("⚠️  No categories found in production");
    return true;
  }

  console.log(`  Found ${prodCategories.length} categories in production`);

  // Upsert categories to dev
  const { error: upsertError } = await devClient
    .from("icon_categories")
    .upsert(prodCategories, { onConflict: "id" });

  if (upsertError) {
    console.error("❌ Error upserting categories to development:", upsertError.message);
    return false;
  }

  console.log(`✓ Successfully migrated ${prodCategories.length} icon categories`);
  return true;
}

async function migrateIcons() {
  console.log("🎨 Migrating icons...");

  // First, get total count
  const { count: totalCount, error: countError } = await prodClient
    .from("icons")
    .select("*", { count: "exact", head: true });

  if (countError) {
    console.error("❌ Error counting icons in production:", countError.message);
    return false;
  }

  if (!totalCount || totalCount === 0) {
    console.log("⚠️  No icons found in production");
    return true;
  }

  console.log(`  Found ${totalCount} icons in production`);

  // Count existing icons in dev
  const { count: devCount } = await devClient
    .from("icons")
    .select("*", { count: "exact", head: true });

  console.log(`  Development database currently has ${devCount || 0} icons`);

  // Fetch and migrate in batches using cursor-based pagination to avoid timeout
  const BATCH_SIZE = 100;
  const estimatedBatches = Math.ceil(totalCount / BATCH_SIZE);
  let allIcons: any[] = [];
  let lastId: string | null = null;
  let batchNumber = 0;

  console.log(`  Fetching icons in ~${estimatedBatches} batches (cursor-based)...`);

  while (true) {
    batchNumber++;
    process.stdout.write(`\r  Fetching batch ${batchNumber}...`);

    let query = prodClient
      .from("icons")
      .select("*")
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);

    // Use cursor-based pagination (more efficient than offset)
    if (lastId) {
      query = query.gt("id", lastId);
    }

    const { data: batchIcons, error: fetchError } = await query;

    if (fetchError) {
      console.error(`\n❌ Error fetching batch ${batchNumber}:`, fetchError.message);
      return false;
    }

    if (!batchIcons || batchIcons.length === 0) {
      break; // No more icons to fetch
    }

    allIcons = allIcons.concat(batchIcons);
    lastId = batchIcons[batchIcons.length - 1].id;

    if (batchIcons.length < BATCH_SIZE) {
      break; // Last batch
    }

    // Small delay to be nice to the database
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  console.log(`\n  Successfully fetched ${allIcons.length} icons`);

  // Upsert icons to dev in batches
  console.log(`  Migrating to development database...`);

  // Remove search_vector (auto-generated) and set uploaded_by to null
  // (users may not exist in dev database)
  const iconsToInsert = allIcons.map(({ search_vector, ...icon }) => ({
    ...icon,
    uploaded_by: null, // Clear user reference to avoid FK constraint
  }));

  const insertBatches = Math.ceil(iconsToInsert.length / BATCH_SIZE);
  for (let i = 0; i < insertBatches; i++) {
    const start = i * BATCH_SIZE;
    const end = start + BATCH_SIZE;
    const batch = iconsToInsert.slice(start, end);

    process.stdout.write(`\r  Migrating batch ${i + 1}/${insertBatches}...`);

    const { error: upsertError } = await devClient
      .from("icons")
      .upsert(batch, { onConflict: "id" });

    if (upsertError) {
      console.error(`\n❌ Error upserting batch ${i + 1}:`, upsertError.message);
      return false;
    }

    // Small delay between inserts
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  console.log(`\n✓ Successfully migrated ${allIcons.length} icons`);

  // Show category breakdown
  const categoryCounts = allIcons.reduce((acc, icon) => {
    acc[icon.category] = (acc[icon.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log("\n  Category breakdown:");
  Object.entries(categoryCounts)
    .sort(([, a], [, b]) => b - a)
    .forEach(([category, count]) => {
      console.log(`    - ${category}: ${count} icons`);
    });

  return true;
}

async function main() {
  let success = true;

  // Migrate categories first (icons have foreign key to categories)
  success = (await migrateIconCategories()) && success;
  console.log();

  // Migrate icons
  success = (await migrateIcons()) && success;
  console.log();

  console.log("=".repeat(60));
  if (success) {
    console.log("✅ Migration completed successfully!");
  } else {
    console.log("❌ Migration completed with errors");
    process.exit(1);
  }
  console.log("=".repeat(60));
}

main();
