-- Create powerpoint_generations table
CREATE TABLE public.powerpoint_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  original_filename TEXT NOT NULL,
  generated_filename TEXT NOT NULL,
  template_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  word_doc_path TEXT,
  status TEXT DEFAULT 'processing',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.powerpoint_generations ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "Admins can view all generations"
  ON public.powerpoint_generations FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert generations"
  ON public.powerpoint_generations FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update generations"
  ON public.powerpoint_generations FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete generations"
  ON public.powerpoint_generations FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('ppt-word-uploads', 'ppt-word-uploads', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('ppt-generated', 'ppt-generated', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies for Word uploads bucket
CREATE POLICY "Admins can upload Word documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'ppt-word-uploads' AND
    has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins can view Word documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'ppt-word-uploads' AND
    has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins can delete Word documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'ppt-word-uploads' AND
    has_role(auth.uid(), 'admin'::app_role)
  );

-- Storage RLS policies for generated PPT bucket
CREATE POLICY "Admins can upload generated PPT"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'ppt-generated' AND
    has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins can view generated PPT"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'ppt-generated' AND
    has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins can delete generated PPT"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'ppt-generated' AND
    has_role(auth.uid(), 'admin'::app_role)
  );