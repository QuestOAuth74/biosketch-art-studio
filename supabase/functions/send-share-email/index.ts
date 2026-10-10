import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const logoUrl = "https://tljsbmpglwmzyaoxsqyj.supabase.co/storage/v1/object/sign/icon%20site/biosketch%20art-min.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8zOWUxYTMwMi1lYjJkLTQxOGUtYjdkZS1hZGE0M2NhNTI0NDUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpY29uIHNpdGUvYmlvc2tldGNoIGFydC1taW4ucG5nIiwiaWF0IjoxNzYwODM2MjgxLCJleHAiOjIwNzYxOTYyODF9.LDw-xwHK6WmdeLwiG_BwtT0jX3N6fjdOvZmoUcI4FP0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ShareEmailRequest {
  senderName: string;
  recipientName: string;
  recipientEmail: string;
  personalMessage?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { senderName, recipientName, recipientEmail, personalMessage }: ShareEmailRequest = await req.json();

    console.log(`Sending share email from ${senderName} to ${recipientEmail}`);

    // Validate required fields
    if (!recipientName || !recipientEmail) {
      return new Response(
        JSON.stringify({ error: "Recipient name and email are required" }),
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
        JSON.stringify({ error: "Invalid email format" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Build email content
    const personalMessageSection = personalMessage
      ? `
        <div style="background-color: #f3f4f6; border-left: 4px solid #3b82f6; padding: 16px; margin: 24px 0; border-radius: 4px;">
          <p style="margin: 0; color: #374151; font-style: italic;">"${personalMessage}"</p>
          <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 14px;">— ${senderName}</p>
        </div>
      `
      : "";

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Discover BioSketch</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

          <div style="background: #f6f9fc; padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <img src="${logoUrl}" width="48" height="48" alt="BioSketch" style="margin: 0 auto 16px; object-fit: contain;" />
            <h1 style="color: #1a1a1a; margin: 0; font-size: 32px;">BioSketch</h1>
            <p style="color: #4b5563; margin: 8px 0 0 0; font-size: 18px;">Free Scientific Illustration Tool</p>
          </div>

          <div style="background-color: white; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1f2937; margin-top: 0;">Hi ${recipientName}! 👋</h2>
            
            <p style="color: #4b5563; font-size: 16px;">
              <strong>${senderName}</strong> thought you might be interested in BioSketch, 
              a free tool for creating scientific illustrations and diagrams.
            </p>

            ${personalMessageSection}

            <h3 style="color: #1f2937; margin-top: 32px; margin-bottom: 16px;">What is BioSketch?</h3>
            <p style="color: #4b5563;">
              BioSketch is a completely free, open-source web application designed specifically 
              for scientists, educators, and students who need to create professional-quality 
              scientific illustrations without expensive software.
            </p>

            <h3 style="color: #1f2937; margin-top: 24px; margin-bottom: 12px;">Key Features:</h3>
            <ul style="color: #4b5563; padding-left: 20px;">
              <li style="margin-bottom: 8px;">
                <strong>Drag & Drop Interface:</strong> Intuitive design makes creating diagrams simple
              </li>
              <li style="margin-bottom: 8px;">
                <strong>Extensive Icon Library:</strong> Hundreds of scientific icons across categories like anatomy, microbiology, chemistry, and more
              </li>
              <li style="margin-bottom: 8px;">
                <strong>Professional Export:</strong> Export high-quality PNG and SVG files ready for publications and presentations
              </li>
              <li style="margin-bottom: 8px;">
                <strong>100% Free:</strong> No paywall, no subscriptions, no hidden costs
              </li>
              <li style="margin-bottom: 8px;">
                <strong>Community-Driven:</strong> Open-source project with contributions from scientists worldwide
              </li>
              <li style="margin-bottom: 8px;">
                <strong>Cloud Save:</strong> Save your projects and access them from anywhere
              </li>
            </ul>

            <h3 style="color: #1f2937; margin-top: 24px; margin-bottom: 12px;">Perfect For:</h3>
            <ul style="color: #4b5563; padding-left: 20px;">
              <li>Research publications and papers</li>
              <li>Educational materials and presentations</li>
              <li>Grant proposals and reports</li>
              <li>Conference posters and slides</li>
              <li>Laboratory protocols and diagrams</li>
            </ul>

            <div style="text-align: center; margin: 32px 0;">
              <a href="https://biosketch.art"
                 style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                Start Creating with BioSketch →
              </a>
            </div>

            <p style="color: #6b7280; font-size: 14px; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
              BioSketch is completely free to use and always will be. We believe that scientific 
              tools should be accessible to everyone, regardless of budget.
            </p>

            <p style="color: #6b7280; font-size: 14px; margin-top: 16px;">
              Questions? Ideas? We'd love to hear from you through our contact form on the website!
            </p>
          </div>

          <div style="text-align: center; padding: 24px; color: #9ca3af; font-size: 12px;">
            <p style="margin: 0;">
              This email was sent because ${senderName} wanted to share BioSketch with you.
            </p>
            <p style="margin: 8px 0 0 0;">
              BioSketch • Free Scientific Illustration Tool • 
              <a href="https://biosketch.art" style="color: #667eea;">biosketch.art</a>
            </p>
          </div>

        </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: "BioSketch <noreply@biosketch.art>",
      to: [recipientEmail],
      subject: `${senderName} wants to share BioSketch with you!`,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Email sent successfully",
        id: emailResponse.data?.id 
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-share-email function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Failed to send email",
        details: error.toString()
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
