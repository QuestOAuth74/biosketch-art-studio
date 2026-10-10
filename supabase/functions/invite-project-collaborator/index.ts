import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Creates a project_collaborators row keyed on email (not user_id).
// Works for both existing users and new sign-ups — the user_id is resolved when they accept.
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

    const { projectId, email, permission, origin } = await req.json();
    if (!projectId || !email || !permission || !origin) {
      return new Response(JSON.stringify({ error: "projectId, email, permission, and origin are required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Verify caller owns the project
    const { data: isMgr } = await serviceClient.rpc("user_owns_project", {
      check_user_id: caller.id,
      check_project_id: projectId,
    });
    if (!isMgr) {
      return new Response(JSON.stringify({ error: "Forbidden: you don't own this project" }), {
        status: 403, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Check if the invitee is the caller
    const { data: { user: callerFull } } = await serviceClient.auth.admin.getUserById(caller.id);
    if (callerFull?.email?.toLowerCase() === normalizedEmail) {
      return new Response(JSON.stringify({ error: "You cannot invite yourself" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Optionally resolve existing user_id by email (non-blocking — invitation works either way)
    const { data: { users } } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
    const existingUser = users?.find((u) => u.email?.toLowerCase() === normalizedEmail);

    // Insert collaborator row — always stores email; user_id only when account already exists
    const { data: collab, error: insertErr } = await serviceClient
      .from("project_collaborators")
      .insert({
        project_id: projectId,
        email: normalizedEmail,
        user_id: existingUser?.id ?? null,
        permission,
        invited_by: caller.id,
      })
      .select()
      .single();

    if (insertErr) {
      if (insertErr.code === "23505") {
        return new Response(JSON.stringify({ error: "This email is already a collaborator on this project" }), {
          status: 409, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Send invitation email
    await fetch(`${supabaseUrl}/functions/v1/send-project-invitation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        apikey: anonKey,
      },
      body: JSON.stringify({ projectCollaboratorId: collab.id, origin }),
    });

    return new Response(JSON.stringify({ success: true, collaboratorId: collab.id }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in invite-project-collaborator:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
