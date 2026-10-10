# Test Report Generation

This document explains how the test report generation system works in this project, combining Playwright E2E tests and Vitest unit/integration tests into a unified test report.

## Overview

The test report system aggregates results from multiple test suites into a single markdown and PDF report. The system is designed to prevent test results from overwriting each other by using separate output files for each test suite.

## Architecture

### Test Suites

The project includes three main automated test suites:

1. **Database Tests** (Vitest) - Unit/integration tests for database operations
2. **Edge Function Tests** (Vitest) - Tests for Supabase edge functions
3. **E2E Tests** (Playwright) - End-to-end browser tests

### Report Generation Flow

```
┌─────────────────┐
│  npm run test   │
└────────┬────────┘
         │
         ├──► test:unit ──────────► vitest-database.json
         │
         ├──► test:edge-functions ─► vitest-edge-functions.json
         │
         ├──► test:e2e ────────────► results.json
         │
         └──► test:report ─────────► Combines all → test-report.md + test-report.pdf
```

## Key Configuration

### 1. Vitest Configuration

**File:** `vitest.config.ts`

```typescript
export default defineConfig({
  test: {
    reporters: ['default', 'json'],
    // No outputFile specified here - allows CLI override
  }
});
```

**Key Points:**
- Uses both `default` (console) and `json` reporters
- **Does not specify `outputFile` in config** - this is critical for allowing each test suite to output to its own file via CLI flags
- Comment on line 45-46 explicitly notes: "JSON output location specified per suite via CLI"

### 2. Playwright Configuration

**File:** `playwright.config.ts`

```typescript
export default defineConfig({
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  outputDir: 'test-results/.playwright',
});
```

**Key Points:**
- **Reporter:** Outputs JSON to `test-results/results.json`
- **Output Directory:** Test artifacts (screenshots, traces, videos) go to `test-results/.playwright` subdirectory
- The subdirectory strategy prevents Playwright from cleaning up Vitest JSON files (see line 54 comment)

### 3. Package.json Scripts

**File:** `package.json`

```json
{
  "scripts": {
    "test:unit": "vitest run tests/database --reporter=default --reporter=json --outputFile=./test-results/vitest-database.json",
    "test:edge-functions": "vitest run tests/edge-functions --reporter=default --reporter=json --outputFile=./test-results/vitest-edge-functions.json",
    "test:e2e": "playwright test --project=chromium",
    "test:report": "npx tsx scripts/generate-test-report.ts",
    "test": "npm run test:unit && npm run test:edge-functions && npm run test:e2e && npm run test:report"
  }
}
```

**Key Points:**
- Each Vitest suite uses the `--outputFile` CLI flag to specify a **unique** JSON output file
- This is the mechanism that prevents overwrites between Vitest suites
- Playwright uses its config file to specify output location
- The main `test` script runs all suites sequentially, then generates the report

## Preventing Result Overwrites

The system uses three strategies to prevent test results from overwriting each other:

### Strategy 1: Unique JSON Output Files

Each test suite outputs to its own JSON file:
- Database tests → `test-results/vitest-database.json`
- Edge function tests → `test-results/vitest-edge-functions.json`
- E2E tests → `test-results/results.json`

### Strategy 2: CLI Override for Vitest

The `vitest.config.ts` intentionally **omits** the `outputFile` configuration, allowing each test script to specify its own via the `--outputFile` CLI flag.

### Strategy 3: Separate Artifact Directory for Playwright

Playwright's test artifacts (screenshots, traces, videos) are stored in `test-results/.playwright/` to avoid interfering with JSON files in the parent directory.

## Report Generation Script

**File:** `scripts/generate-test-report.ts`

The script performs the following steps:

1. **Read JSON Files:** Loads all test result JSON files from `test-results/` directory
   ```typescript
   const databasePath = resolve(testResultsDir, 'vitest-database.json');
   const edgeFunctionsPath = resolve(testResultsDir, 'vitest-edge-functions.json');
   const e2ePath = resolve(testResultsDir, 'results.json');
   ```

2. **Parse Vitest Results:** Extracts test data from Vitest JSON format
   - Iterates through `testResults` array
   - Extracts `assertionResults` for individual test cases
   - Builds full test names from `ancestorTitles` array

3. **Parse Playwright Results:** Extracts test data from Playwright JSON format
   - Recursively processes nested `suites` structure
   - Extracts `specs` and their `results`
   - Calculates totals and durations

4. **Generate Markdown Report:**
   - Creates summary table with pass rates
   - Lists all tests with status icons (✅/❌/⏭️)
   - Includes file names and durations
   - Saves to `test-results/test-report.md`

5. **Generate PDF Report:**
   - Converts markdown to PDF using `md-to-pdf` library
   - Executes: `node scripts/md-to-pdf.js test-report.md test-report.pdf`
   - Saves to `test-results/test-report.pdf`

## Usage

### Running Tests and Generating Report

```bash
# Run all tests and generate report
npm run test

# Run individual test suites
npm run test:unit
npm run test:edge-functions
npm run test:e2e

# Generate report from existing results
npm run test:report
```

### Output Files

After running tests, you'll find:
- `test-results/vitest-database.json` - Raw database test results
- `test-results/vitest-edge-functions.json` - Raw edge function test results
- `test-results/results.json` - Raw E2E test results
- `test-results/.playwright/` - E2E test artifacts (screenshots, traces)
- `test-results/test-report.md` - Generated markdown report
- `test-results/test-report.pdf` - Generated PDF report

## Replicating in Another Repository

To replicate this configuration in another project:

1. **Install dependencies:**
   ```bash
   npm install --save-dev @playwright/test vitest tsx md-to-pdf
   ```

2. **Create Vitest config** (`vitest.config.ts`):
   - Set reporters to `['default', 'json']`
   - **Do not specify `outputFile`** - leave it for CLI override

3. **Create Playwright config** (`playwright.config.ts`):
   - Set reporter to include JSON with specific `outputFile`
   - Set `outputDir` to a subdirectory (e.g., `test-results/.playwright`)

4. **Add test scripts to package.json:**
   - Use `--outputFile` flag for each Vitest suite with unique filenames
   - Ensure each suite outputs to a different JSON file

5. **Copy the report generation script:**
   - Copy `scripts/generate-test-report.ts`
   - Update file paths if your test suite names differ
   - Adjust parsing logic if using different test structures

6. **Create test:report script:**
   - Add `"test:report": "npx tsx scripts/generate-test-report.ts"`
   - Chain it after your test suites in the main test script

## Critical Configuration Points

✅ **DO:**
- Use unique `--outputFile` paths for each Vitest suite
- Omit `outputFile` from `vitest.config.ts` to allow CLI override
- Place Playwright artifacts in a subdirectory
- Run test:report after all test suites complete

❌ **DON'T:**
- Specify `outputFile` in `vitest.config.ts` (prevents CLI override)
- Use the same output file for multiple test suites
- Place Playwright `outputDir` in the same directory as JSON files (may cause cleanup issues)
- Run test suites in parallel if they share resources (database, etc.)

## Troubleshooting

**Problem:** Test results are being overwritten

**Solution:** Ensure each test suite uses a unique `--outputFile` path

---

**Problem:** Report script can't find JSON files

**Solution:** Check that test suites have completed successfully and JSON files exist in `test-results/` directory

---

**Problem:** Playwright cleans up Vitest JSON files

**Solution:** Ensure Playwright's `outputDir` is set to a subdirectory (e.g., `test-results/.playwright`)
