-- Allow viewing basic profile information for users who have public approved projects
CREATE POLICY "Public project creators are viewable by all"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.canvas_projects
    WHERE canvas_projects.user_id = profiles.id
    AND canvas_projects.is_public = true
    AND canvas_projects.approval_status = 'approved'
  )
);