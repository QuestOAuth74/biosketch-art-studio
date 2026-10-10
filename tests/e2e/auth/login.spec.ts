import { test, expect } from '../fixtures/auth';
import { AuthPage } from '../utils/page-objects/AuthPage';
import { INVALID_CREDENTIALS } from '../fixtures/test-data';
import { isAuthenticated, waitForAuthentication, waitForSessionClear } from '../utils/session-helpers';
import { NavigationTestIds, ToastTestIds } from '@/lib/test-ids';

test.describe('Login & Session Management', () => {
  test('user can sign in with valid credentials', async ({ page, testUser }) => {
    const authPage = new AuthPage(page);

    await authPage.goto();
    await authPage.signIn(testUser.email, testUser.password);

    // Wait for authentication to complete
    await waitForAuthentication(page);

    // Should redirect away from auth page
    await page.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: 10000 });

    // Verify authentication
    const authenticated = await isAuthenticated(page);
    expect(authenticated).toBe(true);
  });

  test('invalid credentials display error', async ({ page }) => {
    const authPage = new AuthPage(page);

    await authPage.goto();
    await authPage.signIn(INVALID_CREDENTIALS.email, INVALID_CREDENTIALS.password);

    // Wait for error toast to appear
    const hasErrorToast = await authPage.waitForToast(ToastTestIds.AUTH_SIGNIN_ERROR);
    expect(hasErrorToast).toBe(true);

    // Should remain on auth page
    expect(page.url()).toContain('/auth');
  });

  test('session persists across page refresh', async ({ page, testUser }) => {
    const authPage = new AuthPage(page);

    // Sign in
    await authPage.goto();
    await authPage.signIn(testUser.email, testUser.password);

    // Wait for authentication to complete
    await waitForAuthentication(page);

    // Wait for navigation
    await page.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: 10000 });

    // Verify authenticated
    let authenticated = await isAuthenticated(page);
    expect(authenticated).toBe(true);

    // Refresh the page
    await page.reload();

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check session still exists
    authenticated = await isAuthenticated(page);
    expect(authenticated).toBe(true);
  });

  test('user can sign out successfully', async ({ page, testUser }) => {
    const authPage = new AuthPage(page);

    // Sign in first
    await authPage.goto();
    await authPage.signIn(testUser.email, testUser.password);

    // Wait for authentication to complete
    await waitForAuthentication(page);

    // Wait for navigation
    await page.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: 10000 });

    // Open user menu dropdown
    await page.getByTestId(NavigationTestIds.USER_MENU_TRIGGER).click();

    // Find and click sign out button
    const signOutButton = page.getByTestId(NavigationTestIds.SIGNOUT_BUTTON);
    await signOutButton.click();

    // Wait for signout success toast
    const hasSuccessToast = await authPage.waitForToast(ToastTestIds.AUTH_SIGNOUT_SUCCESS);
    expect(hasSuccessToast).toBe(true);

    // Wait for session to clear
    await waitForSessionClear(page);

    // Session should be cleared
    const authenticated = await isAuthenticated(page);
    expect(authenticated).toBe(false);
  });

  test('after sign out, session is cleared', async ({ page, testUser }) => {
    const authPage = new AuthPage(page);

    // Sign in first
    await authPage.goto();
    await authPage.signIn(testUser.email, testUser.password);

    // Wait for authentication to complete
    await waitForAuthentication(page);

    // Wait for navigation
    await page.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: 10000 });

    // Verify authenticated
    let authenticated = await isAuthenticated(page);
    expect(authenticated).toBe(true);

    // Open user menu dropdown
    await page.getByTestId(NavigationTestIds.USER_MENU_TRIGGER).click();

    // Sign out
    const signOutButton = page.getByTestId(NavigationTestIds.SIGNOUT_BUTTON);
    await signOutButton.click();

    // Wait for signout success toast
    const hasSuccessToast = await authPage.waitForToast(ToastTestIds.AUTH_SIGNOUT_SUCCESS);
    expect(hasSuccessToast).toBe(true);

    // Wait for session to clear
    const sessionCleared = await waitForSessionClear(page);
    expect(sessionCleared).toBe(true);

    // Double-check authentication status
    authenticated = await isAuthenticated(page);
    expect(authenticated).toBe(false);
  });
});
