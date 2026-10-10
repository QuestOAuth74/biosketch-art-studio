-- Create storage bucket for PowerPoint images
INSERT INTO storage.buckets (id, name, public)
VALUES ('ppt-images', 'ppt-images', false)
ON CONFLICT (id) DO NOTHING;

-- Create table to track images for PowerPoint generations
CREATE TABLE IF NOT EXISTS public.powerpoint_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id UUID NOT NULL REFERENCES public.powerpoint_generations(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  original_filename TEXT,
  image_type TEXT DEFAULT 'extracted', -- 'extracted' from DOCX or 'uploaded' by user
  slide_index INTEGER, -- which slide this should appear on (optional)
  position TEXT, -- 'left', 'right', 'top', 'grid', 'full'
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.powerpoint_images ENABLE ROW LEVEL SECURITY;

-- RLS Policies for powerpoint_images
CREATE POLICY "Admins can view all images"
  ON public.powerpoint_images
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert images"
  ON public.powerpoint_images
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update images"
  ON public.powerpoint_images
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete images"
  ON public.powerpoint_images
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Storage policies for ppt-images bucket
CREATE POLICY "Admins can upload images"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'ppt-images' AND
    has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins can view images"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'ppt-images' AND
    has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins can update images"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'ppt-images' AND
    has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins can delete images"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'ppt-images' AND
    has_role(auth.uid(), 'admin'::app_role)
  );