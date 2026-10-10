-- Add thumbnail column to icons table for optimized SVG previews
ALTER TABLE public.icons 
ADD COLUMN IF NOT EXISTS thumbnail TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN public.icons.thumbnail IS 'Optimized, low-resolution SVG for thumbnail display (~5-10KB). Full svg_content is loaded only when adding to canvas.';

-- Create index on thumbnail column for faster queries
CREATE INDEX IF NOT EXISTS idx_icons_thumbnail ON public.icons(thumbnail) WHERE thumbnail IS NOT NULL;