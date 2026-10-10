import { Page, Locator } from '@playwright/test';
import { IconLibraryTestIds } from '@/lib/test-ids';

/**
 * Page Object Model for Icon Library
 * Handles icon library panel interactions
 */
export class IconLibraryPage {
  readonly page: Page;

  readonly libraryPanel: Locator;
  readonly libraryToggle: Locator;
  readonly searchInput: Locator;
  readonly categoryFilter: Locator;
  readonly uploadButton: Locator;
  readonly uploadDialog: Locator;
  readonly uploadFileInput: Locator;
  readonly loadingIndicator: Locator;

  constructor(page: Page) {
    this.page = page;

    this.libraryPanel = page.getByTestId(IconLibraryTestIds.LIBRARY_PANEL);
    this.libraryToggle = page.getByTestId(IconLibraryTestIds.LIBRARY_TOGGLE);
    this.searchInput = page.getByTestId(IconLibraryTestIds.SEARCH_INPUT);
    this.categoryFilter = page.getByTestId(IconLibraryTestIds.CATEGORY_FILTER);
    this.uploadButton = page.getByTestId(IconLibraryTestIds.UPLOAD_BUTTON);
    this.uploadDialog = page.getByTestId(IconLibraryTestIds.UPLOAD_DIALOG);
    this.uploadFileInput = page.getByTestId(IconLibraryTestIds.UPLOAD_FILE_INPUT);
    this.loadingIndicator = page.getByTestId(IconLibraryTestIds.LOADING_INDICATOR);
  }

  /**
   * Open icon library
   */
  async open(): Promise<void> {
    // Check if library is already open by checking if search input is visible
    const isOpen = await this.searchInput.isVisible().catch(() => false);
    if (!isOpen) {
      await this.libraryToggle.click();
      await this.searchInput.waitFor({ state: 'visible', timeout: 5000 });
    }
  }

  /**
   * Close icon library
   */
  async close(): Promise<void> {
    // Check if library is already closed by checking if search input is hidden
    const isOpen = await this.searchInput.isVisible().catch(() => false);
    if (isOpen) {
      await this.libraryToggle.click();
      await this.searchInput.waitFor({ state: 'hidden', timeout: 5000 });
    }
  }

  /**
   * Expand first category to show icons
   */
  async expandFirstCategory(): Promise<void> {
    // Look for first AccordionTrigger button to expand category
    const firstAccordion = this.libraryPanel.locator('[data-state="closed"]').first();
    await firstAccordion.click();
    await this.page.waitForTimeout(500); // Wait for icons to load
  }

  /**
   * Search for icons
   * @param query Search query
   */
  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(300); // Debounce
  }

  /**
   * Get icon item by index
   * @param index Icon index
   */
  getIconItem(index: number): Locator {
    return this.page.getByTestId(`${IconLibraryTestIds.ICON_ITEM}-${index}`);
  }

  /**
   * Get all visible icons
   */
  getAllIcons(): Locator {
    return this.page.getByTestId(IconLibraryTestIds.ICON_ITEM);
  }

  /**
   * Upload custom asset
   * @param filePath Path to file to upload
   */
  async uploadAsset(filePath: string): Promise<void> {
    await this.uploadButton.click();
    await this.uploadDialog.waitFor({ state: 'visible' });
    await this.uploadFileInput.setInputFiles(filePath);
  }

  /**
   * Delete icon by index
   * @param index Icon index
   */
  async deleteIcon(index: number): Promise<void> {
    const deleteButton = this.page.getByTestId(`${IconLibraryTestIds.DELETE_ICON_BUTTON}-${index}`);
    await deleteButton.click();
  }

  /**
   * Wait for library to finish loading
   */
  async waitForLoadComplete(): Promise<void> {
    await this.loadingIndicator.waitFor({ state: 'hidden', timeout: 10000 });
  }

  /**
   * Check if library loaded within time limit
   * @param maxMs Maximum time in milliseconds
   * @returns True if loaded within time limit
   */
  async isLoadedWithinTime(maxMs: number): Promise<boolean> {
    const startTime = Date.now();
    try {
      await this.loadingIndicator.waitFor({ state: 'hidden', timeout: maxMs });
      const loadTime = Date.now() - startTime;
      return loadTime <= maxMs;
    } catch {
      return false;
    }
  }

  /**
   * Get pagination controls
   */
  getPaginationControls(): Locator {
    return this.page.getByTestId(IconLibraryTestIds.PAGINATION_CONTROLS);
  }

  /**
   * Get previous button
   */
  getPreviousButton(): Locator {
    return this.page.getByTestId(IconLibraryTestIds.PAGINATION_PREVIOUS);
  }

  /**
   * Get next button
   */
  getNextButton(): Locator {
    return this.page.getByTestId(IconLibraryTestIds.PAGINATION_NEXT);
  }

  /**
   * Get page indicator
   */
  getPageIndicator(): Locator {
    return this.page.getByTestId(IconLibraryTestIds.PAGINATION_INDICATOR);
  }

  /**
   * Go to next page
   */
  async goToNextPage(): Promise<void> {
    await this.getNextButton().click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Go to previous page
   */
  async goToPreviousPage(): Promise<void> {
    await this.getPreviousButton().click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Get current page number from indicator
   * @returns Current page number (1-indexed)
   */
  async getCurrentPageNumber(): Promise<number> {
    const text = await this.getPageIndicator().textContent();
    const match = text?.match(/(\d+)\s*\/\s*\d+/);
    return match ? parseInt(match[1]) : 1;
  }

  /**
   * Get total pages from indicator
   * @returns Total number of pages
   */
  async getTotalPages(): Promise<number> {
    const text = await this.getPageIndicator().textContent();
    const match = text?.match(/\d+\s*\/\s*(\d+)/);
    return match ? parseInt(match[1]) : 1;
  }
}
