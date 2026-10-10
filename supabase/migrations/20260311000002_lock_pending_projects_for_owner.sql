-- Replace the owner UPDATE policy to block saves while project is pending approval.
-- Owners can update their own projects UNLESS approval_status = 'pending'.
-- Admins are unaffected (they have a separate "Admins can update any project" policy).

DROP POLICY IF EXISTS "Users can update their own projects" ON public.canvas_projects;

CREATE POLICY "Users can update their own projects"
  ON public.canvas_projects FOR UPDATE
  USING (
    auth.uid() = user_id
    AND (approval_status IS DISTINCT FROM 'pending')
  )
  WITH CHECK (
    auth.uid() = user_id
  );
