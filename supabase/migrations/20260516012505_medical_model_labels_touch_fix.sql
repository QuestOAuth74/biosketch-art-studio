-- Fix: the touch_medical_models_updated_at() trigger function references
-- NEW.status, which only exists on medical_models. Attaching it to
-- medical_model_labels (which has no status column) makes every UPDATE on
-- labels fail with: record "new" has no field "status".
--
-- Solution: use a dedicated minimal updated_at toucher for the labels table.

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_medical_model_labels_touch ON public.medical_model_labels;
CREATE TRIGGER trg_medical_model_labels_touch
  BEFORE UPDATE ON public.medical_model_labels
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
