import { test, expect } from '../fixtures/auth';
import { CanvasEditorPage } from '../utils/page-objects/CanvasEditorPage';
import { CanvasSizeDialogPage } from '../utils/page-objects/CanvasSizeDialogPage';
import { CanvasSizeTestIds } from '@/lib/test-ids';

test.describe('Canvas Size Templates', () => {
  let canvasPage: CanvasEditorPage;
  let canvasSizeDialog: CanvasSizeDialogPage;

  test.beforeEach(async ({ authenticatedPage: page }) => {
    canvasPage = new CanvasEditorPage(page);
    canvasSizeDialog = new CanvasSizeDialogPage(page);

    await canvasPage.goto();
    await canvasPage.waitForCanvasReady();
    await page.waitForTimeout(1000);
  });

  /**
   * Helper to dismiss Pro Tip and tutorial dialogs
   */
  async function dismissDialogs(page: any): Promise<void> {
    // Press Escape to close any dialogs
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Try clicking "Got it, don't show again" or similar buttons
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

  /**
   * Helper to select a preset paper size template
   * Note: Preset templates are automatically applied when selected (no Apply button needed)
   */
  async function selectTemplate(page: any, templateName: string): Promise<void> {
    // Click canvas background to deselect objects
    const canvas = page.locator('canvas').first();
    await canvas.click({ force: true });
    await page.waitForTimeout(300);

    // Dismiss any dialogs (Pro Tips, etc.)
    await dismissDialogs(page);

    // Expand Paper Size accordion
    const dialogTrigger = page.getByTestId(CanvasSizeTestIds.SIZE_DIALOG_TRIGGER);
    await dialogTrigger.scrollIntoViewIfNeeded();
    await dialogTrigger.click({ force: true });
    await page.waitForTimeout(500);

    // Dismiss any dialogs that appeared after expanding accordion
    await dismissDialogs(page);

    // Open paper size dropdown
    const paperSizeSelect = page.getByTestId(CanvasSizeTestIds.PAPER_SIZE_SELECT);
    await paperSizeSelect.waitFor({ state: 'visible', timeout: 5000 });
    await paperSizeSelect.click({ force: true });
    await page.waitForTimeout(500);

    // Select the template option (this automatically applies the dimensions for presets)
    const option = page.getByRole('option', { name: templateName });
    await option.waitFor({ state: 'visible', timeout: 5000 });
    await option.click();
    await page.waitForTimeout(1000); // Wait for dimensions to be applied
  }

  test('A4 Portrait template sets correct dimensions', async ({ authenticatedPage: page }) => {
    // Select A4 Portrait template
    await selectTemplate(page, 'A4 (Portrait)');

    // Get canvas dimensions
    const dimensions = await canvasSizeDialog.getCanvasDimensions();

    // A4 Portrait at 300 DPI: 2480 × 3508 px (from paperSizes.ts)
    // Canvas may be auto-scaled to fit viewport, but we can verify the aspect ratio
    // and that dimensions are significantly larger than the default
    expect(dimensions.width).toBeGreaterThan(1000);
    expect(dimensions.height).toBeGreaterThan(1000);

    // Verify aspect ratio is portrait (height > width)
    expect(dimensions.height).toBeGreaterThan(dimensions.width);

    // Verify approximately 2480 × 3508 px (allowing for auto-scaling)
    // Aspect ratio: 3508 / 2480 ≈ 1.414
    const aspectRatio = dimensions.height / dimensions.width;
    expect(aspectRatio).toBeCloseTo(1.414, 1);
  });

  test('Letter Landscape template sets correct dimensions', async ({ authenticatedPage: page }) => {
    // Select Letter Landscape template
    await selectTemplate(page, 'Letter (Landscape)');

    // Get canvas dimensions
    const dimensions = await canvasSizeDialog.getCanvasDimensions();

    // Letter Landscape at 300 DPI: 3300 × 2550 px (from paperSizes.ts)
    expect(dimensions.width).toBeGreaterThan(1000);
    expect(dimensions.height).toBeGreaterThan(1000);

    // Verify aspect ratio is landscape (width > height)
    expect(dimensions.width).toBeGreaterThan(dimensions.height);

    // Verify approximately 3300 × 2550 px (allowing for auto-scaling)
    // Aspect ratio: 3300 / 2550 ≈ 1.294
    const aspectRatio = dimensions.width / dimensions.height;
    expect(aspectRatio).toBeCloseTo(1.294, 1);
  });

  test('Template persists after save and reload', async ({ authenticatedPage: page }) => {
    // Select Nature Single Column template (unique size: 1039×1039)
    await selectTemplate(page, 'Nature (Single Column)');

    // Get dimensions after template selection
    const initialDimensions = await canvasSizeDialog.getCanvasDimensions();

    // Verify template applied (square aspect ratio for Nature Single Column)
    expect(initialDimensions.width).toBeCloseTo(initialDimensions.height, 10);

    // Save the project
    const saveButton = page.getByRole('button', { name: /save/i });
    await saveButton.click();
    await page.waitForTimeout(1500);

    // Verify URL changed to /canvas/[projectId]
    const url = page.url();
    expect(url).toMatch(/\/canvas\/[a-f0-9-]+$/);

    // Extract project ID from URL
    const projectId = url.split('/').pop();

    // Reload the page
    await page.reload();
    await canvasPage.waitForCanvasReady();
    await page.waitForTimeout(2000);

    // Wait for loading indicator to disappear
    const loadingIndicator = page.locator('text=Loading...');
    await loadingIndicator.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);

    // Get dimensions after reload
    const reloadedDimensions = await canvasSizeDialog.getCanvasDimensions();

    // Verify dimensions persisted (allowing for small differences due to auto-scaling)
    expect(reloadedDimensions.width).toBeCloseTo(initialDimensions.width, -1);
    expect(reloadedDimensions.height).toBeCloseTo(initialDimensions.height, -1);

    // Verify still square aspect ratio
    expect(reloadedDimensions.width).toBeCloseTo(reloadedDimensions.height, 10);

    // Open Paper Size accordion to verify template selection persisted
    const canvas = page.locator('canvas').first();
    await canvas.click({ force: true });
    await page.waitForTimeout(300);

    await dismissDialogs(page);

    const dialogTrigger = page.getByTestId(CanvasSizeTestIds.SIZE_DIALOG_TRIGGER);
    await dialogTrigger.scrollIntoViewIfNeeded();

    // Check if accordion is collapsed by checking if paper size select is visible
    const paperSizeSelect = page.getByTestId(CanvasSizeTestIds.PAPER_SIZE_SELECT);
    const isExpanded = await paperSizeSelect.isVisible().catch(() => false);

    if (!isExpanded) {
      // Expand accordion if collapsed
      await dialogTrigger.click({ force: true });
      await page.waitForTimeout(500);
      await dismissDialogs(page);
    }

    // Get the value of the paper size select
    await paperSizeSelect.waitFor({ state: 'visible', timeout: 5000 });

    // Verify "Nature (Single Column)" is selected
    const selectedValue = await paperSizeSelect.textContent();
    expect(selectedValue).toContain('Nature');
  });
});
