import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MembraneIcon {
  id: string;
  name: string;
  thumbnail: string | null;
  is_default_membrane_icon: boolean;
}

export const useMembraneIcons = () => {
  const queryClient = useQueryClient();

  // Fetch all membrane icons
  const { data: membraneIcons = [], isLoading } = useQuery({
    queryKey: ['membrane-icons'],
    queryFn: async (): Promise<MembraneIcon[]> => {
      const { data, error } = await supabase
        .from('icons')
        .select('id, name, thumbnail, is_default_membrane_icon')
        .eq('is_membrane_icon', true)
        .order('name');

      if (error) throw error;
      return data || [];
    },
  });

  // Toggle membrane icon status with optimistic updates
  const toggleMembraneIcon = useMutation({
    mutationFn: async ({ iconId, isMembrane }: { iconId: string; isMembrane: boolean }) => {
      const { error } = await supabase
        .from('icons')
        .update({
          is_membrane_icon: isMembrane,
          // If unmarking as membrane icon, also unset default
          is_default_membrane_icon: isMembrane ? undefined : false
        })
        .eq('id', iconId);

      if (error) throw error;
    },
    onMutate: async ({ iconId, isMembrane }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['admin-icons'] });
      await queryClient.cancelQueries({ queryKey: ['membrane-icons'] });

      // Snapshot the previous values
      const previousAdminIcons = queryClient.getQueriesData({ queryKey: ['admin-icons'] });
      const previousMembraneIcons = queryClient.getQueryData(['membrane-icons']);

      // Optimistically update admin-icons cache
      queryClient.setQueriesData({ queryKey: ['admin-icons'] }, (old: any) => {
        if (!old?.icons) return old;

        return {
          ...old,
          icons: old.icons.map((icon: any) =>
            icon.id === iconId
              ? {
                  ...icon,
                  is_membrane_icon: isMembrane,
                  is_default_membrane_icon: isMembrane ? icon.is_default_membrane_icon : false
                }
              : icon
          )
        };
      });

      // Return context for rollback
      return { previousAdminIcons, previousMembraneIcons };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membrane-icons'] });
      queryClient.invalidateQueries({ queryKey: ['admin-icons'] });
      toast.success('Membrane icon status updated');
    },
    onError: (error: any, variables, context) => {
      // Rollback on error
      if (context?.previousAdminIcons) {
        context.previousAdminIcons.forEach(([queryKey, data]: any) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousMembraneIcons) {
        queryClient.setQueryData(['membrane-icons'], context.previousMembraneIcons);
      }
      toast.error(error.message || 'Failed to update membrane icon');
    },
  });

  // Batch toggle membrane icons
  const batchToggleMembraneIcons = useMutation({
    mutationFn: async ({ iconIds, isMembrane }: { iconIds: string[]; isMembrane: boolean }) => {
      const updates = iconIds.map(iconId =>
        supabase
          .from('icons')
          .update({
            is_membrane_icon: isMembrane,
            is_default_membrane_icon: isMembrane ? undefined : false
          })
          .eq('id', iconId)
      );

      const results = await Promise.allSettled(updates);
      const failures = results.filter(r => r.status === 'rejected').length;

      if (failures > 0) {
        throw new Error(`${failures} icon(s) failed to update`);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['membrane-icons'] });
      queryClient.invalidateQueries({ queryKey: ['admin-icons'] });
      toast.success(`${variables.iconIds.length} icon(s) ${variables.isMembrane ? 'marked' : 'unmarked'} as membrane icons`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to batch update icons');
    },
  });

  // Set default membrane icon with optimistic updates
  const setDefaultMembraneIcon = useMutation({
    mutationFn: async (iconId: string) => {
      // First, unset all other defaults
      const { error: unsetError } = await supabase
        .from('icons')
        .update({ is_default_membrane_icon: false })
        .eq('is_default_membrane_icon', true)
        .neq('id', iconId);

      if (unsetError) {
        console.warn('Error unsetting previous defaults:', unsetError);
      }

      // Then set this icon as the default
      const { error } = await supabase
        .from('icons')
        .update({
          is_membrane_icon: true, // Ensure it's marked as membrane icon
          is_default_membrane_icon: true
        })
        .eq('id', iconId);

      if (error) throw error;
    },
    onMutate: async (iconId: string) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['admin-icons'] });
      await queryClient.cancelQueries({ queryKey: ['membrane-icons'] });

      // Snapshot the previous values
      const previousAdminIcons = queryClient.getQueriesData({ queryKey: ['admin-icons'] });
      const previousMembraneIcons = queryClient.getQueryData(['membrane-icons']);

      // Optimistically update admin-icons cache
      queryClient.setQueriesData({ queryKey: ['admin-icons'] }, (old: any) => {
        if (!old?.icons) return old;

        return {
          ...old,
          icons: old.icons.map((icon: any) => ({
            ...icon,
            // Set this icon as default and ensure it's a membrane icon
            is_default_membrane_icon: icon.id === iconId,
            is_membrane_icon: icon.id === iconId ? true : icon.is_membrane_icon
          }))
        };
      });

      // Optimistically update membrane-icons cache
      queryClient.setQueryData(['membrane-icons'], (old: any) => {
        if (!old) return old;
        return old.map((icon: any) => ({
          ...icon,
          is_default_membrane_icon: icon.id === iconId
        }));
      });

      // Return context for rollback
      return { previousAdminIcons, previousMembraneIcons };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membrane-icons'] });
      queryClient.invalidateQueries({ queryKey: ['admin-icons'] });
      queryClient.invalidateQueries({ queryKey: ['membrane-settings'] });
      toast.success('Default membrane icon updated');
    },
    onError: (error: any, variables, context) => {
      // Rollback on error
      if (context?.previousAdminIcons) {
        context.previousAdminIcons.forEach(([queryKey, data]: any) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousMembraneIcons) {
        queryClient.setQueryData(['membrane-icons'], context.previousMembraneIcons);
      }
      toast.error(error.message || 'Failed to set default membrane icon');
    },
  });

  // Unset default membrane icon
  const unsetDefaultMembraneIcon = useMutation({
    mutationFn: async (iconId: string) => {
      const { error } = await supabase
        .from('icons')
        .update({ is_default_membrane_icon: false })
        .eq('id', iconId);

      if (error) throw error;
    },
    onMutate: async (iconId: string) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['admin-icons'] });
      await queryClient.cancelQueries({ queryKey: ['membrane-icons'] });

      // Snapshot the previous values
      const previousAdminIcons = queryClient.getQueriesData({ queryKey: ['admin-icons'] });
      const previousMembraneIcons = queryClient.getQueryData(['membrane-icons']);

      // Optimistically update admin-icons cache
      queryClient.setQueriesData({ queryKey: ['admin-icons'] }, (old: any) => {
        if (!old?.icons) return old;

        return {
          ...old,
          icons: old.icons.map((icon: any) => ({
            ...icon,
            is_default_membrane_icon: icon.id === iconId ? false : icon.is_default_membrane_icon
          }))
        };
      });

      // Optimistically update membrane-icons cache
      queryClient.setQueryData(['membrane-icons'], (old: any) => {
        if (!old) return old;
        return old.map((icon: any) => ({
          ...icon,
          is_default_membrane_icon: icon.id === iconId ? false : icon.is_default_membrane_icon
        }));
      });

      // Return context for rollback
      return { previousAdminIcons, previousMembraneIcons };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membrane-icons'] });
      queryClient.invalidateQueries({ queryKey: ['admin-icons'] });
      queryClient.invalidateQueries({ queryKey: ['membrane-settings'] });
      toast.success('Default membrane icon removed');
    },
    onError: (error: any, variables, context) => {
      // Rollback on error
      if (context?.previousAdminIcons) {
        context.previousAdminIcons.forEach(([queryKey, data]: any) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousMembraneIcons) {
        queryClient.setQueryData(['membrane-icons'], context.previousMembraneIcons);
      }
      toast.error(error.message || 'Failed to remove default membrane icon');
    },
  });

  return {
    membraneIcons,
    isLoading,
    toggleMembraneIcon: toggleMembraneIcon.mutate,
    batchToggleMembraneIcons: batchToggleMembraneIcons.mutate,
    setDefaultMembraneIcon: setDefaultMembraneIcon.mutate,
    unsetDefaultMembraneIcon: unsetDefaultMembraneIcon.mutate,
    isUpdating: toggleMembraneIcon.isPending || batchToggleMembraneIcons.isPending || setDefaultMembraneIcon.isPending || unsetDefaultMembraneIcon.isPending,
  };
};
