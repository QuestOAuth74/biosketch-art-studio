-- Update search_vector to include name and tags only (remove category)
-- This matches Milestone 1 requirement: "Icon search across both names and tags"

-- Update trigger function to include name and tags ONLY (no category)
CREATE OR REPLACE FUNCTION public.icons_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(
      (SELECT string_agg(value::text, ' ')
       FROM jsonb_array_elements_text(NEW.tags)),
      ''
    )), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Rebuild search_vector for all existing icons
UPDATE public.icons
SET search_vector =
  setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(
    (SELECT string_agg(value::text, ' ')
     FROM jsonb_array_elements_text(tags)),
    ''
  )), 'B');
