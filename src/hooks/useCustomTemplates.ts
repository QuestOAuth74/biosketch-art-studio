import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CustomTemplate } from '@/types/powerpoint';
import { toast } from 'sonner';

export const useCustomTemplates = () => {
  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useQuery({
    queryKey: ['custom-powerpoint-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('powerpoint_custom_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as CustomTemplate[];
    },
  });

  const createTemplate = useMutation({
    mutationFn: async (template: Omit<CustomTemplate, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('powerpoint_custom_templates')
        .insert({
          name: template.name,
          description: template.description,
          colors: template.colors as any,
          fonts: template.fonts as any,
          layouts: template.layouts as any,
          quote_styles: template.quote_styles as any,
          image_layouts: template.image_layouts as any,
          is_default: template.is_default,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-powerpoint-templates'] });
      toast.success('Template created successfully');
    },
    onError: (error: any) => {
      console.error('Error creating template:', error);
      toast.error(`Failed to create template: ${error.message}`);
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, template }: { id: string; template: Partial<CustomTemplate> }) => {
      const { error } = await supabase
        .from('powerpoint_custom_templates')
        .update({
          name: template.name,
          description: template.description,
          colors: template.colors as any,
          fonts: template.fonts as any,
          layouts: template.layouts as any,
          quote_styles: template.quote_styles as any,
          image_layouts: template.image_layouts as any,
          is_default: template.is_default,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-powerpoint-templates'] });
      toast.success('Template updated successfully');
    },
    onError: (error: any) => {
      console.error('Error updating template:', error);
      toast.error(`Failed to update template: ${error.message}`);
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('powerpoint_custom_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-powerpoint-templates'] });
      toast.success('Template deleted successfully');
    },
    onError: (error: any) => {
      console.error('Error deleting template:', error);
      toast.error(`Failed to delete template: ${error.message}`);
    },
  });

  return {
    templates,
    isLoading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  };
};