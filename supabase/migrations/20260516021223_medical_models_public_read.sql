-- Open read access on published medical models to the public (anon + auth).
-- Writes still admin-only via the existing policies created earlier.
-- Drafts and archived models remain admin-only because the new SELECT
-- policies are additive — anon only sees status='published' rows; admins
-- continue to see everything through the existing admin-read policy.

-- ─── medical_models: anyone can read published rows ─────────────────────────
DROP POLICY IF EXISTS "Public read of published medical_models" ON public.medical_models;
CREATE POLICY "Public read of published medical_models"
  ON public.medical_models FOR SELECT
  USING (status = 'published');

-- ─── medical_model_labels: anyone can read labels of published models ──────
DROP POLICY IF EXISTS "Public read of labels on published models" ON public.medical_model_labels;
CREATE POLICY "Public read of labels on published models"
  ON public.medical_model_labels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.medical_models m
      WHERE m.id = model_id AND m.status = 'published'
    )
  );

-- ─── storage.objects: anyone can read GLBs for published models ────────────
-- Bucket stays private so file paths aren't enumerable; the policy joins to
-- medical_models on glb_path so only files attached to a published row are
-- readable. Admins still match the existing admin-read policy.
DROP POLICY IF EXISTS "Public read of GLBs for published medical models" ON storage.objects;
CREATE POLICY "Public read of GLBs for published medical models"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'medical-models'
    AND EXISTS (
      SELECT 1 FROM public.medical_models m
      WHERE m.glb_path = storage.objects.name
        AND m.status = 'published'
    )
  );
