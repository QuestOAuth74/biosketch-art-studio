import { Page, Locator } from '@playwright/test';
import { CanvasEditorTestIds } from '@/lib/test-ids';

/**
 * Page Object Model for Canvas Editor page (/canvas)
 * Handles canvas interactions, tools, layers, and object manipulation
 */
export class CanvasEditorPage {
  readonly page: Page;

  // Page elements
  readonly pageContainer: Locator;
  readonly canvasElement: Locator;
  readonly canvasWrapper: Locator;

  // Toolbar
  readonly toolbar: Locator;
  readonly undoButton: Locator;
  readonly redoButton: Locator;

  // Tools
  readonly selectTool: Locator;
  readonly rectangleTool: Locator;
  readonly circleTool: Locator;
  readonly textTool: Locator;
  readonly lineTool: Locator;

  // Grid & Snapping
  readonly gridToggle: Locator;
  readonly snapToGridToggle: Locator;

  // Layers Panel
  readonly layersPanel: Locator;

  // Properties Panel
  readonly propertiesPanel: Locator;
  readonly objectWidthInput: Locator;
  readonly objectHeightInput: Locator;
  readonly objectXInput: Locator;
  readonly objectYInput: Locator;

  // Actions
  readonly groupButton: Locator;
  readonly ungroupButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Initialize all locators using test IDs
    this.pageContainer = page.getByTestId(CanvasEditorTestIds.PAGE_CONTAINER);
    this.canvasElement = page.getByTestId(CanvasEditorTestIds.CANVAS_ELEMENT);
    this.canvasWrapper = page.getByTestId(CanvasEditorTestIds.CANVAS_WRAPPER);

    this.toolbar = page.getByTestId(CanvasEditorTestIds.TOOLBAR);
    this.undoButton = page.getByTestId(CanvasEditorTestIds.UNDO_BUTTON);
    this.redoButton = page.getByTestId(CanvasEditorTestIds.REDO_BUTTON);

    this.selectTool = page.getByTestId(CanvasEditorTestIds.SELECT_TOOL);
    this.rectangleTool = page.getByTestId(CanvasEditorTestIds.RECTANGLE_TOOL);
    this.circleTool = page.getByTestId(CanvasEditorTestIds.CIRCLE_TOOL);
    this.textTool = page.getByTestId(CanvasEditorTestIds.TEXT_TOOL);
    this.lineTool = page.getByTestId(CanvasEditorTestIds.LINE_TOOL);

    this.gridToggle = page.getByTestId(CanvasEditorTestIds.GRID_TOGGLE);
    this.snapToGridToggle = page.getByTestId(CanvasEditorTestIds.SNAP_TO_GRID_TOGGLE);

    this.layersPanel = page.getByTestId(CanvasEditorTestIds.LAYERS_PANEL);
    this.propertiesPanel = page.getByTestId(CanvasEditorTestIds.PROPERTIES_PANEL);

    this.objectWidthInput = page.getByTestId(CanvasEditorTestIds.OBJECT_WIDTH_INPUT);
    this.objectHeightInput = page.getByTestId(CanvasEditorTestIds.OBJECT_HEIGHT_INPUT);
    this.objectXInput = page.getByTestId(CanvasEditorTestIds.OBJECT_X_INPUT);
    this.objectYInput = page.getByTestId(CanvasEditorTestIds.OBJECT_Y_INPUT);

    this.groupButton = page.getByTestId(CanvasEditorTestIds.GROUP_BUTTON);
    this.ungroupButton = page.getByTestId(CanvasEditorTestIds.UNGROUP_BUTTON);
  }

  /**
   * Navigate to canvas editor
   * @param projectId Optional project ID to open specific project
   */
  async goto(projectId?: string): Promise<void> {
    // Dismiss feedback widget and smart suggestions before navigating to canvas
    await this.page.evaluate(() => {
      localStorage.setItem('biosketch_tool_rating_dismissed', 'true');
      // Dismiss all smart suggestions
      localStorage.setItem('dismissedSuggestions', JSON.stringify([
        'use-connectors',
        'keyboard-shortcuts',
        'alignment-guides',
        'use-layers',
        'align-selection',
      ]));
    });

    if (projectId) {
      await this.page.goto(`/canvas/${projectId}`);
    } else {
      await this.page.goto('/canvas');
    }
  }

  /**
   * Wait for canvas to be ready
   * Waits for canvas element to be visible, Fabric.js to initialize, and project to load
   * @param readOnlyMode If true, skips waiting for toolbar elements (for shared/read-only views)
   */
  async waitForCanvasReady(readOnlyMode = false, expectedObjectCount?: number): Promise<void> {
    await this.canvasElement.waitFor({ state: 'visible' });

    // Wait for loading indicator to disappear (if loading a project)
    const loadingIndicator = this.page.locator('text=Loading...');
    await loadingIndicator.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {
      // Loading indicator might not appear for new projects
    });

    // Wait for "Loading project..." toast to disappear
    const loadingToast = this.page.locator('text=Loading project...');
    await loadingToast.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {
      // Toast might not appear for new projects
    });

    // Wait for canvas context to be ready
    await this.page.waitForFunction(() => {
      const canvas = (window as any).fabricCanvas;
      return canvas !== undefined && canvas !== null;
    }, { timeout: 5000 });

    // If we're expecting a specific object count, wait for objects to be loaded
    if (expectedObjectCount !== undefined && expectedObjectCount > 0) {
      await this.page.waitForFunction((count) => {
        const canvas = (window as any).fabricCanvas;
        if (!canvas) return false;
        const userObjects = canvas.getObjects().filter((obj: any) => {
          return obj.selectable !== false &&
                 !obj.isGridLine &&
                 !obj.isRuler &&
                 obj.evented !== false;
        });
        return userObjects.length >= count;
      }, expectedObjectCount, { timeout: 10000 });
    } else {
      // Allow Fabric.js to fully initialize and load objects
      await this.page.waitForTimeout(2000);
    }

    // Wait for toolbar elements to be ready (skip in read-only mode)
    if (!readOnlyMode) {
      const shapesDropdown = this.page.getByTestId(CanvasEditorTestIds.SHAPES_DROPDOWN).last();
      await shapesDropdown.waitFor({ state: 'visible', timeout: 5000 });
    }
  }

  /**
   * Create a rectangle on canvas
   * @param x Starting x coordinate relative to canvas
   * @param y Starting y coordinate relative to canvas
   * @param width Width of the rectangle
   * @param height Height of the rectangle
   */
  async createRectangle(x: number, y: number, width: number, height: number): Promise<void> {
    // Press Escape to close any dialogs
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(200);

    // Dismiss any visible dialogs
    const dismissButton = this.page.getByRole('button', { name: /got it|don't show again/i });
    if (await dismissButton.isVisible({ timeout: 300 }).catch(() => false)) {
      await dismissButton.click();
      await this.page.waitForTimeout(200);
    }

    // Open the shapes dropdown (use last() as there may be multiple on the page)
    const shapesDropdown = this.page.getByTestId(CanvasEditorTestIds.SHAPES_DROPDOWN).last();
    await shapesDropdown.click({ force: true });

    // Wait for the dropdown menu to appear
    await this.rectangleTool.waitFor({ state: 'visible', timeout: 5000 });

    // Click rectangle from the menu (this will close the dropdown)
    await this.rectangleTool.click({ force: true });

    // Wait for tool to activate
    await this.page.waitForTimeout(300);

    const canvasBox = await this.canvasElement.boundingBox();
    if (!canvasBox) throw new Error('Canvas not found');

    const startX = canvasBox.x + x;
    const startY = canvasBox.y + y;
    const endX = startX + width;
    const endY = startY + height;

    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();
    await this.page.mouse.move(endX, endY);
    await this.page.mouse.up();

    // After drawing, a "Pro Tip" dialog may appear - dismiss it
    await this.page.waitForTimeout(300);

    // Dismiss any post-drawing dialogs
    const postDrawButton = this.page.getByRole('button', { name: /got it|don't show again|close/i });
    if (await postDrawButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await postDrawButton.click();
      await this.page.waitForTimeout(200);
    }

    // Press Escape to deselect without creating history entry
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(200);
  }

  /**
   * Create a circle on canvas
   * @param x Center x coordinate relative to canvas
   * @param y Center y coordinate relative to canvas
   * @param radius Radius of the circle
   */
  async createCircle(x: number, y: number, radius: number): Promise<void> {
    // Press Escape to close any dialogs
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(200);

    // Dismiss any visible dialogs
    const dismissButton = this.page.getByRole('button', { name: /got it|don't show again/i });
    if (await dismissButton.isVisible({ timeout: 300 }).catch(() => false)) {
      await dismissButton.click();
      await this.page.waitForTimeout(200);
    }

    // Open the shapes dropdown (use last() as there may be multiple on the page)
    const shapesDropdown = this.page.getByTestId(CanvasEditorTestIds.SHAPES_DROPDOWN).last();
    await shapesDropdown.click({ force: true });

    // Wait for the dropdown menu to appear
    await this.circleTool.waitFor({ state: 'visible', timeout: 5000 });

    // Click circle from the menu (this will close the dropdown)
    await this.circleTool.click({ force: true });

    // Wait for tool to activate
    await this.page.waitForTimeout(300);

    const canvasBox = await this.canvasElement.boundingBox();
    if (!canvasBox) throw new Error('Canvas not found');

    const centerX = canvasBox.x + x;
    const centerY = canvasBox.y + y;
    const edgeX = centerX + radius;
    const edgeY = centerY + radius;

    await this.page.mouse.move(centerX, centerY);
    await this.page.mouse.down();
    await this.page.mouse.move(edgeX, edgeY);
    await this.page.mouse.up();

    // After drawing, a "Pro Tip" dialog may appear - dismiss it
    await this.page.waitForTimeout(300);

    // Dismiss any post-drawing dialogs
    const postDrawButton = this.page.getByRole('button', { name: /got it|don't show again|close/i });
    if (await postDrawButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await postDrawButton.click();
      await this.page.waitForTimeout(200);
    }

    // Press Escape to deselect without creating history entry
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(200);
  }

  /**
   * Click on canvas at specific coordinates
   * @param x X coordinate relative to canvas
   * @param y Y coordinate relative to canvas
   */
  async clickCanvas(x: number, y: number): Promise<void> {
    const canvasBox = await this.canvasElement.boundingBox();
    if (!canvasBox) throw new Error('Canvas not found');

    await this.page.mouse.click(canvasBox.x + x, canvasBox.y + y);
  }

  /**
   * Select object by clicking on it
   * @param x X coordinate of object
   * @param y Y coordinate of object
   */
  async selectObjectAt(x: number, y: number): Promise<void> {
    await this.selectTool.click({ force: true });
    await this.clickCanvas(x, y);
  }

  /**
   * Multi-select objects by dragging a selection box
   * @param positions Array of positions to include in selection
   */
  async multiSelectObjectsAt(positions: { x: number; y: number }[]): Promise<void> {
    await this.selectTool.click({ force: true });
    await this.page.waitForTimeout(200);

    // Calculate bounding box that encompasses all positions
    // Use larger padding to ensure all objects are fully included
    const minX = Math.min(...positions.map(p => p.x)) - 60;
    const minY = Math.min(...positions.map(p => p.y)) - 60;
    const maxX = Math.max(...positions.map(p => p.x)) + 60;
    const maxY = Math.max(...positions.map(p => p.y)) + 60;

    // Drag selection box from top-left to bottom-right while holding Shift
    const canvasBox = await this.canvasElement.boundingBox();
    if (!canvasBox) throw new Error('Canvas not found');

    const startX = canvasBox.x + minX;
    const startY = canvasBox.y + minY;
    const endX = canvasBox.x + maxX;
    const endY = canvasBox.y + maxY;

    // Hold Shift for multi-selection
    await this.page.keyboard.down('Shift');
    await this.page.waitForTimeout(100);

    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();
    await this.page.mouse.move(endX, endY);
    await this.page.mouse.up();

    await this.page.keyboard.up('Shift');
    await this.page.waitForTimeout(300);
  }

  /**
   * Toggle grid visibility
   */
  async toggleGrid(): Promise<void> {
    // Dismiss any onboarding dialogs
    const dismissButton = this.page.getByText("Got it, don't show again");
    if (await dismissButton.isVisible().catch(() => false)) {
      await dismissButton.click();
      await this.page.waitForTimeout(300);
    }

    // Click Grid & Rulers button to open the popover
    const gridRulersButton = this.page.getByTestId('canvas-editor-grid-and-rulers-button');
    await gridRulersButton.click();
    await this.page.waitForTimeout(300);

    // Click Grid toggle
    const gridToggle = this.page.getByTestId('canvas-editor-grid-toggle');
    await gridToggle.click();
    await this.page.waitForTimeout(500);

    // Close the popover (click outside or press Escape)
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(300);
  }

  /**
   * Toggle snap to grid
   */
  async toggleSnapToGrid(): Promise<void> {
    // Dismiss any onboarding dialogs
    const dismissButton = this.page.getByText("Got it, don't show again");
    if (await dismissButton.isVisible().catch(() => false)) {
      await dismissButton.click();
      await this.page.waitForTimeout(300);
    }

    // Click Grid & Rulers button to open the popover
    const gridRulersButton = this.page.getByTestId('canvas-editor-grid-and-rulers-button');
    await gridRulersButton.click();
    await this.page.waitForTimeout(300);

    // Click Snap to Grid toggle
    const snapToggle = this.page.getByTestId('canvas-editor-snap-to-grid-toggle');
    await snapToggle.click();
    await this.page.waitForTimeout(500);

    // Close the popover
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(300);
  }

  /**
   * Perform undo operation
   */
  async undo(): Promise<void> {
    await this.undoButton.click();
  }

  /**
   * Perform redo operation
   */
  async redo(): Promise<void> {
    await this.redoButton.click();
  }

  /**
   * Group selected objects
   */
  async groupSelected(): Promise<void> {
    // Dismiss any dialogs that might be blocking interactions
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(300);

    // Use keyboard shortcut instead of button click to avoid dialog interference
    // ⌘G on Mac (Meta+G), Ctrl+G on other platforms
    const isMac = process.platform === 'darwin';
    if (isMac) {
      await this.page.keyboard.press('Meta+g');
    } else {
      await this.page.keyboard.press('Control+g');
    }
    await this.page.waitForTimeout(500);
  }

  /**
   * Ungroup selected group
   */
  async ungroupSelected(): Promise<void> {
    // Use keyboard shortcut to avoid dialog interference
    // ⌘⇧G on Mac (Meta+Shift+G - uppercase G), Ctrl+Shift+G on other platforms
    const isMac = process.platform === 'darwin';
    if (isMac) {
      await this.page.keyboard.press('Meta+Shift+G');
    } else {
      await this.page.keyboard.press('Control+Shift+G');
    }
    await this.page.waitForTimeout(500);
  }

  /**
   * Switch to Layers tab in the right panel
   */
  async openLayersPanel(): Promise<void> {
    const layersTab = this.page.getByRole('tab', { name: 'Layers' });
    await layersTab.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Get layer item by index
   * @param index Layer index
   */
  getLayerItem(index: number): Locator {
    return this.page.getByTestId(`${CanvasEditorTestIds.LAYER_ITEM}-${index}`);
  }

  /**
   * Toggle layer visibility by index
   * @param index Layer index
   */
  async toggleLayerVisibility(index: number): Promise<void> {
    // Make sure Layers panel is open
    await this.openLayersPanel();

    const toggle = this.page.getByTestId(`${CanvasEditorTestIds.LAYER_VISIBILITY_TOGGLE}-${index}`);
    await toggle.click();
  }

  /**
   * Toggle layer lock by index
   * @param index Layer index
   */
  async toggleLayerLock(index: number): Promise<void> {
    // Make sure Layers panel is open
    await this.openLayersPanel();

    const toggle = this.page.getByTestId(`${CanvasEditorTestIds.LAYER_LOCK_TOGGLE}-${index}`);
    await toggle.click();
  }

  /**
   * Reorder layer (drag and drop)
   * @param fromIndex Source layer index
   * @param toIndex Target layer index
   */
  async reorderLayer(fromIndex: number, toIndex: number): Promise<void> {
    // Make sure Layers panel is open
    await this.openLayersPanel();

    const sourceLayer = this.getLayerItem(fromIndex);
    const targetLayer = this.getLayerItem(toIndex);

    // Hover over source layer to make drag handle visible
    await sourceLayer.hover();
    await this.page.waitForTimeout(200);

    // Get the drag handle (first child div within the layer item)
    // The drag handle has the dnd-kit attributes
    const sourceDragHandle = sourceLayer.locator('> div').first();
    const targetDragHandle = targetLayer.locator('> div').first();

    // Get bounding boxes
    const sourceHandleBox = await sourceDragHandle.boundingBox();
    const targetLayerBox = await targetLayer.boundingBox();

    if (!sourceHandleBox || !targetLayerBox) {
      throw new Error('Could not get bounding boxes for drag operation');
    }

    // Calculate points
    const sourceX = sourceHandleBox.x + sourceHandleBox.width / 2;
    const sourceY = sourceHandleBox.y + sourceHandleBox.height / 2;
    const targetX = targetLayerBox.x + targetLayerBox.width / 2;
    const targetY = targetLayerBox.y + targetLayerBox.height / 2;

    // Perform drag with pointer events (required for @dnd-kit)
    await this.page.mouse.move(sourceX, sourceY);
    await this.page.waitForTimeout(100);
    await this.page.mouse.down();
    await this.page.waitForTimeout(200);

    // Move to target in steps
    const steps = 5;
    for (let i = 1; i <= steps; i++) {
      const x = sourceX + (targetX - sourceX) * (i / steps);
      const y = sourceY + (targetY - sourceY) * (i / steps);
      await this.page.mouse.move(x, y);
      await this.page.waitForTimeout(50);
    }

    await this.page.waitForTimeout(200);
    await this.page.mouse.up();
    await this.page.waitForTimeout(500);
  }

  /**
   * Get canvas object count via page evaluation
   * @returns Number of user-created objects on canvas (excludes grid lines, rulers, etc.)
   */
  async getCanvasObjectCount(): Promise<number> {
    return await this.page.evaluate(() => {
      // Access Fabric.js canvas instance from window
      const canvas = (window as any).fabricCanvas;
      if (!canvas) return 0;

      // Filter out internal objects (grid lines, rulers, etc.)
      const userObjects = canvas.getObjects().filter((obj: any) => {
        return obj.selectable !== false &&
               !obj.isGridLine &&
               !obj.isRuler &&
               obj.evented !== false;
      });

      return userObjects.length;
    });
  }

  /**
   * Check if object is selected
   * @returns True if an object is selected
   */
  async hasSelectedObject(): Promise<boolean> {
    return await this.page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      return canvas && canvas.getActiveObject() !== null;
    });
  }

  /**
   * Set object width
   * @param width Width value as string
   */
  async setObjectWidth(width: string): Promise<void> {
    // First switch to Properties panel (in case we're on Layers panel)
    await this.page.getByRole('tab', { name: 'Properties' }).click({ force: true });
    await this.page.waitForTimeout(200);

    // Switch to Transform tab where Size section is located (using button text since they're custom buttons)
    await this.page.getByRole('button', { name: 'Transform', exact: true }).click({ force: true });
    await this.page.waitForTimeout(200);

    // Expand Size section if collapsed
    const sizeSection = this.page.locator('#section-size');
    const sizeSectionHeader = sizeSection.locator('div').first();
    const isCollapsed = await sizeSection.locator('svg.lucide-chevron-right').isVisible().catch(() => false);

    if (isCollapsed) {
      await sizeSectionHeader.click();
      await this.page.waitForTimeout(200);
    }

    await this.objectWidthInput.fill(width);
    await this.page.keyboard.press('Enter');
  }

  /**
   * Set object height
   * @param height Height value as string
   */
  async setObjectHeight(height: string): Promise<void> {
    // First switch to Properties panel (in case we're on Layers panel)
    await this.page.getByRole('tab', { name: 'Properties' }).click({ force: true });
    await this.page.waitForTimeout(200);

    // Switch to Transform tab where Size section is located (using button text since they're custom buttons)
    await this.page.getByRole('button', { name: 'Transform', exact: true }).click({ force: true });
    await this.page.waitForTimeout(200);

    // Expand Size section if collapsed
    const sizeSection = this.page.locator('#section-size');
    const sizeSectionHeader = sizeSection.locator('div').first();
    const isCollapsed = await sizeSection.locator('svg.lucide-chevron-right').isVisible().catch(() => false);

    if (isCollapsed) {
      await sizeSectionHeader.click();
      await this.page.waitForTimeout(200);
    }

    await this.objectHeightInput.fill(height);
    await this.page.keyboard.press('Enter');
  }

  /**
   * Get object width value
   * @returns Width value as string
   */
  async getObjectWidth(): Promise<string> {
    // First switch to Properties panel (in case we're on Layers panel)
    await this.page.getByRole('tab', { name: 'Properties' }).click({ force: true });
    await this.page.waitForTimeout(200);

    // Switch to Transform tab where Size section is located
    await this.page.getByRole('button', { name: 'Transform', exact: true }).click({ force: true });
    await this.page.waitForTimeout(200);

    // Expand Size section if collapsed
    const sizeSection = this.page.locator('#section-size');
    const sizeSectionHeader = sizeSection.locator('div').first();
    const isCollapsed = await sizeSection.locator('svg.lucide-chevron-right').isVisible().catch(() => false);

    if (isCollapsed) {
      await sizeSectionHeader.click();
      await this.page.waitForTimeout(200);
    }

    return await this.objectWidthInput.inputValue();
  }

  /**
   * Get object height value
   * @returns Height value as string
   */
  async getObjectHeight(): Promise<string> {
    // First switch to Properties panel (in case we're on Layers panel)
    await this.page.getByRole('tab', { name: 'Properties' }).click({ force: true });
    await this.page.waitForTimeout(200);

    // Switch to Transform tab where Size section is located
    await this.page.getByRole('button', { name: 'Transform', exact: true }).click({ force: true });
    await this.page.waitForTimeout(200);

    // Expand Size section if collapsed
    const sizeSection = this.page.locator('#section-size');
    const sizeSectionHeader = sizeSection.locator('div').first();
    const isCollapsed = await sizeSection.locator('svg.lucide-chevron-right').isVisible().catch(() => false);

    if (isCollapsed) {
      await sizeSectionHeader.click();
      await this.page.waitForTimeout(200);
    }

    return await this.objectHeightInput.inputValue();
  }

  /**
   * Click zoom in button
   */
  async clickZoomIn(): Promise<void> {
    await this.page.getByTestId(CanvasEditorTestIds.ZOOM_IN_BUTTON).click();
  }

  /**
   * Click zoom out button
   */
  async clickZoomOut(): Promise<void> {
    await this.page.getByTestId(CanvasEditorTestIds.ZOOM_OUT_BUTTON).click();
  }

  /**
   * Get current zoom level
   * @returns Zoom level as a number (e.g., 100 for 100%)
   */
  async getZoomLevel(): Promise<number> {
    const text = await this.page.getByTestId(CanvasEditorTestIds.ZOOM_PERCENTAGE_BUTTON).textContent();
    return parseInt(text?.replace('%', '') || '100');
  }

  /**
   * Upload an image to the canvas using the UI file picker
   * @param filePath Absolute path to the image file
   */
  async uploadImage(filePath: string): Promise<void> {
    // Dismiss any dialogs first
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(300);

    // Find the Image tool button using test ID
    const imageButton = this.page.getByTestId(CanvasEditorTestIds.IMAGE_BUTTON);

    // Click the image button to open dropdown
    await imageButton.click();
    await this.page.waitForTimeout(500);

    // Set up file chooser handler BEFORE clicking the menu item
    const fileChooserPromise = this.page.waitForEvent('filechooser');

    // Click "Image" option in the dropdown menu (not "Image Placeholder")
    // This click triggers the file chooser
    const imageMenuItem = this.page.getByRole('menuitem')
      .filter({ hasText: 'Image' })
      .filter({ hasNotText: 'Placeholder' })
      .first();
    await imageMenuItem.click();

    // Handle the file chooser
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(filePath);

    // Wait for upload to complete — the success toast replaces the loading toast
    await this.page.getByText('Image added to canvas').waitFor({ state: 'visible', timeout: 15000 }).catch(() => {
      // Fallback: wait a fixed time if toast text not found
    });
    await this.page.waitForTimeout(500);
  }

  /**
   * Save the current project
   */
  async saveProject(): Promise<void> {
    const saveButton = this.page.getByRole('button', { name: /save/i });
    await saveButton.click();
    await this.page.waitForTimeout(1500); // Wait for save and potential navigation
  }
}
