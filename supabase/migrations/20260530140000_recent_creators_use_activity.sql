-- Update get_recent_project_creators to rank by the most recent
-- ACTIVITY on a project (GREATEST of created_at, updated_at) rather
-- than just creation timestamp. With the old definition, editing an
-- existing project never bumped that user up the list, which made
-- the Recently Creating tab look frozen for active users.
--
-- Output shape is unchanged so the client doesn't need a code change
-- to match. latest_project_at now means "most recent activity on any
-- of this user's projects" (insert or update), which matches what
-- the UI label "Recently Creating" implies.

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
      MAX(GREATEST(cp.created_at, cp.updated_at)) AS latest_project_at
    FROM public.canvas_projects cp
    WHERE COALESCE(cp.is_brush, false) = false
    GROUP BY cp.user_id
    ORDER BY MAX(GREATEST(cp.created_at, cp.updated_at)) DESC
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
