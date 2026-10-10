import { Page, Locator } from '@playwright/test';
import { AdminTestIds } from '@/lib/test-ids';

export class AdminPage {
  readonly page: Page;
  readonly notificationBell: Locator;
  readonly notificationCount: Locator;

  constructor(page: Page) {
    this.page = page;
    this.notificationBell = page.getByTestId(AdminTestIds.NOTIFICATION_BELL).first();
    this.notificationCount = page.getByTestId(AdminTestIds.NOTIFICATION_COUNT).first();
  }

  async goto(): Promise<void> {
    await this.page.goto('/admin');
  }

  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  async clickNotificationBell(): Promise<void> {
    await this.notificationBell.click();
  }

  async getNotificationCount(): Promise<number> {
    try {
      const text = await this.notificationCount.textContent();
      if (!text) return 0;
      // Handle "99+" case
      if (text.includes('+')) return 99;
      return parseInt(text, 10) || 0;
    } catch {
      return 0;
    }
  }

  async scrollToSection(sectionId: string): Promise<void> {
    await this.page.evaluate((id) => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }, sectionId);
  }
}
