-- 3D medical visualizer: admin-curated labeled anatomic models.
-- Phase 1 is admin-only end-to-end. Tables, storage bucket, and policies
-- all restrict access to users with the admin role. When the feature ships
-- publicly, we'll relax the SELECT policy on medical_models to also allow
-- status='published' rows, and on the storage bucket to allow reading any
-- path whose model row is published.

-- ─── Tables ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.medical_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description TEXT,
  body_system TEXT,               -- e.g. 'cardiovascular', 'neuro', 'msk'
  glb_path TEXT NOT NULL,         -- Supabase Storage path inside medical-models bucket
  thumbnail_path TEXT,            -- optional preview image path in same bucket
  file_size_bytes BIGINT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  source_kind TEXT NOT NULL DEFAULT 'upload' CHECK (source_kind IN ('upload', 'ai_generated')),
  source_attribution TEXT,        -- license/attribution string for sourced models
  ai_prompt TEXT,                 -- when source_kind = 'ai_generated'
  view_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_medical_models_status_created
  ON public.medical_models (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_medical_models_body_system
  ON public.medical_models (body_system) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_medical_models_slug
  ON public.medical_models (slug);

-- Labels live on (or near) the mesh in world coordinates. position_xyz lets
-- us attach a label to an arbitrary point — useful for both surface labels
-- and interior structures.
CREATE TABLE IF NOT EXISTS public.medical_model_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES public.medical_models(id) ON DELETE CASCADE,
  position_xyz JSONB NOT NULL,    -- {"x": 0.12, "y": -0.4, "z": 0.05}
  normal_xyz JSONB,               -- optional surface normal for offsetting the label flag
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description TEXT,
  color_hex TEXT,                 -- optional accent color
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_medical_model_labels_model
  ON public.medical_model_labels (model_id, sort_order);

ALTER TABLE public.medical_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_model_labels ENABLE ROW LEVEL SECURITY;

-- ─── RLS: admin-only for everything in Phase 1 ─────────────────────────────
DROP POLICY IF EXISTS "Admins read medical_models" ON public.medical_models;
DROP POLICY IF EXISTS "Admins write medical_models" ON public.medical_models;
DROP POLICY IF EXISTS "Admins update medical_models" ON public.medical_models;
DROP POLICY IF EXISTS "Admins delete medical_models" ON public.medical_models;
DROP POLICY IF EXISTS "Admins read labels" ON public.medical_model_labels;
DROP POLICY IF EXISTS "Admins write labels" ON public.medical_model_labels;
DROP POLICY IF EXISTS "Admins update labels" ON public.medical_model_labels;
DROP POLICY IF EXISTS "Admins delete labels" ON public.medical_model_labels;

CREATE POLICY "Admins read medical_models"
  ON public.medical_models FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins write medical_models"
  ON public.medical_models FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update medical_models"
  ON public.medical_models FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete medical_models"
  ON public.medical_models FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins read labels"
  ON public.medical_model_labels FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins write labels"
  ON public.medical_model_labels FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update labels"
  ON public.medical_model_labels FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete labels"
  ON public.medical_model_labels FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ─── Storage bucket for GLB files ──────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'medical-models',
  'medical-models',
  false,                                                -- private bucket
  52428800,                                             -- 50 MB cap
  ARRAY['model/gltf-binary', 'application/octet-stream', 'image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS — admins only for now. When we go public we'll add a SELECT
-- policy that joins to medical_models WHERE status = 'published'.
DROP POLICY IF EXISTS "Admins read medical-models bucket" ON storage.objects;
DROP POLICY IF EXISTS "Admins write medical-models bucket" ON storage.objects;
DROP POLICY IF EXISTS "Admins update medical-models bucket" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete medical-models bucket" ON storage.objects;

CREATE POLICY "Admins read medical-models bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'medical-models' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins write medical-models bucket"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'medical-models' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update medical-models bucket"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'medical-models' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete medical-models bucket"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'medical-models' AND has_role(auth.uid(), 'admin'::app_role));

-- ─── updated_at maintenance ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_medical_models_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.status = 'published' AND (OLD.status IS DISTINCT FROM 'published' OR OLD IS NULL) THEN
    NEW.published_at := COALESCE(NEW.published_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_medical_models_touch ON public.medical_models;
CREATE TRIGGER trg_medical_models_touch
  BEFORE UPDATE ON public.medical_models
  FOR EACH ROW EXECUTE FUNCTION public.touch_medical_models_updated_at();

DROP TRIGGER IF EXISTS trg_medical_model_labels_touch ON public.medical_model_labels;
CREATE TRIGGER trg_medical_model_labels_touch
  BEFORE UPDATE ON public.medical_model_labels
  FOR EACH ROW EXECUTE FUNCTION public.touch_medical_models_updated_at();

COMMENT ON TABLE public.medical_models IS
  'Admin-curated 3D anatomic models with status workflow (draft / published / archived). Phase 1 admin-only; relax SELECT for status=published on public launch.';
