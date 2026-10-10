import { Page } from '@playwright/test';

/**
 * Session helper utilities for E2E tests
 * Provides functions to interact with browser storage and session state
 */

/**
 * Get session storage item
 */
export async function getSessionStorage(page: Page, key: string): Promise<string | null> {
  return await page.evaluate((k) => sessionStorage.getItem(k), key);
}

/**
 * Set session storage item
 */
export async function setSessionStorage(page: Page, key: string, value: string): Promise<void> {
  await page.evaluate(
    ({ k, v }) => sessionStorage.setItem(k, v),
    { k: key, v: value }
  );
}

/**
 * Clear session storage
 */
export async function clearSessionStorage(page: Page): Promise<void> {
  await page.evaluate(() => sessionStorage.clear());
}

/**
 * Get local storage item
 */
export async function getLocalStorage(page: Page, key: string): Promise<string | null> {
  return await page.evaluate((k) => localStorage.getItem(k), key);
}

/**
 * Set local storage item
 */
export async function setLocalStorage(page: Page, key: string, value: string): Promise<void> {
  await page.evaluate(
    ({ k, v }) => localStorage.setItem(k, v),
    { k: key, v: value }
  );
}

/**
 * Clear local storage
 */
export async function clearLocalStorage(page: Page): Promise<void> {
  await page.evaluate(() => localStorage.clear());
}

/**
 * Check if user is authenticated
 * Checks for Supabase auth token in local storage
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  const authToken = await page.evaluate(() => {
    const keys = Object.keys(localStorage);
    const authKey = keys.find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'));
    return authKey ? localStorage.getItem(authKey) : null;
  });

  return authToken !== null;
}

/**
 * Clear all browser storage (session + local + cookies)
 */
export async function clearAllStorage(page: Page): Promise<void> {
  await clearSessionStorage(page);
  await clearLocalStorage(page);
  await page.context().clearCookies();
}

/**
 * Get Supabase session data from local storage
 */
export async function getSupabaseSession(page: Page): Promise<any> {
  return await page.evaluate(() => {
    const keys = Object.keys(localStorage);
    const authKey = keys.find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (!authKey) return null;

    const authData = localStorage.getItem(authKey);
    return authData ? JSON.parse(authData) : null;
  });
}

/**
 * Wait for authentication to complete
 * Polls for Supabase auth token in local storage
 */
export async function waitForAuthentication(page: Page, timeout = 5000): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await isAuthenticated(page)) {
      return true;
    }
    await page.waitForTimeout(100);
  }

  return false;
}

/**
 * Wait for session to be cleared
 * Polls for absence of Supabase auth token
 */
export async function waitForSessionClear(page: Page, timeout = 5000): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (!(await isAuthenticated(page))) {
      return true;
    }
    await page.waitForTimeout(100);
  }

  return false;
}
