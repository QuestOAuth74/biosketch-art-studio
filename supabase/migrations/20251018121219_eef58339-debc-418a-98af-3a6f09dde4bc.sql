-- Fix search path for the search vector function
CREATE OR REPLACE FUNCTION public.icons_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.category, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SET search_path = public;