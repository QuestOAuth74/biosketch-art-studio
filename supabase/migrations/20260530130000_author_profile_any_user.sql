-- Function that returns the safe public-profile fields for ANY user,
-- regardless of whether they have any public approved projects.
--
-- Background: get_public_profile() (added in 20251220233622) is gated
-- by user_has_public_projects(), which hides users whose projects are
-- all private from the author profile page. The Community page's new
-- "Recently Creating" tab links to /author/<user_id> for those users
-- too, so we need a function that doesn't gate on public projects.
-- The AuthorProfile page renders its own "No public projects yet"
-- empty state when projects come back empty.
--
-- Exposes only the same safe columns as get_public_profile — never
-- the email column. SECURITY DEFINER required to bypass profiles RLS.

CREATE OR REPLACE FUNCTION public.get_author_profile(p_user_id UUID)
RETURNS TABLE (
  id              UUID,
  full_name       TEXT,
  avatar_url      TEXT,
  bio             TEXT,
  country         TEXT,
  field_of_study  TEXT,
  created_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ,
  quote           TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    id,
    full_name,
    avatar_url,
    bio,
    country,
    field_of_study,
    created_at,
    updated_at,
    quote
  FROM public.profiles
  WHERE id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_author_profile(UUID) TO anon, authenticated;

COMMENT ON FUNCTION public.get_author_profile IS
  'Returns safe public profile fields for any user_id, without gating on whether
   they have public projects. The AuthorProfile page handles the empty
   public-projects case via its own UI. Never exposes the email column.';
