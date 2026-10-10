import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Type definitions for Vitest test result structures
interface VitestAssertionResult {
  ancestorTitles: string[];
  title: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  failureMessages: string[];
}

interface VitestTestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  assertionResults: VitestAssertionResult[];
}

interface VitestResults {
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  numPendingTests: number;
  startTime: number;
  success: boolean;
  testResults: VitestTestResult[];
}

// Type definitions for Playwright test result structures
interface PlaywrightTestResult {
  status: string;
  duration: number;
  errors: any[];
}

interface PlaywrightTest {
  status: string;
  results: PlaywrightTestResult[];
}

interface PlaywrightSpec {
  title: string;
  ok: boolean;
  tests: PlaywrightTest[];
  file: string;
  line: number;
}

interface PlaywrightSuite {
  title: string;
  file: string;
  suites?: PlaywrightSuite[];
  specs?: PlaywrightSpec[];
}

interface PlaywrightResults {
  config: any;
  suites: PlaywrightSuite[];
}

// Parsed test result interface
interface ParsedTest {
  name: string;
  status: string;
  duration: number;
  file: string;
}

interface ParsedSuiteResults {
  suiteName: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  tests: ParsedTest[];
}

// Helper to safely read JSON file
function readJsonFile<T>(filePath: string): T | null {
  if (!existsSync(filePath)) {
    console.warn(`Warning: ${filePath} not found`);
    return null;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return null;
  }
}

// Parse Vitest results
function parseVitestResults(results: VitestResults | null, suiteName: string): ParsedSuiteResults {
  if (!results) {
    return {
      suiteName,
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      tests: [],
    };
  }

  const tests: ParsedTest[] = [];

  results.testResults.forEach((fileResult) => {
    fileResult.assertionResults.forEach((test) => {
      const fullName = [...test.ancestorTitles, test.title].join(' > ');
      tests.push({
        name: fullName,
        status: test.status,
        duration: test.duration,
        file: fileResult.name,
      });
    });
  });

  return {
    suiteName,
    total: results.numTotalTests,
    passed: results.numPassedTests,
    failed: results.numFailedTests,
    skipped: results.numPendingTests,
    duration: 0, // Vitest doesn't provide total duration in JSON
    tests,
  };
}

// Parse Playwright results
function parsePlaywrightResults(results: PlaywrightResults | null, suiteName: string = 'E2E Tests'): ParsedSuiteResults {
  if (!results) {
    return {
      suiteName,
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      tests: [],
    };
  }

  const tests: ParsedTest[] = [];
  let totalPassed = 0;
  let totalFailed = 0;
  let totalDuration = 0;

  // Recursively extract specs from suites
  function extractSpecs(suite: PlaywrightSuite) {
    if (suite.specs) {
      suite.specs.forEach((spec) => {
        const specTest = spec.tests[0]; // Playwright wraps each spec
        const result = specTest.results[0];
        const isPassed = result.status === 'passed';
        const fullName = `${suite.title} > ${spec.title}`;

        if (isPassed) totalPassed++;
        else totalFailed++;
        totalDuration += result.duration;

        tests.push({
          name: fullName,
          status: result.status,
          duration: result.duration,
          file: spec.file,
        });
      });
    }

    if (suite.suites) {
      suite.suites.forEach(extractSpecs);
    }
  }

  results.suites.forEach(extractSpecs);

  return {
    suiteName,
    total: tests.length,
    passed: totalPassed,
    failed: totalFailed,
    skipped: 0,
    duration: totalDuration,
    tests,
  };
}

// Parse manual tests from documentation
function parseManualTests(): ParsedSuiteResults {
  // Manual tests from Milestone 1 and Milestone 2 documentation
  const manualTests: ParsedTest[] = [
    // Milestone 1 - Database & Authentication
    { name: 'M1-DB-1: Fresh Database Seed', status: 'passed', duration: 0, file: 'milestone-1' },
    { name: 'M1-EM-1: Signup Verification Email', status: 'passed', duration: 0, file: 'milestone-1' },
    { name: 'M1-EM-2: Verification Link Functionality', status: 'passed', duration: 0, file: 'milestone-1' },
    { name: 'M1-EM-3: Password Reset Email', status: 'passed', duration: 0, file: 'milestone-1' },
    { name: 'M1-EM-4: Password Reset Link Functionality', status: 'passed', duration: 0, file: 'milestone-1' },

    // Milestone 2 - Tool Fixes: Eraser
    { name: 'M2-TF-1: User can erase part of an object on canvas', status: 'pending', duration: 0, file: 'milestone-2' },
    { name: 'M2-TF-2: Moving erased object maintains the erased mask in correct position', status: 'pending', duration: 0, file: 'milestone-2' },
    { name: 'M2-TF-3: Erased state persists after save and reload', status: 'pending', duration: 0, file: 'milestone-2' },

    // Milestone 2 - Tool Fixes: Curved Lines
    { name: 'M2-TF-4: Exported PNG does not contain green control points or guide lines', status: 'pending', duration: 0, file: 'milestone-2' },
    { name: 'M2-TF-5: Exported SVG does not contain green control points or guide lines', status: 'pending', duration: 0, file: 'milestone-2' },
    { name: 'M2-TF-6: Curved line control points remain attached during manipulation', status: 'pending', duration: 0, file: 'milestone-2' },
    { name: 'M2-TF-7: Curved line control points move smoothly during manipulation', status: 'pending', duration: 0, file: 'milestone-2' },
    { name: 'M2-TF-8: Guide lines update in real-time during curve editing', status: 'pending', duration: 0, file: 'milestone-2' },

    // Milestone 2 - Tool Fixes: Shape Opacity
    { name: 'M2-TF-9: Set shape opacity to 50%, deselect, reselect - opacity slider shows 50%', status: 'pending', duration: 0, file: 'milestone-2' },
    { name: 'M2-TF-10: Set shape opacity, save project, reload - opacity value preserved', status: 'pending', duration: 0, file: 'milestone-2' },

    // Milestone 2 - Tool Fixes: Rotation Handle
    { name: 'M2-TF-11: Rotation handle cursor changes appropriately (grab → grabbing during drag)', status: 'pending', duration: 0, file: 'milestone-2' },

    // Milestone 2 - Advanced Path Editing
    { name: 'M2-APE-1: User can modify path by adding and deleting anchor points', status: 'pending', duration: 0, file: 'milestone-2' },
    { name: 'M2-APE-2: User can toggle anchor point between smooth and corner types', status: 'pending', duration: 0, file: 'milestone-2' },
    { name: 'M2-APE-3: Crossing lines display visual jump indicator (arc/gap/bridge)', status: 'pending', duration: 0, file: 'milestone-2' },
    { name: 'M2-APE-4: Path simplification reduces anchor point count', status: 'pending', duration: 0, file: 'milestone-2' },
    { name: 'M2-APE-5: Freehand drawn lines are converted to smooth curves', status: 'pending', duration: 0, file: 'milestone-2' },
    { name: 'M2-APE-6: Freehand strokes visually smooth to professional curves', status: 'pending', duration: 0, file: 'milestone-2' },
    { name: 'M2-APE-7: Smoothing intensity control affects smoothness result', status: 'pending', duration: 0, file: 'milestone-2' },

    // Milestone 2 - Smart Distribution & Spacing
    { name: 'M2-SDS-1: Distribute horizontally creates equal spacing between 3+ objects', status: 'pending', duration: 0, file: 'milestone-2' },
    { name: 'M2-SDS-2: Distribute vertically creates equal spacing between 3+ objects', status: 'pending', duration: 0, file: 'milestone-2' },
    { name: 'M2-SDS-3: Match width makes selected objects same width', status: 'pending', duration: 0, file: 'milestone-2' },
    { name: 'M2-SDS-4: Match height makes selected objects same height', status: 'pending', duration: 0, file: 'milestone-2' },
    { name: 'M2-SDS-5: Spacing input field accepts value and applies exact spacing', status: 'pending', duration: 0, file: 'milestone-2' },
    { name: 'M2-SDS-6: Real-time dimension labels appear between objects during drag', status: 'pending', duration: 0, file: 'milestone-2' },
    { name: 'M2-SDS-7: Visual spacing guides display correct gap measurements', status: 'pending', duration: 0, file: 'milestone-2' },
    { name: 'M2-SDS-8: Smart spacing suggestions appear when nearby gaps are similar', status: 'pending', duration: 0, file: 'milestone-2' },

    // Milestone 2 - Image Masking & Filters
    { name: 'M2-IMF-1: User can apply shape mask (circle or rounded rectangle) to image', status: 'pending', duration: 0, file: 'milestone-2' },
    { name: 'M2-IMF-2: Mask can be edited after application', status: 'pending', duration: 0, file: 'milestone-2' },
    { name: 'M2-IMF-3: Original image is preserved when mask is removed (non-destructive)', status: 'pending', duration: 0, file: 'milestone-2' },
    { name: 'M2-IMF-4: Brightness, contrast, and saturation adjustments are applied to images', status: 'pending', duration: 0, file: 'milestone-2' },
    { name: 'M2-IMF-5: Image adjustments persist after save and reload', status: 'pending', duration: 0, file: 'milestone-2' },
    { name: 'M2-IMF-6: Grayscale and sepia filters are applied to images', status: 'pending', duration: 0, file: 'milestone-2' },
    { name: 'M2-IMF-7: Scientific color map filter is applied to images', status: 'pending', duration: 0, file: 'milestone-2' },

    // Milestone 2 - Icon Library
    { name: 'M2-IL-1: User can browse and search icons', status: 'pending', duration: 0, file: 'milestone-2' },
    { name: 'M2-IL-2: User can drag icon onto canvas', status: 'pending', duration: 0, file: 'milestone-2' },
    { name: 'M2-IL-3: Icons display with correct colors (not black) in library and on canvas', status: 'pending', duration: 0, file: 'milestone-2' },
    { name: 'M2-IL-4: Icon library visual appearance - all icons show with correct colors', status: 'pending', duration: 0, file: 'milestone-2' },
    { name: 'M2-IL-5: Icon library performance - search returns results quickly (<500ms)', status: 'pending', duration: 0, file: 'milestone-2' },
    { name: 'M2-IL-6: Icon library performance - scrolling is smooth without janking', status: 'pending', duration: 0, file: 'milestone-2' },
    { name: 'M2-IL-7: Progressive loading displays placeholders while icons load', status: 'pending', duration: 0, file: 'milestone-2' },

    // Milestone 2 - Export
    { name: 'M2-EXP-1: User can export with transparent background', status: 'pending', duration: 0, file: 'milestone-2' },
    { name: 'M2-EXP-2: Selection-only export includes only selected objects', status: 'pending', duration: 0, file: 'milestone-2' },
    { name: 'M2-EXP-3: PDF export contains vector graphics (text remains selectable in PDF)', status: 'pending', duration: 0, file: 'milestone-2' },
    { name: 'M2-EXP-4: Export quality visual verification (PDF, PNG at different DPIs)', status: 'pending', duration: 0, file: 'milestone-2' },
    { name: 'M2-EXP-5: CMYK export color accuracy compared to RGB', status: 'pending', duration: 0, file: 'milestone-2' },
  ];

  // Count statuses
  const passed = manualTests.filter(t => t.status === 'passed').length;
  const pending = manualTests.filter(t => t.status === 'pending').length;

  return {
    suiteName: 'Manual Tests',
    total: manualTests.length,
    passed: passed,
    failed: 0,
    skipped: pending,
    duration: 0,
    tests: manualTests,
  };
}

// Generate markdown report
function generateMarkdownReport(
  databaseResults: ParsedSuiteResults,
  edgeFunctionResults: ParsedSuiteResults,
  e2eResults: ParsedSuiteResults,
  stressResults: ParsedSuiteResults,
  manualResults: ParsedSuiteResults
): string {
  const totalTests =
    databaseResults.total + edgeFunctionResults.total + e2eResults.total + stressResults.total + manualResults.total;
  const totalPassed =
    databaseResults.passed + edgeFunctionResults.passed + e2eResults.passed + stressResults.passed + manualResults.passed;
  const totalFailed =
    databaseResults.failed + edgeFunctionResults.failed + e2eResults.failed + stressResults.failed + manualResults.failed;
  const totalSkipped =
    databaseResults.skipped + edgeFunctionResults.skipped + e2eResults.skipped + stressResults.skipped + manualResults.skipped;

  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const statusIcon = totalFailed === 0 ? '✅' : '❌';

  let markdown = `# Test Results Report\n\n`;
  markdown += `**Generated**: ${date}\n\n`;
  markdown += `**Overall Status**: ${statusIcon} ${totalFailed === 0 ? 'PASSED' : 'FAILED'}\n\n`;
  markdown += `---\n\n`;
  markdown += `## Summary\n\n`;
  markdown += `| Test Suite | Passed | Failed | Skipped | Pass Rate |\n`;
  markdown += `|------------|--------|--------|---------|----------|\n`;

  // Helper to add suite row
  const addSuiteRow = (suiteData: ParsedSuiteResults) => {
    if (suiteData.total > 0) {
      const passRate = suiteData.total > 0 ? ((suiteData.passed / suiteData.total) * 100).toFixed(1) : '0.0';
      markdown += `| ${suiteData.suiteName} | ${suiteData.passed} | ${suiteData.failed} | ${suiteData.skipped} | ${passRate}% |\n`;
    }
  };

  addSuiteRow(databaseResults);
  addSuiteRow(edgeFunctionResults);
  addSuiteRow(e2eResults);
  addSuiteRow(stressResults);
  addSuiteRow(manualResults);

  // Add totals row
  const totalPassRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : '0.0';
  markdown += `| **Total** | **${totalPassed}** | **${totalFailed}** | **${totalSkipped}** | **${totalPassRate}%** |\n\n`;

  // Helper to generate suite section
  function generateSuiteSection(suiteData: ParsedSuiteResults) {
    const { suiteName, total, passed, failed, skipped, tests } = suiteData;

    if (total === 0) {
      return; // Skip empty suites
    }

    const icon = failed === 0 ? '✅' : '❌';

    markdown += `### ${icon} ${suiteName}\n\n`;
    markdown += `**Tests**: ${passed}/${total} passed`;
    if (failed > 0) markdown += `, ${failed} failed`;
    if (skipped > 0) markdown += `, ${skipped} skipped`;
    markdown += `\n\n`;

    if (tests.length > 0) {
      tests.forEach((test) => {
        const statusEmoji =
          test.status === 'passed'
            ? '✅'
            : test.status === 'failed'
            ? '❌'
            : '⏭️';
        const durationStr = test.duration ? ` (${test.duration}ms)` : '';
        const fileName = test.file.split('/').pop() || test.file;

        markdown += `- ${statusEmoji} **${test.name}**${durationStr} - \`${fileName}\`\n`;
      });

      markdown += `\n`;
    }
  }

  markdown += `---\n\n`;
  markdown += `## Test Suites\n\n`;

  generateSuiteSection(databaseResults);
  generateSuiteSection(edgeFunctionResults);
  generateSuiteSection(e2eResults);

  // Add stress test section with conditional messaging
  if (stressResults.total > 0) {
    generateSuiteSection(stressResults);
  } else {
    markdown += `### ⚡ Stress Tests (Optional)\n\n`;
    markdown += `**Not run** - Use \`npm run test:all\` to include stress tests\n\n`;
  }

  // Add manual tests section
  generateSuiteSection(manualResults);

  return markdown;
}

// Main execution
async function main() {
  const projectRoot = resolve(__dirname, '..');
  const testResultsDir = resolve(projectRoot, 'test-results');

  console.log('📊 Generating test report...\n');

  // Read all test result files
  const databasePath = resolve(testResultsDir, 'vitest-database.json');
  const edgeFunctionsPath = resolve(testResultsDir, 'vitest-edge-functions.json');
  const e2ePath = resolve(testResultsDir, 'results.json');

  const databaseJson = readJsonFile<VitestResults>(databasePath);
  const edgeFunctionsJson = readJsonFile<VitestResults>(edgeFunctionsPath);
  const e2eJson = readJsonFile<PlaywrightResults>(e2ePath);
  const stressPath = resolve(testResultsDir, 'results-stress.json');
  const stressJson = readJsonFile<PlaywrightResults>(stressPath);

  // Parse results
  const databaseResults = parseVitestResults(databaseJson, 'Database Tests');
  const edgeFunctionResults = parseVitestResults(edgeFunctionsJson, 'Edge Function Tests');
  const e2eResults = parsePlaywrightResults(e2eJson, 'E2E Tests');
  const stressResults = parsePlaywrightResults(stressJson, 'Stress Tests');
  const manualResults = parseManualTests();

  // Generate markdown
  const markdown = generateMarkdownReport(databaseResults, edgeFunctionResults, e2eResults, stressResults, manualResults);

  // Write report
  const reportPath = resolve(testResultsDir, 'test-report.md');
  writeFileSync(reportPath, markdown, 'utf-8');

  console.log(`✅ Test report generated: ${reportPath}\n`);

  // Generate PDF from markdown report
  try {
    const pdfPath = reportPath.replace(/\.md$/, '.pdf');
    console.log('📄 Generating PDF report...');
    execSync(`node ${resolve(__dirname, 'md-to-pdf.js')} ${reportPath} ${pdfPath}`, {
      stdio: 'inherit'
    });
    console.log(`✅ PDF report generated: ${pdfPath}\n`);
  } catch (error) {
    console.error('⚠️  Warning: Failed to generate PDF report:', error instanceof Error ? error.message : error);
    console.log('   Markdown report is still available\n');
  }

  // Summary to console
  const total = databaseResults.total + edgeFunctionResults.total + e2eResults.total + stressResults.total + manualResults.total;
  const passed = databaseResults.passed + edgeFunctionResults.passed + e2eResults.passed + stressResults.passed + manualResults.passed;
  const failed = databaseResults.failed + edgeFunctionResults.failed + e2eResults.failed + stressResults.failed + manualResults.failed;

  console.log(`📈 Summary:`);
  console.log(`   Total: ${total} tests`);
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Pass Rate: ${total > 0 ? ((passed / total) * 100).toFixed(2) : 0}%`);
}

main().catch((error) => {
  console.error('Error generating test report:', error);
  process.exit(1);
});
