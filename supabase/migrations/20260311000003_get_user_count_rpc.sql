-- Simple RPC to return total user count for social proof on auth page.
-- SECURITY DEFINER so it bypasses RLS. Returns only a count, no PII.

CREATE OR REPLACE FUNCTION public.get_user_count()
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COUNT(*) FROM profiles;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_count() TO anon, authenticated;

COMMENT ON FUNCTION public.get_user_count() IS
  'Returns the total number of registered users. Safe for public use — exposes only a count.';
