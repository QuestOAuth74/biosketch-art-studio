import { Page, Locator } from '@playwright/test';
import { PageDetailTestIds } from '@/lib/test-ids';

export class PageDetailPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(pageId: string): Promise<void> {
    await this.page.goto(`/pages/${pageId}`);
    await this.page.waitForLoadState('networkidle');
  }

  getPageName(): Locator {
    return this.page.getByTestId(PageDetailTestIds.PAGE_NAME);
  }

  async clickAddProjects(): Promise<void> {
    await this.page.getByTestId(PageDetailTestIds.ADD_PROJECTS_BUTTON).click();
  }

  async clickShare(): Promise<void> {
    await this.page.getByTestId(PageDetailTestIds.SHARE_BUTTON).click();
    await this.page.waitForTimeout(300);
  }

  getProjectCard(name: string): Locator {
    return this.page.getByTestId(PageDetailTestIds.PROJECT_CARD).filter({ hasText: name });
  }

  getShareDialog(): Locator {
    return this.page.getByTestId(PageDetailTestIds.SHARE_DIALOG);
  }

  getGroupAccessRow(groupName: string): Locator {
    return this.page.getByTestId(PageDetailTestIds.GROUP_ACCESS_ROW).filter({ hasText: groupName });
  }

  getInviteRow(email: string): Locator {
    return this.page.getByTestId(PageDetailTestIds.INVITE_ROW).filter({ hasText: email });
  }
}
