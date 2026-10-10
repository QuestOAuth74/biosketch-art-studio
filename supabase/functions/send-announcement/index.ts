import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnnouncementRequest {
  subject: string;
  message: string;
  senderName: string;
  targetAudience: "all" | "premium" | "new";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Check if user is admin
    const { data: roles } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!roles || roles.role !== "admin") {
      throw new Error("Admin access required");
    }

    const { subject, message, senderName, targetAudience }: AnnouncementRequest = await req.json();

    // Build query based on target audience
    let userQuery = supabaseClient.from("profiles").select("id");

    if (targetAudience === "premium") {
      // Users with 3+ approved public projects
      const { data: premiumUsers } = await supabaseClient
        .from("canvas_projects")
        .select("user_id")
        .eq("is_public", true)
        .eq("approval_status", "approved");

      if (premiumUsers) {
        const userCounts = premiumUsers.reduce((acc: Record<string, number>, project) => {
          acc[project.user_id] = (acc[project.user_id] || 0) + 1;
          return acc;
        }, {});

        const premiumUserIds = Object.entries(userCounts)
          .filter(([_, count]) => count >= 3)
          .map(([userId]) => userId);

        userQuery = userQuery.in("id", premiumUserIds);
      }
    } else if (targetAudience === "new") {
      // Users who joined in the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      userQuery = userQuery.gte("created_at", sevenDaysAgo.toISOString());
    }

    const { data: targetUsers, error: usersError } = await userQuery;

    if (usersError) throw usersError;

    if (!targetUsers || targetUsers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create notifications for all target users
    const notifications = targetUsers.map((profile) => ({
      user_id: profile.id,
      subject,
      message,
      sender_name: senderName,
      is_read: false,
      sent_via_email: false,
    }));

    const { error: insertError } = await supabaseClient
      .from("user_notifications")
      .insert(notifications);

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ success: true, count: targetUsers.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error sending announcement:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
