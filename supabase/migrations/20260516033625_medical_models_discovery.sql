-- Phase 6 — Discovery & shareability
--   1. is_featured column on medical_models for admin promotion
--   2. increment_medical_model_view() RPC so anon visits bump view_count
--      without granting direct UPDATE access on the table
--   3. medical_model_label_clicks table for lightweight analytics on which
--      labels actually get used during patient encounters
--   4. medical_models_searchable view for full-text search across model
--      title/description + label title/description

-- ─── Featured flag ─────────────────────────────────────────────────────────
ALTER TABLE public.medical_models
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_medical_models_featured
  ON public.medical_models (is_featured DESC, published_at DESC)
  WHERE status = 'published';

-- ─── View tracking RPC (anon-callable, SECURITY DEFINER) ───────────────────
CREATE OR REPLACE FUNCTION public.increment_medical_model_view(p_model_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.medical_models
  SET view_count = view_count + 1
  WHERE id = p_model_id AND status = 'published';
END;
$$;
GRANT EXECUTE ON FUNCTION public.increment_medical_model_view(UUID) TO anon, authenticated;

-- ─── Label click analytics ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.medical_model_label_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES public.medical_models(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES public.medical_model_labels(id) ON DELETE CASCADE,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_medical_label_clicks_label_clicked
  ON public.medical_model_label_clicks (label_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_medical_label_clicks_model_clicked
  ON public.medical_model_label_clicks (model_id, clicked_at DESC);

ALTER TABLE public.medical_model_label_clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can record label clicks" ON public.medical_model_label_clicks;
DROP POLICY IF EXISTS "Admins read label clicks" ON public.medical_model_label_clicks;

-- Anyone (incl. anon) may record a click; we only accept clicks for labels
-- whose parent model is published so the analytics aren't gamed via drafts.
CREATE POLICY "Anyone can record label clicks on published models"
  ON public.medical_model_label_clicks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.medical_models m
      WHERE m.id = model_id AND m.status = 'published'
    )
  );

-- Admins read for dashboards.
CREATE POLICY "Admins read label clicks"
  ON public.medical_model_label_clicks FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ─── Search view: aggregates label text for catalog search ────────────────
-- A simple denormalized view of every model + concatenated label text.
-- Cheaper for v1 than maintaining a tsvector — ilike against the column.
CREATE OR REPLACE VIEW public.medical_models_searchable AS
SELECT
  m.id,
  m.slug,
  m.title,
  m.description,
  m.body_system,
  m.thumbnail_path,
  m.status,
  m.source_kind,
  m.view_count,
  m.is_featured,
  m.published_at,
  m.created_at,
  m.updated_at,
  -- All searchable text in one column for ilike.
  lower(
    coalesce(m.title, '') || ' ' ||
    coalesce(m.description, '') || ' ' ||
    coalesce(m.body_system, '') || ' ' ||
    coalesce((
      SELECT string_agg(l.title || ' ' || coalesce(l.description, ''), ' ')
      FROM public.medical_model_labels l
      WHERE l.model_id = m.id
    ), '')
  ) AS search_text
FROM public.medical_models m;

-- Views inherit the underlying table's RLS; medical_models policies already
-- restrict to admin + published. No additional grant needed.
GRANT SELECT ON public.medical_models_searchable TO anon, authenticated;
