-- 1) Ensure profiles.id is a proper PK (required for FK target)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
  END IF;
END
$$;

-- 2) Drop any existing FK on blog_posts.author_id that might point to auth.users
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'blog_posts_author_id_fkey'
      AND conrelid = 'public.blog_posts'::regclass
  ) THEN
    ALTER TABLE public.blog_posts
    DROP CONSTRAINT blog_posts_author_id_fkey;
  END IF;
END
$$;

-- 3) Create the correct FK to public.profiles(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'blog_posts_author_id_fkey'
      AND conrelid = 'public.blog_posts'::regclass
  ) THEN
    ALTER TABLE public.blog_posts
    ADD CONSTRAINT blog_posts_author_id_fkey
    FOREIGN KEY (author_id)
    REFERENCES public.profiles(id)
    ON DELETE RESTRICT;
  END IF;
END
$$;

-- 4) Helpful index for join performance
CREATE INDEX IF NOT EXISTS idx_blog_posts_author_id ON public.blog_posts(author_id);
