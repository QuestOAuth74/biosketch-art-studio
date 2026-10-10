-- Free-trial AI access: every signed-in user gets 3 lifetime AI generations
-- before being asked to share 3 projects to unlock full monthly credits.
--
-- After 3 lifetime uses (counted across ALL ai_generation_usage rows for the
-- user), free users are blocked and prompted to share 3 approved projects to
-- unlock the existing premium monthly system (20 base + 10 per extra approved
-- project + profile completion bonus).
--
-- Adds a "mode" field to the response so the UI can distinguish:
--   admin            — unlimited
--   trial            — using free lifetime generations
--   trial-exhausted  — used all 3 trial; must share to continue
--   monthly          — premium (3+ approved projects); existing monthly logic
CREATE OR REPLACE FUNCTION public.can_user_generate(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_month TEXT;
  generation_count INTEGER;
  lifetime_count INTEGER;
  is_admin_user BOOLEAN;
  has_premium BOOLEAN;
  approved_projects_count INTEGER;
  profile_bonus INTEGER;
  base_limit INTEGER;
  extra_project_credits INTEGER;
  total_limit INTEGER;
  trial_limit INTEGER := 3;
  p_avatar TEXT;
  p_bio TEXT;
  p_quote TEXT;
BEGIN
  current_month := to_char(now(), 'YYYY-MM');
  is_admin_user := has_role(_user_id, 'admin');

  -- Admins: unlimited
  IF is_admin_user THEN
    RETURN jsonb_build_object(
      'canGenerate', true,
      'isAdmin', true,
      'hasPremium', true,
      'mode', 'admin',
      'used', 0,
      'limit', null,
      'remaining', null,
      'trialRemaining', null,
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

  -- Profile completion bonus
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

  -- Free (non-premium) users: 3-generation lifetime trial
  IF NOT has_premium THEN
    SELECT COUNT(*)::INTEGER INTO lifetime_count
    FROM ai_generation_usage
    WHERE user_id = _user_id;

    IF lifetime_count < trial_limit THEN
      RETURN jsonb_build_object(
        'canGenerate', true,
        'isAdmin', false,
        'hasPremium', false,
        'mode', 'trial',
        'used', lifetime_count,
        'limit', trial_limit,
        'remaining', trial_limit - lifetime_count,
        'trialRemaining', trial_limit - lifetime_count,
        'monthYear', current_month,
        'approvedCount', approved_projects_count,
        'needsApproved', 3 - approved_projects_count,
        'profileBonus', profile_bonus
      );
    ELSE
      RETURN jsonb_build_object(
        'canGenerate', false,
        'isAdmin', false,
        'hasPremium', false,
        'mode', 'trial-exhausted',
        'used', lifetime_count,
        'limit', trial_limit,
        'remaining', 0,
        'trialRemaining', 0,
        'monthYear', current_month,
        'approvedCount', approved_projects_count,
        'needsApproved', 3 - approved_projects_count,
        'profileBonus', profile_bonus
      );
    END IF;
  END IF;

  -- Premium users: monthly credits (20 base + 10 per extra approved project + profile bonus)
  base_limit := 20;
  extra_project_credits := (approved_projects_count - 3) * 10;
  total_limit := base_limit + extra_project_credits + profile_bonus;

  generation_count := get_user_generation_count(_user_id, current_month);

  RETURN jsonb_build_object(
    'canGenerate', generation_count < total_limit,
    'isAdmin', false,
    'hasPremium', true,
    'mode', 'monthly',
    'used', generation_count,
    'limit', total_limit,
    'remaining', GREATEST(0, total_limit - generation_count),
    'trialRemaining', null,
    'monthYear', current_month,
    'approvedCount', approved_projects_count,
    'profileBonus', profile_bonus
  );
END;
$$;
