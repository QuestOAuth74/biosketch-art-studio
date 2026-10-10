-- Create user_assets table for personal file library
CREATE TABLE public.user_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  thumbnail_path TEXT,
  category TEXT DEFAULT 'uncategorized',
  tags TEXT[],
  description TEXT,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX idx_user_assets_user_id ON public.user_assets(user_id);
CREATE INDEX idx_user_assets_category ON public.user_assets(category);
CREATE INDEX idx_user_assets_file_type ON public.user_assets(file_type);

-- Enable RLS
ALTER TABLE public.user_assets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own assets"
  ON public.user_assets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upload assets"
  ON public.user_assets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own assets"
  ON public.user_assets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own assets"
  ON public.user_assets FOR DELETE
  USING (auth.uid() = user_id);

-- Create storage bucket for user assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-assets', 'user-assets', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
CREATE POLICY "Users can upload own assets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'user-assets' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view own assets"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'user-assets' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own assets"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'user-assets' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own assets"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'user-assets' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );