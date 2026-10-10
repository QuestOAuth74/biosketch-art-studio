-- Add sharing capability to user_assets
ALTER TABLE public.user_assets
ADD COLUMN is_shared BOOLEAN DEFAULT false,
ADD COLUMN shared_at TIMESTAMPTZ;

-- Create index for faster shared asset queries
CREATE INDEX idx_user_assets_is_shared ON public.user_assets(is_shared) WHERE is_shared = true;

-- Update RLS policies to allow viewing shared assets
CREATE POLICY "Anyone can view shared assets"
  ON public.user_assets FOR SELECT
  USING (is_shared = true OR auth.uid() = user_id);

-- Drop the old policy that only allowed viewing own assets
DROP POLICY IF EXISTS "Users can view own assets" ON public.user_assets;