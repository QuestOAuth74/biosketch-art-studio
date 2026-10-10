import { Page } from '@playwright/test';
import { GroupsTestIds } from '@/lib/test-ids';

export class GroupsPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(): Promise<void> {
    await this.page.goto('/groups');
    await this.page.waitForLoadState('networkidle');
  }

  async clickNewGroup(): Promise<void> {
    await this.page.getByTestId(GroupsTestIds.NEW_GROUP_BUTTON).click();
  }

  getGroupCard(groupId: string) {
    return this.page.getByTestId(GroupsTestIds.GROUP_CARD).filter({ hasText: groupId });
  }

  async openGroup(groupId: string): Promise<void> {
    await this.page.goto(`/groups/${groupId}`);
    await this.page.waitForLoadState('networkidle');
  }

  async waitForPageLoad(): Promise<void> {
    await this.page.waitForSelector(`[data-testid="${GroupsTestIds.PAGE_CONTAINER}"]`);
  }
}
