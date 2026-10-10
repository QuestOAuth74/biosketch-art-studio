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

    // Verify caller is authenticated
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

    const { groupInvitationId, origin } = await req.json();
    if (!groupInvitationId || !origin) {
      return new Response(JSON.stringify({ error: "groupInvitationId and origin are required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch invitation with group and inviter info
    const { data: invitation, error: invErr } = await serviceClient
      .from("group_invitations")
      .select("*, groups(name), profiles!invited_by(full_name)")
      .eq("id", groupInvitationId)
      .single();

    if (invErr || !invitation) {
      return new Response(JSON.stringify({ error: "Invitation not found" }), {
        status: 404, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Verify caller is the inviter or a group manager
    const isInviter = caller.id === invitation.invited_by;
    if (!isInviter) {
      const { data: isMgr } = await serviceClient.rpc("user_is_group_manager", {
        check_user_id: caller.id,
        check_group_id: invitation.group_id,
      });
      if (!isMgr) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    const groupName = (invitation.groups as any)?.name ?? "the group";
    const inviterName = (invitation.profiles as any)?.full_name ?? "A BioSketch user";
    const acceptLink = `${origin}/invite/group/${invitation.token}`;

    const emailHtml = `
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>Group Invitation</title></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f6f9fc; padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <img src="${logoUrl}" width="48" height="48" alt="BioSketch" style="margin: 0 auto 16px; object-fit: contain;" />
          <h1 style="color: #1a1a1a; margin: 0; font-size: 28px;">BioSketch</h1>
        </div>
        <div style="background: white; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <h2 style="color: #1f2937; margin-top: 0;">You've been invited to join a group!</h2>
          <p style="color: #4b5563; font-size: 16px;">
            <strong>${inviterName}</strong> has invited you to join <strong>${groupName}</strong> on BioSketch.
          </p>
          <p style="color: #4b5563;">
            Click the button below to accept the invitation and join the group.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${acceptLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: bold; font-size: 16px;">
              Accept Invitation →
            </a>
          </div>
          <p style="color: #6b7280; font-size: 14px;">
            This invitation expires in 7 days. If you don't want to join, you can ignore this email.
          </p>
        </div>
        <div style="text-align: center; padding: 24px; color: #9ca3af; font-size: 12px;">
          <p>BioSketch • <a href="https://biosketch.art" style="color: #667eea;">biosketch.art</a></p>
        </div>
      </body></html>
    `;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [invitation.email],
        subject: `${inviterName} invited you to join ${groupName} on BioSketch`,
        html: emailHtml,
      }),
    });

    if (!emailRes.ok) {
      const emailErr = await emailRes.text();
      console.error("Resend error:", emailErr);
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // In-app notification — best-effort, does not affect the response
    try {
      const { data: { users } } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
      const inviteeUser = (users ?? []).find(
        (u: { id: string; email?: string | null }) =>
          u.email?.toLowerCase() === invitation.email?.toLowerCase()
      );
      if (inviteeUser) {
        await serviceClient.rpc("notify_user", {
          p_user_id: inviteeUser.id,
          p_type: "group_invitation",
          p_subject: `Group invitation: "${groupName}"`,
          p_message: `${inviterName} invited you to join the group "${groupName}" on BioSketch.`,
          p_sender: inviterName,
          p_link: acceptLink,
        });
      }
    } catch (notifErr: unknown) {
      console.error("In-app notification error (non-fatal):", notifErr);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Error in send-group-invitation:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
