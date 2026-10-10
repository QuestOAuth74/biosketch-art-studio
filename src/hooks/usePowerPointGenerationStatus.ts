import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function usePowerPointGenerationStatus(generationId: string | null) {
  return useQuery({
    queryKey: ['powerpoint-generation-status', generationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('powerpoint_generations')
        .select('*')
        .eq('id', generationId!)
        .single();

      if (error) throw error;
      return data as {
        id: string;
        status: string | null;
        current_step: string | null;
        error_message: string | null;
        storage_path: string;
        generated_filename: string;
        original_filename: string;
      };
    },
    enabled: !!generationId,
    staleTime: 0,
    refetchOnMount: true,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'completed' || status === 'failed' ? false : 3000;
    },
  });
}
