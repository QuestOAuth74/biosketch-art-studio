import { Page, Locator } from '@playwright/test';
import { CollaborateDialogTestIds } from '@/lib/test-ids';

export class CollaborateDialogPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async waitForOpen(): Promise<void> {
    await this.page.waitForSelector(`[data-testid="${CollaborateDialogTestIds.DIALOG}"]`);
  }

  async inviteByEmail(email: string, permission: 'view' | 'edit' = 'view'): Promise<void> {
    await this.page.getByTestId(CollaborateDialogTestIds.EMAIL_INPUT).fill(email);
    await this.page.getByTestId(CollaborateDialogTestIds.PERMISSION_SELECT).click();
    await this.page.getByRole('option', { name: permission === 'edit' ? 'Edit' : 'View' }).click();
    await this.page.getByTestId(CollaborateDialogTestIds.INVITE_BUTTON).click();
    await this.page.waitForTimeout(1500);
  }

  getCollaboratorRow(nameOrEmail: string): Locator {
    return this.page.getByTestId(CollaborateDialogTestIds.COLLABORATOR_ROW).filter({ hasText: nameOrEmail });
  }

  async removeCollaborator(row: Locator): Promise<void> {
    await row.getByTestId(CollaborateDialogTestIds.REMOVE_COLLABORATOR_BUTTON).click();
    await this.page.waitForTimeout(500);
  }

  async copyInviteLink(row: Locator): Promise<void> {
    await row.getByTestId(CollaborateDialogTestIds.COPY_INVITE_LINK_BUTTON).click();
  }

  async resendInvite(row: Locator): Promise<void> {
    await row.getByTestId(CollaborateDialogTestIds.RESEND_INVITE_BUTTON).click();
    await this.page.waitForTimeout(1000);
  }
}
