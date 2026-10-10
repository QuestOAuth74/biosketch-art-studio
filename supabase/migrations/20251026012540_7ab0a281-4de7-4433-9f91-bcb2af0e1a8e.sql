-- Enable trigram extension for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Function to recursively extract plain text from TipTap JSON content
CREATE OR REPLACE FUNCTION extract_tiptap_text(content jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result text := '';
  element jsonb;
BEGIN
  -- Handle null or empty content
  IF content IS NULL OR content = 'null'::jsonb THEN
    RETURN '';
  END IF;

  -- If content has a 'text' field, add it
  IF content ? 'text' THEN
    result := result || ' ' || (content->>'text');
  END IF;

  -- If content has a 'content' array, recurse through it
  IF content ? 'content' AND jsonb_typeof(content->'content') = 'array' THEN
    FOR element IN SELECT * FROM jsonb_array_elements(content->'content')
    LOOP
      result := result || ' ' || extract_tiptap_text(element);
    END LOOP;
  END IF;

  RETURN trim(result);
END;
$$;

-- Update the search vector trigger function to extract TipTap text properly
CREATE OR REPLACE FUNCTION update_blog_search_vector()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  extracted_content text;
  category_names text;
  tag_names text;
BEGIN
  -- Extract plain text from TipTap JSON content
  extracted_content := extract_tiptap_text(NEW.content);

  -- Get category names
  SELECT string_agg(bc.name, ' ')
  INTO category_names
  FROM blog_post_categories bpc
  JOIN blog_categories bc ON bc.id = bpc.category_id
  WHERE bpc.post_id = NEW.id;

  -- Get tag names
  SELECT string_agg(bt.name, ' ')
  INTO tag_names
  FROM blog_post_tags bpt
  JOIN blog_tags bt ON bt.id = bpt.tag_id
  WHERE bpt.post_id = NEW.id;

  -- Update search vector with weighted content
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.excerpt, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(extracted_content, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(category_names, '') || ' ' || coalesce(tag_names, '')), 'D');

  RETURN NEW;
END;
$$;

-- Add trigram indexes for fuzzy search on title and excerpt
CREATE INDEX IF NOT EXISTS blog_posts_title_trgm_idx ON blog_posts USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS blog_posts_excerpt_trgm_idx ON blog_posts USING gin (excerpt gin_trgm_ops);

-- Re-index all existing posts with the improved search vector
UPDATE blog_posts SET updated_at = updated_at;