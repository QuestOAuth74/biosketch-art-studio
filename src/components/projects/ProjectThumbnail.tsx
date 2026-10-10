import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isThumbnailStale, regenerateThumbnail } from '@/lib/thumbnailUtils';
import { ThumbnailWithSpinner } from './ThumbnailWithSpinner';

interface ProjectThumbnailProps {
  project: {
    id: string;
    user_id: string;
    thumbnail_url: string | null;
    thumbnail_updated_at?: string | null;
    updated_at: string;
    canvas_width: number;
    canvas_height: number;
  };
  alt: string;
  className?: string;
  /** If true, automatically regenerate stale thumbnails on mount */
  autoRegenerate?: boolean;
}

/**
 * Generic project thumbnail component with lazy loading support.
 * Automatically detects and regenerates stale thumbnails in the background.
 */
export function ProjectThumbnail({
  project,
  alt,
  className = '',
  autoRegenerate = true,
}: ProjectThumbnailProps) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentThumbnailUrl, setCurrentThumbnailUrl] = useState(project.thumbnail_url);

  useEffect(() => {
    // Check if thumbnail is stale
    const isStale = isThumbnailStale(
      project.thumbnail_url,
      project.thumbnail_updated_at || null,
      project.updated_at
    );

    // Only regenerate if enabled and thumbnail is stale
    if (!autoRegenerate || !isStale) return;

    const regenerate = async () => {
      setIsRegenerating(true);
      setHasError(false);

      try {
        // Fetch canvas data (not included in project list queries for performance)
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
          setCurrentThumbnailUrl(newThumbnailUrl);
        } else {
          throw new Error('Thumbnail generation returned null');
        }
      } catch (error) {
        console.error(`Failed to regenerate thumbnail for project ${project.id}:`, error);
        setHasError(true);
      } finally {
        setIsRegenerating(false);
      }
    };

    // Add a small delay to stagger requests when multiple thumbnails are rendered
    const timeoutId = setTimeout(regenerate, Math.random() * 1000);

    return () => clearTimeout(timeoutId);
  }, [project.id, project.thumbnail_url, project.thumbnail_updated_at, project.updated_at, autoRegenerate]);

  return (
    <ThumbnailWithSpinner
      src={currentThumbnailUrl}
      alt={alt}
      isRegenerating={isRegenerating}
      hasError={hasError}
      className={className}
    />
  );
}
