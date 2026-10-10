-- =====================================================
-- Part 1: Create SECURITY DEFINER function to safely access profiles
-- =====================================================

-- This function bypasses RLS on the profiles table while only exposing safe columns
-- It maintains the same logic as the old "Public project creators are viewable by all" policy
-- but without exposing the email column
CREATE OR REPLACE FUNCTION public.get_all_public_profiles()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  country TEXT,
  field_of_study TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  quote TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
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
  WHERE user_has_public_projects(id);
$$;

GRANT EXECUTE ON FUNCTION public.get_all_public_profiles() TO anon, authenticated;

COMMENT ON FUNCTION public.get_all_public_profiles IS
  'SECURITY DEFINER function that returns public profile data (excluding email) for users with public approved projects.
   This function bypasses RLS on the profiles table while maintaining security by only exposing safe columns.
   Used internally by the public_profiles view.';

-- =====================================================
-- Part 2: Create public_profiles view (safe public access)
-- =====================================================

-- Drop and recreate the view to ensure it's up to date
DROP VIEW IF EXISTS public.public_profiles;

-- View now uses the SECURITY DEFINER function, so it works without needing RLS policy on profiles
CREATE VIEW public.public_profiles AS
SELECT * FROM get_all_public_profiles();

-- Grant access to the view
GRANT SELECT ON public.public_profiles TO anon, authenticated;

COMMENT ON VIEW public.public_profiles IS
  'Safe public view of profiles that excludes sensitive information like email addresses.
   Use this view for public-facing profile displays.
   This view uses a SECURITY DEFINER function internally to bypass RLS while maintaining security.';

-- =====================================================
-- Part 3: Create get_public_profile() helper function
-- =====================================================

-- Single-user lookup function that also uses SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION public.get_public_profile(user_id_param UUID)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  country TEXT,
  field_of_study TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  quote TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
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
  WHERE id = user_id_param
    AND user_has_public_projects(user_id_param);
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profile(UUID) TO anon, authenticated;

COMMENT ON FUNCTION public.get_public_profile IS
  'SECURITY DEFINER function to safely retrieve public profile data for a specific user.
   Returns profile data (excluding email) only if the user has public approved projects.
   This function bypasses RLS on the profiles table while maintaining security.';

-- =====================================================
-- Part 4: Drop the insecure public RLS policy
-- =====================================================

-- Drop the overly permissive public SELECT policy on profiles table
-- This policy allowed anyone to SELECT entire rows (including email) for users with public projects
-- Going forward, public access MUST use public_profiles view or get_public_profile() function
-- These now use SECURITY DEFINER functions that bypass RLS while only exposing safe columns
DROP POLICY IF EXISTS "Public project creators are viewable by all" ON profiles;

-- =====================================================
-- Part 5: Document the security model
-- =====================================================

COMMENT ON TABLE public.profiles IS
  'User profile data including sensitive information like email addresses.

   Security Model:
   - Authenticated users can view/edit their own profiles (RLS: auth.uid() = id)
   - Admins can view all profiles (RLS: has_role function)
   - Public access MUST use public_profiles view or get_public_profile() function
   - Direct table access is restricted to prevent email exposure

   The public_profiles view uses SECURITY DEFINER functions to bypass RLS
   while only exposing safe columns (excluding email). This approach provides
   both security (no email exposure) and functionality (public profiles work).';

COMMENT ON COLUMN public.profiles.email IS
  'SENSITIVE: Email address. Only visible to profile owner and admins.
   Never expose in public queries. Use public_profiles view for public access.
   The view uses SECURITY DEFINER functions to prevent email exposure.';
