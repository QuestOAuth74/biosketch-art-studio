import { test as base, Page } from '@playwright/test';
import { createTestUser, deleteTestUser, createServiceRoleClient } from '../../utils/supabase-test-client';
import { AuthTestIds } from '@/lib/test-ids';
import { waitForAuthentication } from '../utils/session-helpers';

/**
 * Test user data structure
 */
export interface TestUser {
  email: string;
  password: string;
  userId: string;
}

/**
 * Extended Playwright test with authentication fixtures
 */
export const test = base.extend<{
  testUser: TestUser;
  unverifiedUser: TestUser;
  authenticatedPage: Page;
}>({
  /**
   * Fixture: Verified test user
   * Creates a user with email_confirmed_at set (verified) and admin role
   */
  testUser: async ({}, use) => {
    const user = await createTestUser();

    // Ensure user is verified and has admin role
    const supabase = createServiceRoleClient();
    await supabase.auth.admin.updateUserById(user.userId, {
      email_confirm: true,
    });

    // Add admin role
    await supabase.from('user_roles').insert({
      user_id: user.userId,
      role: 'admin',
    });

    await use(user);

    // Cleanup (user_roles will cascade delete with user)
    await deleteTestUser(user.userId);
  },

  /**
   * Fixture: Unverified test user
   * Creates a user with email_confirmed_at = null (not verified)
   */
  unverifiedUser: async ({}, use) => {
    // Create user as unverified from the start
    const user = await createTestUser('test', false);

    await use(user);

    // Cleanup
    await deleteTestUser(user.userId);
  },

  /**
   * Fixture: Pre-authenticated browser page
   * Provides a page with an active user session
   */
  authenticatedPage: async ({ page, testUser }, use) => {
    // Navigate to auth page
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');

    // Sign in using test IDs
    await page.getByTestId(AuthTestIds.SIGNIN_EMAIL_INPUT).fill(testUser.email);
    await page.getByTestId(AuthTestIds.SIGNIN_PASSWORD_INPUT).fill(testUser.password);
    await page.getByTestId(AuthTestIds.SIGNIN_SUBMIT_BUTTON).click();

    // Wait for authentication to complete
    const authenticated = await waitForAuthentication(page, 60000);

    if (!authenticated) {
      throw new Error('Authentication failed: No auth token found after 60 seconds');
    }

    // Wait for navigation away from auth page
    await page.waitForURL((url) => !url.pathname.includes('/auth'), {
      timeout: 60000
    });

    // Ensure page is stable
    await page.waitForLoadState('networkidle');

    await use(page);
  },
});

export { expect } from '@playwright/test';
