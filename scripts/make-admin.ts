import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables with fallback
const envLocalPath = resolve(__dirname, "../.env.local");
const envPath = resolve(__dirname, "../.env");

let envLoaded = false;

if (existsSync(envPath)) {
  console.log("Loading base environment from .env");
  dotenv.config({ path: envPath });
  envLoaded = true;
}

if (existsSync(envLocalPath)) {
  console.log("Loading environment overrides from .env.local");
  dotenv.config({ path: envLocalPath, override: true });
  envLoaded = true;
}

if (!envLoaded) {
  console.warn("⚠ No .env.local or .env file found");
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing required environment variables:");
  console.error("- VITE_SUPABASE_URL:", supabaseUrl ? "✓" : "✗");
  console.error("- SUPABASE_SERVICE_ROLE_KEY:", serviceRoleKey ? "✓" : "✗");
  process.exit(1);
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'apikey': serviceRoleKey,
    },
  },
});

async function makeAdmin(email: string) {
  console.log(`\nMaking user with email "${email}" an admin...\n`);

  // Find user by email in profiles table
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("email", email)
    .single();

  if (profileError || !profile) {
    console.error(`✗ User with email "${email}" not found in profiles table`);
    console.error("Error:", profileError?.message);
    process.exit(1);
  }

  console.log(`✓ Found user: ${profile.full_name || email} (${profile.id})`);

  // Delete any existing roles for the user
  const { error: deleteError } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", profile.id);

  if (deleteError) {
    console.error("✗ Error removing existing roles:", deleteError.message);
    process.exit(1);
  }

  // Insert admin role
  const { error: insertError } = await supabase
    .from("user_roles")
    .insert({
      user_id: profile.id,
      role: "admin",
    });

  if (insertError) {
    console.error("✗ Error granting admin role:", insertError.message);
    process.exit(1);
  }

  console.log(`✓ Successfully granted admin role to ${email}`);
  console.log("\nDone!");
}

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.error("Usage: npm run make-admin <email>");
  console.error("Example: npm run make-admin test@gazzola.dev");
  process.exit(1);
}

// Validate email format
if (!email.includes("@")) {
  console.error("Invalid email format");
  process.exit(1);
}

makeAdmin(email);
