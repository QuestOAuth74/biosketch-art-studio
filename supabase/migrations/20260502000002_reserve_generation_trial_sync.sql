-- Bring reserve_generation in sync with the trial-and-bonus quota model.
--
-- The previous version (20260310000001) hardcoded:
--   - PREMIUM_REQUIRED for anyone without 3+ approved projects
--   - Monthly limit of 3 (ignoring profile bonus and referral bonus credits)
--
-- After the free-trial migration (20260501000001) and referral-bonus
-- migration (20260502000001), can_user_generate now allows:
--   - Free-trial users (3 + bonus_credits lifetime)
--   - Premium users (20 base + 10 per extra approved project + profile bonus
--     + bonus_credits monthly)
--
-- reserve_generation never picked up either change, so every call from
-- functions that use atomic reservation (generate-icon-from-reference,
-- customize-icon, generate-reference-image, generate-figure-from-reference)
-- failed with PREMIUM_REQUIRED for trial users — and produced no usage row
-- in admin analytics.
--
-- This migration delegates the eligibility decision to can_user_generate so
-- the two RPCs stay aligned automatically.
CREATE OR REPLACE FUNCTION public.reserve_generation(
  _user_id UUID,
  _prompt TEXT DEFAULT '',
  _style TEXT DEFAULT '',
  _generation_type TEXT DEFAULT 'reference-image'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_month TEXT := to_char(now(), 'YYYY-MM');
  new_row_id UUID;
  q JSONB;
  q_can_generate BOOLEAN;
  q_is_admin BOOLEAN;
  q_mode TEXT;
  q_used INTEGER;
  q_limit INTEGER;
  q_remaining INTEGER;
  q_approved INTEGER;
  q_needs INTEGER;
BEGIN
  -- Single source of truth for eligibility.
  q := public.can_user_generate(_user_id);
  q_can_generate := COALESCE((q->>'canGenerate')::boolean, false);
  q_is_admin     := COALESCE((q->>'isAdmin')::boolean, false);
  q_mode         := q->>'mode';
  q_used         := COALESCE((q->>'used')::integer, 0);
  q_limit        := NULLIF(q->>'limit', '')::integer;
  q_remaining    := NULLIF(q->>'remaining', '')::integer;
  q_approved     := COALESCE((q->>'approvedCount')::integer, 0);
  q_needs        := COALESCE((q->>'needsApproved')::integer, 3 - q_approved);

  -- If can_user_generate said no, return a structured error matching the
  -- old shape so existing edge functions don't need code changes.
  IF NOT q_can_generate AND NOT q_is_admin THEN
    IF q_mode = 'trial-exhausted' THEN
      RETURN jsonb_build_object(
        'reserved', false,
        'error', 'RATE_LIMIT_EXCEEDED',
        'used', q_used,
        'limit', q_limit,
        'remaining', 0,
        'mode', 'trial-exhausted',
        'approvedCount', q_approved,
        'needsApproved', q_needs
      );
    ELSIF q_mode = 'monthly' THEN
      RETURN jsonb_build_object(
        'reserved', false,
        'error', 'RATE_LIMIT_EXCEEDED',
        'used', q_used,
        'limit', q_limit,
        'remaining', 0,
        'mode', 'monthly'
      );
    ELSE
      -- Fallback (shouldn't happen with the current can_user_generate logic,
      -- but if it ever returns canGenerate=false in some other state, treat
      -- it as a premium-required prompt).
      RETURN jsonb_build_object(
        'reserved', false,
        'error', 'PREMIUM_REQUIRED',
        'approvedCount', q_approved,
        'needsApproved', q_needs
      );
    END IF;
  END IF;

  -- Eligible — insert the usage row atomically.
  INSERT INTO ai_generation_usage (user_id, month_year, prompt, style, generation_type, generated_at)
  VALUES (_user_id, current_month, _prompt, _style, _generation_type, now())
  RETURNING id INTO new_row_id;

  RETURN jsonb_build_object(
    'reserved', true,
    'reservationId', new_row_id,
    'isAdmin', q_is_admin,
    'mode', q_mode,
    'used', q_used + 1,
    'limit', q_limit,
    'remaining', GREATEST(0, COALESCE(q_remaining, 0) - 1)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_generation(UUID, TEXT, TEXT, TEXT) TO authenticated;
