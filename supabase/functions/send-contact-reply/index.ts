import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const logoUrl = "https://tljsbmpglwmzyaoxsqyj.supabase.co/storage/v1/object/sign/icon%20site/biosketch%20art-min.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8zOWUxYTMwMi1lYjJkLTQxOGUtYjdkZS1hZGE0M2NhNTI0NDUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpY29uIHNpdGUvYmlvc2tldGNoIGFydC1taW4ucG5nIiwiaWF0IjoxNzYwODM2MjgxLCJleHAiOjIwNzYxOTYyODF9.LDw-xwHK6WmdeLwiG_BwtT0jX3N6fjdOvZmoUcI4FP0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ContactReplyRequest {
  recipientEmail: string;
  recipientName: string;
  replyMessage: string;
  adminName: string;
  originalMessage: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      recipientEmail, 
      recipientName, 
      replyMessage, 
      adminName,
      originalMessage 
    }: ContactReplyRequest = await req.json();

    // Validate required fields
    if (!recipientEmail || !recipientName || !replyMessage) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return new Response(
        JSON.stringify({ error: "Invalid email address" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Validate message length
    if (replyMessage.length > 5000) {
      return new Response(
        JSON.stringify({ error: "Reply message too long (max 5000 characters)" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const emailResponse = await resend.emails.send({
      from: "BioSketch <noreply@biosketch.art>",
      to: [recipientEmail],
      subject: "Re: Your BioSketch Contact Message",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
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
                text-align: center;
                border-radius: 8px 8px 0 0;
                margin-bottom: 0;
              }
              .header img {
                margin: 0 auto 16px;
                object-fit: contain;
              }
              .header h1 {
                margin: 0;
                font-size: 28px;
                font-weight: 700;
              }
              .content {
                background: #ffffff;
                padding: 30px;
                border: 3px solid #000;
                border-top: none;
                box-shadow: 8px 8px 0 0 rgba(0, 0, 0, 0.1);
              }
              .greeting {
                font-size: 16px;
                margin-bottom: 20px;
              }
              .reply-section {
                background: #f8f9fa;
                border-left: 4px solid #667eea;
                padding: 20px;
                margin: 20px 0;
                border-radius: 4px;
              }
              .original-message {
                background: #fff;
                border: 2px solid #e9ecef;
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
                font-size: 14px;
                color: #666;
              }
              .original-message-label {
                font-weight: 600;
                color: #495057;
                margin-bottom: 8px;
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              }
              .signature {
                margin-top: 30px;
                padding-top: 20px;
                border-top: 2px solid #e9ecef;
                font-size: 14px;
              }
              .footer {
                background: #f8f9fa;
                padding: 20px;
                text-align: center;
                font-size: 12px;
                color: #6c757d;
                border: 3px solid #000;
                border-top: none;
                border-radius: 0 0 8px 8px;
              }
              .footer a {
                color: #667eea;
                text-decoration: none;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <img src="${logoUrl}" width="48" height="48" alt="BioSketch" />
              <h1>BioSketch Support</h1>
            </div>
            
            <div class="content">
              <div class="greeting">
                Hello ${recipientName},
              </div>
              
              <p>Thank you for reaching out to us. We've received your message and wanted to respond:</p>
              
              <div class="reply-section">
                ${replyMessage.replace(/\n/g, '<br>')}
              </div>
              
              <div class="original-message">
                <div class="original-message-label">Your Original Message:</div>
                ${originalMessage.replace(/\n/g, '<br>')}
              </div>
              
              <p>If you have any further questions, please don't hesitate to contact us again.</p>
              
              <div class="signature">
                <strong>${adminName}</strong><br>
                BioSketch Support Team
              </div>
            </div>
            
            <div class="footer">
              <p>
                <strong>BioSketch</strong> - Create Beautiful Scientific Diagrams<br>
                <a href="https://biosketch.art">biosketch.art</a>
              </p>
              <p style="margin-top: 10px; font-size: 11px;">
                This email was sent in response to your contact form submission.
              </p>
            </div>
          </body>
        </html>
      `,
    });

    console.log("Contact reply sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-contact-reply function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
