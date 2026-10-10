import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envLocalPath = resolve(__dirname, "../.env.local");
const envPath = resolve(__dirname, "../.env");
if (existsSync(envPath)) dotenv.config({ path: envPath });
if (existsSync(envLocalPath)) dotenv.config({ path: envLocalPath, override: true });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE env vars.");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  // Pull all generation rows (user_id, mode). Small-to-mid table so
  // client-side aggregation is fine and avoids adding a DB function.
  let all: { user_id: string }[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("ai_generations")
      .select("user_id")
      .range(from, from + pageSize - 1);
    if (error) { console.error(error); process.exit(1); }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  console.log(`Total ai_generations rows: ${all.length}`);

  const counts = new Map<string, number>();
  for (const row of all) {
    counts.set(row.user_id, (counts.get(row.user_id) || 0) + 1);
  }

  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Resolve identities via auth admin API (email is authoritative;
  // profiles table often lacks email).
  const results = [];
  for (const [userId, total] of top) {
    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    const email = userData?.user?.email ?? "(unknown)";
    const created = userData?.user?.created_at ?? "";
    results.push({ email, total, userId, created });
  }

  console.log("\nTop 5 AI credit users (by generation count):\n");
  console.table(
    results.map((r, i) => ({
      rank: i + 1,
      email: r.email,
      generations: r.total,
      signed_up: r.created?.slice(0, 10),
    }))
  );
}

main().catch((e) => { console.error(e); process.exit(1); });
