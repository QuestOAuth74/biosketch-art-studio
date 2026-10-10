import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mimic playwright.config.ts loading
const envLocalPath = resolve(__dirname, '.env.local');
const envPath = resolve(__dirname, '.env');

console.log('\n=== Playwright Config Env Loading (mimicking playwright.config.ts) ===\n');

if (existsSync(envLocalPath)) {
  console.log('✓ .env.local exists - loading it FIRST');
  config({ path: envLocalPath });
  console.log('  PROJECT_ID from .env.local:', process.env.VITE_SUPABASE_PROJECT_ID);
} else if (existsSync(envPath)) {
  console.log('✓ .env exists - loading it as fallback');
  config({ path: envPath });
  console.log('  PROJECT_ID from .env:', process.env.VITE_SUPABASE_PROJECT_ID);
}

console.log('\n=== Final Values in Playwright Test Process ===');
console.log('VITE_SUPABASE_PROJECT_ID:', process.env.VITE_SUPABASE_PROJECT_ID);
console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL);

const expected = 'eotmnuwuetomtevhpovx';
const actual = process.env.VITE_SUPABASE_PROJECT_ID;

if (actual === expected) {
  console.log(`\n✓ CORRECT: Tests will use ${expected}`);
} else {
  console.log(`\n✗ WRONG: Tests will use ${actual} instead of ${expected}`);
}
