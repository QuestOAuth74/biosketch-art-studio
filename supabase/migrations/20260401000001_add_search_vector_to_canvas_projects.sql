-- Add full-text search vector to canvas_projects for semantic community search
-- Covers: title, name, description, keywords (text array), field_of_study

-- Add the search_vector column
ALTER TABLE public.canvas_projects
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create trigger function to auto-update search_vector on insert/update
CREATE OR REPLACE FUNCTION public.canvas_projects_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.field_of_study, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.keywords, ' '), '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Create trigger
DROP TRIGGER IF EXISTS canvas_projects_search_vector_trigger ON public.canvas_projects;
CREATE TRIGGER canvas_projects_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, name, description, keywords, field_of_study
  ON public.canvas_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.canvas_projects_search_vector_update();

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_canvas_projects_search_vector
  ON public.canvas_projects USING GIN (search_vector)
  WHERE is_public = true AND approval_status = 'approved';

-- Backfill search_vector for all existing projects
UPDATE public.canvas_projects
SET search_vector =
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(field_of_study, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(array_to_string(keywords, ' '), '')), 'B');
