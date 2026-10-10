import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const logoUrl = "https://tljsbmpglwmzyaoxsqyj.supabase.co/storage/v1/object/sign/icon%20site/biosketch%20art-min.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8zOWUxYTMwMi1lYjJkLTQxOGUtYjdkZS1hZGE0M2NhNTI0NDUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpY29uIHNpdGUvYmlvc2tldGNoIGFydC1taW4ucG5nIiwiaWF0IjoxNzYwODM2MjgxLCJleHAiOjIwNzYxOTYyODF9.LDw-xwHK6WmdeLwiG_BwtT0jX3N6fjdOvZmoUcI4FP0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BulkEmailRequest {
  recipientIds: string[] | "all";
  subject: string;
  message: string;
  adminName: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting bulk email send...");
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication and admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Check if user has admin role
    const { data: hasAdminRole, error: roleError } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (roleError || !hasAdminRole) {
      console.error('Admin check failed:', roleError);
      return new Response(
        JSON.stringify({ error: 'Admin role required' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log(`Admin user ${user.email} authorized for bulk email`);
    
    const { recipientIds, subject, message, adminName }: BulkEmailRequest = await req.json();

    // Validate inputs
    if (!subject || subject.trim().length === 0) {
      throw new Error("Subject is required");
    }
    if (!message || message.trim().length === 0) {
      throw new Error("Message is required");
    }
    if (subject.length > 200) {
      throw new Error("Subject must be less than 200 characters");
    }
    if (message.length > 10000) {
      throw new Error("Message must be less than 10,000 characters");
    }

    // Fetch recipients (include user_id for notifications)
    let recipients: Array<{ id: string; email: string; full_name: string }> = [];
    
    if (recipientIds === "all") {
      console.log("Fetching all users...");
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .not("email", "is", null);
      
      if (error) throw error;
      recipients = data || [];
    } else {
      console.log(`Fetching ${recipientIds.length} specific users...`);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", recipientIds)
        .not("email", "is", null);
      
      if (error) throw error;
      recipients = data || [];
    }

    console.log(`Found ${recipients.length} recipients`);

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "No recipients found",
          sent: 0 
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Create email HTML
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: #f6f9fc;
              color: #1a1a1a;
              padding: 30px;
              border-radius: 10px 10px 0 0;
              text-align: center;
            }
            .header img {
              margin: 0 auto 16px;
              object-fit: contain;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: bold;
            }
            .content {
              background: white;
              padding: 30px;
              border: 3px solid #333;
              border-top: none;
              border-radius: 0 0 10px 10px;
            }
            .message {
              white-space: pre-wrap;
              margin: 20px 0;
              padding: 20px;
              background: #f8f9fa;
              border-left: 4px solid #667eea;
              border-radius: 4px;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 2px solid #eee;
              color: #666;
              font-size: 14px;
            }
            .signature {
              margin-top: 20px;
              font-weight: 500;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${logoUrl}" width="48" height="48" alt="BioSketch" />
            <h1>BioSketch Notification</h1>
          </div>
          <div class="content">
            <div class="message">
              ${message.replace(/\n/g, '<br>')}
            </div>
            <div class="signature">
              Best regards,<br>
              ${adminName || 'BioSketch Team'}
            </div>
            <div class="footer">
              <p>
                You are receiving this email because you have an account with BioSketch.
                <br>
                Visit <a href="https://biosketch.art">biosketch.art</a> to access your account.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send emails
    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];

    // Send in batches to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (recipient) => {
        try {
          const emailResponse = await resend.emails.send({
            from: "BioSketch <noreply@biosketch.art>",
            to: [recipient.email],
            subject: subject,
            html: emailHtml,
          });

          console.log(`Email sent to ${recipient.email}:`, emailResponse);
          successCount++;
        } catch (error: any) {
          console.error(`Failed to send email to ${recipient.email}:`, error);
          failureCount++;
          errors.push(`${recipient.email}: ${error.message}`);
        }
      });

      await Promise.all(batchPromises);
      
      // Small delay between batches
      if (i + batchSize < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`Bulk email complete. Success: ${successCount}, Failed: ${failureCount}`);

    // Store notifications in database
    try {
      const notificationRecords = recipients.map(recipient => ({
        user_id: recipient.id,
        subject: subject,
        message: message,
        sender_name: adminName || 'BioSketch Team',
        sent_via_email: true,
        is_read: false
      }));

      const { error: notificationError } = await supabase
        .from('user_notifications')
        .insert(notificationRecords);

      if (notificationError) {
        console.error('Error creating notifications:', notificationError);
      } else {
        console.log(`Created ${notificationRecords.length} notification records`);
      }
    } catch (notifError: any) {
      console.error('Exception creating notifications:', notifError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        failed: failureCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-bulk-email function:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
