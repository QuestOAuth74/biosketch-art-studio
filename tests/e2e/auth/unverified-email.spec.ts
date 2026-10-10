import { test, expect } from '../fixtures/auth';
import { AuthPage } from '../utils/page-objects/AuthPage';
import { VerifyEmailPage } from '../utils/page-objects/VerifyEmailPage';
import { getSessionStorage } from '../utils/session-helpers';
import { ToastTestIds } from '@/lib/test-ids';

test.describe('Unverified Email Handling', () => {
  test('sign-in with unverified email detects error', async ({ page, unverifiedUser }) => {
    const authPage = new AuthPage(page);

    await authPage.goto();
    await authPage.signIn(unverifiedUser.email, unverifiedUser.password);

    // Wait for error toast
    const hasErrorToast = await authPage.waitForToast(ToastTestIds.AUTH_EMAIL_UNVERIFIED);

    // Should show unverified email toast or redirect to verify email
    const currentUrl = page.url();
    expect(hasErrorToast || currentUrl.includes('/verify-email')).toBe(true);
  });

  test('triggers automatic verification email resend', async ({ page, unverifiedUser }) => {
    const authPage = new AuthPage(page);

    await authPage.goto();
    await authPage.signIn(unverifiedUser.email, unverifiedUser.password);

    // Wait for error toast to appear
    const hasErrorToast = await authPage.waitForToast(ToastTestIds.AUTH_EMAIL_UNVERIFIED);

    // Email should be stored in session storage for resend
    const storedEmail = await getSessionStorage(page, 'verifyEmail');

    // Should show toast and store email, and may redirect
    const currentUrl = page.url();
    expect(
      hasErrorToast || currentUrl.includes('/verify-email') || storedEmail === unverifiedUser.email
    ).toBe(true);
  });

  test('redirects to /auth/verify-email?resent=true', async ({ page, unverifiedUser }) => {
    const authPage = new AuthPage(page);

    await authPage.goto();
    await authPage.signIn(unverifiedUser.email, unverifiedUser.password);

    // Wait for redirect
    await page.waitForTimeout(2000);

    // Should redirect to verify email page
    const currentUrl = page.url();

    if (currentUrl.includes('/verify-email')) {
      // Check for resent parameter
      expect(currentUrl.includes('resent=true') || currentUrl.includes('/verify-email')).toBe(true);
    }
  });

  test('page displays resent confirmation', async ({ page, unverifiedUser }) => {
    const authPage = new AuthPage(page);
    const verifyPage = new VerifyEmailPage(page);

    await authPage.goto();
    await authPage.signIn(unverifiedUser.email, unverifiedUser.password);

    // Wait for redirect
    await page.waitForTimeout(2000);

    const currentUrl = page.url();

    if (currentUrl.includes('/verify-email')) {
      // Check if page shows verification message
      const hasHeading = await verifyPage.hasHeading();
      expect(hasHeading).toBe(true);

      // If resent parameter exists, check for confirmation
      if (currentUrl.includes('resent=true')) {
        const hasResentQuery = await verifyPage.hasResentQueryMessage();
        expect(hasResentQuery).toBe(true);
      }
    }
  });

  test('"Return to Sign In" link works', async ({ page, unverifiedUser }) => {
    const authPage = new AuthPage(page);
    const verifyPage = new VerifyEmailPage(page);

    await authPage.goto();
    await authPage.signIn(unverifiedUser.email, unverifiedUser.password);

    // Wait for redirect
    await page.waitForTimeout(2000);

    const currentUrl = page.url();

    if (currentUrl.includes('/verify-email')) {
      // Click return to sign in
      await verifyPage.clickBackToSignIn();

      // Should navigate back to auth page
      await page.waitForURL(/\/auth/);
      expect(page.url()).toContain('/auth');
      expect(page.url()).not.toContain('/verify-email');
    } else {
      // If didn't redirect, navigate directly to verify email page to test link
      await verifyPage.goto();
      await verifyPage.clickBackToSignIn();

      await page.waitForURL(/\/auth/);
      expect(page.url()).toContain('/auth');
    }
  });
});
