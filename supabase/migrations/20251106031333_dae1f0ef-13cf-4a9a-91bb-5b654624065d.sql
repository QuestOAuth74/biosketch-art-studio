-- Create custom PowerPoint templates table
CREATE TABLE public.powerpoint_custom_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  colors JSONB NOT NULL,
  fonts JSONB NOT NULL,
  layouts JSONB NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.powerpoint_custom_templates ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "Admins can view all templates"
  ON public.powerpoint_custom_templates FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert templates"
  ON public.powerpoint_custom_templates FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update templates"
  ON public.powerpoint_custom_templates FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete templates"
  ON public.powerpoint_custom_templates FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_powerpoint_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_powerpoint_templates_updated_at
  BEFORE UPDATE ON public.powerpoint_custom_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_powerpoint_templates_updated_at();