import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LastSignup {
  country: string | null;
  field_of_study: string | null;
  created_at: string | null;
}

export const useRecentSignups = () => {
  return useQuery({
    queryKey: ["recent-signups"],
    queryFn: async (): Promise<LastSignup | null> => {
      const { data, error } = await supabase.rpc("get_latest_signup");

      if (error || !data || data.length === 0) {
        if (error) console.error("Error fetching last signup:", error);
        return null;
      }

      return data[0];
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
};
