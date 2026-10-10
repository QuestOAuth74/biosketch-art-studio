import { test, expect } from '../fixtures/auth';
import { CanvasEditorPage } from '../utils/page-objects/CanvasEditorPage';
import { isGridVisible, isObjectSnappedToGrid } from '../utils/canvas-helpers';

test.describe('Canvas Core Functionality', () => {
  let canvasPage: CanvasEditorPage;

  test.beforeEach(async ({ authenticatedPage: page }) => {
    canvasPage = new CanvasEditorPage(page);
    await canvasPage.goto();
    await canvasPage.waitForCanvasReady();
  });

  test('User can create, select, and modify objects on canvas', async ({ authenticatedPage: page }) => {
    // Create a rectangle
    await canvasPage.createRectangle(100, 100, 150, 100);
    await page.waitForTimeout(500);

    // Verify object was created
    const objectCount = await canvasPage.getCanvasObjectCount();
    expect(objectCount).toBe(1);

    // Select the object
    await canvasPage.selectObjectAt(175, 150);
    await page.waitForTimeout(300);

    // Verify object is selected
    const hasSelection = await canvasPage.hasSelectedObject();
    expect(hasSelection).toBe(true);

    // Modify object dimensions
    await canvasPage.setObjectWidth('200');
    await page.waitForTimeout(300);

    // Verify dimensions changed
    const width = await canvasPage.getObjectWidth();
    expect(width).toBe('200');
  });

  test('User can use undo/redo to navigate history', async ({ authenticatedPage: page }) => {
    // Wait for initial history state to be saved (200ms delay in CanvasContext.tsx)
    await page.waitForTimeout(500);

    // Check initial state
    const initialCount = await canvasPage.getCanvasObjectCount();
    expect(initialCount).toBe(0);

    // Create first rectangle
    await canvasPage.createRectangle(50, 50, 100, 100);
    await page.waitForTimeout(1000);

    let objectCount = await canvasPage.getCanvasObjectCount();
    expect(objectCount).toBe(1);

    // Create second rectangle
    await canvasPage.createRectangle(200, 200, 100, 100);
    await page.waitForTimeout(1000);

    objectCount = await canvasPage.getCanvasObjectCount();
    expect(objectCount).toBe(2);

    // Undo - removes selection state
    // (History has steps: 0=empty, 1=rect1 added, 2=rect2 added, 3=selection state)
    await canvasPage.undo();
    await page.waitForTimeout(500);

    objectCount = await canvasPage.getCanvasObjectCount();
    expect(objectCount).toBe(2);

    // Undo - should remove second rectangle
    await canvasPage.undo();
    await page.waitForTimeout(500);

    objectCount = await canvasPage.getCanvasObjectCount();
    expect(objectCount).toBe(1);

    // Undo - should remove first rectangle
    await canvasPage.undo();
    await page.waitForTimeout(500);

    objectCount = await canvasPage.getCanvasObjectCount();
    expect(objectCount).toBe(0);

    // Redo - should restore first rectangle
    await canvasPage.redo();
    await page.waitForTimeout(500);

    objectCount = await canvasPage.getCanvasObjectCount();
    expect(objectCount).toBe(1);

    // Redo - should restore second rectangle
    await canvasPage.redo();
    await page.waitForTimeout(500);

    objectCount = await canvasPage.getCanvasObjectCount();
    expect(objectCount).toBe(2);

    // Redo - should restore selection state
    await canvasPage.redo();
    await page.waitForTimeout(500);

    objectCount = await canvasPage.getCanvasObjectCount();
    expect(objectCount).toBe(2);
  });

  test('Grid snapping works when enabled', async ({ authenticatedPage: page }) => {
    // Enable grid
    await canvasPage.toggleGrid();

    // Verify grid is enabled (check state instead of looking for objects)
    const gridEnabled = await page.evaluate(() => {
      const context = (window as any).canvasContext;
      return context?.gridEnabled === true;
    });
    expect(gridEnabled).toBe(true);

    // Enable snap to grid
    await canvasPage.toggleSnapToGrid();

    // Create rectangle with non-grid-aligned coordinates
    await canvasPage.createRectangle(103, 97, 80, 60);
    await page.waitForTimeout(500);

    // Verify object snapped to grid (default grid size: 20px)
    const isSnapped = await isObjectSnappedToGrid(page, 0, 20);
    expect(isSnapped).toBe(true);
  });

  test('Multi-object selection and grouping works', async ({ authenticatedPage: page }) => {
    // Create two rectangles
    await canvasPage.createRectangle(50, 50, 80, 80);
    await page.waitForTimeout(300);

    await canvasPage.createRectangle(200, 200, 80, 80);
    await page.waitForTimeout(300);

    let objectCount = await canvasPage.getCanvasObjectCount();
    expect(objectCount).toBe(2);

    // Multi-select both objects
    await canvasPage.multiSelectObjectsAt([
      { x: 90, y: 90 },
      { x: 240, y: 240 },
    ]);
    await page.waitForTimeout(500);

    // Verify multi-selection
    const selectionInfo = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      if (!canvas) return { hasActive: false, type: null, count: 0, objects: [] };
      const activeObject = canvas.getActiveObject();
      let count = 0;
      let objects = [];

      if (activeObject) {
        if (activeObject.type === 'activeSelection' || activeObject.type === 'activeselection') {
          count = activeObject._objects?.length || 0;
          objects = (activeObject._objects || []).map((o: any) => o.type);
        } else {
          count = 1;
          objects = [activeObject.type];
        }
      }

      return {
        hasActive: !!activeObject,
        type: activeObject?.type || null,
        count,
        objects
      };
    });

    const hasMultiSelection = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      if (!canvas) return false;
      const activeObject = canvas.getActiveObject();
      // Check for both camelCase and lowercase (different Fabric.js versions)
      return activeObject && (activeObject.type === 'activeSelection' || activeObject.type === 'activeselection');
    });
    expect(hasMultiSelection).toBe(true);

    // Group the selected objects
    await canvasPage.groupSelected();
    await page.waitForTimeout(500);

    // Verify group was created (2 objects become 1 group)
    objectCount = await canvasPage.getCanvasObjectCount();
    expect(objectCount).toBe(1);

    const isGroup = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      if (!canvas) return false;
      // Filter user objects (same logic as getCanvasObjectCount)
      const userObjects = canvas.getObjects().filter((obj: any) => {
        return obj.selectable !== false &&
               !obj.isGridLine &&
               !obj.isRuler &&
               !obj.evented === false;
      });
      return userObjects.length === 1 && userObjects[0].type === 'group';
    });
    expect(isGroup).toBe(true);

    // Ungroup
    await canvasPage.selectObjectAt(120, 120);
    await page.waitForTimeout(300);
    await canvasPage.ungroupSelected();
    await page.waitForTimeout(500);

    // Verify objects are ungrouped (1 group becomes 2 objects)
    objectCount = await canvasPage.getCanvasObjectCount();
    expect(objectCount).toBe(2);
  });

  test('Layer visibility toggle hides/shows objects', async ({ authenticatedPage: page }) => {
    // Create a rectangle
    await canvasPage.createRectangle(100, 100, 100, 100);
    await page.waitForTimeout(500);

    // Verify object is visible
    let isVisible = await page.evaluate((index) => {
      const canvas = (window as any).fabricCanvas;
      if (!canvas) return false;
      const userObjects = canvas.getObjects().filter((obj: any) =>
        !obj.isGridLine && !obj.isRuler && !obj.isEraserPath
      );
      return userObjects[index] ? userObjects[index].visible : false;
    }, 0);
    expect(isVisible).toBe(true);

    // Toggle layer visibility off
    await canvasPage.toggleLayerVisibility(0);
    await page.waitForTimeout(500);

    // Verify object is hidden
    isVisible = await page.evaluate((index) => {
      const canvas = (window as any).fabricCanvas;
      if (!canvas) return false;
      const userObjects = canvas.getObjects().filter((obj: any) =>
        !obj.isGridLine && !obj.isRuler && !obj.isEraserPath
      );
      return userObjects[index] ? userObjects[index].visible : false;
    }, 0);
    expect(isVisible).toBe(false);

    // Toggle layer visibility back on
    await canvasPage.toggleLayerVisibility(0);
    await page.waitForTimeout(500);

    // Verify object is visible again
    isVisible = await page.evaluate((index) => {
      const canvas = (window as any).fabricCanvas;
      if (!canvas) return false;
      const userObjects = canvas.getObjects().filter((obj: any) =>
        !obj.isGridLine && !obj.isRuler && !obj.isEraserPath
      );
      return userObjects[index] ? userObjects[index].visible : false;
    }, 0);
    expect(isVisible).toBe(true);
  });

  test('Layer lock prevents object modification', async ({ authenticatedPage: page }) => {
    // Create a rectangle
    await canvasPage.createRectangle(100, 100, 100, 100);
    await page.waitForTimeout(500);

    // Select the object
    await canvasPage.selectObjectAt(150, 150);
    await page.waitForTimeout(300);

    // Lock the layer
    await canvasPage.toggleLayerLock(0);
    await page.waitForTimeout(500);

    // Verify object is locked
    let isLocked = await page.evaluate((index) => {
      const canvas = (window as any).fabricCanvas;
      if (!canvas) return false;
      const userObjects = canvas.getObjects().filter((obj: any) =>
        !obj.isGridLine && !obj.isRuler && !obj.isEraserPath
      );
      return userObjects[index] ? userObjects[index].lockMovementX && userObjects[index].lockMovementY : false;
    }, 0);
    expect(isLocked).toBe(true);

    // Navigate to Transform tab to access width/height inputs
    await page.getByRole('tab', { name: 'Properties' }).click({ force: true });
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'Transform', exact: true }).click({ force: true });
    await page.waitForTimeout(200);

    // Expand Size section if collapsed
    const sizeSection = page.locator('#section-size');
    const sizeSectionHeader = sizeSection.locator('div').first();
    const isCollapsed = await sizeSection.locator('svg.lucide-chevron-right').isVisible().catch(() => false);
    if (isCollapsed) {
      await sizeSectionHeader.click();
      await page.waitForTimeout(200);
    }

    // Verify that width/height inputs are disabled when locked
    const widthInputDisabled = await canvasPage.objectWidthInput.isDisabled();
    const heightInputDisabled = await canvasPage.objectHeightInput.isDisabled();
    expect(widthInputDisabled).toBe(true);
    expect(heightInputDisabled).toBe(true);

    // Unlock the layer
    await canvasPage.toggleLayerLock(0);
    await page.waitForTimeout(500);

    // Verify object is unlocked
    isLocked = await page.evaluate((index) => {
      const canvas = (window as any).fabricCanvas;
      if (!canvas) return false;
      const userObjects = canvas.getObjects().filter((obj: any) =>
        !obj.isGridLine && !obj.isRuler && !obj.isEraserPath
      );
      return userObjects[index] ? userObjects[index].lockMovementX || userObjects[index].lockMovementY : false;
    }, 0);
    expect(isLocked).toBe(false);

    // Re-select the object (it may have been deselected during toggle)
    await canvasPage.selectObjectAt(150, 150);
    await page.waitForTimeout(300);

    // Navigate to Transform section again
    await page.getByRole('tab', { name: 'Properties' }).click({ force: true });
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'Transform', exact: true }).click({ force: true });
    await page.waitForTimeout(200);

    // Expand Size section if collapsed
    const sizeSection2 = page.locator('#section-size');
    const sizeSectionHeader2 = sizeSection2.locator('div').first();
    const isCollapsed2 = await sizeSection2.locator('svg.lucide-chevron-right').isVisible().catch(() => false);
    if (isCollapsed2) {
      await sizeSectionHeader2.click();
      await page.waitForTimeout(200);
    }

    // Verify that width/height inputs are now enabled
    const widthInputEnabled = await canvasPage.objectWidthInput.isEnabled();
    const heightInputEnabled = await canvasPage.objectHeightInput.isEnabled();
    expect(widthInputEnabled).toBe(true);
    expect(heightInputEnabled).toBe(true);
  });

  test('Layer reordering changes z-index correctly', async ({ authenticatedPage: page }) => {
    // Create three rectangles at different positions to identify them
    await canvasPage.createRectangle(50, 50, 100, 100);
    await page.waitForTimeout(300);

    await canvasPage.createRectangle(75, 75, 100, 100);
    await page.waitForTimeout(300);

    await canvasPage.createRectangle(100, 100, 100, 100);
    await page.waitForTimeout(300);

    // Get initial z-order by storing object positions (filter to user objects only)
    const initialOrder = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      if (!canvas) return [];
      const userObjects = canvas.getObjects().filter((obj: any) => {
        return obj.selectable !== false &&
               !obj.isGridLine &&
               !obj.isRuler &&
               !obj.evented === false;
      });
      // Store left position to identify each rectangle uniquely
      return userObjects.map((obj: any) => obj.left);
    });
    expect(initialOrder.length).toBe(3);

    // Store the position of the last object (which will be layer 0 in UI)
    const lastObjectLeft = initialOrder[2];

    // Reorder layer 0 to position 2 (in LayersPanel, layer 0 is the LAST object in canvas)
    // This should move the object at canvas index 2 to canvas index 0
    await canvasPage.reorderLayer(0, 2);
    await page.waitForTimeout(1000);

    // Verify z-order changed by checking positions
    const newOrder = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      if (!canvas) return [];
      const userObjects = canvas.getObjects().filter((obj: any) => {
        return obj.selectable !== false &&
               !obj.isGridLine &&
               !obj.isRuler &&
               !obj.evented === false;
      });
      return userObjects.map((obj: any) => obj.left);
    });

    // Verify that the order has changed from the initial order
    expect(newOrder).not.toEqual(initialOrder);
    expect(newOrder.length).toBe(3);
    // The object that was at position 2 should now be at position 0
    expect(newOrder[0]).toBe(lastObjectLeft);
    // When moving from canvas index 2 to index 0, objects shift:
    // Result: [was-at-2, was-at-0, was-at-1]
    expect(newOrder).toEqual([initialOrder[2], initialOrder[0], initialOrder[1]]);
  });
});
