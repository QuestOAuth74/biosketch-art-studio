-- Add rejection_reason column to canvas_projects
ALTER TABLE canvas_projects 
ADD COLUMN rejection_reason text;

COMMENT ON COLUMN canvas_projects.rejection_reason IS 'Admin reason for rejecting a project submission';