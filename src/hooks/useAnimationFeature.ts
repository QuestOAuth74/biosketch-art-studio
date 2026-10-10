import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/** Returns whether the animation feature is visible to the current user. Admins always see it. */
export function useAnimationFeature() {
  const { isAdmin } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAdmin) {
      setEnabled(true);
      setLoading(false);
      return;
    }

    const fetch = async () => {
      try {
        const { data, error } = await supabase
          .from("site_settings")
          .select("setting_value")
          .eq("setting_key", "animation_feature")
          .single();

        if (error) throw error;
        const value = data?.setting_value as unknown as { enabled: boolean };
        setEnabled(value?.enabled ?? false);
      } catch {
        setEnabled(false);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [isAdmin]);

  return { animationEnabled: enabled, loading };
}
