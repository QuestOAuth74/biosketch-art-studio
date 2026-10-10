-- Migration: Fix profiles visibility for project collaborators
--
-- Problem: The existing "Project collaborators can view each other's profiles"
-- policy uses a JOIN on project_collaborators inside a regular USING clause.
-- Because project_collaborators itself has RLS (users can only see their own
-- rows), the JOIN never finds the other user's row, so the policy always
-- evaluates to false for collaborators.
--
-- Fix: Add a SECURITY DEFINER function that bypasses project_collaborators RLS
-- to check the cross-user relationship, then replace the broken policy with one
-- that calls it.

-- 1. SECURITY DEFINER function (parallel to user_shares_group_with)
CREATE OR REPLACE FUNCTION public.user_shares_project_with(check_user_id UUID, target_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.project_collaborators pc1
    JOIN public.project_collaborators pc2 ON pc1.project_id = pc2.project_id
    WHERE pc1.user_id = check_user_id
      AND pc2.user_id = target_user_id
      AND pc1.accepted_at IS NOT NULL
      AND pc2.accepted_at IS NOT NULL
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.user_shares_project_with(UUID, UUID) TO authenticated;

-- 2. Replace the broken policy with one that uses the SECURITY DEFINER function
DROP POLICY IF EXISTS "Project collaborators can view each other's profiles" ON public.profiles;

CREATE POLICY "Project collaborators can view each other's profiles"
  ON public.profiles FOR SELECT
  USING (user_shares_project_with(auth.uid(), profiles.id));
