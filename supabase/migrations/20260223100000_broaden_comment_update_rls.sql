-- Allow any user with project access to update comments (e.g. move pins)
-- Previously only the comment author or project owner could update.

DROP POLICY IF EXISTS "canvas_comments_update" ON public.canvas_comments;

CREATE POLICY "canvas_comments_update" ON public.canvas_comments
  FOR UPDATE USING (
    public.user_can_access_project(auth.uid(), project_id)
  ) WITH CHECK (
    public.user_can_access_project(auth.uid(), project_id)
  );
