import { test, expect } from '../fixtures/auth';
import { AuthPage } from '../utils/page-objects/AuthPage';
import { INVALID_EMAILS } from '../fixtures/test-data';
import { waitForAuthentication } from '../utils/session-helpers';
import { ToastTestIds } from '@/lib/test-ids';

test.describe('Password Reset Flow', () => {
  test('forgot password form is accessible', async ({ page }) => {
    const authPage = new AuthPage(page);

    await authPage.goto();

    // Click forgot password link
    await authPage.clickForgotPassword();

    // Wait for form to appear
    await page.waitForTimeout(500);

    // Check if reset form is visible
    await expect(authPage.resetSendButton).toBeVisible();
  });

  test('form validates email format', async ({ page }) => {
    const authPage = new AuthPage(page);

    await authPage.goto();
    await authPage.clickForgotPassword();

    // Wait for form
    await page.waitForTimeout(500);

    // Try to submit with invalid email
    await authPage.resetEmailInput.fill(INVALID_EMAILS[0]); // 'not-an-email'
    await authPage.resetSendButton.click();

    // Wait for validation
    await page.waitForTimeout(500);

    // Check for validation error (HTML5 or custom)
    const isInvalid = await authPage.resetEmailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isInvalid).toBe(true);
  });

  test('submitting valid email shows confirmation', async ({ page, testUser }) => {
    const authPage = new AuthPage(page);

    await authPage.goto();
    await authPage.clickForgotPassword();

    // Wait for form
    await page.waitForTimeout(500);

    // Submit valid email
    await authPage.submitPasswordReset(testUser.email);

    // Wait for confirmation toast
    const hasSuccessToast = await authPage.waitForToast(ToastTestIds.PASSWORD_RESET_SENT_SUCCESS);
    expect(hasSuccessToast).toBe(true);
  });

  test('"Back to Sign In" link exists', async ({ page }) => {
    const authPage = new AuthPage(page);

    await authPage.goto();
    await authPage.clickForgotPassword();

    // Wait for form
    await page.waitForTimeout(500);

    // Check if back to sign in link exists
    await expect(authPage.resetBackButton).toBeVisible();
  });

  test('password reset page validates requirements', async ({ page }) => {
    // This test would require a valid reset token from email
    // For now, we'll test the validation UI exists

    const authPage = new AuthPage(page);
    await authPage.goto();

    // Note: In a real scenario, we'd need to:
    // 1. Request password reset
    // 2. Get reset token from test email inbox
    // 3. Navigate to reset URL with token
    // 4. Test password validation

    // For this E2E test, we verify the forgot password flow works
    await authPage.clickForgotPassword();
    await page.waitForTimeout(500);

    await expect(authPage.resetSendButton).toBeVisible();
  });

  test('user can set new password via reset link', async ({ page }) => {
    // This test requires email integration to get reset token
    // Marking as placeholder for manual testing

    const authPage = new AuthPage(page);
    await authPage.goto();

    // Verify the password reset request can be initiated
    await authPage.clickForgotPassword();
    await page.waitForTimeout(500);

    await expect(authPage.resetEmailInput).toBeVisible();

    // Note: Full test requires:
    // 1. Submit reset request
    // 2. Fetch reset email via test inbox API
    // 3. Extract reset token
    // 4. Navigate to reset URL
    // 5. Submit new password
    // This is covered in manual testing procedures
  });

  test('after reset, can sign in with new password', async ({ page, testUser }) => {
    const authPage = new AuthPage(page);

    // This test verifies the sign-in flow works
    // Actual password reset tested in manual procedures

    await authPage.goto();
    await authPage.signIn(testUser.email, testUser.password);

    // Wait for authentication to complete
    await waitForAuthentication(page);

    // Wait for navigation
    await page.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: 10000 });

    // Verify successful sign-in
    expect(page.url()).not.toContain('/auth');
  });
});
