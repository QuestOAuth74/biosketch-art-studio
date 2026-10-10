-- Add community sharing columns to canvas_projects table
ALTER TABLE canvas_projects 
  ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS keywords text[],
  ADD COLUMN IF NOT EXISTS view_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cloned_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS original_project_id uuid REFERENCES canvas_projects(id) ON DELETE SET NULL;

-- Create indexes for performance on public projects
CREATE INDEX IF NOT EXISTS idx_canvas_projects_public 
  ON canvas_projects(is_public, updated_at DESC) 
  WHERE is_public = true;

CREATE INDEX IF NOT EXISTS idx_canvas_projects_view_count 
  ON canvas_projects(view_count DESC) 
  WHERE is_public = true;

CREATE INDEX IF NOT EXISTS idx_canvas_projects_keywords 
  ON canvas_projects USING GIN(keywords) 
  WHERE is_public = true;

-- Add RLS policy for public projects visibility
CREATE POLICY "Public projects are viewable by all authenticated users"
  ON canvas_projects FOR SELECT
  TO authenticated
  USING (is_public = true OR auth.uid() = user_id);

-- Create project_likes table for community engagement
CREATE TABLE IF NOT EXISTS project_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES canvas_projects(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, project_id)
);

-- Enable RLS on project_likes
ALTER TABLE project_likes ENABLE ROW LEVEL SECURITY;

-- RLS policies for project_likes
CREATE POLICY "Users can view all likes"
  ON project_likes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can like projects"
  ON project_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike projects"
  ON project_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create function to increment view count safely
CREATE OR REPLACE FUNCTION increment_project_view_count(project_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE canvas_projects
  SET view_count = view_count + 1
  WHERE id = project_id_param AND is_public = true;
END;
$$;

-- Create function to clone project atomically
CREATE OR REPLACE FUNCTION clone_project(
  source_project_id uuid,
  new_project_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_project_id uuid;
  source_project record;
BEGIN
  -- Get source project data
  SELECT * INTO source_project
  FROM canvas_projects
  WHERE id = source_project_id AND is_public = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found or not public';
  END IF;
  
  -- Create new project
  INSERT INTO canvas_projects (
    user_id,
    name,
    canvas_data,
    canvas_width,
    canvas_height,
    paper_size,
    is_public,
    original_project_id
  ) VALUES (
    auth.uid(),
    new_project_name,
    source_project.canvas_data,
    source_project.canvas_width,
    source_project.canvas_height,
    source_project.paper_size,
    false,
    source_project_id
  )
  RETURNING id INTO new_project_id;
  
  -- Increment cloned count on original
  UPDATE canvas_projects
  SET cloned_count = cloned_count + 1
  WHERE id = source_project_id;
  
  RETURN new_project_id;
END;
$$;