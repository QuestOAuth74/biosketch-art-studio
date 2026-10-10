-- Create storage bucket for project thumbnails
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-thumbnails',
  'project-thumbnails',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own project thumbnails
CREATE POLICY "Users can upload project thumbnails"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-thumbnails' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update their own project thumbnails
CREATE POLICY "Users can update their project thumbnails"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'project-thumbnails' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access to all project thumbnails
CREATE POLICY "Anyone can view project thumbnails"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'project-thumbnails');