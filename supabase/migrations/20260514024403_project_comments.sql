-- Project comments for the community feature.
-- Anyone can read comments on approved public projects (incl. logged-out
-- visitors), authenticated users can post, and authors / project owners /
-- admins can delete. No threading or comment-likes in v1 — keep it minimal.
--
-- Defensive against any prior partial creation: every CREATE uses IF NOT
-- EXISTS where supported, and policies/triggers are DROPped before re-CREATE.

CREATE TABLE IF NOT EXISTS public.project_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.canvas_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Add any columns that might be missing on a pre-existing table.
ALTER TABLE public.project_comments
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.project_comments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.project_comments
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_project_comments_project_created
  ON public.project_comments (project_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_project_comments_user
  ON public.project_comments (user_id);

ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;

-- Drop any prior versions of these policies, then re-create cleanly.
DROP POLICY IF EXISTS "Anyone can read comments on approved public projects" ON public.project_comments;
DROP POLICY IF EXISTS "Authenticated users can post comments" ON public.project_comments;
DROP POLICY IF EXISTS "Authors can update their own comments" ON public.project_comments;
DROP POLICY IF EXISTS "Author, project owner, and admins can delete" ON public.project_comments;

CREATE POLICY "Anyone can read comments on approved public projects"
  ON public.project_comments
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.canvas_projects p
      WHERE p.id = project_id
        AND p.is_public = true
        AND p.approval_status = 'approved'
    )
  );

CREATE POLICY "Authenticated users can post comments"
  ON public.project_comments
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.canvas_projects p
      WHERE p.id = project_id
        AND p.is_public = true
        AND p.approval_status = 'approved'
    )
  );

CREATE POLICY "Authors can update their own comments"
  ON public.project_comments
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Author, project owner, and admins can delete"
  ON public.project_comments
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.canvas_projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

-- ─── Denormalized comment_count on canvas_projects ──────────────────────────
ALTER TABLE public.canvas_projects
  ADD COLUMN IF NOT EXISTS comment_count INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.update_project_comment_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.canvas_projects
    SET comment_count = comment_count + 1
    WHERE id = NEW.project_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.canvas_projects
    SET comment_count = GREATEST(0, comment_count - 1)
    WHERE id = OLD.project_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      UPDATE public.canvas_projects
      SET comment_count = GREATEST(0, comment_count - 1)
      WHERE id = NEW.project_id;
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      UPDATE public.canvas_projects
      SET comment_count = comment_count + 1
      WHERE id = NEW.project_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_comments_count ON public.project_comments;
CREATE TRIGGER trg_project_comments_count
  AFTER INSERT OR UPDATE OR DELETE ON public.project_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_project_comment_count();

UPDATE public.canvas_projects p
SET comment_count = COALESCE((
  SELECT COUNT(*) FROM public.project_comments c
  WHERE c.project_id = p.id AND c.deleted_at IS NULL
), 0);

-- ─── In-app notification on new comment ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_project_owner_on_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id UUID;
  project_title TEXT;
  commenter_name TEXT;
BEGIN
  SELECT p.user_id, COALESCE(p.title, 'Untitled')
    INTO owner_id, project_title
    FROM public.canvas_projects p
   WHERE p.id = NEW.project_id;

  IF owner_id IS NULL OR owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(full_name, ''), 'Someone')
    INTO commenter_name
    FROM public.profiles
   WHERE id = NEW.user_id;

  INSERT INTO public.user_notifications
    (user_id, subject, message, sender_name, sent_via_email)
  VALUES (
    owner_id,
    'New comment on "' || project_title || '"',
    COALESCE(commenter_name, 'Someone') || ' commented: ' ||
      substring(NEW.body FROM 1 FOR 240) ||
      CASE WHEN length(NEW.body) > 240 THEN '…' ELSE '' END,
    'BioSketch Community',
    false
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_comments_notify_owner ON public.project_comments;
CREATE TRIGGER trg_project_comments_notify_owner
  AFTER INSERT ON public.project_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_project_owner_on_comment();

COMMENT ON TABLE public.project_comments IS
  'Comments on community-published canvas projects. RLS: read on approved public projects (any visitor), write by authenticated users.';
