-- Add field_of_study column to canvas_projects
ALTER TABLE public.canvas_projects
  ADD COLUMN IF NOT EXISTS field_of_study text;

-- Index for filtering community projects by field
CREATE INDEX IF NOT EXISTS idx_canvas_projects_field_of_study
  ON public.canvas_projects (field_of_study)
  WHERE is_public = true AND approval_status = 'approved';
