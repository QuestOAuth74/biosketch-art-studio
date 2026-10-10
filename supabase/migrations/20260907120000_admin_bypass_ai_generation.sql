-- Admin bypass for deduct_ai_generation
--
-- Before this migration, deduct_ai_generation() checked grant_remaining and
-- ai_purchased_credits with no regard for admin role, so admins whose grant
-- pool and purchased balance were both empty hit INSUFFICIENT_CREDITS on
-- every AI call — even though can_user_generate() (used by the UI) reported
-- them as unlimited. This aligns the write path with the read path.
--
-- Admin generations are logged with credit_source = 'admin' so the ledger
-- distinguishes them from normal grant/purchased spends. refund_ai_generation
-- already no-ops on non-purchased sources, so refund flow is unchanged.

ALTER TABLE public.ai_generations
  DROP CONSTRAINT IF EXISTS ai_generations_credit_source_check;

ALTER TABLE public.ai_generations
  ADD CONSTRAINT ai_generations_credit_source_check
  CHECK (credit_source IN ('grant', 'purchased', 'admin'));

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

  -- Admins have unlimited generations. Log the row with credit_source='admin'
  -- and skip balance checks + the WAITING_PERIOD gate entirely.
  IF public.has_role(p_user_id, 'admin') THEN
    INSERT INTO public.ai_generations (user_id, feature, credit_source)
    VALUES (p_user_id, p_feature, 'admin')
    RETURNING id INTO v_new_id;
    RETURN v_new_id;
  END IF;

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
