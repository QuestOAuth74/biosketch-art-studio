-- ============================================================================
-- AI Generation Credits — Phase 1
-- ============================================================================
-- Free tier: 3 generations per rolling 30 days
-- Premium tier (≥3 approved shared projects): 20 + 10 * (approved - 3) per 30d
-- Overflow: users buy generations via Stripe ($5=50, $10=120, $20=280)
--
-- Design notes:
--   * `ai_generations` is the ledger for BOTH grant and purchased usage.
--     A row = one generation event. Refunds set `refunded_at`.
--   * `profiles.ai_purchased_credits` tracks the current purchased balance.
--     Grants are computed on the fly (no separate grant balance).
--   * `deduct_ai_generation` is the only supported way to spend a generation;
--     it uses grant first (based on rolling 30d count vs monthly_grant),
--     then falls back to purchased balance. Atomic via SELECT FOR UPDATE.
--   * `refund_ai_generation` marks the row refunded and restores 1 purchased
--     credit if the original deduction was 'purchased'. Grant refunds just
--     free the slot in the 30-day window.
-- ============================================================================

-- Reset any partial state from a failed prior apply — safe because this feature
-- has never held user data (Phase 1 initial rollout).
DROP TABLE IF EXISTS public.ai_generations CASCADE;
DROP TABLE IF EXISTS public.ai_credit_purchases CASCADE;

-- 1. Ledger table --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_generations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature      text NOT NULL,
  credit_source text NOT NULL CHECK (credit_source IN ('grant', 'purchased')),
  refunded_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT NOW()
);

-- Fast lookup for grant window (rolling 30d, exclude refunded).
CREATE INDEX IF NOT EXISTS idx_ai_generations_user_active
  ON public.ai_generations (user_id, created_at DESC)
  WHERE refunded_at IS NULL;

ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;

-- Users can only see their own generation history.
DROP POLICY IF EXISTS "Users read own generations" ON public.ai_generations;
CREATE POLICY "Users read own generations"
  ON public.ai_generations FOR SELECT
  USING (auth.uid() = user_id);

-- No client writes — only via SECURITY DEFINER RPCs below.

-- 2. Purchased balance column on profiles -------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_purchased_credits int NOT NULL DEFAULT 0;

-- 3. Stripe purchases audit table ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_credit_purchases (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_session_id    text UNIQUE NOT NULL,
  amount_usd           numeric(6,2) NOT NULL,
  generations_granted  int NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ai_credit_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own purchases" ON public.ai_credit_purchases;
CREATE POLICY "Users read own purchases"
  ON public.ai_credit_purchases FOR SELECT
  USING (auth.uid() = user_id);

-- 4. RPCs ---------------------------------------------------------------------

-- 4a. Balance query — returns { approved_count, monthly_grant, grant_used,
--     grant_remaining, purchased, total_available }.
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
BEGIN
  -- Reuse the existing premium-progress RPC as the source of truth for
  -- approved-share count. Falls back to 0 if the caller has no profile row.
  SELECT COALESCE((row_to_json(p)->>'approved_count')::int, 0) INTO v_approved_count
  FROM public.get_user_premium_progress(p_user_id) AS p;

  -- Grant formula: 3 for <3 approved, else 20 + 10 * (approved - 3).
  IF v_approved_count < 3 THEN
    v_monthly_grant := 3;
  ELSE
    v_monthly_grant := 20 + (v_approved_count - 3) * 10;
  END IF;

  -- Count grant-sourced generations in rolling 30-day window (exclude refunds).
  SELECT COUNT(*) INTO v_grant_used
  FROM public.ai_generations
  WHERE user_id = p_user_id
    AND credit_source = 'grant'
    AND refunded_at IS NULL
    AND created_at > NOW() - INTERVAL '30 days';

  SELECT COALESCE(ai_purchased_credits, 0) INTO v_purchased
  FROM public.profiles
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'approved_count',   v_approved_count,
    'monthly_grant',    v_monthly_grant,
    'grant_used',       v_grant_used,
    'grant_remaining',  GREATEST(0, v_monthly_grant - v_grant_used),
    'purchased',        COALESCE(v_purchased, 0),
    'total_available',  GREATEST(0, v_monthly_grant - v_grant_used) + COALESCE(v_purchased, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ai_generation_balance(uuid) TO authenticated;

-- 4b. Atomic deduction — returns new generation_id or raises 'INSUFFICIENT_CREDITS'.
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
  -- Lock the profile row to serialize concurrent deducts for this user.
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
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.ai_generations (user_id, feature, credit_source)
  VALUES (p_user_id, p_feature, v_source)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.deduct_ai_generation(uuid, text) TO authenticated;

-- 4c. Refund — used when the downstream AI API call fails after we deducted.
CREATE OR REPLACE FUNCTION public.refund_ai_generation(p_generation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_source  text;
BEGIN
  SELECT user_id, credit_source INTO v_user_id, v_source
  FROM public.ai_generations
  WHERE id = p_generation_id AND refunded_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;  -- already refunded or nonexistent — treat as no-op (idempotent)
  END IF;

  UPDATE public.ai_generations
     SET refunded_at = NOW()
   WHERE id = p_generation_id;

  IF v_source = 'purchased' THEN
    UPDATE public.profiles
       SET ai_purchased_credits = ai_purchased_credits + 1
     WHERE id = v_user_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refund_ai_generation(uuid) TO authenticated;

-- 4d. Credit granting from Stripe webhook — SECURITY DEFINER + idempotent.
--     Called by the stripe-webhook edge function after payment succeeds.
CREATE OR REPLACE FUNCTION public.grant_purchased_credits(
  p_user_id            uuid,
  p_stripe_session_id  text,
  p_amount_usd         numeric,
  p_generations        int
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Idempotency: bail out silently if we've already processed this session.
  INSERT INTO public.ai_credit_purchases (
    user_id, stripe_session_id, amount_usd, generations_granted
  )
  VALUES (
    p_user_id, p_stripe_session_id, p_amount_usd, p_generations
  )
  ON CONFLICT (stripe_session_id) DO NOTHING;

  IF NOT FOUND THEN
    RETURN false;  -- duplicate — no credits granted
  END IF;

  UPDATE public.profiles
     SET ai_purchased_credits = COALESCE(ai_purchased_credits, 0) + p_generations
   WHERE id = p_user_id;

  RETURN true;
END;
$$;

-- Not granted to authenticated — webhook uses service role.
