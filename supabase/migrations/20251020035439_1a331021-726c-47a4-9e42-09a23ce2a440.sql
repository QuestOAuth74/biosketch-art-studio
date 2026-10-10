-- Add country column to profiles table for location tracking
ALTER TABLE public.profiles 
ADD COLUMN country TEXT;

-- Add an index for better query performance on country filtering
CREATE INDEX idx_profiles_country ON public.profiles(country);

-- Add a comment to document the column
COMMENT ON COLUMN public.profiles.country IS 'User location/country information (optional)';