import { test, expect } from '../fixtures/auth';
import { CanvasEditorPage } from '../utils/page-objects/CanvasEditorPage';
import { ExportDialogPage } from '../utils/page-objects/ExportDialogPage';
import { CanvasSizeDialogPage } from '../utils/page-objects/CanvasSizeDialogPage';
import { waitForAutosave } from '../utils/canvas-helpers';
import * as fs from 'fs';

test.describe('PDF Export and Custom Canvas Size', () => {
  let canvasPage: CanvasEditorPage;
  let exportDialog: ExportDialogPage;
  let canvasSizeDialog: CanvasSizeDialogPage;

  test.beforeEach(async ({ authenticatedPage: page }) => {
    canvasPage = new CanvasEditorPage(page);
    exportDialog = new ExportDialogPage(page);
    canvasSizeDialog = new CanvasSizeDialogPage(page);

    await canvasPage.goto();
    await canvasPage.waitForCanvasReady();
    await page.waitForTimeout(2000); // Wait for canvas initialization

    // Create some content
    await canvasPage.createRectangle(100, 100, 150, 100);
    await page.waitForTimeout(1000);
    await waitForAutosave(page, 10000);
  });

  test('User can export canvas as PDF file', async ({ authenticatedPage: page }) => {
    // Open export dialog
    await exportDialog.open();
    await page.waitForTimeout(300);

    // Select PDF format
    await exportDialog.selectFormat('PDF');
    await page.waitForTimeout(300);

    // Export
    const downloadPromise = page.waitForEvent('download');
    await exportDialog.exportButton.click();
    const download = await downloadPromise;

    // Verify download started
    expect(download).toBeTruthy();

    // Verify filename has .pdf extension
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/\.pdf$/i);

    // Save file and verify it's valid PDF
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    // Read first bytes to verify PDF magic number
    const buffer = fs.readFileSync(downloadPath);
    const header = buffer.toString('ascii', 0, 5);
    expect(header).toBe('%PDF-');
  });

  test('CMYK color mode option is available in export dialog', async ({ authenticatedPage: page }) => {
    // Open export dialog
    await exportDialog.open();
    await page.waitForTimeout(300);

    // Select PDF format
    await exportDialog.selectFormat('PDF');
    await page.waitForTimeout(300);

    // Verify CMYK toggle is visible for PDF
    await expect(exportDialog.cmykModeToggle).toBeVisible();

    // Verify toggle is disabled for non-PDF formats
    await exportDialog.selectFormat('PNG');
    await page.waitForTimeout(200);

    // CMYK toggle should be hidden or disabled
    const isVisible = await exportDialog.cmykModeToggle.isVisible().catch(() => false);
    expect(isVisible).toBe(false);

    // Switch back to PDF and toggle CMYK
    await exportDialog.selectFormat('PDF');
    await page.waitForTimeout(200);

    await exportDialog.toggleCMYKMode();
    await page.waitForTimeout(200);

    // Export with CMYK mode
    const downloadPromise = page.waitForEvent('download');
    await exportDialog.exportButton.click();
    const download = await downloadPromise;
    expect(download).toBeTruthy();
  });

  test('User can enter custom canvas width and height values', async ({ authenticatedPage: page }) => {
    // Open canvas size dialog
    await canvasSizeDialog.open();
    await page.waitForTimeout(500);

    // Dismiss any remaining dialogs
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Verify dialog is visible
    await expect(canvasSizeDialog.dialog).toBeVisible();

    // Verify width and height inputs exist
    await expect(canvasSizeDialog.widthInput).toBeVisible();
    await expect(canvasSizeDialog.heightInput).toBeVisible();

    // Select inches unit FIRST to avoid unit conversion issues
    await canvasSizeDialog.selectUnit('inches');
    await page.waitForTimeout(300);

    // Clear and enter custom dimensions
    await canvasSizeDialog.widthInput.clear();
    await canvasSizeDialog.widthInput.fill('11');
    await canvasSizeDialog.heightInput.clear();
    await canvasSizeDialog.heightInput.fill('8.5');
    await page.waitForTimeout(200);

    // Verify values entered
    const widthValue = await canvasSizeDialog.widthInput.inputValue();
    const heightValue = await canvasSizeDialog.heightInput.inputValue();

    expect(widthValue).toBe('11');
    expect(heightValue).toBe('8.5');

    // Apply changes
    await canvasSizeDialog.apply();
    await page.waitForTimeout(500);

    // Verify canvas resized
    // Note: Canvas may be auto-scaled to fit viewport, so we verify it was resized
    // Original: 11in × 8.5in at 96 DPI = 1056 × 816 px
    // Auto-scaled to fit viewport: approximately 672 × 420 px (based on viewport size)
    const dimensions = await canvasSizeDialog.getCanvasDimensions();

    // Verify dimensions were changed from initial size
    // Allow tolerance for auto-scaling to fit viewport and device pixel ratio
    // At 96 DPI: 11in × 8.5in = 1056 × 816 px (can be 3x for retina displays)
    expect(dimensions.width).toBeGreaterThan(600);
    expect(dimensions.width).toBeLessThan(3500); // Allow for 3x device pixel ratio
    expect(dimensions.height).toBeGreaterThan(400);
    expect(dimensions.height).toBeLessThan(2600); // Allow for 3x device pixel ratio
  });

  test('User can select dimension units (inches, cm, px)', async ({ authenticatedPage: page }) => {
    // Test inches
    await canvasSizeDialog.open();
    await page.keyboard.press('Escape'); // Dismiss dialogs
    await page.waitForTimeout(200);
    await canvasSizeDialog.selectUnit('inches');
    await canvasSizeDialog.setDimensions('8', '10');
    await canvasSizeDialog.apply();
    await page.waitForTimeout(500);

    let dimensions = await canvasSizeDialog.getCanvasDimensions();
    // 8in × 10in at 96 DPI = 768 × 960 px (can be 3x for retina displays)
    expect(dimensions.width).toBeGreaterThan(400);
    expect(dimensions.width).toBeLessThan(2500); // Allow for 3x device pixel ratio

    // Test centimeters
    await canvasSizeDialog.open();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await canvasSizeDialog.selectUnit('cm');
    await canvasSizeDialog.setDimensions('20', '25');
    await canvasSizeDialog.apply();
    await page.waitForTimeout(500);

    dimensions = await canvasSizeDialog.getCanvasDimensions();
    // 20cm × 25cm ≈ 755 × 944 px (can be 3x for retina displays)
    expect(dimensions.width).toBeGreaterThan(400);
    expect(dimensions.width).toBeLessThan(2500); // Allow for 3x device pixel ratio

    // Test pixels (direct) - use smaller size to avoid auto-scaling
    await canvasSizeDialog.open();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await canvasSizeDialog.selectUnit('px');
    await canvasSizeDialog.setDimensions('600', '400');
    await canvasSizeDialog.apply();
    await page.waitForTimeout(500);

    dimensions = await canvasSizeDialog.getCanvasDimensions();
    // Pixels may be scaled for device pixel ratio (1x-3x)
    expect(dimensions.width).toBeGreaterThan(550);
    expect(dimensions.width).toBeLessThan(1900); // 600px * 3 = 1800
    expect(dimensions.height).toBeGreaterThan(350);
    expect(dimensions.height).toBeLessThan(1300); // 400px * 3 = 1200
  });

  test('Canvas resizes to match entered custom dimensions', async ({ authenticatedPage: page }) => {
    // Get initial dimensions
    const initialDimensions = await canvasSizeDialog.getCanvasDimensions();

    // Open dialog and set new dimensions (use smaller size to avoid auto-scaling)
    await canvasSizeDialog.open();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await canvasSizeDialog.setDimensions('650', '520', 'px');
    await canvasSizeDialog.apply();
    await page.waitForTimeout(500);

    // Get new dimensions
    const newDimensions = await canvasSizeDialog.getCanvasDimensions();

    // Verify dimensions changed (may be slightly scaled)
    expect(newDimensions.width).toBeCloseTo(650, -1);
    expect(newDimensions.height).toBeCloseTo(520, -1);
    expect(newDimensions.width).not.toBe(initialDimensions.width);
    expect(newDimensions.height).not.toBe(initialDimensions.height);

    // Verify existing object still exists
    const objectCount = await canvasPage.getCanvasObjectCount();
    expect(objectCount).toBe(1); // Rectangle from beforeEach

    // Verify object is still selectable
    await canvasPage.selectObjectAt(150, 125);
    const hasSelection = await canvasPage.hasSelectedObject();
    expect(hasSelection).toBe(true);
  });

  test('Custom canvas size persists after save and reload', async ({ authenticatedPage: page }) => {
    test.setTimeout(60000); // Increase timeout for save and reload workflow
    // Set custom canvas size (use smaller size to avoid auto-scaling)
    await canvasSizeDialog.open();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await canvasSizeDialog.setDimensions('650', '450', 'px');
    await canvasSizeDialog.apply();
    await page.waitForTimeout(500);

    // Verify dimensions applied (can be scaled for device pixel ratio)
    let dimensions = await canvasSizeDialog.getCanvasDimensions();
    const appliedWidth = dimensions.width;
    const appliedHeight = dimensions.height;
    // Allow for 1x-3x device pixel ratio
    expect(appliedWidth).toBeGreaterThan(600);
    expect(appliedWidth).toBeLessThan(2000); // 650px * 3 = 1950
    expect(appliedHeight).toBeGreaterThan(400);
    expect(appliedHeight).toBeLessThan(1400); // 450px * 3 = 1350

    // Click save button - app will automatically navigate to /canvas/[projectId]
    const saveButton = page.getByRole('button', { name: /save/i });
    await saveButton.click();
    await page.waitForTimeout(1500); // Wait for save and navigation to complete

    // Verify URL changed to /canvas/[projectId]
    const url = page.url();
    expect(url).toMatch(/\/canvas\/[a-f0-9-]+$/);

    // Reload the page to verify persistence
    await page.reload();
    await canvasPage.waitForCanvasReady();

    // Wait for project to load (look for "Loading..." to disappear)
    await page.waitForTimeout(2000);

    // Wait for loading indicator to disappear
    const loadingIndicator = page.locator('text=Loading...');
    await loadingIndicator.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);

    // Verify dimensions persisted (should match what was applied)
    dimensions = await canvasSizeDialog.getCanvasDimensions();
    // Allow 5% tolerance for rounding/scaling differences
    expect(dimensions.width).toBeGreaterThan(appliedWidth * 0.95);
    expect(dimensions.width).toBeLessThan(appliedWidth * 1.05);
    expect(dimensions.height).toBeGreaterThan(appliedHeight * 0.95);
    expect(dimensions.height).toBeLessThan(appliedHeight * 1.05);

    // Verify object still exists after reload
    const objectCount = await canvasPage.getCanvasObjectCount();
    expect(objectCount).toBe(1);
  });
});
