-- Chart Studio projects table
CREATE TABLE IF NOT EXISTS chart_studio_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled',
  chart_type TEXT NOT NULL DEFAULT 'column',
  project_data JSONB NOT NULL,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_chart_studio_projects_user_id ON chart_studio_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_chart_studio_projects_updated ON chart_studio_projects(updated_at DESC);

-- RLS policies
ALTER TABLE chart_studio_projects ENABLE ROW LEVEL SECURITY;

-- Users can read their own projects
CREATE POLICY "Users can read own chart studio projects"
  ON chart_studio_projects FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own projects
CREATE POLICY "Users can create chart studio projects"
  ON chart_studio_projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own projects
CREATE POLICY "Users can update own chart studio projects"
  ON chart_studio_projects FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own projects
CREATE POLICY "Users can delete own chart studio projects"
  ON chart_studio_projects FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_chart_studio_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chart_studio_projects_updated_at
  BEFORE UPDATE ON chart_studio_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_chart_studio_updated_at();
