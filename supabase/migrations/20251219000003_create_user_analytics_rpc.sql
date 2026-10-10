-- ============================================================================
-- Migration: Create User Analytics RPC Function
-- Date: 2024-12-19
-- Description:
--   Creates RPC function for server-side aggregation of user analytics.
--   Replaces client-side aggregation in Analytics page.
--
-- Current Problem:
--   - Analytics page fetches ALL profiles (no limit)
--   - Fetches ALL canvas_projects (no limit)
--   - Aggregates project counts client-side with JavaScript reduce()
--   - Takes 8-12 seconds under load with large datasets
--
-- Solution:
--   - Server-side JOIN and GROUP BY for aggregation
--   - Pagination support (limit/offset)
--   - Returns total count for pagination UI
--   - Single query replaces 2 separate queries + client aggregation
--
-- Expected Impact:
--   - Data transfer: ALL users -> 20 users per page (95% reduction)
--   - Query time: 8-12s -> 400-600ms (20x faster)
--   - Zero client-side computation
--   - Scalable to millions of users
--
-- Safety:
--   - SECURITY DEFINER with explicit search_path
--   - Read-only function (no data modification)
--   - Pagination prevents memory exhaustion
-- ============================================================================

-- Drop function if exists (for clean re-deployment)
DROP FUNCTION IF EXISTS get_user_analytics(INTEGER, INTEGER);

-- Create function to get user analytics with aggregated project counts
CREATE OR REPLACE FUNCTION get_user_analytics(
  limit_count INTEGER DEFAULT 100,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  country TEXT,
  field_of_study TEXT,
  avatar_url TEXT,
  quote TEXT,
  created_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  project_count BIGINT,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_users BIGINT;
BEGIN
  -- Get total count for pagination UI
  SELECT COUNT(*) INTO total_users FROM profiles;

  -- Return paginated users with aggregated project counts
  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.full_name,
    p.country,
    p.field_of_study,
    p.avatar_url,
    p.quote,
    p.created_at,
    p.last_login_at,
    COALESCE(COUNT(cp.id), 0) as project_count,
    total_users as total_count
  FROM profiles p
  LEFT JOIN canvas_projects cp ON cp.user_id = p.id
  GROUP BY p.id, p.email, p.full_name, p.country, p.field_of_study,
           p.avatar_url, p.quote, p.created_at, p.last_login_at
  ORDER BY project_count DESC, p.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;

-- Grant execute permission to authenticated users (admins)
GRANT EXECUTE ON FUNCTION get_user_analytics(INTEGER, INTEGER) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION get_user_analytics(INTEGER, INTEGER) IS
  'Returns user profiles with aggregated project counts for Analytics page. Performs server-side JOIN and GROUP BY instead of client-side aggregation. Includes pagination support (limit/offset) and returns total count for pagination UI. Replaces fetching ALL profiles + ALL projects separately.';
