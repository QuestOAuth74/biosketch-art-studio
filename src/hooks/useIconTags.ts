import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { IconTag, TagStatistics, TagUpdateRequest } from '@/types/tags';

export const useIconTags = () => {
  const queryClient = useQueryClient();

  // Fetch all unique tags with usage counts
  const { data: allTags = [], isLoading: isLoadingTags } = useQuery({
    queryKey: ['icon-tags'],
    queryFn: async (): Promise<IconTag[]> => {
      const { data: icons, error } = await supabase
        .from('icons')
        .select('tags')
        .not('tags', 'eq', '[]');

      if (error) throw error;

      // Aggregate tags and count usage
      const tagCounts = (icons || [])
        .flatMap(icon => (icon.tags as string[]) || [])
        .reduce((acc, tag) => {
          acc[tag] = (acc[tag] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

      return Object.entries(tagCounts)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count);
    },
  });

  // Fetch tag statistics
  const { data: statistics, isLoading: isLoadingStats } = useQuery({
    queryKey: ['tag-statistics'],
    queryFn: async (): Promise<TagStatistics> => {
      // Get total icon count
      const { count: totalIcons } = await supabase
        .from('icons')
        .select('*', { count: 'exact', head: true });

      // Get icons with tags
      const { data: iconsWithTags, error } = await supabase
        .from('icons')
        .select('tags')
        .not('tags', 'eq', '[]');

      if (error) throw error;

      const taggedIcons = iconsWithTags?.length || 0;
      const allTagsArray = iconsWithTags?.flatMap(icon => (icon.tags as string[]) || []) || [];
      const uniqueTags = new Set(allTagsArray).size;
      const avgTagsPerIcon = (totalIcons || 0) > 0 ? allTagsArray.length / (totalIcons || 1) : 0;

      // Calculate tag frequency
      const tagCounts = allTagsArray.reduce((acc, tag) => {
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const topTags = Object.entries(tagCounts)
        .map(([tag, count]) => ({
          tag,
          count,
          percentage: Math.round((count / (totalIcons || 1)) * 100)
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

      return {
        totalIcons: totalIcons || 0,
        taggedIcons,
        untaggedIcons: (totalIcons || 0) - taggedIcons,
        uniqueTags,
        avgTagsPerIcon: Math.round(avgTagsPerIcon * 100) / 100,
        topTags
      };
    },
  });

  // Update single icon tags
  const updateIconTags = useMutation({
    mutationFn: async ({ id, tags }: TagUpdateRequest) => {
      const { error } = await supabase
        .from('icons')
        .update({ tags })
        .eq('id', id);

      if (error) throw error;
    },
    onMutate: async ({ id, tags }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['admin-icons'] });
      await queryClient.cancelQueries({ queryKey: ['icon-tags'] });
      await queryClient.cancelQueries({ queryKey: ['tag-statistics'] });

      // Snapshot previous values
      const previousAdminIcons = queryClient.getQueriesData({ queryKey: ['admin-icons'] });

      // Optimistically update admin-icons cache
      queryClient.setQueriesData({ queryKey: ['admin-icons'] }, (old: any) => {
        if (!old?.icons) return old;

        return {
          ...old,
          icons: old.icons.map((icon: any) =>
            icon.id === id ? { ...icon, tags } : icon
          )
        };
      });

      return { previousAdminIcons };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-icons'] });
      queryClient.invalidateQueries({ queryKey: ['icon-tags'] });
      queryClient.invalidateQueries({ queryKey: ['tag-statistics'] });
      toast.success('Tags updated');
    },
    onError: (error: any, variables, context) => {
      // Rollback on error
      if (context?.previousAdminIcons) {
        context.previousAdminIcons.forEach(([queryKey, data]: any) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast.error(error.message || 'Failed to update tags');
    },
  });

  // Batch update icon tags
  const batchUpdateIconTags = useMutation({
    mutationFn: async (updates: TagUpdateRequest[]) => {
      const batchSize = 100;
      const totalBatches = Math.ceil(updates.length / batchSize);
      let totalSuccesses = 0;
      let totalFailures = 0;
      let progressToastId: string | number | undefined;

      // Show persistent progress toast
      if (totalBatches > 1) {
        progressToastId = toast.loading('Processing tag updates...', {
          description: `Batch 0 of ${totalBatches}`,
          duration: Infinity,
        });
      } else {
        progressToastId = toast.loading('Updating tags...', {
          duration: Infinity,
        });
      }

      // Process in batches
      for (let i = 0; i < totalBatches; i++) {
        const batchStart = i * batchSize;
        const batchEnd = Math.min((i + 1) * batchSize, updates.length);
        const batch = updates.slice(batchStart, batchEnd);

        // Update progress toast
        if (totalBatches > 1) {
          toast.loading('Processing tag updates...', {
            id: progressToastId,
            description: `Batch ${i + 1} of ${totalBatches} (${batchEnd}/${updates.length} icons)`,
            duration: Infinity,
          });
        }

        const results = await Promise.allSettled(
          batch.map(({ id, tags }) =>
            supabase.from('icons').update({ tags }).eq('id', id)
          )
        );

        const batchFailures = results.filter(r => r.status === 'rejected').length;
        const batchSuccesses = results.filter(r => r.status === 'fulfilled').length;

        totalSuccesses += batchSuccesses;
        totalFailures += batchFailures;
      }

      // Dismiss progress toast
      if (progressToastId !== undefined) {
        toast.dismiss(progressToastId);
      }

      if (totalFailures > 0) {
        throw new Error(`${totalFailures} icon(s) failed to update`);
      }

      return { successes: totalSuccesses, failures: totalFailures };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-icons'] });
      queryClient.invalidateQueries({ queryKey: ['icon-tags'] });
      queryClient.invalidateQueries({ queryKey: ['tag-statistics'] });
      toast.success(`Successfully updated ${result.successes} icon(s)`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to batch update tags');
    },
  });

  return {
    allTags,
    isLoadingTags,
    statistics,
    isLoadingStats,
    updateIconTags: updateIconTags.mutate,
    batchUpdateIconTags: batchUpdateIconTags.mutate,
    isUpdating: updateIconTags.isPending || batchUpdateIconTags.isPending,
  };
};
