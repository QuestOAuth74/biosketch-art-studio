-- Update credit calculation:
-- Premium (3+ approved projects): 20 base + 10 per additional project beyond 3 + profile bonus
-- Non-premium: 0 generations (must earn premium first)
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
  profile_bonus INTEGER;
  base_limit INTEGER;
  extra_project_credits INTEGER;
  total_limit INTEGER;
  p_avatar TEXT;
  p_bio TEXT;
  p_quote TEXT;
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

  -- Count approved public projects
  SELECT COUNT(*)::INTEGER INTO approved_projects_count
  FROM canvas_projects
  WHERE user_id = _user_id
    AND is_public = true
    AND approval_status = 'approved';

  has_premium := approved_projects_count >= 3;

  -- Calculate profile completion bonus credits (up to 3 extra)
  SELECT avatar_url, bio, quote
  INTO p_avatar, p_bio, p_quote
  FROM profiles
  WHERE id = _user_id;

  profile_bonus := 0;
  IF p_avatar IS NOT NULL AND p_avatar <> '' THEN
    profile_bonus := profile_bonus + 1;
  END IF;
  IF p_bio IS NOT NULL AND length(trim(p_bio)) >= 10 THEN
    profile_bonus := profile_bonus + 1;
  END IF;
  IF p_quote IS NOT NULL AND length(trim(p_quote)) >= 5 THEN
    profile_bonus := profile_bonus + 1;
  END IF;

  -- Non-premium users cannot generate
  IF NOT has_premium THEN
    RETURN jsonb_build_object(
      'canGenerate', false,
      'isAdmin', false,
      'hasPremium', false,
      'used', 0,
      'limit', 0,
      'remaining', 0,
      'monthYear', current_month,
      'approvedCount', approved_projects_count,
      'needsApproved', 3 - approved_projects_count,
      'profileBonus', profile_bonus
    );
  END IF;

  -- Premium credit calculation:
  -- Base: 20 credits for having 3 approved projects
  -- Extra: 10 credits per additional approved project beyond 3
  -- Profile bonus: up to 3 extra credits for completing profile
  base_limit := 20;
  extra_project_credits := (approved_projects_count - 3) * 10;
  total_limit := base_limit + extra_project_credits + profile_bonus;

  generation_count := get_user_generation_count(_user_id, current_month);

  RETURN jsonb_build_object(
    'canGenerate', generation_count < total_limit,
    'isAdmin', false,
    'hasPremium', true,
    'used', generation_count,
    'limit', total_limit,
    'remaining', GREATEST(0, total_limit - generation_count),
    'monthYear', current_month,
    'approvedCount', approved_projects_count,
    'profileBonus', profile_bonus
  );
END;
$$;
