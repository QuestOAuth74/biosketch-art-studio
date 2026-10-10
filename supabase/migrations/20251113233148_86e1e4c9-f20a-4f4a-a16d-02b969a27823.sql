-- Add like_count column to canvas_projects for efficient sorting
ALTER TABLE canvas_projects ADD COLUMN like_count INTEGER DEFAULT 0;

-- Initialize counts from existing likes
UPDATE canvas_projects 
SET like_count = (
  SELECT COUNT(*) 
  FROM project_likes 
  WHERE project_likes.project_id = canvas_projects.id
);

-- Create function to update like count automatically
CREATE OR REPLACE FUNCTION update_project_like_count()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE canvas_projects 
    SET like_count = like_count + 1 
    WHERE id = NEW.project_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE canvas_projects 
    SET like_count = GREATEST(like_count - 1, 0) 
    WHERE id = OLD.project_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Create trigger to maintain like counts
CREATE TRIGGER project_likes_count_trigger
AFTER INSERT OR DELETE ON project_likes
FOR EACH ROW
EXECUTE FUNCTION update_project_like_count();