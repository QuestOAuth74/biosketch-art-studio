-- Remove free starting credits for non-premium users.
--
-- Policy change (owner directive):
--   • New users and users with < 3 approved public projects no longer
--     receive the 3-generation free starting allowance.
--   • Credits are earned by either:
--       (a) sharing 3 approved projects to the community (premium tier
--           kicks in at 20 base + 10 per extra approved — unchanged), or
--       (b) buying an AI add-on (Stripe tiers — unchanged).
--   • Referral bonus credits (profiles.bonus_credits, +3 per invite,
--     1/month cap) still apply — the owner wants viral growth preserved.
--   • Profile completion bonus (+1 per filled field, max +3) still
--     applies but is already gated to premium users only.
--
-- Both the ledger-based balance function (get_ai_generation_balance)
-- and the legacy quota function (can_user_generate, still called by
-- several edge functions) must be updated in lockstep, or the two
-- gates drift and users slip through one while being blocked by the
-- other.

-- ── get_ai_generation_balance ────────────────────────────────────
-- Previously: v_monthly_grant := 3 when approved_count < 3.
-- Now:        v_monthly_grant := 0 when approved_count < 3.
-- Formula for premium (approved_count >= 3) is unchanged.
CREATE OR REPLACE FUNCTION public.get_ai_generation_balance(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_approved_count int;
  v_monthly_grant  int;
  v_grant_used     int;
  v_purchased      int;
  v_locked         boolean;
  v_unlock_at      timestamptz;
  v_created_at     timestamptz;
BEGIN
  SELECT COALESCE((row_to_json(p)->>'approved_count')::int, 0) INTO v_approved_count
  FROM public.get_user_premium_progress(p_user_id) AS p;

  -- Free users (fewer than 3 approved public projects) now receive
  -- zero starting / monthly grant generations. They can only generate
  -- via purchased credits or by crossing the 3-approved threshold.
  IF v_approved_count < 3 THEN
    v_monthly_grant := 0;
  ELSE
    v_monthly_grant := 20 + (v_approved_count - 3) * 10;
  END IF;

  SELECT COUNT(*) INTO v_grant_used
  FROM public.ai_generations
  WHERE user_id = p_user_id
    AND credit_source = 'grant'
    AND refunded_at IS NULL
    AND created_at > NOW() - INTERVAL '30 days';

  SELECT COALESCE(ai_purchased_credits, 0) INTO v_purchased
  FROM public.profiles
  WHERE id = p_user_id;

  v_locked := public.is_within_gate_period(p_user_id);
  IF v_locked THEN
    SELECT created_at INTO v_created_at FROM public.profiles WHERE id = p_user_id;
    v_unlock_at := v_created_at + INTERVAL '24 hours';
  END IF;

  RETURN jsonb_build_object(
    'approved_count',   v_approved_count,
    'monthly_grant',    v_monthly_grant,
    'grant_used',       v_grant_used,
    'grant_remaining',  GREATEST(0, v_monthly_grant - v_grant_used),
    'purchased',        COALESCE(v_purchased, 0),
    'total_available',  GREATEST(0, v_monthly_grant - v_grant_used) + COALESCE(v_purchased, 0),
    'gate', jsonb_build_object(
      'locked',    v_locked,
      'unlock_at', v_unlock_at
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ai_generation_balance(uuid) TO authenticated;


-- ── can_user_generate (legacy, still called from several edge
--     functions: ai-illustrator, chart-studio-ai, generate-powerpoint,
--     generate-scientific-diagram, extract-image-text,
--     segment-image-objects). Trial allowance set to 0 so the two
--     paths agree. Referral bonus credits still extend the cap. ──
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
  trial_limit INTEGER := 0;  -- Was 3. Non-premium users now start at 0.
  bonus_credits_amt INTEGER := 0;
  p_avatar TEXT;
  p_bio TEXT;
  p_quote TEXT;
BEGIN
  current_month := to_char(now(), 'YYYY-MM');
  is_admin_user := has_role(_user_id, 'admin');

  IF is_admin_user THEN
    RETURN jsonb_build_object(
      'canGenerate', true, 'isAdmin', true, 'hasPremium', true, 'mode', 'admin',
      'used', 0, 'limit', null, 'remaining', null, 'trialRemaining', null,
      'bonusCredits', 0, 'monthYear', current_month
    );
  END IF;

  SELECT COUNT(*)::INTEGER INTO approved_projects_count
  FROM canvas_projects
  WHERE user_id = _user_id AND is_public = true AND approval_status = 'approved';
  has_premium := approved_projects_count >= 3;

  SELECT avatar_url, bio, quote, COALESCE(bonus_credits, 0)
  INTO p_avatar, p_bio, p_quote, bonus_credits_amt
  FROM profiles WHERE id = _user_id;

  profile_bonus := 0;
  IF p_avatar IS NOT NULL AND p_avatar <> '' THEN profile_bonus := profile_bonus + 1; END IF;
  IF p_bio IS NOT NULL AND length(trim(p_bio)) >= 10 THEN profile_bonus := profile_bonus + 1; END IF;
  IF p_quote IS NOT NULL AND length(trim(p_quote)) >= 5 THEN profile_bonus := profile_bonus + 1; END IF;

  IF NOT has_premium THEN
    SELECT COUNT(*)::INTEGER INTO lifetime_count
    FROM ai_generation_usage WHERE user_id = _user_id;

    -- Trial cap for non-premium users is now trial_limit (0) + any
    -- bonus_credits earned from successful referrals. Users with no
    -- referrals and no premium status cannot generate for free.
    DECLARE
      effective_trial_limit INTEGER := trial_limit + bonus_credits_amt;
    BEGIN
      IF lifetime_count < effective_trial_limit THEN
        RETURN jsonb_build_object(
          'canGenerate', true, 'isAdmin', false, 'hasPremium', false,
          'mode', CASE WHEN bonus_credits_amt > 0 THEN 'trial+bonus' ELSE 'trial' END,
          'used', lifetime_count, 'limit', effective_trial_limit,
          'remaining', effective_trial_limit - lifetime_count,
          'trialRemaining', effective_trial_limit - lifetime_count,
          'bonusCredits', bonus_credits_amt,
          'monthYear', current_month,
          'approvedCount', approved_projects_count,
          'needsApproved', 3 - approved_projects_count,
          'profileBonus', profile_bonus
        );
      ELSE
        RETURN jsonb_build_object(
          'canGenerate', false, 'isAdmin', false, 'hasPremium', false,
          'mode', CASE WHEN bonus_credits_amt > 0 THEN 'trial+bonus_exhausted' ELSE 'trial_exhausted' END,
          'used', lifetime_count, 'limit', effective_trial_limit,
          'remaining', 0, 'trialRemaining', 0,
          'bonusCredits', bonus_credits_amt,
          'monthYear', current_month,
          'approvedCount', approved_projects_count,
          'needsApproved', 3 - approved_projects_count,
          'profileBonus', profile_bonus
        );
      END IF;
    END;
  END IF;

  -- Premium path (3+ approved projects) is unchanged.
  SELECT COUNT(*)::INTEGER INTO generation_count
  FROM ai_generation_usage
  WHERE user_id = _user_id
    AND to_char(created_at, 'YYYY-MM') = current_month;

  base_limit := 20;
  extra_project_credits := GREATEST(0, approved_projects_count - 3) * 10;
  total_limit := base_limit + extra_project_credits + profile_bonus + bonus_credits_amt;

  RETURN jsonb_build_object(
    'canGenerate', generation_count < total_limit,
    'isAdmin', false,
    'hasPremium', true,
    'mode', 'premium',
    'used', generation_count,
    'limit', total_limit,
    'remaining', GREATEST(0, total_limit - generation_count),
    'trialRemaining', null,
    'bonusCredits', bonus_credits_amt,
    'baseLimit', base_limit,
    'extraProjectCredits', extra_project_credits,
    'profileBonus', profile_bonus,
    'monthYear', current_month,
    'approvedCount', approved_projects_count,
    'needsApproved', 0
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_user_generate(uuid) TO authenticated;
