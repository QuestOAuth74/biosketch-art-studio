-- RPC to return count of users active within a given number of hours.
-- SECURITY DEFINER so it bypasses RLS. Returns only a count, no PII.

CREATE OR REPLACE FUNCTION public.get_active_user_count(hours_ago INT DEFAULT 6)
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COUNT(*) FROM profiles
  WHERE last_login_at IS NOT NULL
    AND last_login_at >= NOW() - (hours_ago * INTERVAL '1 hour');
$$;

GRANT EXECUTE ON FUNCTION public.get_active_user_count(INT) TO anon, authenticated;

COMMENT ON FUNCTION public.get_active_user_count(INT) IS
  'Returns the count of users who logged in within the given number of hours. Safe for public use — exposes only a count.';
