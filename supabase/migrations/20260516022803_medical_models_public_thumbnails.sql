-- The existing public-read policy on storage.objects only matched files where
-- the storage object's name = medical_models.glb_path. Now that admins also
-- upload PNG thumbnails into the same bucket, we need the policy to also let
-- anon read files whose name = medical_models.thumbnail_path for any
-- published model.

DROP POLICY IF EXISTS "Public read of GLBs for published medical models" ON storage.objects;
DROP POLICY IF EXISTS "Public read of files for published medical models" ON storage.objects;

CREATE POLICY "Public read of files for published medical models"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'medical-models'
    AND EXISTS (
      SELECT 1 FROM public.medical_models m
      WHERE m.status = 'published'
        AND (m.glb_path = storage.objects.name OR m.thumbnail_path = storage.objects.name)
    )
  );
