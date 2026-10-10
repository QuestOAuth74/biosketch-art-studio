-- ============================================================================
-- AI Credit Waiting Period — 24h onboarding gate for free credits
-- ============================================================================
-- New signups burn their free monthly grant within minutes and never return.
-- Gate the grant behind a 24h waiting period so only users who stay engaged
-- long enough to still be around tomorrow can spend free credits.
--
-- Bypasses (no gate):
--   * admins
--   * users who have ever purchased credits (any row in ai_credit_purchases)
--
-- The gate is enforced server-side inside deduct_ai_generation. The client
-- reads the gate state via get_ai_generation_balance to render a countdown
-- modal before the round-trip.
-- ============================================================================

-- 1. Gate predicate ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_within_gate_period(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created_at timestamptz;
  v_has_purchased boolean;
BEGIN
  IF has_role(p_user_id, 'admin') THEN
    RETURN false;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.ai_credit_purchases WHERE user_id = p_user_id)
    INTO v_has_purchased;
  IF v_has_purchased THEN
    RETURN false;
  END IF;

  SELECT created_at INTO v_created_at FROM public.profiles WHERE id = p_user_id;
  IF v_created_at IS NULL THEN
    RETURN false;  -- no profile row yet; don't gate what we can't measure
  END IF;

  RETURN v_created_at > NOW() - INTERVAL '24 hours';
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_within_gate_period(uuid) TO authenticated;

-- 2. Enforce gate inside deduct_ai_generation --------------------------------
-- Raises WAITING_PERIOD (errcode P0002) if the user would spend a grant
-- credit but is still inside the 24h window. Purchased credits still work
-- (guard is unreachable for them because is_within_gate_period returns false
-- once they've purchased once — but we check source anyway for defense).
CREATE OR REPLACE FUNCTION public.deduct_ai_generation(
  p_user_id uuid,
  p_feature text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance jsonb;
  v_source  text;
  v_new_id  uuid;
BEGIN
  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  v_balance := public.get_ai_generation_balance(p_user_id);

  IF (v_balance->>'grant_remaining')::int > 0 THEN
    v_source := 'grant';
  ELSIF (v_balance->>'purchased')::int > 0 THEN
    v_source := 'purchased';
    UPDATE public.profiles
       SET ai_purchased_credits = ai_purchased_credits - 1
     WHERE id = p_user_id;
  ELSE
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS' USING ERRCODE = 'P0001';
  END IF;

  -- Waiting-period gate: only applies to grant spend by non-admin, non-purchaser
  -- users still within their first 24h. is_within_gate_period() encapsulates
  -- all three checks so callers can share the same predicate.
  IF v_source = 'grant' AND public.is_within_gate_period(p_user_id) THEN
    RAISE EXCEPTION 'WAITING_PERIOD' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.ai_generations (user_id, feature, credit_source)
  VALUES (p_user_id, p_feature, v_source)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.deduct_ai_generation(uuid, text) TO authenticated;

-- 3. Expose gate state via get_ai_generation_balance -------------------------
-- Extends the existing balance response with a `gate` object:
--   { "locked": true, "unlock_at": "2026-07-31T18:27:00Z" }
-- unlock_at is profiles.created_at + 24h. Locked=false when not gated.
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

  IF v_approved_count < 3 THEN
    v_monthly_grant := 3;
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
