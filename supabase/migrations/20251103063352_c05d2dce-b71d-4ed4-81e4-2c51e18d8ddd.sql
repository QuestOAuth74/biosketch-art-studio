-- Update user-assets bucket to allow SVG uploads and increase file size limit
UPDATE storage.buckets
SET 
  allowed_mime_types = ARRAY['image/svg+xml', 'image/png', 'image/jpeg']::text[],
  file_size_limit = 10485760  -- 10MB for high-quality icons
WHERE id = 'user-assets';

-- Allow users to upload icons to their submissions folder
CREATE POLICY "Users can upload to submissions folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-assets' 
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND (storage.foldername(name))[2] = 'submissions'
);

-- Allow public to view submissions for review
CREATE POLICY "Anyone can view submissions"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'user-assets' 
  AND (storage.foldername(name))[2] = 'submissions'
);