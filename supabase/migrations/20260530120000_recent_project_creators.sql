-- Function that returns the most recent N distinct users who have
-- created any project, across BOTH public and private projects.
-- Used by the community page's "Recent Project Creators" tab.
--
-- Privacy note: this DELIBERATELY surfaces users whose projects are
-- all private. We expose only their public-profile fields (name +
-- avatar) plus the timestamp of their most recent project creation
-- — never project title, content, or count. SECURITY DEFINER is
-- required because canvas_projects RLS would otherwise hide other
-- users' private rows from authenticated callers.

CREATE OR REPLACE FUNCTION public.get_recent_project_creators(p_limit INT DEFAULT 20)
RETURNS TABLE (
  user_id            UUID,
  full_name          TEXT,
  avatar_url         TEXT,
  latest_project_at  TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH latest_per_user AS (
    SELECT
      cp.user_id,
      MAX(cp.created_at) AS latest_project_at
    FROM public.canvas_projects cp
    WHERE COALESCE(cp.is_brush, false) = false
    GROUP BY cp.user_id
    ORDER BY MAX(cp.created_at) DESC
    LIMIT p_limit
  )
  SELECT
    l.user_id,
    p.full_name,
    p.avatar_url,
    l.latest_project_at
  FROM latest_per_user l
  LEFT JOIN public.profiles p ON p.id = l.user_id
  ORDER BY l.latest_project_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_recent_project_creators(INT) TO anon, authenticated;

COMMENT ON FUNCTION public.get_recent_project_creators IS
  'Returns the N most recent distinct users to have created any canvas project, public or private.
   Exposes only (user_id, full_name, avatar_url, latest_project_at) — no project content.
   SECURITY DEFINER because canvas_projects RLS hides other users private rows from authenticated callers.';
