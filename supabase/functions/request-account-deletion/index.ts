import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const logoUrl = "https://tljsbmpglwmzyaoxsqyj.supabase.co/storage/v1/object/sign/icon%20site/biosketch%20art-min.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8zOWUxYTMwMi1lYjJkLTQxOGUtYjdkZS1hZGE0M2NhNTI0NDUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpY29uIHNpdGUvYmlvc2tldGNoIGFydC1taW4ucG5nIiwiaWF0IjoxNzYwODM2MjgxLCJleHAiOjIwNzYxOTYyODF9.LDw-xwHK6WmdeLwiG_BwtT0jX3N6fjdOvZmoUcI4FP0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DeletionRequest {
  userId: string;
  userEmail: string;
  userName: string;
  reason?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, userEmail, userName, reason }: DeletionRequest = await req.json();

    if (!userId || !userEmail) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const adminEmail = Deno.env.get("CONTACT_ADMIN_EMAIL") || "noreply@biosketch.art";

    const emailResponse = await resend.emails.send({
      from: "BioSketch <noreply@biosketch.art>",
      to: [adminEmail],
      subject: `Account Deletion Request — ${userName || userEmail}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #f6f9fc; padding: 24px; text-align: center; border-radius: 8px 8px 0 0; }
              .header img { margin: 0 auto 12px; }
              .header h1 { margin: 0; font-size: 22px; color: #dc2626; }
              .content { background: #fff; padding: 24px; border: 2px solid #e5e7eb; border-top: none; }
              .field { margin-bottom: 12px; }
              .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; font-weight: 600; }
              .value { font-size: 15px; color: #111; margin-top: 2px; }
              .reason { background: #fef2f2; border-left: 4px solid #dc2626; padding: 12px 16px; margin-top: 16px; border-radius: 4px; }
              .footer { background: #f8f9fa; padding: 16px; text-align: center; font-size: 12px; color: #6c757d; border: 2px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
            </style>
          </head>
          <body>
            <div class="header">
              <img src="${logoUrl}" width="40" height="40" alt="BioSketch" />
              <h1>Account Deletion Request</h1>
            </div>
            <div class="content">
              <p>A user has requested their account to be deleted.</p>
              <div class="field">
                <div class="label">User ID</div>
                <div class="value"><code>${userId}</code></div>
              </div>
              <div class="field">
                <div class="label">Email</div>
                <div class="value">${userEmail}</div>
              </div>
              <div class="field">
                <div class="label">Name</div>
                <div class="value">${userName || 'Not provided'}</div>
              </div>
              <div class="field">
                <div class="label">Requested At</div>
                <div class="value">${new Date().toISOString()}</div>
              </div>
              ${reason ? `<div class="reason"><strong>Reason:</strong> ${reason.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</div>` : ''}
            </div>
            <div class="footer">
              <p>Please review and process this deletion request in the Supabase dashboard.</p>
            </div>
          </body>
        </html>
      `,
    });

    console.log("Account deletion request email sent:", emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in request-account-deletion:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
