-- Referral bonus credits — invite a friend, earn 3 AI generation credits.
-- Cap: at most one bonus per inviter per calendar month.

-- ── 1. Profile columns ──
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bonus_credits integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_referral_bonus_month text;

-- ── 2. Audit table ──
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bonus_awarded boolean NOT NULL DEFAULT false,
  awarded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invitee_id) -- a user can only be referred once
);

CREATE INDEX IF NOT EXISTS referrals_inviter_idx ON public.referrals (inviter_id);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Inviter can read their own referrals
CREATE POLICY "Inviters can view their referrals" ON public.referrals
  FOR SELECT USING (auth.uid() = inviter_id);

-- ── 3. claim_referral_bonus RPC ──
-- Called from the frontend right after a successful signup when a ref code
-- was present. Inserts the referral row and, if the inviter has not yet
-- earned a bonus this calendar month, adds 10 to their bonus_credits and
-- updates last_referral_bonus_month.
CREATE OR REPLACE FUNCTION public.claim_referral_bonus(_inviter_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_month text := to_char(now(), 'YYYY-MM');
  inviter_last_month text;
  bonus_awarded boolean := false;
  invitee_id uuid := auth.uid();
BEGIN
  -- Auth check: must be a real signed-in user, and they can't refer themselves.
  IF invitee_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF invitee_id = _inviter_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'self_referral');
  END IF;

  -- Inviter must exist as a real profile.
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _inviter_id) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'inviter_not_found');
  END IF;

  -- Insert audit row. ON CONFLICT means the invitee was already referred by
  -- someone — we don't double-count.
  INSERT INTO public.referrals (inviter_id, invitee_id)
  VALUES (_inviter_id, invitee_id)
  ON CONFLICT (invitee_id) DO NOTHING;

  -- Check if inviter has already earned a bonus this month.
  SELECT last_referral_bonus_month INTO inviter_last_month
  FROM public.profiles
  WHERE id = _inviter_id;

  IF inviter_last_month IS DISTINCT FROM current_month THEN
    -- Award 3 credits, mark month, mark referral as bonused.
    UPDATE public.profiles
    SET bonus_credits = bonus_credits + 3,
        last_referral_bonus_month = current_month
    WHERE id = _inviter_id;

    UPDATE public.referrals
    SET bonus_awarded = true,
        awarded_at = now()
    WHERE inviter_id = _inviter_id AND invitee_id = invitee_id;

    bonus_awarded := true;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'bonus_awarded', bonus_awarded,
    'reason', CASE WHEN bonus_awarded THEN 'first_of_month' ELSE 'cap_reached' END
  );
END;
$$;

-- ── 4. Update can_user_generate to include bonus_credits ──
-- Bonus credits are PERMANENT (lifetime additive). They extend whatever
-- limit the user already has — works for trial users (3 → 13 → 23) and
-- for premium users (monthly limit + 10 per referred friend).
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

    -- Free trial limit is 3 base + bonus_credits (each successful referral
    -- adds 3 to bonus_credits, capped at 1 referral bonus per month).
    -- Bonus credits are LIFETIME — they extend the trial cap permanently.
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
          'mode', 'trial-exhausted',
          'used', lifetime_count, 'limit', effective_trial_limit, 'remaining', 0,
          'trialRemaining', 0, 'bonusCredits', bonus_credits_amt,
          'monthYear', current_month,
          'approvedCount', approved_projects_count,
          'needsApproved', 3 - approved_projects_count,
          'profileBonus', profile_bonus
        );
      END IF;
    END;
  END IF;

  -- Premium users: monthly credits + bonus_credits (each referral adds 3,
  -- capped at 1/month). Bonus is LIFETIME, so it adds to every month's
  -- allowance — fair reward for bringing in new users.
  base_limit := 20;
  extra_project_credits := (approved_projects_count - 3) * 10;
  total_limit := base_limit + extra_project_credits + profile_bonus + bonus_credits_amt;

  generation_count := get_user_generation_count(_user_id, current_month);

  RETURN jsonb_build_object(
    'canGenerate', generation_count < total_limit,
    'isAdmin', false, 'hasPremium', true, 'mode', 'monthly',
    'used', generation_count, 'limit', total_limit,
    'remaining', GREATEST(0, total_limit - generation_count),
    'trialRemaining', null, 'bonusCredits', bonus_credits_amt,
    'monthYear', current_month,
    'approvedCount', approved_projects_count,
    'profileBonus', profile_bonus
  );
END;
$$;
