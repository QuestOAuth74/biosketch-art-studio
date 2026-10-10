import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const FREE_PROJECT_LIMIT = 10;

export interface ProjectLimitStatus {
  totalProjects: number;
  limit: number;
  canCreateMore: boolean;
  isPremiumOrAdmin: boolean;
  isLoading: boolean;
}

export const useProjectLimit = () => {
  const { user, isAdmin } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["project-limit", user?.id],
    queryFn: async () => {
      if (!user) return { total: 0, hasPremium: false };

      // Count user's total projects
      const { count, error: countError } = await supabase
        .from("canvas_projects")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (countError) {
        console.error("Project count error:", countError);
        throw countError;
      }

      // Check premium access (3+ approved public projects)
      let hasPremium = false;
      try {
        const { data: premiumData, error: premiumError } = await supabase.rpc(
          "get_user_premium_progress",
          { check_user_id: user.id }
        );
        if (!premiumError && premiumData && premiumData.length > 0) {
          hasPremium = premiumData[0].has_access;
        }
      } catch {
        // If RPC fails, default to no premium
      }

      return { total: count || 0, hasPremium };
    },
    enabled: !!user,
    staleTime: 30 * 1000, // 30 seconds — refresh frequently since saves change the count
    retry: 1,
  });

  const totalProjects = data?.total || 0;
  const isPremiumOrAdmin = isAdmin || (data?.hasPremium ?? false);
  const canCreateMore = isPremiumOrAdmin || totalProjects < FREE_PROJECT_LIMIT;

  return {
    totalProjects,
    limit: FREE_PROJECT_LIMIT,
    canCreateMore,
    isPremiumOrAdmin,
    isLoading,
  };
};
