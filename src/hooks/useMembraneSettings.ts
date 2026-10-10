import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MembraneDefaultSettings {
  default_icon_id: string | null;
  default_icon_size: number;
  default_spacing: number;
  default_rotate_to_path: boolean;
  default_double_sided: boolean;
  default_orientation_offset: number;
}

export const useMembraneSettings = () => {
  const queryClient = useQueryClient();

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['membrane-settings'],
    queryFn: async (): Promise<MembraneDefaultSettings | null> => {
      const { data, error } = await supabase
        .from('ai_provider_settings')
        .select('setting_value')
        .eq('setting_key', 'membrane_defaults')
        .maybeSingle();

      if (error) {
        console.error('Error fetching membrane settings:', error);
        return null;
      }

      if (!data) {
        return null;
      }

      return data.setting_value as unknown as MembraneDefaultSettings;
    },
  });

  const updateSettings = useMutation({
    mutationFn: async (newSettings: Partial<MembraneDefaultSettings>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Merge with existing settings (or use newSettings if no existing settings)
      const merged = { ...settings, ...newSettings };

      // Use upsert to insert or update the row
      const { error } = await supabase
        .from('ai_provider_settings')
        .upsert({
          setting_key: 'membrane_defaults',
          setting_value: merged as unknown as any,
          updated_by: user.id,
        }, {
          onConflict: 'setting_key'
        });

      if (error) {
        console.error('Error saving membrane settings:', error);
        throw error;
      }

      return merged;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membrane-settings'] });
      toast.success('Membrane defaults updated successfully');
    },
    onError: (error: any) => {
      console.error('Error updating membrane settings:', error);
      toast.error(error.message || 'Failed to update membrane defaults');
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
