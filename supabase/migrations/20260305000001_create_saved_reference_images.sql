-- Create saved_reference_images table for AI Reference Guide
CREATE TABLE public.saved_reference_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  sources text[] DEFAULT '{}',
  storage_path text NOT NULL,
  mime_type text NOT NULL DEFAULT 'image/png',
  file_size integer,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_saved_reference_images_user_id ON public.saved_reference_images(user_id);
CREATE INDEX idx_saved_reference_images_created_at ON public.saved_reference_images(created_at DESC);

-- Enable RLS
ALTER TABLE public.saved_reference_images ENABLE ROW LEVEL SECURITY;

-- Users can view their own saved references
CREATE POLICY "Users can view own saved references"
  ON public.saved_reference_images
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can save references
CREATE POLICY "Users can save references"
  ON public.saved_reference_images
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete own saved references
CREATE POLICY "Users can delete own saved references"
  ON public.saved_reference_images
  FOR DELETE
  USING (auth.uid() = user_id);
