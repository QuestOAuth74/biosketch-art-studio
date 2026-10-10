-- RPC function for admin to fetch AI generation usage (bypasses RLS)
CREATE OR REPLACE FUNCTION get_admin_ai_usage(
  _from_date TIMESTAMPTZ,
  _to_date TIMESTAMPTZ
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  generated_at TIMESTAMPTZ,
  month_year TEXT,
  prompt TEXT,
  style TEXT,
  generation_type TEXT
)
LANGUAGE PLPGSQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can call this
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.user_id,
    a.generated_at,
    a.month_year,
    a.prompt,
    a.style,
    a.generation_type
  FROM ai_generation_usage a
  WHERE a.generated_at >= _from_date
    AND a.generated_at <= _to_date
  ORDER BY a.generated_at DESC;
END;
$$;
