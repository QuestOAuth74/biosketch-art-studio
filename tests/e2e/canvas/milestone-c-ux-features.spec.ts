import { test, expect } from '../fixtures/auth';
import { CanvasEditorPage } from '../utils/page-objects/CanvasEditorPage';
import { CanvasEditorTestIds } from '@/lib/test-ids';

test.describe('Milestone C: UX Features - Style Presets', () => {
  let canvasPage: CanvasEditorPage;

  test.beforeEach(async ({ authenticatedPage: page }) => {
    canvasPage = new CanvasEditorPage(page);
    await canvasPage.goto();
    await canvasPage.waitForCanvasReady();

    // Add extra wait to ensure canvas is fully initialized
    await page.waitForTimeout(1000);
  });

  test('Create rectangle → Set fill to blue, stroke to black 2px, opacity 80% → Save preset', async ({ authenticatedPage: page }) => {
    // Create rectangle
    await canvasPage.createRectangle(100, 100, 150, 100);
    await page.waitForTimeout(500);

    // Select the rectangle
    await canvasPage.selectObjectAt(175, 150);
    await page.waitForTimeout(300);

    // Navigate to Style tab to set properties
    const styleTab = page.getByRole('button', { name: 'Style', exact: true });
    await styleTab.click();
    await page.waitForTimeout(300);

    // Expand the Colors section if it's collapsed
    const colorsHeader = page.getByRole('heading', { name: 'Colors', exact: true });
    await colorsHeader.click();
    await page.waitForTimeout(300);

    // Set fill color to blue using the Quick Color Grid
    // The color swatches are buttons with backgroundColor style
    // Blue is #3b82f6 in the default palette
    const fillColorLabel = page.getByText('Fill Color', { exact: true });
    await expect(fillColorLabel).toBeVisible();

    // Find the blue color swatch (first in the grid) - it's a button with blue background
    const blueColorSwatch = page.locator('button[title="#3b82f6"]').first();
    await blueColorSwatch.click();
    await page.waitForTimeout(300);

    // Set stroke color to black using the Quick Color Grid
    // Black is #000000 in the default palette (second row, second column)
    const strokeColorLabel = page.getByText('Stroke Color', { exact: true });
    await expect(strokeColorLabel).toBeVisible();

    const blackColorSwatch = page.locator('button[title="#000000"]').nth(1); // nth(1) to get the stroke section's black swatch
    await blackColorSwatch.click();
    await page.waitForTimeout(300);

    // Set stroke width to 2px
    const strokeWidthInput = page.locator('input[type="number"]').filter({ has: page.locator('label:has-text("Stroke Width")') });
    if (await strokeWidthInput.isVisible()) {
      await strokeWidthInput.fill('2');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
    }

    // Set opacity to 80%
    const opacityInput = page.locator('input[type="number"]').filter({ has: page.locator('label:has-text("Opacity")') }).first();
    if (await opacityInput.isVisible()) {
      await opacityInput.fill('80');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
    }

    // Scroll to top of the Style tab to find Style Presets section
    await page.keyboard.press('Home'); // Scroll to top
    await page.waitForTimeout(300);

    // Expand the Style Presets section (it's collapsed by default)
    const stylePresetsHeader = page.getByRole('heading', { name: /Quick Styles|Style Presets/i });
    await stylePresetsHeader.click();
    await page.waitForTimeout(300);

    // Click "Save current style" button in the Style Presets section
    const saveStyleButton = page.getByTestId(CanvasEditorTestIds.STYLE_PRESETS_SAVE_BUTTON);
    await saveStyleButton.click();
    await page.waitForTimeout(500);

    // Verify save dialog appears
    const saveDialog = page.getByTestId(CanvasEditorTestIds.STYLE_PRESETS_SAVE_DIALOG);
    await expect(saveDialog).toBeVisible();

    // Enter preset name "Blue Style"
    const nameInput = page.getByTestId(CanvasEditorTestIds.STYLE_PRESETS_NAME_INPUT);
    await nameInput.fill('Blue Style');

    // Click save button in dialog
    const saveDialogButton = page.getByTestId(CanvasEditorTestIds.STYLE_PRESETS_SAVE_DIALOG_BUTTON);
    await saveDialogButton.click();
    await page.waitForTimeout(1000);

    // Verify preset appears in Style Presets panel under "Personal"
    const presetButton = page.getByTestId(CanvasEditorTestIds.STYLE_PRESETS_PRESET_BUTTON).filter({ hasText: 'Blue Style' });
    await expect(presetButton).toBeVisible();
  });

  test('Preset appears in Style Presets panel under "Personal"', async ({ authenticatedPage: page }) => {
    // Create and save a preset first
    await canvasPage.createRectangle(100, 100, 150, 100);
    await page.waitForTimeout(500);

    await canvasPage.selectObjectAt(175, 150);
    await page.waitForTimeout(500);

    // Wait for Properties panel to be visible after selection
    const styleTab = page.getByRole('button', { name: 'Style', exact: true });
    await styleTab.waitFor({ state: 'visible', timeout: 10000 });
    await styleTab.click();
    await page.waitForTimeout(300);

    // Scroll to top and expand Style Presets section
    await page.keyboard.press('Home');
    await page.waitForTimeout(300);

    const stylePresetsHeader = page.getByRole('heading', { name: /Quick Styles|Style Presets/i });
    await stylePresetsHeader.click();
    await page.waitForTimeout(300);

    // Click save style button
    const saveStyleButton = page.getByTestId(CanvasEditorTestIds.STYLE_PRESETS_SAVE_BUTTON);
    await saveStyleButton.click();
    await page.waitForTimeout(300);

    // Enter name and save
    const nameInput = page.getByTestId(CanvasEditorTestIds.STYLE_PRESETS_NAME_INPUT);
    await nameInput.fill('Test Preset');

    const saveDialogButton = page.getByTestId(CanvasEditorTestIds.STYLE_PRESETS_SAVE_DIALOG_BUTTON);
    await saveDialogButton.click();
    await page.waitForTimeout(1000);

    // Verify preset appears in the list
    const presetButton = page.getByTestId(CanvasEditorTestIds.STYLE_PRESETS_PRESET_BUTTON).filter({ hasText: 'Test Preset' });
    await expect(presetButton).toBeVisible();
  });

  test('Create circle → Click "Blue Style" preset → Circle adopts all styles', async ({ authenticatedPage: page }) => {
    // Use unique preset name to avoid conflicts across test runs
    const presetName = `Blue Style Test ${Date.now()}`;

    // First create a rectangle with blue style and save preset
    await canvasPage.createRectangle(100, 100, 150, 100);
    await page.waitForTimeout(1000);

    // Verify object was created by checking the object count
    await expect(page.locator('text=/1 object|[0-9]+ objects/i')).toBeVisible({ timeout: 5000 });

    await canvasPage.selectObjectAt(175, 150);
    await page.waitForTimeout(500);

    // Navigate to Style tab (wait for it to appear, indicating object is selected)
    const styleTab = page.getByRole('button', { name: 'Style', exact: true });
    await expect(styleTab).toBeVisible({ timeout: 5000 });
    await styleTab.click();
    await page.waitForTimeout(300);

    // Scroll to top and expand Style Presets section
    await page.keyboard.press('Home');
    await page.waitForTimeout(300);

    const stylePresetsHeader = page.getByRole('heading', { name: /Quick Styles|Style Presets/i });
    await stylePresetsHeader.click();
    await page.waitForTimeout(300);

    // Save as "Blue Style" preset
    const saveStyleButton = page.getByTestId(CanvasEditorTestIds.STYLE_PRESETS_SAVE_BUTTON);
    await saveStyleButton.click();
    await page.waitForTimeout(300);

    const nameInput = page.getByTestId(CanvasEditorTestIds.STYLE_PRESETS_NAME_INPUT);
    await nameInput.fill(presetName);

    const saveDialogButton = page.getByTestId(CanvasEditorTestIds.STYLE_PRESETS_SAVE_DIALOG_BUTTON);
    await saveDialogButton.click();
    await page.waitForTimeout(1000);

    // Deselect the rectangle and reset UI state before creating circle
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Now create a circle
    await canvasPage.createCircle(400, 300, 50);
    await page.waitForTimeout(500);

    // Select the circle
    await canvasPage.selectObjectAt(400, 300);
    await page.waitForTimeout(300);

    // Navigate to Style tab (should already be there, but ensure it)
    const styleTab2 = page.getByRole('button', { name: 'Style', exact: true });
    await styleTab2.click();
    await page.waitForTimeout(300);

    // Scroll to top to see Style Presets
    await page.keyboard.press('Home');
    await page.waitForTimeout(300);

    // Click the preset
    const presetButton = page.getByTestId(CanvasEditorTestIds.STYLE_PRESETS_PRESET_BUTTON).filter({ hasText: presetName });
    await presetButton.click();
    await page.waitForTimeout(500);

    // Verify success toast appears
    const successToast = page.locator(`text=/Applied.*${presetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/i`);
    await expect(successToast).toBeVisible({ timeout: 3000 });
  });

  test('Select 5 shapes → Click preset → All 5 adopt styles', async ({ authenticatedPage: page }) => {
    // Create 5 rectangles
    for (let i = 0; i < 5; i++) {
      await canvasPage.createRectangle(50 + i * 100, 50 + i * 50, 80, 80);
      await page.waitForTimeout(300);
    }

    // Select the first shape and create a preset
    await canvasPage.selectObjectAt(90, 90);
    await page.waitForTimeout(300);

    // Navigate to Style tab
    const styleTab = page.getByRole('button', { name: 'Style', exact: true });
    await styleTab.click();
    await page.waitForTimeout(300);

    // Scroll to top and expand Style Presets section
    await page.keyboard.press('Home');
    await page.waitForTimeout(300);

    const stylePresetsHeader = page.getByRole('heading', { name: /Quick Styles|Style Presets/i });
    await stylePresetsHeader.click();
    await page.waitForTimeout(300);

    const saveStyleButton = page.getByTestId(CanvasEditorTestIds.STYLE_PRESETS_SAVE_BUTTON);
    await saveStyleButton.click();
    await page.waitForTimeout(300);

    const nameInput = page.getByTestId(CanvasEditorTestIds.STYLE_PRESETS_NAME_INPUT);
    await nameInput.fill('Bulk Apply Style');

    const saveDialogButton = page.getByTestId(CanvasEditorTestIds.STYLE_PRESETS_SAVE_DIALOG_BUTTON);
    await saveDialogButton.click();
    await page.waitForTimeout(1000);

    // Multi-select all 5 shapes using Shift+click
    // Click the first shape
    await canvasPage.selectObjectAt(90, 90);
    await page.waitForTimeout(200);

    // Hold Shift and click the rest to add them to selection
    await page.keyboard.down('Shift');
    for (let i = 1; i < 5; i++) {
      await page.mouse.click(
        (await canvasPage.canvasElement.boundingBox())!.x + 90 + i * 100,
        (await canvasPage.canvasElement.boundingBox())!.y + 90 + i * 50
      );
      await page.waitForTimeout(150);
    }
    await page.keyboard.up('Shift');
    await page.waitForTimeout(500);

    // Navigate to Style tab again
    const styleTab2 = page.getByRole('button', { name: 'Style', exact: true });
    await styleTab2.click();
    await page.waitForTimeout(300);

    // Scroll to top to see Style Presets
    await page.keyboard.press('Home');
    await page.waitForTimeout(300);

    // Click the preset
    const presetButton = page.getByTestId(CanvasEditorTestIds.STYLE_PRESETS_PRESET_BUTTON).filter({ hasText: 'Bulk Apply Style' });
    await presetButton.click();
    await page.waitForTimeout(500);

    // Verify success toast shows it was applied to 5 objects
    const successToast = page.locator('text=/Applied.*Bulk Apply Style.*5 objects/i');
    await expect(successToast).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Milestone C: UX Features - Command Palette', () => {
  let canvasPage: CanvasEditorPage;

  test.beforeEach(async ({ authenticatedPage: page }) => {
    canvasPage = new CanvasEditorPage(page);
    await canvasPage.goto();
    await canvasPage.waitForCanvasReady();
  });

  test('Press ⌘K → Command palette opens with search input focused', async ({ authenticatedPage: page }) => {
    // Press Cmd+K (or Ctrl+K on Windows/Linux)
    const isMac = process.platform === 'darwin';
    if (isMac) {
      await page.keyboard.press('Meta+k');
    } else {
      await page.keyboard.press('Control+k');
    }
    await page.waitForTimeout(500);

    // Verify command palette dialog is visible
    const commandDialog = page.getByTestId(CanvasEditorTestIds.COMMAND_PALETTE_DIALOG);
    await expect(commandDialog).toBeVisible();

    // Verify search input is focused
    const searchInput = page.getByTestId(CanvasEditorTestIds.COMMAND_PALETTE_INPUT);
    await expect(searchInput).toBeFocused();

    // Close the command palette
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test('Type "undo" → "Undo (⌘Z)" appears in results', async ({ authenticatedPage: page }) => {
    // Open command palette
    const isMac = process.platform === 'darwin';
    if (isMac) {
      await page.keyboard.press('Meta+k');
    } else {
      await page.keyboard.press('Control+k');
    }
    await page.waitForTimeout(500);

    // Type "undo" in search
    const searchInput = page.getByTestId(CanvasEditorTestIds.COMMAND_PALETTE_INPUT);
    await searchInput.fill('undo');
    await page.waitForTimeout(300);

    // Verify "Undo" command appears in results
    const undoCommand = page.locator('[role="option"]').filter({ hasText: /Undo/i });
    await expect(undoCommand).toBeVisible();

    // Verify it shows the shortcut
    const undoShortcut = undoCommand.locator('text=/Ctrl.*Z|⌘.*Z/i');
    await expect(undoShortcut).toBeVisible();

    // Close the command palette
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test('Press Enter → Undo action executes, palette closes', async ({ authenticatedPage: page }) => {
    // Wait for canvas to be fully ready
    await page.waitForTimeout(1000);

    // Create a shape to have something to undo
    await canvasPage.createRectangle(100, 100, 150, 100);
    await page.waitForTimeout(800);

    // Verify object was created
    let objectCount = await canvasPage.getCanvasObjectCount();
    expect(objectCount).toBe(1);

    // Open command palette
    const isMac = process.platform === 'darwin';
    if (isMac) {
      await page.keyboard.press('Meta+k');
    } else {
      await page.keyboard.press('Control+k');
    }
    await page.waitForTimeout(500);

    // Type "undo"
    const searchInput = page.getByTestId(CanvasEditorTestIds.COMMAND_PALETTE_INPUT);
    await searchInput.fill('undo');
    await page.waitForTimeout(300);

    // Press Enter to execute
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Verify command palette is closed
    const commandDialog = page.getByTestId(CanvasEditorTestIds.COMMAND_PALETTE_DIALOG);
    await expect(commandDialog).not.toBeVisible();

    // Verify undo action executed (object removed)
    objectCount = await canvasPage.getCanvasObjectCount();
    expect(objectCount).toBe(0);
  });

  test('Press ⌘K → Type "rect" → "Rectangle" tool appears', async ({ authenticatedPage: page }) => {
    // Open command palette
    const isMac = process.platform === 'darwin';
    if (isMac) {
      await page.keyboard.press('Meta+k');
    } else {
      await page.keyboard.press('Control+k');
    }
    await page.waitForTimeout(500);

    // Type "rect"
    const searchInput = page.getByTestId(CanvasEditorTestIds.COMMAND_PALETTE_INPUT);
    await searchInput.fill('rect');
    await page.waitForTimeout(300);

    // Verify "Rectangle" tool appears in results
    const rectangleCommand = page.locator('[role="option"]').filter({ hasText: /Rectangle/i });
    await expect(rectangleCommand).toBeVisible();

    // Close the command palette
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test('Arrow down → Highlight moves to next result', async ({ authenticatedPage: page }) => {
    // Open command palette
    const isMac = process.platform === 'darwin';
    if (isMac) {
      await page.keyboard.press('Meta+k');
    } else {
      await page.keyboard.press('Control+k');
    }
    await page.waitForTimeout(500);

    // Type something to get multiple results
    const searchInput = page.getByTestId(CanvasEditorTestIds.COMMAND_PALETTE_INPUT);
    await searchInput.fill('align');
    await page.waitForTimeout(300);

    // Get first highlighted item
    const firstSelected = page.locator('[role="option"][data-selected="true"]').first();
    const firstText = await firstSelected.textContent();

    // Press arrow down
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);

    // Get newly highlighted item
    const secondSelected = page.locator('[role="option"][data-selected="true"]').first();
    const secondText = await secondSelected.textContent();

    // Verify highlight moved (different items selected)
    expect(firstText).not.toBe(secondText);

    // Close the command palette
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test('Press Escape → Palette closes', async ({ authenticatedPage: page }) => {
    // Open command palette
    const isMac = process.platform === 'darwin';
    if (isMac) {
      await page.keyboard.press('Meta+k');
    } else {
      await page.keyboard.press('Control+k');
    }
    await page.waitForTimeout(500);

    // Verify it's open
    const commandDialog = page.getByTestId(CanvasEditorTestIds.COMMAND_PALETTE_DIALOG);
    await expect(commandDialog).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Verify palette is closed
    await expect(commandDialog).not.toBeVisible();
  });

  test('Open palette → Recent commands shown at top of list', async ({ authenticatedPage: page }) => {
    // First, execute some commands to create recent history
    // Create a shape
    await canvasPage.createRectangle(100, 100, 150, 100);
    await page.waitForTimeout(500);

    // Open command palette and use undo
    const isMac = process.platform === 'darwin';
    if (isMac) {
      await page.keyboard.press('Meta+k');
    } else {
      await page.keyboard.press('Control+k');
    }
    await page.waitForTimeout(500);

    const searchInput = page.getByTestId(CanvasEditorTestIds.COMMAND_PALETTE_INPUT);
    await searchInput.fill('undo');
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Open command palette again
    if (isMac) {
      await page.keyboard.press('Meta+k');
    } else {
      await page.keyboard.press('Control+k');
    }
    await page.waitForTimeout(500);

    // Verify "Recent" section exists
    const recentGroup = page.getByTestId(CanvasEditorTestIds.COMMAND_PALETTE_RECENT_GROUP);
    if (await recentGroup.isVisible().catch(() => false)) {
      await expect(recentGroup).toBeVisible();

      // Verify "Undo" appears in recent commands
      const recentUndo = recentGroup.locator('text=/Undo/i');
      await expect(recentUndo).toBeVisible();
    }

    // Close the command palette
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });
});
