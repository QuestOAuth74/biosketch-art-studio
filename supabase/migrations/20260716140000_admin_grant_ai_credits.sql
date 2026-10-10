-- ============================================================================
-- Admin-only RPC: grant AI generation credits to any user.
--
-- Used for support / promo / apology grants. Records the grant in the same
-- `ai_credit_purchases` audit table so it shows up on the target user's
-- purchase history page (with amount_usd = 0). The stripe_session_id has a
-- fixed `admin-grant:` prefix so it can't collide with real Stripe sessions.
--
-- SECURITY: only callable by users with the 'admin' role (via has_role()).
-- Non-admin callers get 'FORBIDDEN'.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_grant_ai_credits(
  p_target_user_id uuid,
  p_generations    int,
  p_reason         text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id text;
  v_row_id     uuid;
BEGIN
  -- Caller must be admin.
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN'
      USING ERRCODE = '42501';  -- insufficient_privilege
  END IF;

  IF p_generations IS NULL OR p_generations <= 0 THEN
    RAISE EXCEPTION 'generations must be positive'
      USING ERRCODE = '22023';
  END IF;

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id required'
      USING ERRCODE = '22023';
  END IF;

  -- Unique session id per grant (satisfies UNIQUE constraint on stripe_session_id).
  v_session_id := 'admin-grant:' || gen_random_uuid()::text;

  INSERT INTO public.ai_credit_purchases (
    user_id, stripe_session_id, amount_usd, generations_granted
  )
  VALUES (p_target_user_id, v_session_id, 0, p_generations)
  RETURNING id INTO v_row_id;

  UPDATE public.profiles
     SET ai_purchased_credits = COALESCE(ai_purchased_credits, 0) + p_generations
   WHERE id = p_target_user_id;

  -- Reason isn't currently persisted (no column). Kept as parameter so we can
  -- add it later without changing the client-facing API.
  PERFORM p_reason;

  RETURN v_row_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_grant_ai_credits(uuid, int, text) TO authenticated;
