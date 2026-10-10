import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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

    const { token, action = "accept" } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ error: "token is required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch invitation by token
    const { data: invitation, error: invErr } = await serviceClient
      .from("group_invitations")
      .select("*")
      .eq("token", token)
      .single();

    if (invErr || !invitation) {
      return new Response(JSON.stringify({ error: "Invitation not found or invalid token" }), {
        status: 404, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (invitation.accepted_at) {
      return new Response(JSON.stringify({ error: "Invitation already accepted", groupId: invitation.group_id }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Invitation has expired" }), {
        status: 410, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Verify caller's email matches invitation email
    const { data: { user: fullUser } } = await serviceClient.auth.admin.getUserById(caller.id);
    if (!fullUser || fullUser.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      return new Response(JSON.stringify({ error: "This invitation was sent to a different email address" }), {
        status: 403, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (action === "decline") {
      await serviceClient
        .from("group_invitations")
        .update({ declined_at: new Date().toISOString() })
        .eq("id", invitation.id);

      return new Response(JSON.stringify({ success: true, declined: true }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Accept: mark invitation + add member (also clears any prior declined_at)
    const { error: acceptErr } = await serviceClient
      .from("group_invitations")
      .update({ accepted_at: new Date().toISOString(), declined_at: null })
      .eq("id", invitation.id);

    if (acceptErr) {
      return new Response(JSON.stringify({ error: "Failed to accept invitation" }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Insert member (ignore conflict if already a member)
    await serviceClient
      .from("group_members")
      .upsert({ group_id: invitation.group_id, user_id: caller.id, role: invitation.invited_role ?? "member" }, { onConflict: "group_id,user_id", ignoreDuplicates: true });

    // Mark the in-app invitation notification as read — best-effort
    try {
      await serviceClient
        .from("user_notifications")
        .update({ is_read: true })
        .eq("user_id", caller.id)
        .eq("notification_type", "group_invitation")
        .eq("is_read", false);
    } catch { /* non-fatal */ }

    return new Response(JSON.stringify({ success: true, groupId: invitation.group_id }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Error in accept-group-invitation:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
