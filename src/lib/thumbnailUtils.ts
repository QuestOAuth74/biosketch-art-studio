import { supabase } from '@/integrations/supabase/client';
import { generateProjectThumbnail } from './thumbnailGenerator';

export interface ThumbnailStatus {
  isStale: boolean;
  needsRegeneration: boolean;
  hasError: boolean;
}

// Bump this version whenever the rendering pipeline changes (e.g. z-index fix)
// so that all existing thumbnails are regenerated with the updated code.
const THUMBNAIL_VERSION = 3;
const THUMBNAIL_VERSION_KEY = 'biosketch_thumbnail_version';

/**
 * Determines if a thumbnail is stale by comparing timestamps
 * and checking the thumbnail rendering version.
 */
export function isThumbnailStale(
  thumbnailUrl: string | null,
  thumbnailUpdatedAt: string | null,
  projectUpdatedAt: string
): boolean {
  if (!thumbnailUrl) return true; // No thumbnail = stale
  if (!thumbnailUpdatedAt) return true; // No timestamp = assume stale

  // Force regeneration if the rendering pipeline version has changed
  try {
    const storedVersion = localStorage.getItem(THUMBNAIL_VERSION_KEY);
    if (!storedVersion || parseInt(storedVersion) < THUMBNAIL_VERSION) {
      return true;
    }
  } catch { /* ignore */ }

  const thumbnailTime = new Date(thumbnailUpdatedAt).getTime();
  const projectTime = new Date(projectUpdatedAt).getTime();

  return projectTime > thumbnailTime;
}

/**
 * Mark the current thumbnail version as applied in localStorage.
 * Call this after all stale thumbnails have been regenerated.
 */
export function markThumbnailVersionCurrent(): void {
  try {
    localStorage.setItem(THUMBNAIL_VERSION_KEY, THUMBNAIL_VERSION.toString());
  } catch { /* ignore */ }
}

/**
 * Regenerates a thumbnail for a project in the background
 */
export async function regenerateThumbnail(
  projectId: string,
  userId: string,
  canvasData: any,
  canvasWidth: number,
  canvasHeight: number
): Promise<string | null> {
  try {
    const thumbnailUrl = await generateProjectThumbnail(
      canvasData,
      canvasWidth,
      canvasHeight,
      projectId,
      userId
    );

    if (thumbnailUrl) {
      // Update both thumbnail_url and thumbnail_updated_at
      const { error } = await supabase
        .from('canvas_projects')
        .update({
          thumbnail_url: thumbnailUrl,
          thumbnail_updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);

      if (error) {
        console.error('Failed to update thumbnail in database:', error);
        return null;
      }
    }

    return thumbnailUrl;
  } catch (error) {
    console.error('Failed to regenerate thumbnail:', error);
    return null;
  }
}

/**
 * Batch regenerates thumbnails with progress tracking
 */
export async function batchRegenerateThumbnails(
  projects: Array<{
    id: string;
    user_id: string;
    canvas_data: any;
    canvas_width: number;
    canvas_height: number;
  }>,
  onProgress?: (current: number, total: number) => void
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (let i = 0; i < projects.length; i++) {
    const project = projects[i];
    onProgress?.(i + 1, projects.length);

    const result = await regenerateThumbnail(
      project.id,
      project.user_id,
      project.canvas_data,
      project.canvas_width,
      project.canvas_height
    );

    if (result) {
      success++;
    } else {
      failed++;
    }
  }

  return { success, failed };
}
