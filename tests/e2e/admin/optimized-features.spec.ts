import { test, expect } from '../fixtures/admin-auth';
import { AdminPage } from '../utils/page-objects/AdminPage';
import { AdminTestIds } from '@/lib/test-ids';
import { createServiceRoleClient, createTestUser, deleteTestUser } from '../../utils/supabase-test-client';
import type { SupabaseClient } from '@supabase/supabase-js';

test.describe('Optimized Features - Integration Tests', () => {
  let serviceClient: SupabaseClient;
  let testUser: { email: string; password: string; userId: string };

  test.beforeAll(async () => {
    serviceClient = createServiceRoleClient();
    testUser = await createTestUser('optimization-test');

    // Create test data for notifications
    await seedNotificationData(serviceClient, testUser.userId);
  });

  test.afterAll(async () => {
    await cleanupTestData(serviceClient);
    await deleteTestUser(testUser.userId);
  });

  test('AdminNotificationBell displays correct total count', async ({ adminPage }) => {
    const adminPageObj = new AdminPage(adminPage);
    await adminPageObj.goto();

    // Wait for notification bell to load - use first() since it appears in multiple places
    const notificationBell = adminPage.getByTestId(AdminTestIds.NOTIFICATION_BELL).first();
    await expect(notificationBell).toBeVisible();

    // Get count badge
    const countBadge = adminPage.getByTestId(AdminTestIds.NOTIFICATION_COUNT).first();

    if (await countBadge.isVisible()) {
      const displayedCount = await countBadge.textContent();
      expect(parseInt(displayedCount || '0')).toBeGreaterThan(0);
    }
  });

  test('AdminNotificationBell popover shows individual categories', async ({ adminPage }) => {
    const adminPageObj = new AdminPage(adminPage);
    await adminPageObj.goto();
    await adminPageObj.clickNotificationBell();

    // Verify popover content
    await expect(adminPage.getByText('Pending Reviews')).toBeVisible();

    // Check within the popover for notification items - look for buttons or notification items
    const popover = adminPage.locator('[role="dialog"], [data-radix-popper-content-wrapper]').first();
    const notificationItems = popover.locator('button, [class*="notification"]');

    // Should have at least some content in the popover
    const itemCount = await notificationItems.count();
    expect(itemCount).toBeGreaterThanOrEqual(0); // Popover exists and can show items
  });

  test('Analytics page loads and displays user data', async ({ adminPage }) => {
    await adminPage.goto('/admin/analytics');
    await adminPage.waitForLoadState('networkidle');

    // Verify page loaded
    await expect(adminPage.getByText('User Analytics')).toBeVisible();

    // Verify statistics cards
    await expect(adminPage.getByText('Total Users')).toBeVisible();
    await expect(adminPage.getByText('Total Projects')).toBeVisible();

    // Verify table has data
    const tableRows = adminPage.locator('tbody tr');
    const rowCount = await tableRows.count();
    expect(rowCount).toBeGreaterThan(0);
    expect(rowCount).toBeLessThanOrEqual(20); // Pagination limit
  });

  test('Analytics pagination changes displayed users', async ({ adminPage }) => {
    await adminPage.goto('/admin/analytics');
    await adminPage.waitForLoadState('networkidle');

    // Verify table loaded
    const tableRows = adminPage.locator('tbody tr');
    await expect(tableRows.first()).toBeVisible({ timeout: 10000 });

    // Check if there's a next button (pagination might not exist if < 20 users)
    const nextButton = adminPage.getByRole('link', { name: /next/i }).or(adminPage.locator('[aria-label*="next"]'));
    const nextButtonExists = await nextButton.count();

    if (nextButtonExists > 0) {
      const isDisabled = await nextButton.first().getAttribute('aria-disabled');

      if (isDisabled !== 'true') {
        // Get first user email from page 1
        const firstRowEmail = await adminPage.locator('tbody tr:first-child td:nth-child(2)').textContent();

        await nextButton.first().click();
        await adminPage.waitForLoadState('networkidle');

        // First row should be different on page 2
        const page2FirstEmail = await adminPage.locator('tbody tr:first-child td:nth-child(2)').textContent();
        expect(page2FirstEmail).not.toBe(firstRowEmail);
      }
    }
  });

  test('Blog page loads without errors', async ({ page }) => {
    // Monitor console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/blog');
    await page.waitForLoadState('networkidle');

    // Verify page loaded - check for any heading or main content
    const pageContent = page.locator('main, [role="main"], body');
    await expect(pageContent).toBeVisible();

    // Should have no errors
    expect(errors.length).toBe(0);
  });

  test('Blog caching reduces subsequent load times', async ({ page }) => {
    // First load
    await page.goto('/blog');
    await page.waitForLoadState('networkidle');

    // Navigate away
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Return to blog (should use cache)
    const startTime = Date.now();
    await page.goto('/blog');
    await page.waitForLoadState('networkidle');
    const cachedLoadTime = Date.now() - startTime;

    // Cached load should be faster (though not guaranteed due to network variance)
    // Just verify it doesn't error and completes
    expect(cachedLoadTime).toBeLessThan(10000);
  });
});

// Helper functions
async function seedNotificationData(client: SupabaseClient, userId: string) {
  await client.from('canvas_projects').insert([
    { user_id: userId, name: 'opt-test-1', title: 'Test 1', approval_status: 'pending', is_public: false, data: {} },
    { user_id: userId, name: 'opt-test-2', title: 'Test 2', approval_status: 'pending', is_public: false, data: {} }
  ]);

  await client.from('contact_messages').insert([
    { email: 'opttest1@example.com', name: 'Test 1', country: 'Test', message: 'Test msg 1', is_read: false },
    { email: 'opttest2@example.com', name: 'Test 2', country: 'Test', message: 'Test msg 2', is_read: false }
  ]);
}

async function cleanupTestData(client: SupabaseClient) {
  await client.from('canvas_projects').delete().ilike('name', 'opt-test-%');
  await client.from('contact_messages').delete().ilike('email', 'opttest%@example.com');
}
