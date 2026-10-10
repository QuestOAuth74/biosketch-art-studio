-- Allow admins to update approval status and rejection reason on any project
CREATE POLICY "Admins can update approval status"
  ON canvas_projects
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));