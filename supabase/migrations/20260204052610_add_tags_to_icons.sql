-- Add tags column to icons table
ALTER TABLE public.icons
ADD COLUMN tags JSONB DEFAULT '[]'::jsonb;

-- Add a check constraint to limit tags to 3 items
ALTER TABLE public.icons
ADD CONSTRAINT tags_max_length CHECK (jsonb_array_length(tags) <= 3);

-- Add a GIN index for efficient tag searching
CREATE INDEX idx_icons_tags ON public.icons USING GIN (tags);

-- Add comment for documentation
COMMENT ON COLUMN public.icons.tags IS 'Array of up to 3 tags for icon searching and categorization';
