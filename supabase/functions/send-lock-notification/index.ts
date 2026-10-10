import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Prefs = Record<string, { in_app?: boolean; email?: boolean }>;

/**
 * Collect all unique user IDs with any access to a project, excluding a specific user.
 * Covers three access paths:
 *  1. Direct: project_collaborators (accepted)
 *  2. Group: project_group_access → group_members
 *  3. Page: project_page_items → project_page_access (accepted)
 *           project_page_items → project_page_group_access → group_members
 */
async function collectProjectMembers(
  serviceClient: any,
  projectId: string,
  ownerId: string,
  excludeUserId: string,
): Promise<string[]> {
  const seen = new Set<string>();
  const result: string[] = [];

  const add = (uid: string | null | undefined) => {
    if (uid && uid !== excludeUserId && !seen.has(uid)) {
      seen.add(uid);
      result.push(uid);
    }
  };

  // 1. Project owner
  add(ownerId);

  // 2. Direct collaborators
  const { data: directCollabs } = await serviceClient
    .from("project_collaborators")
    .select("user_id")
    .eq("project_id", projectId)
    .not("accepted_at", "is", null);
  if (directCollabs) for (const c of directCollabs) add(c.user_id);

  // 3. Group-based access
  const { data: groupAccess } = await serviceClient
    .from("project_group_access")
    .select("group_id")
    .eq("project_id", projectId);
  if (groupAccess?.length) {
    const groupIds = groupAccess.map((g: any) => g.group_id);
    const { data: gMembers } = await serviceClient
      .from("group_members")
      .select("user_id")
      .in("group_id", groupIds);
    if (gMembers) for (const m of gMembers) add(m.user_id);
  }

  // 4. Page-based access
  const { data: pageItems } = await serviceClient
    .from("project_page_items")
    .select("page_id")
    .eq("project_id", projectId);
  if (pageItems?.length) {
    const pageIds = pageItems.map((p: any) => p.page_id);

    // Individual page access (accepted invitations)
    const { data: pageAccess } = await serviceClient
      .from("project_page_access")
      .select("user_id")
      .in("page_id", pageIds)
      .not("accepted_at", "is", null);
    if (pageAccess) for (const p of pageAccess) add(p.user_id);

    // Group-based page access
    const { data: pgAccess } = await serviceClient
      .from("project_page_group_access")
      .select("group_id")
      .in("page_id", pageIds);
    if (pgAccess?.length) {
      const pgGroupIds = pgAccess.map((g: any) => g.group_id);
      const { data: pgMembers } = await serviceClient
        .from("group_members")
        .select("user_id")
        .in("group_id", pgGroupIds);
      if (pgMembers) for (const m of pgMembers) add(m.user_id);
    }
  }

  return result;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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

    const { projectId, action } = await req.json(); // action: 'locked' | 'unlocked'
    if (!projectId || !action) {
      return new Response(JSON.stringify({ error: "projectId and action are required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch project info
    const { data: project } = await serviceClient
      .from("canvas_projects")
      .select("name, user_id")
      .eq("id", projectId)
      .single();

    if (!project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch caller's display name
    const { data: callerProfile } = await serviceClient
      .from("profiles")
      .select("full_name")
      .eq("id", caller.id)
      .single();

    const callerName = callerProfile?.full_name ?? "A BioSketch user";

    // Collect all project members to notify, excluding the caller (via all access paths)
    const targetUserIds = await collectProjectMembers(
      serviceClient,
      projectId,
      project.user_id,
      caller.id,
    );

    if (targetUserIds.length === 0) {
      return new Response(JSON.stringify({ success: true, notified: false }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const subject = action === "locked"
      ? `${callerName} locked "${project.name}"`
      : `${callerName} unlocked "${project.name}"`;

    const message = action === "locked"
      ? `${callerName} has locked the project. Editing is temporarily disabled.`
      : `${callerName} has unlocked the project. Editing is now available.`;

    const link = `/canvas/${projectId}`;
    const notifType = "project_locked";

    let notifiedCount = 0;

    for (const targetUserId of targetUserIds) {
      // Fetch this user's notification preferences
      const { data: targetProfile } = await serviceClient
        .from("profiles")
        .select("notification_preferences")
        .eq("id", targetUserId)
        .single();

      const prefs = ((targetProfile?.notification_preferences ?? {}) as Prefs);
      const inAppEnabled = prefs[notifType]?.in_app !== false; // default true

      if (inAppEnabled) {
        await serviceClient.from("user_notifications").insert({
          user_id: targetUserId,
          notification_type: notifType,
          subject,
          message,
          sender_name: callerName,
          link,
          sent_via_email: false,
        });
        notifiedCount++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, notified: notifiedCount > 0, count: notifiedCount }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: any) {
    console.error("Error in send-lock-notification:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
