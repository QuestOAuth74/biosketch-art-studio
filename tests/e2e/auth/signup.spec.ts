import { test, expect } from '../fixtures/auth';
import { AuthPage } from '../utils/page-objects/AuthPage';
import { VerifyEmailPage } from '../utils/page-objects/VerifyEmailPage';
import { generateTestCredentials } from '../fixtures/test-data';
import { getSessionStorage } from '../utils/session-helpers';

test.describe('Signup & Email Verification', () => {
  test('user can sign up with email and password', async ({ page }) => {
    const authPage = new AuthPage(page);
    const credentials = generateTestCredentials();

    await authPage.goto();
    await authPage.signUp(credentials.email, credentials.password, 'United States', 'Genetics');

    // Should redirect to verify email page
    await expect(page).toHaveURL(/\/auth\/verify-email/);
  });

  test('sign-up redirects to /auth/verify-email', async ({ page }) => {
    const authPage = new AuthPage(page);
    const credentials = generateTestCredentials();

    await authPage.goto();
    await authPage.signUp(credentials.email, credentials.password, 'United States', 'Genetics');

    // Wait for navigation
    await page.waitForURL(/\/auth\/verify-email/);

    // Verify exact URL
    expect(page.url()).toContain('/auth/verify-email');
  });

  test('verify email page displays "Check your email" heading', async ({ page }) => {
    const authPage = new AuthPage(page);
    const verifyPage = new VerifyEmailPage(page);
    const credentials = generateTestCredentials();

    await authPage.goto();
    await authPage.signUp(credentials.email, credentials.password, 'United States', 'Genetics');

    // Wait for navigation
    await page.waitForURL(/\/auth\/verify-email/);

    // Check heading is visible
    await expect(verifyPage.heading).toBeVisible();

    // Verify heading text
    const headingText = await verifyPage.heading.textContent();
    expect(headingText?.toLowerCase()).toContain('check your email');
  });

  test('page shows "Return to Sign In" link', async ({ page }) => {
    const authPage = new AuthPage(page);
    const verifyPage = new VerifyEmailPage(page);
    const credentials = generateTestCredentials();

    await authPage.goto();
    await authPage.signUp(credentials.email, credentials.password, 'United States', 'Genetics');

    // Wait for navigation
    await page.waitForURL(/\/auth\/verify-email/);

    // Check return link is visible
    await expect(verifyPage.backToSignInButton).toBeVisible();

    // Verify link text
    const linkText = await verifyPage.backToSignInButton.textContent();
    expect(linkText?.toLowerCase()).toContain('back to sign in');
  });

  test('link navigates back to auth page', async ({ page }) => {
    const authPage = new AuthPage(page);
    const verifyPage = new VerifyEmailPage(page);
    const credentials = generateTestCredentials();

    await authPage.goto();
    await authPage.signUp(credentials.email, credentials.password, 'United States', 'Genetics');

    // Wait for navigation to verify email page
    await page.waitForURL(/\/auth\/verify-email/);

    // Click return to sign in
    await verifyPage.clickBackToSignIn();

    // Should navigate back to auth page
    await page.waitForURL(/\/auth/);
    expect(page.url()).toContain('/auth');
    expect(page.url()).not.toContain('/verify-email');
  });
});
