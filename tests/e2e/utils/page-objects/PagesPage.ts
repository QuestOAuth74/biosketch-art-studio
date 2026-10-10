import { Page, Locator } from '@playwright/test';
import { PagesTestIds } from '@/lib/test-ids';

export class PagesPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(): Promise<void> {
    await this.page.goto('/pages');
    await this.page.waitForLoadState('networkidle');
  }

  async clickNewPage(): Promise<void> {
    await this.page.getByTestId(PagesTestIds.NEW_PAGE_BUTTON).click();
  }

  getPageCard(name: string): Locator {
    return this.page.getByTestId(PagesTestIds.PAGE_CARD).filter({ hasText: name });
  }

  async openPage(name: string): Promise<void> {
    await this.getPageCard(name).click();
    await this.page.waitForLoadState('networkidle');
  }

  getEmptyState(): Locator {
    return this.page.getByTestId(PagesTestIds.EMPTY_STATE);
  }

  getMyPagesSection(): Locator {
    return this.page.getByTestId(PagesTestIds.MY_PAGES_SECTION);
  }

  getSharedPagesSection(): Locator {
    return this.page.getByTestId(PagesTestIds.SHARED_PAGES_SECTION);
  }
}
