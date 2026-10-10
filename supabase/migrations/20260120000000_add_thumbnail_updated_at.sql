-- Add thumbnail_updated_at column to track thumbnail freshness
ALTER TABLE public.canvas_projects
  ADD COLUMN IF NOT EXISTS thumbnail_updated_at TIMESTAMPTZ;

-- Backfill existing thumbnails with current timestamp
-- (assumes existing thumbnails are relatively fresh)
UPDATE public.canvas_projects
  SET thumbnail_updated_at = updated_at
  WHERE thumbnail_url IS NOT NULL
    AND thumbnail_updated_at IS NULL;

-- Create index for efficient stale thumbnail queries
CREATE INDEX IF NOT EXISTS idx_canvas_projects_stale_thumbnails
  ON public.canvas_projects(user_id, updated_at, thumbnail_updated_at)
  WHERE thumbnail_url IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.canvas_projects.thumbnail_updated_at IS
  'Timestamp when the thumbnail was last generated. Used to detect stale thumbnails by comparing with updated_at.';
