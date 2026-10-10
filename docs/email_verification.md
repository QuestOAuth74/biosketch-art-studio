# Email Verification

This document describes how email verification is implemented in the CourtMates application. It includes all details needed to reproduce the email sending functionality in another project.

## Supabase Auth Hook Configuration

The project uses Supabase's **Send Email Hook** to customize authentication emails. This hook intercepts Supabase's default email sending and routes it through a custom Edge Function.

### Enabling the Hook

In the Supabase Dashboard:

1. Navigate to **Authentication > Hooks**
2. Enable the **Send Email** hook
3. Select **HTTP** as the hook type
4. Set the endpoint URL to: `https://<project-ref>.supabase.co/functions/v1/send-email`

The Edge Function is configured in `supabase/config.toml` with `verify_jwt = false` to allow Supabase auth triggers to call it without authentication:

```toml
[functions.send-email]
verify_jwt = false
```

## Edge Function: send-email

**Location:** `supabase/functions/send-email/index.ts`

### Dependencies

```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
```

### Environment Variables

```typescript
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl =
  Deno.env.get("SUPABASE_URL") || "https://<project-ref>.supabase.co";
const fromEmail = Deno.env.get("CONTACT_ADMIN_EMAIL") || "support@example.com";
const logoUrl = `${supabaseUrl}/storage/v1/object/public/assets/logo-black.png`;
```

### CORS Headers

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
```

### Request Payload Interface

Supabase sends the following payload to the hook:

```typescript
interface AuthEmailRequest {
  user: {
    email: string;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type:
      | "signup"
      | "recovery"
      | "invite"
      | "magiclink"
      | "email_change";
    site_url: string;
  };
}
```

### Email Type Routing

| Email Type     | Subject                          | Template Function            |
| -------------- | -------------------------------- | ---------------------------- |
| `signup`       | Confirm your [AppName] account   | `getConfirmationEmailHtml()` |
| `email_change` | Confirm your [AppName] account   | `getConfirmationEmailHtml()` |
| `recovery`     | Reset your [AppName] password    | `getRecoveryEmailHtml()`     |
| `invite`       | You've been invited to [AppName] | `getConfirmationEmailHtml()` |
| `magiclink`    | Your [AppName] login link        | `getConfirmationEmailHtml()` |

### Confirmation URL Construction

```typescript
const redirectUrl = emailData.redirect_to || emailData.site_url;
const confirmationUrl = `${supabaseUrl}/auth/v1/verify?token=${emailData.token_hash}&type=${type}&redirect_to=${redirectUrl}`;
```

### Handler Implementation

```typescript
const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: AuthEmailRequest = await req.json();

    const email = payload.user?.email;
    const emailData = payload.email_data;
    const type = emailData?.email_action_type;

    if (!email || !emailData) {
      throw new Error("Missing required fields: user.email and email_data");
    }

    const redirectUrl = emailData.redirect_to || emailData.site_url;
    const confirmationUrl = `${supabaseUrl}/auth/v1/verify?token=${emailData.token_hash}&type=${type}&redirect_to=${redirectUrl}`;

    let subject: string;
    let html: string;

    switch (type) {
      case "signup":
      case "email_change":
        subject = "Confirm your [AppName] account";
        html = getConfirmationEmailHtml(confirmationUrl, email);
        break;
      case "recovery":
        subject = "Reset your [AppName] password";
        html = getRecoveryEmailHtml(confirmationUrl, email);
        break;
      case "invite":
        subject = "You've been invited to [AppName]";
        html = getConfirmationEmailHtml(confirmationUrl, email);
        break;
      case "magiclink":
        subject = "Your [AppName] login link";
        html = getConfirmationEmailHtml(confirmationUrl, email);
        break;
      default:
        throw new Error(`Unknown email type: ${type}`);
    }

    const response = await resend.emails.send({
      from: `[AppName] <${fromEmail}>`,
      to: [email],
      subject,
      html,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-email function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
```

## Email Templates

### Confirmation Email Template

Used for: `signup`, `email_change`, `invite`, `magiclink`

```typescript
const getConfirmationEmailHtml = (confirmationUrl: string, email: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, sans-serif; margin: 0; padding: 40px 0;">
  <div style="background-color: #ffffff; margin: 0 auto; padding: 40px 20px; max-width: 560px; border-radius: 8px;">
    <div style="text-align: center; margin-bottom: 32px;">
      <img src="${logoUrl}" width="150" height="40" alt="[AppName]" style="margin: 0 auto;">
    </div>
    <h1 style="color: #1a1a1a; font-size: 24px; font-weight: 600; text-align: center; margin: 0 0 24px;">Welcome to [AppName]!</h1>
    <p style="color: #525252; font-size: 16px; line-height: 24px; margin: 0 0 24px;">
      Thanks for signing up! Please confirm your email address to get started.
    </p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${confirmationUrl}" style="background-color: #16a34a; border-radius: 6px; color: #fff; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center; padding: 12px 24px; display: inline-block;">
        Confirm Email Address
      </a>
    </div>
    <p style="color: #525252; font-size: 16px; line-height: 24px; margin: 0 0 24px;">
      If you didn't create an account with [AppName], you can safely ignore this email.
    </p>
    <div style="border-top: 1px solid #e5e5e5; margin-top: 32px; padding-top: 24px;">
      <p style="color: #8c8c8c; font-size: 12px; line-height: 20px; margin: 0;">
        This email was sent to ${email}. If you have questions, contact us at <a href="mailto:support@example.com" style="color: #16a34a; text-decoration: underline;">support@example.com</a>
      </p>
    </div>
  </div>
</body>
</html>
`;
```

### Recovery Email Template

Used for: `recovery`

```typescript
const getRecoveryEmailHtml = (confirmationUrl: string, email: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, sans-serif; margin: 0; padding: 40px 0;">
  <div style="background-color: #ffffff; margin: 0 auto; padding: 40px 20px; max-width: 560px; border-radius: 8px;">
    <div style="text-align: center; margin-bottom: 32px;">
      <img src="${logoUrl}" width="150" height="40" alt="[AppName]" style="margin: 0 auto;">
    </div>
    <h1 style="color: #1a1a1a; font-size: 24px; font-weight: 600; text-align: center; margin: 0 0 24px;">Reset Your Password</h1>
    <p style="color: #525252; font-size: 16px; line-height: 24px; margin: 0 0 24px;">
      We received a request to reset your password for your [AppName] account. Click the button below to choose a new password.
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
        This email was sent to ${email}. If you have questions, contact us at <a href="mailto:support@example.com" style="color: #16a34a; text-decoration: underline;">support@example.com</a>
      </p>
    </div>
  </div>
</body>
</html>
`;
```

### Template Styling Reference

| Element              | Style              |
| -------------------- | ------------------ |
| Body background      | `#f6f9fc`          |
| Card background      | `#ffffff`          |
| Card max-width       | `560px`            |
| Card padding         | `40px 20px`        |
| Card border-radius   | `8px`              |
| Primary button color | `#16a34a` (green)  |
| Heading color        | `#1a1a1a`          |
| Body text color      | `#525252`          |
| Footer text color    | `#8c8c8c`          |
| Link color           | `#16a34a`          |
| Font family          | System fonts stack |

### React Email Components (Development Preview)

**Location:** `src/emails/`

- `confirmation.tsx` - Account verification template
- `recovery.tsx` - Password reset template

These React Email components mirror the inline HTML templates and are used for development previewing via the admin preview page.

### Email Template Preview Page

**Location:** `src/pages/EmailPreview.tsx`
**Route:** `/admin/email-preview`

An admin page for previewing email templates with sample data. Allows switching between confirmation and recovery templates and displays template variables.

## Application Flow

### Sign-up Flow

1. User submits sign-up form via `usePlayerSignup()` or `useCoachSignup()` hooks
2. Supabase creates user and triggers send-email hook
3. Edge Function sends confirmation email via Resend
4. User clicks verification link → Supabase verifies token
5. User is redirected to the application

### Sign-in with Unverified Email

When a user attempts to sign in without verified email:

1. `useSignIn()` catches the "email not confirmed" error
2. Automatically resends verification email via `supabase.auth.resend()`
3. Redirects user to `/auth/verify-email`
4. Shows toast: "Email Not Verified - We've resent a verification email"

### Password Reset Flow

1. User requests password reset
2. Supabase triggers send-email hook with `recovery` type
3. User clicks reset link in email
4. `AuthListener` component detects `PASSWORD_RECOVERY` event
5. User is redirected to `/auth/reset-password` to set new password

## Key Files

| File                                     | Purpose                                             |
| ---------------------------------------- | --------------------------------------------------- |
| `supabase/functions/send-email/index.ts` | Edge function handling email dispatch               |
| `supabase/config.toml`                   | Function configuration (verify_jwt = false)         |
| `src/emails/confirmation.tsx`            | Confirmation email React component                  |
| `src/emails/recovery.tsx`                | Password reset email React component                |
| `src/pages/EmailPreview.tsx`             | Admin template preview page                         |
| `src/pages/VerifyEmail.tsx`              | User-facing "check your email" page                 |
| `src/pages/ResetPassword.tsx`            | Password reset form                                 |
| `src/hooks/useAuth.tsx`                  | Auth hooks with email verification handling         |
| `src/components/AuthListener.tsx`        | Listens for auth events including PASSWORD_RECOVERY |

## Environment Variables

| Variable              | Purpose                                       | Example                   |
| --------------------- | --------------------------------------------- | ------------------------- |
| `RESEND_API_KEY`      | API key for Resend email service              | `re_xxxx`                 |
| `SUPABASE_URL`        | Supabase project URL (for verification links) | `https://xxx.supabase.co` |
| `CONTACT_ADMIN_EMAIL` | From address for emails                       | `support@example.com`     |
| `VITE_SITE_URL`       | Application URL for redirects                 | `https://example.com`     |

## Deployment Checklist

1. **Create Edge Function**: Place `index.ts` in `supabase/functions/send-email/`
2. **Configure function**: Add `[functions.send-email] verify_jwt = false` to `supabase/config.toml`
3. **Set environment variables**: Add `RESEND_API_KEY` and `CONTACT_ADMIN_EMAIL` to Supabase Edge Function secrets
4. **Upload logo**: Store logo at `{SUPABASE_URL}/storage/v1/object/public/assets/logo-black.png`
5. **Enable hook**: Configure Send Email hook in Supabase Dashboard → Authentication → Hooks
6. **Deploy**: Run `npx supabase functions deploy send-email`

## Testing

**File:** `e2e/email-verification.spec.ts`
**Command:** `npm run test:e2e:email-verification`

### Signup Redirect Tests

| Test                                                          | Validates                                                   |
| ------------------------------------------------------------- | ----------------------------------------------------------- |
| should redirect to /auth/verify-email after successful signup | User redirected to verify page after completing signup form |
| should display "Check your email" message on verify page      | `AUTH_VERIFY_EMAIL_HEADING` element visible                 |
| should show link to return to sign in                         | `AUTH_VERIFY_EMAIL_RETURN_LINK` element visible             |

### Unverified Email Handling Tests

| Test                                                 | Validates                                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------ |
| should detect "Email not confirmed" error on sign in | Error toast appears or redirect to verify page when signing in with unverified email |
| should automatically resend verification email       | Toast shows resend confirmation or redirect occurs                                   |
| should redirect to /auth/verify-email after resend   | URL changes to `/auth/verify-email` after resend attempt                             |

### Verify Email Page UI Tests

| Test                                                  | Validates                                                     |
| ----------------------------------------------------- | ------------------------------------------------------------- |
| should display correct messaging about checking inbox | `AUTH_VERIFY_EMAIL_MESSAGE` element visible with instructions |
| should have functional return to sign in link         | Clicking return link navigates back to `/auth`                |

**Total Tests:** 8

### Test Flow

Each signup redirect test:

1. Navigates to `/auth`
2. Completes signup form with unique timestamped email
3. Submits form and waits for redirect
4. Validates URL or UI elements

Each unverified email test:

1. Creates new user via signup
2. Waits for redirect to verify page
3. Returns to `/auth` and attempts sign-in
4. Validates error detection, resend behavior, or redirect

### Test Data

Tests use dynamically generated emails with timestamps to avoid conflicts:

- Pattern: `test.{prefix}.{timestamp}@test.com`
- Cleanup runs via `cleanupAuthTestUsers()` before and after test suite

### Test Helper

**Location:** `e2e/utils/confirm-email.ts`

Provides `confirmUserEmail(email: string)` function for programmatically verifying user emails in tests. Used by other test suites that need verified users:

```typescript
import { confirmUserEmail } from "./utils/confirm-email";

await confirmUserEmail("test@example.com");
```

Implementation uses Supabase Admin API:

```typescript
const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
  email_confirm: true,
});
```

**Required Environment Variables:**

- `VITE_SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations
