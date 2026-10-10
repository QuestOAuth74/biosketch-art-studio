// Check what Vite will load
import { loadEnv } from 'vite';

const mode = process.env.MODE || 'development';
const env = loadEnv(mode, process.cwd(), '');

console.log('\n=== Vite Dev Server Env Loading ===\n');
console.log('Mode:', mode);
console.log('VITE_SUPABASE_PROJECT_ID:', env.VITE_SUPABASE_PROJECT_ID);
console.log('VITE_SUPABASE_URL:', env.VITE_SUPABASE_URL);

const expected = 'eotmnuwuetomtevhpovx';
if (env.VITE_SUPABASE_PROJECT_ID === expected) {
  console.log(`\n✓ CORRECT: Vite dev server will use ${expected}`);
} else {
  console.log(`\n✗ WRONG: Vite dev server will use ${env.VITE_SUPABASE_PROJECT_ID} instead of ${expected}`);
}
