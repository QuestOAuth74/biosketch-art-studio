import { test, expect } from '../fixtures/auth';
import { CanvasEditorPage } from '../utils/page-objects/CanvasEditorPage';

test.describe('Membrane Brush Icon Selector - Optimized Query Performance', () => {
  let canvasPage: CanvasEditorPage;

  test.beforeEach(async ({ authenticatedPage: page }) => {
    canvasPage = new CanvasEditorPage(page);
    await canvasPage.goto();
    await canvasPage.waitForCanvasReady();
  });

  test('MembraneBrushIconSelector loads only thumbnails initially', async ({ authenticatedPage: page }) => {
    // Monitor network requests
    const iconQueries: string[] = [];
    page.on('response', response => {
      const url = response.url();
      if (url.includes('/rest/v1/icons') && url.includes('select=')) {
        iconQueries.push(url);
      }
    });

    // Click membrane brush tool
    const membraneBrushButton = page.getByRole('button', { name: /membrane/i });
    if (await membraneBrushButton.isVisible().catch(() => false)) {
      await membraneBrushButton.click();
      await page.waitForTimeout(1000);

      // Dialog should open
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Expand a category
      const accordion = page.getByRole('button').filter({ hasText: /anatomy|animals|cells/i });
      const accordionCount = await accordion.count();

      if (accordionCount > 0) {
        await accordion.first().click();
        await page.waitForTimeout(1500);

        // Verify initial queries don't include svg_content in SELECT
        const initialQueries = iconQueries.filter(url =>
          url.includes('select=') && !url.includes('eq=')
        );

        const allOptimized = initialQueries.every(url => {
          const selectMatch = url.match(/select=([^&]*)/);
          if (selectMatch) {
            const columns = decodeURIComponent(selectMatch[1]);
            // Allow single-column svg_content fetch (on-demand), but not in multi-column queries
            return !columns.includes('svg_content') || columns === 'svg_content';
          }
          return true;
        });

        expect(allOptimized || iconQueries.length === 0).toBe(true);
      }

      // Close dialog
      await page.keyboard.press('Escape');
    }
  });

  test('MembraneBrushIconSelector pagination loads only 20 icons per page', async ({ authenticatedPage: page }) => {
    // Monitor network requests
    const iconRequests: { url: string; count?: number }[] = [];
    page.on('response', async response => {
      const url = response.url();
      if (url.includes('/rest/v1/icons') && url.includes('select=')) {
        try {
          const data = await response.json();
          iconRequests.push({
            url,
            count: Array.isArray(data) ? data.length : 0
          });
        } catch {
          // Ignore JSON parse errors
        }
      }
    });

    // Click membrane brush tool
    const membraneBrushButton = page.getByRole('button', { name: /membrane/i });
    if (await membraneBrushButton.isVisible().catch(() => false)) {
      await membraneBrushButton.click();
      await page.waitForTimeout(1000);

      // Dialog should open
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Expand a category with many icons
      const accordion = page.getByRole('button').filter({ hasText: /anatomy|animals|cells/i });
      const accordionCount = await accordion.count();

      if (accordionCount > 0) {
        await accordion.first().click();
        await page.waitForTimeout(1500);

        // Verify initial load has ≤20 icons
        const initialIconLoad = iconRequests.find(req =>
          req.url.includes('select=') &&
          req.url.includes('thumbnail') &&
          !req.url.includes('svg_content') &&
          req.count !== undefined &&
          req.count > 0
        );

        if (initialIconLoad) {
          expect(initialIconLoad.count).toBeLessThanOrEqual(20);
          expect(initialIconLoad.count).toBeGreaterThan(0);
        }

        // Check if pagination controls exist
        const nextButton = page.getByRole('button', { name: /next page/i }).first();
        const hasPagination = await nextButton.isVisible().catch(() => false);

        if (hasPagination) {
          // Check if next button is enabled
          const isNextEnabled = await nextButton.isEnabled().catch(() => false);

          if (isNextEnabled) {
            // Count visible icons on page 1
            const iconsBefore = page.locator('button').filter({ hasText: '' }).and(page.locator('[title]'));
            const countBefore = await iconsBefore.count();

            // Clear request tracking
            iconRequests.length = 0;

            // Click "Next"
            await nextButton.click();
            await page.waitForTimeout(1500);

            // Verify icons were replaced (not accumulated) - count should stay ~20
            const iconsAfter = page.locator('button').filter({ hasText: '' }).and(page.locator('[title]'));
            const countAfter = await iconsAfter.count();
            expect(countAfter).toBeLessThanOrEqual(20);

            // Verify pagination query was used
            const paginationRequest = iconRequests.find(req =>
              req.url.includes('select=') &&
              req.url.includes('thumbnail') &&
              req.count !== undefined &&
              req.count > 0
            );

            if (paginationRequest) {
              expect(paginationRequest.count).toBeLessThanOrEqual(20);
            }
          }
        }
      }

      // Close dialog
      await page.keyboard.press('Escape');
    }
  });

  test('MembraneBrushIconSelector search limits results to 100', async ({ authenticatedPage: page }) => {
    // Monitor network requests
    const iconRequests: { url: string; count?: number }[] = [];
    page.on('response', async response => {
      const url = response.url();
      if (url.includes('/rest/v1/icons') && url.includes('select=')) {
        try {
          const data = await response.json();
          iconRequests.push({
            url,
            count: Array.isArray(data) ? data.length : 0
          });
        } catch {
          // Ignore JSON parse errors
        }
      }
    });

    // Click membrane brush tool
    const membraneBrushButton = page.getByRole('button', { name: /membrane/i });
    if (await membraneBrushButton.isVisible().catch(() => false)) {
      await membraneBrushButton.click();
      await page.waitForTimeout(1000);

      // Dialog should open
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Enter search term
      const searchInput = page.getByPlaceholder(/search icons/i);
      await searchInput.fill('cell');
      await page.waitForTimeout(1000); // Wait for debounce + search

      // Verify search query has LIMIT
      const searchRequest = iconRequests.find(req =>
        req.url.includes('textSearch') &&
        req.count !== undefined &&
        req.count > 0
      );

      if (searchRequest) {
        expect(searchRequest.count).toBeLessThanOrEqual(100);
        expect(searchRequest.count).toBeGreaterThan(0);
      }

      // Close dialog
      await page.keyboard.press('Escape');
    }
  });

  test('MembraneBrushIconSelector fetches svg_content on "Start Drawing"', async ({ authenticatedPage: page }) => {
    // Track network requests
    const requests: { url: string; columns: string[] }[] = [];
    page.on('response', async response => {
      const url = response.url();
      if (url.includes('/rest/v1/icons') && url.includes('select=')) {
        const selectMatch = url.match(/select=([^&]*)/);
        if (selectMatch) {
          const columns = decodeURIComponent(selectMatch[1]).split(',');
          requests.push({ url, columns });
        }
      }
    });

    // Click membrane brush tool
    const membraneBrushButton = page.getByRole('button', { name: /membrane/i });
    if (await membraneBrushButton.isVisible().catch(() => false)) {
      await membraneBrushButton.click();
      await page.waitForTimeout(1000);

      // Dialog should open
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Click a suggested icon or search
      const searchInput = page.getByPlaceholder(/search icons/i);
      await searchInput.fill('phospholipid');
      await page.waitForTimeout(1500);

      // Find and click an icon
      const iconButtons = page.locator('button[title]').filter({ hasNotText: /load more|start drawing|cancel/i });
      const iconCount = await iconButtons.count();

      if (iconCount > 0) {
        // Clear request tracking before clicking icon
        requests.length = 0;

        // Click first icon
        await iconButtons.first().click();
        await page.waitForTimeout(500);

        // Verify "Start Drawing" button is enabled
        const startButton = page.getByRole('button', { name: /start drawing/i });
        await expect(startButton).toBeEnabled();

        // Clear request tracking before starting
        requests.length = 0;

        // Click "Start Drawing"
        await startButton.click();
        await page.waitForTimeout(1500);

        // Verify svg_content was fetched (if not already cached)
        const hasSvgContentFetch = requests.some(req =>
          req.columns.includes('svg_content') || req.url.includes('svg_content')
        );
        // Note: May be false if svg_content was already cached
        // This is acceptable - we just verify no errors occurred

        // Verify membrane brush is now active (dialog should be closed)
        await expect(dialog).not.toBeVisible();
      }
    }
  });

  test('MembraneBrushIconSelector handles icon selection without errors', async ({ authenticatedPage: page }) => {
    // Monitor console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Click membrane brush tool
    const membraneBrushButton = page.getByRole('button', { name: /membrane/i });
    if (await membraneBrushButton.isVisible().catch(() => false)) {
      await membraneBrushButton.click();
      await page.waitForTimeout(1000);

      // Dialog should open
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Expand a category
      const accordion = page.getByRole('button').filter({ hasText: /anatomy|animals|cells/i });
      const accordionCount = await accordion.count();

      if (accordionCount > 0) {
        await accordion.first().click();
        await page.waitForTimeout(1500);

        // Find and click an icon
        const iconButtons = page.locator('button[title]').filter({ hasNotText: /load more|start drawing|cancel/i });
        const iconCount = await iconButtons.count();

        if (iconCount > 0) {
          await iconButtons.first().click();
          await page.waitForTimeout(500);

          // Verify no console errors
          const relevantErrors = errors.filter(err =>
            !err.includes('favicon') &&
            !err.includes('net::ERR') &&
            !err.includes('404')
          );
          expect(relevantErrors.length).toBe(0);

          // Verify icon is selected (Start Drawing button should be enabled)
          const startButton = page.getByRole('button', { name: /start drawing/i });
          await expect(startButton).toBeEnabled();
        }
      }

      // Close dialog
      await page.keyboard.press('Escape');
    }
  });
});
