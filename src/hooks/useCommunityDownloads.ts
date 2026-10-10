import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface DownloadQuota {
  downloadsUsed: number;
  sharedProjects: number;
  hasUnlimited: boolean;
  remainingDownloads: number | null;
  canDownload: boolean;
  projectsUntilUnlimited: number;
}

export const useCommunityDownloads = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch download quota
  const { data: quota, isLoading } = useQuery({
    queryKey: ['download-quota', user?.id],
    queryFn: async (): Promise<DownloadQuota> => {
      if (!user) return { 
        downloadsUsed: 0, 
        sharedProjects: 0, 
        hasUnlimited: false,
        remainingDownloads: 3, 
        canDownload: true,
        projectsUntilUnlimited: 3
      };

      const { data, error } = await supabase
        .rpc('get_user_download_quota', { check_user_id: user.id })
        .single();

      if (error) throw error;
      return {
        downloadsUsed: data.downloads_used,
        sharedProjects: data.shared_projects,
        hasUnlimited: data.has_unlimited,
        remainingDownloads: data.remaining_downloads,
        canDownload: data.can_download,
        projectsUntilUnlimited: data.projects_until_unlimited,
      };
    },
    enabled: !!user,
    staleTime: 60 * 1000, // Cache for 1 minute
  });

  // Check if user owns a project
  const checkOwnership = async (projectId: string): Promise<boolean> => {
    if (!user || !projectId) return false;
    
    const { data, error } = await supabase
      .rpc('check_project_ownership', { 
        check_user_id: user.id, 
        check_project_id: projectId 
      });
    
    if (error) return false;
    return data === true;
  };

  // Record a community download
  const recordDownload = useMutation({
    mutationFn: async ({ projectId, format }: { projectId: string; format: string }) => {
      if (!user) throw new Error('Must be signed in');
      
      const { error } = await supabase
        .from('community_downloads')
        .upsert({
          user_id: user.id,
          project_id: projectId,
          download_format: format,
        }, {
          onConflict: 'user_id,project_id'
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['download-quota', user?.id] });
    },
  });

  return {
    quota: quota || { 
      downloadsUsed: 0, 
      sharedProjects: 0, 
      hasUnlimited: false,
      remainingDownloads: 3, 
      canDownload: true,
      projectsUntilUnlimited: 3
    },
    isLoading,
    checkOwnership,
    recordDownload: recordDownload.mutate,
    isRecording: recordDownload.isPending,
  };
};
