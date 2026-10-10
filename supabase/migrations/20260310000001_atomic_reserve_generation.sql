-- Atomic credit reservation: inserts a usage row BEFORE generation starts.
-- Returns the new row ID on success, or NULL + error if limit exceeded.
-- The caller should DELETE the row if generation fails (rollback).
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
  current_month TEXT;
  generation_count INTEGER;
  is_admin_user BOOLEAN;
  has_premium BOOLEAN;
  approved_projects_count INTEGER;
  new_row_id UUID;
BEGIN
  current_month := to_char(now(), 'YYYY-MM');
  is_admin_user := has_role(_user_id, 'admin');

  -- Admins: always allow, still track for analytics
  IF is_admin_user THEN
    INSERT INTO ai_generation_usage (user_id, month_year, prompt, style, generation_type, generated_at)
    VALUES (_user_id, current_month, _prompt, _style, _generation_type, now())
    RETURNING id INTO new_row_id;

    RETURN jsonb_build_object(
      'reserved', true,
      'reservationId', new_row_id,
      'isAdmin', true,
      'remaining', null
    );
  END IF;

  -- Check premium status
  SELECT COUNT(*)::INTEGER INTO approved_projects_count
  FROM canvas_projects
  WHERE user_id = _user_id
    AND is_public = true
    AND approval_status = 'approved';

  has_premium := approved_projects_count >= 3;

  IF NOT has_premium THEN
    RETURN jsonb_build_object(
      'reserved', false,
      'error', 'PREMIUM_REQUIRED',
      'approvedCount', approved_projects_count,
      'needsApproved', 3 - approved_projects_count
    );
  END IF;

  -- Atomic check-and-insert using row-level locking
  -- Lock existing rows for this user+month to prevent concurrent inserts
  PERFORM 1 FROM ai_generation_usage
  WHERE user_id = _user_id AND month_year = current_month
  FOR UPDATE;

  generation_count := (
    SELECT COUNT(*)::INTEGER FROM ai_generation_usage
    WHERE user_id = _user_id AND month_year = current_month
  );

  IF generation_count >= 3 THEN
    RETURN jsonb_build_object(
      'reserved', false,
      'error', 'RATE_LIMIT_EXCEEDED',
      'used', generation_count,
      'limit', 3,
      'remaining', 0
    );
  END IF;

  -- Reserve the credit by inserting the usage row now
  INSERT INTO ai_generation_usage (user_id, month_year, prompt, style, generation_type, generated_at)
  VALUES (_user_id, current_month, _prompt, _style, _generation_type, now())
  RETURNING id INTO new_row_id;

  RETURN jsonb_build_object(
    'reserved', true,
    'reservationId', new_row_id,
    'isAdmin', false,
    'used', generation_count + 1,
    'limit', 3,
    'remaining', GREATEST(0, 2 - generation_count)
  );
END;
$$;

-- Release a reservation if generation failed (deletes the usage row)
CREATE OR REPLACE FUNCTION public.release_generation_reservation(_reservation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  DELETE FROM ai_generation_usage WHERE id = _reservation_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.reserve_generation(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_generation_reservation(UUID) TO authenticated;
