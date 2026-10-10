import { Page, Locator, Download } from '@playwright/test';
import { ExportDialogTestIds } from '@/lib/test-ids';

/**
 * Page Object Model for Export Dialog
 * Handles export dialog interactions and settings
 */
export class ExportDialogPage {
  readonly page: Page;

  readonly dialog: Locator;
  readonly dialogTrigger: Locator;

  // Format selection
  readonly formatPNG: Locator;
  readonly formatJPEG: Locator;
  readonly formatSVG: Locator;
  readonly formatPDF: Locator;

  // DPI options
  readonly dpi150: Locator;
  readonly dpi300: Locator;
  readonly dpi600: Locator;

  // JPEG quality
  readonly qualitySlider: Locator;
  readonly qualityValue: Locator;

  // PDF options
  readonly cmykModeToggle: Locator;

  // Actions
  readonly exportButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.dialog = page.getByTestId(ExportDialogTestIds.DIALOG);
    this.dialogTrigger = page.getByTestId(ExportDialogTestIds.DIALOG_TRIGGER);

    this.formatPNG = page.getByTestId(ExportDialogTestIds.FORMAT_PNG);
    this.formatJPEG = page.getByTestId(ExportDialogTestIds.FORMAT_JPEG);
    this.formatSVG = page.getByTestId(ExportDialogTestIds.FORMAT_SVG);
    this.formatPDF = page.getByTestId(ExportDialogTestIds.FORMAT_PDF);

    this.dpi150 = page.getByTestId(ExportDialogTestIds.DPI_150);
    this.dpi300 = page.getByTestId(ExportDialogTestIds.DPI_300);
    this.dpi600 = page.getByTestId(ExportDialogTestIds.DPI_600);

    this.qualitySlider = page.getByTestId(ExportDialogTestIds.QUALITY_SLIDER);
    this.qualityValue = page.getByTestId(ExportDialogTestIds.QUALITY_VALUE);

    this.cmykModeToggle = page.getByTestId(ExportDialogTestIds.CMYK_MODE_TOGGLE);

    this.exportButton = page.getByTestId(ExportDialogTestIds.EXPORT_BUTTON);
    this.cancelButton = page.getByTestId(ExportDialogTestIds.CANCEL_BUTTON);
  }

  /**
   * Open export dialog
   * Note: Export is in File menu, so we need to open the menu first
   */
  async open(): Promise<void> {
    // Check if dialog is already open
    const isDialogVisible = await this.dialog.isVisible().catch(() => false);
    if (isDialogVisible) {
      // Dialog is already open, close it first
      await this.page.keyboard.press('Escape');
      await this.dialog.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
      await this.page.waitForTimeout(300);
    }

    // Click File menu to open it
    const fileMenu = this.page.getByRole('menuitem', { name: 'File' });
    await fileMenu.click();
    await this.page.waitForTimeout(200);

    // Click Export menu item
    await this.dialogTrigger.click();
    await this.dialog.waitFor({ state: 'visible' });
  }

  /**
   * Close export dialog
   */
  async close(): Promise<void> {
    await this.cancelButton.click();
    await this.dialog.waitFor({ state: 'hidden' });
  }

  /**
   * Select export format
   * @param format Export format ('PNG' | 'JPEG' | 'SVG' | 'PDF')
   */
  async selectFormat(format: 'PNG' | 'JPEG' | 'SVG' | 'PDF'): Promise<void> {
    const formatMap = {
      PNG: this.formatPNG,
      JPEG: this.formatJPEG,
      SVG: this.formatSVG,
      PDF: this.formatPDF,
    };
    await formatMap[format].click();
  }

  /**
   * Select DPI
   * @param dpi DPI value (150 | 300 | 600)
   */
  async selectDPI(dpi: 150 | 300 | 600): Promise<void> {
    const dpiMap = {
      150: this.dpi150,
      300: this.dpi300,
      600: this.dpi600,
    };
    // Wait for the DPI option to be visible and stable
    await dpiMap[dpi].waitFor({ state: 'visible', timeout: 5000 });
    await this.page.waitForTimeout(200); // Allow DOM to stabilize
    await dpiMap[dpi].click();
  }

  /**
   * Set JPEG quality
   * @param quality Quality value (0-100)
   */
  async setQuality(quality: number): Promise<void> {
    await this.qualitySlider.fill(quality.toString());
  }

  /**
   * Get current quality value
   * @returns Current quality value
   */
  async getQuality(): Promise<number> {
    const text = await this.qualityValue.textContent();
    return parseInt(text || '0', 10);
  }

  /**
   * Toggle CMYK mode (PDF export)
   */
  async toggleCMYKMode(): Promise<void> {
    await this.cmykModeToggle.click();
  }

  /**
   * Export with current settings
   * @returns Download promise
   */
  async export(): Promise<Download> {
    const downloadPromise = this.page.waitForEvent('download');
    await this.exportButton.click();
    return downloadPromise;
  }

  /**
   * Export and get file size
   * @returns File size in bytes
   */
  async exportAndGetFileSize(): Promise<number> {
    const download = await this.export();
    const path = await download.path();
    if (!path) return 0;

    const fs = require('fs');
    const stats = fs.statSync(path);
    return stats.size;
  }
}
