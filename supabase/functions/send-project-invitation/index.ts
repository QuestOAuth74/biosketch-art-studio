import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logoUrl = "https://tljsbmpglwmzyaoxsqyj.supabase.co/storage/v1/object/sign/icon%20site/biosketch%20art-min.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8zOWUxYTMwMi1lYjJkLTQxOGUtYjdkZS1hZGE0M2NhNTI0NDUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpY29uIHNpdGUvYmlvc2tldGNoIGFydC1taW4ucG5nIiwiaWF0IjoxNzYwODM2MjgxLCJleHAiOjIwNzYxOTYyODF9.LDw-xwHK6WmdeLwiG_BwtT0jX3N6fjdOvZmoUcI4FP0";

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
    const fromEmail = Deno.env.get("FROM_EMAIL") ?? "BioSketch <noreply@biosketch.art>";
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authError } = await callerClient.auth.getUser();
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { projectCollaboratorId, origin } = await req.json();
    if (!projectCollaboratorId || !origin) {
      return new Response(JSON.stringify({ error: "projectCollaboratorId and origin are required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch collaborator row with project info
    const { data: collab, error: collabErr } = await serviceClient
      .from("project_collaborators")
      .select("*, canvas_projects(name)")
      .eq("id", projectCollaboratorId)
      .single();

    if (collabErr || !collab) {
      return new Response(JSON.stringify({ error: "Collaborator record not found" }), {
        status: 404, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Verify caller is the inviter
    if (caller.id !== collab.invited_by) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Email is stored directly on the collaborator row
    const recipientEmail = collab.email;
    if (!recipientEmail) {
      return new Response(JSON.stringify({ error: "No email on collaborator record" }), {
        status: 404, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch inviter profile separately (invited_by FK points to auth.users, not profiles)
    const { data: inviterProfile } = await serviceClient
      .from("profiles")
      .select("full_name")
      .eq("id", collab.invited_by)
      .single();

    const projectName = (collab.canvas_projects as any)?.name ?? "a project";
    const inviterName = inviterProfile?.full_name ?? "A BioSketch user";
    const permissionLabel = collab.permission === "edit" ? "Edit Access" : "View Only";
    const acceptLink = `${origin}/invite/project/${collab.invitation_token}`;

    const emailHtml = `
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>Project Invitation</title></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f6f9fc; padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <img src="${logoUrl}" width="48" height="48" alt="BioSketch" style="margin: 0 auto 16px; object-fit: contain;" />
          <h1 style="color: #1a1a1a; margin: 0; font-size: 28px;">BioSketch</h1>
        </div>
        <div style="background: white; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <h2 style="color: #1f2937; margin-top: 0;">You've been invited to collaborate on a project!</h2>
          <p style="color: #4b5563; font-size: 16px;">
            <strong>${inviterName}</strong> has shared <strong>"${projectName}"</strong> with you on BioSketch.
          </p>
          <p style="color: #4b5563;">
            Access level: <strong>${permissionLabel}</strong>
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${acceptLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: bold; font-size: 16px;">
              Accept Invitation →
            </a>
          </div>
          <p style="color: #6b7280; font-size: 14px;">If you don't want to collaborate, you can ignore this email.</p>
        </div>
        <div style="text-align: center; padding: 24px; color: #9ca3af; font-size: 12px;">
          <p>BioSketch • <a href="https://biosketch.art" style="color: #667eea;">biosketch.art</a></p>
        </div>
      </body></html>
    `;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipientEmail],
        subject: `${inviterName} shared "${projectName}" with you on BioSketch`,
        html: emailHtml,
      }),
    });

    if (!resendRes.ok) {
      const resendError = await resendRes.text();
      console.error("Resend API error:", resendRes.status, resendError);
      return new Response(JSON.stringify({ error: "Failed to send email", detail: resendError }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // In-app notification — only when the invitee already has an account (user_id is set)
    if (collab.user_id) {
      try {
        await serviceClient.rpc("notify_user", {
          p_user_id: collab.user_id,
          p_type: "project_invitation",
          p_subject: `Project invitation: "${projectName}"`,
          p_message: `${inviterName} invited you to collaborate on the project "${projectName}" with ${permissionLabel} access.`,
          p_sender: inviterName,
          p_link: acceptLink,
        });
      } catch (notifErr: unknown) {
        console.error("In-app notification error (non-fatal):", notifErr);
      }
    }

    console.log("Email sent to", recipientEmail);
    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Error in send-project-invitation:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
