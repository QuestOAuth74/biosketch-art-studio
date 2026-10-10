import { Page, Locator } from '@playwright/test';

export class BlogPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(): Promise<void> {
    await this.page.goto('/blog');
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

  async clickFirstPost(): Promise<void> {
    const firstPost = this.page.getByRole('link').first();
    try {
      await firstPost.click({ timeout: 3000 });
      await this.page.waitForLoadState('networkidle');
    } catch {
      // No posts available, continue
    }
  }

  async scrollPage(): Promise<void> {
    await this.page.evaluate(() => window.scrollBy(0, 600));
  }
}
