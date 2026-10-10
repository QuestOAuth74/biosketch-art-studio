-- Clone a medical model row + all of its labels in a single transaction.
-- The GLB and thumbnail files are copied on the client side via the storage
-- API; this RPC handles the relational copy (row + labels) atomically.
-- Admin-only; uses SECURITY DEFINER so the function bypasses RLS but the
-- entry-point check enforces the admin role.

CREATE OR REPLACE FUNCTION public.clone_medical_model(
  source_id UUID,
  new_glb_path TEXT,
  new_thumbnail_path TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller UUID := auth.uid();
  src public.medical_models%ROWTYPE;
  new_id UUID := gen_random_uuid();
BEGIN
  IF NOT has_role(caller, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can duplicate medical models';
  END IF;

  SELECT * INTO src FROM public.medical_models WHERE id = source_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source model not found';
  END IF;

  INSERT INTO public.medical_models (
    id, slug, title, description, body_system,
    glb_path, thumbnail_path, file_size_bytes,
    status, source_kind, source_attribution, ai_prompt,
    created_by
  ) VALUES (
    new_id,
    LEFT(regexp_replace(LOWER('copy-of-' || src.slug), '[^a-z0-9-]+', '-', 'g'), 80) || '-' || substring(new_id::text, 1, 6),
    'Copy of ' || src.title,
    src.description,
    src.body_system,
    new_glb_path,
    new_thumbnail_path,
    src.file_size_bytes,
    'draft',
    src.source_kind,
    src.source_attribution,
    src.ai_prompt,
    caller
  );

  -- Clone labels
  INSERT INTO public.medical_model_labels (
    model_id, position_xyz, normal_xyz, title, description, color_hex, sort_order
  )
  SELECT
    new_id, position_xyz, normal_xyz, title, description, color_hex, sort_order
  FROM public.medical_model_labels
  WHERE model_id = source_id;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clone_medical_model(UUID, TEXT, TEXT) TO authenticated;
