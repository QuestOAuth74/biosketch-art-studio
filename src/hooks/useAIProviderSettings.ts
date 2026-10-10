import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AIProviderSettings {
  primary_provider: 'manus' | 'lovable';
  fallback_enabled: boolean;
  timeout_ms: number;
  generation_mode: 'full' | 'structure';
}

export const useAIProviderSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['ai-provider-settings'],
    queryFn: async (): Promise<AIProviderSettings> => {
      const { data, error } = await supabase
        .from('ai_provider_settings')
        .select('setting_value')
        .eq('setting_key', 'powerpoint_generation')
        .single();

      if (error) {
        console.error('Error fetching AI settings:', error);
        throw error;
      }

      return data.setting_value as unknown as AIProviderSettings;
    },
  });

  const updateSettings = useMutation({
    mutationFn: async (newSettings: AIProviderSettings) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('ai_provider_settings')
        .update({
          setting_value: newSettings as unknown as any,
          updated_by: user.id,
        })
        .eq('setting_key', 'powerpoint_generation');

      if (error) throw error;
      return newSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-provider-settings'] });
      toast({
        title: 'Settings updated',
        description: 'AI provider preferences have been saved successfully.',
      });
    },
    onError: (error: any) => {
      console.error('Error updating AI provider settings:', error);
      toast({
        title: 'Update failed',
        description: error.message || 'Failed to update AI provider settings.',
        variant: 'destructive',
      });
    },
  });

  return {
    settings,
    isLoading,
    error,
    updateSettings: updateSettings.mutate,
    isUpdating: updateSettings.isPending,
  };
};
