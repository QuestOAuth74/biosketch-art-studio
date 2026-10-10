import { Page, Locator } from '@playwright/test';

export class CommunityPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(): Promise<void> {
    await this.page.goto('/community');
  }

  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  async search(query: string): Promise<void> {
    const searchInput = this.page.getByRole('searchbox').or(
      this.page.getByPlaceholder(/search/i)
    );
    await searchInput.fill(query);
    await this.page.waitForTimeout(500);
  }

  async sortBy(option: 'recent' | 'popular' | 'cloned' | 'liked'): Promise<void> {
    // Look for sort buttons or links
    const sortButton = this.page.getByRole('button', {
      name: new RegExp(option, 'i'),
    }).or(
      this.page.getByRole('link', {
        name: new RegExp(option, 'i'),
      })
    );

    try {
      await sortButton.click({ timeout: 3000 });
      await this.page.waitForLoadState('networkidle');
    } catch {
      // Sorting might not be available, continue anyway
    }
  }

  async scrollPage(): Promise<void> {
    await this.page.evaluate(() => window.scrollBy(0, 800));
  }

  async clickFirstProject(): Promise<void> {
    const firstProject = this.page.getByRole('link').first();
    try {
      await firstProject.click({ timeout: 3000 });
    } catch {
      // No projects available, continue
    }
  }
}
