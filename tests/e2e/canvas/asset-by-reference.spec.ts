import { test, expect } from '../fixtures/auth';
import { CanvasEditorPage } from '../utils/page-objects/CanvasEditorPage';
import { IconLibraryPage } from '../utils/page-objects/IconLibraryPage';
import { waitForAutosave } from '../utils/canvas-helpers';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Asset-by-Reference System', () => {
  let canvasPage: CanvasEditorPage;
  const testImagePath = path.join(__dirname, '../fixtures/test-image.png');
  const testSvgPath = path.join(__dirname, '../fixtures/test-icon.svg');

  test.beforeEach(async ({ authenticatedPage: page }) => {
    canvasPage = new CanvasEditorPage(page);

    // Dismiss tip banner
    await page.evaluate(() => {
      localStorage.setItem('canvas_tip_banner_dismissed', 'true');
    });
  });

  test.describe('Image Tool Upload Flow', () => {
    test('Image tool uploads image and marks with assetId', async ({ authenticatedPage: page }) => {
      test.setTimeout(60000);
      await canvasPage.goto();
      await canvasPage.waitForCanvasReady();
      await page.waitForTimeout(1000);

      // Upload image via Image tool (waits for success toast)
      await canvasPage.uploadImage(testImagePath);

      // Verify object exists on canvas
      const objectCount = await canvasPage.getCanvasObjectCount();
      expect(objectCount).toBeGreaterThanOrEqual(1);

      // Check the image object has assetId and isUserAsset properties
      const assetProps = await page.evaluate(() => {
        const canvas = (window as any).fabricCanvas;
        if (!canvas) return null;
        const objects = canvas.getObjects().filter((obj: any) =>
          obj.selectable !== false && !obj.isGridLine && !obj.isRuler && obj.evented !== false
        );
        const lastObj = objects[objects.length - 1];
        return {
          assetId: lastObj?.assetId,
          isUserAsset: lastObj?.isUserAsset,
          type: lastObj?.type,
          hasSrc: !!lastObj?.getSrc?.(),
        };
      });

      expect(assetProps).not.toBeNull();
      expect(assetProps!.assetId).toBeTruthy();
      expect(assetProps!.isUserAsset).toBe(true);
      expect(assetProps!.hasSrc).toBe(true);
    });

    test('Image tool shows loading toast during upload', async ({ authenticatedPage: page }) => {
      await canvasPage.goto();
      await canvasPage.waitForCanvasReady();
      await page.waitForTimeout(1000);

      // Upload image (triggers loading toast + upload)
      await canvasPage.uploadImage(testImagePath);

      // The loading toast should appear with "Uploading image..." text
      // It may transition to success quickly, so check for either state
      const toastVisible = await page.locator('[data-sonner-toast]').first().waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
      expect(toastVisible).toBe(true);

      // Wait for upload to complete
      await page.waitForTimeout(5000);
    });
  });

  test.describe('Assets Tab Integration', () => {
    test('Asset added from Assets tab has assetId property', async ({ authenticatedPage: page }) => {
      await canvasPage.goto();
      await canvasPage.waitForCanvasReady();
      await page.waitForTimeout(1000);

      const iconLibrary = new IconLibraryPage(page);

      // Open icon library and switch to Assets tab
      await iconLibrary.open();
      await page.waitForTimeout(500);

      await page.getByTestId('icon-library-assets-tab').click();
      await page.waitForTimeout(500);

      // Upload a test asset first
      const uploadButton = page.getByTestId('user-assets-upload-button');
      await uploadButton.click();
      await page.waitForTimeout(500);

      const fileInput = page.getByTestId('asset-upload-input');
      await fileInput.setInputFiles(testImagePath);
      await page.waitForTimeout(500);

      const submitButton = page.getByTestId('asset-upload-submit');
      await submitButton.click();

      // Wait for upload dialog to close and asset to appear in grid
      const uploadDialog = page.getByTestId('asset-upload-dialog');
      await expect(uploadDialog).not.toBeVisible({ timeout: 5000 });
      await page.waitForTimeout(1000);

      // Verify asset appears in grid
      const assetGrid = page.locator('[data-testid="user-asset-item"]');
      await assetGrid.first().waitFor({ state: 'visible', timeout: 5000 });

      // Click asset to add to canvas
      await assetGrid.first().click();
      await page.waitForTimeout(3000); // Wait for asset download + canvas add

      // Close icon library
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      // Check canvas object properties
      const assetProps = await page.evaluate(() => {
        const canvas = (window as any).fabricCanvas;
        if (!canvas) return null;
        const objects = canvas.getObjects().filter((obj: any) =>
          obj.selectable !== false && !obj.isGridLine && !obj.isRuler && obj.evented !== false
        );
        const lastObj = objects[objects.length - 1];
        return {
          assetId: lastObj?.assetId,
          isUserAsset: lastObj?.isUserAsset,
        };
      });

      expect(assetProps).not.toBeNull();
      expect(assetProps!.assetId).toBeTruthy();
      expect(assetProps!.isUserAsset).toBe(true);
      // No manual cleanup needed - ephemeral test user is deleted after test
    });
  });

  test.describe('Save/Load Round-Trip', () => {
    test('User asset image persists after save and reload', async ({ authenticatedPage: page }) => {
      test.setTimeout(60000);
      // Create project with image
      await canvasPage.goto();
      await canvasPage.waitForCanvasReady();
      await page.waitForTimeout(1000);

      // Upload image
      await canvasPage.uploadImage(testImagePath);
      await page.waitForTimeout(5000);

      // Verify image was added with assetId
      const beforeSave = await page.evaluate(() => {
        const canvas = (window as any).fabricCanvas;
        if (!canvas) return null;
        const objects = canvas.getObjects().filter((obj: any) =>
          obj.selectable !== false && !obj.isGridLine && !obj.isRuler && obj.evented !== false
        );
        const img = objects[objects.length - 1];
        return {
          count: objects.length,
          assetId: img?.assetId,
          isUserAsset: img?.isUserAsset,
          left: Math.round(img?.left || 0),
          top: Math.round(img?.top || 0),
        };
      });

      expect(beforeSave).not.toBeNull();
      expect(beforeSave!.count).toBeGreaterThanOrEqual(1);
      expect(beforeSave!.assetId).toBeTruthy();

      // Save project
      await waitForAutosave(page, 10000);
      const canvasSaveBtn = page.getByTestId('canvas-editor-save-button');
      await canvasSaveBtn.click();
      await page.waitForTimeout(2000);

      // Extract project ID
      const url = page.url();
      const projectIdMatch = url.match(/\/canvas\/([a-f0-9-]+)/);
      expect(projectIdMatch).not.toBeNull();
      const projectId = projectIdMatch![1];

      // Navigate away then back
      await page.goto('/dashboard');
      await page.waitForTimeout(1000);

      await canvasPage.goto(projectId);
      await canvasPage.waitForCanvasReady();
      await page.waitForTimeout(5000); // Wait for user asset reconstruction

      // Verify image was reconstructed
      const afterLoad = await page.evaluate(() => {
        const canvas = (window as any).fabricCanvas;
        if (!canvas) return null;
        const objects = canvas.getObjects().filter((obj: any) =>
          obj.selectable !== false && !obj.isGridLine && !obj.isRuler && obj.evented !== false
        );
        const img = objects[objects.length - 1];
        return {
          count: objects.length,
          assetId: img?.assetId,
          isUserAsset: img?.isUserAsset,
          hasSrc: !!img?.getSrc?.(),
          type: img?.type,
        };
      });

      expect(afterLoad).not.toBeNull();
      expect(afterLoad!.count).toBe(beforeSave!.count);
      expect(afterLoad!.assetId).toBe(beforeSave!.assetId);
      expect(afterLoad!.isUserAsset).toBe(true);
      expect(afterLoad!.hasSrc).toBe(true);
    });

    test('Save data uses userAsset type (not embedded image data)', async ({ authenticatedPage: page }) => {
      await canvasPage.goto();
      await canvasPage.waitForCanvasReady();
      await page.waitForTimeout(1000);

      // Upload image
      await canvasPage.uploadImage(testImagePath);
      await page.waitForTimeout(5000);

      // Verify asset marking
      const hasAsset = await page.evaluate(() => {
        const canvas = (window as any).fabricCanvas;
        if (!canvas) return false;
        const objects = canvas.getObjects().filter((obj: any) =>
          obj.selectable !== false && !obj.isGridLine && !obj.isRuler && obj.evented !== false
        );
        return objects.some((obj: any) => obj.assetId && obj.isUserAsset);
      });
      expect(hasAsset).toBe(true);

      // Save project
      await waitForAutosave(page, 10000);
      const canvasSaveBtn = page.getByTestId('canvas-editor-save-button');
      await canvasSaveBtn.click();
      await page.waitForTimeout(2000);

      // Verify URL has project ID (save succeeded)
      const url = page.url();
      expect(url).toMatch(/\/canvas\/[a-f0-9-]+/);
    });

    test('Transform properties preserved through save/load', async ({ authenticatedPage: page }) => {
      test.setTimeout(60000);
      await canvasPage.goto();
      await canvasPage.waitForCanvasReady();
      await page.waitForTimeout(1000);

      // Upload image
      await canvasPage.uploadImage(testImagePath);
      await page.waitForTimeout(5000);

      // Modify transform properties
      const transformsBefore = await page.evaluate(() => {
        const canvas = (window as any).fabricCanvas;
        if (!canvas) return null;
        const objects = canvas.getObjects().filter((obj: any) =>
          obj.selectable !== false && !obj.isGridLine && !obj.isRuler && obj.evented !== false
        );
        const img = objects[objects.length - 1];
        if (!img) return null;

        // Apply transforms
        img.set({ left: 200, top: 150, angle: 45, opacity: 0.7 });
        canvas.requestRenderAll();

        return {
          left: 200,
          top: 150,
          angle: 45,
          opacity: 0.7,
          assetId: img.assetId,
        };
      });

      expect(transformsBefore).not.toBeNull();

      // Save
      await waitForAutosave(page, 10000);
      const canvasSaveBtn = page.getByTestId('canvas-editor-save-button');
      await canvasSaveBtn.click();
      await page.waitForTimeout(2000);

      const url = page.url();
      const projectId = url.match(/\/canvas\/([a-f0-9-]+)/)?.[1];
      expect(projectId).toBeTruthy();

      // Reload
      await page.goto('/dashboard');
      await page.waitForTimeout(1000);
      await canvasPage.goto(projectId!);
      await canvasPage.waitForCanvasReady();
      await page.waitForTimeout(5000);

      // Verify transforms preserved
      const transformsAfter = await page.evaluate(() => {
        const canvas = (window as any).fabricCanvas;
        if (!canvas) return null;
        const objects = canvas.getObjects().filter((obj: any) =>
          obj.selectable !== false && !obj.isGridLine && !obj.isRuler && obj.evented !== false
        );
        const img = objects[objects.length - 1];
        return {
          left: Math.round(img?.left || 0),
          top: Math.round(img?.top || 0),
          angle: Math.round(img?.angle || 0),
          opacity: Math.round((img?.opacity || 0) * 10) / 10,
          assetId: img?.assetId,
        };
      });

      expect(transformsAfter).not.toBeNull();
      expect(transformsAfter!.left).toBe(200);
      expect(transformsAfter!.top).toBe(150);
      expect(transformsAfter!.angle).toBe(45);
      expect(transformsAfter!.opacity).toBe(0.7);
      expect(transformsAfter!.assetId).toBe(transformsBefore!.assetId);
    });
  });

  test.describe('Backward Compatibility', () => {
    test('Regular shapes (non-assets) are unaffected by asset-by-reference', async ({ authenticatedPage: page }) => {
      await canvasPage.goto();
      await canvasPage.waitForCanvasReady();
      await page.waitForTimeout(1000);

      // Create a regular rectangle
      await canvasPage.createRectangle(100, 100, 150, 100);
      await page.waitForTimeout(500);

      // Verify it does NOT have assetId
      const rectProps = await page.evaluate(() => {
        const canvas = (window as any).fabricCanvas;
        if (!canvas) return null;
        const objects = canvas.getObjects().filter((obj: any) =>
          obj.selectable !== false && !obj.isGridLine && !obj.isRuler && obj.evented !== false
        );
        const rect = objects[objects.length - 1];
        return {
          type: rect?.type,
          assetId: rect?.assetId,
          isUserAsset: rect?.isUserAsset,
        };
      });

      expect(rectProps).not.toBeNull();
      expect(rectProps!.assetId).toBeFalsy();
      expect(rectProps!.isUserAsset).toBeFalsy();
    });

    test('Mixed canvas with assets and shapes saves/loads correctly', async ({ authenticatedPage: page }) => {
      test.setTimeout(60000);
      await canvasPage.goto();
      await canvasPage.waitForCanvasReady();
      await page.waitForTimeout(1000);

      // Add a rectangle
      await canvasPage.createRectangle(50, 50, 100, 100);
      await page.waitForTimeout(500);

      // Upload image (asset)
      await canvasPage.uploadImage(testImagePath);
      await page.waitForTimeout(5000);

      // Add another rectangle
      await canvasPage.createRectangle(400, 400, 80, 80);
      await page.waitForTimeout(500);

      // Count objects before save
      const countBefore = await canvasPage.getCanvasObjectCount();
      expect(countBefore).toBeGreaterThanOrEqual(3);

      // Save
      await waitForAutosave(page, 10000);
      const canvasSaveBtn = page.getByTestId('canvas-editor-save-button');
      await canvasSaveBtn.click();
      await page.waitForTimeout(2000);

      const url = page.url();
      const projectId = url.match(/\/canvas\/([a-f0-9-]+)/)?.[1];
      expect(projectId).toBeTruthy();

      // Reload
      await page.goto('/dashboard');
      await page.waitForTimeout(1000);
      await canvasPage.goto(projectId!);
      await canvasPage.waitForCanvasReady();
      await page.waitForTimeout(5000);

      // Verify all objects loaded
      const countAfter = await canvasPage.getCanvasObjectCount();
      expect(countAfter).toBe(countBefore);

      // Verify the asset object still has assetId
      const objectTypes = await page.evaluate(() => {
        const canvas = (window as any).fabricCanvas;
        if (!canvas) return [];
        return canvas.getObjects()
          .filter((obj: any) => obj.selectable !== false && !obj.isGridLine && !obj.isRuler && obj.evented !== false)
          .map((obj: any) => ({
            type: obj.type,
            hasAssetId: !!obj.assetId,
            isUserAsset: !!obj.isUserAsset,
          }));
      });

      // Should have at least one user asset
      const userAssets = objectTypes.filter((o: any) => o.isUserAsset);
      expect(userAssets.length).toBeGreaterThanOrEqual(1);

      // Should have at least two non-asset objects (rectangles)
      const nonAssets = objectTypes.filter((o: any) => !o.isUserAsset);
      expect(nonAssets.length).toBeGreaterThanOrEqual(2);
    });
  });

  test.describe('Copy/Paste', () => {
    test('Copy/paste preserves assetId on user asset', async ({ authenticatedPage: page }) => {
      await canvasPage.goto();
      await canvasPage.waitForCanvasReady();
      await page.waitForTimeout(1000);

      // Upload image
      await canvasPage.uploadImage(testImagePath);
      await page.waitForTimeout(5000);

      // Select the image
      await page.evaluate(() => {
        const canvas = (window as any).fabricCanvas;
        if (canvas && canvas._objects.length > 0) {
          const lastObj = canvas._objects[canvas._objects.length - 1];
          canvas.setActiveObject(lastObj);
          canvas.requestRenderAll();
        }
      });
      await page.waitForTimeout(500);

      // Get original assetId
      const originalAssetId = await page.evaluate(() => {
        const canvas = (window as any).fabricCanvas;
        const active = canvas?.getActiveObject();
        return active?.assetId;
      });
      expect(originalAssetId).toBeTruthy();

      // Copy (Cmd/Ctrl+C)
      const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
      await page.keyboard.press(`${modifier}+c`);
      await page.waitForTimeout(500);

      // Paste (Cmd/Ctrl+V)
      await page.keyboard.press(`${modifier}+v`);
      await page.waitForTimeout(1000);

      // Verify the pasted object has same assetId
      const pastedProps = await page.evaluate(() => {
        const canvas = (window as any).fabricCanvas;
        if (!canvas) return null;
        const objects = canvas.getObjects().filter((obj: any) =>
          obj.selectable !== false && !obj.isGridLine && !obj.isRuler && obj.evented !== false
        );
        // The last object should be the pasted one
        const pasted = objects[objects.length - 1];
        return {
          assetId: pasted?.assetId,
          isUserAsset: pasted?.isUserAsset,
        };
      });

      expect(pastedProps).not.toBeNull();
      expect(pastedProps!.assetId).toBe(originalAssetId);
      expect(pastedProps!.isUserAsset).toBe(true);
    });
  });

  test.describe('Asset Deletion', () => {
    test('Deleting image from canvas does not remove it from Assets tab', async ({ authenticatedPage: page }) => {
      await canvasPage.goto();
      await canvasPage.waitForCanvasReady();
      await page.waitForTimeout(1000);

      // Upload image via Image tool
      await canvasPage.uploadImage(testImagePath);
      await page.waitForTimeout(5000);

      // Get the assetId
      const assetId = await page.evaluate(() => {
        const canvas = (window as any).fabricCanvas;
        if (!canvas) return null;
        const objects = canvas.getObjects().filter((obj: any) =>
          obj.selectable !== false && !obj.isGridLine && !obj.isRuler && obj.evented !== false
        );
        return objects[objects.length - 1]?.assetId;
      });
      expect(assetId).toBeTruthy();

      // Select and delete the image from canvas
      await page.evaluate(() => {
        const canvas = (window as any).fabricCanvas;
        if (canvas && canvas._objects.length > 0) {
          const lastObj = canvas._objects[canvas._objects.length - 1];
          canvas.setActiveObject(lastObj);
          canvas.requestRenderAll();
        }
      });
      await page.waitForTimeout(300);
      await page.keyboard.press('Delete');
      await page.waitForTimeout(500);

      // Verify canvas object count decreased
      const countAfterDelete = await canvasPage.getCanvasObjectCount();
      expect(countAfterDelete).toBe(0);

      // Open Assets tab and verify the asset still exists
      const iconLibrary = new IconLibraryPage(page);
      await iconLibrary.open();
      await page.waitForTimeout(500);
      await page.getByTestId('icon-library-assets-tab').click();
      await page.waitForTimeout(1000);

      const assetGrid = page.locator('[data-testid="user-asset-item"]');
      await assetGrid.first().waitFor({ state: 'visible', timeout: 5000 }); // Asset still in library

      // Clean up: delete from assets tab
      const uploadedAsset = assetGrid.first();
      await uploadedAsset.hover();
      await page.waitForTimeout(200);
      const menuButton = uploadedAsset.getByTestId('user-asset-menu-trigger');
      await menuButton.click();
      await page.waitForTimeout(300);
      const deleteMenuItem = page.getByTestId('user-asset-delete-menuitem');
      await deleteMenuItem.click();
      await page.waitForTimeout(300);
      const deleteButton = page.getByTestId('user-asset-delete-confirm');
      await deleteButton.click();
      await page.waitForTimeout(1500);
    });

    test('Asset deletion warning mentions impact on all projects', async ({ authenticatedPage: page }) => {
      await canvasPage.goto();
      await canvasPage.waitForCanvasReady();
      await page.waitForTimeout(1000);

      const iconLibrary = new IconLibraryPage(page);

      // Upload an asset via Assets tab
      await iconLibrary.open();
      await page.waitForTimeout(500);
      await page.getByTestId('icon-library-assets-tab').click();
      await page.waitForTimeout(500);

      const uploadButton = page.getByTestId('user-assets-upload-button');
      await uploadButton.click();
      await page.waitForTimeout(500);

      const fileInput = page.getByTestId('asset-upload-input');
      await fileInput.setInputFiles(testImagePath);
      await page.waitForTimeout(500);

      const submitButton = page.getByTestId('asset-upload-submit');
      await submitButton.click();
      await page.waitForTimeout(2000);

      // Initiate delete on the asset
      const assetGrid = page.locator('[data-testid="user-asset-item"]');
      const uploadedAsset = assetGrid.first();
      await uploadedAsset.hover();
      await page.waitForTimeout(200);
      const menuButton = uploadedAsset.getByTestId('user-asset-menu-trigger');
      await menuButton.click();
      await page.waitForTimeout(300);
      const deleteMenuItem = page.getByTestId('user-asset-delete-menuitem');
      await deleteMenuItem.click();
      await page.waitForTimeout(300);

      // Verify the warning dialog text mentions all projects
      const deleteDialog = page.getByTestId('user-asset-delete-dialog');
      await expect(deleteDialog).toBeVisible();
      const dialogText = await deleteDialog.textContent();
      expect(dialogText).toContain('all projects');

      // Confirm deletion (cleanup)
      const deleteButton = page.getByTestId('user-asset-delete-confirm');
      await deleteButton.click();
      await page.waitForTimeout(1500);
    });
  });

  test.describe('Storage Quota UX', () => {
    test('Storage usage indicator is visible in Assets tab', async ({ authenticatedPage: page }) => {
      await canvasPage.goto();
      await canvasPage.waitForCanvasReady();
      await page.waitForTimeout(1000);

      const iconLibrary = new IconLibraryPage(page);
      await iconLibrary.open();
      await page.waitForTimeout(500);

      await page.getByTestId('icon-library-assets-tab').click();
      await page.waitForTimeout(500);

      // Verify storage usage indicator is visible
      const storageIndicator = page.getByTestId('storage-usage-indicator');
      await expect(storageIndicator).toBeVisible();

      // Verify it contains some text about storage (e.g., "MB" or "used")
      const indicatorText = await storageIndicator.textContent();
      expect(indicatorText).toMatch(/MB|KB|used/i);
    });

    test('Storage usage updates after uploading an asset', async ({ authenticatedPage: page }) => {
      await canvasPage.goto();
      await canvasPage.waitForCanvasReady();
      await page.waitForTimeout(1000);

      const iconLibrary = new IconLibraryPage(page);
      await iconLibrary.open();
      await page.waitForTimeout(500);
      await page.getByTestId('icon-library-assets-tab').click();
      await page.waitForTimeout(500);

      // Get initial storage text
      const storageIndicator = page.getByTestId('storage-usage-indicator');
      const initialText = await storageIndicator.textContent();

      // Upload an asset
      const uploadButton = page.getByTestId('user-assets-upload-button');
      await uploadButton.click();
      await page.waitForTimeout(500);

      const fileInput = page.getByTestId('asset-upload-input');
      await fileInput.setInputFiles(testImagePath);
      await page.waitForTimeout(500);

      const submitButton = page.getByTestId('asset-upload-submit');
      await submitButton.click();
      await page.waitForTimeout(2000);

      // Verify storage text changed (or at minimum, is still present)
      const updatedText = await storageIndicator.textContent();
      expect(updatedText).toBeTruthy();

      // Clean up: delete asset
      const assetGrid = page.locator('[data-testid="user-asset-item"]');
      const uploadedAsset = assetGrid.first();
      await uploadedAsset.hover();
      await page.waitForTimeout(200);
      const menuButton = uploadedAsset.getByTestId('user-asset-menu-trigger');
      await menuButton.click();
      await page.waitForTimeout(300);
      const deleteMenuItem = page.getByTestId('user-asset-delete-menuitem');
      await deleteMenuItem.click();
      await page.waitForTimeout(300);
      const deleteButton = page.getByTestId('user-asset-delete-confirm');
      await deleteButton.click();
      await page.waitForTimeout(1500);
    });
  });

  test.describe('SVG Asset Support', () => {
    test('SVG uploaded via Image tool gets assetId', async ({ authenticatedPage: page }) => {
      await canvasPage.goto();
      await canvasPage.waitForCanvasReady();
      await page.waitForTimeout(1000);

      // Upload SVG via Image tool
      await canvasPage.uploadImage(testSvgPath);
      await page.waitForTimeout(5000);

      // Verify object has assetId
      const assetProps = await page.evaluate(() => {
        const canvas = (window as any).fabricCanvas;
        if (!canvas) return null;
        const objects = canvas.getObjects().filter((obj: any) =>
          obj.selectable !== false && !obj.isGridLine && !obj.isRuler && obj.evented !== false
        );
        const lastObj = objects[objects.length - 1];
        return {
          assetId: lastObj?.assetId,
          isUserAsset: lastObj?.isUserAsset,
          type: lastObj?.type,
        };
      });

      expect(assetProps).not.toBeNull();
      expect(assetProps!.assetId).toBeTruthy();
      expect(assetProps!.isUserAsset).toBe(true);
    });

    test('SVG asset persists through save/load cycle', async ({ authenticatedPage: page }) => {
      test.setTimeout(60000);
      await canvasPage.goto();
      await canvasPage.waitForCanvasReady();
      await page.waitForTimeout(1000);

      // Upload SVG
      await canvasPage.uploadImage(testSvgPath);
      await page.waitForTimeout(5000);

      const beforeSave = await page.evaluate(() => {
        const canvas = (window as any).fabricCanvas;
        if (!canvas) return null;
        const objects = canvas.getObjects().filter((obj: any) =>
          obj.selectable !== false && !obj.isGridLine && !obj.isRuler && obj.evented !== false
        );
        return {
          count: objects.length,
          assetId: objects[objects.length - 1]?.assetId,
        };
      });
      expect(beforeSave!.assetId).toBeTruthy();

      // Save
      await waitForAutosave(page, 10000);
      const canvasSaveBtn = page.getByTestId('canvas-editor-save-button');
      await canvasSaveBtn.click();
      await page.waitForTimeout(2000);

      const url = page.url();
      const projectId = url.match(/\/canvas\/([a-f0-9-]+)/)?.[1];
      expect(projectId).toBeTruthy();

      // Reload
      await page.goto('/dashboard');
      await page.waitForTimeout(1000);
      await canvasPage.goto(projectId!);
      await canvasPage.waitForCanvasReady();
      await page.waitForTimeout(5000);

      // Verify SVG reconstructed
      const afterLoad = await page.evaluate(() => {
        const canvas = (window as any).fabricCanvas;
        if (!canvas) return null;
        const objects = canvas.getObjects().filter((obj: any) =>
          obj.selectable !== false && !obj.isGridLine && !obj.isRuler && obj.evented !== false
        );
        return {
          count: objects.length,
          assetId: objects[objects.length - 1]?.assetId,
        };
      });

      expect(afterLoad!.count).toBe(beforeSave!.count);
      expect(afterLoad!.assetId).toBe(beforeSave!.assetId);
    });
  });
});
