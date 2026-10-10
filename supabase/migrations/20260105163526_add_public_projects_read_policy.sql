-- Add RLS policy to allow authenticated users to read public approved projects
-- Drop the policy if it already exists
DROP POLICY IF EXISTS "Allow authenticated users to read public approved projects" ON public.canvas_projects;

-- Create the policy with proper schema prefix
CREATE POLICY "Allow authenticated users to read public approved projects"
ON public.canvas_projects
FOR SELECT
TO authenticated
USING (is_public = true AND approval_status = 'approved');
