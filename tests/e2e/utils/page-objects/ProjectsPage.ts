import { Page, Locator } from '@playwright/test';

export class ProjectsPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(): Promise<void> {
    await this.page.goto('/projects');
  }

  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  async search(query: string): Promise<void> {
    // Use role selector to find search input
    const searchInput = this.page.getByRole('searchbox').or(
      this.page.getByPlaceholder(/search/i)
    );
    await searchInput.fill(query);
    await this.page.waitForTimeout(500);
  }

  async createNewProject(): Promise<void> {
    // Look for "New Project" or similar button
    const newProjectButton = this.page.getByRole('button', {
      name: /new project|create/i,
    });
    await newProjectButton.click();
  }

  async scrollPage(): Promise<void> {
    await this.page.evaluate(() => window.scrollBy(0, 500));
  }
}
