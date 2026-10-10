import { describe, it, expect, beforeEach } from 'vitest';
import { MockResend } from '../../utils/mock-resend';
import {
  createSignupPayload,
  createRecoveryPayload,
  createInvitePayload,
  createMagicLinkPayload,
  createEmailChangePayload,
  createInvalidPayload,
  createMissingEmailPayload,
  createMissingEmailDataPayload,
  type AuthEmailRequest,
} from './fixtures';
import {
  extractConfirmationUrl,
  parseConfirmationUrl,
  validateEmailHtml,
  hasValidEmailStructure,
  hasClickableLink,
  hasProperBranding,
  isValidConfirmationUrl,
} from './helpers';

/**
 * Test-friendly version of send-email edge function logic
 * Mirrors the actual edge function but uses dependency injection for Resend
 */
class SendEmailHandler {
  private resend: MockResend;
  private supabaseUrl: string;
  private fromEmail: string;
  private logoUrl: string;

  constructor(resend: MockResend) {
    this.resend = resend;
    this.supabaseUrl = 'https://tljsbmpglwmzyaoxsqyj.supabase.co';
    this.fromEmail = 'noreply@biosketch.art';
    this.logoUrl = `${this.supabaseUrl}/storage/v1/object/public/assets/logo-black.png`;
  }

  private getConfirmationEmailHtml(confirmationUrl: string, email: string): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, sans-serif; margin: 0; padding: 40px 0;">
  <div style="background-color: #ffffff; margin: 0 auto; padding: 40px 20px; max-width: 560px; border-radius: 8px;">
    <div style="text-align: center; margin-bottom: 32px;">
      <img src="${this.logoUrl}" width="150" height="40" alt="BioSketch" style="margin: 0 auto;">
    </div>
    <h1 style="color: #1a1a1a; font-size: 24px; font-weight: 600; text-align: center; margin: 0 0 24px;">Welcome to BioSketch!</h1>
    <p style="color: #525252; font-size: 16px; line-height: 24px; margin: 0 0 24px;">
      Thanks for signing up! Please confirm your email address to get started.
    </p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${confirmationUrl}" style="background-color: #16a34a; border-radius: 6px; color: #fff; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center; padding: 12px 24px; display: inline-block;">
        Confirm Email Address
      </a>
    </div>
    <p style="color: #525252; font-size: 16px; line-height: 24px; margin: 0 0 24px;">
      If you didn't create an account with BioSketch, you can safely ignore this email.
    </p>
    <div style="border-top: 1px solid #e5e5e5; margin-top: 32px; padding-top: 24px;">
      <p style="color: #8c8c8c; font-size: 12px; line-height: 20px; margin: 0;">
        This email was sent to ${email}. If you have questions, contact us at <a href="mailto:support@biosketch.art" style="color: #16a34a; text-decoration: underline;">support@biosketch.art</a>
      </p>
    </div>
  </div>
</body>
</html>`;
  }

  private getRecoveryEmailHtml(confirmationUrl: string, email: string): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, sans-serif; margin: 0; padding: 40px 0;">
  <div style="background-color: #ffffff; margin: 0 auto; padding: 40px 20px; max-width: 560px; border-radius: 8px;">
    <div style="text-align: center; margin-bottom: 32px;">
      <img src="${this.logoUrl}" width="150" height="40" alt="BioSketch" style="margin: 0 auto;">
    </div>
    <h1 style="color: #1a1a1a; font-size: 24px; font-weight: 600; text-align: center; margin: 0 0 24px;">Reset Your Password</h1>
    <p style="color: #525252; font-size: 16px; line-height: 24px; margin: 0 0 24px;">
      We received a request to reset your password for your BioSketch account. Click the button below to choose a new password.
    </p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${confirmationUrl}" style="background-color: #16a34a; border-radius: 6px; color: #fff; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center; padding: 12px 24px; display: inline-block;">
        Reset Password
      </a>
    </div>
    <p style="color: #525252; font-size: 16px; line-height: 24px; margin: 0 0 24px;">
      This link will expire in 24 hours. If you didn't request a password reset, you can safely ignore this email.
    </p>
    <div style="border-top: 1px solid #e5e5e5; margin-top: 32px; padding-top: 24px;">
      <p style="color: #8c8c8c; font-size: 12px; line-height: 20px; margin: 0;">
        This email was sent to ${email}. If you have questions, contact us at <a href="mailto:support@biosketch.art" style="color: #16a34a; text-decoration: underline;">support@biosketch.art</a>
      </p>
    </div>
  </div>
</body>
</html>`;
  }

  async handleRequest(payload: Partial<AuthEmailRequest>): Promise<{ success: boolean; error?: string }> {
    try {
      const email = payload.user?.email;
      const emailData = payload.email_data;
      const type = emailData?.email_action_type;

      if (!email || !emailData) {
        throw new Error('Missing required fields: user.email and email_data');
      }

      const redirectUrl = emailData.redirect_to || emailData.site_url;
      const confirmationUrl = `${this.supabaseUrl}/auth/v1/verify?token=${emailData.token_hash}&type=${type}&redirect_to=${redirectUrl}`;

      let subject: string;
      let html: string;

      switch (type) {
        case 'signup':
        case 'email_change':
          subject = 'Confirm your BioSketch account';
          html = this.getConfirmationEmailHtml(confirmationUrl, email);
          break;
        case 'recovery':
          subject = 'Reset your BioSketch password';
          html = this.getRecoveryEmailHtml(confirmationUrl, email);
          break;
        case 'invite':
          subject = "You've been invited to BioSketch";
          html = this.getConfirmationEmailHtml(confirmationUrl, email);
          break;
        case 'magiclink':
          subject = 'Your BioSketch login link';
          html = this.getConfirmationEmailHtml(confirmationUrl, email);
          break;
        default:
          throw new Error(`Unknown email type: ${type}`);
      }

      await this.resend.emails.send({
        from: `BioSketch <${this.fromEmail}>`,
        to: [email],
        subject,
        html,
      });

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

describe('send-email Edge Function', () => {
  let mockResend: MockResend;
  let handler: SendEmailHandler;

  beforeEach(() => {
    mockResend = new MockResend();
    handler = new SendEmailHandler(mockResend);
  });

  it('handles signup event with valid payload', async () => {
    const payload = createSignupPayload('user@example.com');
    const result = await handler.handleRequest(payload);

    expect(result.success).toBe(true);
    expect(mockResend.getCallCount()).toBe(1);

    const lastCall = mockResend.getLastCall();
    expect(lastCall).toBeTruthy();
    expect(lastCall!.params.to).toContain('user@example.com');
    expect(lastCall!.params.subject).toBe('Confirm your BioSketch account');
  });

  it('handles recovery event with valid payload', async () => {
    const payload = createRecoveryPayload('reset@example.com');
    const result = await handler.handleRequest(payload);

    expect(result.success).toBe(true);
    expect(mockResend.getCallCount()).toBe(1);

    const lastCall = mockResend.getLastCall();
    expect(lastCall).toBeTruthy();
    expect(lastCall!.params.to).toContain('reset@example.com');
    expect(lastCall!.params.subject).toBe('Reset your BioSketch password');
  });

  it('returns success response for valid requests', async () => {
    const testCases = [
      createSignupPayload(),
      createRecoveryPayload(),
      createInvitePayload(),
      createMagicLinkPayload(),
      createEmailChangePayload(),
    ];

    for (const payload of testCases) {
      mockResend.reset();
      const result = await handler.handleRequest(payload);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockResend.getCallCount()).toBe(1);
    }
  });

  it('returns error for missing required fields', async () => {
    const testCases = [
      createInvalidPayload(),
      createMissingEmailPayload(),
      createMissingEmailDataPayload(),
    ];

    for (const payload of testCases) {
      mockResend.reset();
      const result = await handler.handleRequest(payload);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(mockResend.getCallCount()).toBe(0);
    }
  });

  it('correctly formats email templates with user data', async () => {
    const email = 'template-test@example.com';

    // Test signup template
    const signupPayload = createSignupPayload(email);
    await handler.handleRequest(signupPayload);

    let lastCall = mockResend.getLastCall();
    expect(lastCall).toBeTruthy();

    let html = lastCall!.params.html;
    expect(hasValidEmailStructure(html)).toBe(true);
    expect(hasClickableLink(html)).toBe(true);
    expect(hasProperBranding(html, 'BioSketch')).toBe(true);
    expect(validateEmailHtml(html, {
      heading: 'Welcome to BioSketch',
      buttonText: 'Confirm Email Address',
      email: email,
      brandName: 'BioSketch',
    })).toBe(true);

    // Verify confirmation URL
    const confirmationUrl = extractConfirmationUrl(html);
    expect(confirmationUrl).toBeTruthy();
    expect(isValidConfirmationUrl(confirmationUrl!)).toBe(true);

    const parsedUrl = parseConfirmationUrl(confirmationUrl!);
    expect(parsedUrl.token).toBe(signupPayload.email_data.token_hash);
    expect(parsedUrl.type).toBe('signup');

    // Test recovery template
    mockResend.reset();
    const recoveryPayload = createRecoveryPayload(email);
    await handler.handleRequest(recoveryPayload);

    lastCall = mockResend.getLastCall();
    html = lastCall!.params.html;

    expect(validateEmailHtml(html, {
      heading: 'Reset Your Password',
      buttonText: 'Reset Password',
      email: email,
      brandName: 'BioSketch',
    })).toBe(true);
  });
});
