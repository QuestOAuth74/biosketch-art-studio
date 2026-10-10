-- Insert default membrane settings into ai_provider_settings
INSERT INTO public.ai_provider_settings (setting_key, setting_value)
VALUES (
  'membrane_defaults',
  jsonb_build_object(
    'default_icon_id', null,
    'default_icon_size', 40,
    'default_spacing', 0,
    'default_rotate_to_path', true,
    'default_double_sided', false,
    'default_orientation_offset', 0
  )
)
ON CONFLICT (setting_key) DO NOTHING;

-- Add helpful comment
COMMENT ON TABLE public.ai_provider_settings IS 'Admin configuration settings (AI providers, membrane defaults, etc.)';
