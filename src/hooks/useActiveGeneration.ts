import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useActiveGeneration() {
  return useQuery({
    queryKey: ['active-powerpoint-generation'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('powerpoint_generations')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'processing')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as {
        id: string;
        status: string | null;
        current_step: string | null;
        error_message: string | null;
        storage_path: string;
        generated_filename: string;
        original_filename: string;
      } | null;
    },
    staleTime: 0, // Always refetch on mount — don't serve stale "no generation" cache
    refetchOnMount: true,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === 'processing') return 3000;
      // Even when null, poll every 5s so we pick up newly started generations
      return 5000;
    },
  });
}
