-- Add animation feature toggle (disabled by default, admin controls visibility)
INSERT INTO public.site_settings (setting_key, setting_value)
VALUES ('animation_feature', '{"enabled": false}'::jsonb);
