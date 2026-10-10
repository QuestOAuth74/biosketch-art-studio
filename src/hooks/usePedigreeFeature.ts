import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePedigreeFeature() {
  const { data: enabled = false } = useQuery({
    queryKey: ["pedigree-feature-visibility"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("setting_value")
        .eq("setting_key", "pedigree_feature")
        .maybeSingle();
      if (error || !data) return false;
      return (data.setting_value as any)?.enabled === true;
    },
    staleTime: 5 * 60 * 1000,
  });

  return enabled;
}
