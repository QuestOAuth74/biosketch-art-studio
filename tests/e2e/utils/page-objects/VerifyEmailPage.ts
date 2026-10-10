import { Page, Locator } from '@playwright/test';
import { VerifyEmailTestIds } from '@/lib/test-ids';

/**
 * Page Object Model for the Verify Email page (/auth/verify-email)
 * Handles email verification flow and resend functionality
 */
export class VerifyEmailPage {
  readonly page: Page;

  // Locators using test IDs
  readonly heading: Locator;
  readonly emailDisplay: Locator;
  readonly verificationMessage: Locator;
  readonly resendButton: Locator;
  readonly backToSignInButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Use test IDs instead of fragile selectors
    this.heading = page.getByTestId(VerifyEmailTestIds.HEADING);
    this.emailDisplay = page.getByTestId(VerifyEmailTestIds.EMAIL_DISPLAY);
    this.verificationMessage = page.getByTestId(VerifyEmailTestIds.VERIFICATION_MESSAGE);
    this.resendButton = page.getByTestId(VerifyEmailTestIds.RESEND_BUTTON);
    this.backToSignInButton = page.getByTestId(VerifyEmailTestIds.BACK_TO_SIGNIN_BUTTON);
  }

  async goto() {
    await this.page.goto('/auth/verify-email');
  }

  async hasHeading(): Promise<boolean> {
    return await this.heading.isVisible();
  }

  async getDisplayedEmail(): Promise<string | null> {
    return await this.emailDisplay.textContent();
  }

  async clickBackToSignIn() {
    await this.backToSignInButton.click();
  }

  async clickResend() {
    await this.resendButton.click();
  }

  async hasVerificationMessage(): Promise<boolean> {
    return await this.verificationMessage.isVisible();
  }

  async hasResentQueryMessage(): Promise<boolean> {
    const url = this.page.url();
    return url.includes('resent=true');
  }
}
