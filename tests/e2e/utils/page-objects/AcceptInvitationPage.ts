import { Page } from '@playwright/test';
import { AcceptInvitationTestIds } from '@/lib/test-ids';

export class AcceptInvitationPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async gotoGroupInvite(token: string): Promise<void> {
    await this.page.goto(`/invite/group/${token}`);
    await this.page.waitForLoadState('networkidle');
  }

  async gotoProjectInvite(token: string): Promise<void> {
    await this.page.goto(`/invite/project/${token}`);
    await this.page.waitForLoadState('networkidle');
  }

  async gotoPageInvite(token: string): Promise<void> {
    await this.page.goto(`/invite/page/${token}`);
    await this.page.waitForLoadState('networkidle');
    // Wait for the component to finish its async initialization (auth check + edge function call)
    await this.page.waitForSelector(`[data-testid="${AcceptInvitationTestIds.PAGE_CONTAINER}"]`, { timeout: 15000 });
  }

  async accept(): Promise<void> {
    await this.page.getByTestId(AcceptInvitationTestIds.ACCEPT_BUTTON).click();
    // Wait for redirect after acceptance
    await this.page.waitForTimeout(2500);
  }

  async decline(): Promise<void> {
    await this.page.getByTestId(AcceptInvitationTestIds.DECLINE_BUTTON).click();
  }

  async signIn(): Promise<void> {
    await this.page.getByTestId(AcceptInvitationTestIds.SIGNIN_BUTTON).click();
  }

  isExpiredMessage() {
    return this.page.getByTestId(AcceptInvitationTestIds.EXPIRED_MESSAGE);
  }

  isAlreadyAcceptedMessage() {
    return this.page.getByTestId(AcceptInvitationTestIds.ALREADY_ACCEPTED_MESSAGE);
  }

  isErrorMessage() {
    return this.page.getByTestId(AcceptInvitationTestIds.ERROR_MESSAGE);
  }
}
