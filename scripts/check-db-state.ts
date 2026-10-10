import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
// Load .env first (base configuration), then .env.local (overrides)
// This allows .env.local to override specific keys while falling back to .env for others
const envLocalPath = resolve(__dirname, "../.env.local");
const envPath = resolve(__dirname, "../.env");

if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

if (existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkState() {
  const { data: categories } = await supabase.from('icon_categories').select('id, name');
  console.log(`Icon categories count: ${categories?.length}`);
  console.log('Categories:', categories?.map(c => c.id).join(', '));

  const { data: icons } = await supabase.from('icons').select('id, category');
  console.log(`\nIcons count: ${icons?.length}`);

  // Count icons per category
  const iconsByCategory = icons?.reduce((acc: Record<string, number>, icon) => {
    acc[icon.category] = (acc[icon.category] || 0) + 1;
    return acc;
  }, {});
  console.log('\nIcons by category:', iconsByCategory);
}

checkState();
