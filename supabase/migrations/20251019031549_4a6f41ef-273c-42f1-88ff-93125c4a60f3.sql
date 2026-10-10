-- Add quote field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS quote TEXT;