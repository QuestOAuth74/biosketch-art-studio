-- Create function to check if user has 3+ approved submissions
CREATE OR REPLACE FUNCTION public.user_has_premium_access(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*) >= 3
  FROM canvas_projects
  WHERE user_id = check_user_id
    AND is_public = true
    AND approval_status = 'approved';
$$;

-- Helper function to get user's progress
CREATE OR REPLACE FUNCTION public.get_user_premium_progress(check_user_id uuid)
RETURNS TABLE (
  approved_count bigint,
  has_access boolean,
  remaining integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COUNT(*) as approved_count,
    COUNT(*) >= 3 as has_access,
    GREATEST(0, 3 - COUNT(*)::integer) as remaining
  FROM canvas_projects
  WHERE user_id = check_user_id
    AND is_public = true
    AND approval_status = 'approved';
$$;