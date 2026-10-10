-- Update the can_user_generate function to require premium access and provide 3 generations
CREATE OR REPLACE FUNCTION public.can_user_generate(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_month TEXT;
  generation_count INTEGER;
  is_admin_user BOOLEAN;
  has_premium BOOLEAN;
  approved_projects_count INTEGER;
BEGIN
  current_month := to_char(now(), 'YYYY-MM');
  is_admin_user := has_role(_user_id, 'admin');
  
  -- Admins get unlimited access
  IF is_admin_user THEN
    RETURN jsonb_build_object(
      'canGenerate', true,
      'isAdmin', true,
      'hasPremium', true,
      'used', 0,
      'limit', null,
      'remaining', null,
      'monthYear', current_month
    );
  END IF;
  
  -- Check if user has premium access (3+ approved public projects)
  SELECT COUNT(*)::INTEGER INTO approved_projects_count
  FROM canvas_projects
  WHERE user_id = _user_id
    AND is_public = true
    AND approval_status = 'approved';
  
  has_premium := approved_projects_count >= 3;
  
  -- Non-premium users cannot generate
  IF NOT has_premium THEN
    RETURN jsonb_build_object(
      'canGenerate', false,
      'isAdmin', false,
      'hasPremium', false,
      'used', 0,
      'limit', 3,
      'remaining', 0,
      'monthYear', current_month,
      'approvedCount', approved_projects_count,
      'needsApproved', 3 - approved_projects_count
    );
  END IF;
  
  -- Premium users get 3 generations per month
  generation_count := get_user_generation_count(_user_id, current_month);
  
  RETURN jsonb_build_object(
    'canGenerate', generation_count < 3,
    'isAdmin', false,
    'hasPremium', true,
    'used', generation_count,
    'limit', 3,
    'remaining', GREATEST(0, 3 - generation_count),
    'monthYear', current_month
  );
END;
$$;