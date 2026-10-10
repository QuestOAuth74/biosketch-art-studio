import { Page, Download } from '@playwright/test';

/**
 * Page Object Model for Icon Tag Management (Admin)
 * Handles CSV export/import of icon tags
 */
export class TagManagerPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Navigate to admin page
   */
  async goto(): Promise<void> {
    await this.page.goto('/admin');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Export tags as CSV file
   * @returns Download promise for the CSV file
   */
  async exportCSV(): Promise<Download> {
    const downloadPromise = this.page.waitForEvent('download');
    const exportButton = this.page.getByRole('button', { name: /export.*csv/i });
    await exportButton.click();
    return await downloadPromise;
  }

  /**
   * Import tags from CSV file
   * @param filePath Absolute path to the CSV file
   */
  async importCSV(filePath: string): Promise<void> {
    const fileInput = this.page.locator('input[type="file"][accept*="csv"]');
    await fileInput.setInputFiles(filePath);
  }

  /**
   * Navigate through column mapping dialog (click Next)
   */
  async navigateColumnMapping(): Promise<void> {
    const nextButton = this.page.getByRole('button', { name: /next/i });
    await nextButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Confirm import in preview dialog
   */
  async confirmImport(): Promise<void> {
    const confirmButton = this.page.getByRole('button', { name: /confirm.*import/i });
    await confirmButton.click();
    await this.page.waitForTimeout(1500); // Wait for import to complete
  }

  /**
   * Cancel import
   */
  async cancelImport(): Promise<void> {
    const cancelButton = this.page.getByRole('button', { name: /cancel/i });
    await cancelButton.click();
  }

  /**
   * Get success toast message
   * @returns Toast message text or null if not found
   */
  async getSuccessMessage(): Promise<string | null> {
    const toast = this.page.locator('[data-sonner-toast]').filter({ hasText: /success/i });
    return await toast.textContent().catch(() => null);
  }

  /**
   * Get error message
   * @returns Error message text or null if not found
   */
  async getErrorMessage(): Promise<string | null> {
    const errorMsg = this.page.locator('[role="alert"]').or(
      this.page.locator('.text-destructive')
    );
    return await errorMsg.textContent().catch(() => null);
  }
}
