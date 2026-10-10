-- Fix infinite recursion in RLS policies by using SECURITY DEFINER functions

-- Create a SECURITY DEFINER function to check if a user has public projects
-- This bypasses RLS checks to prevent recursion
CREATE OR REPLACE FUNCTION public.user_has_public_projects(user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM canvas_projects 
    WHERE user_id = user_id_param 
      AND is_public = true 
      AND approval_status = 'approved'
    LIMIT 1
  );
END;
$$;

-- Create a SECURITY DEFINER function to check if a user is a project collaborator
-- This bypasses RLS checks to prevent recursion
-- Note: Returns false if project_collaborators table doesn't exist yet
CREATE OR REPLACE FUNCTION public.user_is_project_collaborator(check_user_id UUID, check_project_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if project_collaborators table exists
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'project_collaborators') THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM project_collaborators
    WHERE project_id = check_project_id
      AND user_id = check_user_id
      AND accepted_at IS NOT NULL
    LIMIT 1
  );
END;
$$;

-- Create a SECURITY DEFINER function to check if a user owns a project
-- This bypasses RLS checks to prevent recursion
CREATE OR REPLACE FUNCTION public.user_owns_project(check_user_id UUID, check_project_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM canvas_projects 
    WHERE id = check_project_id 
      AND user_id = check_user_id
    LIMIT 1
  );
END;
$$;

-- Drop and recreate the problematic profiles policies
DROP POLICY IF EXISTS "Public project creators are viewable by all" ON profiles;
DROP POLICY IF EXISTS "Project collaborators can view each other's profiles" ON profiles;

-- Recreate profiles policy using SECURITY DEFINER function (no RLS recursion)
CREATE POLICY "Public project creators are viewable by all"
ON profiles
FOR SELECT
TO public
USING (user_has_public_projects(id));

-- Recreate collaborators policy with simplified logic using SECURITY DEFINER
-- Only create if project_collaborators table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'project_collaborators') THEN
    CREATE POLICY "Project collaborators can view each other's profiles"
    ON profiles
    FOR SELECT
    TO public
    USING (
      EXISTS (
        SELECT 1 FROM project_collaborators pc1
        JOIN project_collaborators pc2 ON pc1.project_id = pc2.project_id
        WHERE pc1.user_id = profiles.id
          AND pc2.user_id = auth.uid()
          AND pc1.accepted_at IS NOT NULL
          AND pc2.accepted_at IS NOT NULL
      )
    );
  END IF;
END $$;

-- Update canvas_projects collaborator policy to use SECURITY DEFINER function
DROP POLICY IF EXISTS "Collaborators can view projects" ON canvas_projects;

CREATE POLICY "Collaborators can view projects"
ON canvas_projects
FOR SELECT
TO authenticated
USING (user_is_project_collaborator(auth.uid(), id));

-- Update project_collaborators policies to use SECURITY DEFINER function
-- Only create if project_collaborators table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'project_collaborators') THEN
    -- Drop existing policies
    DROP POLICY IF EXISTS "Users can view project collaborators" ON project_collaborators;
    DROP POLICY IF EXISTS "Owners and admins can update collaborators" ON project_collaborators;
    DROP POLICY IF EXISTS "Owners and admins can remove collaborators" ON project_collaborators;
    DROP POLICY IF EXISTS "Project owners and admins can invite collaborators" ON project_collaborators;

    -- Create new policies
    EXECUTE 'CREATE POLICY "Users can view project collaborators"
    ON project_collaborators
    FOR SELECT
    TO authenticated
    USING (
      user_owns_project(auth.uid(), project_id) OR user_id = auth.uid()
    )';

    EXECUTE 'CREATE POLICY "Owners and admins can update collaborators"
    ON project_collaborators
    FOR UPDATE
    TO authenticated
    USING (
      user_owns_project(auth.uid(), project_id) OR
      (user_id = auth.uid() AND role = ''admin''::collaboration_role)
    )';

    EXECUTE 'CREATE POLICY "Owners and admins can remove collaborators"
    ON project_collaborators
    FOR DELETE
    TO authenticated
    USING (
      user_owns_project(auth.uid(), project_id) OR
      (user_id = auth.uid() AND role = ''admin''::collaboration_role)
    )';

    -- Note: Incomplete INSERT policy will be handled by future migrations
  END IF;
END $$;

-- Placeholder for incomplete INSERT policy
-- CREATE POLICY "Project owners and admins can invite collaborators"
-- ON project_collaborators
-- FOR INSERT
-- TO authenticated
-- WITH CHECK (
--   user_owns_project(auth.uid(), project_id) OR
--   EXISTS (
--     SELECT 1 FROM project_collaborators
--     WHERE project_id = project_collaborators.project_id
--       AND user_id = auth.uid()
--       AND role = 'admin'::collaboration_role
--   )
-- );