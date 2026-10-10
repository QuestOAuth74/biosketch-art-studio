import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type GenerationMode = 'admin' | 'trial' | 'trial-exhausted' | 'monthly';

export interface GenerationUsage {
  canGenerate: boolean;
  isAdmin: boolean;
  hasPremium: boolean;
  mode?: GenerationMode;
  used: number;
  limit: number | null;
  remaining: number | null;
  trialRemaining?: number | null;
  monthYear: string;
  approvedCount?: number;
  needsApproved?: number;
  profileBonus?: number;
}

export const useAIGenerationUsage = () => {
  const { user } = useAuth();

  const { data: usage, isLoading, error, refetch } = useQuery({
    queryKey: ['ai-generation-usage', user?.id],
    queryFn: async (): Promise<GenerationUsage> => {
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .rpc('can_user_generate', { _user_id: user.id });

      if (error) {
        console.error('Error fetching generation usage:', error);
        throw error;
      }

      return data as unknown as GenerationUsage;
    },
    enabled: !!user,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });

  return {
    usage,
    isLoading,
    error,
    refetch,
  };
};
