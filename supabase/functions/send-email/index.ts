import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const authHookSecret = Deno.env.get("AUTH_HOOK_SECRET");
const supabaseUrl =
  Deno.env.get("SUPABASE_URL") || "https://tljsbmpglwmzyaoxsqyj.supabase.co";
const fromEmail = Deno.env.get("CONTACT_ADMIN_EMAIL") || "noreply@biosketch.art";
const logoUrl = "https://tljsbmpglwmzyaoxsqyj.supabase.co/storage/v1/object/sign/icon%20site/biosketch%20art-min.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8zOWUxYTMwMi1lYjJkLTQxOGUtYjdkZS1hZGE0M2NhNTI0NDUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpY29uIHNpdGUvYmlvc2tldGNoIGFydC1taW4ucG5nIiwiaWF0IjoxNzYwODM2MjgxLCJleHAiOjIwNzYxOTYyODF9.LDw-xwHK6WmdeLwiG_BwtT0jX3N6fjdOvZmoUcI4FP0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
      <img src="${logoUrl}" width="48" height="48" alt="BioSketch" style="margin: 0 auto; object-fit: contain;">
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
</html>
`;

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
      <img src="${logoUrl}" width="48" height="48" alt="BioSketch" style="margin: 0 auto; object-fit: contain;">
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
</html>
`;

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify webhook signature
    const payloadText = await req.text();
    const headers = Object.fromEntries(req.headers);

    if (!authHookSecret) {
      console.error("AUTH_HOOK_SECRET is not configured");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Server configuration error"
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    let payload: AuthEmailRequest;
    try {
      const wh = new Webhook(authHookSecret);
      payload = wh.verify(payloadText, headers) as AuthEmailRequest;
    } catch (error) {
      console.error("Webhook verification failed:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid webhook signature"
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

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
        subject = "Confirm your BioSketch account";
        html = getConfirmationEmailHtml(confirmationUrl, email);
        break;
      case "recovery":
        subject = "Reset your BioSketch password";
        html = getRecoveryEmailHtml(confirmationUrl, email);
        break;
      case "invite":
        subject = "You've been invited to BioSketch";
        html = getConfirmationEmailHtml(confirmationUrl, email);
        break;
      case "magiclink":
        subject = "Your BioSketch login link";
        html = getConfirmationEmailHtml(confirmationUrl, email);
        break;
      default:
        throw new Error(`Unknown email type: ${type}`);
    }

    const response = await resend.emails.send({
      from: `BioSketch <${fromEmail}>`,
      to: [email],
      subject,
      html,
    });

    console.log("Email sent successfully:", response);

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
