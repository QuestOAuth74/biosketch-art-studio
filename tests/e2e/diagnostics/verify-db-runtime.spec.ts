import { test, expect } from '@playwright/test';

test.describe('Database Connection Verification', () => {
  test('verify runtime uses correct database', async ({ page }) => {
    // Go to the app
    await page.goto('/');

    // Inject code to check what Supabase URL the client is using
    const supabaseUrl = await page.evaluate(() => {
      // Access the global window object where Vite exposes env vars
      return window.__VITE_SUPABASE_URL__ || localStorage.getItem('supabase.url') || 'unknown';
    });

    console.log('Browser runtime supabaseUrl:', supabaseUrl);

    // Also check network requests to see which Supabase instance is being hit
    const requests = [];
    page.on('request', request => {
      if (request.url().includes('supabase.co')) {
        requests.push(request.url());
      }
    });

    // Navigate to auth page to trigger Supabase requests
    await page.goto('/auth');
    await page.waitForTimeout(1000);

    console.log('Supabase requests:', requests);

    // Verify requests are going to the correct database
    const correctDbRequests = requests.some(url => url.includes('eotmnuwuetomtevhpovx'));
    expect(correctDbRequests).toBe(true);
  });

  test('verify test process env vars', async () => {
    console.log('Test process VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL);
    console.log('Test process VITE_SUPABASE_PROJECT_ID:', process.env.VITE_SUPABASE_PROJECT_ID);

    expect(process.env.VITE_SUPABASE_PROJECT_ID).toBe('eotmnuwuetomtevhpovx');
    expect(process.env.VITE_SUPABASE_URL).toBe('https://eotmnuwuetomtevhpovx.supabase.co');
  });
});
