-- Create blog_posts table
CREATE TABLE public.blog_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content JSONB NOT NULL,
  excerpt TEXT,
  featured_image_url TEXT,
  featured_image_alt TEXT,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'scheduled')),
  published_at TIMESTAMP WITH TIME ZONE,
  scheduled_for TIMESTAMP WITH TIME ZONE,
  view_count INTEGER NOT NULL DEFAULT 0,
  reading_time INTEGER,
  seo_title TEXT,
  seo_description TEXT,
  seo_keywords TEXT[],
  og_image TEXT,
  search_vector tsvector,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create blog_categories table
CREATE TABLE public.blog_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  color TEXT,
  icon TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create blog_tags table
CREATE TABLE public.blog_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create blog_post_categories junction table
CREATE TABLE public.blog_post_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.blog_categories(id) ON DELETE CASCADE,
  UNIQUE(post_id, category_id)
);

-- Create blog_post_tags junction table
CREATE TABLE public.blog_post_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.blog_tags(id) ON DELETE CASCADE,
  UNIQUE(post_id, tag_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_blog_posts_slug ON public.blog_posts(slug);
CREATE INDEX idx_blog_posts_status ON public.blog_posts(status);
CREATE INDEX idx_blog_posts_published_at ON public.blog_posts(published_at DESC);
CREATE INDEX idx_blog_posts_author_id ON public.blog_posts(author_id);
CREATE INDEX idx_blog_posts_search_vector ON public.blog_posts USING GIN(search_vector);
CREATE INDEX idx_blog_categories_slug ON public.blog_categories(slug);
CREATE INDEX idx_blog_tags_slug ON public.blog_tags(slug);
CREATE INDEX idx_blog_post_categories_post_id ON public.blog_post_categories(post_id);
CREATE INDEX idx_blog_post_categories_category_id ON public.blog_post_categories(category_id);
CREATE INDEX idx_blog_post_tags_post_id ON public.blog_post_tags(post_id);
CREATE INDEX idx_blog_post_tags_tag_id ON public.blog_post_tags(tag_id);

-- Enable Row Level Security
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_post_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_post_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for blog_posts
CREATE POLICY "Public can view published posts"
ON public.blog_posts
FOR SELECT
USING (status = 'published' OR auth.uid() = author_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert posts"
ON public.blog_posts
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update posts"
ON public.blog_posts
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete posts"
ON public.blog_posts
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for blog_categories
CREATE POLICY "Public can view categories"
ON public.blog_categories
FOR SELECT
USING (true);

CREATE POLICY "Admins can insert categories"
ON public.blog_categories
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update categories"
ON public.blog_categories
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete categories"
ON public.blog_categories
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for blog_tags
CREATE POLICY "Public can view tags"
ON public.blog_tags
FOR SELECT
USING (true);

CREATE POLICY "Admins can insert tags"
ON public.blog_tags
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update tags"
ON public.blog_tags
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete tags"
ON public.blog_tags
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for blog_post_categories
CREATE POLICY "Public can view post categories"
ON public.blog_post_categories
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage post categories"
ON public.blog_post_categories
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for blog_post_tags
CREATE POLICY "Public can view post tags"
ON public.blog_post_tags
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage post tags"
ON public.blog_post_tags
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Function to update search vector
CREATE OR REPLACE FUNCTION public.update_blog_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.excerpt, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.content::text, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger to update search vector
CREATE TRIGGER blog_posts_search_vector_update
BEFORE INSERT OR UPDATE ON public.blog_posts
FOR EACH ROW
EXECUTE FUNCTION public.update_blog_search_vector();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_blog_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger to update updated_at
CREATE TRIGGER blog_posts_updated_at
BEFORE UPDATE ON public.blog_posts
FOR EACH ROW
EXECUTE FUNCTION public.update_blog_posts_updated_at();

-- Function to increment view count
CREATE OR REPLACE FUNCTION public.increment_blog_post_view_count(post_id_param UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.blog_posts
  SET view_count = view_count + 1
  WHERE id = post_id_param AND status = 'published';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to get related posts
CREATE OR REPLACE FUNCTION public.get_related_blog_posts(post_id_param UUID, limit_param INTEGER DEFAULT 4)
RETURNS TABLE (
  id UUID,
  title TEXT,
  slug TEXT,
  excerpt TEXT,
  featured_image_url TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  reading_time INTEGER,
  relevance_score BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    bp.id,
    bp.title,
    bp.slug,
    bp.excerpt,
    bp.featured_image_url,
    bp.published_at,
    bp.reading_time,
    COUNT(*) as relevance_score
  FROM public.blog_posts bp
  LEFT JOIN public.blog_post_categories bpc ON bp.id = bpc.post_id
  LEFT JOIN public.blog_post_tags bpt ON bp.id = bpt.post_id
  WHERE bp.id != post_id_param
    AND bp.status = 'published'
    AND (
      bpc.category_id IN (
        SELECT category_id FROM public.blog_post_categories WHERE post_id = post_id_param
      )
      OR bpt.tag_id IN (
        SELECT tag_id FROM public.blog_post_tags WHERE post_id = post_id_param
      )
    )
  GROUP BY bp.id, bp.title, bp.slug, bp.excerpt, bp.featured_image_url, bp.published_at, bp.reading_time
  ORDER BY relevance_score DESC, bp.published_at DESC
  LIMIT limit_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to generate slug from title
CREATE OR REPLACE FUNCTION public.generate_blog_slug(title_param TEXT)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 1;
BEGIN
  -- Convert to lowercase, replace spaces with hyphens, remove special chars
  base_slug := lower(regexp_replace(title_param, '[^a-zA-Z0-9\s-]', '', 'g'));
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  
  final_slug := base_slug;
  
  -- Check if slug exists and append number if needed
  WHILE EXISTS (SELECT 1 FROM public.blog_posts WHERE slug = final_slug) LOOP
    final_slug := base_slug || '-' || counter;
    counter := counter + 1;
  END LOOP;
  
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create storage bucket for blog media
INSERT INTO storage.buckets (id, name, public) 
VALUES ('blog-media', 'blog-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for blog-media bucket
CREATE POLICY "Public can view blog media"
ON storage.objects FOR SELECT
USING (bucket_id = 'blog-media');

CREATE POLICY "Admins can upload blog media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'blog-media' 
  AND has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can update blog media"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'blog-media' 
  AND has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can delete blog media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'blog-media' 
  AND has_role(auth.uid(), 'admin')
);