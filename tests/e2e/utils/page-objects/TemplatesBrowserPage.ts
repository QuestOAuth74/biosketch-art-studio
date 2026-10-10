import { Page, Locator } from '@playwright/test';
import { TemplatesBrowserTestIds } from '@/lib/test-ids';

/**
 * Page Object Model for Templates Browser sidebar panel
 * Handles template browsing, tab switching, search, and import actions
 */
export class TemplatesBrowserPage {
  readonly page: Page;

  // Panel
  readonly panel: Locator;
  readonly sidebarTab: Locator;

  // Sub-tabs
  readonly communityTab: Locator;
  readonly brushesTab: Locator;
  readonly myProjectsTab: Locator;

  // Search & Sort
  readonly searchInput: Locator;
  readonly sortSelect: Locator;

  // Content
  readonly projectCards: Locator;
  readonly loadingSkeleton: Locator;
  readonly emptyState: Locator;

  // Import actions (inside popover)
  readonly replaceButton: Locator;
  readonly addToCanvasButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.panel = page.getByTestId(TemplatesBrowserTestIds.PANEL);
    this.sidebarTab = page.getByTestId(TemplatesBrowserTestIds.PANEL + '-tab');

    this.communityTab = page.getByTestId(TemplatesBrowserTestIds.COMMUNITY_TAB);
    this.brushesTab = page.getByTestId(TemplatesBrowserTestIds.BRUSHES_TAB);
    this.myProjectsTab = page.getByTestId(TemplatesBrowserTestIds.MY_PROJECTS_TAB);

    this.searchInput = page.getByTestId(TemplatesBrowserTestIds.SEARCH_INPUT);
    this.sortSelect = page.getByTestId(TemplatesBrowserTestIds.SORT_SELECT);

    this.projectCards = page.getByTestId(TemplatesBrowserTestIds.PROJECT_CARD);
    this.loadingSkeleton = page.getByTestId(TemplatesBrowserTestIds.LOADING_SKELETON);
    this.emptyState = page.getByTestId(TemplatesBrowserTestIds.EMPTY_STATE);

    this.replaceButton = page.getByTestId(TemplatesBrowserTestIds.REPLACE_BUTTON);
    this.addToCanvasButton = page.getByTestId(TemplatesBrowserTestIds.ADD_TO_CANVAS_BUTTON);
  }

  /**
   * Open the Templates tab in the left sidebar
   */
  async open(): Promise<void> {
    await this.sidebarTab.click();
    await this.panel.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Switch to Community sub-tab
   */
  async switchToCommunity(): Promise<void> {
    await this.communityTab.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Switch to Brushes sub-tab
   */
  async switchToBrushes(): Promise<void> {
    await this.brushesTab.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Switch to My Projects sub-tab
   */
  async switchToMyProjects(): Promise<void> {
    await this.myProjectsTab.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Search for templates
   */
  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(300);
  }

  /**
   * Clear the search input
   */
  async clearSearch(): Promise<void> {
    await this.searchInput.fill('');
    await this.page.waitForTimeout(300);
  }

  /**
   * Get the number of visible project cards
   */
  async getProjectCardCount(): Promise<number> {
    return await this.projectCards.count();
  }

  /**
   * Click a project card to open import popover
   */
  async clickProjectCard(index: number): Promise<void> {
    await this.projectCards.nth(index).click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Check if the sort dropdown is visible
   */
  async isSortVisible(): Promise<boolean> {
    return await this.sortSelect.isVisible().catch(() => false);
  }

  /**
   * Check if loading skeleton is visible
   */
  async isLoading(): Promise<boolean> {
    return await this.loadingSkeleton.isVisible().catch(() => false);
  }

  /**
   * Check if empty state is shown
   */
  async isEmpty(): Promise<boolean> {
    return await this.emptyState.isVisible().catch(() => false);
  }

  /**
   * Wait for templates to load (skeleton disappears, cards or empty state appear)
   */
  async waitForLoad(): Promise<void> {
    // Wait for skeleton to disappear
    await this.loadingSkeleton.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    await this.page.waitForTimeout(500);
  }

  /**
   * Get project card names
   */
  async getProjectCardNames(): Promise<string[]> {
    const count = await this.projectCards.count();
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await this.projectCards.nth(i).locator('p').first().textContent();
      if (text) names.push(text.trim());
    }
    return names;
  }
}
