import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isThumbnailStale, regenerateThumbnail, markThumbnailVersionCurrent } from '@/lib/thumbnailUtils';

interface Project {
  id: string;
  user_id: string;
  thumbnail_url: string | null;
  thumbnail_updated_at: string | null;
  updated_at: string;
  canvas_width: number;
  canvas_height: number;
}

interface ThumbnailState {
  isRegenerating: boolean;
  error: boolean;
}

export function useLazyThumbnails(projects: Project[], currentUserId?: string) {
  const [thumbnailStates, setThumbnailStates] = useState<Record<string, ThumbnailState>>({});
  const [regeneratedThumbnails, setRegeneratedThumbnails] = useState<Record<string, string>>({});

  /**
   * Regenerate a single thumbnail in the background
   */
  const regenerateProjectThumbnail = useCallback(async (project: Project) => {
    // Mark as regenerating
    setThumbnailStates(prev => ({
      ...prev,
      [project.id]: { isRegenerating: true, error: false }
    }));

    try {
      // Fetch full canvas data (not loaded in initial project list)
      const { data, error } = await supabase
        .from('canvas_projects')
        .select('canvas_data')
        .eq('id', project.id)
        .single();

      if (error || !data) {
        throw new Error('Failed to fetch canvas data');
      }

      const newThumbnailUrl = await regenerateThumbnail(
        project.id,
        project.user_id,
        data.canvas_data,
        project.canvas_width,
        project.canvas_height
      );

      if (newThumbnailUrl) {
        setRegeneratedThumbnails(prev => ({
          ...prev,
          [project.id]: newThumbnailUrl
        }));

        setThumbnailStates(prev => ({
          ...prev,
          [project.id]: { isRegenerating: false, error: false }
        }));
      } else {
        throw new Error('Thumbnail generation returned null');
      }
    } catch (error) {
      console.error(`Failed to regenerate thumbnail for project ${project.id}:`, error);
      setThumbnailStates(prev => ({
        ...prev,
        [project.id]: { isRegenerating: false, error: true }
      }));
    }
  }, []);

  /**
   * Automatically regenerate stale thumbnails on mount
   */
  useEffect(() => {
    const staleProjects = projects.filter(project =>
      // Only regenerate thumbnails for projects the current user owns.
      // Attempting to write a thumbnail for another user's project fails with
      // a storage permission error and shows the "Update failed" badge.
      (!currentUserId || project.user_id === currentUserId) &&
      isThumbnailStale(
        project.thumbnail_url,
        project.thumbnail_updated_at,
        project.updated_at
      )
    );

    // Regenerate stale thumbnails progressively (with delay to avoid overwhelming)
    staleProjects.forEach((project, index) => {
      setTimeout(() => {
        regenerateProjectThumbnail(project);
      }, index * 1000); // 1 second delay between each
    });

    // After all stale thumbnails are queued, mark the version as current
    if (staleProjects.length > 0) {
      setTimeout(() => {
        markThumbnailVersionCurrent();
      }, staleProjects.length * 1000 + 2000);
    } else {
      markThumbnailVersionCurrent();
    }
  }, [projects, regenerateProjectThumbnail]);

  /**
   * Get the current thumbnail URL (regenerated or original)
   */
  const getThumbnailUrl = useCallback((projectId: string, originalUrl: string | null) => {
    return regeneratedThumbnails[projectId] || originalUrl;
  }, [regeneratedThumbnails]);

  /**
   * Check if a thumbnail is currently regenerating
   */
  const isRegenerating = useCallback((projectId: string) => {
    return thumbnailStates[projectId]?.isRegenerating || false;
  }, [thumbnailStates]);

  /**
   * Check if a thumbnail has an error
   */
  const hasError = useCallback((projectId: string) => {
    return thumbnailStates[projectId]?.error || false;
  }, [thumbnailStates]);

  return {
    getThumbnailUrl,
    isRegenerating,
    hasError,
    regenerateProjectThumbnail,
  };
}
