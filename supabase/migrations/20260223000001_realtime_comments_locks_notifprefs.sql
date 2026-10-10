-- ============================================================
-- Migration: Real-time Comments, Project Locks, Notification Preferences
-- Squashes: 20260223000001, 20260223000002, 20260224000001, 20260224000002
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. canvas_comments — threaded comments on canvas projects
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.canvas_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.canvas_projects(id) ON DELETE CASCADE,
  parent_id   UUID REFERENCES public.canvas_comments(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  canvas_x    FLOAT,
  canvas_y    FLOAT,
  resolved    BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_canvas_comments_project_id ON public.canvas_comments(project_id);
CREATE INDEX idx_canvas_comments_parent_id  ON public.canvas_comments(parent_id);
CREATE INDEX idx_canvas_comments_author_id  ON public.canvas_comments(author_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_canvas_comment_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TRIGGER trg_canvas_comments_updated_at
BEFORE UPDATE ON public.canvas_comments
FOR EACH ROW EXECUTE FUNCTION public.set_canvas_comment_updated_at();

-- FULL replica identity so that DELETE events include all columns,
-- enabling Supabase Realtime project_id filters to match on deletion.
ALTER TABLE public.canvas_comments REPLICA IDENTITY FULL;

-- ────────────────────────────────────────────────────────────
-- 2. project_locks — at most one row per project = locked
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.project_locks (
  project_id UUID PRIMARY KEY REFERENCES public.canvas_projects(id) ON DELETE CASCADE,
  locked_by  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  locked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 3. user_notifications — notification_type and link columns
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.user_notifications
  ADD COLUMN IF NOT EXISTS notification_type TEXT;

ALTER TABLE public.user_notifications
  ADD COLUMN IF NOT EXISTS link TEXT;

-- ────────────────────────────────────────────────────────────
-- 4. Notification preferences on profiles
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{
    "group_invitation":   {"in_app": true, "email": true},
    "project_invitation": {"in_app": true, "email": true},
    "page_invitation":    {"in_app": true, "email": true},
    "comment_new":        {"in_app": true, "email": true},
    "comment_reply":      {"in_app": true, "email": true},
    "project_locked":     {"in_app": true, "email": false}
  }';

-- ────────────────────────────────────────────────────────────
-- 5. notify_user RPC — SECURITY DEFINER so edge functions and
--    client code can insert notifications without admin RLS.
--    Includes optional p_link for invitation accept URLs.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_user(
  p_user_id UUID,
  p_type    TEXT,
  p_subject TEXT,
  p_message TEXT,
  p_sender  TEXT DEFAULT 'BioSketch Team',
  p_link    TEXT DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  prefs          JSONB;
  in_app_enabled BOOLEAN;
BEGIN
  SELECT notification_preferences INTO prefs
  FROM public.profiles WHERE id = p_user_id;

  -- Default to enabled if no preference set for this type
  in_app_enabled := COALESCE((prefs -> p_type ->> 'in_app')::BOOLEAN, true);

  IF in_app_enabled THEN
    INSERT INTO public.user_notifications(user_id, notification_type, subject, message, sender_name, link)
    VALUES (p_user_id, p_type, p_subject, p_message, p_sender, p_link);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_user(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 6. user_can_access_project — owner + all collaborator paths
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.user_can_access_project(check_user_id UUID, check_project_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Owner
  IF EXISTS (
    SELECT 1 FROM public.canvas_projects
    WHERE id = check_project_id AND user_id = check_user_id
  ) THEN RETURN TRUE; END IF;

  -- Accepted individual collaborator (any permission)
  IF EXISTS (
    SELECT 1 FROM public.project_collaborators
    WHERE project_id = check_project_id AND user_id = check_user_id
      AND accepted_at IS NOT NULL
  ) THEN RETURN TRUE; END IF;

  -- Group member with group-level access (any permission)
  IF EXISTS (
    SELECT 1 FROM public.project_group_access pga
    JOIN public.group_members gm ON gm.group_id = pga.group_id
    WHERE pga.project_id = check_project_id AND gm.user_id = check_user_id
  ) THEN RETURN TRUE; END IF;

  -- Page-based access (individual or group, any permission)
  RETURN EXISTS (
    SELECT 1 FROM public.project_page_items ppi
    WHERE ppi.project_id = check_project_id
      AND (
        EXISTS (
          SELECT 1 FROM public.project_page_access ppa
          WHERE ppa.page_id = ppi.page_id AND ppa.user_id = check_user_id
            AND ppa.accepted_at IS NOT NULL
        ) OR EXISTS (
          SELECT 1 FROM public.project_page_group_access ppga
          JOIN public.group_members gm ON gm.group_id = ppga.group_id
          WHERE ppga.page_id = ppi.page_id AND gm.user_id = check_user_id
        )
      )
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.user_can_access_project(UUID, UUID) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 7. RLS Policies — canvas_comments
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.canvas_comments ENABLE ROW LEVEL SECURITY;

-- SELECT: any user who can access the project
CREATE POLICY "canvas_comments_select" ON public.canvas_comments
  FOR SELECT USING (
    public.user_can_access_project(auth.uid(), project_id)
  );

-- INSERT: any user who can access the project
CREATE POLICY "canvas_comments_insert" ON public.canvas_comments
  FOR INSERT WITH CHECK (
    auth.uid() = author_id
    AND public.user_can_access_project(auth.uid(), project_id)
  );

-- UPDATE: author or project owner (for resolve/unresolve)
CREATE POLICY "canvas_comments_update" ON public.canvas_comments
  FOR UPDATE USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM public.canvas_projects cp
      WHERE cp.id = project_id AND cp.user_id = auth.uid()
    )
  ) WITH CHECK (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM public.canvas_projects cp
      WHERE cp.id = project_id AND cp.user_id = auth.uid()
    )
  );

-- DELETE: author or project owner
CREATE POLICY "canvas_comments_delete" ON public.canvas_comments
  FOR DELETE USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM public.canvas_projects cp
      WHERE cp.id = project_id AND cp.user_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────
-- 8. RLS Policies — project_locks
--    INSERT/DELETE include the project owner explicitly because
--    user_can_edit_project() only checks collaborator tables.
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.project_locks ENABLE ROW LEVEL SECURITY;

-- SELECT: any user with access to the project
CREATE POLICY "project_locks_select" ON public.project_locks
  FOR SELECT USING (
    public.user_can_access_project(auth.uid(), project_id)
  );

-- INSERT: must be the lock row owner AND be project owner or edit collaborator
CREATE POLICY "project_locks_insert" ON public.project_locks
  FOR INSERT WITH CHECK (
    auth.uid() = locked_by
    AND (
      EXISTS (
        SELECT 1 FROM public.canvas_projects
        WHERE id = project_id AND user_id = auth.uid()
      )
      OR public.user_can_edit_project(auth.uid(), project_id)
    )
  );

-- DELETE: project owner or edit collaborator
CREATE POLICY "project_locks_delete" ON public.project_locks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.canvas_projects
      WHERE id = project_id AND user_id = auth.uid()
    )
    OR public.user_can_edit_project(auth.uid(), project_id)
  );

-- ────────────────────────────────────────────────────────────
-- 9. Enable Realtime for new tables
-- ────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.canvas_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_locks;
