-- Add bio column to profiles table for author profiles
ALTER TABLE public.profiles 
ADD COLUMN bio TEXT;

COMMENT ON COLUMN public.profiles.bio IS 'Author bio displayed on public author profile page (max 500 characters)';