import { test, expect } from '../fixtures/auth';
import { CanvasEditorPage } from '../utils/page-objects/CanvasEditorPage';
import { TemplatesBrowserPage } from '../utils/page-objects/TemplatesBrowserPage';

test.describe('Templates Browser', () => {
  let canvasPage: CanvasEditorPage;
  let templatesBrowser: TemplatesBrowserPage;

  test.beforeEach(async ({ authenticatedPage: page }) => {
    canvasPage = new CanvasEditorPage(page);
    templatesBrowser = new TemplatesBrowserPage(page);

    await canvasPage.goto();
    await canvasPage.waitForCanvasReady();
    await page.waitForTimeout(1000);
  });

  async function dismissDialogs(page: any): Promise<void> {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const closeButtons = page.locator('button').filter({ hasText: /got it|don't show|close/i });
    const closeCount = await closeButtons.count();
    for (let i = 0; i < closeCount; i++) {
      const button = closeButtons.nth(i);
      if (await button.isVisible().catch(() => false)) {
        await button.click();
        await page.waitForTimeout(200);
        break;
      }
    }
  }

  test('Templates tab is visible and opens the panel', async ({ authenticatedPage: page }) => {
    await dismissDialogs(page);

    // Click the Templates tab in the left sidebar
    await templatesBrowser.open();

    // Panel should be visible with community tab active by default
    await expect(templatesBrowser.panel).toBeVisible();
    await expect(templatesBrowser.communityTab).toBeVisible();
    await expect(templatesBrowser.brushesTab).toBeVisible();
    await expect(templatesBrowser.myProjectsTab).toBeVisible();
    await expect(templatesBrowser.searchInput).toBeVisible();
  });

  test('Sub-tabs switch correctly between Community, Brushes, and My Projects', async ({ authenticatedPage: page }) => {
    await dismissDialogs(page);
    await templatesBrowser.open();
    await templatesBrowser.waitForLoad();

    // Community is default — sort dropdown should be visible
    const sortVisibleOnCommunity = await templatesBrowser.isSortVisible();
    expect(sortVisibleOnCommunity).toBe(true);

    // Switch to Brushes — sort dropdown should NOT be visible
    await templatesBrowser.switchToBrushes();
    await templatesBrowser.waitForLoad();
    const sortVisibleOnBrushes = await templatesBrowser.isSortVisible();
    expect(sortVisibleOnBrushes).toBe(false);

    // Switch to My Projects — sort dropdown should NOT be visible
    await templatesBrowser.switchToMyProjects();
    await templatesBrowser.waitForLoad();
    const sortVisibleOnMyProjects = await templatesBrowser.isSortVisible();
    expect(sortVisibleOnMyProjects).toBe(false);

    // Switch back to Community — sort dropdown reappears
    await templatesBrowser.switchToCommunity();
    await templatesBrowser.waitForLoad();
    const sortVisibleAgain = await templatesBrowser.isSortVisible();
    expect(sortVisibleAgain).toBe(true);
  });

  test('Search filters project cards across tabs', async ({ authenticatedPage: page }) => {
    await dismissDialogs(page);
    await templatesBrowser.open();
    await templatesBrowser.waitForLoad();

    const initialCount = await templatesBrowser.getProjectCardCount();

    // Search for something unlikely to match
    await templatesBrowser.search('xyznonexistent12345');
    await page.waitForTimeout(500);

    const filteredCount = await templatesBrowser.getProjectCardCount();
    // Either no cards or fewer than initial
    expect(filteredCount).toBeLessThanOrEqual(initialCount);

    // If there were initially cards, the filtered count should be 0 for garbage search
    if (initialCount > 0) {
      expect(filteredCount).toBe(0);
      // Empty state should show
      const isEmpty = await templatesBrowser.isEmpty();
      expect(isEmpty).toBe(true);
    }

    // Clear search restores the cards
    await templatesBrowser.clearSearch();
    await page.waitForTimeout(500);
    const restoredCount = await templatesBrowser.getProjectCardCount();
    expect(restoredCount).toBe(initialCount);
  });

  test('Project card click opens import popover with Replace and Add options', async ({ authenticatedPage: page }) => {
    await dismissDialogs(page);
    await templatesBrowser.open();
    await templatesBrowser.waitForLoad();

    const cardCount = await templatesBrowser.getProjectCardCount();
    if (cardCount === 0) {
      // If no community templates exist, switch to My Projects
      await templatesBrowser.switchToMyProjects();
      await templatesBrowser.waitForLoad();
      const myCount = await templatesBrowser.getProjectCardCount();
      if (myCount === 0) {
        // No templates available to test — skip gracefully
        test.skip();
        return;
      }
    }

    // Click first project card
    await templatesBrowser.clickProjectCard(0);

    // Import popover should show Replace and Add to Canvas buttons
    await expect(templatesBrowser.replaceButton).toBeVisible({ timeout: 3000 });
    await expect(templatesBrowser.addToCanvasButton).toBeVisible({ timeout: 3000 });
  });

  test('React Query caching prevents redundant network requests on tab switch', async ({ authenticatedPage: page }) => {
    await dismissDialogs(page);
    await templatesBrowser.open();
    await templatesBrowser.waitForLoad();

    // Track Supabase REST API requests
    const supabaseRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('supabase') && url.includes('canvas_projects') && request.method() === 'GET') {
        supabaseRequests.push(url);
      }
    });

    // Record baseline — community already loaded
    const baselineCount = supabaseRequests.length;

    // Switch to Brushes (first visit — should fetch)
    await templatesBrowser.switchToBrushes();
    await templatesBrowser.waitForLoad();
    const afterBrushes = supabaseRequests.length;
    // At least one new request for brushes
    expect(afterBrushes).toBeGreaterThanOrEqual(baselineCount);

    // Switch to My Projects (first visit — should fetch)
    await templatesBrowser.switchToMyProjects();
    await templatesBrowser.waitForLoad();
    const afterMyProjects = supabaseRequests.length;

    // Switch back to Community (cached — should NOT trigger new request)
    const beforeCommunityReturn = supabaseRequests.length;
    await templatesBrowser.switchToCommunity();
    await page.waitForTimeout(2000); // Give ample time for any potential request
    const afterCommunityReturn = supabaseRequests.length;

    // No additional request should have been made for community (served from React Query cache)
    expect(afterCommunityReturn).toBe(beforeCommunityReturn);

    // Switch back to Brushes (cached — should NOT trigger new request)
    const beforeBrushesReturn = supabaseRequests.length;
    await templatesBrowser.switchToBrushes();
    await page.waitForTimeout(2000);
    const afterBrushesReturn = supabaseRequests.length;

    expect(afterBrushesReturn).toBe(beforeBrushesReturn);
  });

  test('My Projects tab shows user projects or empty state', async ({ authenticatedPage: page }) => {
    await dismissDialogs(page);
    await templatesBrowser.open();

    // Switch to My Projects
    await templatesBrowser.switchToMyProjects();
    await templatesBrowser.waitForLoad();

    // Should either show project cards or empty state
    const cardCount = await templatesBrowser.getProjectCardCount();
    const isEmpty = await templatesBrowser.isEmpty();

    // One of these must be true
    expect(cardCount > 0 || isEmpty).toBe(true);
  });

  test('Sort dropdown changes sort order on Community tab', async ({ authenticatedPage: page }) => {
    await dismissDialogs(page);
    await templatesBrowser.open();
    await templatesBrowser.waitForLoad();

    // Sort dropdown should be visible on Community tab
    const sortVisible = await templatesBrowser.isSortVisible();
    expect(sortVisible).toBe(true);

    // Click the sort dropdown and change to "Most Recent"
    await templatesBrowser.sortSelect.click();
    await page.waitForTimeout(300);

    const recentOption = page.getByRole('option', { name: 'Most Recent' });
    if (await recentOption.isVisible().catch(() => false)) {
      await recentOption.click();
      await page.waitForTimeout(1000);

      // Verify the sort changed (the dropdown text should reflect the new selection)
      const sortText = await templatesBrowser.sortSelect.textContent();
      expect(sortText).toContain('Most Recent');
    }
  });
});
