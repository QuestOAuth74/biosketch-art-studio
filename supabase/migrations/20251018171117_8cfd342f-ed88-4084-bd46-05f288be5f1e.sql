-- Add citations and approval status columns to canvas_projects
ALTER TABLE canvas_projects 
ADD COLUMN IF NOT EXISTS citations text,
ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- Create index for approval_status for better query performance
CREATE INDEX IF NOT EXISTS idx_canvas_projects_approval_status ON canvas_projects(approval_status);

-- Update existing public projects to 'approved' status
UPDATE canvas_projects 
SET approval_status = 'approved' 
WHERE is_public = true;

-- Update RLS policy for public projects to require approval
DROP POLICY IF EXISTS "Public projects are viewable by all authenticated users" ON canvas_projects;

CREATE POLICY "Public approved projects are viewable by all authenticated users" 
ON canvas_projects 
FOR SELECT 
USING (
  (is_public = true AND approval_status = 'approved') 
  OR (auth.uid() = user_id)
);