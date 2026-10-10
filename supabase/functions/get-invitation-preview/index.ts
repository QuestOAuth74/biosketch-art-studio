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
    const { token, type } = await req.json();

    if (!token || !type) {
      return new Response(JSON.stringify({ error: "token and type are required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (type !== "group" && type !== "project" && type !== "page") {
      return new Response(JSON.stringify({ error: "type must be 'group', 'project', or 'page'" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (type === "group") {
      const { data, error } = await serviceClient
        .from("group_invitations")
        .select("expires_at, accepted_at, groups(name), profiles!invited_by(full_name)")
        .eq("token", token)
        .maybeSingle();

      if (error || !data) {
        return new Response(JSON.stringify({ error: "Invitation not found" }), {
          status: 404, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      return new Response(JSON.stringify({
        groupName: (data.groups as any)?.name ?? null,
        inviterName: (data.profiles as any)?.full_name ?? null,
        expiresAt: data.expires_at,
        acceptedAt: data.accepted_at,
      }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    if (type === "project") {
      const { data, error } = await serviceClient
        .from("project_collaborators")
        .select("accepted_at, permission, invited_by, canvas_projects(name)")
        .eq("invitation_token", token)
        .maybeSingle();

      if (error || !data) {
        return new Response(JSON.stringify({ error: "Invitation not found" }), {
          status: 404, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const { data: inviterProfile } = await serviceClient
        .from("profiles")
        .select("full_name")
        .eq("id", data.invited_by)
        .maybeSingle();

      return new Response(JSON.stringify({
        projectName: (data.canvas_projects as any)?.name ?? null,
        inviterName: inviterProfile?.full_name ?? null,
        permission: data.permission,
        acceptedAt: data.accepted_at,
      }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // type === "page"
    const { data, error } = await serviceClient
      .from("project_page_access")
      .select("accepted_at, permission, invited_by, project_pages(name)")
      .eq("invitation_token", token)
      .maybeSingle();

    if (error || !data) {
      return new Response(JSON.stringify({ error: "Invitation not found" }), {
        status: 404, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: inviterProfile } = await serviceClient
      .from("profiles")
      .select("full_name")
      .eq("id", data.invited_by)
      .maybeSingle();

    return new Response(JSON.stringify({
      pageName: (data.project_pages as any)?.name ?? null,
      inviterName: inviterProfile?.full_name ?? null,
      permission: data.permission,
      acceptedAt: data.accepted_at,
    }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });

  } catch (error: any) {
    console.error("Error in get-invitation-preview:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
