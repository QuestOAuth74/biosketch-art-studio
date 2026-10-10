import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Prefs = Record<string, { in_app?: boolean; email?: boolean }>;

/** Check a user's notification preference for a given type. Defaults to true if not set. */
function isInAppEnabled(prefs: Prefs, type: string): boolean {
  return prefs[type]?.in_app !== false;
}
function isEmailEnabled(prefs: Prefs, type: string): boolean {
  return prefs[type]?.email !== false;
}

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

    const { commentId, projectId, isReply } = await req.json();
    if (!commentId || !projectId) {
      return new Response(JSON.stringify({ error: "commentId and projectId are required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch the comment
    const { data: comment, error: commentErr } = await serviceClient
      .from("canvas_comments")
      .select("id, author_id, content, parent_id")
      .eq("id", commentId)
      .single();

    if (commentErr || !comment) {
      return new Response(JSON.stringify({ error: "Comment not found" }), {
        status: 404, headers: { "Content-Type": "application/json", ...corsHeaders },
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

    // Fetch comment author name
    const { data: authorProfile } = await serviceClient
      .from("profiles")
      .select("full_name")
      .eq("id", comment.author_id)
      .single();

    const authorName = authorProfile?.full_name ?? "A BioSketch user";

    // Determine recipients
    let targetUserIds: string[];
    let notifType: string;

    if (!isReply) {
      // New top-level comment → notify all project members except the commenter
      notifType = "comment_new";
      targetUserIds = await collectProjectMembers(
        serviceClient,
        projectId,
        project.user_id,
        comment.author_id,
      );
    } else {
      // Reply → notify only the parent comment's author (if not self)
      notifType = "comment_reply";
      targetUserIds = [];
      if (comment.parent_id) {
        const { data: parentComment } = await serviceClient
          .from("canvas_comments")
          .select("author_id")
          .eq("id", comment.parent_id)
          .single();

        if (parentComment && parentComment.author_id !== comment.author_id) {
          targetUserIds.push(parentComment.author_id);
        }
      }
    }

    if (targetUserIds.length === 0) {
      return new Response(JSON.stringify({ success: true, notified: false }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const subject = isReply
      ? `${authorName} replied to your comment on "${project.name}"`
      : `New comment on "${project.name}"`;

    const message = `${authorName}: "${comment.content.slice(0, 200)}${comment.content.length > 200 ? "…" : ""}"`;
    const link = `/canvas/${projectId}`;

    // Fetch auth users once for email lookups
    const { data: { users: authUsers } } = await serviceClient.auth.admin.listUsers();

    let notifiedCount = 0;

    for (const targetUserId of targetUserIds) {
      // Fetch this user's notification preferences
      const { data: targetProfile } = await serviceClient
        .from("profiles")
        .select("notification_preferences")
        .eq("id", targetUserId)
        .single();

      const prefs = ((targetProfile?.notification_preferences ?? {}) as Prefs);

      // In-app notification: insert directly (service role bypasses RLS)
      if (isInAppEnabled(prefs, notifType)) {
        await serviceClient.from("user_notifications").insert({
          user_id: targetUserId,
          notification_type: notifType,
          subject,
          message,
          sender_name: authorName,
          link,
          sent_via_email: false,
        });
        notifiedCount++;
      }

      // Email notification
      if (isEmailEnabled(prefs, notifType)) {
        const targetAuthUser = authUsers?.find((u: any) => u.id === targetUserId);
        const targetEmail = targetAuthUser?.email;

        if (targetEmail && resendApiKey) {
          const emailHtml = `
            <!DOCTYPE html><html><head><meta charset="utf-8"></head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #f6f9fc; padding: 32px 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: #1a1a1a; margin: 0; font-size: 24px;">BioSketch</h1>
              </div>
              <div style="background: white; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                <h2 style="color: #1f2937; margin-top: 0; font-size: 18px;">${subject}</h2>
                <blockquote style="border-left: 3px solid #6366f1; padding-left: 12px; color: #4b5563; margin: 16px 0; font-style: italic;">
                  ${comment.content.slice(0, 500)}${comment.content.length > 500 ? "…" : ""}
                </blockquote>
                <p style="color: #6b7280; font-size: 14px;">Open BioSketch to view and reply to this comment.</p>
              </div>
              <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
                <p>BioSketch • <a href="https://biosketch.art" style="color: #667eea;">biosketch.art</a></p>
              </div>
            </body></html>
          `;

          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ from: fromEmail, to: [targetEmail], subject, html: emailHtml }),
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, notified: notifiedCount > 0, count: notifiedCount }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: any) {
    console.error("Error in send-comment-notification:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
