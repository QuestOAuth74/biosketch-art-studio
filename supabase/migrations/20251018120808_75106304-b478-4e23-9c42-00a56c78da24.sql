-- Add full-text search to icons table
-- Add a tsvector column for search
ALTER TABLE public.icons 
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create a GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS icons_search_idx ON public.icons USING GIN (search_vector);

-- Create function to generate search vector
CREATE OR REPLACE FUNCTION public.icons_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.category, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update search vector
DROP TRIGGER IF EXISTS icons_search_vector_trigger ON public.icons;
CREATE TRIGGER icons_search_vector_trigger
BEFORE INSERT OR UPDATE ON public.icons
FOR EACH ROW
EXECUTE FUNCTION public.icons_search_vector_update();

-- Update existing rows to populate search_vector
UPDATE public.icons SET search_vector = 
  setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(category, '')), 'B');