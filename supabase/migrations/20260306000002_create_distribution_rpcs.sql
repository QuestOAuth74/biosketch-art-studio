-- RPC to get country distribution across ALL users
CREATE OR REPLACE FUNCTION get_country_distribution()
RETURNS TABLE (
  country TEXT,
  count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(p.country, 'Unknown') AS country,
    COUNT(*) AS count
  FROM profiles p
  GROUP BY p.country
  ORDER BY count DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_country_distribution() TO authenticated;

-- RPC to get field of study distribution across ALL users
CREATE OR REPLACE FUNCTION get_field_distribution()
RETURNS TABLE (
  field TEXT,
  count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(p.field_of_study, 'Not specified') AS field,
    COUNT(*) AS count
  FROM profiles p
  GROUP BY p.field_of_study
  ORDER BY count DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_field_distribution() TO authenticated;
