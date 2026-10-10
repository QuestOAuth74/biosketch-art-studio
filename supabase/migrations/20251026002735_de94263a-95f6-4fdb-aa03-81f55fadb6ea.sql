-- Ensure relational integrity for blog join tables so nested selects work
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'blog_post_categories_post_id_fkey'
  ) THEN
    ALTER TABLE public.blog_post_categories
    ADD CONSTRAINT blog_post_categories_post_id_fkey
    FOREIGN KEY (post_id)
    REFERENCES public.blog_posts(id)
    ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'blog_post_categories_category_id_fkey'
  ) THEN
    ALTER TABLE public.blog_post_categories
    ADD CONSTRAINT blog_post_categories_category_id_fkey
    FOREIGN KEY (category_id)
    REFERENCES public.blog_categories(id)
    ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'blog_post_tags_post_id_fkey'
  ) THEN
    ALTER TABLE public.blog_post_tags
    ADD CONSTRAINT blog_post_tags_post_id_fkey
    FOREIGN KEY (post_id)
    REFERENCES public.blog_posts(id)
    ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'blog_post_tags_tag_id_fkey'
  ) THEN
    ALTER TABLE public.blog_post_tags
    ADD CONSTRAINT blog_post_tags_tag_id_fkey
    FOREIGN KEY (tag_id)
    REFERENCES public.blog_tags(id)
    ON DELETE CASCADE;
  END IF;
END $$;

-- Helpful indexes for performance
CREATE INDEX IF NOT EXISTS idx_blog_post_categories_post_id ON public.blog_post_categories(post_id);
CREATE INDEX IF NOT EXISTS idx_blog_post_categories_category_id ON public.blog_post_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_blog_post_tags_post_id ON public.blog_post_tags(post_id);
CREATE INDEX IF NOT EXISTS idx_blog_post_tags_tag_id ON public.blog_post_tags(tag_id);
