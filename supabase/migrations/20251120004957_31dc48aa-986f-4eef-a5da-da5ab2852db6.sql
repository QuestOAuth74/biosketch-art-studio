-- Create project_versions table
CREATE TABLE project_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES canvas_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  version_number INTEGER NOT NULL,
  version_name TEXT,
  canvas_data JSONB NOT NULL,
  canvas_width INTEGER NOT NULL,
  canvas_height INTEGER NOT NULL,
  paper_size TEXT,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_auto_save BOOLEAN DEFAULT true,
  restore_count INTEGER DEFAULT 0,
  
  UNIQUE(project_id, version_number)
);

-- Create indexes for fast version lookups
CREATE INDEX idx_project_versions_project ON project_versions(project_id, created_at DESC);
CREATE INDEX idx_project_versions_user ON project_versions(user_id);

-- Enable RLS
ALTER TABLE project_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own project versions"
  ON project_versions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create versions for own projects"
  ON project_versions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own project versions"
  ON project_versions FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all project versions"
  ON project_versions FOR SELECT
  USING (has_role(auth.uid(), 'admin'));