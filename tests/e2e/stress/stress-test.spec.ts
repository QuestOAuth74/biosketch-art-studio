import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';
import { getStressTestConfig, UserContext, UserType } from './stress-config';
import { MetricsCollector } from './metrics-collector';
import {
  AnonymousUserSimulator,
  AuthenticatedUserSimulator,
  AdminUserSimulator,
} from './user-simulator';
import {
  createTestUser,
  deleteTestUser,
  createServiceRoleClient,
} from '../../utils/supabase-test-client';
import { AuthTestIds } from '@/lib/test-ids';

test.describe('Stress Test - Concurrent User Load', () => {
  test('should handle concurrent users under load without I/O timeouts', async ({
    browser,
  }) => {
    const config = getStressTestConfig();
    const metricsCollector = new MetricsCollector(config);
    const userContexts: UserContext[] = [];
    const testUsers: any[] = [];

    console.log('\n🚀 Starting Stress Test');
    console.log(`📊 Configuration:`);
    console.log(`   - Base URL: ${config.baseUrl}`);
    console.log(`   - Duration: ${config.duration}s`);
    console.log(`   - Anonymous users: ${config.anonymousUsers}`);
    console.log(`   - Authenticated users: ${config.authenticatedUsers}`);
    console.log(`   - Admin users: ${config.adminUsers}`);
    console.log(
      `   - Total contexts: ${config.anonymousUsers + config.authenticatedUsers + config.adminUsers}\n`
    );

    try {
      // ═══════════════════════════════════════════════════════════
      // SETUP PHASE: Create all user contexts
      // ═══════════════════════════════════════════════════════════
      console.log('🔧 Setting up user contexts...');

      // Create anonymous users
      for (let i = 0; i < config.anonymousUsers; i++) {
        const context = await browser.newContext({
          baseURL: config.baseUrl,
          // Lightweight context options to reduce resource usage
          viewport: { width: 1280, height: 720 }, // Smaller viewport
          ignoreHTTPSErrors: true,
          // Block unnecessary resources
          // Note: Images/fonts still load but are deprioritized by the browser
        });
        await context.route('**/*.{png,jpg,jpeg,gif,svg,webp,ico}', route => route.abort()); // Block images
        await context.route('**/*.{woff,woff2,ttf,eot}', route => route.abort()); // Block fonts
        const page = await context.newPage();

        // Setup console logging
        setupConsoleTracking(page, `anon-${i}`, metricsCollector);

        // Setup network monitoring
        setupNetworkMonitoring(page, `anon-${i}`, metricsCollector);

        userContexts.push({
          id: `anon-${i}`,
          type: 'anonymous',
          context,
          page,
        });
      }

      // Create authenticated users
      for (let i = 0; i < config.authenticatedUsers; i++) {
        const testUser = await createTestUser(`stress-auth-${i}`);
        testUsers.push(testUser);

        const context = await browser.newContext({
          baseURL: config.baseUrl,
          // Lightweight context options to reduce resource usage
          viewport: { width: 1280, height: 720 }, // Smaller viewport
          ignoreHTTPSErrors: true,
        });
        await context.route('**/*.{png,jpg,jpeg,gif,svg,webp,ico}', route => route.abort()); // Block images
        await context.route('**/*.{woff,woff2,ttf,eot}', route => route.abort()); // Block fonts
        const page = await context.newPage();

        // Setup monitoring
        setupConsoleTracking(page, `auth-${i}`, metricsCollector);
        setupNetworkMonitoring(page, `auth-${i}`, metricsCollector);

        // Authenticate
        await authenticateUser(page, testUser);

        userContexts.push({
          id: `auth-${i}`,
          type: 'authenticated',
          context,
          page,
          testUser,
        });
      }

      // Create admin users
      for (let i = 0; i < config.adminUsers; i++) {
        const testUser = await createTestUser(`stress-admin-${i}`);
        testUsers.push(testUser);

        // Grant admin role
        const supabase = createServiceRoleClient();
        await supabase.auth.admin.updateUserById(testUser.userId, {
          email_confirm: true,
        });

        const { error } = await supabase.from('user_roles').insert({
          user_id: testUser.userId,
          role: 'admin',
        });

        if (error) {
          console.error(
            `⚠️  Failed to grant admin role to user ${i}: ${error.message}`
          );
        }

        const context = await browser.newContext({
          baseURL: config.baseUrl,
          // Lightweight context options to reduce resource usage
          viewport: { width: 1280, height: 720 }, // Smaller viewport
          ignoreHTTPSErrors: true,
        });
        await context.route('**/*.{png,jpg,jpeg,gif,svg,webp,ico}', route => route.abort()); // Block images
        await context.route('**/*.{woff,woff2,ttf,eot}', route => route.abort()); // Block fonts
        const page = await context.newPage();

        // Setup monitoring
        setupConsoleTracking(page, `admin-${i}`, metricsCollector);
        setupNetworkMonitoring(page, `admin-${i}`, metricsCollector);

        // Authenticate
        await authenticateUser(page, testUser);

        // Navigate to admin page
        await page.goto('/admin');
        await page.waitForLoadState('networkidle');

        userContexts.push({
          id: `admin-${i}`,
          type: 'admin',
          context,
          page,
          testUser,
        });
      }

      console.log(`✅ Created ${userContexts.length} user contexts\n`);

      // ═══════════════════════════════════════════════════════════
      // RUN PHASE: Execute stress test
      // ═══════════════════════════════════════════════════════════
      console.log(`⏱️  Running stress test for ${config.duration}s...\n`);

      const startTime = Date.now();
      const endTime = startTime + config.duration * 1000;

      // Progress reporting
      const progressInterval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const remaining = Math.max(0, (endTime - Date.now()) / 1000);
        const progress = (elapsed / config.duration) * 100;
        const metrics = metricsCollector.getMetrics();

        // Check if we're near a polling cycle (60s intervals)
        const cycleNumber = Math.floor(elapsed / 60);
        const timeUntilNextCycle = 60 - (elapsed % 60);
        const nearCycle = timeUntilNextCycle < 2;

        let progressMessage = `📈 Progress: ${progress.toFixed(1)}% | Elapsed: ${elapsed.toFixed(0)}s | Remaining: ${remaining.toFixed(0)}s | Actions: ${metrics.actions.length}`;

        if (nearCycle && cycleNumber > 0) {
          progressMessage += ` | Admin Poll #${cycleNumber} ✅`;
        }

        console.log(progressMessage);
      }, config.progressInterval);

      // Execute concurrent user simulations
      await Promise.all(
        userContexts.map((userContext) =>
          runUserSimulation(userContext, endTime, config, metricsCollector)
        )
      );

      clearInterval(progressInterval);

      console.log('\n✅ Stress test completed\n');

      // ═══════════════════════════════════════════════════════════
      // ANALYSIS PHASE: Generate report and evaluate results
      // ═══════════════════════════════════════════════════════════
      const report = metricsCollector.generateReport();
      console.log(report);

      // Evaluate pass/fail criteria for I/O timeout detection
      const ioTimeouts = metricsCollector.getIOTimeoutErrors().length;
      const failureRate = 100 - metricsCollector.getSuccessRate();
      const trend = metricsCollector.getPerformanceTrend();
      const degradationRatio = trend.degradation / 100 + 1;

      // Primary assertion: No I/O timeouts (main client issue)
      expect(
        ioTimeouts,
        `Expected 0 I/O timeout errors, got ${ioTimeouts}`
      ).toBeLessThanOrEqual(config.maxConsoleErrors);

      // Secondary assertion: Actions don't fail due to connection issues
      expect(
        failureRate,
        `Expected failure rate <= ${config.maxFailureRate}%, got ${failureRate.toFixed(2)}%`
      ).toBeLessThanOrEqual(config.maxFailureRate);

      // Tertiary assertion: No connection leak causing degradation over time
      expect(
        degradationRatio,
        `Expected performance degradation <= ${((config.maxPerformanceDegradation - 1) * 100).toFixed(0)}%, got ${trend.degradation.toFixed(1)}%`
      ).toBeLessThanOrEqual(config.maxPerformanceDegradation);
    } finally {
      // ═══════════════════════════════════════════════════════════
      // CLEANUP PHASE
      // ═══════════════════════════════════════════════════════════
      console.log('\n🧹 Cleaning up...');

      // Close all contexts
      for (const userContext of userContexts) {
        try {
          await userContext.page.close();
          await userContext.context.close();
        } catch (error: any) {
          console.error(`Error closing context: ${error.message}`);
        }
      }

      // Delete test users
      const supabase = createServiceRoleClient();
      for (const testUser of testUsers) {
        try {
          // Remove admin role if exists
          await supabase
            .from('user_roles')
            .delete()
            .eq('user_id', testUser.userId);

          await deleteTestUser(testUser.userId);
        } catch (error: any) {
          console.error(
            `Failed to cleanup user ${testUser.userId}: ${error.message}`
          );
        }
      }

      console.log('✅ Cleanup completed\n');
    }
  });
});

/**
 * Authenticate a user via the auth page
 */
async function authenticateUser(page: Page, testUser: any): Promise<void> {
  await page.goto('/auth');
  await page.getByTestId(AuthTestIds.SIGNIN_EMAIL_INPUT).fill(testUser.email);
  await page
    .getByTestId(AuthTestIds.SIGNIN_PASSWORD_INPUT)
    .fill(testUser.password);
  await page.getByTestId(AuthTestIds.SIGNIN_SUBMIT_BUTTON).click();

  // Wait for navigation away from auth page
  await page.waitForURL((url) => !url.pathname.includes('/auth'), {
    timeout: 10000,
  });
}

/**
 * Run user simulation until end time
 */
async function runUserSimulation(
  userContext: UserContext,
  endTime: number,
  config: any,
  metricsCollector: MetricsCollector
): Promise<void> {
  let simulator;

  switch (userContext.type) {
    case 'anonymous':
      simulator = new AnonymousUserSimulator(
        userContext.page,
        userContext.id,
        metricsCollector,
        config
      );
      break;
    case 'authenticated':
      simulator = new AuthenticatedUserSimulator(
        userContext.page,
        userContext.id,
        metricsCollector,
        config
      );
      break;
    case 'admin':
      simulator = new AdminUserSimulator(
        userContext.page,
        userContext.id,
        metricsCollector,
        config
      );
      break;
  }

  // Run random actions until time expires
  while (Date.now() < endTime) {
    try {
      await simulator.runRandomAction();

      // Random delay between actions
      const delay =
        Math.random() * (config.actionDelayMax - config.actionDelayMin) +
        config.actionDelayMin;
      await userContext.page.waitForTimeout(delay);
    } catch (error: any) {
      // Log but continue simulation
      console.error(`Error in ${userContext.id} simulation: ${error.message}`);
    }
  }
}

/**
 * Setup console message tracking for a page
 */
function setupConsoleTracking(
  page: Page,
  userId: string,
  collector: MetricsCollector
): void {
  page.on('console', (msg) => {
    collector.recordConsoleMessage({
      timestamp: Date.now(),
      userId,
      type: msg.type(),
      text: msg.text(),
    });
  });
}

/**
 * Setup network request monitoring for a page
 */
function setupNetworkMonitoring(
  page: Page,
  userId: string,
  collector: MetricsCollector
): void {
  page.on('response', async (response) => {
    const request = response.request();

    // Get timing info - this is async in newer Playwright versions
    let duration = 0;
    try {
      const timing = await response.timing();
      if (timing && timing.responseEnd && timing.responseStart) {
        duration = timing.responseEnd - timing.responseStart;
      }
    } catch {
      // Timing not available, use 0
      duration = 0;
    }

    collector.recordNetworkRequest({
      timestamp: Date.now(),
      userId,
      url: request.url(),
      method: request.method(),
      status: response.status(),
      duration,
    });
  });
}
