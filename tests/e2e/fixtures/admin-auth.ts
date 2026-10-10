import { test as base, Page } from '@playwright/test';
import {
  createTestUser,
  deleteTestUser,
  createServiceRoleClient,
} from '../../utils/supabase-test-client';
import { AuthTestIds } from '@/lib/test-ids';

/**
 * Test user data structure
 */
export interface TestUser {
  email: string;
  password: string;
  userId: string;
}

/**
 * Extended Playwright test with admin authentication fixtures
 */
export const test = base.extend<{
  adminUser: TestUser;
  adminPage: Page;
}>({
  /**
   * Fixture: Admin test user
   * Creates a user with admin role in user_roles table
   */
  adminUser: async ({}, use) => {
    const user = await createTestUser('admin-test');

    // Ensure user is verified
    const supabase = createServiceRoleClient();
    await supabase.auth.admin.updateUserById(user.userId, {
      email_confirm: true,
    });

    // Grant admin role
    const { error } = await supabase.from('user_roles').insert({
      user_id: user.userId,
      role: 'admin',
    });

    if (error) {
      throw new Error(`Failed to grant admin role: ${error.message}`);
    }

    await use(user);

    // Cleanup
    await supabase.from('user_roles').delete().eq('user_id', user.userId);

    await deleteTestUser(user.userId);
  },

  /**
   * Fixture: Pre-authenticated admin page
   * Provides a page with an active admin user session
   */
  adminPage: async ({ page, adminUser }, use) => {
    // Navigate to auth page
    await page.goto('/auth');

    // Sign in using test IDs
    await page.getByTestId(AuthTestIds.SIGNIN_EMAIL_INPUT).fill(adminUser.email);
    await page
      .getByTestId(AuthTestIds.SIGNIN_PASSWORD_INPUT)
      .fill(adminUser.password);
    await page.getByTestId(AuthTestIds.SIGNIN_SUBMIT_BUTTON).click();

    // Wait for navigation to complete
    await page.waitForURL((url) => !url.pathname.includes('/auth'));

    // Navigate to admin page
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    await use(page);
  },
});

export { expect } from '@playwright/test';
