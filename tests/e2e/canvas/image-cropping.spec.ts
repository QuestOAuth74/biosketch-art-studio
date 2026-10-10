import { test, expect } from '../fixtures/auth';
import { CanvasEditorPage } from '../utils/page-objects/CanvasEditorPage';
import { CropTestIds, CanvasEditorTestIds } from '@/lib/test-ids';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Image Cropping Workflow', () => {
  let canvasPage: CanvasEditorPage;
  const testImagePath = path.join(__dirname, '../fixtures/test-image.png');

  test.beforeEach(async ({ authenticatedPage: page }) => {
    canvasPage = new CanvasEditorPage(page);

    // Dismiss tip banner to prevent it from blocking interactions
    await page.evaluate(() => {
      localStorage.setItem('canvas_tip_banner_dismissed', 'true');
    });

    await canvasPage.goto();
    await canvasPage.waitForCanvasReady();
    await page.waitForTimeout(1000);

    // Upload test image using the UI file picker
    await canvasPage.uploadImage(testImagePath);

    // Wait for image to be fully added and rendered
    await page.waitForTimeout(3000);

    // Select the last added object (the uploaded image) using Fabric.js API
    await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      if (canvas && canvas._objects && canvas._objects.length > 0) {
        // Get the last object (most recently added)
        const lastObject = canvas._objects[canvas._objects.length - 1];
        canvas.setActiveObject(lastObject);
        canvas.requestRenderAll();
      }
    });

    await page.waitForTimeout(500);

    // Expand the Crop section in properties panel
    const cropHeading = page.getByRole('heading', { name: 'Crop', level: 3 });
    await cropHeading.click();
    await page.waitForTimeout(300);

    // Verify the crop button is visible (confirms crop section is expanded)
    const cropButton = page.getByTestId(CropTestIds.CROP_FREEFORM_BUTTON);
    await cropButton.waitFor({ state: 'visible', timeout: 5000 });
  });

  test('Free-form crop opens lightbox with anchor points', async ({ authenticatedPage: page }) => {
    // Click free-form crop button
    const freeformButton = page.getByTestId(CropTestIds.CROP_FREEFORM_BUTTON);
    await freeformButton.click();
    await page.waitForTimeout(500);

    // Verify lightbox is visible
    const lightbox = page.getByTestId(CropTestIds.CROP_LIGHTBOX);
    await expect(lightbox).toBeVisible();

    // Verify mode selector shows "Free-form"
    const modeSelect = page.getByTestId(CropTestIds.CROP_MODE_SELECT);
    const modeText = await modeSelect.textContent();
    expect(modeText?.toLowerCase()).toContain('free');

    // Verify polygon points are visible (default 4 corners)
    const polygonPoints = page.locator(`[data-testid^="${CropTestIds.POLYGON_POINT}"]`);
    const pointCount = await polygonPoints.count();
    expect(pointCount).toBeGreaterThanOrEqual(4);

    // Cancel
    const cancelButton = page.getByTestId(CropTestIds.CANCEL_CROP_BUTTON);
    await cancelButton.click();
    await page.waitForTimeout(300);
  });

  test('Drag anchor point updates preview', async ({ authenticatedPage: page }) => {
    // Enter freeform crop mode
    await page.getByTestId(CropTestIds.CROP_FREEFORM_BUTTON).click();
    await page.waitForTimeout(500);

    // Get first polygon point
    const firstPoint = page.locator(`[data-testid^="${CropTestIds.POLYGON_POINT}"]`).first();
    const initialBox = await firstPoint.boundingBox();
    expect(initialBox).toBeTruthy();

    // Drag point using mouse API (50px right, 30px down)
    const startX = initialBox!.x + initialBox!.width / 2;
    const startY = initialBox!.y + initialBox!.height / 2;
    const endX = startX + 50;
    const endY = startY + 30;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY);
    await page.mouse.up();
    await page.waitForTimeout(300);

    // Verify point moved
    const newBox = await firstPoint.boundingBox();
    expect(newBox!.x).not.toBe(initialBox!.x);

    // Cancel
    await page.getByTestId(CropTestIds.CANCEL_CROP_BUTTON).click();
  });

  test('Apply crop to custom shape', async ({ authenticatedPage: page }) => {
    // Enter freeform crop, move one point
    await page.getByTestId(CropTestIds.CROP_FREEFORM_BUTTON).click();
    await page.waitForTimeout(500);

    const firstPoint = page.locator(`[data-testid^="${CropTestIds.POLYGON_POINT}"]`).first();
    const box = await firstPoint.boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(100, 100);
    await page.mouse.up();
    await page.waitForTimeout(300);

    // Apply crop
    await page.getByTestId(CropTestIds.APPLY_CROP_BUTTON).click();
    await page.waitForTimeout(500);

    // Verify lightbox closed
    const lightbox = page.getByTestId(CropTestIds.CROP_LIGHTBOX);
    await expect(lightbox).not.toBeVisible();

    // Verify clipPath exists
    const hasClipPath = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      const obj = canvas.getActiveObject();
      return obj && obj.clipPath !== null && obj.clipPath !== undefined;
    });
    expect(hasClipPath).toBe(true);

    // Verify cropConfig type
    const cropType = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      const obj = canvas.getActiveObject();
      return obj?.cropConfig?.type;
    });
    expect(cropType).toBe('freeform');
  });

  test('Edit crop restores previous points', async ({ authenticatedPage: page }) => {
    // Apply freeform crop
    await page.getByTestId(CropTestIds.CROP_FREEFORM_BUTTON).click();
    await page.waitForTimeout(500);

    const firstPoint = page.locator(`[data-testid^="${CropTestIds.POLYGON_POINT}"]`).first();
    const initialBox = await firstPoint.boundingBox();

    // Move to unique position
    const startX = initialBox!.x + initialBox!.width / 2;
    const startY = initialBox!.y + initialBox!.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(initialBox!.x + 123, initialBox!.y + 87);
    await page.mouse.up();
    await page.waitForTimeout(300);

    const movedBox = await firstPoint.boundingBox();
    await page.getByTestId(CropTestIds.APPLY_CROP_BUTTON).click();
    await page.waitForTimeout(500);

    // Click Edit Crop
    await page.getByTestId(CropTestIds.EDIT_CROP_BUTTON).click();
    await page.waitForTimeout(500);

    // Verify lightbox reopened
    const lightbox = page.getByTestId(CropTestIds.CROP_LIGHTBOX);
    await expect(lightbox).toBeVisible();

    // Verify point at approximately same position (within 20px tolerance)
    const restoredPoint = page.locator(`[data-testid^="${CropTestIds.POLYGON_POINT}"]`).first();
    const restoredBox = await restoredPoint.boundingBox();

    expect(Math.abs(restoredBox!.x - movedBox!.x)).toBeLessThan(20);
    expect(Math.abs(restoredBox!.y - movedBox!.y)).toBeLessThan(20);

    // Cancel
    await page.getByTestId(CropTestIds.CANCEL_CROP_BUTTON).click();
  });

  test('Reset to original removes crop', async ({ authenticatedPage: page }) => {
    // Apply circle crop
    await page.getByTestId(CropTestIds.CROP_CIRCLE_BUTTON).click();
    await page.waitForTimeout(500);
    await page.getByTestId(CropTestIds.APPLY_CROP_BUTTON).click();
    await page.waitForTimeout(500);

    // Verify clipPath exists
    let hasClipPath = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      const obj = canvas.getActiveObject();
      return obj && obj.clipPath !== null;
    });
    expect(hasClipPath).toBe(true);

    // Click Reset
    await page.getByTestId(CropTestIds.RESET_CROP_BUTTON).click();
    await page.waitForTimeout(500);

    // Verify clipPath removed
    hasClipPath = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      const obj = canvas.getActiveObject();
      return obj && obj.clipPath !== null;
    });
    expect(hasClipPath).toBe(false);

    // Verify Edit/Reset buttons hidden, crop mode buttons visible
    await expect(page.getByTestId(CropTestIds.EDIT_CROP_BUTTON)).not.toBeVisible();
    await expect(page.getByTestId(CropTestIds.RESET_CROP_BUTTON)).not.toBeVisible();
    await expect(page.getByTestId(CropTestIds.CROP_FREEFORM_BUTTON)).toBeVisible();
  });

  test('Circle crop with resize handles', async ({ authenticatedPage: page }) => {
    // Click circle crop button
    await page.getByTestId(CropTestIds.CROP_CIRCLE_BUTTON).click();
    await page.waitForTimeout(500);

    // Verify lightbox visible
    const lightbox = page.getByTestId(CropTestIds.CROP_LIGHTBOX);
    await expect(lightbox).toBeVisible();

    // Verify SVG ellipse visible
    const ellipse = page.locator('[data-testid="crop-lightbox"] ellipse[stroke="#3b82f6"]');
    await expect(ellipse).toBeVisible();

    // Verify aspect ratio is 1:1 (rx === ry)
    const rx = await ellipse.getAttribute('rx');
    const ry = await ellipse.getAttribute('ry');
    expect(parseFloat(rx!)).toBeCloseTo(parseFloat(ry!), 1);

    // Verify 4 corner handles exist
    const handles = page.locator('[data-testid^="crop-handle"]');
    const handleCount = await handles.count();
    expect(handleCount).toBe(4);

    // Verify dimensions display shows equal width/height
    const dimensions = page.getByTestId(CropTestIds.CROP_DIMENSIONS);
    const dimText = await dimensions.textContent();
    const matches = dimText?.match(/(\d+)\s*×\s*(\d+)/);
    if (matches) {
      const width = parseInt(matches[1]);
      const height = parseInt(matches[2]);
      expect(Math.abs(width - height)).toBeLessThan(5); // Nearly equal
    }

    // Cancel
    await page.getByTestId(CropTestIds.CANCEL_CROP_BUTTON).click();
  });

  test('Square crop maintains 1:1 aspect lock', async ({ authenticatedPage: page }) => {
    // Click square crop button
    await page.getByTestId(CropTestIds.CROP_SQUARE_BUTTON).click();
    await page.waitForTimeout(500);

    // Verify mode shows "Square"
    const modeSelect = page.getByTestId(CropTestIds.CROP_MODE_SELECT);
    const modeText = await modeSelect.textContent();
    expect(modeText?.toLowerCase()).toContain('square');

    // Verify rectangle overlay with width === height
    const rect = page.getByTestId('crop-border-rect');
    await expect(rect).toBeVisible();

    const box = await rect.boundingBox();
    expect(box!.width).toBeCloseTo(box!.height, 1);

    // Try to drag corner handle diagonally (non-square)
    const handle = page.getByTestId(CropTestIds.CROP_HANDLE_BR);
    const handleBox = await handle.boundingBox();
    await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(150, 100);
    await page.mouse.up();
    await page.waitForTimeout(300);

    // Verify aspect ratio still maintained (still square)
    const newBox = await rect.boundingBox();
    expect(newBox!.width).toBeCloseTo(newBox!.height, 1);

    // Cancel
    await page.getByTestId(CropTestIds.CANCEL_CROP_BUTTON).click();
  });
});
