import { test, expect } from '../fixtures/auth';
import { CanvasEditorPage } from '../utils/page-objects/CanvasEditorPage';

/**
 * E2E tests for membrane icon ghosting bug fix.
 *
 * Root cause: placeIconsAlongPath() fired off .clone().then() callbacks without
 * awaiting them. The promise resolved inside a callback counter, but other clones
 * were still in-flight — producing FabricImage objects with no _element (no pixel
 * data). Visible in layers but invisible on canvas.
 *
 * Fix: collect all clone promises and await Promise.all() before resolving.
 *
 * These tests draw membranes with varying icon counts and verify that every icon
 * in the resulting group has valid, non-empty image data — no ghosting.
 */
test.describe('Membrane Icon Ghosting - Clone Race Condition Fix', () => {
  let canvasPage: CanvasEditorPage;

  test.beforeEach(async ({ authenticatedPage: page }) => {
    canvasPage = new CanvasEditorPage(page);
    await canvasPage.goto();
    await canvasPage.waitForCanvasReady();
  });

  /**
   * Helper: Open membrane brush tool, select an icon, and start drawing mode.
   * Returns true if membrane drawing mode was entered successfully.
   */
  async function enterMembraneDrawingMode(page: import('@playwright/test').Page): Promise<boolean> {
    // Click membrane brush tool
    const membraneBrushButton = page.getByRole('button', { name: /membrane/i });
    if (!await membraneBrushButton.isVisible().catch(() => false)) {
      return false;
    }
    await membraneBrushButton.click();
    await page.waitForTimeout(1000);

    // Dialog should open
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Search for a common icon
    const searchInput = page.getByPlaceholder(/search icons/i);
    await searchInput.fill('phospholipid');
    await page.waitForTimeout(1500);

    // Select the first icon result
    const iconButtons = page.locator('button[title]').filter({
      hasNotText: /load more|start drawing|cancel|next page|previous page/i,
    });
    const iconCount = await iconButtons.count();

    if (iconCount === 0) {
      // Try a more generic search
      await searchInput.fill('cell');
      await page.waitForTimeout(1500);
      const retryCount = await iconButtons.count();
      if (retryCount === 0) {
        // No icons available — skip gracefully
        await page.keyboard.press('Escape');
        return false;
      }
    }

    await iconButtons.first().click();
    await page.waitForTimeout(500);

    // Click "Start Drawing"
    const startButton = page.getByRole('button', { name: /start drawing/i });
    await expect(startButton).toBeEnabled();
    await startButton.click();
    await page.waitForTimeout(1000);

    // Dialog should close — we're now in membrane drawing mode
    await expect(dialog).not.toBeVisible();
    return true;
  }

  /**
   * Helper: Draw a membrane path on canvas by clicking multiple points,
   * then double-click to finish. Returns bounding box of canvas for coordinate calc.
   */
  async function drawMembranePath(
    page: import('@playwright/test').Page,
    canvasPage: CanvasEditorPage,
    points: { x: number; y: number }[],
  ): Promise<void> {
    const canvasBox = await canvasPage.canvasElement.boundingBox();
    if (!canvasBox) throw new Error('Canvas element not found');

    // Click each point to define the path
    for (const pt of points) {
      await page.mouse.click(canvasBox.x + pt.x, canvasBox.y + pt.y);
      await page.waitForTimeout(300);
    }

    // Double-click the last point to finish the path
    const last = points[points.length - 1];
    await page.mouse.dblclick(canvasBox.x + last.x, canvasBox.y + last.y);

    // Wait for icon placement (async clone operations)
    await page.waitForTimeout(3000);
  }

  /**
   * Core assertion: Inspect every icon in membrane groups on the canvas.
   * Returns { totalIcons, ghostedIcons, groups } from page evaluation.
   */
  async function auditMembraneIcons(page: import('@playwright/test').Page): Promise<{
    totalIcons: number;
    ghostedIcons: number;
    groups: number;
    details: Array<{
      groupIndex: number;
      iconCount: number;
      ghostCount: number;
      iconDetails: Array<{ index: number; hasElement: boolean; width: number; height: number; visible: boolean }>;
    }>;
  }> {
    return await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      if (!canvas) return { totalIcons: 0, ghostedIcons: 0, groups: 0, details: [] };

      const objects = canvas.getObjects();
      const membraneGroups = objects.filter((obj: any) =>
        obj.isMembraneShape && !obj.isRasterizedMembrane
      );
      const rasterizedMembranes = objects.filter((obj: any) =>
        obj.isMembraneShape && obj.isRasterizedMembrane
      );

      let totalIcons = 0;
      let ghostedIcons = 0;
      const details: any[] = [];

      // Audit vector membrane groups (pre-rasterization)
      membraneGroups.forEach((group: any, groupIndex: number) => {
        const children = group._objects || [];
        const iconDetails: any[] = [];

        children.forEach((icon: any, idx: number) => {
          totalIcons++;

          // An icon is "ghosted" if it lacks a valid image element
          const el = icon._element || icon.getElement?.();
          const hasElement = !!el;
          const hasValidSrc = hasElement && el.src && !el.src.includes('data:image/png;base64,iVBOR');
          const hasNonZeroDimensions = (icon.width || 0) > 0 && (icon.height || 0) > 0;

          // Check if the image actually has pixel data
          let hasPixelData = false;
          if (hasElement && el instanceof HTMLImageElement) {
            hasPixelData = el.complete && el.naturalWidth > 0 && el.naturalHeight > 0;
          } else if (hasElement && el instanceof HTMLCanvasElement) {
            hasPixelData = el.width > 0 && el.height > 0;
          }

          const isGhosted = !hasElement || !hasPixelData;
          if (isGhosted) ghostedIcons++;

          iconDetails.push({
            index: idx,
            hasElement,
            hasPixelData,
            width: icon.width || 0,
            height: icon.height || 0,
            visible: icon.visible !== false,
            isGhosted,
          });
        });

        details.push({
          groupIndex,
          type: 'vector',
          iconCount: children.length,
          ghostCount: iconDetails.filter((d: any) => d.isGhosted).length,
          iconDetails,
        });
      });

      // Audit rasterized membranes (post-rasterization — check the image itself)
      rasterizedMembranes.forEach((img: any, idx: number) => {
        totalIcons++;
        const el = img._element || img.getElement?.();
        const hasElement = !!el;
        let hasPixelData = false;

        if (hasElement && el instanceof HTMLImageElement) {
          hasPixelData = el.complete && el.naturalWidth > 0 && el.naturalHeight > 0;
          // Check it's not a 1x1 placeholder
          if (el.naturalWidth <= 1 && el.naturalHeight <= 1) hasPixelData = false;
        } else if (hasElement && el instanceof HTMLCanvasElement) {
          hasPixelData = el.width > 1 && el.height > 1;
        }

        const isGhosted = !hasElement || !hasPixelData;
        if (isGhosted) ghostedIcons++;

        details.push({
          groupIndex: membraneGroups.length + idx,
          type: 'rasterized',
          iconCount: 1,
          ghostCount: isGhosted ? 1 : 0,
          hasElement,
          hasPixelData,
          width: img.width || 0,
          height: img.height || 0,
        });
      });

      return {
        totalIcons,
        ghostedIcons,
        groups: membraneGroups.length + rasterizedMembranes.length,
        details,
      };
    });
  }

  // ─── Test 1: Short membrane path — few icons, basic sanity check ───

  test('short membrane path: all icons have valid image data', async ({ authenticatedPage: page }) => {
    const entered = await enterMembraneDrawingMode(page);
    if (!entered) {
      test.skip();
      return;
    }

    // Draw a short 2-point line (produces ~5-10 icons)
    await drawMembranePath(page, canvasPage, [
      { x: 200, y: 300 },
      { x: 500, y: 300 },
    ]);

    const audit = await auditMembraneIcons(page);

    // Must have at least some icons/membranes
    expect(audit.totalIcons).toBeGreaterThan(0);
    // Zero ghosted icons
    expect(audit.ghostedIcons).toBe(0);

    // Log details for debugging
    console.log(`[Short path] Groups: ${audit.groups}, Total icons: ${audit.totalIcons}, Ghosted: ${audit.ghostedIcons}`);
    for (const d of audit.details) {
      if (d.ghostCount > 0) {
        console.log(`  Group ${d.groupIndex}: ${d.ghostCount}/${d.iconCount} ghosted`, d.iconDetails?.filter((i: any) => i.isGhosted));
      }
    }
  });

  // ─── Test 2: Long membrane path — many icons, high clone concurrency ───

  test('long membrane path: no ghosted icons under high clone concurrency', async ({ authenticatedPage: page }) => {
    const entered = await enterMembraneDrawingMode(page);
    if (!entered) {
      test.skip();
      return;
    }

    // Draw a long multi-segment path (produces 30-60+ icons — stress the clone pipeline)
    await drawMembranePath(page, canvasPage, [
      { x: 100, y: 200 },
      { x: 300, y: 150 },
      { x: 500, y: 250 },
      { x: 700, y: 150 },
      { x: 900, y: 300 },
    ]);

    const audit = await auditMembraneIcons(page);

    expect(audit.totalIcons).toBeGreaterThan(0);
    expect(audit.ghostedIcons).toBe(0);

    console.log(`[Long path] Groups: ${audit.groups}, Total icons: ${audit.totalIcons}, Ghosted: ${audit.ghostedIcons}`);
    for (const d of audit.details) {
      if (d.ghostCount > 0) {
        console.log(`  Group ${d.groupIndex}: ${d.ghostCount}/${d.iconCount} ghosted`, d.iconDetails?.filter((i: any) => i.isGhosted));
      }
    }
  });

  // ─── Test 3: Closed membrane path (loop) — icons around a full circuit ───

  test('closed membrane path: all icons render without ghosting', async ({ authenticatedPage: page }) => {
    const entered = await enterMembraneDrawingMode(page);
    if (!entered) {
      test.skip();
      return;
    }

    // Draw a closed loop (triangle-ish) — click near the first point to auto-close
    const canvasBox = await canvasPage.canvasElement.boundingBox();
    if (!canvasBox) throw new Error('Canvas not found');

    const points = [
      { x: 300, y: 150 },
      { x: 600, y: 400 },
      { x: 100, y: 400 },
    ];

    for (const pt of points) {
      await page.mouse.click(canvasBox.x + pt.x, canvasBox.y + pt.y);
      await page.waitForTimeout(300);
    }

    // Click near the first point to close the path
    await page.mouse.click(canvasBox.x + points[0].x + 5, canvasBox.y + points[0].y + 5);
    await page.waitForTimeout(3000);

    const audit = await auditMembraneIcons(page);

    expect(audit.totalIcons).toBeGreaterThan(0);
    expect(audit.ghostedIcons).toBe(0);

    console.log(`[Closed path] Groups: ${audit.groups}, Total icons: ${audit.totalIcons}, Ghosted: ${audit.ghostedIcons}`);
  });

  // ─── Test 4: Layers panel vs canvas consistency ───

  test('layer count matches rendered icon count (no ghost layers)', async ({ authenticatedPage: page }) => {
    const entered = await enterMembraneDrawingMode(page);
    if (!entered) {
      test.skip();
      return;
    }

    // Draw a medium membrane
    await drawMembranePath(page, canvasPage, [
      { x: 150, y: 250 },
      { x: 450, y: 200 },
      { x: 750, y: 300 },
    ]);

    // Wait for any rasterization to complete
    await page.waitForTimeout(2000);

    // Count membrane objects on canvas
    const canvasState = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      if (!canvas) return { membraneCount: 0, totalUserObjects: 0 };

      const objects = canvas.getObjects();
      const membranes = objects.filter((obj: any) => obj.isMembraneShape);
      const userObjects = objects.filter((obj: any) =>
        obj.selectable !== false && !obj.isGridLine && !obj.isRuler && obj.evented !== false
      );

      return {
        membraneCount: membranes.length,
        totalUserObjects: userObjects.length,
        membraneDetails: membranes.map((m: any) => ({
          isRasterized: !!m.isRasterizedMembrane,
          visible: m.visible !== false,
          hasElement: !!(m._element || m.getElement?.()),
          width: m.width || 0,
          height: m.height || 0,
        })),
      };
    });

    // Open layers panel and count layer entries
    await canvasPage.openLayersPanel();
    await page.waitForTimeout(500);

    const layerItems = page.getByTestId(/canvas-editor-layer-item/);
    const layerCount = await layerItems.count();

    console.log(`[Layer consistency] Canvas membranes: ${canvasState.membraneCount}, Total user objects: ${canvasState.totalUserObjects}, Layer entries: ${layerCount}`);

    // Layer count should match canvas user object count
    expect(layerCount).toBe(canvasState.totalUserObjects);

    // Every membrane should be visible
    for (const m of (canvasState as any).membraneDetails || []) {
      expect(m.visible).toBe(true);
      expect(m.hasElement).toBe(true);
    }
  });

  // ─── Test 5: Save and reload — icons survive round-trip without ghosting ───

  test('membrane icons survive save and reload without ghosting', async ({ authenticatedPage: page }) => {
    test.setTimeout(120000); // Extended timeout for save/reload

    const entered = await enterMembraneDrawingMode(page);
    if (!entered) {
      test.skip();
      return;
    }

    // Draw a membrane
    await drawMembranePath(page, canvasPage, [
      { x: 200, y: 250 },
      { x: 500, y: 200 },
      { x: 800, y: 300 },
    ]);

    // Wait for rasterization
    await page.waitForTimeout(3000);

    // Capture pre-save state
    const preSaveAudit = await auditMembraneIcons(page);
    expect(preSaveAudit.totalIcons).toBeGreaterThan(0);
    expect(preSaveAudit.ghostedIcons).toBe(0);

    console.log(`[Pre-save] Icons: ${preSaveAudit.totalIcons}, Ghosted: ${preSaveAudit.ghostedIcons}`);

    // Save the project
    await canvasPage.saveProject();
    await page.waitForTimeout(2000);

    // Get the project URL for reload
    const currentUrl = page.url();

    // Reload the page completely
    await page.reload({ waitUntil: 'networkidle' });
    await canvasPage.waitForCanvasReady();

    // Wait for post-load processing (membrane regeneration from worldBezierPoints)
    await page.waitForTimeout(5000);

    // Audit after reload
    const postReloadAudit = await auditMembraneIcons(page);

    console.log(`[Post-reload] Icons: ${postReloadAudit.totalIcons}, Ghosted: ${postReloadAudit.ghostedIcons}`);
    for (const d of postReloadAudit.details) {
      console.log(`  Group ${d.groupIndex} (${(d as any).type}): ghosts=${d.ghostCount}`);
    }

    // Must still have membrane content
    expect(postReloadAudit.totalIcons).toBeGreaterThan(0);
    // No ghosted icons after reload
    expect(postReloadAudit.ghostedIcons).toBe(0);
  });

  // ─── Test 6: Multiple membranes — concurrent icon placement ───

  test('multiple membranes on same canvas: no cross-contamination ghosting', async ({ authenticatedPage: page }) => {
    test.setTimeout(90000);

    // Draw first membrane
    let entered = await enterMembraneDrawingMode(page);
    if (!entered) {
      test.skip();
      return;
    }

    await drawMembranePath(page, canvasPage, [
      { x: 100, y: 150 },
      { x: 400, y: 150 },
    ]);
    await page.waitForTimeout(2000);

    // Switch back to select tool, then draw second membrane
    await canvasPage.selectTool.click({ force: true });
    await page.waitForTimeout(500);

    entered = await enterMembraneDrawingMode(page);
    if (!entered) {
      // First membrane should still be valid
      const audit = await auditMembraneIcons(page);
      expect(audit.ghostedIcons).toBe(0);
      return;
    }

    await drawMembranePath(page, canvasPage, [
      { x: 100, y: 400 },
      { x: 400, y: 350 },
      { x: 700, y: 400 },
    ]);
    await page.waitForTimeout(2000);

    const audit = await auditMembraneIcons(page);

    console.log(`[Multi-membrane] Groups: ${audit.groups}, Total icons: ${audit.totalIcons}, Ghosted: ${audit.ghostedIcons}`);

    expect(audit.totalIcons).toBeGreaterThan(0);
    expect(audit.groups).toBeGreaterThanOrEqual(2);
    expect(audit.ghostedIcons).toBe(0);
  });

  // ─── Test 7: No console errors during membrane creation ───

  test('no console errors during membrane icon cloning', async ({ authenticatedPage: page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Filter out unrelated errors
        if (!text.includes('favicon') && !text.includes('net::ERR') && !text.includes('404')) {
          errors.push(text);
        }
      }
    });

    const entered = await enterMembraneDrawingMode(page);
    if (!entered) {
      test.skip();
      return;
    }

    // Draw a long path to trigger many concurrent clones
    await drawMembranePath(page, canvasPage, [
      { x: 100, y: 200 },
      { x: 300, y: 150 },
      { x: 500, y: 250 },
      { x: 700, y: 150 },
      { x: 900, y: 250 },
    ]);

    // Filter for clone/membrane-related errors
    const membraneErrors = errors.filter(e =>
      e.toLowerCase().includes('clone') ||
      e.toLowerCase().includes('membrane') ||
      e.toLowerCase().includes('element') ||
      e.toLowerCase().includes('image') ||
      e.toLowerCase().includes('null') ||
      e.toLowerCase().includes('undefined')
    );

    console.log(`[Console errors] Total errors: ${errors.length}, Membrane-related: ${membraneErrors.length}`);
    if (membraneErrors.length > 0) {
      console.log('Membrane errors:', membraneErrors);
    }

    expect(membraneErrors.length).toBe(0);
  });

  // ─── Test 8: Pixel-level rendering verification ───

  test('membrane icons render non-transparent pixels on canvas', async ({ authenticatedPage: page }) => {
    const entered = await enterMembraneDrawingMode(page);
    if (!entered) {
      test.skip();
      return;
    }

    // Draw a membrane in a known region
    await drawMembranePath(page, canvasPage, [
      { x: 200, y: 300 },
      { x: 600, y: 300 },
    ]);

    // Wait for rendering
    await page.waitForTimeout(3000);

    // Sample pixels from the canvas in the membrane region
    const pixelCheck = await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      if (!canvas) return { hasPixels: false, reason: 'no canvas' };

      // Force a full render
      canvas.requestRenderAll();

      // Get the lower canvas element (where objects are rendered)
      const lowerCanvas = canvas.lowerCanvasEl || canvas.getElement();
      if (!lowerCanvas) return { hasPixels: false, reason: 'no canvas element' };

      const ctx = lowerCanvas.getContext('2d');
      if (!ctx) return { hasPixels: false, reason: 'no 2d context' };

      // Find membrane objects to get their bounding rect
      const membranes = canvas.getObjects().filter((obj: any) => obj.isMembraneShape);
      if (membranes.length === 0) return { hasPixels: false, reason: 'no membranes found' };

      const membrane = membranes[0];
      const bounds = membrane.getBoundingRect();

      // Sample a grid of pixels within the membrane's bounding rect
      const sampleSize = 10;
      let nonTransparentPixels = 0;
      let totalSamples = 0;

      for (let row = 0; row < sampleSize; row++) {
        for (let col = 0; col < sampleSize; col++) {
          const x = Math.floor(bounds.left + (bounds.width * col) / sampleSize);
          const y = Math.floor(bounds.top + (bounds.height * row) / sampleSize);

          if (x < 0 || y < 0 || x >= lowerCanvas.width || y >= lowerCanvas.height) continue;

          const pixel = ctx.getImageData(x, y, 1, 1).data;
          totalSamples++;

          // Check alpha channel — non-zero means something was rendered
          if (pixel[3] > 0) {
            nonTransparentPixels++;
          }
        }
      }

      return {
        hasPixels: nonTransparentPixels > 0,
        nonTransparentPixels,
        totalSamples,
        ratio: totalSamples > 0 ? nonTransparentPixels / totalSamples : 0,
        bounds: { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height },
      };
    });

    console.log(`[Pixel check] Non-transparent: ${(pixelCheck as any).nonTransparentPixels}/${(pixelCheck as any).totalSamples} (${((pixelCheck as any).ratio * 100).toFixed(1)}%)`);

    // At least some pixels in the membrane region should be non-transparent
    expect(pixelCheck.hasPixels).toBe(true);
    // Expect at least 5% of sampled pixels to have content (icons are spaced out)
    expect((pixelCheck as any).ratio).toBeGreaterThan(0.05);
  });
});
