import { Page, Locator } from '@playwright/test';
import { CanvasSizeTestIds } from '@/lib/test-ids';

/**
 * Page Object Model for Canvas Size Dialog
 * Handles custom canvas dimension configuration
 */
export class CanvasSizeDialogPage {
  readonly page: Page;

  readonly dialog: Locator;
  readonly dialogTrigger: Locator;
  readonly widthInput: Locator;
  readonly heightInput: Locator;
  readonly unitSelect: Locator;
  readonly applyButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.dialog = page.getByTestId(CanvasSizeTestIds.SIZE_DIALOG);
    this.dialogTrigger = page.getByTestId(CanvasSizeTestIds.SIZE_DIALOG_TRIGGER);
    this.widthInput = page.getByTestId(CanvasSizeTestIds.WIDTH_INPUT);
    this.heightInput = page.getByTestId(CanvasSizeTestIds.HEIGHT_INPUT);
    this.unitSelect = page.getByTestId(CanvasSizeTestIds.UNIT_SELECT);
    this.applyButton = page.getByTestId(CanvasSizeTestIds.APPLY_BUTTON);
    this.cancelButton = page.getByTestId(CanvasSizeTestIds.CANCEL_BUTTON);
  }

  /**
   * Dismiss any Pro Tip or tutorial dialogs that might appear
   */
  private async dismissDialogs(): Promise<void> {
    // Try pressing Escape first to close any dialogs
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(100);

    // Also try clicking X buttons or action buttons if they exist
    const closeButtons = this.page.locator('button').filter({ hasText: /show grid|don't show|got it|close|^×$/i });
    const closeCount = await closeButtons.count();
    for (let i = 0; i < closeCount; i++) {
      const button = closeButtons.nth(i);
      if (await button.isVisible().catch(() => false)) {
        await button.click();
        await this.page.waitForTimeout(100);
        break;
      }
    }
  }

  /**
   * Open canvas size dialog
   * Note: Paper Size section appears in Properties panel when no object is selected
   * This actually expands an accordion and selects "Custom" size
   * This method is idempotent - safe to call multiple times
   */
  async open(): Promise<void> {
    // Check if inputs are already visible (idempotent check)
    const isAlreadyOpen = await this.widthInput.isVisible().catch(() => false);
    if (isAlreadyOpen) {
      // Already open, nothing to do
      return;
    }

    // Click canvas background to deselect objects (this shows Paper Size section automatically)
    const canvas = this.page.locator('canvas').first();
    await canvas.waitFor({ state: 'visible', timeout: 10000 });
    await canvas.click({ force: true });
    await this.page.waitForTimeout(300);

    // Dismiss any dialogs that might appear after canvas click
    await this.dismissDialogs();

    // Scroll Paper Size accordion into view and click to expand it
    await this.dialogTrigger.scrollIntoViewIfNeeded();
    await this.dialogTrigger.click({ force: true });
    await this.page.waitForTimeout(500);

    // Dismiss any dialogs that appeared after expanding accordion
    await this.dismissDialogs();

    // Check if Custom is already selected by looking for width input
    const isCustomAlreadySelected = await this.widthInput.isVisible().catch(() => false);

    if (!isCustomAlreadySelected) {
      // Custom is not selected, so we need to select it from dropdown
      const paperSizeSelect = this.page.getByTestId(CanvasSizeTestIds.PAPER_SIZE_SELECT);
      await paperSizeSelect.waitFor({ state: 'visible', timeout: 5000 });
      await paperSizeSelect.click({ force: true });
      await this.page.waitForTimeout(500);

      // Wait for dropdown to open and click Custom option
      const customOption = this.page.getByRole('option', { name: /custom/i });
      await customOption.waitFor({ state: 'visible', timeout: 5000 });
      await customOption.click();
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * Set canvas dimensions
   * @param width Width value
   * @param height Height value
   * @param unit Optional unit ('inches' | 'cm' | 'px')
   */
  async setDimensions(width: string, height: string, unit?: 'inches' | 'cm' | 'px'): Promise<void> {
    await this.widthInput.fill(width);
    await this.heightInput.fill(height);

    if (unit) {
      await this.selectUnit(unit);
    }
  }

  /**
   * Select dimension unit
   * @param unit Unit type ('inches' | 'cm' | 'px')
   */
  async selectUnit(unit: 'inches' | 'cm' | 'px'): Promise<void> {
    // ToggleGroup - click the toggle item directly (no need to open dropdown)
    const unitTestId =
      unit === 'inches'
        ? CanvasSizeTestIds.UNIT_INCHES
        : unit === 'cm'
        ? CanvasSizeTestIds.UNIT_CM
        : CanvasSizeTestIds.UNIT_PX;
    await this.page.getByTestId(unitTestId).click();
  }

  /**
   * Apply canvas size changes
   * Note: This is an inline form, not a modal, so it doesn't hide after applying
   */
  async apply(): Promise<void> {
    await this.applyButton.click();
    await this.page.waitForTimeout(500); // Wait for dimensions to be applied
  }

  /**
   * Cancel canvas size changes
   */
  async cancel(): Promise<void> {
    await this.cancelButton.click();
    await this.dialog.waitFor({ state: 'hidden' });
  }

  /**
   * Get current canvas dimensions from page
   * @returns Canvas dimensions {width, height}
   */
  async getCanvasDimensions(): Promise<{ width: number; height: number }> {
    return await this.page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      return {
        width: canvas.width,
        height: canvas.height,
      };
    });
  }
}
