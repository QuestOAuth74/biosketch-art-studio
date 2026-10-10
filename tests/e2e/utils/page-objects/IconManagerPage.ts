import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model for Icon Manager (Admin Panel)
 * Handles icon management operations in admin panel
 */
export class IconManagerPage {
  readonly page: Page;

  // Main elements
  readonly iconManagerCard: Locator;
  readonly categoryFilter: Locator;
  readonly selectAllCheckbox: Locator;
  readonly deleteSelectedButton: Locator;

  // Pagination
  readonly previousButton: Locator;
  readonly nextButton: Locator;
  readonly pageIndicator: Locator;

  constructor(page: Page) {
    this.page = page;

    // Icon Manager is in a Card component
    this.iconManagerCard = page.locator('text=Manage Icons').locator('..').locator('..');
    this.categoryFilter = page.getByRole('combobox', { name: /filter by category/i });
    this.selectAllCheckbox = page.locator('button[id="select-all"]').or(page.locator('[role="checkbox"]#select-all'));
    this.deleteSelectedButton = page.getByRole('button', { name: /delete selected/i });

    // Pagination controls
    this.previousButton = page.getByRole('button', { name: /previous/i });
    this.nextButton = page.getByRole('button', { name: /next/i });
    this.pageIndicator = page.locator('text=/Page \\d+ of \\d+/');
  }

  /**
   * Navigate to admin panel
   */
  async goto(): Promise<void> {
    await this.page.goto('/admin');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Wait for icon grid to load
   */
  async waitForIconsToLoad(): Promise<void> {
    // Wait for icon cards to appear
    await this.page.waitForSelector('[class*="grid"] [class*="border"][class*="rounded-lg"]', {
      state: 'visible',
      timeout: 10000
    });
  }

  /**
   * Get all icon cards
   */
  getAllIconCards(): Locator {
    return this.iconManagerCard.locator('[class*="grid"] > div[class*="border"]');
  }

  /**
   * Get icon card by index
   * @param index Icon index (0-based)
   */
  getIconCard(index: number): Locator {
    return this.getAllIconCards().nth(index);
  }

  /**
   * Get count of visible icons
   */
  async getIconCount(): Promise<number> {
    return await this.getAllIconCards().count();
  }

  /**
   * Click regenerate thumbnail button for an icon
   * @param index Icon index
   */
  async regenerateThumbnail(index: number): Promise<void> {
    const iconCard = this.getIconCard(index);
    const regenerateButton = iconCard.locator('button').filter({ has: this.page.locator('svg') }).first();
    await regenerateButton.click();
  }

  /**
   * Delete an icon by index
   * @param index Icon index
   */
  async deleteIcon(index: number): Promise<void> {
    const iconCard = this.getIconCard(index);
    const deleteButton = iconCard.getByRole('button', { name: /delete/i }).or(
      iconCard.locator('button').filter({ hasText: '' }).last()
    );
    await deleteButton.click();
  }

  /**
   * Select an icon by clicking its checkbox
   * @param index Icon index
   */
  async selectIcon(index: number): Promise<void> {
    const iconCard = this.getIconCard(index);
    const checkbox = iconCard.locator('input[type="checkbox"]').or(
      iconCard.locator('[role="checkbox"]')
    );
    await checkbox.click();
  }

  /**
   * Click "Select All" checkbox
   */
  async selectAll(): Promise<void> {
    await this.selectAllCheckbox.click();
  }

  /**
   * Delete selected icons
   */
  async deleteSelected(): Promise<void> {
    // Set up dialog handler before clicking
    this.page.on('dialog', dialog => dialog.accept());
    await this.deleteSelectedButton.click();
  }

  /**
   * Filter icons by category
   * @param categoryName Category name
   */
  async filterByCategory(categoryName: string): Promise<void> {
    await this.categoryFilter.click();
    await this.page.getByRole('option', { name: new RegExp(categoryName, 'i') }).click();
    await this.waitForIconsToLoad();
  }

  /**
   * Go to next page
   */
  async nextPage(): Promise<void> {
    await this.nextButton.click();
    await this.waitForIconsToLoad();
  }

  /**
   * Go to previous page
   */
  async previousPage(): Promise<void> {
    await this.previousButton.click();
    await this.waitForIconsToLoad();
  }

  /**
   * Get current page number
   */
  async getCurrentPage(): Promise<number> {
    const text = await this.pageIndicator.textContent();
    const match = text?.match(/Page (\d+) of \d+/);
    return match ? parseInt(match[1]) : 1;
  }

  /**
   * Get total pages
   */
  async getTotalPages(): Promise<number> {
    const text = await this.pageIndicator.textContent();
    const match = text?.match(/Page \d+ of (\d+)/);
    return match ? parseInt(match[1]) : 1;
  }

  /**
   * Wait for icons to finish loading after an action
   */
  async waitForUpdate(): Promise<void> {
    await this.page.waitForTimeout(1000);
    await this.waitForIconsToLoad();
  }

  /**
   * Get icon name by index
   * @param index Icon index
   */
  async getIconName(index: number): Promise<string> {
    const iconCard = this.getIconCard(index);
    const nameElement = iconCard.locator('p[class*="font-medium"]').first();
    return await nameElement.textContent() || '';
  }

  /**
   * Check if an icon has a broken thumbnail indicator
   * @param index Icon index
   */
  async hasErrorIndicator(index: number): Promise<boolean> {
    const iconCard = this.getIconCard(index);
    const errorIndicator = iconCard.locator('text=/Large|Error/i');
    return await errorIndicator.isVisible().catch(() => false);
  }
}
