#!/usr/bin/env tsx
/**
 * Script to switch between Supabase environments (dev/prod)
 * Updates supabase/config.toml with the correct project_id
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const ENV_CONFIGS = {
  dev: 'eotmnuwuetomtevhpovx',
  prod: 'tljsbmpglwmzyaoxsqyj',
} as const;

type Environment = keyof typeof ENV_CONFIGS;

const env = process.argv[2] as Environment;

if (!env || !ENV_CONFIGS[env]) {
  console.error('Usage: npm run db:switch -- [dev|prod]');
  console.error('Or use: npm run db:use-dev / npm run db:use-prod');
  process.exit(1);
}

const configPath = resolve(process.cwd(), 'supabase/config.toml');
const projectId = ENV_CONFIGS[env];

try {
  let config = readFileSync(configPath, 'utf-8');

  // Replace project_id line
  config = config.replace(
    /^project_id\s*=\s*.*$/m,
    `project_id = "${projectId}"`
  );

  writeFileSync(configPath, config, 'utf-8');

  console.log(`✅ Switched to ${env.toUpperCase()} environment`);
  console.log(`   Project ID: ${projectId}`);
} catch (error) {
  console.error('❌ Failed to update config.toml:', error);
  process.exit(1);
}
