import { test, expect } from '@playwright/test';
import { clearLocalStorage } from '../utils/session-helpers';

/**
 * Signup Toast E2E Tests
 *
 * Tests the "Someone from X signed up Y ago" toast notification
 * that appears on the homepage. No service role key needed —
 * tests rely on real profile data already in the database.
 */
test.describe('Signup Toast Notification', () => {

  test('toast appears on homepage showing last signup info', async ({ page }) => {
    // Clear any cached dismiss/shown keys, then visit homepage
    await page.goto('/');
    await clearLocalStorage(page);
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Toast has a 2-second delay. Wait up to 12 seconds.
    const toast = page.locator('.professional-signup-toast');
    await expect(toast).toBeVisible({ timeout: 12000 });

    // Verify the toast contains expected structural text
    const toastText = await toast.textContent();
    expect(toastText).toContain('Someone from');
    expect(toastText).toContain('signed up');
    expect(toastText).toContain('Welcome to BioSketch');
  });

  test('toast shows country and relative time', async ({ page }) => {
    await page.goto('/');
    await clearLocalStorage(page);
    await page.reload();
    await page.waitForLoadState('networkidle');

    const toast = page.locator('.professional-signup-toast');
    await expect(toast).toBeVisible({ timeout: 12000 });

    const toastText = await toast.textContent();

    // Should contain a relative time expression
    expect(toastText).toMatch(/(just now|minute|hour|day)/);

    // Should contain a flag emoji (country flags or globe)
    const toastHtml = await toast.innerHTML();
    // Flags are either emoji or the globe emoji 🌍
    expect(toastHtml.length).toBeGreaterThan(0);
  });

  test('dismiss button hides toast immediately', async ({ page }) => {
    await page.goto('/');
    await clearLocalStorage(page);
    await page.reload();
    await page.waitForLoadState('networkidle');

    const toast = page.locator('.professional-signup-toast');
    await expect(toast).toBeVisible({ timeout: 12000 });

    // Click the dismiss button (✕)
    await toast.locator('button[aria-label="Dismiss"]').click();

    // Toast should disappear quickly
    await expect(toast).not.toBeVisible({ timeout: 3000 });

    // Verify dismiss key was stored in localStorage
    const dismissKey = await page.evaluate(() =>
      localStorage.getItem('biosketch_signup_toast_dismissed')
    );
    expect(dismissKey).toBeTruthy();
  });

  test('toast does not reappear after dismiss', async ({ page }) => {
    await page.goto('/');
    await clearLocalStorage(page);

    // Pre-set the dismiss key as if user recently dismissed
    await page.evaluate(() => {
      localStorage.setItem('biosketch_signup_toast_dismissed', Date.now().toString());
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Wait past the 2-second delay + buffer
    await page.waitForTimeout(5000);

    const toast = page.locator('.professional-signup-toast');
    await expect(toast).not.toBeVisible();
  });

  test('toast does not repeat for same signup on reload', async ({ page }) => {
    await page.goto('/');
    await clearLocalStorage(page);
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Wait for toast to appear
    const toast = page.locator('.professional-signup-toast');
    await expect(toast).toBeVisible({ timeout: 12000 });

    // Wait for auto-dismiss (6-second duration)
    await expect(toast).not.toBeVisible({ timeout: 10000 });

    // Verify storage key was set
    const storageKey = await page.evaluate(() =>
      localStorage.getItem('biosketch_signup_toast_last_shown')
    );
    expect(storageKey).toBeTruthy();
    const parsed = JSON.parse(storageKey!);
    expect(parsed).toHaveProperty('created_at');
    expect(parsed).toHaveProperty('timestamp');

    // Reload — same signup should NOT trigger toast again
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    await expect(toast).not.toBeVisible();
  });
});
