-- Update can_user_generate to award bonus AI credits for profile completion
-- Each completed field (avatar_url, bio, quote) adds +1 to the monthly limit
-- Base: 3/month for premium users. Max bonus: +3 (one per field) = 6 total
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
  base_limit INTEGER := 3;
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

  -- Check if user has premium access (3+ approved public projects)
  SELECT COUNT(*)::INTEGER INTO approved_projects_count
  FROM canvas_projects
  WHERE user_id = _user_id
    AND is_public = true
    AND approval_status = 'approved';

  has_premium := approved_projects_count >= 3;

  -- Calculate profile completion bonus credits
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

  total_limit := base_limit + profile_bonus;

  -- Non-premium users cannot generate
  IF NOT has_premium THEN
    RETURN jsonb_build_object(
      'canGenerate', false,
      'isAdmin', false,
      'hasPremium', false,
      'used', 0,
      'limit', total_limit,
      'remaining', 0,
      'monthYear', current_month,
      'approvedCount', approved_projects_count,
      'needsApproved', 3 - approved_projects_count,
      'profileBonus', profile_bonus
    );
  END IF;

  -- Premium users get base + bonus generations per month
  generation_count := get_user_generation_count(_user_id, current_month);

  RETURN jsonb_build_object(
    'canGenerate', generation_count < total_limit,
    'isAdmin', false,
    'hasPremium', true,
    'used', generation_count,
    'limit', total_limit,
    'remaining', GREATEST(0, total_limit - generation_count),
    'monthYear', current_month,
    'profileBonus', profile_bonus
  );
END;
$$;
