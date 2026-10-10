-- Add SET search_path to extract_tiptap_text function for security
CREATE OR REPLACE FUNCTION public.extract_tiptap_text(content jsonb)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path = 'public'
AS $function$
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
$function$;

-- Add SET search_path to update_blog_search_vector trigger function for security
CREATE OR REPLACE FUNCTION public.update_blog_search_vector()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
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
$function$;