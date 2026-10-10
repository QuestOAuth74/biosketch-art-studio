import { Page, Locator } from '@playwright/test';

export class ContactPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(): Promise<void> {
    await this.page.goto('/contact');
  }

  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  async fillEmail(email: string): Promise<void> {
    const emailInput = this.page.getByLabel(/email/i).or(
      this.page.getByPlaceholder(/email/i)
    );
    await emailInput.fill(email);
  }

  async fillName(name: string): Promise<void> {
    const nameInput = this.page.getByLabel(/name/i).or(
      this.page.getByPlaceholder(/name/i)
    );
    await nameInput.fill(name);
  }

  async fillCountry(country: string): Promise<void> {
    const countryInput = this.page.getByLabel(/country/i).or(
      this.page.getByPlaceholder(/country/i)
    );
    await countryInput.fill(country);
  }

  async fillMessage(message: string): Promise<void> {
    const messageInput = this.page.getByLabel(/message/i).or(
      this.page.getByPlaceholder(/message/i)
    );
    await messageInput.fill(message);
  }

  async submit(): Promise<void> {
    const submitButton = this.page.getByRole('button', {
      name: /submit|send/i,
    });
    await submitButton.click();
  }

  async submitContactForm(
    email: string,
    name: string,
    country: string,
    message: string
  ): Promise<void> {
    await this.fillEmail(email);
    await this.fillName(name);
    await this.fillCountry(country);
    await this.fillMessage(message);
    await this.submit();
  }
}
