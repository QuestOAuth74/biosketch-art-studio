-- ============================================================================
-- Admin-only RPC: revoke AI generation credits from a user.
--
-- Reverses purchased credits — used when Stripe issued a refund, admin granted
-- too many, or for anti-abuse. Cannot revoke below zero: request is clamped to
-- the user's current `ai_purchased_credits` balance and the actual number
-- revoked is returned to the caller.
--
-- Audit: inserts a row into `ai_credit_purchases` with negative
-- `generations_granted` and `stripe_session_id = 'admin-revoke:<uuid>'` so it
-- shows up in the target user's Purchase History for full transparency.
--
-- Only touches `ai_purchased_credits`. The rolling grant window is not
-- affected — grants can't be revoked (they auto-refresh).
--
-- SECURITY: admin-only via has_role().
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_revoke_ai_credits(
  p_target_user_id uuid,
  p_generations    int,
  p_reason         text DEFAULT NULL
)
RETURNS int          -- number of credits actually revoked (may be less than requested)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id  text;
  v_current     int;
  v_to_revoke   int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF p_generations IS NULL OR p_generations <= 0 THEN
    RAISE EXCEPTION 'generations must be positive' USING ERRCODE = '22023';
  END IF;

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id required' USING ERRCODE = '22023';
  END IF;

  -- Lock the profile row and read the current balance under that lock so a
  -- concurrent purchase / deduction can't race us.
  SELECT COALESCE(ai_purchased_credits, 0) INTO v_current
    FROM public.profiles
   WHERE id = p_target_user_id
   FOR UPDATE;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'user profile not found' USING ERRCODE = '22023';
  END IF;

  v_to_revoke := LEAST(v_current, p_generations);
  IF v_to_revoke = 0 THEN
    RETURN 0;   -- nothing to do — user had no purchased credits
  END IF;

  v_session_id := 'admin-revoke:' || gen_random_uuid()::text;

  INSERT INTO public.ai_credit_purchases (
    user_id, stripe_session_id, amount_usd, generations_granted
  )
  VALUES (p_target_user_id, v_session_id, 0, -v_to_revoke);

  UPDATE public.profiles
     SET ai_purchased_credits = v_current - v_to_revoke
   WHERE id = p_target_user_id;

  PERFORM p_reason;   -- reason isn't persisted (no column yet)

  RETURN v_to_revoke;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_revoke_ai_credits(uuid, int, text) TO authenticated;
