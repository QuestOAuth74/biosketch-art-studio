-- Create a SECURITY DEFINER function to return the latest signup info
-- This bypasses RLS on the profiles table so any visitor can see the most
-- recent signup (country, field_of_study, created_at only — no PII exposed).

CREATE OR REPLACE FUNCTION public.get_latest_signup()
RETURNS TABLE(country text, field_of_study text, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT p.country, p.field_of_study, p.created_at
  FROM public.profiles p
  ORDER BY p.created_at DESC
  LIMIT 1;
$$;

-- Allow anonymous and authenticated users to call this function
GRANT EXECUTE ON FUNCTION public.get_latest_signup() TO anon, authenticated;
