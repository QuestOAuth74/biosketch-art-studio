import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export interface FeatureAccessStatus {
  hasAccess: boolean;
  approvedCount: number;
  remaining: number;
  isLoading: boolean;
}

export const useFeatureAccess = () => {
  const { user } = useAuth();

  const {
    data,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: ["feature-access", user?.id],
    queryFn: async () => {
      if (!user) return { approved_count: 0, has_access: false, remaining: 3 };

      try {
        const { data, error } = await supabase.rpc(
          "get_user_premium_progress",
          { check_user_id: user.id }
        );

        if (error) {
          console.error("RPC Error details:", error);
          throw error;
        }

        // RPC returns array with one row, handle edge cases
        if (!data || data.length === 0) {
          console.warn("RPC returned no data, using defaults");
          return { approved_count: 0, has_access: false, remaining: 3 };
        }

        return data[0];
      } catch (err) {
        console.error("Feature access query failed:", err);
        throw err;
      }
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1,
  });

  if (queryError) {
    console.error("Query error in useFeatureAccess:", queryError);
  }

  return {
    hasAccess: data?.has_access || false,
    approvedCount: Number(data?.approved_count || 0),
    remaining: Number(data?.remaining || 3),
    isLoading,
  };
};
