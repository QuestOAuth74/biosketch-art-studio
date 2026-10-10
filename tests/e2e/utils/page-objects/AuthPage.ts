import { Page, Locator } from '@playwright/test';
import { AuthTestIds } from '@/lib/test-ids';

/**
 * Page Object Model for the Auth page (/auth)
 * Handles signup, login, password reset, and password update interactions
 */
export class AuthPage {
  readonly page: Page;

  // Sign-in form locators
  readonly signInTabTrigger: Locator;
  readonly signInEmailInput: Locator;
  readonly signInPasswordInput: Locator;
  readonly signInSubmitButton: Locator;
  readonly forgotPasswordLink: Locator;

  // Sign-up form locators
  readonly signUpTabTrigger: Locator;
  readonly signUpNameInput: Locator;
  readonly signUpEmailInput: Locator;
  readonly signUpPasswordInput: Locator;
  readonly signUpCountrySelect: Locator;
  readonly signUpFieldSelect: Locator;
  readonly signUpSubmitButton: Locator;

  // Password reset locators
  readonly resetEmailInput: Locator;
  readonly resetSendButton: Locator;
  readonly resetBackButton: Locator;

  // Password update locators
  readonly updatePasswordInput: Locator;
  readonly updateConfirmInput: Locator;
  readonly updateSubmitButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Sign-in form - using test IDs
    this.signInTabTrigger = page.getByTestId(AuthTestIds.TAB_SIGNIN);
    this.signInEmailInput = page.getByTestId(AuthTestIds.SIGNIN_EMAIL_INPUT);
    this.signInPasswordInput = page.getByTestId(AuthTestIds.SIGNIN_PASSWORD_INPUT);
    this.signInSubmitButton = page.getByTestId(AuthTestIds.SIGNIN_SUBMIT_BUTTON);
    this.forgotPasswordLink = page.getByTestId(AuthTestIds.FORGOT_PASSWORD_LINK);

    // Sign-up form - using test IDs
    this.signUpTabTrigger = page.getByTestId(AuthTestIds.TAB_SIGNUP);
    this.signUpNameInput = page.getByTestId(AuthTestIds.SIGNUP_NAME_INPUT);
    this.signUpEmailInput = page.getByTestId(AuthTestIds.SIGNUP_EMAIL_INPUT);
    this.signUpPasswordInput = page.getByTestId(AuthTestIds.SIGNUP_PASSWORD_INPUT);
    this.signUpCountrySelect = page.getByTestId(AuthTestIds.SIGNUP_COUNTRY_SELECT);
    this.signUpFieldSelect = page.getByTestId(AuthTestIds.SIGNUP_FIELD_SELECT);
    this.signUpSubmitButton = page.getByTestId(AuthTestIds.SIGNUP_SUBMIT_BUTTON);

    // Password reset - using test IDs
    this.resetEmailInput = page.getByTestId(AuthTestIds.RESET_EMAIL_INPUT);
    this.resetSendButton = page.getByTestId(AuthTestIds.RESET_SEND_BUTTON);
    this.resetBackButton = page.getByTestId(AuthTestIds.RESET_BACK_BUTTON);

    // Password update - using test IDs
    this.updatePasswordInput = page.getByTestId(AuthTestIds.UPDATE_PASSWORD_INPUT);
    this.updateConfirmInput = page.getByTestId(AuthTestIds.UPDATE_CONFIRM_INPUT);
    this.updateSubmitButton = page.getByTestId(AuthTestIds.UPDATE_SUBMIT_BUTTON);
  }

  /**
   * Navigate to the auth page
   */
  async goto() {
    await this.page.goto('/auth');
  }

  /**
   * Switch to sign in tab
   */
  async switchToSignIn() {
    await this.signInTabTrigger.click();
  }

  /**
   * Switch to sign up tab
   */
  async switchToSignUp() {
    await this.signUpTabTrigger.click();
  }

  /**
   * Sign in with email and password
   * Automatically switches to sign in tab before filling form
   */
  async signIn(email: string, password: string) {
    await this.switchToSignIn();
    await this.signInEmailInput.fill(email);
    await this.signInPasswordInput.fill(password);
    await this.signInSubmitButton.click();
  }

  /**
   * Sign up with full user details
   * Automatically switches to sign up tab before filling form
   * @param email User email address
   * @param password User password
   * @param country Country selection (required)
   * @param field Field of study (required)
   * @param name Optional full name (defaults to 'Test User')
   */
  async signUp(
    email: string,
    password: string,
    country: string,
    field: string,
    name: string = 'Test User'
  ) {
    // Switch to sign up tab first
    await this.switchToSignUp();

    // Fill name
    await this.signUpNameInput.fill(name);

    // Fill email and password
    await this.signUpEmailInput.fill(email);
    await this.signUpPasswordInput.fill(password);

    // Select country (required)
    await this.signUpCountrySelect.click();
    await this.page.getByRole('option', { name: country, exact: true }).click();

    // Select field of study (required)
    await this.signUpFieldSelect.click();
    await this.page.getByRole('option', { name: field, exact: true }).click();

    await this.signUpSubmitButton.click();
  }

  /**
   * Click forgot password link
   */
  async clickForgotPassword() {
    await this.forgotPasswordLink.click();
  }

  /**
   * Submit password reset request
   */
  async submitPasswordReset(email: string) {
    await this.resetEmailInput.fill(email);
    await this.resetSendButton.click();
  }

  /**
   * Click back to sign in from reset form
   */
  async clickBackToSignIn() {
    await this.resetBackButton.click();
  }

  /**
   * Update password in password reset flow
   */
  async updatePassword(password: string, confirmPassword: string) {
    await this.updatePasswordInput.fill(password);
    await this.updateConfirmInput.fill(confirmPassword);
    await this.updateSubmitButton.click();
  }

  /**
   * Check if any error message is displayed
   */
  async hasErrorMessage(): Promise<boolean> {
    // Check for any visible error elements using test IDs
    const errorTestIds = [
      AuthTestIds.SIGNIN_ERROR_EMAIL,
      AuthTestIds.SIGNIN_ERROR_PASSWORD,
      AuthTestIds.SIGNUP_ERROR_EMAIL,
      AuthTestIds.SIGNUP_ERROR_PASSWORD,
      AuthTestIds.SIGNUP_ERROR_NAME,
      AuthTestIds.SIGNUP_ERROR_COUNTRY,
      AuthTestIds.SIGNUP_ERROR_FIELD,
      AuthTestIds.RESET_ERROR_EMAIL,
      AuthTestIds.UPDATE_ERROR_PASSWORD,
      AuthTestIds.UPDATE_ERROR_CONFIRM,
      AuthTestIds.ERROR_MESSAGE,
    ];

    for (const testId of errorTestIds) {
      const isVisible = await this.page.getByTestId(testId).isVisible().catch(() => false);
      if (isVisible) return true;
    }

    return false;
  }

  /**
   * Get error message text (returns first visible error)
   */
  async getErrorMessage(): Promise<string | null> {
    const errorTestIds = [
      AuthTestIds.SIGNIN_ERROR_EMAIL,
      AuthTestIds.SIGNIN_ERROR_PASSWORD,
      AuthTestIds.SIGNUP_ERROR_EMAIL,
      AuthTestIds.SIGNUP_ERROR_PASSWORD,
      AuthTestIds.ERROR_MESSAGE,
    ];

    for (const testId of errorTestIds) {
      const text = await this.page.getByTestId(testId).textContent().catch(() => null);
      if (text) return text;
    }

    return null;
  }

  /**
   * Check if a toast with the given test ID is visible
   * @param testId - The test ID of the toast to check for
   */
  async hasToast(testId: string): Promise<boolean> {
    const toast = this.page.getByTestId(testId);
    return await toast.isVisible().catch(() => false);
  }

  /**
   * Wait for a toast with the given test ID to appear
   * @param testId - The test ID of the toast to wait for
   * @param timeout - Maximum time to wait in milliseconds (default: 5000)
   */
  async waitForToast(testId: string, timeout = 5000): Promise<boolean> {
    try {
      await this.page.getByTestId(testId).waitFor({ state: 'visible', timeout });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the text content of a toast
   * @param testId - The test ID of the toast
   */
  async getToastMessage(testId: string): Promise<string | null> {
    return await this.page.getByTestId(testId).textContent().catch(() => null);
  }
}
