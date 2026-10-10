-- Update admin AI usage RPC to include diagram_generations
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

  UNION ALL

  SELECT
    d.id,
    d.user_id,
    d.created_at AS generated_at,
    to_char(d.created_at, 'YYYY-MM') AS month_year,
    d.prompt,
    NULL::TEXT AS style,
    'diagram' AS generation_type
  FROM diagram_generations d
  WHERE d.created_at >= _from_date
    AND d.created_at <= _to_date

  ORDER BY generated_at DESC;
END;
$$;
