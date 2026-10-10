-- Fix RLS policies as per milestone requirements

-- 1. Add INSERT policy for profiles table
-- Currently profiles relies only on trigger for creation, but explicit policy is better practice
CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- 2. Fix icon_categories SELECT policy to allow unauthenticated users
-- Drop existing policy that restricts to authenticated users only
DROP POLICY IF EXISTS "Authenticated users can view categories" ON public.icon_categories;

-- Create new policy allowing both authenticated and unauthenticated users
CREATE POLICY "Anyone can view icon categories"
ON public.icon_categories FOR SELECT
USING (true);

-- 3. Fix icons SELECT policy to allow unauthenticated users
-- Drop existing policy that restricts to authenticated users only
DROP POLICY IF EXISTS "Authenticated users can view icons" ON public.icons;

-- Create new policy allowing both authenticated and unauthenticated users
CREATE POLICY "Anyone can view icons"
ON public.icons FOR SELECT
USING (true);
