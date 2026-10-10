import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AiGateInfo {
  /** True while the user is inside the 24h onboarding wait, non-admin, non-purchaser. */
  locked: boolean;
  /** ISO timestamp when the gate lifts. Null when locked is false or unknown. */
  unlock_at: string | null;
}

export interface GenerationBalance {
  approved_count: number;   // number of admin-approved shared projects
  monthly_grant: number;    // free generations per rolling 30d for this tier
  grant_used: number;       // how many grant-sourced generations were used in the window
  grant_remaining: number;  // monthly_grant - grant_used (never negative)
  purchased: number;        // Stripe-purchased balance
  total_available: number;  // grant_remaining + purchased
  gate: AiGateInfo;         // 24h onboarding wait — see useAiGate() for consumption
}

/**
 * Reads the current user's AI-generation balance from the DB.
 * Cached for 30s so the balance pill and dialog don't refetch on every mount.
 */
export const useGenerationBalance = () => {
  const { user } = useAuth();
  return useQuery<GenerationBalance>({
    queryKey: ['generation-balance', user?.id],
    enabled: !!user?.id,
    // Short staleTime + always-refetch-on-mount so canvas AI generators reflect
    // credits granted from a Stripe webhook that landed in another tab, or
    // from a previous purchase that hasn't cache-busted yet.
    staleTime: 10_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_ai_generation_balance', {
        p_user_id: user!.id,
      });
      if (error) throw error;
      return data as GenerationBalance;
    },
  });
};
