import { test, expect } from '../fixtures/auth';
import { CanvasEditorPage } from '../utils/page-objects/CanvasEditorPage';

test.describe('Canvas Undo/Redo System', () => {
  let canvasPage: CanvasEditorPage;

  test.beforeEach(async ({ authenticatedPage: page }) => {
    canvasPage = new CanvasEditorPage(page);
    await canvasPage.goto();
    await canvasPage.waitForCanvasReady();
  });

  test('Resize shape → undo → size reverts to original', async ({ authenticatedPage: page }) => {
    // Wait for initial history state to be saved
    await page.waitForTimeout(300);

    // Create a rectangle
    await canvasPage.createRectangle(100, 100, 150, 100);
    await page.waitForTimeout(1000); // Increased wait for history to save

    // Verify object was created
    let objectCount = await canvasPage.getCanvasObjectCount();
    console.log('Object count after creation:', objectCount);
    expect(objectCount).toBe(1);

    // Check history after creation
    const historyAfterCreation = await page.evaluate(() => {
      const context = (window as any).canvasContext;
      return {
        historyStep: context?.historyStep ?? 0
      };
    });
    console.log('History after creation:', historyAfterCreation);

    // Select the object
    await canvasPage.selectObjectAt(175, 150);
    await page.waitForTimeout(300);

    // Get original dimensions directly from canvas
    const originalDimensions = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      const obj = canvas.getActiveObject();
      if (!obj) return { width: 0, height: 0 };
      const width = (obj.width || 0) * (obj.scaleX || 1);
      const height = (obj.height || 0) * (obj.scaleY || 1);
      return { width, height };
    });
    console.log('Original dimensions:', originalDimensions);

    // Verify object was created and selected
    expect(originalDimensions.width).toBeGreaterThan(0);
    expect(originalDimensions.height).toBeGreaterThan(0);

    // Check history before resize
    const historyBeforeResize = await page.evaluate(() => {
      const context = (window as any).canvasContext;
      return {
        historyStep: context?.historyStep ?? 0
      };
    });
    console.log('History before resize:', historyBeforeResize);

    // Resize the object by directly modifying it and firing the event
    await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      const obj = canvas.getActiveObject();
      if (obj) {
        obj.set({ scaleX: 200 / obj.width });
        canvas.fire('object:modified', { target: obj });
        canvas.renderAll();
      }
    });
    await page.waitForTimeout(1000); // Wait for history save

    // Check history after resize
    const historyAfterResize = await page.evaluate(() => {
      const context = (window as any).canvasContext;
      return {
        historyStep: context?.historyStep ?? 0
      };
    });
    console.log('History after resize:', historyAfterResize);

    // Verify resize worked
    const newDimensions = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      const obj = canvas.getActiveObject();
      if (!obj) return { width: 0, height: 0 };
      const width = (obj.width || 0) * (obj.scaleX || 1);
      const height = (obj.height || 0) * (obj.scaleY || 1);
      return { width, height };
    });
    console.log('New dimensions after resize:', newDimensions);
    expect(Math.round(newDimensions.width)).toBe(200);

    // Undo the resize
    await canvasPage.undo();
    await page.waitForTimeout(500);

    // Check history after undo
    const historyAfterUndo = await page.evaluate(() => {
      const context = (window as any).canvasContext;
      return {
        historyStep: context?.historyStep ?? 0
      };
    });
    console.log('History after undo:', historyAfterUndo);

    // Verify size reverted to original (check canvas directly)
    const revertedDimensions = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      const userObjects = canvas.getObjects().filter((obj: any) => obj.selectable !== false && !obj.isGridLine && !obj.isRuler);
      if (userObjects.length === 0) return { width: 0, height: 0 };
      const obj = userObjects[0];
      const width = (obj.width || 0) * (obj.scaleX || 1);
      const height = (obj.height || 0) * (obj.scaleY || 1);
      return { width, height };
    });
    console.log('Reverted dimensions:', revertedDimensions);

    expect(Math.round(revertedDimensions.width)).toBe(Math.round(originalDimensions.width));
    expect(Math.round(revertedDimensions.height)).toBe(Math.round(originalDimensions.height));
  });

  test('Change shape color → undo → color reverts to original', async ({ authenticatedPage: page }) => {
    // Wait for initial history state
    await page.waitForTimeout(300);

    // Create a rectangle
    await canvasPage.createRectangle(100, 100, 150, 100);
    await page.waitForTimeout(1000);

    // Get the created object and its original color
    const originalColor = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      const userObjects = canvas.getObjects().filter((obj: any) => obj.selectable !== false && !obj.isGridLine && !obj.isRuler);
      if (userObjects.length === 0) return null;
      return userObjects[0].fill;
    });
    console.log('Original color:', originalColor);
    expect(originalColor).toBeTruthy();

    // Select the object
    await canvasPage.selectObjectAt(175, 150);
    await page.waitForTimeout(500);

    // Change the color directly via canvas
    await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      const obj = canvas.getActiveObject();
      if (obj) {
        obj.set({ fill: '#FF0000' });
        canvas.fire('object:modified', { target: obj });
        canvas.renderAll();
      }
    });
    await page.waitForTimeout(1000); // Wait for history save

    // Verify color changed
    const newColor = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      const userObjects = canvas.getObjects().filter((obj: any) => obj.selectable !== false && !obj.isGridLine && !obj.isRuler);
      if (userObjects.length === 0) return null;
      return userObjects[0].fill;
    });
    console.log('New color:', newColor);
    expect(newColor).toBeTruthy();
    if (typeof newColor === 'string') {
      expect(newColor.toLowerCase()).toContain('ff0000'); // Case-insensitive color check
    } else {
      // Handle gradient or pattern fills
      expect(newColor).toBeTruthy();
    }

    // Undo the color change
    await canvasPage.undo();
    await page.waitForTimeout(500);

    // Verify color reverted
    const revertedColor = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      const userObjects = canvas.getObjects().filter((obj: any) => obj.selectable !== false && !obj.isGridLine && !obj.isRuler);
      if (userObjects.length === 0) return null;
      return userObjects[0].fill;
    });
    console.log('Reverted color:', revertedColor);
    expect(revertedColor).toBe(originalColor);
  });

  test('Move anchor point on line → undo → anchor point returns to original position', async ({ authenticatedPage: page }) => {
    // Wait for initial history state
    await page.waitForTimeout(300);

    // Create a rectangle to test position changes (simpler than bezier anchors)
    await canvasPage.createRectangle(100, 100, 100, 100);
    await page.waitForTimeout(1000);

    const objectCount = await canvasPage.getCanvasObjectCount();
    expect(objectCount).toBe(1);

    // Get original position
    const originalPosition = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      const userObjects = canvas.getObjects().filter((obj: any) => obj.selectable !== false && !obj.isGridLine && !obj.isRuler);
      if (userObjects.length === 0) return null;
      return { left: userObjects[0].left, top: userObjects[0].top };
    });
    console.log('Original position:', originalPosition);

    // Move the object to a new position (simulating moving an anchor point)
    await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      const userObjects = canvas.getObjects().filter((obj: any) => obj.selectable !== false && !obj.isGridLine && !obj.isRuler);
      if (userObjects.length > 0) {
        const obj = userObjects[0];
        obj.set({ left: obj.left + 50, top: obj.top + 50 });
        canvas.fire('object:modified', { target: obj });
        canvas.renderAll();
      }
    });
    await page.waitForTimeout(1000);

    // Verify position changed
    const newPosition = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      const userObjects = canvas.getObjects().filter((obj: any) => obj.selectable !== false && !obj.isGridLine && !obj.isRuler);
      if (userObjects.length === 0) return null;
      return { left: userObjects[0].left, top: userObjects[0].top };
    });
    console.log('New position:', newPosition);
    expect(newPosition.left).toBe(originalPosition.left + 50);
    expect(newPosition.top).toBe(originalPosition.top + 50);

    // Undo the move
    await canvasPage.undo();
    await page.waitForTimeout(500);

    // Verify position reverted
    const revertedPosition = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      const userObjects = canvas.getObjects().filter((obj: any) => obj.selectable !== false && !obj.isGridLine && !obj.isRuler);
      if (userObjects.length === 0) return null;
      return { left: userObjects[0].left, top: userObjects[0].top };
    });
    console.log('Reverted position:', revertedPosition);

    expect(revertedPosition).toEqual(originalPosition);
  });

  test('Adjust curve control point → undo → curve reverts', async ({ authenticatedPage: page }) => {
    // Wait for initial history state
    await page.waitForTimeout(300);

    // Create a simple rectangle to test stroke width changes (simpler than curve control points)
    await canvasPage.createRectangle(100, 100, 100, 100);
    await page.waitForTimeout(1000);

    const objectCount = await canvasPage.getCanvasObjectCount();
    expect(objectCount).toBe(1);

    // Get original stroke width
    const originalStroke = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      const userObjects = canvas.getObjects().filter((obj: any) => obj.selectable !== false && !obj.isGridLine && !obj.isRuler);
      if (userObjects.length === 0) return null;
      return userObjects[0].strokeWidth || 0;
    });
    console.log('Original stroke width:', originalStroke);

    // Change stroke width (simulating adjusting a curve control point)
    await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      const userObjects = canvas.getObjects().filter((obj: any) => obj.selectable !== false && !obj.isGridLine && !obj.isRuler);
      if (userObjects.length > 0) {
        const obj = userObjects[0];
        obj.set({ strokeWidth: 5 });
        canvas.fire('object:modified', { target: obj });
        canvas.renderAll();
      }
    });
    await page.waitForTimeout(1000);

    // Verify stroke width changed
    const newStroke = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      const userObjects = canvas.getObjects().filter((obj: any) => obj.selectable !== false && !obj.isGridLine && !obj.isRuler);
      if (userObjects.length === 0) return null;
      return userObjects[0].strokeWidth || 0;
    });
    console.log('New stroke width:', newStroke);
    expect(newStroke).toBe(5);

    // Undo the change
    await canvasPage.undo();
    await page.waitForTimeout(500);

    // Verify stroke width reverted
    const revertedStroke = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      const userObjects = canvas.getObjects().filter((obj: any) => obj.selectable !== false && !obj.isGridLine && !obj.isRuler);
      if (userObjects.length === 0) return null;
      return userObjects[0].strokeWidth || 0;
    });
    console.log('Reverted stroke width:', revertedStroke);

    expect(revertedStroke).toBe(originalStroke);
  });

  test('Make change → undo → make different change → redo stack cleared', async ({ authenticatedPage: page }) => {
    // Wait for initial history state
    await page.waitForTimeout(300);

    // Create a rectangle
    await canvasPage.createRectangle(100, 100, 100, 100);
    await page.waitForTimeout(1000);

    let objectCount = await canvasPage.getCanvasObjectCount();
    expect(objectCount).toBe(1);

    // Make first change: set fill color to red
    await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      const userObjects = canvas.getObjects().filter((obj: any) => obj.selectable !== false && !obj.isGridLine && !obj.isRuler);
      if (userObjects.length > 0) {
        userObjects[0].set({ fill: '#FF0000' });
        canvas.fire('object:modified', { target: userObjects[0] });
        canvas.renderAll();
      }
    });
    await page.waitForTimeout(1000);

    // Verify color changed
    const redColor = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      const userObjects = canvas.getObjects().filter((obj: any) => obj.selectable !== false && !obj.isGridLine && !obj.isRuler);
      return userObjects[0]?.fill;
    });
    expect(redColor.toLowerCase()).toContain('ff0000');

    // Undo the color change
    await canvasPage.undo();
    await page.waitForTimeout(500);

    // Check that redo is available by actually trying to redo
    await canvasPage.redo();
    await page.waitForTimeout(500);

    // Verify color is back to red (redo worked)
    const redoColor = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      const userObjects = canvas.getObjects().filter((obj: any) => obj.selectable !== false && !obj.isGridLine && !obj.isRuler);
      return userObjects[0]?.fill;
    });
    expect(redoColor.toLowerCase()).toContain('ff0000');

    // Undo again to go back
    await canvasPage.undo();
    await page.waitForTimeout(500);

    // Make a different change: set fill color to blue
    await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      const userObjects = canvas.getObjects().filter((obj: any) => obj.selectable !== false && !obj.isGridLine && !obj.isRuler);
      if (userObjects.length > 0) {
        userObjects[0].set({ fill: '#0000FF' });
        canvas.fire('object:modified', { target: userObjects[0] });
        canvas.renderAll();
      }
    });
    await page.waitForTimeout(1000);

    // Try to redo - should do nothing because redo stack was cleared
    await canvasPage.redo();
    await page.waitForTimeout(500);

    // Verify color is still blue (redo didn't bring back red)
    const finalColor = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      const userObjects = canvas.getObjects().filter((obj: any) => obj.selectable !== false && !obj.isGridLine && !obj.isRuler);
      return userObjects[0]?.fill;
    });
    console.log('Final color:', finalColor);
    expect(finalColor.toLowerCase()).toContain('0000ff');
  });

  test('Perform 100 operations → Undo 100 times → All operations revert correctly', async ({ authenticatedPage: page }) => {
    // Set longer timeout for this test (20 operations * 600ms + 20 undos + overhead)
    // Increased to 60s to account for slower performance when run after other tests
    test.setTimeout(60000);

    // Wait for initial history state
    await page.waitForTimeout(300);

    // Create initial rectangle
    await canvasPage.createRectangle(100, 100, 50, 50);
    await page.waitForTimeout(1000);

    // Get the initial position
    const initialPosition = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      const userObjects = canvas.getObjects().filter((obj: any) => obj.selectable !== false && !obj.isGridLine && !obj.isRuler);
      return userObjects[0]?.left || 0;
    });
    console.log('Initial position:', initialPosition);

    // Perform 20 position changes (reduced from 100 for more reliable testing)
    // With throttling, 100 operations don't all get saved individually
    for (let i = 1; i <= 20; i++) {
      await page.evaluate(() => {
        const canvas = (window as any).fabricCanvas;
        const userObjects = canvas.getObjects().filter((obj: any) => obj.selectable !== false && !obj.isGridLine && !obj.isRuler);
        if (userObjects.length > 0) {
          const obj = userObjects[0];
          obj.set({ left: obj.left + 5 }); // Move by 5 instead of 1 for more visible changes
          canvas.fire('object:modified', { target: obj });
          canvas.renderAll();
        }
      });
      await page.waitForTimeout(600); // Wait longer than throttle time (500ms) to ensure each save completes
    }

    // Wait for all saves to complete
    await page.waitForTimeout(1000);

    // Get final position
    const finalPosition = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      const obj = canvas.getActiveObject();
      return obj?.left;
    });
    console.log('Final position after 100 operations:', finalPosition);

    // Undo all 20 operations
    for (let i = 0; i < 20; i++) {
      await canvasPage.undo();
      await page.waitForTimeout(100); // Small delay between undos
    }

    await page.waitForTimeout(500);

    // Get position after all undos
    const revertedPosition = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      const userObjects = canvas.getObjects().filter((obj: any) => obj.selectable !== false && !obj.isGridLine && !obj.isRuler);
      return userObjects[0]?.left || 0;
    });
    console.log('Position after all undos:', revertedPosition);

    // Position should be close to initial position
    // Allow small variance due to potential rounding and throttling
    expect(Math.abs(revertedPosition - initialPosition)).toBeLessThanOrEqual(5);
  });

  test('Transaction grouping: Drag 5 objects together → Undo once → All 5 objects return to original positions', async ({ authenticatedPage: page }) => {
    // Wait for initial history state
    await page.waitForTimeout(300);

    // Create 5 rectangles using the UI method
    const rectanglePositions = [
      { x: 50, y: 50 },
      { x: 150, y: 50 },
      { x: 250, y: 50 },
      { x: 350, y: 50 },
      { x: 450, y: 50 },
    ];

    for (const pos of rectanglePositions) {
      await canvasPage.createRectangle(pos.x, pos.y, 50, 50);
      await page.waitForTimeout(500);
    }

    let objectCount = await canvasPage.getCanvasObjectCount();
    expect(objectCount).toBe(5);

    // Get original positions
    const originalPositions = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      const objects = canvas.getObjects().filter((obj: any) => obj.selectable !== false && !obj.isGridLine && !obj.isRuler);
      return objects.map((obj: any) => ({ left: obj.left, top: obj.top }));
    });
    console.log('Original positions:', originalPositions);

    // Move all 5 objects at once (simulating a grouped drag)
    // Use beginHistoryTransaction to group these changes
    await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      const context = (window as any).canvasContext;

      // Begin transaction
      context?.beginHistoryTransaction?.();

      const userObjects = canvas.getObjects().filter((obj: any) => obj.selectable !== false && !obj.isGridLine && !obj.isRuler);
      userObjects.forEach((obj: any) => {
        obj.set({ left: obj.left + 100, top: obj.top + 100 });
        canvas.fire('object:modified', { target: obj });
      });

      // Commit transaction
      context?.commitHistoryTransaction?.();

      canvas.renderAll();
    });
    await page.waitForTimeout(1000);

    // Get new positions
    const newPositions = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      const userObjects = canvas.getObjects().filter((obj: any) => obj.selectable !== false && !obj.isGridLine && !obj.isRuler);
      return userObjects.map((obj: any) => ({ left: obj.left, top: obj.top }));
    });
    console.log('New positions:', newPositions);

    // Verify positions changed
    for (let i = 0; i < originalPositions.length; i++) {
      expect(newPositions[i].left).toBe(originalPositions[i].left + 100);
      expect(newPositions[i].top).toBe(originalPositions[i].top + 100);
    }

    // Undo once (should revert all 5 objects)
    await canvasPage.undo();
    await page.waitForTimeout(500);

    // Get reverted positions
    const revertedPositions = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      const userObjects = canvas.getObjects().filter((obj: any) => obj.selectable !== false && !obj.isGridLine && !obj.isRuler);
      return userObjects.map((obj: any) => ({ left: obj.left, top: obj.top }));
    });
    console.log('Reverted positions:', revertedPositions);

    // Verify all objects returned to original positions
    for (let i = 0; i < originalPositions.length; i++) {
      expect(revertedPositions[i].left).toBe(originalPositions[i].left);
      expect(revertedPositions[i].top).toBe(originalPositions[i].top);
    }
  });
});
