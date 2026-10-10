-- Restrict admin UPDATE access to only projects submitted for review.
-- Admins can still VIEW any project via the existing SELECT policy,
-- but should only edit projects that are pending approval.

DROP POLICY IF EXISTS "Admins can update any project" ON public.canvas_projects;

CREATE POLICY "Admins can update pending projects"
  ON public.canvas_projects FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin')
    AND approval_status = 'pending'
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
  );
