import { Page, Locator } from '@playwright/test';
import { GroupDetailTestIds, CreateGroupDialogTestIds, InviteGroupMemberDialogTestIds } from '@/lib/test-ids';

export class GroupDetailPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(groupId: string): Promise<void> {
    await this.page.goto(`/groups/${groupId}`);
    await this.page.waitForLoadState('networkidle');
  }

  async waitForPageLoad(): Promise<void> {
    await this.page.waitForSelector(`[data-testid="${GroupDetailTestIds.PAGE_CONTAINER}"]`);
  }

  async clickInviteMember(): Promise<void> {
    await this.page.getByTestId(GroupDetailTestIds.INVITE_BUTTON).click();
  }

  async inviteMember(email: string, role: 'member' | 'admin' = 'member'): Promise<void> {
    await this.clickInviteMember();
    await this.page.getByTestId(InviteGroupMemberDialogTestIds.EMAIL_INPUT).fill(email);
    await this.page.getByTestId(InviteGroupMemberDialogTestIds.SUBMIT_BUTTON).click();
    await this.page.waitForLoadState('networkidle');
  }

  getMemberRow(name: string): Locator {
    return this.page.getByTestId(GroupDetailTestIds.MEMBER_ROW).filter({ hasText: name });
  }

  getPendingInviteRow(email: string): Locator {
    return this.page.getByTestId(GroupDetailTestIds.PENDING_INVITE_ROW).filter({ hasText: email });
  }

  async removeMember(memberRow: Locator): Promise<void> {
    await memberRow.getByTestId(GroupDetailTestIds.REMOVE_MEMBER_BUTTON).click();
    // Confirm the removal dialog
    const confirmBtn = this.page.getByRole('button', { name: 'Confirm' });
    await confirmBtn.waitFor({ state: 'visible', timeout: 3000 });
    await confirmBtn.click();
    await this.page.waitForLoadState('networkidle');
  }

  async copyInviteLink(inviteRow: Locator): Promise<void> {
    await inviteRow.getByTestId(GroupDetailTestIds.COPY_INVITE_LINK_BUTTON).click();
  }

  async resendInvite(inviteRow: Locator): Promise<void> {
    await inviteRow.getByTestId(GroupDetailTestIds.RESEND_INVITE_BUTTON).click();
    await this.page.waitForTimeout(1000);
  }
}
