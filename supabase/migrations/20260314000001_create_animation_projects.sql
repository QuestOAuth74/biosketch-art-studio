-- Animation Projects Table
-- Stores keyframe-based 2D animation data linked to canvas projects.

CREATE TABLE public.animation_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_project_id UUID REFERENCES public.canvas_projects(id) ON DELETE SET NULL,
  name TEXT NOT NULL DEFAULT 'Untitled Animation',
  animation_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  fps INTEGER NOT NULL DEFAULT 24,
  duration_seconds NUMERIC NOT NULL DEFAULT 5,
  total_frames INTEGER NOT NULL DEFAULT 120,
  canvas_width INTEGER,
  canvas_height INTEGER,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_animation_projects_user_id ON public.animation_projects(user_id);
CREATE INDEX idx_animation_projects_source_project_id ON public.animation_projects(source_project_id);

-- RLS
ALTER TABLE public.animation_projects ENABLE ROW LEVEL SECURITY;

-- Users can select their own animations
CREATE POLICY "Users can view own animations"
  ON public.animation_projects
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own animations
CREATE POLICY "Users can create animations"
  ON public.animation_projects
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own animations
CREATE POLICY "Users can update own animations"
  ON public.animation_projects
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own animations
CREATE POLICY "Users can delete own animations"
  ON public.animation_projects
  FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can view all animations
CREATE POLICY "Admins can view all animations"
  ON public.animation_projects
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_animation_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_animation_projects_updated_at
  BEFORE UPDATE ON public.animation_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_animation_projects_updated_at();
