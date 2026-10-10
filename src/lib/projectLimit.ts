import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const FREE_PROJECT_LIMIT = 10;

/**
 * Check whether the user has hit their project limit.
 * Returns `true` if the user is BLOCKED (at or over limit), `false` if they can create.
 * Shows a toast if blocked.
 */
export async function checkProjectLimit(userId: string): Promise<boolean> {
  try {
    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleData) return false; // admin — no limit

    // Check premium (3+ approved public projects)
    try {
      const { data: premiumData } = await supabase.rpc(
        "get_user_premium_progress",
        { check_user_id: userId }
      );
      if (premiumData?.[0]?.has_access) return false; // premium — no limit
    } catch {
      // RPC failure — fall through to count check
    }

    // Count existing projects
    const { count, error } = await supabase
      .from("canvas_projects")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (error) return false; // on error, allow (don't block users due to DB issues)

    if ((count || 0) >= FREE_PROJECT_LIMIT) {
      toast.error("Project limit reached", {
        description:
          "Free accounts can save up to 5 projects. Share 3 projects with the community to unlock unlimited saves.",
        duration: 6000,
      });
      return true; // blocked
    }

    return false; // under limit
  } catch {
    return false; // on unexpected error, allow
  }
}
