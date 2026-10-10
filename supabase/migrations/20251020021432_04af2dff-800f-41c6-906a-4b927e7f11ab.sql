-- Update user-assets bucket to be public so avatars can be displayed
UPDATE storage.buckets
SET public = true
WHERE id = 'user-assets';

-- Add file size limit (500KB) and restrict to PNG/JPG only
UPDATE storage.buckets
SET 
  file_size_limit = 512000,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg']
WHERE id = 'user-assets';