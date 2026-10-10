import { defineConfig, devices } from "@playwright/test";
import * as dotenv from "dotenv";
import { existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables for tests
// Load .env first (base configuration), then .env.local (overrides)
// This allows .env.local to override specific keys while falling back to .env for others
const envLocalPath = resolve(__dirname, ".env.local");
const envPath = resolve(__dirname, ".env");

if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

if (existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
}

/**
 * Playwright E2E Test Configuration
 *
 * Tests authentication flows including:
 * - Signup and email verification
 * - Login and session management
 * - Unverified email handling
 * - Password reset flow
 */
export default defineConfig({
  testDir: "./tests/e2e",

  // Run tests sequentially to avoid rate limiting
  fullyParallel: false,
  workers: 1,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Reporter to use - list reporter with detailed output
  reporter: [["list"], ["json", { outputFile: "test-results/results.json" }]],

  // Output directory for test artifacts (screenshots, traces, videos)
  // Using subdirectory to avoid cleaning up vitest JSON files
  outputDir: "test-results/.playwright",

  // Shared settings for all projects
  use: {
    // Base URL for the application
    baseURL: process.env.BASE_URL || "http://localhost:8080",

    // Test ID attribute for getByTestId()
    testIdAttribute: "data-testid",

    // Collect trace on failure
    trace: "on-first-retry",

    // Screenshot on failure
    screenshot: "only-on-failure",
  },

  // Configure projects for major browsers
  projects: [
    {
      name: "chromium",
      timeout: 120000, // 120 seconds default timeout
      use: { ...devices["Desktop Chrome"] },
      testIgnore: [
        "**/stress/**", // Performance/load tests (separate project)
        "**/diagnostics/**", // Environment verification (separate project)
      ],
      // Extended timeout for specific tests that involve multiple operations
      grep: /^(?!.*(User can open and edit existing project|Changes auto-save to database|User can view and rollback to previous version|Project duplication creates independent copy))/,
    },
    {
      name: "chromium-extended",
      timeout: 60000, // 60 seconds for tests requiring multiple saves/navigation
      use: { ...devices["Desktop Chrome"] },
      grep: /(User can open and edit existing project|Changes auto-save to database|User can view and rollback to previous version|Project duplication creates independent copy)/,
    },
    {
      name: "stress",
      testMatch: "**/stress/**/*.spec.ts",
      timeout: 360000, // 6 minutes total test timeout (4 min test + 2 min setup/cleanup)
      use: {
        ...devices["Desktop Chrome"],
        actionTimeout: 30000, // 30s for stress test actions
        navigationTimeout: 30000, // 30s for page navigation
      },
      retries: 0, // No retries for stress tests
      workers: 1, // Always run stress tests sequentially
    },
    {
      name: "diagnostics",
      testMatch: "**/diagnostics/**/*.spec.ts",
      use: { ...devices["Desktop Chrome"] },
      retries: 0,
    },
  ],

  // Note: Tests expect dev server already running at http://localhost:8080
  // Start server manually with: npm run dev
});
