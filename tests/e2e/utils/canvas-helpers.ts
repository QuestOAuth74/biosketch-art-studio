import { Page } from '@playwright/test';

/**
 * Helper utilities for canvas testing
 */

/**
 * Wait for autosave to complete
 * @param page Playwright page object
 * @param timeout Maximum time to wait in milliseconds
 * @returns True if save completed, false if timeout
 */
export async function waitForAutosave(page: Page, timeout = 5000): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const saveStatus = await page.evaluate(() => {
      // Access canvas context save status
      const context = (window as any).canvasContext;
      return context?.saveStatus || 'unsaved';
    });

    if (saveStatus === 'saved') {
      return true;
    }

    await page.waitForTimeout(100);
  }

  return false;
}

/**
 * Check if grid is visible on canvas
 * @param page Playwright page object
 * @returns True if grid is visible
 */
export async function isGridVisible(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const canvas = (window as any).fabricCanvas;
    if (!canvas) return false;

    // Check if there are any grid line objects on the canvas
    const gridObjects = canvas.getObjects().filter((obj: any) => obj.isGridLine);
    return gridObjects.length > 0;
  });
}

/**
 * Get object position on canvas
 * @param page Playwright page object
 * @param objectIndex Index of the object (among user-created objects only)
 * @returns Object position {x, y}
 */
export async function getObjectPosition(page: Page, objectIndex: number): Promise<{ x: number; y: number }> {
  return await page.evaluate((index) => {
    const canvas = (window as any).fabricCanvas;
    if (!canvas) return { x: 0, y: 0 };

    // Filter out grid lines, rulers, and non-selectable objects
    const objects = canvas.getObjects().filter((obj: any) =>
      obj.selectable !== false && !obj.isGridLine && !obj.isRuler
    );
    const obj = objects[index];

    return {
      x: obj?.left || 0,
      y: obj?.top || 0,
    };
  }, objectIndex);
}

/**
 * Check if object is snapped to grid
 * @param page Playwright page object
 * @param objectIndex Index of the object
 * @param gridSize Size of the grid (default 20px)
 * @returns True if object is snapped to grid
 */
export async function isObjectSnappedToGrid(
  page: Page,
  objectIndex: number,
  gridSize: number = 20
): Promise<boolean> {
  const pos = await getObjectPosition(page, objectIndex);

  // Check if position is multiple of grid size
  return pos.x % gridSize === 0 && pos.y % gridSize === 0;
}
