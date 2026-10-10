import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables for tests
// Load .env first (base configuration), then .env.local (overrides)
// This allows .env.local to override specific keys while falling back to .env for others
const envLocalPath = resolve(__dirname, '.env.local');
const envPath = resolve(__dirname, '.env');

if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

if (existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
}

/**
 * Playwright Stress Test Configuration
 * Outputs results to results-stress.json
 */
export default defineConfig({
  testDir: './tests/e2e/stress',

  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI,
  retries: 0,

  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/results-stress.json' }]
  ],

  // Output directory for test artifacts (using subdirectory to avoid cleanup conflicts)
  outputDir: 'test-results/.playwright-stress',
  timeout: 360000, // 6 minutes

  use: {
    baseURL: process.env.STRESS_TEST_URL || 'http://localhost:8080',
    testIdAttribute: 'data-testid',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 30000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'stress',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
