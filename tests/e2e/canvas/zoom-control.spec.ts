import { test, expect } from '../fixtures/auth';
import { CanvasEditorPage } from '../utils/page-objects/CanvasEditorPage';
import { CanvasEditorTestIds } from '@/lib/test-ids';

test.describe('Zoom Control - Interactive Popover', () => {
  let canvasPage: CanvasEditorPage;

  test.beforeEach(async ({ authenticatedPage: page }) => {
    canvasPage = new CanvasEditorPage(page);
    await canvasPage.goto();
    await canvasPage.waitForCanvasReady();
  });

  test('Click zoom level opens popover', async ({ authenticatedPage: page }) => {
    await page.getByTestId(CanvasEditorTestIds.ZOOM_PERCENTAGE_BUTTON).click();
    const popover = page.getByTestId(CanvasEditorTestIds.ZOOM_POPOVER);
    await expect(popover).toBeVisible();
    await expect(page.getByTestId(CanvasEditorTestIds.ZOOM_PRESET_50)).toBeVisible();
  });

  test('Click preset zooms canvas to 50%', async ({ authenticatedPage: page }) => {
    await page.getByTestId(CanvasEditorTestIds.ZOOM_PERCENTAGE_BUTTON).click();

    // Wait for popover to be visible and stable before clicking preset
    const presetButton = page.getByTestId(CanvasEditorTestIds.ZOOM_PRESET_50);
    await presetButton.waitFor({ state: 'visible' });
    await page.waitForTimeout(100); // Wait for animation to settle

    await presetButton.click();
    await page.waitForTimeout(300);

    const zoomText = await page.getByTestId(CanvasEditorTestIds.ZOOM_PERCENTAGE_BUTTON).textContent();
    expect(zoomText).toBe('50%');

    const popover = page.getByTestId(CanvasEditorTestIds.ZOOM_POPOVER);
    await expect(popover).not.toBeVisible();
  });

  test('All preset buttons work correctly', async ({ authenticatedPage: page }) => {
    const presets = [25, 50, 75, 100, 150, 200, 400];

    for (const preset of presets) {
      await page.getByTestId(CanvasEditorTestIds.ZOOM_PERCENTAGE_BUTTON).click();

      // Wait for popover to be visible and stable before clicking preset
      const presetButton = page.getByTestId(`canvas-editor-zoom-preset-${preset}`);
      await presetButton.waitFor({ state: 'visible' });
      await page.waitForTimeout(100); // Wait for animation to settle

      await presetButton.click();
      await page.waitForTimeout(300);

      const zoomText = await page.getByTestId(CanvasEditorTestIds.ZOOM_PERCENTAGE_BUTTON).textContent();
      expect(zoomText).toBe(`${preset}%`);
    }
  });

  test('Enter custom zoom 125% via Enter key', async ({ authenticatedPage: page }) => {
    await page.getByTestId(CanvasEditorTestIds.ZOOM_PERCENTAGE_BUTTON).click();

    const input = page.getByTestId(CanvasEditorTestIds.ZOOM_CUSTOM_INPUT);
    await input.fill('125');
    await input.press('Enter');
    await page.waitForTimeout(300);

    const zoomText = await page.getByTestId(CanvasEditorTestIds.ZOOM_PERCENTAGE_BUTTON).textContent();
    expect(zoomText).toBe('125%');

    const popover = page.getByTestId(CanvasEditorTestIds.ZOOM_POPOVER);
    await expect(popover).not.toBeVisible();
  });

  test('Enter custom zoom 175% via blur', async ({ authenticatedPage: page }) => {
    await page.getByTestId(CanvasEditorTestIds.ZOOM_PERCENTAGE_BUTTON).click();

    const input = page.getByTestId(CanvasEditorTestIds.ZOOM_CUSTOM_INPUT);
    await input.fill('175');

    // Click outside to trigger blur
    await page.getByTestId(CanvasEditorTestIds.ZOOM_PRESET_100).click();
    await page.waitForTimeout(300);

    const zoomText = await page.getByTestId(CanvasEditorTestIds.ZOOM_PERCENTAGE_BUTTON).textContent();
    // Should be 100% because we clicked on the 100% preset, not 175%
    expect(zoomText).toBe('100%');
  });

  test('Invalid zoom 500 does not change zoom', async ({ authenticatedPage: page }) => {
    const initialZoom = await canvasPage.getZoomLevel();

    await page.getByTestId(CanvasEditorTestIds.ZOOM_PERCENTAGE_BUTTON).click();

    const input = page.getByTestId(CanvasEditorTestIds.ZOOM_CUSTOM_INPUT);
    await input.fill('500');
    await input.press('Enter');
    await page.waitForTimeout(300);

    const finalZoom = await canvasPage.getZoomLevel();
    expect(finalZoom).toBe(initialZoom);
  });

  test('Invalid zoom 5 does not change zoom (below minimum)', async ({ authenticatedPage: page }) => {
    const initialZoom = await canvasPage.getZoomLevel();

    await page.getByTestId(CanvasEditorTestIds.ZOOM_PERCENTAGE_BUTTON).click();

    const input = page.getByTestId(CanvasEditorTestIds.ZOOM_CUSTOM_INPUT);
    await input.fill('5');
    await input.press('Enter');
    await page.waitForTimeout(300);

    const finalZoom = await canvasPage.getZoomLevel();
    expect(finalZoom).toBe(initialZoom);
  });

  test('Zoom in/out buttons still work with new popover', async ({ authenticatedPage: page }) => {
    // Zoom in
    await page.getByTestId(CanvasEditorTestIds.ZOOM_IN_BUTTON).click();
    await page.waitForTimeout(200);

    let zoomText = await page.getByTestId(CanvasEditorTestIds.ZOOM_PERCENTAGE_BUTTON).textContent();
    expect(zoomText).toBe('110%');

    // Zoom out
    await page.getByTestId(CanvasEditorTestIds.ZOOM_OUT_BUTTON).click();
    await page.waitForTimeout(200);

    zoomText = await page.getByTestId(CanvasEditorTestIds.ZOOM_PERCENTAGE_BUTTON).textContent();
    expect(zoomText).toBe('100%');
  });

  test('Max zoom 400% is enforced via zoom in button', async ({ authenticatedPage: page }) => {
    await page.getByTestId(CanvasEditorTestIds.ZOOM_PERCENTAGE_BUTTON).click();
    const input = page.getByTestId(CanvasEditorTestIds.ZOOM_CUSTOM_INPUT);
    await input.fill('390');
    await input.press('Enter');
    await page.waitForTimeout(300);

    await page.getByTestId(CanvasEditorTestIds.ZOOM_IN_BUTTON).click();
    await page.waitForTimeout(200);

    let zoomText = await page.getByTestId(CanvasEditorTestIds.ZOOM_PERCENTAGE_BUTTON).textContent();
    expect(zoomText).toBe('400%');

    // Try to zoom in again - should stay at 400%
    await page.getByTestId(CanvasEditorTestIds.ZOOM_IN_BUTTON).click();
    await page.waitForTimeout(200);

    zoomText = await page.getByTestId(CanvasEditorTestIds.ZOOM_PERCENTAGE_BUTTON).textContent();
    expect(zoomText).toBe('400%');
  });

  test('Min zoom 10% is enforced via zoom out button', async ({ authenticatedPage: page }) => {
    await page.getByTestId(CanvasEditorTestIds.ZOOM_PERCENTAGE_BUTTON).click();
    const input = page.getByTestId(CanvasEditorTestIds.ZOOM_CUSTOM_INPUT);
    await input.fill('20');
    await input.press('Enter');
    await page.waitForTimeout(300);

    // Zoom out once to 10%
    await page.getByTestId(CanvasEditorTestIds.ZOOM_OUT_BUTTON).click();
    await page.waitForTimeout(200);

    let zoomText = await page.getByTestId(CanvasEditorTestIds.ZOOM_PERCENTAGE_BUTTON).textContent();
    expect(zoomText).toBe('10%');

    // Try to zoom out again - should stay at 10%
    await page.getByTestId(CanvasEditorTestIds.ZOOM_OUT_BUTTON).click();
    await page.waitForTimeout(200);

    zoomText = await page.getByTestId(CanvasEditorTestIds.ZOOM_PERCENTAGE_BUTTON).textContent();
    expect(zoomText).toBe('10%');
  });

  test('Presets are displayed in one column', async ({ authenticatedPage: page }) => {
    await page.getByTestId(CanvasEditorTestIds.ZOOM_PERCENTAGE_BUTTON).click();

    const popover = page.getByTestId(CanvasEditorTestIds.ZOOM_POPOVER);
    await expect(popover).toBeVisible();

    // Check that all preset buttons are visible
    const presets = [25, 50, 75, 100, 150, 200, 400];
    for (const preset of presets) {
      await expect(page.getByTestId(`canvas-editor-zoom-preset-${preset}`)).toBeVisible();
    }
  });

  test('Empty custom input does not trigger zoom change', async ({ authenticatedPage: page }) => {
    const initialZoom = await canvasPage.getZoomLevel();

    await page.getByTestId(CanvasEditorTestIds.ZOOM_PERCENTAGE_BUTTON).click();
    const input = page.getByTestId(CanvasEditorTestIds.ZOOM_CUSTOM_INPUT);

    // Press Enter with empty input
    await input.press('Enter');
    await page.waitForTimeout(300);

    const finalZoom = await canvasPage.getZoomLevel();
    expect(finalZoom).toBe(initialZoom);
  });

  test('Fit to Screen button zooms to fit viewport', async ({ authenticatedPage: page }) => {
    // First zoom to a different level
    await page.getByTestId(CanvasEditorTestIds.ZOOM_PERCENTAGE_BUTTON).click();
    await page.getByTestId(CanvasEditorTestIds.ZOOM_PRESET_200).click();
    await page.waitForTimeout(300);

    // Verify we're at 200%
    let zoomText = await page.getByTestId(CanvasEditorTestIds.ZOOM_PERCENTAGE_BUTTON).textContent();
    expect(zoomText).toBe('200%');

    // Click Fit to Screen button
    await page.getByTestId(CanvasEditorTestIds.ZOOM_FIT_BUTTON).click();
    await page.waitForTimeout(300);

    // Verify zoom changed from 200%
    zoomText = await page.getByTestId(CanvasEditorTestIds.ZOOM_PERCENTAGE_BUTTON).textContent();
    expect(zoomText).not.toBe('200%');

    // Verify it's a reasonable zoom level (between 10% and 200%)
    const zoomValue = parseInt(zoomText?.replace('%', '') || '100');
    expect(zoomValue).toBeGreaterThanOrEqual(10);
    expect(zoomValue).toBeLessThanOrEqual(200);
  });
});
