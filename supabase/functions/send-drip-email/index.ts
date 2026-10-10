import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const logoUrl = "https://tljsbmpglwmzyaoxsqyj.supabase.co/storage/v1/object/sign/icon%20site/biosketch%20art-min.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8zOWUxYTMwMi1lYjJkLTQxOGUtYjdkZS1hZGE0M2NhNTI0NDUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpY29uIHNpdGUvYmlvc2tldGNoIGFydC1taW4ucG5nIiwiaWF0IjoxNzYwODM2MjgxLCJleHAiOjIwNzYxOTYyODF9.LDw-xwHK6WmdeLwiG_BwtT0jX3N6fjdOvZmoUcI4FP0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 1000;

const HOUR = 3600_000;
const DAY = 24 * HOUR;

interface DripConfig {
  type: string;
  minAgeMs: number;     // minimum age since signup/last login (ms)
  maxAgeMs: number;     // maximum age — window closes here
  subject: string;
  getHtml: (name: string) => string;
  dateColumn?: string;  // column to filter on (default: 'created_at')
}

const dripConfigs: DripConfig[] = [
  {
    type: 'features_7d',
    minAgeMs: 7 * DAY,
    maxAgeMs: 10 * DAY,
    subject: 'Unlock the full power of BioSketch',
    getHtml: (name: string) => featuresEmail(name),
  },
  {
    type: 'reengage_90d',
    minAgeMs: 90 * DAY,
    maxAgeMs: 120 * DAY,
    subject: "We've been busy — come see what's new on BioSketch",
    getHtml: (name: string) => reengageEmail(name),
    dateColumn: 'last_login_at',
  },
];

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let totalSent = 0;
    let totalFailed = 0;

    for (const config of dripConfigs) {
      console.log(`Processing drip: ${config.type}`);

      const now = Date.now();
      const minDate = new Date(now - config.minAgeMs).toISOString();
      const maxDate = new Date(now - config.maxAgeMs).toISOString();

      // Find eligible users:
      // - date column (created_at or last_login_at) falls within the window
      // - haven't received this email type yet
      // - haven't opted out of drip emails
      const col = config.dateColumn || 'created_at';
      const { data: eligible, error: queryError } = await supabase
        .from('profiles')
        .select('id, email, full_name, notification_preferences')
        .not('email', 'is', null)
        .not(col, 'is', null)
        .gte(col, maxDate)
        .lte(col, minDate);

      if (queryError) {
        console.error(`Query error for ${config.type}:`, queryError);
        continue;
      }

      if (!eligible || eligible.length === 0) {
        console.log(`No eligible users for ${config.type}`);
        continue;
      }

      // Filter out users who already received this email
      const userIds = eligible.map(u => u.id);
      const { data: alreadySent } = await supabase
        .from('drip_emails_sent')
        .select('user_id')
        .eq('email_type', config.type)
        .in('user_id', userIds);

      const sentSet = new Set((alreadySent || []).map(r => r.user_id));

      const recipients = eligible.filter(u => {
        // Skip if already sent
        if (sentSet.has(u.id)) return false;
        // Check opt-out
        const prefs = u.notification_preferences as Record<string, any> | null;
        if (prefs?.email_drip?.email === false) return false;
        return true;
      });

      console.log(`${recipients.length} recipients for ${config.type} (${eligible.length} eligible, ${sentSet.size} already sent)`);

      // Send in batches
      for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        const batch = recipients.slice(i, i + BATCH_SIZE);

        const results = await Promise.allSettled(
          batch.map(async (user) => {
            const name = user.full_name || 'there';

            await resend.emails.send({
              from: "BioSketch <noreply@biosketch.art>",
              to: [user.email],
              subject: config.subject,
              html: config.getHtml(name),
            });

            // Record that we sent it
            await supabase
              .from('drip_emails_sent')
              .insert({ user_id: user.id, email_type: config.type });

            console.log(`Sent ${config.type} to ${user.email}`);
          })
        );

        for (const r of results) {
          if (r.status === 'fulfilled') totalSent++;
          else {
            totalFailed++;
            console.error('Drip send failed:', r.reason);
          }
        }

        if (i + BATCH_SIZE < recipients.length) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
        }
      }
    }

    console.log(`Drip email run complete. Sent: ${totalSent}, Failed: ${totalFailed}`);

    return new Response(
      JSON.stringify({ success: true, sent: totalSent, failed: totalFailed }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Drip email error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

// ─────────────────────────────────────────────────────
// Email Templates
// ─────────────────────────────────────────────────────

function emailWrapper(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #525252; max-width: 600px; margin: 0 auto; padding: 20px; background: #f6f9fc; }
    .header { background: #f6f9fc; color: #1a1a1a; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
    .header img { margin: 0 auto 16px; object-fit: contain; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; color: #1a1a1a; }
    .content { background: #ffffff; padding: 30px; border: 3px solid #000; border-top: none; }
    .content h2 { color: #1a1a1a; font-size: 20px; margin-top: 24px; }
    .content p { margin: 12px 0; }
    .cta { display: inline-block; background: #16a34a; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; }
    .feature-box { background: #f8f9fa; border-left: 4px solid #16a34a; padding: 16px 20px; margin: 16px 0; border-radius: 4px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #6c757d; border: 3px solid #000; border-top: none; border-radius: 0 0 10px 10px; }
    .footer a { color: #667eea; text-decoration: none; }
    .unsubscribe { margin-top: 12px; font-size: 11px; color: #999; }
  </style>
</head>
<body>
  <div class="header">
    <img src="${logoUrl}" width="48" height="48" alt="BioSketch" />
    <h1>${title}</h1>
  </div>
  <div class="content">
    ${body}
  </div>
  <div class="footer">
    <p><strong>BioSketch</strong> — Free Scientific Illustration Tool<br><a href="https://biosketch.art">biosketch.art</a></p>
    <p class="unsubscribe">You're receiving this because you signed up for BioSketch.<br>To stop these emails, update your <a href="https://biosketch.art/profile">notification preferences</a>.</p>
  </div>
</body>
</html>`;
}

function featuresEmail(name: string): string {
  return emailWrapper('Tips to Level Up Your Figures', `
    <p>Hi ${name},</p>
    <p>You've been with BioSketch for a week now. Here are some features you might not have discovered yet:</p>
    <div class="feature-box">
      <strong>AI Icon Generation</strong><br>
      Can't find the exact icon you need? Use our AI generator to create custom scientific icons from a text description.
    </div>
    <div class="feature-box">
      <strong>Collaboration</strong><br>
      Invite lab mates to edit figures together in real time. Share projects with view or edit access.
    </div>
    <div class="feature-box">
      <strong>Community Gallery</strong><br>
      Get inspired by figures from other researchers. Share your own work and get feedback.
    </div>
    <div class="feature-box">
      <strong>Style Presets</strong><br>
      Save and reuse color schemes, fonts, and layouts to keep your figures consistent across publications.
    </div>
    <p style="text-align: center;">
      <a href="https://biosketch.art/icons" class="cta">Explore the Icon Library</a>
    </p>
    <p>We'd love to hear how BioSketch is working for you. Reach out anytime!</p>
    <p>Best,<br><strong>The BioSketch Team</strong></p>
  `);
}

function reengageEmail(name: string): string {
  return emailWrapper("A lot has changed — come take a look", `
    <p>Hi ${name},</p>
    <p>It's been a while since you last visited BioSketch, and we've been hard at work making things better for you.</p>
    <p>We've shipped a number of improvements to the canvas and new tools that we think you'll appreciate. The best way to see what's changed is to jump back in.</p>
    <div class="feature-box">
      <strong>New tools & improvements</strong><br>
      We've added new capabilities and refined existing ones based on feedback from researchers like you.
    </div>
    <div class="feature-box">
      <strong>Growing icon library</strong><br>
      New scientific icons are added regularly — there's likely something new in your field.
    </div>
    <div class="feature-box">
      <strong>Community gallery</strong><br>
      See what other scientists have been creating and get inspired for your next figure.
    </div>
    <p style="text-align: center;">
      <a href="https://biosketch.art/canvas" class="cta">Open BioSketch</a>
    </p>
    <p>Your projects are right where you left them. We'd love to have you back.</p>
    <p>See you on the canvas,<br><strong>The BioSketch Team</strong></p>
  `);
}
