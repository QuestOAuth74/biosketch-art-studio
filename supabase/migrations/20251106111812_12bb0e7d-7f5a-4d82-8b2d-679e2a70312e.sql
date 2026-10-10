-- Create table for AI provider settings
CREATE TABLE IF NOT EXISTS public.ai_provider_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_provider_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can read settings
CREATE POLICY "Admins can view AI settings"
ON public.ai_provider_settings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can update settings
CREATE POLICY "Admins can update AI settings"
ON public.ai_provider_settings
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can insert settings
CREATE POLICY "Admins can insert AI settings"
ON public.ai_provider_settings
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_ai_provider_settings_updated_at
BEFORE UPDATE ON public.ai_provider_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_blog_posts_updated_at();

-- Insert default settings
INSERT INTO public.ai_provider_settings (setting_key, setting_value)
VALUES (
  'powerpoint_generation',
  jsonb_build_object(
    'primary_provider', 'manus',
    'fallback_enabled', true,
    'timeout_ms', 45000
  )
)
ON CONFLICT (setting_key) DO NOTHING;