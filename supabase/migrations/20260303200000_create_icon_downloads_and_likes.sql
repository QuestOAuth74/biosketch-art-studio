-- ============================================================
-- Icon Downloads tracking, Likes & Gallery support
-- ============================================================

-- 0. user_favorite_icons table (likes)
CREATE TABLE IF NOT EXISTS public.user_favorite_icons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  icon_id UUID NOT NULL REFERENCES public.icons(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, icon_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorite_icons_user ON public.user_favorite_icons(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorite_icons_icon ON public.user_favorite_icons(icon_id);

ALTER TABLE public.user_favorite_icons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorite icons"
  ON public.user_favorite_icons FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add favorite icons"
  ON public.user_favorite_icons FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove favorite icons"
  ON public.user_favorite_icons FOR DELETE
  USING (auth.uid() = user_id);

-- 1. icon_downloads table
CREATE TABLE public.icon_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  icon_id UUID NOT NULL REFERENCES public.icons(id) ON DELETE CASCADE,
  download_format TEXT NOT NULL CHECK (download_format IN ('svg', 'png')),
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_icon_downloads_user ON public.icon_downloads(user_id, downloaded_at);
CREATE INDEX idx_icon_downloads_icon ON public.icon_downloads(icon_id);

ALTER TABLE public.icon_downloads ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view their own downloads
CREATE POLICY "Users can view own icon downloads"
  ON public.icon_downloads FOR SELECT
  USING (auth.uid() = user_id);

-- Authenticated users can insert their own downloads
CREATE POLICY "Users can record own icon downloads"
  ON public.icon_downloads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Anonymous users can insert downloads (user_id = NULL)
CREATE POLICY "Anon can record anonymous icon downloads"
  ON public.icon_downloads FOR INSERT
  WITH CHECK (user_id IS NULL);

-- Admins can view all
CREATE POLICY "Admins can view all icon downloads"
  ON public.icon_downloads FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Add download_count and like_count to icons table
ALTER TABLE public.icons ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE public.icons ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0 NOT NULL;

-- 3. Trigger: auto-increment download_count on icon_downloads insert
CREATE OR REPLACE FUNCTION public.increment_icon_download_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.icons
  SET download_count = download_count + 1
  WHERE id = NEW.icon_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_increment_icon_download_count
  AFTER INSERT ON public.icon_downloads
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_icon_download_count();

-- 4. Trigger: auto-update like_count on user_favorite_icons insert/delete
CREATE OR REPLACE FUNCTION public.sync_icon_like_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.icons
    SET like_count = like_count + 1
    WHERE id = NEW.icon_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.icons
    SET like_count = GREATEST(like_count - 1, 0)
    WHERE id = OLD.icon_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sync_icon_like_count
  AFTER INSERT OR DELETE ON public.user_favorite_icons
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_icon_like_count();

-- 5. RPC: get_icon_download_quota (10 per month per user)
CREATE OR REPLACE FUNCTION public.get_icon_download_quota(check_user_id UUID)
RETURNS TABLE(
  downloads_used INTEGER,
  can_download BOOLEAN,
  remaining INTEGER
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH counts AS (
    SELECT COUNT(*)::INTEGER AS used
    FROM public.icon_downloads
    WHERE user_id = check_user_id
      AND downloaded_at >= date_trunc('month', now())
  )
  SELECT
    c.used AS downloads_used,
    (c.used < 10) AS can_download,
    GREATEST(10 - c.used, 0) AS remaining
  FROM counts c;
$$;

GRANT EXECUTE ON FUNCTION public.get_icon_download_quota(UUID) TO authenticated;

-- 6. RPC: get_icons_for_gallery (paginated, searchable, sortable)
CREATE OR REPLACE FUNCTION public.get_icons_for_gallery(
  p_search TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'recent',
  p_limit INTEGER DEFAULT 30,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  category TEXT,
  svg_content TEXT,
  thumbnail TEXT,
  download_count INTEGER,
  like_count INTEGER,
  created_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH filtered AS (
    SELECT i.*,
           COUNT(*) OVER() AS total_count
    FROM public.icons i
    WHERE i.category = 'ai-icons'
      AND (p_search IS NULL OR p_search = ''
           OR i.name ILIKE '%' || p_search || '%')
    ORDER BY
      CASE WHEN p_sort = 'recent' THEN i.created_at END DESC NULLS LAST,
      CASE WHEN p_sort = 'downloads' THEN i.download_count END DESC NULLS LAST,
      CASE WHEN p_sort = 'likes' THEN i.like_count END DESC NULLS LAST,
      CASE WHEN p_sort = 'name' THEN i.name END ASC NULLS LAST,
      i.created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT
    f.id, f.name, f.category, f.svg_content, f.thumbnail,
    f.download_count, f.like_count, f.created_at, f.total_count
  FROM filtered f;
$$;

GRANT EXECUTE ON FUNCTION public.get_icons_for_gallery(TEXT, TEXT, INTEGER, INTEGER) TO anon, authenticated;
