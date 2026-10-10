import { Page, Locator } from '@playwright/test';
import { ShareDialogTestIds } from '@/lib/test-ids';

/**
 * Page Object Model for Share Dialog
 * Handles project sharing functionality
 */
export class ShareDialogPage {
  readonly page: Page;

  readonly dialog: Locator;
  readonly dialogTrigger: Locator;
  readonly shareUrl: Locator;
  readonly copyLinkButton: Locator;
  readonly publicToggle: Locator;

  constructor(page: Page) {
    this.page = page;

    this.dialog = page.getByTestId(ShareDialogTestIds.DIALOG);
    this.dialogTrigger = page.getByTestId(ShareDialogTestIds.DIALOG_TRIGGER);
    this.shareUrl = page.getByTestId(ShareDialogTestIds.SHARE_URL);
    this.copyLinkButton = page.getByTestId(ShareDialogTestIds.COPY_LINK_BUTTON);
    this.publicToggle = page.getByTestId(ShareDialogTestIds.PUBLIC_TOGGLE);
  }

  /**
   * Open share dialog
   */
  async open(): Promise<void> {
    await this.dialogTrigger.click();
    await this.dialog.waitFor({ state: 'visible' });
  }

  /**
   * Get share URL
   * @returns Share URL text
   */
  async getShareUrl(): Promise<string | null> {
    return await this.shareUrl.textContent();
  }

  /**
   * Copy share link to clipboard
   */
  async copyLink(): Promise<void> {
    await this.copyLinkButton.click();
  }

  /**
   * Toggle public visibility
   */
  async togglePublic(): Promise<void> {
    await this.publicToggle.click();
  }

  /**
   * Get clipboard content (share URL)
   * @returns Clipboard URL
   */
  async getClipboardUrl(): Promise<string> {
    return await this.page.evaluate(() => navigator.clipboard.readText());
  }
}
